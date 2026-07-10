# EdLearn 🎓
### Smart Learning Path & AI-Powered Study Assistant

EdLearn is a full-stack, decoupled AI learning platform that generates personalized structured study paths for any educational goal. It crawls real-time reference contexts (RAG), generates premium study notes, and features an interactive discussion board and a sentence-by-sentence text-to-speech audio reader.

---

## 🏗️ System Architecture & Technology Stack

The platform is designed with a decoupled architecture:

*   **Frontend Client (`/frontend`):** Built with Next.js 15 (App Router), React, Tailwind CSS v4, and Zustand global state management.
*   **Backend Server (`/backend`):** Powered by Node.js, Express, and TypeScript. Handles pedagogical logic, course roadmap generation, web scraping, and database persistence.
*   **Database Stack:**
    *   **PostgreSQL:** Relational database mapped via Prisma 7 ORM for tracking users, roadmaps, and topic completions.
    *   **MongoDB:** Document database managed via Mongoose for storing structured discussion board threads and scraped market demand skill trends.
    *   **Redis:** Configured for semantic query caching and background queuing (BullMQ).

---

## ⚡ Port Configuration Details

> [!IMPORTANT]
> To prevent port collisions with native Windows PostgreSQL services running on the host machine (which commonly occupy port `5432`), the PostgreSQL Docker container is configured to bind to host port **`5434`**:
> - Docker container maps: `5434 -> 5432`
> - Database URL is configured as: `postgresql://postgres:postgres@localhost:5434/edlearn?schema=public`

---

## 🚀 Getting Started

Follow these steps to run the complete stack locally.

### Prerequisites
- Node.js (v18+)
- Docker and Docker Compose

### 1. Database Setup (Docker)
From the root workspace directory, spin up PostgreSQL, MongoDB, and Redis containers in the background:
```bash
docker-compose up -d
```
You can verify the containers are active by running `docker ps`.

### 2. Configure Environment Variables
Verify or create `.env` files in both the **root** folder and the **`/backend`** folder with the following variables:
```env
# AI Service Provider: GROQ | GEMINI
AI_PROVIDER=GROQ

# API Keys
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key

# Databases
DATABASE_URL="postgresql://postgres:postgres@localhost:5434/edlearn?schema=public"
MONGODB_URI="mongodb+srv://<username>:<password>@cluster.mongodb.net/edlearn"
```

### 3. Initialize & Run the Backend
Navigate to the `/backend` directory, synchronize the Prisma schema, and start the development server:
```bash
cd backend
npm install
npx prisma db push
npm run dev
```
*The backend server will run on `http://localhost:5000`.*

### 4. Run the Frontend
Navigate to the `/frontend` directory and start the client application:
```bash
cd frontend
npm install
npm run dev
```
*The client app will be accessible at `http://localhost:3000`.*

---

## 📖 Features & User Experience

- **Custom Onboarding:** Users specify career goals, daily availability, and current skill level to generate custom roadmaps.
- **Personalized 5-Day Roadmap:** Generates daily modular learning nodes tailored to your availability.
- **RAG-augmented Premium Study Notes:** Gathers context from online sources, processes them through a double-pass review validator (checking for logical leaps, correctness, and citations), and displays formatted study sheets.
- **Sentence-Synced Audio Player:** A built-in text-to-speech player synchronizes with the document text. You can click any sentence in the study notes to start playing audio directly from that location.
- **Doubt Forums:** Community discussion boards where users ask questions, upvote comments, and earn help badges ("Top Responder", "Active Contributor", etc.).

---

## 🛠️ Current Status Note
> [!NOTE]
> **Pedagogical modes** (Socratic quiz, physical analogies, Pareto accelerator guides) are currently **suspended** to prioritize serving direct, comprehensive, high-quality technical study notes with detailed code examples.
