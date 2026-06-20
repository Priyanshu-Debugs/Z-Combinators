import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env relative to the config.py directory
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)


class Settings:
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_API_KEYS: list[str] = [
        k.strip() for k in os.getenv("GEMINI_API_KEYS", "").split(",") if k.strip()
    ]
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")
    CHROMA_PERSIST_DIR: str = os.getenv("CHROMA_PERSIST_DIR", "./chroma_data")
    RATE_LIMIT: str = os.getenv("RATE_LIMIT", "10/minute")
    CORS_ORIGINS: list[str] = os.getenv(
        "CORS_ORIGINS", "http://localhost:3000"
    ).split(",")
    ADMIN_PASSCODE: str = os.getenv("ADMIN_PASSCODE", "Priyaanshu-Debugs")
    EMBEDDING_MODEL: str = "gemini-embedding-2"
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


settings = Settings()
