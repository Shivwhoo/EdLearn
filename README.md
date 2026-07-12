# EdLearn 🎓
### Smart Learning Path, AI-Powered Study Assistant & Duo Podcast

EdLearn is a full-stack, decoupled AI learning platform that generates personalized structured study paths for any educational goal. It crawls real-time reference contexts (RAG), generates premium study notes across **7 different pedagogical modes** (including a multi-voice Duo Podcast mode), and features an interactive discussion board, background market trend scrapers, and a highly scalable containerized architecture.

---

## 🏗️ System Architecture & Technology Stack

The platform is designed with a highly scalable, cloud-agnostic architecture:

*   **Frontend Client (`/frontend`):** Built with Next.js 14 (App Router), React, Tailwind CSS, Zustand global state management, and `jsPDF` for branded PDF exports.
*   **Backend Server (`/backend`):** Powered by Node.js, Express, and TypeScript. Handles pedagogical logic, TTS (Text-to-Speech) audio stitching, web scraping (Puppeteer), BullMQ background workers, and database persistence.
*   **Database Stack:**
    *   **PostgreSQL:** Relational database mapped via Prisma ORM for strictly tracking users, roadmaps, topic histories, and forum threads.
    *   **MongoDB:** Document database managed via Mongoose for storing unstructured metrics like background-scraped market demand skill trends.
    *   **Redis:** Caches API requests (dashboard stats, generated notes), maintains active roadmap sessions (30-day TTL), and powers the robust BullMQ job queue.

---

## ⚡ Port Configuration Details

> [!IMPORTANT]
> To prevent port collisions with native Windows PostgreSQL services running on the host machine (which commonly occupy port `5432`), the PostgreSQL Docker container is configured to bind to host port **`5434`**:
> - Docker container maps: `5434 -> 5432`
> - Database URL is configured as: `postgresql://postgres:postgres@localhost:5434/edlearn?schema=public`

---

## 🚀 Getting Started (Docker / Local)

Follow these steps to run the complete stack locally using the new Dockerized setup.

### Prerequisites
- Node.js (v20+)
- Docker and Docker Compose

### 1. Database Setup & Full Stack Boot (Docker)
From the root workspace directory, spin up PostgreSQL, MongoDB, Redis, and the containerized Frontend/Backend applications:
```bash
docker-compose up --build -d
```
You can verify the 5 containers are active by running `docker ps`.
- The Frontend will be mapped to `http://localhost:3000`
- The Backend will be mapped to `http://localhost:5000`

### 2. Configure Environment Variables
Verify or create `.env` files in both the **root** folder and the **`/backend`** folder with the following variables:
```env
# AI Service Provider: GROQ | GEMINI
AI_PROVIDER=GEMINI

# API Keys
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key

# Databases (Used by backend)
DATABASE_URL="postgresql://postgres:postgres@postgres:5432/edlearn?schema=public"
MONGODB_URI="mongodb://mongodb:27017/edlearn"
REDIS_URL="redis://redis:6379"

# Frontend (Used by k8s/docker configmaps)
FRONTEND_URL="http://localhost:3000"
```

*(Note: If running the Node apps natively outside of Docker instead, make sure to change the hostnames in the DB URLs from `postgres`/`mongodb`/`redis` to `localhost` and map Postgres to port `5434`).*

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
- **Doubt Forums:** Community discussion boards where users ask questions, upvote comments, and earn help badges ("Top Responder", "Active Contributor", etc.). Fully integrated with JWT auth to prevent impersonation/IDOR.
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
