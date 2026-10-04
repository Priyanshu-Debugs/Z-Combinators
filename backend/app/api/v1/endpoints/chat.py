import uuid
import json
import logging
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.db.session import get_db
from app.models.session import ChatSessionTable
from app.models.message import ChatMessageTable
from app.schemas.chat import (
    MessageRequest,
    MessageResponse,
    ChatMessage,
    CreateSessionRequest,
    UpdateSessionTitleRequest,
    SessionSummaryResponse,
)
from app.services.chat_service import (
    evaluate_chat_turn,
    evaluate_chat_turn_stream,
    compile_dossier_from_messages,
)
from app.api.deps import get_current_user_id, get_optional_user_id
from app.core.config import settings

logger = logging.getLogger("uvicorn.error")
limiter = Limiter(key_func=get_remote_address)
router = APIRouter()


@router.post("/session")
def start_session_endpoint(
    body: Optional[CreateSessionRequest] = None,
    user_id: Optional[str] = Depends(get_optional_user_id),
    db: Session = Depends(get_db),
):
    """Initialize a new chat session with a unique UUID and optional Clerk user_id."""
    session_id = str(uuid.uuid4())
    title = body.title if body and body.title else "Startup Evaluation Session"

    session = ChatSessionTable(
        id=session_id,
        user_id=user_id,
        title=title,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(session)
    db.commit()
    return {"session_id": session_id, "title": title}


@router.get("/sessions", response_model=List[SessionSummaryResponse])
def get_user_sessions_endpoint(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Retrieve all past evaluation sessions for the logged-in user."""
    sessions = (
        db.query(ChatSessionTable)
        .filter(ChatSessionTable.user_id == user_id)
        .order_by(ChatSessionTable.updated_at.desc())
        .all()
    )

    summaries = []
    for s in sessions:
        msg_count = db.query(ChatMessageTable).filter(ChatMessageTable.session_id == s.id).count()
        summaries.append(
            SessionSummaryResponse(
                id=s.id,
                title=s.title or "Untitled Pitch",
                created_at=s.created_at,
                updated_at=s.updated_at,
                message_count=msg_count,
                latest_score=s.latest_score,
            )
        )
    return summaries


@router.get("/session/{session_id}", response_model=MessageResponse)
def get_session_endpoint(session_id: str, db: Session = Depends(get_db)):
    """Retrieve chat history and compiled dossier reports for an existing session."""
    session = db.query(ChatSessionTable).filter(ChatSessionTable.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    messages = (
        db.query(ChatMessageTable)
        .filter(ChatMessageTable.session_id == session_id)
        .order_by(ChatMessageTable.created_at.asc())
        .all()
    )

    compiled = compile_dossier_from_messages(messages)

    history = [
        ChatMessage(
            role=m.role,
            content=m.content,
            evaluations=m.evaluations,
            suggested_followups=m.suggested_followups,
            created_at=m.created_at,
        )
        for m in messages
    ]

    return MessageResponse(
        session_id=session_id,
        reply="",
        evaluations=[],
        history=history,
        compiled_dossier=compiled,
    )


@router.patch("/session/{session_id}")
def update_session_title_endpoint(
    session_id: str,
    body: UpdateSessionTitleRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Update title of an existing session owned by the authenticated user."""
    session = (
        db.query(ChatSessionTable)
        .filter(ChatSessionTable.id == session_id, ChatSessionTable.user_id == user_id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or unauthorized.")

    session.title = body.title
    session.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Title updated successfully", "title": body.title}


@router.delete("/session/{session_id}")
def delete_session_endpoint(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Delete a session owned by the authenticated user."""
    session = (
        db.query(ChatSessionTable)
        .filter(ChatSessionTable.id == session_id, ChatSessionTable.user_id == user_id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or unauthorized.")

    db.delete(session)
    db.commit()
    return {"message": "Session deleted successfully."}


@router.post("/message", response_model=MessageResponse)
@limiter.limit(settings.RATE_LIMIT)
async def post_message_endpoint(
    request: Request,
    body: MessageRequest,
    user_id: Optional[str] = Depends(get_optional_user_id),
    db: Session = Depends(get_db),
):
    """Post a message to the chat advisor synchronously."""
    session_id = body.session_id
    content = body.content

    session = db.query(ChatSessionTable).filter(ChatSessionTable.id == session_id).first()
    if not session:
        session = ChatSessionTable(
            id=session_id,
            user_id=user_id,
            title="Startup Evaluation Session",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(session)
        db.commit()
    elif user_id and not session.user_id:
        session.user_id = user_id

    # 1. Fetch current history for RAG context
    existing_messages = (
        db.query(ChatMessageTable)
        .filter(ChatMessageTable.session_id == session_id)
        .order_by(ChatMessageTable.created_at.asc())
        .all()
    )
    history_raw = [{"role": m.role, "content": m.content} for m in existing_messages]

    # 2. Save user message
    user_msg = ChatMessageTable(session_id=session_id, role="user", content=content)
    db.add(user_msg)
    db.commit()

    # 3. Call LangChain RAG pipeline with single-pass retrieval
    reply, evaluations, suggested_followups = await evaluate_chat_turn(content, history_raw)

    # 4. Save assistant response and update session score
    evals_json = [ev.model_dump() if hasattr(ev, "model_dump") else ev for ev in evaluations]
    asst_msg = ChatMessageTable(
        session_id=session_id,
        role="assistant",
        content=reply,
        evaluations=evals_json,
        suggested_followups=suggested_followups,
    )
    db.add(asst_msg)

    # Update session updated_at and latest_score
    session.updated_at = datetime.now(timezone.utc)
    scored = [ev.score for ev in evaluations if ev.score > 0]
    if scored:
        session.latest_score = round(sum(scored) / len(scored), 1)

    db.commit()

    # 5. Fetch updated dossier
    all_msgs = (
        db.query(ChatMessageTable)
        .filter(ChatMessageTable.session_id == session_id)
        .order_by(ChatMessageTable.created_at.asc())
        .all()
    )
    compiled = compile_dossier_from_messages(all_msgs)

    history = [
        ChatMessage(
            role=m.role,
            content=m.content,
            evaluations=m.evaluations,
            suggested_followups=m.suggested_followups,
            created_at=m.created_at,
        )
        for m in all_msgs
    ]

    return MessageResponse(
        session_id=session_id,
        reply=reply,
        evaluations=evaluations,
        history=history,
        compiled_dossier=compiled,
    )


@router.post("/message/stream")
@limiter.limit(settings.RATE_LIMIT)
async def post_message_stream_endpoint(
    request: Request,
    body: MessageRequest,
    user_id: Optional[str] = Depends(get_optional_user_id),
    db: Session = Depends(get_db),
):
    """Post a message to the chat advisor and stream the response via SSE."""
    session_id = body.session_id
    content = body.content

    session = db.query(ChatSessionTable).filter(ChatSessionTable.id == session_id).first()
    if not session:
        session = ChatSessionTable(
            id=session_id,
            user_id=user_id,
            title="Startup Evaluation Session",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(session)
        db.commit()
    elif user_id and not session.user_id:
        session.user_id = user_id
        db.commit()

    # 1. Fetch current history for RAG context
    existing_messages = (
        db.query(ChatMessageTable)
        .filter(ChatMessageTable.session_id == session_id)
        .order_by(ChatMessageTable.created_at.asc())
        .all()
    )
    history_raw = [{"role": m.role, "content": m.content} for m in existing_messages]

    # 2. Save user message to database
    user_msg = ChatMessageTable(session_id=session_id, role="user", content=content)
    db.add(user_msg)
    db.commit()

    async def event_generator():
        full_reply = ""
        final_evals = []
        suggested_followups = []

        try:
            async for event in evaluate_chat_turn_stream(content, history_raw):
                if event["type"] == "token":
                    full_reply += event["content"]
                    yield f"data: {json.dumps(event)}\n\n"
                elif event["type"] == "evaluations":
                    final_evals = event["evaluations"]
                    suggested_followups = event.get("suggested_followups", [])

            # Save assistant response
            evals_json = [ev.model_dump() if hasattr(ev, "model_dump") else ev for ev in final_evals]
            asst_msg = ChatMessageTable(
                session_id=session_id,
                role="assistant",
                content=full_reply,
                evaluations=evals_json,
                suggested_followups=suggested_followups,
            )
            db.add(asst_msg)

            # Update session latest_score & updated_at
            session.updated_at = datetime.now(timezone.utc)
            scored = [ev.score for ev in final_evals if getattr(ev, "score", 0) > 0]
            if scored:
                session.latest_score = round(sum(scored) / len(scored), 1)

            db.commit()

            # Compile updated dossier
            all_msgs = (
                db.query(ChatMessageTable)
                .filter(ChatMessageTable.session_id == session_id)
                .order_by(ChatMessageTable.created_at.asc())
                .all()
            )
            compiled = compile_dossier_from_messages(all_msgs)
            compiled_json = [ev.model_dump() if hasattr(ev, "model_dump") else ev for ev in compiled]

            yield f"data: {json.dumps({
                'type': 'done',
                'evaluations': evals_json,
                'compiled_dossier': compiled_json,
                'suggested_followups': suggested_followups
            })}\n\n"

        except Exception as e:
            logger.error(f"Streaming error: {e}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'content': 'An unexpected error occurred. Please try again.'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
