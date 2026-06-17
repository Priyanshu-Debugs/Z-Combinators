# Software Requirements Specification (SRS): Startup Idea Validator

## 1. Introduction
### 1.1 Purpose
This document outlines the software requirements for the "Startup Idea Validator," a web-based tool that provides fast, structured evaluations of startup ideas across six dimensions using established business frameworks via a Retrieval-Augmented Generation (RAG) pipeline.

### 1.2 Scope
The system allows users to submit plain-English startup ideas without creating an account. It evaluates the idea based on Market, Team, Timing, Competition, Moat, and Execution. The output includes a radar chart and explicit citations from curated startup frameworks (YC, a16z, NFX).

## 2. Overall Description
### 2.1 User Characteristics
Target users include first-time founders, indie hackers, students, and side-project builders who need a fast, structured, first-pass evaluation of their ideas before committing significant resources.

### 2.2 Assumptions & Dependencies
* High-quality, curated text chunks (~150-200) from credible sources are available for the RAG knowledge base.
* The LLM API (Groq) remains responsive and within budget limits for free-tier/public usage.

## 3. Specific Requirements
### 3.1 Functional Requirements
* **FR-1 Idea Input:** The system shall provide a text area for users to input a 2-5 sentence startup idea without requiring authentication.
* **FR-2 Dimension Evaluation:** The system shall independently retrieve context and score the idea across six fixed dimensions: Market, Team, Timing, Competition, Moat, and Execution.
* **FR-3 Radar Chart Visualization:** The system shall display the six scores (1-10) on an interactive radar/spider chart.
* **FR-4 Justification & Citation:** The system shall display an expandable drill-down for each dimension containing the LLM's justification and the exact sourced excerpt.
* **FR-5 Overall Score:** The system shall calculate and display a simple average of the six dimension scores.
* **FR-6 Loading State:** The system shall display a loading skeleton/spinner while processing evaluations.
* **FR-7 Grounding Enforcement:** The system shall explicitly state "Context insufficient" and default to a median score if the retrieved context does not apply to the idea.

### 3.2 Non-Functional Requirements
* **NFR-1 Performance:** The system shall return a complete evaluation result in under 15 seconds at the 90th percentile (p90).
* **NFR-2 Security/Abuse Prevention:** The system shall implement per-IP or per-session rate limiting to prevent API abuse and unbounded LLM costs.
* **NFR-3 Privacy:** The system shall not persistently store user-submitted ideas on the server beyond the operational need to process the request.
* **NFR-4 Usability:** The system shall display a persistent disclaimer indicating that the feedback is an application of frameworks, not professional investment or legal advice.
