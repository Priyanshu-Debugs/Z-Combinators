"""
Text chunker with dimension tagging.

Reads raw text files from the sources/ directory, splits them into
semantically meaningful chunks (200-400 words), and tags each chunk
with the most relevant evaluation dimension using keyword heuristics.

This is an offline, run-once tool. Not imported by the runtime server.
"""

import os
import re
from dataclasses import dataclass, field


@dataclass
class ChunkRecord:
    text: str
    dimension: str
    source_org: str
    source_title: str
    chunk_index: int


# Dimension keyword mappings for heuristic tagging
DIMENSION_KEYWORDS: dict[str, list[str]] = {
    "market": [
        "market size", "tam", "sam", "som", "addressable market",
        "market opportunity", "demand", "growth rate", "market growth",
        "billion dollar", "trillion", "revenue potential", "customer base",
        "target market", "market cap", "industry size", "total market",
    ],
    "team": [
        "founder", "co-founder", "founding team", "team",
        "domain expertise", "founder-market fit", "hiring", "leadership",
        "ceo", "cto", "technical co-founder", "solo founder",
        "complementary skills", "experience", "background",
    ],
    "timing": [
        "timing", "why now", "macro trend", "tailwind", "headwind",
        "technology shift", "readiness", "inflection point",
        "regulatory change", "pandemic", "post-covid", "emerging",
        "cultural shift", "adoption curve",
    ],
    "competition": [
        "competitor", "competitive", "incumbent", "differentiation",
        "alternative", "switching cost", "competitive advantage",
        "market leader", "disrupt", "displacement", "substitute",
        "barrier to entry", "competitive landscape",
    ],
    "moat": [
        "moat", "defensibility", "network effect", "switching cost",
        "brand", "data advantage", "lock-in", "economies of scale",
        "proprietary", "patent", "two-sided", "marketplace dynamics",
        "flywheel", "compounding", "winner-take-all",
    ],
    "execution": [
        "mvp", "execution", "ship", "build", "iterate", "launch",
        "product-market fit", "traction", "go-to-market", "gtm",
        "prototype", "user acquisition", "growth", "metrics",
        "unit economics", "burn rate", "runway", "pivot",
    ],
}


def tag_dimension(text: str) -> str:
    """
    Tag a chunk with its most relevant dimension using keyword heuristics.

    Returns the dimension with the highest keyword match count.
    Falls back to 'execution' if no keywords match (most general dimension).
    """
    text_lower = text.lower()
    scores: dict[str, int] = {}

    for dimension, keywords in DIMENSION_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text_lower)
        scores[dimension] = score

    max_score = max(scores.values())
    if max_score == 0:
        return "execution"  # Default fallback for untaggable chunks

    # Return the dimension with the highest score
    return max(scores, key=lambda d: scores[d])


def split_into_chunks(
    text: str,
    min_words: int = 150,
    max_words: int = 400,
) -> list[str]:
    """
    Split text into chunks of 200-400 words at paragraph boundaries.

    Strategy:
    1. Split by double newlines (paragraph boundaries).
    2. Merge short paragraphs together.
    3. Split overly long paragraphs at sentence boundaries.
    """
    # Split into paragraphs
    paragraphs = re.split(r"\n\s*\n", text)
    paragraphs = [p.strip() for p in paragraphs if p.strip()]

    chunks: list[str] = []
    current_chunk: list[str] = []
    current_word_count = 0

    for para in paragraphs:
        para_words = len(para.split())

        # If this single paragraph is too long, split at sentences
        if para_words > max_words:
            # Flush current chunk first
            if current_chunk:
                chunks.append("\n\n".join(current_chunk))
                current_chunk = []
                current_word_count = 0

            # Split long paragraph into sentences
            sentences = re.split(r"(?<=[.!?])\s+", para)
            sent_chunk: list[str] = []
            sent_word_count = 0

            for sent in sentences:
                sent_words = len(sent.split())
                if sent_word_count + sent_words > max_words and sent_chunk:
                    chunks.append(" ".join(sent_chunk))
                    sent_chunk = []
                    sent_word_count = 0
                sent_chunk.append(sent)
                sent_word_count += sent_words

            if sent_chunk:
                # If remaining sentences are too short, keep as is
                chunks.append(" ".join(sent_chunk))
            continue

        # Check if adding this paragraph would exceed max
        if current_word_count + para_words > max_words and current_chunk:
            chunks.append("\n\n".join(current_chunk))
            current_chunk = []
            current_word_count = 0

        current_chunk.append(para)
        current_word_count += para_words

    # Flush remaining
    if current_chunk:
        chunks.append("\n\n".join(current_chunk))

    # Merge any chunks that are too small
    merged: list[str] = []
    for chunk in chunks:
        if merged and len(merged[-1].split()) + len(chunk.split()) <= max_words:
            if len(merged[-1].split()) < min_words:
                merged[-1] = merged[-1] + "\n\n" + chunk
                continue
        merged.append(chunk)

    return merged


def chunk_file(
    filepath: str,
    source_org: str,
    source_title: str,
) -> list[ChunkRecord]:
    """Chunk a single text file and tag each chunk with a dimension."""
    with open(filepath, "r", encoding="utf-8") as f:
        text = f.read()

    raw_chunks = split_into_chunks(text)
    records: list[ChunkRecord] = []

    for i, chunk_text in enumerate(raw_chunks):
        dimension = tag_dimension(chunk_text)
        records.append(
            ChunkRecord(
                text=chunk_text,
                dimension=dimension,
                source_org=source_org,
                source_title=source_title,
                chunk_index=i,
            )
        )

    return records


def chunk_all(sources_dir: str) -> list[ChunkRecord]:
    """
    Chunk all text files in the sources directory.

    Expects filenames in the format: {source_org}_{slug}.txt
    """
    all_records: list[ChunkRecord] = []

    for filename in sorted(os.listdir(sources_dir)):
        if not filename.endswith(".txt"):
            continue

        filepath = os.path.join(sources_dir, filename)

        # Parse org from filename (e.g., "yc_how_to_build_mvp.txt" -> "yc")
        parts = filename.split("_", 1)
        source_org = parts[0] if parts else "unknown"
        source_title = (
            parts[1].replace("_", " ").replace(".txt", "").title()
            if len(parts) > 1
            else filename
        )

        records = chunk_file(filepath, source_org, source_title)
        all_records.extend(records)
        print(f"  Chunked: {filename} -> {len(records)} chunks")

    print(f"\nTotal chunks: {len(all_records)}")

    # Print per-dimension distribution
    dim_counts: dict[str, int] = {}
    for r in all_records:
        dim_counts[r.dimension] = dim_counts.get(r.dimension, 0) + 1
    for dim, count in sorted(dim_counts.items()):
        print(f"  {dim}: {count} chunks")

    return all_records


if __name__ == "__main__":
    records = chunk_all(
        os.path.join(os.path.dirname(__file__), "sources")
    )
