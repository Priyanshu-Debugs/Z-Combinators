from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, Float
from sqlalchemy.orm import relationship
from app.db.base import Base


class ChatSessionTable(Base):
    __tablename__ = "chat_sessions"

    id = Column(String(255), primary_key=True)
    user_id = Column(String(255), nullable=True, index=True)  # Clerk user ID (e.g. user_2abc...)
    title = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    latest_score = Column(Float, nullable=True)

    messages = relationship(
        "ChatMessageTable", back_populates="session", cascade="all, delete-orphan"
    )
