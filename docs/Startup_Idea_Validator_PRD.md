# PRD: Startup Idea Validator

**Status:** Draft — ready for build
**Owner:** [you]
**Last updated:** 2026-06-17

---

## 1. Problem Statement

Anyone with a startup idea faces the same early problem: they don't know which lens to evaluate it through, and they don't have access to a mentor or advisor who can apply real frameworks (YC, a16z, NFX) on demand. Most people either skip structured evaluation entirely and rely on gut feel, or they read scattered essays and have to manually figure out which parts apply to their specific idea.

Separately, a generic "AI, rate my startup" tool is not trustworthy, because an LLM left to its own judgment will produce confident-sounding scores with no grounding — there's no way to know if the model is reasoning from something real or just pattern-matching to "sounds plausible."

This product solves both: it gives any user a fast, structured evaluation across 6 dimensions (Market, Team, Timing, Competition, Moat, Execution), where every score is grounded in a retrieved excerpt from a real, named framework — not the model's unguided opinion — and the source is shown so the user can judge the reasoning themselves.

## 2. Goals

- Let anyone — no signup, no account — describe a startup idea in plain English and get a structured, framework-grounded evaluation in under 15 seconds.
- Make every score traceable to a specific source excerpt, so users can verify the reasoning instead of trusting a black-box number.
- Keep the tool free and frictionless to use, while controlling cost and abuse well enough that public traffic doesn't break it or bankrupt it.
- Be honest about what this is: a structured way to apply known frameworks to an idea, not a verdict on whether the idea will succeed.

## 3. Non-Goals

- This is not a substitute for talking to a real advisor, mentor, or investor before making a significant business decision.
- No claim of predictive accuracy — the tool does not know which ideas will actually succeed.
- No user accounts or login required to use the core product (friction-free access is a deliberate feature, not a gap — see Section 9 for the tradeoff this creates).
- No persistent server-side storage of user-submitted ideas beyond what's needed to serve the response (privacy: don't retain what people type about their unreleased idea).

## 4. Target User

Anyone evaluating a startup idea before committing real time or money to it: first-time founders, indie hackers, students exploring an idea, side-project builders deciding whether to keep going. The common trait is low context on formal startup frameworks and a need for a fast, structured first pass — not professional investors doing due diligence, who have better tools and don't need this.

[Guessing] No user interviews have been conducted yet; the assumption that this audience values speed and framework-grounding over deep customization is untested. Worth validating with even 5-10 real users before investing in stretch features.

## 5. Success Metrics

| Metric | Target | Why it matters |
|---|---|---|
| Evaluation completion rate | >85% of submitted ideas return a full result without error | Measures whether the pipeline is reliable under real (not just test) input variety |
| Time to result | Under 15 seconds at p90 | Anything slower and users abandon before seeing value |
| Score differentiation | Across a sample of real submissions, scores are not clustering at 6-8/10 regardless of input | If every idea gets a similar score, the product has no value — see Risk table |
| Repeat usage | Some meaningful share of users submit a second idea or return within a week | Signals the tool was useful enough to come back to, not just a novelty |
| Cost per evaluation stays under budget | Tracked against whatever LLM API budget is set | A public, unauthenticated tool with no cap can have unbounded cost — this must be monitored, not assumed |
| Abuse rate | Rate-limited requests / total requests stays low | High values indicate the rate limiter is either too aggressive (hurting real users) or being actively abused |

## 6. Core Requirements (MVP)

| # | Requirement | Acceptance criteria |
|---|---|---|
| 1 | Idea input | Any visitor can enter a 2-5 sentence startup idea in a textarea and submit it — no login required |
| 2 | Six-dimension evaluation | Submission triggers independent retrieval + scoring for Market, Team, Timing, Competition, Moat, Execution |
| 3 | Radar chart | All 6 scores (1-10) render on an interactive radar/spider chart |
| 4 | Drill-down | Each dimension expands to show the LLM's justification and the specific source it drew from |
| 5 | Overall score | A simple average of the 6 dimension scores displays prominently |
| 6 | Loading state | User sees a skeleton/spinner while the 6 evaluations run |
| 7 | Grounding enforcement | Every justification must reference retrieved context; if context doesn't address the idea well, the system says so explicitly rather than inventing reasoning |
| 8 | Visible disclaimer | A persistent, visible note that this is framework-applied feedback, not investment, legal, or business advice |
| 9 | Rate limiting | Per-IP or per-session request limits to prevent a single source from exhausting the LLM budget or spamming the service |

## 7. Stretch Requirements (Build Only If MVP Is Solid)

| # | Requirement |
|---|---|
| 10 | Side-by-side comparison of two ideas (overlapping radar traces) |
| 11 | Local history of past evaluations (browser localStorage only — not server-side) |
| 12 | Shareable image/link of a result |
| 13 | Browsable source library page listing all frameworks in the knowledge base |
| 14 | Re-evaluate only the weak dimensions after editing the idea |
| 15 | PDF export of the evaluation report |
| 16 | Lightweight feedback control ("was this justification useful?") to start collecting signal on quality |

## 8. Explicitly Out of Scope

- Full user accounts / authentication for the core flow
- Server-side database persistence of submitted ideas
- Real-time multi-user collaboration
- Any claim of objective, predictive evaluation accuracy
- Industry-specific scoring (e.g., separate frameworks for hardware vs. SaaS) — noted as a future enhancement, not v1

## 9. Key Product Risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| Unbounded public LLM cost | No-login, public access means anyone can drive cost with no natural ceiling | Per-IP/session rate limiting (Req. 9); hard daily budget cap with graceful degradation if exceeded |
| Abuse / spam submissions | Public form with no auth is an easy target for bots or scripted abuse | Rate limiting; basic bot detection (e.g., simple challenge) if abuse appears in practice |
| LLM hedges to 6-8/10 regardless of input | Destroys the core value prop — undifferentiated scores make the radar chart meaningless | Prompt must demand the justification name a specific strength/weakness from retrieved text; test against deliberately weak ideas before launch |
| User over-trusts the output | Without a clear disclaimer, a real person may treat a "Moat: 8/10" as validated fact and make a real decision on it | Persistent, visible disclaimer (Req. 8); response language frames findings as framework application, not verdicts |
| Retrieval doesn't actually differentiate by dimension | If dimension metadata tagging is wrong at ingestion, all 6 retrievals pull the same generic chunks, collapsing the core mechanism | Manually audit a sample of tagged chunks per dimension before building the index |
| Free-tier infra failure under real traffic | Ephemeral disk wiping the vector store, or LLM rate limits, breaks the product for real users at unpredictable times | Use persistent disk for the vector store; add retry-with-backoff on LLM calls; load-test before public launch |
| Idea privacy concerns | Users submitting an unreleased idea to a public tool may worry about exposure | Be explicit in UI copy about what is and isn't stored; avoid logging full idea text beyond what's operationally necessary |

## 10. Open Questions

- What's the actual rate limit threshold — generous enough for real use, tight enough to control cost? Needs a number, not a placeholder.
- If usage grows past free-tier LLM limits, is there a fallback (a paid tier, a waitlist, a slower queue) or does the product just stop working?
- Should low-confidence dimensions (where retrieved context is weak) be visually flagged on the radar chart, or is a sentence in the justification enough?
- Is there an intended limit on how specific/niche an idea can be before the knowledge base simply has nothing relevant to retrieve — and what should the product say in that case?

## 11. Anticipated Objection & Positioning

**Objection:** "How do I know this is accurate enough to actually trust?"

**Response:** The product doesn't claim to predict success. It applies specific, named frameworks (YC, a16z, NFX) to your idea and shows exactly which framework drove which score, with the source visible. That's a faster starting point than reading the source essays yourself and guessing how they apply — but it's a starting point, not a verdict. Real decisions still deserve a real advisor, mentor, or investor's judgment.

This framing matters for both UX copy and legal exposure: the product should never present itself as predicting outcomes.

## 12. Milestones

| Phase | Scope | Target |
|---|---|---|
| 1 | Knowledge base: scrape, chunk, tag, index (~150-200 chunks across 6 dimensions) | Days 1-2 |
| 2 | Backend: parallel retrieval/scoring, plus rate limiting and cost guardrails | Days 3-4 |
| 3 | Frontend: input form, radar chart, drill-down cards, disclaimer | Days 5-6 |
| 4 | Polish: error handling, color-coded overall score, responsive layout | Day 7 |
| 5 | Soft launch: deploy publicly, monitor cost/abuse metrics under real traffic before promoting it anywhere | Day 8+ |
| 6 | Stretch goals (comparison mode, source library, PDF export, feedback signal) | If usage and budget support it |

## 13. Reference: Technical Approach (Summary Only)

Full implementation detail (folder structure, code sketches, exact prompt templates) lives in the engineering build spec, not duplicated here. Summary for product context only:

- **Frontend:** Next.js + TypeScript + Tailwind + Recharts.
- **Backend:** FastAPI, async, with rate limiting middleware added for public exposure.
- **Retrieval:** sentence-transformers embeddings + ChromaDB, filtered by a `dimension` metadata tag per chunk.
- **Generation:** Groq (`llama-3.3-70b-versatile`), 6 parallel calls per request, JSON-structured output.
- **Cost control:** free-tier LLM usage is viable for low/moderate public traffic, but has no cap by default — a budget alert or hard cutoff needs to be added before this is exposed without limits.
