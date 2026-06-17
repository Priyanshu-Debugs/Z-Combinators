import chromadb
from config import settings
from rag.embeddings import embed_text

_client = None
_collection = None


def get_collection():
    """Get the ChromaDB collection, initializing the client if needed."""
    global _client, _collection
    if _collection is None:
        _client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)
        _collection = _client.get_collection("startup_frameworks")
    return _collection


def retrieve_for_dimension(
    idea: str,
    dimension: str,
    top_k: int = None,
) -> list[dict]:
    """
    Retrieve the top-k most relevant chunks for a specific dimension.

    Uses the dimension metadata filter to ensure each dimension's retrieval
    only pulls chunks tagged for that dimension (prevents cross-contamination).

    Returns a list of dicts with keys:
      - text: str (the chunk content)
      - source_org: str
      - source_title: str
      - distance: float (cosine distance, lower = more relevant)
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
            chunks.append(
                {
                    "text": results["documents"][0][i],
                    "source_org": results["metadatas"][0][i]["source_org"],
                    "source_title": results["metadatas"][0][i]["source_title"],
                    "distance": results["distances"][0][i],
                }
            )

    return chunks
