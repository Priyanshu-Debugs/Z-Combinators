import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.db.init_db import init_db
from app.api.v1.api import api_router

logger = logging.getLogger("uvicorn.error")
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run database table initialization and migrations on startup."""
    init_db()
    yield


app = FastAPI(
    title="Z-Combinators API",
    description="AI-powered startup idea evaluation and chat advisor using RAG and top VC frameworks.",
    version="2.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint for Render monitoring and cold-start detection."""
    return {"status": "ok", "version": "2.0.0"}


# Mount standard v1 router
app.include_router(api_router, prefix="/api/v1")

# Mount /api root as backward compatibility alias for existing frontend calls
app.include_router(api_router, prefix="/api")
