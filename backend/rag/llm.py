import json
import asyncio
from groq import Groq
from config import settings

_client = None

SYSTEM_PROMPT = """You are an expert startup evaluator. You evaluate startup ideas by applying established frameworks from Y Combinator, Andreessen Horowitz (a16z), and NFX.

Rules:
- You MUST base your evaluation ONLY on the provided framework context below.
- You MUST NOT invent reasoning that is not grounded in the provided context.
- If the provided context does not adequately address this dimension for the given idea, explicitly state "Context insufficient" and assign a score of 5 (median).
- Your justification MUST reference specific points from the provided framework context.
- Be direct and specific. Name concrete strengths or weaknesses.
- Do NOT hedge to safe middle scores (6-7) unless genuinely warranted by the context.
- Scores of 1-3 and 8-10 are valid and expected for clearly weak or strong dimensions.
- Do NOT use any emojis in your response.

Respond in this exact JSON format and nothing else:
{
  "score": <integer 1-10>,
  "justification": "<2-4 sentences explaining the score, referencing the framework context>"
}"""


def get_groq_client() -> Groq:
    """Get the Groq client as a singleton."""
    global _client
    if _client is None:
        _client = Groq(api_key=settings.GROQ_API_KEY)
    return _client


def build_user_prompt(
    idea: str, dimension: str, context_chunks: list[dict]
) -> str:
    """Build the user prompt with the idea, dimension, and retrieved context."""
    context_text = "\n\n---\n\n".join(
        f"[Source: {c['source_title']} ({c['source_org'].upper()})]\n{c['text']}"
        for c in context_chunks
    )

    return f"""DIMENSION TO EVALUATE: {dimension.upper()}

STARTUP IDEA:
{idea}

FRAMEWORK CONTEXT (use ONLY this to justify your score):
{context_text}

Evaluate the startup idea on the {dimension.upper()} dimension. Return JSON only."""


async def evaluate_dimension(
    idea: str,
    dimension: str,
    context_chunks: list[dict],
) -> dict:
    """
    Call Groq LLM to evaluate one dimension.

    Runs the synchronous Groq SDK call in a thread executor to allow
    concurrent execution of all 6 dimension evaluations.

    Returns: { "score": int, "justification": str }
    """
    client = get_groq_client()
    user_prompt = build_user_prompt(idea, dimension, context_chunks)

    def _call_llm():
        try:
            response = client.chat.completions.create(
                model=settings.GROQ_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.3,
                max_tokens=300,
                response_format={"type": "json_object"},
            )

            content = response.choices[0].message.content
            result = json.loads(content)

            score = int(result.get("score", 5))
            score = max(1, min(10, score))
            justification = result.get(
                "justification", "Evaluation could not be completed."
            )

            return {"score": score, "justification": justification}

        except Exception as e:
            return {
                "score": 5,
                "justification": (
                    f"Evaluation could not be completed for this dimension. "
                    f"Error: {str(e)}"
                ),
            }

    # Run synchronous Groq call in thread executor for async compatibility
    return await asyncio.get_event_loop().run_in_executor(None, _call_llm)
