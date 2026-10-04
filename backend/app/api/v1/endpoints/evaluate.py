from fastapi import APIRouter, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.schemas.evaluation import EvaluateRequest, EvaluateResponse
from app.services.evaluator_service import evaluate_idea
from app.core.config import settings

limiter = Limiter(key_func=get_remote_address)
router = APIRouter()


@router.post("", response_model=EvaluateResponse)
@limiter.limit(settings.RATE_LIMIT)
async def evaluate_endpoint(request: Request, body: EvaluateRequest):
    """Static 6-dimension RAG evaluation endpoint."""
    result = await evaluate_idea(body.idea)
    return result
