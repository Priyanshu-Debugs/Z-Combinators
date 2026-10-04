import asyncio
from app.schemas.evaluation import EvaluateResponse, DimensionResult
from app.services.vector_store import retrieve_for_dimension
from app.services.llm import evaluate_dimension
from app.core.config import settings


def determine_confidence(distance: float) -> str:
    """Determine confidence level based on cosine distance from retrieval."""
    if distance < 0.5:
        return "high"
    elif distance < 0.8:
        return "medium"
    else:
        return "low"


async def evaluate_idea(idea: str) -> EvaluateResponse:
    """Run the full 6-dimension RAG evaluation pipeline in parallel."""

    async def evaluate_single_dimension(dimension: str) -> DimensionResult:
        chunks = retrieve_for_dimension(
            idea, dimension, top_k=settings.RETRIEVAL_TOP_K
        )

        if not chunks:
            return DimensionResult(
                dimension=dimension.title(),
                score=5,
                justification=(
                    "Context insufficient. No relevant framework content was found for this dimension."
                ),
                source_excerpt="No matching context available.",
                source_framework="N/A",
                confidence="low",
            )

        llm_result = await evaluate_dimension(idea, dimension, chunks)
        best_chunk = chunks[0]
        confidence = determine_confidence(best_chunk["distance"])

        source_org_display = {
            "yc": "YC",
            "a16z": "a16z",
            "nfx": "NFX",
            "sequoia": "Sequoia",
            "firstround": "First Round Review",
            "naval": "Naval Ravikant",
        }.get(best_chunk["source_org"], best_chunk["source_org"].upper())

        return DimensionResult(
            dimension=dimension.title(),
            score=llm_result["score"],
            justification=llm_result["justification"],
            source_excerpt=best_chunk["text"][:500],
            source_framework=f"{source_org_display} -- {best_chunk['source_title']}",
            confidence=confidence,
        )

    dimension_results = await asyncio.gather(
        *[evaluate_single_dimension(dim) for dim in settings.DIMENSIONS]
    )

    overall_score = round(
        sum(d.score for d in dimension_results) / len(dimension_results), 1
    )

    return EvaluateResponse(
        overall_score=overall_score,
        dimensions=list(dimension_results),
    )
