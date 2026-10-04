import json
import re
import logging
from typing import AsyncGenerator
from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from app.core.config import settings
from app.core.key_manager import key_manager, is_rate_limit_error
from app.services.vector_store import retrieve_all_dimensions
from app.schemas.evaluation import DimensionResult

logger = logging.getLogger(__name__)


def extract_text_content(content) -> str:
    if isinstance(content, str):
        return content
    elif isinstance(content, list):
        parts = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict) and "text" in part:
                parts.append(part["text"])
            elif hasattr(part, "text"):
                parts.append(part.text)
            else:
                parts.append(str(part))
        return "".join(parts)
    return str(content) if content is not None else ""


OFF_TOPIC_PATTERNS = [
    r"^\s*(hi|hello|hey|yo|sup|hola|greetings|good\s*(morning|evening|afternoon|night)|what'?s?\s*up)\s*[!?.]*\s*$",
    r"(how\s+(can|do|should)\s+i\s+(build|start|create|launch|make)\s+(a|my|the)\s+(startup|business|company|app|product))",
    r"(what\s+(is|are)\s+(the\s+)?(best|good)\s+(way|tips|advice|steps)\s+(to|for)\s+(start|build|create|launch))",
    r"(give\s+me\s+(some\s+)?(tips|advice|suggestions))",
    r"(how\s+to\s+(become|be)\s+(an?\s+)?entrepreneur)",
    r"(what\s+makes\s+a\s+(good|great|successful)\s+startup)",
    r"(what\s+is\s+the\s+(weather|time|date))",
    r"(tell\s+me\s+a\s+(joke|story))",
    r"(who\s+(are|r)\s+(you|u))",
]

ADVISOR_CHAT_PROMPT = """You are an expert startup advisor applying frameworks from Y Combinator, Andreessen Horowitz (a16z), Sequoia Capital, First Round Review, and NFX.

Your task is to engage in a conversational chat with the user about their startup idea.
1. Review the user's latest input and the entire conversation history.
2. In your reply, answer the user's questions, give constructive feedback on their strengths and weaknesses, and suggest what areas they need to flesh out.
3. Be direct and specific. Name concrete strengths or weaknesses.
4. Do NOT use any emojis in your response.
5. If the user's latest message is NOT related to a startup idea (e.g., greeting or off-topic), politely redirect them to share their specific startup idea for evaluation. Do NOT try to evaluate any dimensions or ask follow-ups.

Write your conversational reply to the user directly without JSON, tags, or emojis."""

EVALUATION_PROMPT = """You are an expert startup evaluator applying frameworks from Y Combinator, Andreessen Horowitz (a16z), Sequoia Capital, First Round Review, and NFX.

Your task is to evaluate the user's startup idea based on the conversation history and the latest user message.
1. Independently evaluate all 6 dimensions: Market, Team, Timing, Competition, Moat, and Execution.
2. Assign an integer score (0-10) and a justification (2-3 sentences) for each dimension.
3. CRITICAL: If the conversation lacks enough detail to evaluate a dimension (Market, Team, Competition, Moat, or Execution), assign a score of 0 and explain what details are missing (e.g., "Context insufficient. Please share the experience and domain expertise of your founding team.").
   EXCEPTION FOR TIMING: The user is NOT expected to provide info on Timing. Instead, you MUST analyze their startup concept and suggest/evaluate Timing based on macro trends, tech shifts, or consumer behavior shifts. Do NOT default to 0 for Timing unless you truly cannot identify any relevant trends.
4. For dimensions where details are present, justify strictly using the framework context where applicable.
5. SCORING CALIBRATION:
   - 0: Not evaluated / context insufficient (excluding Timing)
   - 1-2: Fundamentally flawed or red-flag level
   - 3-4: Below average with significant concerns
   - 5-6: Adequate but unremarkable
   - 7-8: Strong with clear potential
   - 9-10: Exceptional / best-in-class
6. If the message is off-topic or a greeting, assign 0 to ALL dimensions with "No startup idea presented for evaluation."
7. You MUST generate exactly 3 short, context-specific follow-up questions under 12 words each.
8. Do NOT use any emojis.

Respond in exact JSON:
{{
  "suggested_followups": [
    "<follow-up prompt 1>",
    "<follow-up prompt 2>",
    "<follow-up prompt 3>"
  ],
  "market": {{ "score": <0-10>, "justification": "<justification>" }},
  "team": {{ "score": <0-10>, "justification": "<justification>" }},
  "timing": {{ "score": <0-10>, "justification": "<justification>" }},
  "competition": {{ "score": <0-10>, "justification": "<justification>" }},
  "moat": {{ "score": <0-10>, "justification": "<justification>" }},
  "execution": {{ "score": <0-10>, "justification": "<justification>" }}
}}"""

HUMAN_CHAT_TEMPLATE = """CONVERSATION HISTORY:
{chat_history}

USER'S LATEST MESSAGE:
{user_message}

AVAILABLE FRAMEWORK CONTEXT BY DIMENSION:
{framework_context}

Evaluate the user's message. Only score a dimension if new information was provided for it. Return JSON only."""


class ChatDimensionScore(BaseModel):
    score: int = Field(..., ge=0, le=10)
    justification: str = Field(...)


class ChatAdvisorEvaluations(BaseModel):
    suggested_followups: list[str] = Field(...)
    market: ChatDimensionScore = Field(...)
    team: ChatDimensionScore = Field(...)
    timing: ChatDimensionScore = Field(...)
    competition: ChatDimensionScore = Field(...)
    moat: ChatDimensionScore = Field(...)
    execution: ChatDimensionScore = Field(...)


def resolve_model_name(model_name: str) -> str:
    if model_name == "gemini-3.5-flash-lite":
        return "gemini-3.1-flash-lite"
    return model_name


def determine_confidence(distance: float) -> str:
    if distance < 0.5:
        return "high"
    elif distance < 0.8:
        return "medium"
    else:
        return "low"


CONDENSE_QUESTION_PROMPT = """Given the conversation history and a follow-up user message, rephrase the user message into a standalone, keyword-rich search query optimized for vector semantic search.
Guidelines:
- Keep it to a single line of search keywords (no question or full sentence).
- Do NOT output anything else except the search keywords.

CONVERSATION HISTORY:
{chat_history}

FOLLOW-UP MESSAGE:
{user_message}

STANDALONE SEARCH QUERY:"""


async def condense_query(user_message: str, history: list[dict]) -> str:
    if not history:
        return user_message

    history_lines = [f"{m['role'].upper()}: {m['content']}" for m in history[-4:]]
    chat_history = "\n".join(history_lines)
    prompt_text = CONDENSE_QUESTION_PROMPT.format(
        chat_history=chat_history, user_message=user_message
    )

    primary_model = resolve_model_name(settings.GEMINI_MODEL)
    max_attempts = max(3, len(key_manager.keys))

    for _ in range(max_attempts):
        active_key = key_manager.get_current_key()
        try:
            llm = ChatGoogleGenerativeAI(
                model=primary_model,
                temperature=0.0,
                max_tokens=60,
                api_key=active_key or None,
            )
            response = await llm.ainvoke(prompt_text)
            condensed = extract_text_content(response.content).strip().replace("`", "").replace('"', "").replace("'", "")
            return condensed if condensed else user_message
        except Exception as e:
            if is_rate_limit_error(e) and key_manager.has_multiple_keys():
                key_manager.rotate_key()
                continue
            return user_message
    return user_message


async def classify_message_intent(user_message: str, history: list[dict]) -> str:
    cleaned = user_message.strip().lower()

    if re.match(r"^\s*(hi|hello|hey|yo|sup|hola|greetings|good\s*(morning|evening|afternoon|night)|what'?s?\s*up)\s*[!?.]*\s*$", cleaned):
        return "greeting"

    for pattern in OFF_TOPIC_PATTERNS:
        if re.search(pattern, cleaned):
            return "off_topic"

    if not history and len(cleaned) < 25:
        startup_keywords = ["startup", "business", "company", "idea", "product", "pitch", "app", "service", "build", "create", "sell", "market", "customer"]
        if not any(kw in cleaned for kw in startup_keywords):
            return "off_topic"

    return "pitch"


def compile_dossier_from_messages(messages: list) -> list[DimensionResult]:
    """Compile latest scores and justifications for each dimension across all messages."""
    compiled = {}
    for m in messages:
        evals_list = getattr(m, "evaluations", None)
        if not evals_list:
            continue
        if isinstance(evals_list, str):
            try:
                evals_list = json.loads(evals_list)
            except Exception:
                continue

        if isinstance(evals_list, list):
            for ev in evals_list:
                dim_name = ev.get("dimension") if isinstance(ev, dict) else getattr(ev, "dimension", None)
                score = ev.get("score", 0) if isinstance(ev, dict) else getattr(ev, "score", 0)
                if dim_name:
                    dim_title = dim_name.title()
                    existing = compiled.get(dim_title)
                    if score > 0 or existing is None:
                        if isinstance(ev, dict):
                            compiled[dim_title] = DimensionResult(
                                dimension=dim_title,
                                score=score,
                                justification=ev.get("justification", ""),
                                source_excerpt=ev.get("source_excerpt", ""),
                                source_framework=ev.get("source_framework", ""),
                                confidence=ev.get("confidence", "medium"),
                            )
                        else:
                            compiled[dim_title] = ev

    return list(compiled.values())


async def evaluate_chat_turn(
    user_message: str,
    history: list[dict],
) -> tuple[str, list[DimensionResult], list[str]]:
    """Synchronous 2-phase evaluation of chat turn with single-pass vector retrieval."""
    intent = await classify_message_intent(user_message, history)

    history_lines = [f"{m['role'].upper()}: {m['content']}" for m in history]
    chat_history = "\n".join(history_lines) if history_lines else "No previous history."

    retrieved_chunks = {}
    if intent not in ["greeting", "off_topic"]:
        search_query = await condense_query(user_message, history)
        # SINGLE-PASS RETRIEVAL: 1 API call for all 6 dimensions
        retrieved_chunks = retrieve_all_dimensions(search_query, top_k=2)
        context_blocks = []
        for dim, chunks in retrieved_chunks.items():
            if chunks:
                chunks_text = "\n\n".join(f"- {c['text']}" for c in chunks)
                context_blocks.append(f"[{dim.upper()} FRAMEWORK CONTEXT]:\n{chunks_text}")
        framework_context = "\n\n---\n\n".join(context_blocks) if context_blocks else "No framework context found."
    else:
        framework_context = "No framework context needed for greetings or off-topic messages."

    # Phase 1: Conversational Reply
    chat_prompt = ChatPromptTemplate.from_messages([
        ("system", ADVISOR_CHAT_PROMPT),
        ("human", HUMAN_CHAT_TEMPLATE),
    ])

    primary_model = resolve_model_name(settings.GEMINI_MODEL)
    models_to_try = [primary_model, "gemini-3.1-flash-lite", "gemini-2.5-flash"]
    reply = ""

    for attempt in range(max(3, len(key_manager.keys))):
        active_key = key_manager.get_current_key()
        success = False
        for m in models_to_try:
            try:
                llm = ChatGoogleGenerativeAI(model=m, temperature=0.3, max_tokens=1000, api_key=active_key or None)
                chain = chat_prompt | llm
                res = await chain.ainvoke({
                    "chat_history": chat_history,
                    "user_message": user_message,
                    "framework_context": framework_context,
                })
                reply = extract_text_content(res.content).strip()
                success = True
                break
            except Exception:
                if key_manager.has_multiple_keys():
                    key_manager.rotate_key()
                    break
        if success:
            break

    if not reply:
        reply = "I apologize, but I encountered an error evaluating your pitch. Please try again."

    # Phase 2: Dimension Evaluations
    evaluations = []
    if intent in ["greeting", "off_topic"]:
        for dim in settings.DIMENSIONS:
            evaluations.append(
                DimensionResult(
                    dimension=dim.title(),
                    score=0,
                    justification="No startup idea presented for evaluation.",
                    source_excerpt="No matching context available.",
                    source_framework="N/A",
                    confidence="low",
                )
            )
        return reply, evaluations, ["Share my startup idea", "What frameworks do you use?", "How does this evaluation work?"]

    eval_prompt_template = ChatPromptTemplate.from_messages([
        ("system", EVALUATION_PROMPT),
        ("human", HUMAN_CHAT_TEMPLATE),
    ])

    suggested = []
    eval_success = False

    for attempt in range(max(3, len(key_manager.keys))):
        active_key = key_manager.get_current_key()
        rotated = False
        for m in models_to_try:
            try:
                llm = ChatGoogleGenerativeAI(model=m, temperature=0.2, max_tokens=1500, api_key=active_key or None)
                structured_llm = llm.with_structured_output(ChatAdvisorEvaluations)
                chain = eval_prompt_template | structured_llm
                result = await chain.ainvoke({
                    "chat_history": chat_history,
                    "user_message": user_message,
                    "framework_context": framework_context,
                })
                suggested = result.suggested_followups
                scores_dict = {
                    "market": result.market,
                    "team": result.team,
                    "timing": result.timing,
                    "competition": result.competition,
                    "moat": result.moat,
                    "execution": result.execution,
                }
                for dim_key, score_data in scores_dict.items():
                    chunks = retrieved_chunks.get(dim_key, [])
                    if chunks:
                        best_chunk = chunks[0]
                        conf = determine_confidence(best_chunk["distance"])
                        excerpt = best_chunk["text"][:500]
                        fw = f"{best_chunk['source_org'].upper()} -- {best_chunk['source_title']}"
                    else:
                        conf = "low"
                        excerpt = "No matching context available."
                        fw = "N/A"

                    evaluations.append(
                        DimensionResult(
                            dimension=dim_key.title(),
                            score=int(score_data.score),
                            justification=score_data.justification,
                            source_excerpt=excerpt,
                            source_framework=fw,
                            confidence=conf,
                        )
                    )
                eval_success = True
                break
            except Exception:
                if key_manager.has_multiple_keys():
                    key_manager.rotate_key()
                    rotated = True
                    break
        if eval_success or not rotated:
            break

    if not eval_success:
        for dim in settings.DIMENSIONS:
            evaluations.append(
                DimensionResult(
                    dimension=dim.title(),
                    score=0,
                    justification="Evaluation failed. Please try again.",
                    source_excerpt="No matching context available.",
                    source_framework="N/A",
                    confidence="low",
                )
            )

    return reply, evaluations, suggested


async def evaluate_chat_turn_stream(
    user_message: str,
    history: list[dict],
) -> AsyncGenerator[dict, None]:
    """Streaming chat turn with single-pass vector retrieval."""
    intent = await classify_message_intent(user_message, history)

    history_lines = [f"{m['role'].upper()}: {m['content']}" for m in history]
    chat_history = "\n".join(history_lines) if history_lines else "No previous history."

    retrieved_chunks = {}
    if intent not in ["greeting", "off_topic"]:
        search_query = await condense_query(user_message, history)
        # SINGLE-PASS RETRIEVAL: 1 API call for all 6 dimensions
        retrieved_chunks = retrieve_all_dimensions(search_query, top_k=2)
        context_blocks = []
        for dim, chunks in retrieved_chunks.items():
            if chunks:
                chunks_text = "\n\n".join(f"- {c['text']}" for c in chunks)
                context_blocks.append(f"[{dim.upper()} FRAMEWORK CONTEXT]:\n{chunks_text}")
        framework_context = "\n\n---\n\n".join(context_blocks) if context_blocks else "No framework context found."
    else:
        framework_context = "No framework context needed for greetings or off-topic messages."

    # Phase 1: Stream conversational tokens
    chat_prompt = ChatPromptTemplate.from_messages([
        ("system", ADVISOR_CHAT_PROMPT),
        ("human", HUMAN_CHAT_TEMPLATE),
    ])

    primary_model = resolve_model_name(settings.GEMINI_MODEL)
    models_to_try = [primary_model, "gemini-3.1-flash-lite", "gemini-2.5-flash"]
    reply_success = False

    for attempt in range(max(3, len(key_manager.keys))):
        active_key = key_manager.get_current_key()
        rotated = False
        for m in models_to_try:
            try:
                llm = ChatGoogleGenerativeAI(model=m, temperature=0.3, max_tokens=1000, api_key=active_key or None)
                chain = chat_prompt | llm
                async for chunk in chain.astream({
                    "chat_history": chat_history,
                    "user_message": user_message,
                    "framework_context": framework_context,
                }):
                    if chunk and hasattr(chunk, "content"):
                        text = extract_text_content(chunk.content)
                        if text:
                            yield {"type": "token", "content": text}
                reply_success = True
                break
            except Exception:
                if key_manager.has_multiple_keys():
                    key_manager.rotate_key()
                    rotated = True
                    break
        if reply_success or not rotated:
            break

    if not reply_success:
        yield {"type": "token", "content": "Our AI advisor is temporarily busy. Please try again shortly."}

    # Phase 2: Evaluations
    evaluations = []
    suggested = []

    if intent in ["greeting", "off_topic"]:
        for dim in settings.DIMENSIONS:
            evaluations.append(
                DimensionResult(
                    dimension=dim.title(),
                    score=0,
                    justification="No startup idea presented for evaluation.",
                    source_excerpt="No matching context available.",
                    source_framework="N/A",
                    confidence="low",
                )
            )
        yield {
            "type": "evaluations",
            "evaluations": evaluations,
            "suggested_followups": ["Share my startup idea", "What frameworks do you use?", "How does this evaluation work?"],
        }
        return

    eval_prompt_template = ChatPromptTemplate.from_messages([
        ("system", EVALUATION_PROMPT),
        ("human", HUMAN_CHAT_TEMPLATE),
    ])

    eval_success = False
    for attempt in range(max(3, len(key_manager.keys))):
        active_key = key_manager.get_current_key()
        rotated = False
        for m in models_to_try:
            try:
                llm = ChatGoogleGenerativeAI(model=m, temperature=0.2, max_tokens=1500, api_key=active_key or None)
                structured_llm = llm.with_structured_output(ChatAdvisorEvaluations)
                chain = eval_prompt_template | structured_llm
                result = await chain.ainvoke({
                    "chat_history": chat_history,
                    "user_message": user_message,
                    "framework_context": framework_context,
                })
                suggested = result.suggested_followups
                scores_dict = {
                    "market": result.market,
                    "team": result.team,
                    "timing": result.timing,
                    "competition": result.competition,
                    "moat": result.moat,
                    "execution": result.execution,
                }
                for dim_key, score_data in scores_dict.items():
                    chunks = retrieved_chunks.get(dim_key, [])
                    if chunks:
                        best_chunk = chunks[0]
                        conf = determine_confidence(best_chunk["distance"])
                        excerpt = best_chunk["text"][:500]
                        fw = f"{best_chunk['source_org'].upper()} -- {best_chunk['source_title']}"
                    else:
                        conf = "low"
                        excerpt = "No matching context available."
                        fw = "N/A"

                    evaluations.append(
                        DimensionResult(
                            dimension=dim_key.title(),
                            score=int(score_data.score),
                            justification=score_data.justification,
                            source_excerpt=excerpt,
                            source_framework=fw,
                            confidence=conf,
                        )
                    )
                eval_success = True
                break
            except Exception:
                if key_manager.has_multiple_keys():
                    key_manager.rotate_key()
                    rotated = True
                    break
        if eval_success or not rotated:
            break

    if not eval_success:
        for dim in settings.DIMENSIONS:
            evaluations.append(
                DimensionResult(
                    dimension=dim.title(),
                    score=0,
                    justification="Evaluation failed. Please try again.",
                    source_excerpt="No matching context available.",
                    source_framework="N/A",
                    confidence="low",
                )
            )

    yield {
        "type": "evaluations",
        "evaluations": evaluations,
        "suggested_followups": suggested,
    }
