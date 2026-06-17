from sentence_transformers import SentenceTransformer
from config import settings

_model = None


def get_embedding_model() -> SentenceTransformer:
    """Load the embedding model as a singleton (heavy operation, load once)."""
    global _model
    if _model is None:
        _model = SentenceTransformer(settings.EMBEDDING_MODEL)
    return _model


def embed_text(text: str) -> list[float]:
    """Embed a single text string and return the vector as a list of floats."""
    model = get_embedding_model()
    return model.encode(text).tolist()


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed multiple text strings and return a list of vectors."""
    model = get_embedding_model()
    return model.encode(texts, show_progress_bar=True).tolist()
