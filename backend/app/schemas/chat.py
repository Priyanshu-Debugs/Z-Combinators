from pydantic import BaseModel, Field
from typing import Literal, Optional
from datetime import datetime
from app.schemas.evaluation import DimensionResult


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    evaluations: Optional[list[DimensionResult]] = None
    suggested_followups: Optional[list[str]] = None
    created_at: Optional[datetime] = None


class MessageRequest(BaseModel):
    session_id: str
    content: str


class MessageResponse(BaseModel):
    session_id: str
    reply: str
    evaluations: list[DimensionResult]
    history: list[ChatMessage]
    compiled_dossier: list[DimensionResult]


class CreateSessionRequest(BaseModel):
    title: Optional[str] = "Startup Evaluation Session"


class UpdateSessionTitleRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)


class SessionSummaryResponse(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    message_count: int = 0
    latest_score: Optional[float] = None
