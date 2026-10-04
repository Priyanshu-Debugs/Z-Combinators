import os
import chromadb
from app.core.config import settings
from app.services.embeddings import embed_text

_client = None
_collection = None


def get_collection():
    """Get the ChromaDB collection, initializing the client if needed."""
    global _client, _collection
    if _collection is None:
        persist_dir = settings.CHROMA_PERSIST_DIR
        # Fallback to local ./chroma_data if not found
        if not os.path.exists(persist_dir):
            alt_dir = os.path.join(os.path.dirname(__file__), "..", "..", "chroma_data")
            if os.path.exists(alt_dir):
                persist_dir = alt_dir

        _client = chromadb.PersistentClient(path=persist_dir)
        _collection = _client.get_collection("startup_frameworks")
    return _collection


def retrieve_for_dimension(
    idea: str,
    dimension: str,
    top_k: int = None,
) -> list[dict]:
    """
    Retrieve top-k chunks for a single dimension.
    """
    if top_k is None:
        top_k = settings.RETRIEVAL_TOP_K

    collection = get_collection()
    query_embedding = embed_text(idea)

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        where={"dimension": dimension},
        include=["documents", "metadatas", "distances"],
    )

    chunks = []
    if results["documents"] and results["documents"][0]:
        for i in range(len(results["documents"][0])):
            distance = results["distances"][0][i]
            if distance < settings.DISTANCE_THRESHOLD:
                chunks.append(
                    {
                        "text": results["documents"][0][i],
                        "source_org": results["metadatas"][0][i]["source_org"],
                        "source_title": results["metadatas"][0][i]["source_title"],
                        "distance": distance,
                    }
                )

    return chunks


def retrieve_all_dimensions(
    query_text: str,
    top_k: int = 2,
) -> dict[str, list[dict]]:
    """
    SINGLE-PASS RETRIEVAL OPTIMIZATION:
    1. Embeds query_text ONCE into a 768-dim vector via Gemini API.
    2. Queries ChromaDB for each dimension using the precomputed vector.
    Eliminates 5 redundant Gemini API round-trips per chat turn, cutting 2-4s of latency!
    """
    collection = get_collection()
    query_vector = embed_text(query_text)  # Single API call!

    results_by_dim: dict[str, list[dict]] = {}

    for dim in settings.DIMENSIONS:
        try:
            res = collection.query(
                query_embeddings=[query_vector],
                n_results=top_k,
                where={"dimension": dim},
                include=["documents", "metadatas", "distances"],
            )

            chunks = []
            if res["documents"] and res["documents"][0]:
                for i in range(len(res["documents"][0])):
                    dist = res["distances"][0][i]
                    if dist < settings.DISTANCE_THRESHOLD:
                        chunks.append(
                            {
                                "text": res["documents"][0][i],
                                "source_org": res["metadatas"][0][i]["source_org"],
                                "source_title": res["metadatas"][0][i]["source_title"],
                                "distance": dist,
                            }
                        )
            results_by_dim[dim] = chunks
        except Exception:
            results_by_dim[dim] = []

    return results_by_dim
