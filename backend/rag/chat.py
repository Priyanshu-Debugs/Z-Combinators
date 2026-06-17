import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from config import settings
from rag.vector_store import retrieve_for_dimension
from models import DimensionResult

SYSTEM_CHAT_PROMPT = """You are an expert startup advisor applying frameworks from Y Combinator, Andreessen Horowitz (a16z), Sequoia Capital, First Round Review, and NFX.

Your task is to engage in a conversation with the user about their startup idea.
1. Review the user's latest input and the entire conversation history.
2. In your conversational 'reply', answer the user's questions, give constructive feedback on their strengths and weaknesses, and suggest what areas they need to flesh out.
3. Independently evaluate the 6 dimensions: Market, Team, Timing, Competition, Moat, and Execution.
4. CRITICAL: Only assign a score to a dimension if the user has provided enough concrete details in the conversation to evaluate it.
5. If the conversation does not contain enough info for a dimension, do NOT score it in the JSON "scores" dictionary.
6. The score must be an integer between 1 and 10. The justification must be 2-3 sentences and MUST be strictly grounded in the provided framework context for that dimension. Do not invent reasoning.
7. Do NOT use any emojis in your response.

Respond in this exact JSON format and nothing else:
{{
  "reply": "<Your conversational response to the user, answering questions and guiding them>",
  "scores": {{
    "market": {{
      "score": <integer 1-10>,
      "justification": "<justification sentences referencing framework rules>"
    }}
    // Include other dimensions ONLY if the user has provided enough information to evaluate them
  }}
}}"""

HUMAN_CHAT_TEMPLATE = """CONVERSATION HISTORY:
{chat_history}

USER'S LATEST MESSAGE:
{user_message}

AVAILABLE FRAMEWORK CONTEXT BY DIMENSION:
{framework_context}

Evaluate the user's message. Only score a dimension if new information was provided for it. Return JSON only."""

prompt = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_CHAT_PROMPT),
    ("human", HUMAN_CHAT_TEMPLATE)
])


def resolve_model_name(model_name: str) -> str:
    """Resolve configured model names, mapping gemini-3.5-flash-lite to gemini-3.1-flash-lite."""
    if model_name == "gemini-3.5-flash-lite":
        return "gemini-3.1-flash-lite"
    return model_name


def determine_confidence(distance: float) -> str:
    """Determine confidence level based on cosine distance from retrieval."""
    if distance < 0.5:
        return "high"
    elif distance < 0.8:
        return "medium"
    else:
        return "low"


async def evaluate_chat_turn(
    user_message: str,
    history: list[dict],
) -> tuple[str, list[DimensionResult]]:
    """
    Process a single chat turn using LangChain.
    
    1. Retrieves relevant framework chunks for the 6 dimensions.
    2. Constructs a conversational history prompt.
    3. Invokes ChatGoogleGenerativeAI with robust fallback support.
    4. Attaches deterministic RAG metadata (excerpt, framework name, confidence) to scored dimensions in Python.
    """
    # Step 1: Retrieve RAG context for all 6 dimensions
    context_blocks = []
    retrieved_chunks = {}
    
    for dim in ["market", "team", "timing", "competition", "moat", "execution"]:
        # Query ChromaDB using the user's latest message to find relevant guidelines
        chunks = retrieve_for_dimension(user_message, dim, top_k=2)
        retrieved_chunks[dim] = chunks
        if chunks:
            chunks_text = "\n\n".join(f"- {c['text']}" for c in chunks)
            context_blocks.append(f"[{dim.upper()} FRAMEWORK CONTEXT]:\n{chunks_text}")
            
    framework_context = "\n\n---\n\n".join(context_blocks) if context_blocks else "No framework context found."

    # Step 2: Format conversation history
    # Format messages prior to this turn
    history_lines = []
    for msg in history:
        history_lines.append(f"{msg['role'].upper()}: {msg['content']}")
    chat_history = "\n".join(history_lines) if history_lines else "No previous history."

    # Step 3: Call LLM with fallbacks
    primary_model = resolve_model_name(settings.GEMINI_MODEL)
    models_to_try = [primary_model]
    
    fallback_models = ["gemini-3.1-flash-lite", "gemini-2.5-flash"]
    for fallback in fallback_models:
        if fallback not in models_to_try:
            models_to_try.append(fallback)

    last_error = None
    reply = "I apologize, but I encountered an error. Please try again."
    evaluations = []

    for model_name in models_to_try:
        try:
            llm = ChatGoogleGenerativeAI(
                model=model_name,
                temperature=0.3,
                max_tokens=500,
                google_api_key=settings.GEMINI_API_KEY or None,
            )
            
            chain = prompt | llm | JsonOutputParser()
            
            result = await chain.ainvoke({
                "chat_history": chat_history,
                "user_message": user_message,
                "framework_context": framework_context
            })
            
            reply = result.get("reply", "")
            scores_dict = result.get("scores", {})
            
            # Step 4: Deterministically attach RAG metadata in Python
            for dim_key, score_data in scores_dict.items():
                dim_clean = dim_key.lower().strip()
                if dim_clean not in ["market", "team", "timing", "competition", "moat", "execution"]:
                    continue
                
                score = int(score_data.get("score", 5))
                justification = score_data.get("justification", "")
                
                # Fetch RAG source info from the top chunk retrieved
                chunks = retrieved_chunks.get(dim_clean, [])
                if chunks:
                    best_chunk = chunks[0]
                    confidence = determine_confidence(best_chunk["distance"])
                    source_excerpt = best_chunk["text"][:500]
                    source_org_display = {
                        "yc": "YC",
                        "a16z": "a16z",
                        "nfx": "NFX",
                        "sequoia": "Sequoia",
                        "firstround": "First Round Review",
                        "naval": "Naval Ravikant"
                    }.get(best_chunk["source_org"], best_chunk["source_org"].upper())
                    source_framework = f"{source_org_display} -- {best_chunk['source_title']}"
                else:
                    confidence = "low"
                    source_excerpt = "No matching context available."
                    source_framework = "N/A"
                
                evaluations.append(
                    DimensionResult(
                        dimension=dim_clean.title(),
                        score=score,
                        justification=justification,
                        source_excerpt=source_excerpt,
                        source_framework=source_framework,
                        confidence=confidence
                    )
                )
                
            return reply, evaluations

        except Exception as e:
            last_error = e
            continue

    # Return error reply if all models fail
    reply = f"Evaluation failed. Error: {str(last_error)}"
    return reply, evaluations
