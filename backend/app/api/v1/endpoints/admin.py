import json
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.session import ChatSessionTable
from app.models.message import ChatMessageTable
from app.core.config import settings

router = APIRouter()


@router.get("/metrics")
def get_admin_metrics(secret_code: str, db: Session = Depends(get_db)):
    """Retrieve aggregated evaluation metrics and recent pitches."""
    if secret_code != settings.ADMIN_PASSCODE:
        raise HTTPException(status_code=401, detail="Unauthorized")

    sessions = db.query(ChatSessionTable).all()
    all_messages = (
        db.query(ChatMessageTable)
        .order_by(ChatMessageTable.created_at.asc())
        .all()
    )

    messages_by_session = {}
    for m in all_messages:
        messages_by_session.setdefault(m.session_id, []).append(m)

    recent_evals = []
    dim_totals = {d: 0 for d in ["Market", "Team", "Timing", "Competition", "Moat", "Execution"]}
    dim_counts = {d: 0 for d in ["Market", "Team", "Timing", "Competition", "Moat", "Execution"]}

    for s in sessions:
        s_messages = messages_by_session.get(s.id, [])
        first_user = next((m for m in s_messages if m.role == "user"), None)
        pitch = first_user.content if first_user else "No pitch submitted yet"

        compiled_evals = {}
        for m in s_messages:
            if m.evaluations:
                evals_list = m.evaluations
                if isinstance(evals_list, str):
                    try:
                        evals_list = json.loads(evals_list)
                    except Exception:
                        continue
                if isinstance(evals_list, list):
                    for ev in evals_list:
                        dim_name = ev.get("dimension")
                        score = ev.get("score", 0)
                        if dim_name:
                            dim_title = dim_name.title()
                            existing = compiled_evals.get(dim_title)
                            if score > 0 or existing is None:
                                compiled_evals[dim_title] = ev

        if compiled_evals:
            scores = [ev["score"] for ev in compiled_evals.values() if ev.get("score", 0) > 0]
            avg_score = round(sum(scores) / len(scores), 1) if scores else 0
            for dim_name, ev in compiled_evals.items():
                if dim_name in dim_totals and ev.get("score", 0) > 0:
                    dim_totals[dim_name] += ev["score"]
                    dim_counts[dim_name] += 1
        else:
            avg_score = 0

        recent_evals.append({
            "session_id": s.id,
            "title": s.title or "Evaluation Session",
            "pitch": pitch,
            "overall_score": avg_score,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "message_count": len(s_messages),
        })

    recent_evals.sort(key=lambda x: x["created_at"] or "", reverse=True)

    dim_averages = []
    for dim, total in dim_totals.items():
        count = dim_counts[dim]
        avg = round(total / count, 1) if count > 0 else 0
        dim_averages.append({"dimension": dim, "score": avg})

    valid_scores = [e["overall_score"] for e in recent_evals if e["overall_score"] > 0]
    global_avg = round(sum(valid_scores) / len(valid_scores), 1) if valid_scores else 0

    distribution = {"low": 0, "mid": 0, "high": 0}
    for score in valid_scores:
        if score < 5.0:
            distribution["low"] += 1
        elif score < 8.0:
            distribution["mid"] += 1
        else:
            distribution["high"] += 1

    return {
        "total_sessions": len(sessions),
        "total_messages": len(all_messages),
        "global_average": global_avg,
        "dimension_averages": dim_averages,
        "score_distribution": distribution,
        "recent_evaluations": recent_evals[:50],
    }
