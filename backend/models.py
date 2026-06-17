from pydantic import BaseModel, Field
from typing import Literal


# ===== REQUEST =====
class EvaluateRequest(BaseModel):
    idea: str = Field(
        ...,
        min_length=20,
        max_length=2000,
        description="The startup idea to evaluate, described in 2-5 sentences.",
    )


# ===== RESPONSE =====
class DimensionResult(BaseModel):
    dimension: str
    score: int = Field(..., ge=1, le=10)
    justification: str
    source_excerpt: str
    source_framework: str
    confidence: Literal["high", "medium", "low"]


class EvaluateResponse(BaseModel):
    overall_score: float = Field(..., ge=1.0, le=10.0)
    dimensions: list[DimensionResult]
