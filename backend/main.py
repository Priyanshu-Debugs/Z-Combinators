import uuid
import json
import logging

logger = logging.getLogger("uvicorn.error")
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from config import settings
from models import (
    EvaluateRequest,
    EvaluateResponse,
    MessageRequest,
    MessageResponse,
    ChatMessage
)
from rag.evaluator import evaluate_idea
from rag.chat import evaluate_chat_turn, evaluate_chat_turn_stream
from database import (
    init_db,
    create_session,
    save_message,
    get_session_messages,
    get_compiled_evaluations,
    get_admin_metrics_data
)

# Rate limiter setup
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Z-Combinators API",
    description="AI-powered startup idea evaluation and chat advisor using RAG.",
    version="1.0.0",
)

# Rate limit error handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS -- allow the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Run database table initialization on startup."""
    init_db()


@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {"status": "ok"}


@app.post("/api/evaluate", response_model=EvaluateResponse)
@limiter.limit(settings.RATE_LIMIT)
async def evaluate_endpoint(request: Request, body: EvaluateRequest):
    """
    Static RAG evaluation endpoint (kept for backward compatibility).
    """
    result = await evaluate_idea(body.idea)
    return result


@app.post("/api/chat/session")
async def start_session_endpoint():
    """Initialize a new chat session with a unique UUID."""
    session_id = str(uuid.uuid4())
    create_session(session_id, title="Startup Evaluation Chat")
    return {"session_id": session_id}


@app.get("/api/chat/session/{session_id}", response_model=MessageResponse)
async def get_session_endpoint(session_id: str):
    """Retrieve chat history and compiled dossier reports for an existing session."""
    messages = get_session_messages(session_id)
    compiled = get_compiled_evaluations(session_id)
    
    history = [
        ChatMessage(
            role=m["role"],
            content=m["content"],
            evaluations=m["evaluations"],
            suggested_followups=m.get("suggested_followups")
        )
        for m in messages
    ]
    
    return MessageResponse(
        session_id=session_id,
        reply="",
        evaluations=[],
        history=history,
        compiled_dossier=compiled
    )


@app.post("/api/chat/message", response_model=MessageResponse)
@limiter.limit(settings.RATE_LIMIT)
async def post_message_endpoint(request: Request, body: MessageRequest):
    """
    Post a message to the chat advisor.
    
    1. Fetch context history.
    2. Save user message.
    3. Run evaluation through LangChain RAG.
    4. Save assistant response and evaluations.
    5. Compile and return message list and current dossier scores.
    """
    session_id = body.session_id
    content = body.content
    
    # 1. Fetch current history for RAG context
    history_raw = get_session_messages(session_id)
    
    # 2. Save user message to database
    save_message(session_id, "user", content)
    
    # 3. Call LangChain RAG chat pipeline
    reply, evaluations, suggested_followups = await evaluate_chat_turn(content, history_raw)
    
    # 4. Save assistant response and evaluations to database
    evals_json = [ev.model_dump() if hasattr(ev, "model_dump") else ev for ev in evaluations]
    save_message(session_id, "assistant", reply, evals_json, suggested_followups)
    
    # 5. Fetch updated logs and compiled dossier
    updated_history_raw = get_session_messages(session_id)
    history = [
        ChatMessage(
            role=m["role"],
            content=m["content"],
            evaluations=m["evaluations"],
            suggested_followups=m.get("suggested_followups")
        )
        for m in updated_history_raw
    ]
    compiled = get_compiled_evaluations(session_id)
    
    return MessageResponse(
        session_id=session_id,
        reply=reply,
        evaluations=evaluations,
        history=history,
        compiled_dossier=compiled
    )


@app.post("/api/chat/message/stream")
@limiter.limit(settings.RATE_LIMIT)
async def post_message_stream_endpoint(request: Request, body: MessageRequest):
    """
    Post a message to the chat advisor and stream the response.
    
    1. Fetch context history.
    2. Save user message.
    3. Stream evaluation through LangChain RAG.
    4. Save assistant response and evaluations.
    5. Emit final compiled evaluations.
    """
    session_id = body.session_id
    content = body.content
    
    # 1. Fetch current history for RAG context
    history_raw = get_session_messages(session_id)
    
    # 2. Save user message to database
    save_message(session_id, "user", content)
    
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
            
            # Save assistant response and evaluations to database
            evals_json = [ev.model_dump() if hasattr(ev, "model_dump") else ev for ev in final_evals]
            save_message(session_id, "assistant", full_reply, evals_json, suggested_followups)
            
            # Fetch updated compiled dossier
            compiled = get_compiled_evaluations(session_id)
            compiled_json = [ev.model_dump() if hasattr(ev, "model_dump") else ev for ev in compiled]
            
            # Send completion signal with final data
            yield f"data: {json.dumps({
                'type': 'done',
                'evaluations': evals_json,
                'compiled_dossier': compiled_json,
                'suggested_followups': suggested_followups
            })}\n\n"
            
        except Exception as e:
            logger.error(f"Streaming evaluation error: {e}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'content': 'We are sorry for the inconvenience, but we encountered an unexpected error while processing your request. Please try again shortly.'})}\n\n"
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/api/admin/metrics")
async def get_admin_metrics(secret_code: str):
    """
    Retrieve aggregated evaluation metrics and recent pitches.
    Only accessible using the correct secret code.
    """
    if secret_code != "Priyaanshu-Debugs":
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        data = get_admin_metrics_data()
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

