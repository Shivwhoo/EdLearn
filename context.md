# EdLearn: Project Context & Sprint 2-4 Developer Blueprint

This file serves as the definitive reference and status report for **EdLearn**'s architecture, configurations, and roadmap.

---

## 1. System Architecture State

EdLearn is designed as a decoupled full-stack application:

*   **Frontend Client (`/frontend`):** Next.js 16.2.10 (App Router), React, Tailwind CSS v4, and Zustand state managers. Listens on `http://localhost:3000`.
*   **Backend Server (`/backend`):** Node.js + Express + TypeScript. Handles core RAG execution, PostgreSQL data storage (via Prisma 7), and discussion boards (via Mongoose and MongoDB). Listens on `http://localhost:5000`.
*   **Database Stack:** Configured in `docker-compose.yml` to spin up PostgreSQL (port 5434), MongoDB (port 27017), and Redis (port 6379) in separate containers.

---

## 2. Core Modules & Code Mapping

### A. Backend Services (`/backend/src`)
*   **API Routes (`index.ts`):** 
    *   `POST /api/auth/signup` & `POST /api/auth/login` - Secure registration and token-based JWT authentication.
    *   `POST /api/auth/change-password` - Protected endpoint to verify and change password records.
    *   `POST /api/user/active-roadmap` - Caches the user's current roadmap selection in Redis.
    *   `GET /api/dashboard/summary` - Computes active roadmap progress metrics and logs notes history.
    *   `POST /api/roadmap` - Generates a structured study timeline and schedules day modules.
    *   `POST /api/generate` - Performs RAG, fetches Redis cache, evaluates pedagogical modes, and runs double-pass reviews.
    *   `GET /api/topic` - Returns chronological version logs for a specific day ID.
    *   `GET /api/doubt` & `POST /api/doubt` - Forum threads, comment upvotes, and badge calculations.
    *   `GET /api/market-demand` - Scraped GitHub and LinkedIn trending keywords.
    *   `PATCH /api/profile` - Persists user onboarding profile data (fullName, careerGoal, currentSkills, availableTime, difficulty) to PostgreSQL. Invalidates dashboard cache on update.
    *   `POST /api/sso/handoff` - Mints a short-lived (90 s) JWT signed with `SSO_SHARED_SECRET` and returns a redirect URL to EdMentor, EdCompass, or EdQuiz with the token attached. Destination URLs overridable via env vars.
    *   `GET /api/facts` - Generates a Redis-cached batch of 8 personalised micro-learning facts tied to the user's active roadmap topics via the AI service. Cache TTL 6 hours; `?fresh=true` bypasses cache.
    *   `POST /api/assistant/classify` - Classifies a free-text student message into one of four intent labels (`learn | mentor | career | quiz`) using the AI service with a constrained 10-token output. Falls back to `learn` on any error.
    *   `POST /api/tts/generate` - Generates a server-side MP3 audio file for a topic's study notes via `google-tts-api`, stores it in `/backend/tts-audio/`, and writes the URL back to the `Topic.audioUrl` DB field. Includes ownership check.
    *   `GET /api/tts/audio/:file` - Static file serving of generated MP3s, proxied through the frontend's `/api/:path*` rewrite.
*   **AI Service Abstraction (`lib/ai/`):**
    *   [`aiService.ts`](file:///c:/Users/shiva/Desktop/internship/EdLearn/backend/src/lib/ai/aiService.ts) - Unified provider selector routing requests to `Groq` or `Gemini`.
    *   [`providers/groqProvider.ts`](file:///c:/Users/shiva/Desktop/internship/EdLearn/backend/src/lib/ai/providers/groqProvider.ts) - Groq integration with fallback overrides.
    *   [`providers/geminiProvider.ts`](file:///c:/Users/shiva/Desktop/internship/EdLearn/backend/src/lib/ai/providers/geminiProvider.ts) - Google Generative AI integration.
*   **Redis Cache Wrapper (`lib/redis.ts`):** Handles client connections, set/get caches, and connection fail-safes.
*   **SSO Module (`lib/sso.ts`):** `generateHandoffToken()` / `verifyHandoffToken()` / `buildHandoffUrl()` — signs and verifies cross-app JWT handoff tokens using a separate `SSO_SHARED_SECRET` (isolated from the main `JWT_SECRET`).
*   **Server TTS Module (`lib/tts.ts`):** `generateSpeechFile()` — splits text into ≤200-char chunks, fetches audio from Google Translate TTS endpoint via `google-tts-api`, concatenates MP3 buffers, and writes the file. Strips HTML/markdown before synthesis.
*   **Pedagogical Engine (`lib/ai/pedagogicalEngine.ts`):** `getPedagogicalModeConfig()` — returns tailored system/user prompts for each of the 6 learning modes (Accelerated Notes, Socratic Method, ELI5 Simplifier, Roadmap Generator, Concept Mapper, Exam Crammer).
*   **Web Scraper (`lib/scraper.ts`):** `getReferenceContext()` — fetches Wikipedia extracts in parallel (top 2 results) or scrapes a user-supplied URL for RAG context. Includes SSRF guard blocking private IP ranges.

### B. Frontend App (`/frontend/src`)
*   **Public Landing Pages (`app/`):** Premium Home, About, and Contact layouts with hydration protection navbar gates.
*   **Study Dashboard (`app/dashboard/page.tsx`):** Displays active roadmaps, onboarding pathways, and study notes history.
*   **Workspace Canvas (`app/workspace/page.tsx`):** Coordinates layouts, highlights sentences, and loads active session queries.
*   **Global State Store (`store/workspaceStore.ts`):** Unified Zustand store matching token states, histories, playbacks, and active topics.
*   **Mermaid Flowcharts Renderer (`components/Document/Mermaid.tsx`):** Captures SVG graphs and programmatically scrubs AI syntax hallucinations (such as `-->|label|`).
*   **SSO Handoff Client (`lib/ssoHandoff.ts`):** `redirectToApp(app, topic?)` — calls `/api/sso/handoff` and redirects the browser to the target sibling app. `appForIntent(label)` maps AI intent labels to app names. Used by the AI Tutor chat and workspace header shortcuts.
*   **PDF Export (`lib/exportPdf.ts`):** `exportNotesPdf({ content, topicTitle, dayNumber, difficulty })` — pure jsPDF text renderer (no html2canvas) that reads directly from the `generatedContent` JSON and produces an A4 PDF with: branded dark header + footer on every page, diagonal "EdLearn" watermark at 4 % opacity, styled headings/paragraphs/bullet lists, monospaced code blocks with language labels, auto page-breaks, and file saved as `edlearn_dayN_topic.pdf`.

---

## 3. Development Roadmap (Sprint 2 - 4)

### 📅 Sprint 2: Double-Pass Review, Forum Hardening & Core Auth (Completed)
*   **Double-Pass Review Heuristic:** Enhanced `/api/generate` to pass generated notes back into the LLM, auditing alignment, correcting logic leaps, and validating raw citation tags before client return. (Completed)
*   **Market-Demand LinkedIn/GitHub Cron:** Setup background cron runners to scrape repository/job trends, saving hot keywords to MongoDB to populate trending skill widgets. (Completed)
*   **Upvote Badges & Community Ranks:** Implemented badges ("Top Helper", "Active Contributor", etc.) in Mongoose query results based on dynamic Q&A upvote calculations. (Completed)
*   **Full JWT Authentication & Crypto Hashing:** Added password hashing (secure PBKDF2), auth middleware guards, and Change Password dialog modals. (Completed)
*   **Premium Portals:** Added Landing, About, and Contact pages with hydration safety. (Completed)

### 📅 Sprint 3: Redis Caches, Notes History, and local PDF embeds (In Progress)
*   **Redis Caching Integration:** Added cache-through checking on notes generations matching `notes:${topic}:${difficulty}` signatures to bypass scraping and LLM costs. (Completed)
*   **Active Roadmap Redis Persistence:** Stores the user's current study roadmap selection inside Redis. Auto-restores their session upon workspace mount and page refreshes. (Completed)
*   **Study Guides Version Swapping:** Created version history select dropdowns inside the study canvas, mapping chronological logs to the database. (Completed)
*   **Local PDF Embeddings:** ~~Integrate `Transformers.js` (`all-MiniLM-L6-v2`) in the frontend to split and vectorize uploaded PDF files inside browser worker threads, storing vectors locally in `LanceDB`/`IndexedDB` for client-side search query retrievals.~~ *(Scope changed — replaced by the server-side PDF export feature below.)*
*   **Branded PDF Export:** Implemented a pure-jsPDF export engine (`lib/exportPdf.ts`) that renders study notes directly from the structured `generatedContent` JSON — bypassing html2canvas entirely to avoid Tailwind v4 `oklch`/`lab` CSS parsing errors. Output: A4 PDF with dark header/footer, diagonal watermark, styled sections, and monospaced code blocks. Download button in `LivingDocument.tsx` shows a spinner during export. (Completed)

### 📅 Sprint 4: Enterprise Scale, Server TTS & Kubernetes
*   **BullMQ Background Worker Integration:** Configure BullMQ with Redis to offload heavy server-side scrapers.
*   **Server-Side Edge TTS Generator:** Build backend routes using `edge-tts` to generate high-fidelity male/female audio speech, calculate token boundaries, and upload the static files to Cloudflare R2 storage.
*   **ElevenLabs API integration:** Replace Edge TTS with ElevenLabs Turbo endpoints to stream high-fidelity voice cloned dialogue in "Duo Podcast" conversational study modes.
*   **Docker & Kubernetes Deployments:** Containerize backend and frontend services inside Dockerfiles, mapping cluster workloads to AWS EKS or GCP GKE load balancers.

---

## 4. Security Hardening Log (Applied — feature/optimizationfeatureadd branch)

All fixes applied to `backend/src/index.ts`, `lib/scraper.ts`, `lib/tts.ts`, `lib/mongodb.ts`, and `lib/auth.ts`:

*   **SEC-1 — Secrets scrubbed from `.env`:** All live API keys, DB credentials, JWT secret, and SSO secret replaced with labelled placeholders. `.env.example` updated with generation commands.
*   **SEC-2 — Rate limiting (`express-rate-limit`):** `authLimiter` (10 req / 15 min) on `/auth/signup` and `/auth/login`; `aiLimiter` (30 req / min) on `/generate`, `/facts`, `/assistant/classify`. Returns HTTP 429.
*   **SEC-3 — SSRF guard:** `isPrivateUrl()` in `lib/scraper.ts` blocks localhost, 127.x, 10.x, 192.168.x, 172.16–31.x, and the AWS/GCP metadata IP before any HTTP request is dispatched. Unparseable URLs also blocked.
*   **SEC-4 — IDOR fix (Doubt Forum):** `POST /api/doubt` no longer reads `userId` from `req.body`. Always uses `(req as AuthenticatedRequest).user!.id` from the verified JWT.
*   **SEC-5 — IDOR fix (`/api/topic`):** `GET /api/topic` now joins through `day → roadmap.userId` and returns HTTP 403 if the requesting user does not own the day.
*   **SEC-6 — Credential logging removed:** `connectMongo()` no longer logs the full MongoDB URI (including password) to stdout.
*   **LOOP-1 — Password strength:** Signup rejects passwords shorter than 8 chars or missing at least one letter and one digit.
*   **LOOP-2 — `availableTime` clamping:** Both `update` and `create` paths in `PATCH /api/profile` clamp `availableTime` to `[1, 480]` minutes. NaN inputs fall back to 45.
*   **LOOP-3 — TTS HTML stripping:** `generateSpeechFile()` strips HTML tags, markdown punctuation, and markdown link syntax before synthesis.
*   **LOOP-4 — Wikipedia timeout:** `WIKI_HEADERS` in `lib/scraper.ts` now includes `timeout: 8000` to prevent indefinite hangs on slow Wikipedia responses.
*   **PERF-2 — Cache key safety:** `/api/generate` cache key coerces `topic` and `difficulty` through `String(...)` before calling `.toLowerCase()` to prevent runtime crashes on non-string body values.
