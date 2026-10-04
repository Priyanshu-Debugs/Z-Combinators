import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend root or app root
env_candidates = [
    Path(__file__).resolve().parent.parent.parent / ".env",
    Path(__file__).resolve().parent.parent / ".env",
    Path.cwd() / ".env",
]
for p in env_candidates:
    if p.exists():
        load_dotenv(dotenv_path=p)
        break


class Settings:
    # Gemini LLM & Embeddings
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_API_KEYS: list[str] = [
        k.strip() for k in os.getenv("GEMINI_API_KEYS", "").split(",") if k.strip()
    ]
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")
    EMBEDDING_MODEL: str = "gemini-embedding-2"

    # ChromaDB Vector Store
    CHROMA_PERSIST_DIR: str = os.getenv("CHROMA_PERSIST_DIR", "./chroma_data")
    RETRIEVAL_TOP_K: int = 3
    DISTANCE_THRESHOLD: float = 0.9
    DIMENSIONS: list[str] = [
        "market",
        "team",
        "timing",
        "competition",
        "moat",
        "execution",
    ]

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "").strip()

    # Rate Limiting & Security
    RATE_LIMIT: str = os.getenv("RATE_LIMIT", "15/minute")
    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
        if origin.strip()
    ]
    ADMIN_PASSCODE: str = os.getenv("ADMIN_PASSCODE", "Priyaanshu-Debugs")

    # Clerk Authentication
    CLERK_FRONTEND_API: str = os.getenv("CLERK_FRONTEND_API", "").strip()
    CLERK_SECRET_KEY: str = os.getenv("CLERK_SECRET_KEY", "").strip()

    @property
    def CLERK_JWKS_URL(self) -> str:
        """Derive the JWKS URL for verifying Clerk RS256 JWT tokens."""
        domain = self.CLERK_FRONTEND_API
        if not domain:
            return ""
        if not domain.startswith("http://") and not domain.startswith("https://"):
            domain = f"https://{domain}"
        return f"{domain.rstrip('/')}/.well-known/jwks.json"


settings = Settings()
