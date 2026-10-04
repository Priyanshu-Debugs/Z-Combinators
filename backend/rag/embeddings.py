import time
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from config import settings
from rag.key_manager import key_manager, is_rate_limit_error

_embeddings = None
_current_key_used = None


def get_embeddings_model(force_recreate: bool = False) -> GoogleGenerativeAIEmbeddings:
    """Get the GoogleGenerativeAIEmbeddings client as a singleton (recreated if key changes)."""
    global _embeddings, _current_key_used
    active_key = key_manager.get_current_key()
    
    if _embeddings is None or force_recreate or _current_key_used != active_key:
        _embeddings = GoogleGenerativeAIEmbeddings(
            model=f"models/{settings.EMBEDDING_MODEL}",
            google_api_key=active_key or None,
        )
        _current_key_used = active_key
    return _embeddings


def embed_text(text: str) -> list[float]:
    """Embed a single text string and return the vector as a list of floats using LangChain."""
    max_attempts = max(3, len(key_manager.keys))
    for attempt in range(max_attempts):
        try:
            model = get_embeddings_model()
            return model.embed_query(text)
        except Exception as e:
            if key_manager.has_multiple_keys():
                key_manager.rotate_key()
                get_embeddings_model(force_recreate=True)
                continue
            if attempt == max_attempts - 1:
                raise e
            time.sleep(1)


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed multiple text strings and return a list of vectors using LangChain with rate-limit batching."""
    if not texts:
        return []
        
    batch_size = 32
    results = []
    
    i = 0
    max_attempts = 8
    
    while i < len(texts):
        batch = texts[i : i + batch_size]
        success = False
        
        for attempt in range(max_attempts):
            try:
                model = get_embeddings_model()
                batch_results = model.embed_documents(batch)
                results.extend(batch_results)
                success = True
                break
            except Exception as e:
                is_rate_limit = is_rate_limit_error(e)
                if key_manager.has_multiple_keys():
                    key_manager.rotate_key()
                    get_embeddings_model(force_recreate=True)
                
                if attempt == max_attempts - 1:
                    print(f"Embedding failed after {max_attempts} attempts: {e}")
                    raise e
                
                wait_time = 15 if is_rate_limit else 4
                print(f"  [Attempt {attempt + 1}/{max_attempts}] Hit {type(e).__name__} (rate limit: {is_rate_limit}). Waiting {wait_time}s before retry...")
                time.sleep(wait_time)
                
        if not success:
            raise Exception("Failed to embed batch after multiple attempts.")
            
        i += batch_size
        if i < len(texts):
            time.sleep(4)
            
    return results
