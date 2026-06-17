"""
ChromaDB ingestion pipeline.

Takes chunked + tagged text records, generates embeddings using
sentence-transformers, and stores them in ChromaDB with dimension
metadata for filtered retrieval at query time.

This is an offline, run-once tool. Not imported by the runtime server.
"""

import os
import sys

# Add parent directory to path so we can import from the backend root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import chromadb
from rag.embeddings import embed_texts
from knowledge_base.chunker import ChunkRecord, chunk_all


def ingest_chunks(chunks: list[ChunkRecord], persist_dir: str):
    """
    Embed all chunks and store in ChromaDB.

    Uses cosine similarity for the HNSW index.
    Deletes existing collection to ensure clean state (idempotent).
    """
    print("Will generate embeddings using Gemini API (gemini-embedding-2)...")

    print(f"Initializing ChromaDB at: {persist_dir}")
    client = chromadb.PersistentClient(path=persist_dir)

    # Delete existing collection for clean state
    try:
        client.delete_collection("startup_frameworks")
        print("Deleted existing collection.")
    except Exception:
        pass

    collection = client.create_collection(
        name="startup_frameworks",
        metadata={"hnsw:space": "cosine"},
    )

    # Generate embeddings
    print(f"Embedding {len(chunks)} chunks using Gemini API...")
    texts = [c.text for c in chunks]
    embeddings = embed_texts(texts)

    # Build IDs, documents, embeddings, and metadatas
    ids = []
    documents = []
    metadatas = []

    for i, chunk in enumerate(chunks):
        chunk_id = f"{chunk.source_org}_{chunk.chunk_index}_{chunk.dimension}_{i}"
        ids.append(chunk_id)
        documents.append(chunk.text)
        metadatas.append(
            {
                "dimension": chunk.dimension,
                "source_org": chunk.source_org,
                "source_title": chunk.source_title,
            }
        )

    # ChromaDB has a batch limit, so add in batches of 100
    batch_size = 100
    for start in range(0, len(ids), batch_size):
        end = min(start + batch_size, len(ids))
        collection.add(
            ids=ids[start:end],
            documents=documents[start:end],
            embeddings=embeddings[start:end],
            metadatas=metadatas[start:end],
        )

    print(f"\nIngested {len(chunks)} chunks into ChromaDB")

    # Print per-dimension counts
    for dim in ["market", "team", "timing", "competition", "moat", "execution"]:
        count = sum(1 for c in chunks if c.dimension == dim)
        print(f"  {dim}: {count} chunks")

    # Verify
    final_count = collection.count()
    print(f"\nVerification: Collection contains {final_count} documents.")


def run_ingestion(sources_dir: str = None, persist_dir: str = None):
    """Run the full ingestion pipeline: chunk -> embed -> store."""
    if sources_dir is None:
        sources_dir = os.path.join(os.path.dirname(__file__), "sources")
    if persist_dir is None:
        persist_dir = os.path.join(os.path.dirname(__file__), "..", "chroma_data")

    print("=== STEP 1: Chunking text files ===")
    chunks = chunk_all(sources_dir)

    if not chunks:
        print("ERROR: No chunks generated. Check that source text files exist.")
        return

    print("\n=== STEP 2: Embedding and ingesting into ChromaDB ===")
    ingest_chunks(chunks, persist_dir)

    print("\n=== INGESTION COMPLETE ===")


if __name__ == "__main__":
    run_ingestion()
