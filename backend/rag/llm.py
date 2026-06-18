import json
import asyncio
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field
from config import settings
from rag.key_manager import key_manager, is_rate_limit_error

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
{{
  "score": <integer 1-10>,
  "justification": "<2-4 sentences explaining the score, referencing the framework context>"
}}"""

HUMAN_PROMPT_TEMPLATE = """DIMENSION TO EVALUATE: {dimension}

STARTUP IDEA:
{idea}

FRAMEWORK CONTEXT (use ONLY this to justify your score):
{context_text}

Evaluate the startup idea on the {dimension} dimension. Return JSON only."""

# Define LangChain ChatPromptTemplate
prompt = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),
    ("human", HUMAN_PROMPT_TEMPLATE)
])


class DimensionEvaluation(BaseModel):
    score: int = Field(..., ge=1, le=10, description="Evaluation score, integer between 1 and 10.")
    justification: str = Field(..., description="2-4 sentences explaining the score, strictly grounded in the provided framework context.")


def resolve_model_name(model_name: str) -> str:
    """Resolve configured model names, mapping gemini-3.5-flash-lite to gemini-3.1-flash-lite."""
    if model_name == "gemini-3.5-flash-lite":
        return "gemini-3.1-flash-lite"
    return model_name


async def evaluate_dimension(
    idea: str,
    dimension: str,
    context_chunks: list[dict],
) -> dict:
    """
    Call Gemini LLM via LangChain to evaluate one dimension.

    Includes automatic model resolution and fallback mechanisms for robust execution.
    """
    context_text = "\n\n---\n\n".join(
        f"[Source: {c['source_title']} ({c['source_org'].upper()})]\n{c['text']}"
        for c in context_chunks
    )

    # Primary and fallback models list
    primary_model = resolve_model_name(settings.GEMINI_MODEL)
    models_to_try = [primary_model]

    # Guarantees availability by trying secondary/tertiary models if primary fails
    fallback_models = ["gemini-3.1-flash-lite", "gemini-2.5-flash"]
    for fallback in fallback_models:
        if fallback not in models_to_try:
            models_to_try.append(fallback)

    last_error = None
    max_attempts = max(3, len(key_manager.keys))
    
    for attempt in range(max_attempts):
        active_key = key_manager.get_current_key()
        rotated = False
        for model_name in models_to_try:
            try:
                llm = ChatGoogleGenerativeAI(
                    model=model_name,
                    temperature=0.3,
                    max_tokens=300,
                    api_key=active_key or None,
                )
    
                # LangChain chain with structured output
                structured_llm = llm.with_structured_output(DimensionEvaluation)
                chain = prompt | structured_llm
    
                # Async invoke using LangChain standard ainvoke
                result = await chain.ainvoke({
                    "dimension": dimension.upper(),
                    "idea": idea,
                    "context_text": context_text,
                })
    
                score = int(result.score)
                score = max(1, min(10, score))
                justification = result.justification
    
                return {"score": score, "justification": justification}
    
            except Exception as e:
                last_error = e
                if is_rate_limit_error(e) and key_manager.has_multiple_keys():
                    key_manager.rotate_key()
                    rotated = True
                    break
        
        # If we didn't rotate the key, it means we either succeeded or failed for non-rate-limit reasons,
        # so we break out of the attempts loop.
        if not rotated:
            break

    # If all model execution attempts fail, return a structured error result
    return {
        "score": 5,
        "justification": (
            f"Evaluation could not be completed for this dimension. "
            f"Error: {str(last_error)}"
        ),
    }
