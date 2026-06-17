from google import genai
from config import settings

_client = None


def get_gemini_client() -> genai.Client:
    """Get the Gemini client as a singleton."""
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.GEMINI_API_KEY or None)
    return _client


def embed_text(text: str) -> list[float]:
    """Embed a single text string and return the vector as a list of floats."""
    client = get_gemini_client()
    result = client.models.embed_content(
        model=settings.EMBEDDING_MODEL,
        contents=text,
    )
    return result.embeddings[0].values


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed multiple text strings and return a list of vectors."""
    if not texts:
        return []
    client = get_gemini_client()
    result = client.models.embed_content(
        model=settings.EMBEDDING_MODEL,
        contents=texts,
    )
    return [e.values for e in result.embeddings]
