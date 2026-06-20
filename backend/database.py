import os
import json
from datetime import datetime, timezone
from sqlalchemy import create_engine, Column, String, Integer, Text, DateTime, JSON, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from dotenv import load_dotenv

load_dotenv()

# Get Database URL from environment; fallback to local SQLite for frictionless local development
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
if not DATABASE_URL:
    DATABASE_URL = "sqlite:///./chat_history.db"

# Setup engine and connection
if DATABASE_URL.startswith("postgresql"):
    # Ensure SSL mode is enabled for Neon Postgres if not specified
    if "sslmode" not in DATABASE_URL:
        separator = "&" if "?" in DATABASE_URL else "?"
        DATABASE_URL = f"{DATABASE_URL}{separator}sslmode=require"
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
else:
    # SQLite configuration
    engine = create_engine(
        DATABASE_URL, 
        connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class ChatSessionTable(Base):
    __tablename__ = "chat_sessions"

    id = Column(String(255), primary_key=True)
    title = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    messages = relationship("ChatMessageTable", back_populates="session", cascade="all, delete-orphan")


class ChatMessageTable(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(255), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(50), nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    evaluations = Column(JSON, nullable=True)  # JSON list of newly scored dimensions
    suggested_followups = Column(JSON, nullable=True)  # JSON list of follow-up questions
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    session = relationship("ChatSessionTable", back_populates="messages")


def init_db():
    """Create all tables in the database if they do not exist."""
    Base.metadata.create_all(bind=engine)
    
    # Run automatic, non-destructive migration to add suggested_followups column
    from sqlalchemy import inspect, text
    try:
        inspector = inspect(engine)
        if inspector.has_table('chat_messages'):
            columns = [col['name'] for col in inspector.get_columns('chat_messages')]
            if 'suggested_followups' not in columns:
                db = SessionLocal()
                try:
                    db.execute(text("ALTER TABLE chat_messages ADD COLUMN suggested_followups JSON"))
                    db.commit()
                    print("Successfully migrated database schema: added suggested_followups column.")
                except Exception as migration_error:
                    db.rollback()
                    print(f"Migration warning: {migration_error}")
                finally:
                    db.close()
    except Exception as e:
        print(f"Migration inspection warning: {e}")


def create_session(session_id: str, title: str = "New Evaluation Session"):
    """Create a new chat session."""
    db = SessionLocal()
    try:
        session = ChatSessionTable(id=session_id, title=title)
        db.add(session)
        db.commit()
    finally:
        db.close()


def save_message(session_id: str, role: str, content: str, evaluations: list = None, suggested_followups: list = None):
    """Save a user or assistant message to the database."""
    db = SessionLocal()
    try:
        # Check if session exists, create it if missing
        session = db.query(ChatSessionTable).filter(ChatSessionTable.id == session_id).first()
        if not session:
            session = ChatSessionTable(id=session_id, title="Restored Session")
            db.add(session)
            db.commit()

        message = ChatMessageTable(
            session_id=session_id,
            role=role,
            content=content,
            evaluations=evaluations,
            suggested_followups=suggested_followups
        )
        db.add(message)
        db.commit()
    finally:
        db.close()


def get_session_messages(session_id: str) -> list[dict]:
    """Retrieve all messages in a session chronologically."""
    db = SessionLocal()
    try:
        messages = (
            db.query(ChatMessageTable)
            .filter(ChatMessageTable.session_id == session_id)
            .order_by(ChatMessageTable.created_at.asc())
            .all()
        )
        return [
            {
                "role": m.role,
                "content": m.content,
                "evaluations": m.evaluations if m.evaluations else None,
                "suggested_followups": m.suggested_followups if m.suggested_followups else None
            }
            for m in messages
        ]
    finally:
        db.close()


def get_compiled_evaluations(session_id: str) -> list[dict]:
    """
    Compile the aggregate score dossier for a session.
    
    Inspects all assistant messages in the chat history, taking the most
    recent score, justification, and framework citation for each dimension.
    """
    db = SessionLocal()
    try:
        messages = (
            db.query(ChatMessageTable)
            .filter(ChatMessageTable.session_id == session_id)
            .order_by(ChatMessageTable.created_at.asc())
            .all()
        )
        
        # Merge evaluations chronologically (latest values overwrite earlier ones)
        compiled_evals = {}
        for m in messages:
            if m.evaluations:
                # Ensure we handle list/dict conversions
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
                            # Only overwrite if new score is > 0, OR if there's no existing score
                            if score > 0 or existing is None:
                                compiled_evals[dim_title] = ev

        return list(compiled_evals.values())
    finally:
        db.close()


def get_admin_metrics_data() -> dict:
    """
    Compile the aggregate metrics and recent pitch evaluations for the admin panel.
    """
    db = SessionLocal()
    try:
        # Get all sessions
        sessions = db.query(ChatSessionTable).all()
        
        # Get all messages ordered chronologically
        all_messages = (
            db.query(ChatMessageTable)
            .order_by(ChatMessageTable.created_at.asc())
            .all()
        )
        
        # Group messages by session_id in Python (O(N) instead of O(N*M))
        messages_by_session = {}
        for m in all_messages:
            messages_by_session.setdefault(m.session_id, []).append(m)
            
        recent_evals = []
        
        # Track averages for the 6 dimensions
        dim_totals = {d: 0 for d in ["Market", "Team", "Timing", "Competition", "Moat", "Execution"]}
        dim_counts = {d: 0 for d in ["Market", "Team", "Timing", "Competition", "Moat", "Execution"]}
        
        for s in sessions:
            s_messages = messages_by_session.get(s.id, [])
            
            # 1. Fetch the first user message as the startup "pitch"
            first_user = next((m for m in s_messages if m.role == "user"), None)
            pitch = first_user.content if first_user else "No pitch submitted yet"
            
            # Compile the dossier from this session's messages
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
            
            # Calculate overall score for this session (average of compiled dossier, filtering out scores <= 0)
            if compiled_evals:
                scores = [ev["score"] for ev in compiled_evals.values() if ev.get("score", 0) > 0]
                avg_score = round(sum(scores) / len(scores), 1) if scores else 0
                
                # Add to dimension aggregation totals
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
                "message_count": len(s_messages)
            })
            
        # Sort recent evaluations desc (latest first)
        recent_evals.sort(key=lambda x: x["created_at"] or "", reverse=True)
        
        # Calculate dimension averages list
        dim_averages = []
        for dim, total in dim_totals.items():
            count = dim_counts[dim]
            avg = round(total / count, 1) if count > 0 else 0
            dim_averages.append({"dimension": dim, "score": avg})
            
        # Calculate global average overall score
        valid_scores = [e["overall_score"] for e in recent_evals if e["overall_score"] > 0]
        global_avg = round(sum(valid_scores) / len(valid_scores), 1) if valid_scores else 0
        
        # Score distribution buckets: low (<5), mid (5-7), high (>=8)
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
            "recent_evaluations": recent_evals[:50]  # Limit to top 50 recent
        }
    finally:
        db.close()
