import json
from typing import Dict, Optional, AsyncGenerator
from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from config import settings
from rag.vector_store import retrieve_for_dimension
from models import DimensionResult

SYSTEM_CHAT_PROMPT = """You are an expert startup advisor applying frameworks from Y Combinator, Andreessen Horowitz (a16z), Sequoia Capital, First Round Review, and NFX.

Your task is to engage in a conversation with the user about their startup idea.
1. Review the user's latest input and the entire conversation history.
2. In your conversational 'reply', answer the user's questions, give constructive feedback on their strengths and weaknesses, and suggest what areas they need to flesh out.
3. Independently evaluate all 6 dimensions on every turn: Market, Team, Timing, Competition, Moat, and Execution.
4. You MUST assign a score (integer 1-10) and a justification (2-3 sentences) for each of the 6 dimensions.
5. CRITICAL: If the conversation does not contain enough details to evaluate a specific dimension yet, assign a neutral score of 5 and write a justification explaining what details are missing (e.g., "Context insufficient. Please share the experience and domain expertise of your founding team.").
6. For dimensions where details are present, the justification must be strictly grounded in the provided framework context. Do not invent reasoning.
7. Do NOT use any emojis in your response.

Respond in this exact JSON format and nothing else:
{{
  "reply": "<Your conversational response to the user, answering questions and guiding them>",
  "market": {{
    "score": <integer 1-10>,
    "justification": "<justification sentences>"
  }},
  "team": {{
    "score": <integer 1-10>,
    "justification": "<justification sentences>"
  }},
  "timing": {{
    "score": <integer 1-10>,
    "justification": "<justification sentences>"
  }},
  "competition": {{
    "score": <integer 1-10>,
    "justification": "<justification sentences>"
  }},
  "moat": {{
    "score": <integer 1-10>,
    "justification": "<justification sentences>"
  }},
  "execution": {{
    "score": <integer 1-10>,
    "justification": "<justification sentences>"
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


class ChatDimensionScore(BaseModel):
    score: int = Field(..., ge=1, le=10, description="The evaluation score (1-10) for this dimension.")
    justification: str = Field(..., description="2-3 sentences explaining the score based strictly on context.")


class ChatAdvisorResponse(BaseModel):
    reply: str = Field(..., description="Conversational reply to the user, answering questions and giving advice.")
    market: ChatDimensionScore = Field(..., description="Evaluation of the Market dimension. Assign 5 if context is insufficient.")
    team: ChatDimensionScore = Field(..., description="Evaluation of the Team dimension. Assign 5 if context is insufficient.")
    timing: ChatDimensionScore = Field(..., description="Evaluation of the Timing dimension. Assign 5 if context is insufficient.")
    competition: ChatDimensionScore = Field(..., description="Evaluation of the Competition dimension. Assign 5 if context is insufficient.")
    moat: ChatDimensionScore = Field(..., description="Evaluation of the Moat dimension. Assign 5 if context is insufficient.")
    execution: ChatDimensionScore = Field(..., description="Evaluation of the Execution dimension. Assign 5 if context is insufficient.")


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


CONDENSE_QUESTION_PROMPT = """Given the following conversation history and a follow-up user message, rephrase the user message into a standalone, keyword-rich search query (optimized for vector database semantic search). The query must capture the core startup concept and context from the conversation history, combined with the topic of the follow-up message.

Guidelines:
- Keep it to a single line of search keywords (do not ask a question or write a sentence).
- Do NOT output anything else except the search keywords.
- If the follow-up message is a generic conversational confirmation (e.g. "yes", "exactly", "no", "that is right"), generate keywords that describe the dimension topic being discussed in the last question.

CONVERSATION HISTORY:
{chat_history}

FOLLOW-UP MESSAGE:
{user_message}

STANDALONE SEARCH QUERY:"""


async def condense_query(user_message: str, history: list[dict]) -> str:
    """Condense chat history and latest message into a search-optimized query."""
    if not history:
        return user_message
        
    history_lines = []
    for msg in history[-4:]:
        history_lines.append(f"{msg['role'].upper()}: {msg['content']}")
    chat_history = "\n".join(history_lines)
    
    prompt_text = CONDENSE_QUESTION_PROMPT.format(
        chat_history=chat_history,
        user_message=user_message
    )
    
    primary_model = resolve_model_name(settings.GEMINI_MODEL)
    try:
        llm = ChatGoogleGenerativeAI(
            model=primary_model,
            temperature=0.0,
            max_tokens=60,
            api_key=settings.GEMINI_API_KEY or None,
        )
        response = await llm.ainvoke(prompt_text)
        condensed = response.content.strip()
        condensed = condensed.replace("`", "").replace('"', "").replace("'", "")
        return condensed if condensed else user_message
    except Exception as e:
        print(f"Error during query condensation: {e}")
        return user_message


async def evaluate_chat_turn(
    user_message: str,
    history: list[dict],
) -> tuple[str, list[DimensionResult]]:
    """
    Process a single chat turn using LangChain.
    
    1. Condense query for RAG retrieval.
    2. Retrieves relevant framework chunks for the 6 dimensions.
    3. Constructs a conversational history prompt.
    4. Invokes ChatGoogleGenerativeAI with robust fallback support.
    5. Attaches deterministic RAG metadata (excerpt, framework name, confidence) to scored dimensions in Python.
    """
    # Step 1: Condense query for better RAG retrieval
    search_query = await condense_query(user_message, history)
    
    # Step 2: Retrieve RAG context for all 6 dimensions
    context_blocks = []
    retrieved_chunks = {}
    
    for dim in ["market", "team", "timing", "competition", "moat", "execution"]:
        # Query ChromaDB using the condensed search query
        chunks = retrieve_for_dimension(search_query, dim, top_k=2)
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
                api_key=settings.GEMINI_API_KEY or None,
            )
            
            # LangChain chain with structured output
            structured_llm = llm.with_structured_output(ChatAdvisorResponse)
            chain = prompt | structured_llm
            
            result = await chain.ainvoke({
                "chat_history": chat_history,
                "user_message": user_message,
                "framework_context": framework_context
            })
            
            reply = result.reply
            scores_dict = {
                "market": result.market,
                "team": result.team,
                "timing": result.timing,
                "competition": result.competition,
                "moat": result.moat,
                "execution": result.execution,
            }
            
            # Step 4: Deterministically attach RAG metadata in Python
            for dim_key, score_data in scores_dict.items():
                dim_clean = dim_key.lower().strip()
                if dim_clean not in ["market", "team", "timing", "competition", "moat", "execution"]:
                    continue
                
                score = int(score_data.score)
                justification = score_data.justification
                
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


async def evaluate_chat_turn_stream(
    user_message: str,
    history: list[dict],
) -> AsyncGenerator[dict, None]:
    """
    Stream a single chat turn using LangChain.
    Yields events:
      - {"type": "token", "content": "..."}
      - {"type": "evaluations", "evaluations": list[DimensionResult]}
    """
    # Step 1: Condense query for RAG retrieval
    search_query = await condense_query(user_message, history)
    
    # Step 2: Retrieve RAG context
    context_blocks = []
    retrieved_chunks = {}
    
    for dim in ["market", "team", "timing", "competition", "moat", "execution"]:
        chunks = retrieve_for_dimension(search_query, dim, top_k=2)
        retrieved_chunks[dim] = chunks
        if chunks:
            chunks_text = "\n\n".join(f"- {c['text']}" for c in chunks)
            context_blocks.append(f"[{dim.upper()} FRAMEWORK CONTEXT]:\n{chunks_text}")
            
    framework_context = "\n\n---\n\n".join(context_blocks) if context_blocks else "No framework context found."

    # Format history
    history_lines = []
    for msg in history:
        history_lines.append(f"{msg['role'].upper()}: {msg['content']}")
    chat_history = "\n".join(history_lines) if history_lines else "No previous history."

    primary_model = resolve_model_name(settings.GEMINI_MODEL)
    models_to_try = [primary_model]
    
    fallback_models = ["gemini-3.1-flash-lite", "gemini-2.5-flash"]
    for fallback in fallback_models:
        if fallback not in models_to_try:
            models_to_try.append(fallback)

    last_error = None
    success = False
    
    for model_name in models_to_try:
        try:
            llm = ChatGoogleGenerativeAI(
                model=model_name,
                temperature=0.3,
                max_tokens=500,
                api_key=settings.GEMINI_API_KEY or None,
            )
            
            structured_llm = llm.with_structured_output(ChatAdvisorResponse)
            chain = prompt | structured_llm
            
            last_reply = ""
            final_result = None
            
            async for chunk in chain.astream({
                "chat_history": chat_history,
                "user_message": user_message,
                "framework_context": framework_context
            }):
                if chunk:
                    final_result = chunk
                    if hasattr(chunk, "reply") and chunk.reply:
                        new_text = chunk.reply[len(last_reply):]
                        if new_text:
                            yield {"type": "token", "content": new_text}
                            last_reply = chunk.reply
            
            scores_dict = {}
            if final_result:
                for dim in ["market", "team", "timing", "competition", "moat", "execution"]:
                    val = getattr(final_result, dim, None)
                    if val:
                        scores_dict[dim] = val
            
            evaluations = []
            
            # Deterministically attach RAG metadata
            for dim_key, score_data in scores_dict.items():
                dim_clean = dim_key.lower().strip()
                if dim_clean not in ["market", "team", "timing", "competition", "moat", "execution"]:
                    continue
                
                score = int(score_data.score)
                justification = score_data.justification
                
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
                
            yield {"type": "evaluations", "evaluations": evaluations}
            success = True
            break

        except Exception as e:
            last_error = e
            continue

    if not success:
        yield {"type": "token", "content": f"\n\nEvaluation failed. Error: {str(last_error)}"}
        yield {"type": "evaluations", "evaluations": []}
