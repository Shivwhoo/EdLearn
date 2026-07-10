# EdLearn: Project Context & Sprint 2-4 Developer Blueprint

This file serves as the definitive reference and status report for **EdLearn**'s architecture, configurations, and roadmap up to Sprint 4.

---

## 1. System Architecture State

EdLearn is designed as a decoupled full-stack application:

*   **Frontend Client (`/frontend`):** Next.js 15 (App Router), React, Tailwind CSS v4, and Zustand state managers. Listens on `http://localhost:3000`.
*   **Backend Server (`/backend`):** Node.js + Express + TypeScript. Handles core RAG execution, PostgreSQL data storage (via Prisma 7), and discussion boards (via Mongoose and MongoDB). Listens on `http://localhost:5000`.
*   **Database Stack:** Configured in `docker-compose.yml` to spin up PostgreSQL (port 5434), MongoDB (port 27017), and Redis (port 6379) in separate containers.

---

## 2. Core Modules & Code Mapping

### A. Backend Services (`/backend/src`)
*   **API Routes (`index.ts`):** 
    *   `POST /api/roadmap` - Generates a 5-day structured timeline for a goal and schedules day modules.
    *   `POST /api/generate` - Runs RAG queries, builds pedagogical mode prompts, audits content in a double-pass review, and outputs structured JSON notes.
    *   `GET /api/doubt` & `POST /api/doubt` - Manages forum threads, comment upvotes, and calculates user badges/ranks.
    *   `GET /api/market-demand` - Serves scraped GitHub and LinkedIn trends.
*   **AI Service Abstraction (`lib/ai/`):**
    *   [`aiService.ts`](file:///c:/Users/shiva/Desktop/internship/EdLearn/backend/src/lib/ai/aiService.ts) - Unified provider selector routing requests to `Groq` or `Gemini`.
    *   [`providers/groqProvider.ts`](file:///c:/Users/shiva/Desktop/internship/EdLearn/backend/src/lib/ai/providers/groqProvider.ts) - Implements Llama-3.3-70B model requests and stream conversion.
    *   [`providers/geminiProvider.ts`](file:///c:/Users/shiva/Desktop/internship/EdLearn/backend/src/lib/ai/providers/geminiProvider.ts) - Implements Gemini-1.5-Flash model requests.
    *   [`pedagogicalEngine.ts`](file:///c:/Users/shiva/Desktop/internship/EdLearn/backend/src/lib/ai/pedagogicalEngine.ts) - Prompt constructors for the 6 learning modes.
*   **Ground-Truth Scraper (`lib/scraper.ts`):** Real-time Axios & Cheerio scraper pulling from Wikipedia page extracts or arbitrary web links.
*   **Relational Database Client (`lib/db.ts`):** Prisma 7 client initialization integrated with `@prisma/adapter-pg` and PostgreSQL connection pooling.
*   **Document Database Client (`lib/mongodb.ts`):** Mongoose connection helper with serverless route caching.

### B. Frontend App (`/frontend/src`)
*   **Onboarding (`app/page.tsx`):** Glassmorphic form collecting name, career goals, daily availability, and level metrics to initialize courses.
*   **Workspace Dashboard (`app/workspace/page.tsx`):** Coordinates layout grids, progress loaders, and page routing.
*   **Global State Store (`store/workspaceStore.ts`):** Unified Zustand store syncing selected daily outlines, active modes, Socratic attempts, simplifier unlocks, and playback states.
*   **Highlighted Text Reader (`components/Audio/AudioPlayerDock.tsx`):** Browser-native Speech Synthesis audio player syncing text highlighted spans during playback.
*   **Notes Canvas (`components/Document/LivingDocument.tsx`):** Adaptive rendering layouts representing checklists, locked simplifiers, timeline roadmaps, Socratic panels, and gap audits.
*   **Doubt Forum & AI Chat (`components/Layout/InteractiveAssistant.tsx`):** Collapsible right-hand side panels displaying chat inputs, nested Q&A replies, and user achievement badges.

---

## 3. Development Roadmap (Sprint 2 - 4)

### 📅 Sprint 2: Double-Pass Review & Forum Hardening (Completed)
*   **Double-Pass Review Heuristic:** Enhanced `/api/generate` to pass generated notes back into the LLM, auditing alignment, correcting logic leaps, and validating raw citation tags before client return. (Completed)
*   **Market-Demand LinkedIn/GitHub Cron:** Setup background cron runners to scrape repository/job trends, saving hot keywords to MongoDB to populate trending skill widgets. (Completed)
*   **Upvote Badges & Community Ranks:** Implemented badges ("Top Helper", "Active Contributor", etc.) in Mongoose query results based on dynamic Q&A upvote calculations. (Completed)

### 📅 Sprint 3: Server TTS, Semantic Caching & Local PDF RAG (Next Step)
*   **BullMQ Background Worker Integration:** Configure BullMQ with Redis to offload heavy server-side scrapers and TTS audio renders.
*   **Server-Side Edge TTS Generator:** Build backend routes using `edge-tts` to generate high-fidelity male/female audio speech, calculate token boundaries, and upload the static files to Cloudflare R2 storage.
*   **Redis Semantic Query Cache:** Configure a semantic cache wrapper checking for semantically similar queries before calling Groq/Gemini to keep API cost at $0.
*   **Local PDF Embeddings:** Integrate `Transformers.js` (`all-MiniLM-L6-v2`) in the frontend to split and vectorize uploaded PDF files inside browser worker threads, storing vectors locally in `LanceDB`/`IndexedDB` for client-side search query retrievals.

### 📅 Sprint 4: Enterprise Scale & Cloned Audio
*   **Claude 3.5 Sonnet Integration:** Update `AIService` constructor parameters to easily swap fallback providers to Anthropic Claude 3.5 APIs for advanced multi-step logic.
*   **ElevenLabs API integration:** Replace Edge TTS with ElevenLabs Turbo endpoints to stream high-fidelity voice cloned dialogue in "Duo Podcast" conversational study modes.
*   **Docker & Kubernetes Deployments:** Containerize backend and frontend services inside Dockerfiles, mapping cluster workloads to AWS EKS or GCP GKE load balancers.
