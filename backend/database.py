import os
import json
from datetime import datetime
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
    created_at = Column(DateTime, default=datetime.utcnow)
    
    messages = relationship("ChatMessageTable", back_populates="session", cascade="all, delete-orphan")


class ChatMessageTable(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(255), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(50), nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    evaluations = Column(JSON, nullable=True)  # JSON list of newly scored dimensions
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("ChatSessionTable", back_populates="messages")


def init_db():
    """Create all tables in the database if they do not exist."""
    Base.metadata.create_all(bind=engine)


def create_session(session_id: str, title: str = "New Evaluation Session"):
    """Create a new chat session."""
    db = SessionLocal()
    try:
        session = ChatSessionTable(id=session_id, title=title)
        db.add(session)
        db.commit()
    finally:
        db.close()


def save_message(session_id: str, role: str, content: str, evaluations: list = None):
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
            evaluations=evaluations
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
                "evaluations": m.evaluations if m.evaluations else None
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
                        if dim_name:
                            compiled_evals[dim_name.title()] = ev

        return list(compiled_evals.values())
    finally:
        db.close()
