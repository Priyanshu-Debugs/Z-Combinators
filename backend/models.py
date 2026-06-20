from pydantic import BaseModel, Field
from typing import Literal, Optional


# ===== STATIC EVALUATION (COMPATIBILITY) =====
class EvaluateRequest(BaseModel):
    idea: str = Field(
        ...,
        min_length=20,
        max_length=2000,
        description="The startup idea to evaluate, described in 2-5 sentences.",
    )


class DimensionResult(BaseModel):
    dimension: str
    score: int = Field(..., ge=0, le=10)
    justification: str
    source_excerpt: str
    source_framework: str
    confidence: Literal["high", "medium", "low"]


class EvaluateResponse(BaseModel):
    overall_score: float = Field(..., ge=1.0, le=10.0)
    dimensions: list[DimensionResult]


# ===== CHAT PROTOCOL =====
class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    evaluations: Optional[list[DimensionResult]] = None
    suggested_followups: Optional[list[str]] = None


class MessageRequest(BaseModel):
    session_id: str
    content: str


class MessageResponse(BaseModel):
    session_id: str
    reply: str
    evaluations: list[DimensionResult]
    history: list[ChatMessage]
    compiled_dossier: list[DimensionResult]
