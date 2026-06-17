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
* **Embedding Model:** `sentence-transformers/all-MiniLM-L6-v2` (fast, free, and efficient for local chunk embedding).
* **Vector Database:** ChromaDB (running locally on persistent disk for the ~150-200 chunk knowledge base).
* **LLM Provider:** Groq API
* **LLM Model:** `llama-3.3-70b-versatile` (used for generation and scoring, executed in 6 parallel calls per request).
* **Data Scraping (Offline preparation):** `requests` and `BeautifulSoup` for extracting YC, a16z, and NFX essays.

## 4. Deployment & Infrastructure
* **Frontend Hosting:** Vercel (ideal for Next.js applications).
* **Backend Hosting:** Platform supporting Python/FastAPI with persistent disk storage for ChromaDB (e.g., Render, Railway, or AWS EC2).
