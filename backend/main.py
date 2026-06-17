from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from config import settings
from models import EvaluateRequest, EvaluateResponse
from rag.evaluator import evaluate_idea

# Rate limiter setup
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Z-Combinator API",
    description="AI-powered startup idea evaluation using RAG.",
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


@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {"status": "ok"}


@app.post("/api/evaluate", response_model=EvaluateResponse)
@limiter.limit(settings.RATE_LIMIT)
async def evaluate_endpoint(request: Request, body: EvaluateRequest):
    """
    Evaluate a startup idea across 6 dimensions using RAG.

    - Retrieves relevant framework chunks from ChromaDB (filtered by dimension)
    - Runs 6 parallel LLM calls via Groq
    - Returns scores, justifications, and source citations
    """
    result = await evaluate_idea(body.idea)
    return result
