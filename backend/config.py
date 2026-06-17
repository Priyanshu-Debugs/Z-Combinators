import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    CHROMA_PERSIST_DIR: str = os.getenv("CHROMA_PERSIST_DIR", "./chroma_data")
    RATE_LIMIT: str = os.getenv("RATE_LIMIT", "10/minute")
    CORS_ORIGINS: list[str] = os.getenv(
        "CORS_ORIGINS", "http://localhost:3000"
    ).split(",")
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
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
