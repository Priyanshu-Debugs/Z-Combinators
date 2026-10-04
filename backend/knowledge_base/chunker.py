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
        "market opportunity", "market growth", "billion dollar",
        "trillion", "revenue potential", "customer base", "target market",
        "market cap", "industry size", "total market", "demand", "niche market",
        "bottom-up analysis", "beachhead market", "ideal customer",
        "market pull", "annual contract value", "acv",
        "serviceable", "obtainable", "willingness to pay",
        "icp", "ideal customer profile", "market segment",
        "total addressable", "buyer persona", "end user",
    ],
    "team": [
        "founder", "co-founder", "founding team", "team",
        "domain expertise", "founder-market fit", "hiring", "leadership",
        "ceo", "cto", "technical co-founder", "solo founder",
        "complementary skills", "resourceful", "relentlessly resourceful",
        "hiring engineers", "early employees",
        "culture", "cofounder dynamics", "management team",
        "vp engineering", "first ten hires", "equity split",
        "cofounder agreement", "founder dynamics", "technical talent",
        "engineering culture", "people", "recruit", "talent",
        "employee", "cofounder", "cofounders", "human capital",
    ],
    "timing": [
        "timing", "why now", "macro trend", "tailwind", "headwind",
        "technology shift", "platform shift", "readiness", "inflection point",
        "regulatory change", "wave", "catalyst", "right time", "wrong time",
        "too early", "too late", "adoption curve", "turning point",
        "market readiness", "enabling technology", "secular shift",
        "market timing", "technology readiness", "consumer behavior shift",
        "infrastructure maturity", "end of cycle", "macro environment",
        "window of opportunity", "paradigm shift", "first mover",
        "technology frontier", "right moment", "historical",
        "the time is right", "when to start", "decade",
        "trend", "trends", "premature", "premature scaling",
        "new era", "new wave", "ahead of its time", "ahead of the curve",
        "market cycle", "economic cycle", "technology cycle", "technological change",
        "early adopter", "early adopters", "inflection", "timing matters",
        "ripe for", "ripe for disruption", "downturn", "recession",
        "secular trend", "wave of innovation", "market conditions",
    ],
    "competition": [
        "competitor", "competitive", "incumbent", "differentiation",
        "alternative", "competitive advantage", "market leader", "disrupt",
        "displacement", "substitute", "barrier to entry", "competitive landscape",
        "monopoly", "perfect competition",
        "market position", "market share", "unfair advantage",
        "category creation", "blue ocean", "red ocean",
        "first mover advantage", "incumbent advantage",
        "compete", "competing", "rival", "rivalry",
        "zero sum", "big company", "big companies",
        "crowded market", "fragmented market", "direct competitor",
    ],
    "moat": [
        "moat", "defensibility", "network effect", "switching cost",
        "brand advantage", "data advantage", "lock-in", "economies of scale",
        "proprietary", "two-sided", "marketplace dynamics", "flywheel",
        "winner-take-all", "retention curve", "pricing power", "take rate",
        "cold start", "viral loop", "user-generated content",
        "data moat", "supply-side lock-in", "demand-side lock-in",
        "marketplace liquidity", "critical mass",
        "defensible", "network effects", "switching costs",
        "sustainable advantage", "durable advantage", "platform effect",
        "barriers to entry", "durable moat", "competitive moat",
        "gross margin", "gross margins", "high margin",
        "two-sided marketplace", "winner take all", "hard to replicate",
        "unreplicable", "copycat", "copycats", "sustainable competitive advantage",
    ],
    "execution": [
        "mvp", "execution", "ship", "iterate", "launch",
        "product-market fit", "pmf", "traction", "go-to-market", "gtm",
        "user acquisition", "unit economics", "burn rate", "runway", "pivot",
        "default alive", "default dead", "do things that dont scale",
        "retention", "cohort analysis", "dau mau",
        "monthly active users", "growth rate", "churn rate",
        "payback period", "ltv cac", "growth accounting",
        "north star metric", "activation rate", "retention curve",
        "product market fit", "customer acquisition cost",
        "customer lifetime value", "conversion rate", "funnel",
        "scale", "scaling", "metrics", "revenue", "growth",
    ],
}


def tag_dimensions(text: str) -> list[str]:
    """
    Tag a chunk with its relevant dimensions using keyword heuristics.
    Multi-word phrases receive higher weighting (3 points) than single words (1 point).
    Returns the primary dimension and an optional secondary dimension.
    """
    text_lower = text.lower()
    scores: dict[str, int] = {}

    for dimension, keywords in DIMENSION_KEYWORDS.items():
        score = 0
        for kw in keywords:
            if kw in text_lower:
                weight = 3 if " " in kw else 1
                score += weight
        scores[dimension] = score

    sorted_dims = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    if sorted_dims[0][1] == 0:
        return ["execution"]

    top_dim, top_score = sorted_dims[0]
    results = [top_dim]

    # If a secondary dimension also has strong resonance (>= 2 matches & >= 60% of top score)
    second_dim, second_score = sorted_dims[1]
    if second_score >= 2 and second_score >= (top_score * 0.6):
        results.append(second_dim)

    return results


def tag_dimension(text: str) -> str:
    """Fallback single-dimension tagger for backwards compatibility."""
    return tag_dimensions(text)[0]


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
        dims = tag_dimensions(chunk_text)
        for dim in dims:
            records.append(
                ChunkRecord(
                    text=chunk_text,
                    dimension=dim,
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
