# EdLearn: Project Context & Sprint 2-4 Developer Blueprint

This file serves as the definitive reference and status report for **EdLearn**'s architecture, configurations, and roadmap.

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
    *   `POST /api/auth/signup` & `POST /api/auth/login` - Secure registration and token-based JWT authentication.
    *   `POST /api/auth/change-password` - Protected endpoint to verify and change password records.
    *   `POST /api/user/active-roadmap` - Caches the user's current roadmap selection in Redis.
    *   `GET /api/dashboard/summary` - Computes active roadmap progress metrics and logs notes history.
    *   `POST /api/roadmap` - Generates a structured study timeline and schedules day modules.
    *   `POST /api/generate` - Performs RAG, fetches Redis cache, evaluates pedagogical modes, and runs double-pass reviews.
    *   `GET /api/topic` - Returns chronological version logs for a specific day ID.
    *   `GET /api/doubt` & `POST /api/doubt` - Forum threads, comment upvotes, and badge calculations.
    *   `GET /api/market-demand` - Scraped GitHub and LinkedIn trending keywords.
*   **AI Service Abstraction (`lib/ai/`):**
    *   [`aiService.ts`](file:///c:/Users/shiva/Desktop/internship/EdLearn/backend/src/lib/ai/aiService.ts) - Unified provider selector routing requests to `Groq` or `Gemini`.
    *   [`providers/groqProvider.ts`](file:///c:/Users/shiva/Desktop/internship/EdLearn/backend/src/lib/ai/providers/groqProvider.ts) - Groq integration with fallback overrides.
    *   [`providers/geminiProvider.ts`](file:///c:/Users/shiva/Desktop/internship/EdLearn/backend/src/lib/ai/providers/geminiProvider.ts) - Google Generative AI integration.
*   **Redis Cache Wrapper (`lib/redis.ts`):** Handles client connections, set/get caches, and connection fail-safes.

### B. Frontend App (`/frontend/src`)
*   **Public Landing Pages (`app/`):** Premium Home, About, and Contact layouts with hydration protection navbar gates.
*   **Study Dashboard (`app/dashboard/page.tsx`):** Displays active roadmaps, onboarding pathways, and study notes history.
*   **Workspace Canvas (`app/workspace/page.tsx`):** Coordinates layouts, highlights sentences, and loads active session queries.
*   **Global State Store (`store/workspaceStore.ts`):** Unified Zustand store matching token states, histories, playbacks, and active topics.
*   **Mermaid Flowcharts Renderer (`components/Document/Mermaid.tsx`):** Captures SVG graphs and programmatically scrubs AI syntax hallucinations (such as `-->|label|`).

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
*   **Local PDF Embeddings:** Integrate `Transformers.js` (`all-MiniLM-L6-v2`) in the frontend to split and vectorize uploaded PDF files inside browser worker threads, storing vectors locally in `LanceDB`/`IndexedDB` for client-side search query retrievals.

### 📅 Sprint 4: Enterprise Scale, Server TTS & Kubernetes
*   **BullMQ Background Worker Integration:** Configure BullMQ with Redis to offload heavy server-side scrapers.
*   **Server-Side Edge TTS Generator:** Build backend routes using `edge-tts` to generate high-fidelity male/female audio speech, calculate token boundaries, and upload the static files to Cloudflare R2 storage.
*   **ElevenLabs API integration:** Replace Edge TTS with ElevenLabs Turbo endpoints to stream high-fidelity voice cloned dialogue in "Duo Podcast" conversational study modes.
*   **Docker & Kubernetes Deployments:** Containerize backend and frontend services inside Dockerfiles, mapping cluster workloads to AWS EKS or GCP GKE load balancers.
