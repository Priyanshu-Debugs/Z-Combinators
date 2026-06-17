# Technology Stack: Startup Idea Validator

## 1. Frontend Architecture
The frontend is designed to be fast, responsive, and completely frictionless (no authentication required).
* **Framework:** Next.js
* **Language:** TypeScript
* **Styling:** Tailwind CSS
* **Data Visualization:** Recharts (specifically for the Radar Chart component)

## 2. Backend Architecture
The backend coordinates the asynchronous Retrieval-Augmented Generation (RAG) pipeline.
* **Framework:** FastAPI
* **Language:** Python
* **Middleware:** Rate limiting (e.g., using `slowapi` or custom Redis-based limiters) for public exposure control.

## 3. AI & RAG Pipeline
The core engine that powers the contextual evaluation of the startup ideas.
* **RAG Orchestrator:** LangChain (`langchain-core` and `langchain-google-genai` integration).
* **Embedding Model:** `models/gemini-embedding-2` (high-quality embeddings generated via LangChain's `GoogleGenerativeAIEmbeddings`).
* **Vector Database:** ChromaDB (running locally on persistent disk for the ~150-200 chunk knowledge base).
* **LLM Provider:** Google Gemini API
* **LLM Model:** `gemini-3.1-flash-lite` (used for generation and scoring, executed in 6 parallel async calls per request using LangChain's `ChatGoogleGenerativeAI`).
* **Data Scraping (Offline preparation):** `requests` and `BeautifulSoup` for extracting YC, a16z, and NFX essays.

## 4. Deployment & Infrastructure
* **Frontend Hosting:** Vercel (ideal for Next.js applications).
* **Backend Hosting:** Platform supporting Python/FastAPI with persistent disk storage for ChromaDB (e.g., Render, Railway, or AWS EC2).
