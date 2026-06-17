import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")
    CHROMA_PERSIST_DIR: str = os.getenv("CHROMA_PERSIST_DIR", "./chroma_data")
    RATE_LIMIT: str = os.getenv("RATE_LIMIT", "10/minute")
    CORS_ORIGINS: list[str] = os.getenv(
        "CORS_ORIGINS", "http://localhost:3000"
    ).split(",")
    EMBEDDING_MODEL: str = "gemini-embedding-2"
    RETRIEVAL_TOP_K: int = 3
    DIMENSIONS: list[str] = [
        "market",
        "team",
        "timing",
        "competition",
        "moat",
        "execution",
    ]


settings = Settings()
