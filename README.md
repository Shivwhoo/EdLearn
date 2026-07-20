# EdLearn 🎓
### Smart Learning Path, AI-Powered Study Assistant & Duo Podcast

EdLearn is a full-stack, decoupled AI learning platform that generates personalized structured study paths for any educational goal. It crawls real-time reference contexts (RAG), generates premium study notes across **7 different pedagogical modes** (including a multi-voice Duo Podcast mode), and features an interactive discussion board, background market trend scrapers, and a highly scalable containerized architecture.

---

## 🏗️ System Architecture & Technology Stack

The platform is designed with a highly scalable, cloud-agnostic architecture:

*   **Frontend Client (`/frontend`):** Built with Next.js 14 (App Router), React, Tailwind CSS, Zustand global state management, and `jsPDF` for branded PDF exports.
*   **Backend Server (`/backend`):** Powered by Node.js, Express, and TypeScript. Handles pedagogical logic, TTS (Text-to-Speech) audio stitching, web scraping (Puppeteer), BullMQ background workers, and database persistence.
*   **Database Stack:**
    *   **PostgreSQL:** Relational database mapped via Prisma ORM for strictly tracking users, roadmaps, and topic histories.
    *   **MongoDB:** Document database managed via Mongoose for storing unstructured metrics like background-scraped market demand skill trends.
    *   **Redis:** Caches API requests (dashboard stats, generated notes), maintains active roadmap sessions (30-day TTL), and powers the robust BullMQ job queue.

---

## ⚡ Port Configuration Details

> [!IMPORTANT]
> To prevent port collisions with native Windows PostgreSQL services running on the host machine (which commonly occupy port `5432`), the PostgreSQL Docker container is configured to bind to host port **`5434`**:
> - Docker container maps: `5434 -> 5432`
> - Database URL is configured as: `postgresql://postgres:postgres@localhost:5434/edlearn?schema=public`

---

## 🚀 Getting Started

There are two ways to run the stack. Pick one — **don't mix them**.

---

### Mode A — Local Dev (recommended for active development)

Run only the infrastructure in Docker, and the app servers natively with hot-reload.

**1. Start infrastructure containers**
```bash
docker-compose up -d redis postgres mongodb
```

**2. Set up your `.env` in the project root**
```env
# AI Service Provider: GROQ | GEMINI
AI_PROVIDER=GEMINI

# API Keys
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key

# Databases — use localhost because the app runs on the host
DATABASE_URL="postgresql://postgres:postgres@localhost:5434/edlearn?schema=public"
MONGODB_URI="mongodb://localhost:27017/edlearn"
REDIS_URL="redis://localhost:6379"

FRONTEND_URL="http://localhost:3000"
JWT_SECRET=your_jwt_secret
```

> [!NOTE]
> PostgreSQL is mapped to host port **`5434`** (not `5432`) to avoid conflicts with any native Postgres installation you may have running on Windows.

**3. Run the app servers (two separate terminals)**
```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

- Frontend → `http://localhost:3000`
- Backend  → `http://localhost:5000`

---

### Mode B — Full Docker

Runs everything (app + infra) in containers. Good for staging / demos.

**1. Build and start all containers**
```bash
docker-compose up --build -d
```

The `docker-compose.yml` automatically overrides the DB URLs for the backend container to use Docker service names (`redis`, `postgres`) instead of `localhost`. **You do not need to change your `.env`.**

```env
# Databases — set these to localhost values in .env (Docker overrides them internally)
DATABASE_URL="postgresql://postgres:postgres@localhost:5434/edlearn?schema=public"
REDIS_URL="redis://localhost:6379"
```

> [!IMPORTANT]
> Inside Docker, containers communicate via service names, not `localhost`. The `docker-compose.yml` injects `REDIS_URL=redis://redis:6379` and `DATABASE_URL=postgresql://postgres:postgres@postgres:5432/edlearn` as environment overrides for the backend service — so your `.env` stays valid for local dev simultaneously.

**2. Verify all 5 containers are running**
```bash
docker ps
```

- Frontend → `http://localhost:3000`
- Backend  → `http://localhost:5000`

**View live logs:**
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

---

## 📖 Features & User Experience

- **Custom Onboarding:** Users specify career goals, daily availability, and current skill level to generate custom roadmaps.
- **7 Pedagogical Learning Modes:** 
  - Standard Premium Notes
  - Skill Accelerator (80/20 Pareto)
  - Socratic Practice Scenarios
  - Physical Analogies
  - Knowledge Gap Finders
  - Feynman Adversarial Tests
  - **Duo Podcast (Mode 7):** An AI Host and Expert converse about the topic, stitched together dynamically with two different text-to-speech accents (`en-US` and `en-GB`).
- **RAG-augmented Note Generation:** Gathers context from online sources via Puppeteer, processes them through the LLM, and embeds verified citations into the final JSON output.
- **Branded PDF Exports:** Download your generated study notes locally as polished PDFs containing dynamic watermarks, headers, and footers.
- **Market Trend Scrapers:** BullMQ workers run in the background every 6 hours, scraping GitHub and LinkedIn to show students the hottest programming skills on their dashboard.

---

## ☸️ Kubernetes (K8s) Deployment

The repository includes a complete suite of standard Kubernetes manifests located in the `/k8s` directory.

1. **Namespaces & Config:** Creates the `edlearn` namespace and ConfigMaps.
2. **Deployments & Services:** Spins up minimum 2 replicas for both the frontend and backend to ensure high availability. The backend includes a native `/api/health` probe for automated liveness tracking.
3. **Ingress:** An NGINX Ingress controller configuration is provided to seamlessly route traffic between `/api/*` (backend) and `/*` (frontend).

To deploy:
```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/backend/
kubectl apply -f k8s/frontend/
kubectl apply -f k8s/ingress.yaml
```
