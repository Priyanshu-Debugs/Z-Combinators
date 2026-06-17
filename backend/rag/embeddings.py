from langchain_google_genai import GoogleGenerativeAIEmbeddings
from config import settings

_embeddings = None


def get_embeddings_model() -> GoogleGenerativeAIEmbeddings:
    """Get the GoogleGenerativeAIEmbeddings client as a singleton."""
    global _embeddings
    if _embeddings is None:
        _embeddings = GoogleGenerativeAIEmbeddings(
            model=f"models/{settings.EMBEDDING_MODEL}",
            google_api_key=settings.GEMINI_API_KEY or None,
        )
    return _embeddings


def embed_text(text: str) -> list[float]:
    """Embed a single text string and return the vector as a list of floats using LangChain."""
    model = get_embeddings_model()
    return model.embed_query(text)


import time

def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed multiple text strings and return a list of vectors using LangChain with rate-limit batching."""
    if not texts:
        return []
    model = get_embeddings_model()
    
    # Gemini free-tier limits embeddings to 100 requests/minute.
    # We batch in sizes of 16 and sleep for 22 seconds between batches
    # (maximum rate of 48 documents per minute, well under the 100 limit).
    batch_size = 16
    results = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        batch_results = model.embed_documents(batch)
        results.extend(batch_results)
        if i + batch_size < len(texts):
            time.sleep(22)
    return results
