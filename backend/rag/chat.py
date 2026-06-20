import json
import re
import logging
from typing import Dict, Optional, AsyncGenerator
from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from config import settings
from rag.key_manager import key_manager, is_rate_limit_error
from rag.vector_store import retrieve_for_dimension
from models import DimensionResult

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
    # Greetings
    r"^\s*(hi|hello|hey|yo|sup|hola|greetings|good\s*(morning|evening|afternoon|night)|what'?s?\s*up)\s*[!?.]*\s*$",
    # Generic startup advice questions  
    r"(how\s+(can|do|should)\s+i\s+(build|start|create|launch|make)\s+(a|my|the)\s+(startup|business|company|app|product))",
    # What is the best way to start a business
    r"(what\s+(is|are)\s+(the\s+)?(best|good)\s+(way|tips|advice|steps)\s+(to|for)\s+(start|build|create|launch))",
    # Give me advice / tips
    r"(give\s+me\s+(some\s+)?(tips|advice|suggestions))",
    # Entrepreneur questions
    r"(how\s+to\s+(become|be)\s+(an?\s+)?entrepreneur)",
    # Startup questions
    r"(what\s+makes\s+a\s+(good|great|successful)\s+startup)",
    # Unrelated general knowledge
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
5. If the user's latest message is NOT related to a startup idea (e.g., it is a greeting like "hello", "hi", a generic question like "how do I build a startup?", or any off-topic message), politely redirect them to share their specific startup idea for evaluation. Do NOT try to evaluate any dimensions or ask follow-ups.

Write your conversational reply to the user. Do NOT write any JSON, tags, or formatting. Just write the response directly."""

EVALUATION_PROMPT = """You are an expert startup evaluator. You evaluate startup ideas by applying frameworks from Y Combinator, Andreessen Horowitz (a16z), Sequoia Capital, First Round Review, and NFX.

Your task is to evaluate the user's startup idea based on the conversation history and the latest user message.
1. Independently evaluate all 6 dimensions: Market, Team, Timing, Competition, Moat, and Execution.
2. You MUST assign a score (integer 0-10) and a justification (2-3 sentences) for each of the 6 dimensions.
3. CRITICAL: If the conversation does not contain enough details to evaluate a specific dimension (Market, Team, Competition, Moat, or Execution) yet, assign a score of 0 (zero) and write a justification explaining what details are missing (e.g., "Context insufficient. Please share the experience and domain expertise of your founding team.").
   EXCEPTION FOR TIMING: The user is NOT expected to provide info on the Timing dimension. Instead, you MUST analyze their startup concept, industry, and solution, and actively suggest/evaluate the "Timing" dimension. You should identify relevant macro trends, technological shifts (e.g., AI, mobile, cloud), regulatory changes, or consumer behavior shifts that make now the right time to build this. Your justification should describe these trends and assign a score based on how strong the timing opportunity is. Do NOT say "Context insufficient" or default to 0 for Timing unless you truly cannot identify any relevant trends.
4. For dimensions where details are present (and for Timing), the justification must be strictly grounded in the provided framework context whenever possible (such as Sequoia's 'Why Now', NFX's fast-moving market shifts, etc.). Do not invent arbitrary or ungrounded framework citations.
5. SCORING CALIBRATION:
   - 0: Not yet evaluated / context insufficient (excluding Timing)
   - 1-2: Fundamentally flawed or red-flag level (e.g., no market demand, critical legal issues)
   - 3-4: Below average with significant concerns (e.g., small niche market, weak differentiation)  
   - 5-6: Adequate but unremarkable (e.g., decent market but unclear positioning)
   - 7-8: Strong with clear potential (e.g., large growing market, strong founder-market fit)
   - 9-10: Exceptional/best-in-class (e.g., massive TAM with clear wedge, proven serial founders)
   DO NOT cluster all scores around 5-6. Be decisive and discriminating. A great market opportunity should score 8+. A missing team should score 0.
6. If the user's latest message is off-topic, a greeting, or not a startup idea/discussion, assign a score of 0 to ALL dimensions, and write "No startup idea presented for evaluation." as the justification.
7. You MUST generate exactly 3 short, context-specific follow-up questions or prompts that the user could ask next to continue their evaluation. Keep them concise (under 12 words each) and highly actionable.
8. Do NOT use any emojis.

Respond in this exact JSON format:
{{
  "suggested_followups": [
    "<follow-up prompt 1>",
    "<follow-up prompt 2>",
    "<follow-up prompt 3>"
  ],
  "market": {{
    "score": <integer 0-10>,
    "justification": "<justification>"
  }},
  "team": {{
    "score": <integer 0-10>,
    "justification": "<justification>"
  }},
  "timing": {{
    "score": <integer 0-10>,
    "justification": "<justification>"
  }},
  "competition": {{
    "score": <integer 0-10>,
    "justification": "<justification>"
  }},
  "moat": {{
    "score": <integer 0-10>,
    "justification": "<justification>"
  }},
  "execution": {{
    "score": <integer 0-10>,
    "justification": "<justification>"
  }}
}}"""

HUMAN_CHAT_TEMPLATE = """CONVERSATION HISTORY:
{chat_history}

USER'S LATEST MESSAGE:
{user_message}

AVAILABLE FRAMEWORK CONTEXT BY DIMENSION:
{framework_context}

Evaluate the user's message. Only score a dimension if new information was provided for it. Return JSON only."""

class ChatDimensionScore(BaseModel):
    score: int = Field(..., ge=0, le=10, description="The evaluation score (0-10) for this dimension. 0 means not evaluated.")
    justification: str = Field(..., description="2-3 sentences explaining the score based strictly on context.")

class ChatAdvisorEvaluations(BaseModel):
    suggested_followups: list[str] = Field(..., description="Exactly 3 short, context-specific follow-up questions or prompts under 12 words each.")
    market: ChatDimensionScore = Field(..., description="Evaluation of the Market dimension. Assign 0 if context is insufficient.")
    team: ChatDimensionScore = Field(..., description="Evaluation of the Team dimension. Assign 0 if context is insufficient.")
    timing: ChatDimensionScore = Field(..., description="Evaluation of the Timing dimension. Do NOT assign 0 for insufficient context; instead, actively suggest/evaluate the timing opportunity, macro trends, and why now is the right time to build this startup.")
    competition: ChatDimensionScore = Field(..., description="Evaluation of the Competition dimension. Assign 0 if context is insufficient.")
    moat: ChatDimensionScore = Field(..., description="Evaluation of the Moat dimension. Assign 0 if context is insufficient.")
    execution: ChatDimensionScore = Field(..., description="Evaluation of the Execution dimension. Assign 0 if context is insufficient.")

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
    max_attempts = max(3, len(key_manager.keys))
    
    for attempt in range(max_attempts):
        active_key = key_manager.get_current_key()
        try:
            llm = ChatGoogleGenerativeAI(
                model=primary_model,
                temperature=0.0,
                max_tokens=60,
                api_key=active_key or None,
            )
            response = await llm.ainvoke(prompt_text)
            condensed = extract_text_content(response.content).strip()
            condensed = condensed.replace("`", "").replace('"', "").replace("'", "")
            return condensed if condensed else user_message
        except Exception as e:
            if is_rate_limit_error(e) and key_manager.has_multiple_keys():
                key_manager.rotate_key()
                continue
            print(f"Error during query condensation: {e}")
            return user_message

async def classify_message_intent(user_message: str, history: list[dict]) -> str:
    """
    Classify the user's message intent:
    - 'greeting': User is saying hi/hello
    - 'off_topic': General/off-topic questions not about their startup
    - 'pitch': The user is describing or refining their startup idea
    """
    cleaned = user_message.strip().lower()
    
    # 1. Regex check for greetings
    greeting_match = re.match(r"^\s*(hi|hello|hey|yo|sup|hola|greetings|good\s*(morning|evening|afternoon|night)|what'?s?\s*up)\s*[!?.]*\s*$", cleaned)
    if greeting_match:
        return "greeting"
        
    # 2. Regex check for off-topic/generic questions
    for pattern in OFF_TOPIC_PATTERNS:
        if re.search(pattern, cleaned):
            return "off_topic"
            
    # 3. If history is empty and user message is very short (under 25 characters) and doesn't contain startup words, it might be off-topic
    if not history and len(cleaned) < 25:
        startup_keywords = ["startup", "business", "company", "idea", "product", "pitch", "app", "service", "build", "create", "sell", "market", "customer"]
        if not any(kw in cleaned for kw in startup_keywords):
            return "off_topic"
            
    # 4. LLM check for ambiguous cases using the cheapest model
    primary_model = resolve_model_name(settings.GEMINI_MODEL)
    try:
        active_key = key_manager.get_current_key()
        llm = ChatGoogleGenerativeAI(
            model=primary_model,
            temperature=0.0,
            max_tokens=10,
            api_key=active_key or None,
        )
        prompt_text = f"""Classify the user's startup advisory message.
Message: "{user_message}"

Is the user describing/asking about a specific startup idea or seeking feedback on one, or is it a general greeting or an off-topic question (like asking about weather, generic coding help, or general startup history)?
Respond with exactly one of these words: "pitch", "greeting", or "off_topic".

Classification:"""
        response = await llm.ainvoke(prompt_text)
        result = extract_text_content(response.content).strip().lower()
        if "greeting" in result:
            return "greeting"
        elif "off_topic" in result or "offtopic" in result:
            return "off_topic"
        else:
            return "pitch"
    except Exception as e:
        logger.error(f"Error in LLM intent classification: {e}")
        return "pitch"  # Default to pitch to avoid blocking valid inputs

async def evaluate_chat_turn(
    user_message: str,
    history: list[dict],
) -> tuple[str, list[DimensionResult], list[str]]:
    """
    Process a single chat turn in two phases.
    Phase 1: Generate conversational advisor reply (supports streaming / fast response).
    Phase 2: Generate RAG evaluations and follow-ups.
    """
    # Step 1: Classify intent
    intent = await classify_message_intent(user_message, history)
    
    # Format history
    history_lines = []
    for msg in history:
        history_lines.append(f"{msg['role'].upper()}: {msg['content']}")
    chat_history = "\n".join(history_lines) if history_lines else "No previous history."
    
    # Retrieve RAG context if not greeting/off-topic
    retrieved_chunks = {}
    if intent not in ["greeting", "off_topic"]:
        search_query = await condense_query(user_message, history)
        context_blocks = []
        for dim in ["market", "team", "timing", "competition", "moat", "execution"]:
            chunks = retrieve_for_dimension(search_query, dim, top_k=2)
            retrieved_chunks[dim] = chunks
            if chunks:
                chunks_text = "\n\n".join(f"- {c['text']}" for c in chunks)
                context_blocks.append(f"[{dim.upper()} FRAMEWORK CONTEXT]:\n{chunks_text}")
        framework_context = "\n\n---\n\n".join(context_blocks) if context_blocks else "No framework context found."
    else:
        framework_context = "No framework context needed for greetings or off-topic messages."

    # Phase 1: Call LLM to generate the reply conversational response
    chat_prompt = ChatPromptTemplate.from_messages([
        ("system", ADVISOR_CHAT_PROMPT),
        ("human", HUMAN_CHAT_TEMPLATE)
    ])
    
    primary_model = resolve_model_name(settings.GEMINI_MODEL)
    models_to_try = [primary_model, "gemini-3.1-flash-lite", "gemini-2.5-flash"]
    
    reply = ""
    max_attempts = max(3, len(key_manager.keys))
    
    for attempt in range(max_attempts):
        active_key = key_manager.get_current_key()
        success = False
        for model_name in models_to_try:
            try:
                llm = ChatGoogleGenerativeAI(
                    model=model_name,
                    temperature=0.3,
                    max_tokens=1000,
                    api_key=active_key or None,
                )
                chain = chat_prompt | llm
                res = await chain.ainvoke({
                    "chat_history": chat_history,
                    "user_message": user_message,
                    "framework_context": framework_context
                })
                reply = extract_text_content(res.content).strip()
                success = True
                break
            except Exception as e:
                logger.error(f"Error in Phase 1 call: {e}")
                if key_manager.has_multiple_keys():
                    key_manager.rotate_key()
                    break
        if success:
            break
            
    if not reply:
        reply = "I apologize, but I encountered an error. Please try again."
        
    # Phase 2: Evaluations
    evaluations = []
    suggested = []
    
    if intent in ["greeting", "off_topic"]:
        # Direct zero evaluations
        for dim in ["market", "team", "timing", "competition", "moat", "execution"]:
            evaluations.append(
                DimensionResult(
                    dimension=dim.title(),
                    score=0,
                    justification="No startup idea presented for evaluation.",
                    source_excerpt="No matching context available.",
                    source_framework="N/A",
                    confidence="low"
                )
            )
        suggested = [
            "Share my startup idea",
            "What frameworks do you use?",
            "How does this evaluation work?"
        ]
        return reply, evaluations, suggested
        
    # Pitch / follow-up evaluation
    eval_prompt_template = ChatPromptTemplate.from_messages([
        ("system", EVALUATION_PROMPT),
        ("human", HUMAN_CHAT_TEMPLATE)
    ])
    
    eval_success = False
    for attempt in range(max_attempts):
        active_key = key_manager.get_current_key()
        rotated = False
        for model_name in models_to_try:
            try:
                llm = ChatGoogleGenerativeAI(
                    model=model_name,
                    temperature=0.2,
                    max_tokens=1500,
                    api_key=active_key or None,
                )
                structured_llm = llm.with_structured_output(ChatAdvisorEvaluations)
                chain = eval_prompt_template | structured_llm
                result = await chain.ainvoke({
                    "chat_history": chat_history,
                    "user_message": user_message,
                    "framework_context": framework_context
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
                    dim_clean = dim_key.lower().strip()
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
                eval_success = True
                break
            except Exception as e:
                logger.error(f"Error in Phase 2 call: {e}")
                if key_manager.has_multiple_keys():
                    key_manager.rotate_key()
                    rotated = True
                    break
        if eval_success:
            break
        if not rotated:
            break
            
    if not eval_success:
        # Fallback empty evaluations
        for dim in ["market", "team", "timing", "competition", "moat", "execution"]:
            evaluations.append(
                DimensionResult(
                    dimension=dim.title(),
                    score=0,
                    justification="Evaluation failed. Please try again.",
                    source_excerpt="No matching context available.",
                    source_framework="N/A",
                    confidence="low"
                )
            )
            
    return reply, evaluations, suggested

async def evaluate_chat_turn_stream(
    user_message: str,
    history: list[dict],
) -> AsyncGenerator[dict, None]:
    """
    Stream a single chat turn in two phases.
    Phase 1: Stream conversational tokens for the advisor response.
    Phase 2: Calculate evaluation scores in the background and yield them at the end.
    """
    # 1. Classify intent
    intent = await classify_message_intent(user_message, history)
    
    # Format history
    history_lines = []
    for msg in history:
        history_lines.append(f"{msg['role'].upper()}: {msg['content']}")
    chat_history = "\n".join(history_lines) if history_lines else "No previous history."
    
    # Retrieve RAG context
    retrieved_chunks = {}
    if intent not in ["greeting", "off_topic"]:
        search_query = await condense_query(user_message, history)
        context_blocks = []
        for dim in ["market", "team", "timing", "competition", "moat", "execution"]:
            chunks = retrieve_for_dimension(search_query, dim, top_k=2)
            retrieved_chunks[dim] = chunks
            if chunks:
                chunks_text = "\n\n".join(f"- {c['text']}" for c in chunks)
                context_blocks.append(f"[{dim.upper()} FRAMEWORK CONTEXT]:\n{chunks_text}")
        framework_context = "\n\n---\n\n".join(context_blocks) if context_blocks else "No framework context found."
    else:
        framework_context = "No framework context needed for greetings or off-topic messages."

    # 2. Phase 1: Stream advisor chat reply
    chat_prompt = ChatPromptTemplate.from_messages([
        ("system", ADVISOR_CHAT_PROMPT),
        ("human", HUMAN_CHAT_TEMPLATE)
    ])
    
    primary_model = resolve_model_name(settings.GEMINI_MODEL)
    models_to_try = [primary_model, "gemini-3.1-flash-lite", "gemini-2.5-flash"]
    
    reply_success = False
    max_attempts = max(3, len(key_manager.keys))
    
    for attempt in range(max_attempts):
        active_key = key_manager.get_current_key()
        rotated = False
        for model_name in models_to_try:
            try:
                llm = ChatGoogleGenerativeAI(
                    model=model_name,
                    temperature=0.3,
                    max_tokens=1000,
                    api_key=active_key or None,
                )
                chain = chat_prompt | llm
                
                async for chunk in chain.astream({
                    "chat_history": chat_history,
                    "user_message": user_message,
                    "framework_context": framework_context
                }):
                    if chunk and hasattr(chunk, "content"):
                        text = extract_text_content(chunk.content)
                        if text:
                            yield {"type": "token", "content": text}
                
                reply_success = True
                break
            except Exception as e:
                logger.error(f"Error in streaming phase 1: {e}")
                if key_manager.has_multiple_keys():
                    key_manager.rotate_key()
                    rotated = True
                    break
        if reply_success:
            break
        if not rotated:
            break
            
    if not reply_success:
        fallback_msg = "We are sorry for the inconvenience, but our AI evaluation service is temporarily unavailable. Please try again in a few moments."
        yield {"type": "token", "content": fallback_msg}

    # 3. Phase 2: Evaluations
    evaluations = []
    suggested = []
    
    if intent in ["greeting", "off_topic"]:
        for dim in ["market", "team", "timing", "competition", "moat", "execution"]:
            evaluations.append(
                DimensionResult(
                    dimension=dim.title(),
                    score=0,
                    justification="No startup idea presented for evaluation.",
                    source_excerpt="No matching context available.",
                    source_framework="N/A",
                    confidence="low"
                )
            )
        suggested = [
            "Share my startup idea",
            "What frameworks do you use?",
            "How does this evaluation work?"
        ]
        yield {"type": "evaluations", "evaluations": evaluations, "suggested_followups": suggested}
        return
        
    # Pitch / follow-up evaluation
    eval_prompt_template = ChatPromptTemplate.from_messages([
        ("system", EVALUATION_PROMPT),
        ("human", HUMAN_CHAT_TEMPLATE)
    ])
    
    eval_success = False
    for attempt in range(max_attempts):
        active_key = key_manager.get_current_key()
        rotated = False
        for model_name in models_to_try:
            try:
                llm = ChatGoogleGenerativeAI(
                    model=model_name,
                    temperature=0.2,
                    max_tokens=1500,
                    api_key=active_key or None,
                )
                structured_llm = llm.with_structured_output(ChatAdvisorEvaluations)
                chain = eval_prompt_template | structured_llm
                
                result = await chain.ainvoke({
                    "chat_history": chat_history,
                    "user_message": user_message,
                    "framework_context": framework_context
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
                    dim_clean = dim_key.lower().strip()
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
                eval_success = True
                break
            except Exception as e:
                logger.error(f"Error in streaming phase 2 call: {e}")
                if key_manager.has_multiple_keys():
                    key_manager.rotate_key()
                    rotated = True
                    break
        if eval_success:
            break
        if not rotated:
            break
            
    if not eval_success:
        for dim in ["market", "team", "timing", "competition", "moat", "execution"]:
            evaluations.append(
                DimensionResult(
                    dimension=dim.title(),
                    score=0,
                    justification="Evaluation failed. Please try again.",
                    source_excerpt="No matching context available.",
                    source_framework="N/A",
                    confidence="low"
                )
            )
            
    yield {"type": "evaluations", "evaluations": evaluations, "suggested_followups": suggested}
