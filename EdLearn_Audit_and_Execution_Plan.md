# EdLearn — Project Audit, Gap Analysis & 5-Member Execution Plan

Audit date: 2026-08-08. Branch audited: `feature/ui-improvements` (working tree has uncommitted changes against this branch — see Phase 1 note). Method: full manual read of backend routes/services/lib, Prisma schema, frontend pages/components/store, Docker/K8s manifests, and repository history. Where something could not be confirmed from static code (e.g., whether a third-party API key is live, whether the sibling apps EdMentor/EdCompass/EdQuiz actually exist and respond), it is explicitly marked **"Unable to verify — requires manual testing/information."**

---

## PHASE 1 — Repository State Snapshot

- **Stack (confirmed in code):** Next.js 16 (App Router) + React 19 + Tailwind v4 + Zustand on the frontend; Node/Express + TypeScript on the backend; PostgreSQL via Prisma 7; MongoDB via Mongoose (market-demand + content tables live in Postgres, not Mongo — see Phase 3); Redis for caching + BullMQ queues.
- **Git hygiene issue:** every tracked file in both `backend/src` and `frontend/src` currently shows as `modified` in `git status` — essentially the entire repository is uncommitted working-tree state on top of the last commit (`feat: add vision board`). There is no way to tell, from git history alone, which of the findings below are "new, in-progress work" versus "already-shipped and reverted." This audit describes the code as it sits on disk right now.
- **No automated tests exist.** A repo-wide search for `*.test.*` / `*.spec.*` under `backend/src` and `frontend/src` returns zero results (all matches are inside `node_modules`).
- **Documentation drift:** `context.md` (checked into the repo as the "definitive reference") describes several things that are no longer true of the code — most importantly a Doubt Forum / discussion board and applied rate-limiting that do not exist in `backend/src/index.ts` today (details in Phase 2/7). Treat `context.md` and `README.md` as aspirational/historical, not as ground truth.

---

## PHASE 2 — Feature Inventory

| Feature | Frontend | Backend | Database | API | AI | Testing | Status |
|---|---|---|---|---|---|---|---|
| Email/password signup, login, change password | ✅ | ✅ | ✅ | ✅ | — | 🔴 none | ✅ **COMPLETE** — PBKDF2-SHA512 (310k iter) hashing, JWT, ownership checks all trace end-to-end. |
| Google OAuth login | ✅ | ✅ (Passport strategy) | ✅ | ✅ | — | 🔴 none | 🧪 **IMPLEMENTED, NOT VERIFIABLE HERE** — code only registers the strategy if `GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL` are set; none of those are present in this repo's `.env`. Unable to verify — requires manual testing with real Google credentials. |
| Roadmap generation | ✅ | ✅ | ✅ | ✅ | ✅ real (Groq/Gemini) | 🔴 none | ✅ **COMPLETE** |
| Study notes — 6 pedagogical modes + double-pass review + RAG citations | ✅ | ✅ | ✅ | ✅ | ✅ real | 🔴 none | ✅ **COMPLETE** — genuinely calls Groq/Gemini twice per request (draft + audit pass), scrapes Wikipedia or a user URL for grounding, persists citations. |
| Duo Podcast (mode 7) | ✅ | ✅ | ✅ | ✅ | ✅ real | 🔴 none | ✅ **COMPLETE**, but the "two different TTS accents" promised in the README are simulated by passing `en` vs `en-GB` language codes to the same free Google Translate TTS endpoint (`google-tts-api`) — not two distinct voice models, and nowhere near the "ElevenLabs voice-cloned dialogue" described as a Sprint-4 goal in `context.md`. |
| Server-side TTS for regular notes | ✅ | ✅ | ✅ | ✅ | n/a | 🔴 none | 🟡 **PARTIALLY COMPLETE / FRAGILE** — works, but depends on an undocumented, keyless, free Google Translate endpoint wrapped by `google-tts-api`. No API key, no SLA, no error budget documented; the code's own comment admits the exact import shape was never verified against a live install ("this environment has no network access... to re-check it live"). |
| Branded PDF export | ✅ | — | — | — | — | 🔴 none | ✅ **COMPLETE** — pure jsPDF, no AI involved, works client-side from the same JSON the notes UI already has. |
| Dashboard summary (roadmaps, topics, badges, progress) + Redis cache | ✅ | ✅ | ✅ | ✅ | — | 🔴 none | ✅ **COMPLETE** |
| Day completion + course-completion badges | ✅ | ✅ | ✅ (Progress, Badge) | ✅ | — | 🔴 none | ✅ **COMPLETE** — correctly moved off localStorage-only tracking onto the `Progress` table, idempotent, ownership-checked. |
| Vision Board (goals CRUD) | ✅ | ✅ | ✅ | ✅ | — | 🔴 none | ✅ **COMPLETE** — full CRUD, server-side validation, ownership scoping on every route. The most solid feature in the codebase. |
| Market Demand / "Trending Skills" widget | ✅ | ✅ | ✅ (Mongo) | ✅ | — | 🔴 none | 🏗️ **HALF MOCK** — GitHub half genuinely calls the GitHub Search API. The **"LinkedIn" half is 100% hardcoded** (`DEFAULT_TRENDS` array in `cronScraper.ts`) with a `Math.random()` jitter applied every 6 hours to look like live movement. There is no LinkedIn scraping anywhere in the codebase, despite the README explicitly claiming "scraping GitHub and LinkedIn." There is also no Puppeteer anywhere in the codebase despite the README listing Puppeteer as the scraping engine — the real scraper (`lib/scraper.ts`) uses `axios` + `cheerio`. |
| News / Media / Books dynamic content | ✅ | ✅ | ✅ | ✅ | — | 🔴 none | 🟡 **PARTIALLY COMPLETE** — the fetchers are real integrations (NewsAPI, YouTube Data API v3, PodcastIndex, Google Books), each with sane exclusion filters and upsert logic. But every one of them silently no-ops if its API key is missing, and **none of `NEWS_API_KEY`, `YOUTUBE_API_KEY`, `PODCAST_INDEX_KEY/SECRET`, `BOOKS_API_KEY` are present in this repo's `.env`**, so on a fresh checkout these tables are likely empty and the landing/deep-dive pages show empty states. Unable to verify actual population — requires the real keys. |
| AI Tutor chat (`InteractiveAssistant.tsx`) | ✅ | ✅ (reuses `/api/generate`) | — | ✅ | ⚠️ real but misused | 🔴 none | ⚠️ **IMPLEMENTED BUT BROKEN** — this is the one feature that looks like a chat but isn't. Every message you type calls `/api/generate` with `mode: 1` (the Skill Accelerator notes generator) for `currentDay.title` — **the user's actual typed question is never sent to the model.** The "reply" shown is just `keystoneConcepts[0].description` sliced out of a freshly generated notes JSON. The code comment literally calls this "Simple mock fallback to prevent rate limits," but there is no real path — this mock IS the only path. |
| Intent classification + SSO handoff to EdMentor/EdCompass/EdQuiz | ✅ | ✅ | — | ✅ | ✅ real (constrained classification call) | 🔴 none | ✅ **COMPLETE on EdLearn's side.** The classifier call and the signed 90-second JWT handoff are real and well-guarded (separate `SSO_SHARED_SECRET`, short TTL). But the receiving half lives in three other repositories not present here, and the code's own comments say so explicitly. Unable to verify the full round trip — requires the sibling apps. |
| Hub page (cross-app mentor/compass/quiz status) | ✅ | — | — | — | — | 🔴 none | 🏗️ **MOCK/PLACEHOLDER** for 2 of 3 cards. `hasMentorSession` and `hasCompassResult` are hardcoded `false` with a code comment stating there is no real data to fetch yet; `SAMPLE_MENTOR_SESSION` / `SAMPLE_COMPASS_RESULT` exist only as dead sample objects gated behind those flags. This is done *honestly* (empty states, not fake data shown to users) but the feature itself is not implemented. |
| Discussion / Doubt Forum | 🔴 | 🔴 | 🔴 | 🔴 | — | 🔴 | 🔴 **NOT IMPLEMENTED** — `context.md` documents this as a *completed* Sprint-2 feature ("Full JWT Authentication... Upvote Badges & Community Ranks," IDOR fixes for `POST /api/doubt`), and the README's tagline promises "an interactive discussion board." None of it exists in the current code: no `/api/doubt` route, no `Doubt`/`Comment`/`Upvote` Prisma models, no forum UI. This is either a removed feature or the documentation was never updated — either way it's a real doc-vs-code mismatch worth resolving before quoting the README to anyone. |
| Subscriptions / billing | 🔴 | 🔴 | 🟡 (schema only) | 🔴 | — | 🔴 | 🔴 **NOT IMPLEMENTED** — `Subscription` model exists in `schema.prisma` (`stripeId`, `tier`, `status`, `expiresAt`) but there is zero Stripe SDK dependency, zero billing route, zero pricing/checkout UI anywhere in either package. The `credits` field on `User` (`@default(15)`) is also never read or decremented by any route. Dead schema. |
| Onboarding → profile persistence | ✅ | ✅ | ✅ | ✅ | — | 🔴 none | ✅ **COMPLETE** |
| Automated testing (unit/integration/e2e) | 🔴 | 🔴 | — | 🔴 | — | 🔴 | 🔴 **NOT IMPLEMENTED** — confirmed via full-repo glob for test files; no test runner in either `package.json`. |

---

## PHASE 3 — Gap Analysis

### 3.1 Functional / feature gaps
- Discussion/Doubt Forum is documented as shipped but absent from the code (see Phase 2).
- AI Tutor chat does not actually answer the user's question — it regenerates unrelated notes content (see Phase 2). This is the single most user-visible broken flow in the product, because it looks fully functional in the UI.
- Billing/subscription is schema-only; there is no way for a user to actually become a paying `PRO` tier user, and the `credits` counter on `User` is decorative.
- Market Demand "LinkedIn" data is fabricated, not scraped — a factual-accuracy risk if the widget's copy implies real market data.
- Hub page cannot show real mentor/compass data until the sibling apps expose an API — this is an external dependency, not something EdLearn's own team can close alone.

### 3.2 Frontend
- No dedicated "Settings" or "Account" page was found (change-password exists as a modal inside `LeftNavigationPanel.tsx`, not a full account page).
- `frontend/src/components/Landing/_to_delete/HeroSection.tsx` is dead code sitting in a `_to_delete` folder inside `src` — it will still be bundled/linted unless explicitly excluded; confirm before shipping.
- Signup page copy says "Must be at least 6 characters" (`signup/page.tsx`) while the backend actually enforces ≥8 characters with at least one letter and one digit (`LOOP-1` in `lib/auth.ts` is not actually enforced — see 3.3). Whichever is correct, the two disagree and will confuse users on validation failure.
- Loading/empty/error states: dashboard, hub, and vision-board pages all handle these reasonably; news/media/books pages were not fully traced for every edge case — recommend a UI pass (Phase 7/8 backlog).
- Accessibility: no ARIA audit was performed as part of this pass — flag for Member 1/5 (see accessibility skill recommendation at the end).

### 3.3 Backend
- **CORS is effectively disabled, not restricted.** `index.ts` computes an `allowedOrigins` array from `FRONTEND_URL` and logs it, but the actual `cors()` call passes `origin: true`, which reflects *any* request origin back with credentials enabled. The computed allowlist is dead code. The inline comment ("C3: Restrict CORS to configured frontend origin(s) only") describes intent that the code does not implement. This is a live security gap, not a documentation gap.
- **Rate limiting is not applied anywhere in the running server**, despite `express-rate-limit` being a declared dependency and `context.md`'s security log claiming `authLimiter` (10/15min) and `aiLimiter` (30/min) were added to `/auth/signup`, `/auth/login`, `/generate`, `/facts`, `/assistant/classify`. A full-text search of `backend/src/index.ts` shows zero uses of `rateLimit`/`Limiter`. Either this was reverted or the log is aspirational — as shipped, none of the auth or AI-cost endpoints are rate-limited, which is a real availability/cost risk (unlimited Groq/Gemini calls per IP).
- The password-strength rule described in `context.md` ("LOOP-1 — Signup rejects passwords shorter than 8 chars or missing at least one letter/digit") is **not enforced in `index.ts`** — the signup handler only checks that `email`, `password`, and `fullName` are present, with no length/composition check. This is another documented-but-missing control.
- `/api/generate`'s console logging of the full request body (`console.log("Request Body:", req.body)`) is left in place — noisy and, depending on log retention, a minor data-hygiene issue since it will include the raw `topic`/`url` a user submits.
- Frontend package.json unnecessarily depends on `@prisma/client`, `pg`, and `mongoose` — none of these are imported anywhere under `frontend/src` (confirmed via search); this is dead weight in the frontend bundle/install and should be removed.

### 3.4 Database
- Schema is coherent and relationships are sound (cascading deletes, correct foreign keys, sensible indexes on `Vision`, `NewsArticle`, `MediaContent`, `BookSummary`).
- `Subscription` and `credits` are unused by any route — dead schema (see 3.1).
- No migrations directory was found alongside `schema.prisma` in this snapshot — Unable to verify — requires checking whether `prisma migrate` history exists versus the project relying on `prisma db push`.
- MongoDB is used only for `MarketDemand`; everything else (including news/media/books, which the README's architecture section doesn't mention at all) lives in Postgres. The README's "MongoDB stores unstructured metrics" framing undersells/mismatches the current split.

### 3.5 AI — real vs. fake, explicitly
- **Real AI implementation:** `/api/generate` (all 7 modes), `/api/roadmap`, `/api/facts`, `/api/assistant/classify` all make genuine calls to Groq (`llama-3.3-70b-versatile` with an `llama-3.1-8b-instant` fallback chain and 429-aware backoff) or Gemini (`gemini-1.5-flash`), selected via `AI_PROVIDER`. Prompts are detailed, schema-constrained, and JSON-mode is used correctly. The double-pass review on `/api/generate` is a genuine second LLM call auditing the first, not decorative.
- **Fake/mock AI-adjacent implementation:** the AI Tutor chat (`InteractiveAssistant.tsx`) technically calls a real AI endpoint, but not for the purpose the UI implies — see 3.1. The Market Demand "LinkedIn" trends are not AI or scraping at all, just a static array with jitter.
- API keys are read from environment variables server-side only (never shipped to the client) — correct pattern. No hardcoded keys were found in source.
- No fallback behavior exists if **both** providers are unconfigured/fail beyond bubbling a 500 — acceptable for an MVP, but worth a friendlier degraded mode later.

### 3.6 Integrations
- Google OAuth: code-complete, credentials-not-configured-here — unverifiable.
- NewsAPI / YouTube Data API / PodcastIndex / Google Books: code-complete, credentials-not-configured-here — unverifiable, will silently no-op.
- SSO to EdMentor/EdCompass/EdQuiz: mint-side complete; receive-side out of repo — unverifiable.
- Stripe: absent entirely.
- Cloud storage (Cloudflare R2, mentioned as a Sprint-4 goal in `context.md` for TTS): absent; TTS files are written to local disk (`backend/tts-audio/`), which will not survive a stateless/multi-replica K8s deployment (see Phase 3.7) or an ephemeral container filesystem.

### 3.7 Security
- Password hashing: strong (PBKDF2-SHA512, 310k iterations), with a documented legacy-hash fallback for old accounts — good.
- JWT: fails fast if `JWT_SECRET` is unset (good pattern), 7-day expiry, no refresh-token rotation (acceptable for current scope).
- IDOR protections are genuinely present and correct on `/api/topic`, `/api/progress/complete`, `/api/tts/generate`, and all of `visionBoard.ts` — every query is scoped through an ownership join, not a client-supplied `userId`. This is a real strength of the codebase.
- SSRF guard on the scraper (`isPrivateUrl`) correctly blocks loopback/RFC-1918/cloud-metadata ranges before any user-supplied URL is fetched.
- CORS: broken as described in 3.3 — currently permits any origin.
- Rate limiting: absent as described in 3.3.
- `.env` files are correctly gitignored and are **not** committed to the repository (verified against `git ls-files`) — good.
- JWT is stored in `localStorage` (`edlearn_token`) rather than an httpOnly cookie, which is a standard XSS-exfiltration tradeoff for SPA/JWT designs — acceptable but worth naming explicitly as an accepted risk rather than an oversight.
- K8s: `configmap.yaml` only carries `NODE_ENV`, `PORT`, `FRONTEND_URL`. **None of `DATABASE_URL`, `JWT_SECRET`, `SSO_SHARED_SECRET`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `MONGODB_URI`, `REDIS_URL` are wired into `k8s/backend/deployment.yaml`** — the deployment's own comment admits this ("Optional: Add Secret reference for DATABASE_URL, REDIS_URL, etc."). As configured today, the backend pod would crash on boot in a real cluster, because `lib/auth.ts` and `lib/sso.ts` both `throw` fatally if `JWT_SECRET`/`SSO_SHARED_SECRET` are missing. This is a concrete, verified deployment blocker, not a hypothetical.

### 3.8 Testing
- Zero unit tests, zero integration tests, zero API tests, zero frontend component tests, zero E2E tests exist anywhere in the first-party code.
- Manual testing has clearly happened (the code is functional and iterative comments reference real bugs fixed), but nothing is codified/repeatable.

---

## PHASE 4 — Project Health Report

**Overall completion estimate: ~58%**

This is calculated as a weighted read of "does the core learning loop work end-to-end for a real user, on this exact code, today" — not a count of files or pages that exist.

| Category | Estimate | Basis |
|---|---|---|
| Frontend | 70% | Every core page renders and wires to a real API; the AI Tutor chat and Hub cross-app cards are the main non-functional/placeholder surfaces; no accessibility audit done; some dead code (`_to_delete`) still present. |
| Backend | 65% | Core routes (auth, roadmap, generate, dashboard, progress, vision-board, tts) are genuinely solid and well-guarded. Docked hard for the CORS bypass, missing rate limiting, and the missing Doubt Forum that documentation claims exists. |
| Database | 80% | Schema is clean and relationships are correct; docked for two fully unused models (`Subscription`, and `credits` field) and no visible migration history to review. |
| APIs | 65% | Same basis as backend, plus: several content integrations (news/media/books/YouTube/OAuth) are code-complete but unverifiable without live keys — treated as "at risk," not "working," until proven. |
| AI | 75% | The core pedagogical generation pipeline is real, well-prompted, and double-reviewed — genuinely the strongest part of the project. Docked hard because the one AI *chat* surface (the Tutor) is non-functional as a chat. |
| Authentication | 80% | Email/password + Google OAuth (code-complete) + JWT + IDOR discipline are all solid. Docked for the missing password-strength enforcement and unverifiable OAuth. |
| Testing | 0% | No tests exist anywhere. |
| Deployment | 40% | Docker Compose (local/full modes) is coherent and documented; Kubernetes manifests exist but are currently non-functional as written because secrets are never injected into the backend deployment. |
| Documentation | 45% | README and `context.md` are detailed and well-written, but materially out of date in at least three places (Doubt Forum, rate limiting, password strength) — a reader would reasonably believe the project is more complete/secure than it is. |

Do **not** read the frontend's 70% as "the app basically works" — a first-time user hitting the AI Tutor chat or the Hub page will see functioning UI wrapped around either a broken behavior or an honest placeholder, and a production deploy to Kubernetes as configured today will not boot.

---

## PHASE 5 — Prioritized Backlog

| Priority | Task | Reason | Dependencies | Est. Effort |
|---|---|---|---|---|
| P0 | Fix CORS: replace `origin: true` with the already-computed `allowedOrigins` allowlist logic | Currently any website can make credentialed requests against a logged-in user's session | None | 1–2 hrs |
| P0 | Apply `express-rate-limit` to `/auth/signup`, `/auth/login`, `/generate`, `/facts`, `/assistant/classify` | Dependency is already installed; endpoints currently have zero abuse/cost protection | None | 3–4 hrs |
| P0 | Wire real secrets (`DATABASE_URL`, `JWT_SECRET`, `SSO_SHARED_SECRET`, `GROQ_API_KEY`, etc.) into a K8s `Secret` + reference it from `backend/deployment.yaml` | Backend pod cannot currently boot in a cluster deployment | K8s access to create Secrets | 2–4 hrs |
| P0 | Decide the fate of the AI Tutor chat: either wire the user's actual message into a real conversational prompt, or relabel/redesign the UI so it doesn't imply a chat that isn't happening | Currently the single most misleading feature in the product | AI service (already exists) | 1–2 days |
| P0 | Enforce signup password strength server-side (length + composition) and fix the mismatched frontend copy | Documented as done, not present; weak passwords currently accepted | None | 1–2 hrs |
| P1 | Reconcile `context.md`/README against reality: remove or re-scope the Doubt Forum claim, the Puppeteer claim, the "scraping GitHub and LinkedIn" claim, the rate-limiting claim | Prevents future engineers (and this exact kind of audit) from trusting stale docs | None | 2–3 hrs |
| P1 | Either build the Doubt Forum for real or formally drop it from the roadmap | Currently a documented, non-existent feature | Schema design + new routes + UI | 3–5 days |
| P1 | Move TTS output off local container disk to shared/object storage (or accept single-replica constraint explicitly) | `backend/tts-audio/` will not survive a multi-replica K8s deployment or container restart | Storage decision (R2/S3/volume) | 1–2 days |
| P1 | Add a minimal automated test suite: auth flow, `/api/generate` happy-path with a mocked AI provider, ownership/IDOR checks on vision-board and tts routes | Zero coverage today; regressions currently only caught manually | Test runner choice | 3–5 days initial |
| P1 | Verify all "unverifiable" integrations (Google OAuth, NewsAPI, YouTube, PodcastIndex, Google Books) with real keys in a staging environment | Cannot currently confirm these work at all beyond "the code compiles" | Real API keys | 1 day |
| P2 | Remove unused frontend dependencies (`@prisma/client`, `pg`, `mongoose`) and dead `_to_delete` component | Bundle hygiene | None | 1 hr |
| P2 | Decide on Subscription/credits: implement Stripe for real, or drop the schema | Dead schema currently confuses "what does this app monetize" | Product decision | Depends on scope |
| P2 | Full accessibility (WCAG 2.1 AA) and design-consistency pass | Not evaluated in this audit | None | 2–3 days |
| P3 | Replace the free/unofficial Google Translate TTS dependency with a supported provider (Edge-TTS or a paid TTS API) per the original Sprint-4 intent | Current TTS has no SLA and could break without notice | Provider choice + budget | 2–3 days |
| P3 | Confirm Prisma migration history / adopt `prisma migrate` if the project is currently on `db push` | Unable to verify from this snapshot | None | 0.5 day investigation |

---

## PHASE 6 & 7 — Team Structure & Member-Wise Task Breakdown

The suggested 5-role split fits this codebase well, with one adjustment: because the single most valuable near-term work is *security/config remediation* (CORS, rate limiting, K8s secrets) rather than new database schema work, Member 3's scope is framed as "Platform Security & Deployment Config" rather than pure "Database/Auth," and Member 5 absorbs the missing-tests gap as its primary deliverable rather than a secondary one.

### Member 1 — Frontend / UI
**Responsibility:** Everything the student sees and clicks, and making sure it never lies about its own state.
**Tasks**
- Fix or redesign the AI Tutor chat UX once Member 4 decides the backend contract (P0).
- Fix signup password-copy mismatch; add client-side validation matching the real server rule (P0, pairs with Member 3's server fix).
- Remove dead code (`components/Landing/_to_delete/`).
- Full loading/empty/error state pass across news/media/books/dashboard/hub.
- Accessibility (WCAG 2.1 AA) pass — use the `design:accessibility-review` skill if available in your tooling.
- Remove unused frontend dependencies (`@prisma/client`, `pg`, `mongoose`) from `frontend/package.json`.
**Files/Directories:** `frontend/src/app/**`, `frontend/src/components/**`
**Dependencies:** Needs Member 4's decision on the Tutor chat's real request/response contract before rebuilding that component; needs Member 3's server-side password rule to match copy against.
**Deliverables:** No known-broken UI flows left unlabeled; no dead code; passing accessibility checklist.
**Definition of Done:** Every page has a defined loading/empty/error state; AI Tutor either genuinely answers the typed question or is clearly relabeled; no console errors on a clean run-through of signup → onboarding → dashboard → workspace → hub → vision-board.
**Priority:** P0 (Tutor chat, password copy) / P2 (rest)
**Estimated Effort:** 4–6 days

### Member 2 — Backend / APIs
**Responsibility:** Express routes, business logic, request validation, error handling.
**Tasks**
- Rebuild `InteractiveAssistant`'s backend contract: a real conversational endpoint that takes the user's actual message + `currentDay.title` as context (coordinate with Member 4 on the AI call itself).
- Enforce signup password strength server-side (P0).
- Remove the verbose `console.log` of full request bodies in `/api/generate`.
- Decide and implement the Doubt Forum (new routes + schema, coordinate with Member 3) or formally strike it from scope.
- Reconcile Subscription/credits: either implement or remove.
**Files/Directories:** `backend/src/index.ts`, `backend/src/routes/**`
**Dependencies:** Needs Member 3 for any new Prisma models (Doubt Forum, Subscription); needs Member 4 for the Tutor's AI prompt design.
**Deliverables:** A real chat endpoint; enforced password policy; no dead/misleading logging.
**Definition of Done:** Every route documented in the README/`context.md` either exists and is tested, or is removed from the docs; no route claims a behavior it doesn't have.
**Priority:** P0
**Estimated Effort:** 4–6 days

### Member 3 — Platform Security, Database & Deployment Config
**Responsibility:** Everything that decides whether this app is safe and bootable outside a developer's laptop.
**Tasks**
- Fix CORS: swap `origin: true` for the existing `allowedOrigins` array (P0).
- Apply `express-rate-limit` to the five endpoints named in `context.md`'s own security log (P0).
- Create a K8s `Secret` for `DATABASE_URL`, `JWT_SECRET`, `SSO_SHARED_SECRET`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `MONGODB_URI`, `REDIS_URL`, and reference it via `envFrom.secretRef` in `k8s/backend/deployment.yaml` (P0).
- Decide TTS file storage strategy for multi-replica deployments (local disk today will not scale past one pod) (P1).
- Investigate and document actual Prisma migration status (`prisma migrate` vs `db push`) (P3).
- If the Doubt Forum is kept: design its schema (`Doubt`, `Comment`, `Upvote` models) safely (ownership-scoped like `visionBoard.ts`, not like the old `req.body.userId` IDOR pattern the security log says was fixed once already).
**Files/Directories:** `backend/src/index.ts` (CORS/rate-limit only), `backend/prisma/schema.prisma`, `k8s/**`, `docker-compose.yml`
**Dependencies:** None to start (P0 items are self-contained); Doubt Forum schema blocks Member 2's forum routes and Member 1's forum UI if that feature is kept.
**Deliverables:** CORS allowlist enforced; rate limits live; backend boots successfully from a clean K8s apply with no code changes.
**Definition of Done:** A request from a non-allowlisted origin is rejected; six rapid signup attempts from one IP return 429; `kubectl apply -f k8s/` results in a running, ready backend pod with no crash loop.
**Priority:** P0
**Estimated Effort:** 3–5 days

### Member 4 — AI / Integrations
**Responsibility:** Everything that talks to Groq/Gemini or a third-party API.
**Tasks**
- Design and implement the real conversational contract for the AI Tutor (system prompt should use the actual user message, not regenerate notes) — hand the endpoint contract to Member 2.
- Obtain/verify real API keys in a staging environment for Google OAuth, NewsAPI, YouTube Data API, PodcastIndex, Google Books, and confirm each fetcher actually populates its table (currently unverifiable — none are configured in this repo's `.env`).
- Replace the fabricated "LinkedIn" market-demand data with either a real LinkedIn-adjacent data source or relabel the widget honestly (e.g., "Curated demand baseline" instead of implying live scraping) (P1/P2 depending on product decision).
- Evaluate the free Google Translate TTS dependency's reliability; scope a move to a supported TTS provider per the original Sprint-4 plan (P3).
- Confirm the SSO handoff round-trip with EdMentor/EdCompass/EdQuiz once those teams can test against it — currently only the minting half is verifiable from this repo.
**Files/Directories:** `backend/src/lib/ai/**`, `backend/src/lib/scraper.ts`, `backend/src/lib/cronScraper.ts`, `backend/src/services/*Cron.ts`, `backend/src/lib/tts.ts`, `backend/src/lib/sso.ts`
**Dependencies:** Needs Member 2 to expose whatever new chat route the Tutor redesign requires; needs real API keys from whoever owns those accounts (outside engineering).
**Deliverables:** A real Tutor conversation; a documented, verified status for every "unverifiable" integration in this report; honest labeling of any data that remains simulated.
**Definition of Done:** Sending a message in the AI Tutor produces a reply that is actually about the question asked; every third-party integration has a written PASS/FAIL from a real staging test, not just "the code compiles."
**Priority:** P0 (Tutor), P1 (integration verification), P2/P3 (market data honesty, TTS provider)
**Estimated Effort:** 5–7 days

### Member 5 — Testing, DevOps, Final QA & Documentation
**Responsibility:** Making sure any of the above actually stays fixed, and that the docs stop lying.
**Tasks**
- Stand up a test runner (Vitest/Jest for backend, Vitest + React Testing Library for frontend) — currently zero tests exist anywhere.
- Write P0-priority tests first: auth signup/login happy+failure paths, `/api/generate` with a mocked AI provider, IDOR checks on `vision-board`/`tts`/`progress` routes, CORS allowlist behavior, rate-limit behavior (all pair directly with Member 3's P0 fixes — write the test *as* the fix lands, not after).
- Update `README.md` and `context.md` to remove/correct the claims flagged in Phase 3.1–3.3 (Doubt Forum, Puppeteer, LinkedIn scraping, rate limiting, password strength) once each is actually resolved one way or the other.
- Own the Docker/K8s smoke test: confirm `docker-compose up --build -d` and a real `kubectl apply -f k8s/` both produce a working stack end-to-end after Member 3's secret-wiring fix.
- Final integration QA pass across the full user journey (signup → onboarding → roadmap → notes/podcast generation → dashboard → vision-board → hub → logout) before any release/demo.
**Files/Directories:** new `backend/src/**/*.test.ts`, new `frontend/src/**/*.test.tsx`, `README.md`, `context.md`, `docker-compose.yml`, `k8s/**` (verification only, not authoring)
**Dependencies:** Needs each other member's fix to land before writing the corresponding regression test; needs Member 3's K8s secret fix before a real cluster smoke test is possible.
**Deliverables:** A running test suite covering the P0 fixes; accurate top-level documentation; a signed-off end-to-end QA pass.
**Definition of Done:** `npm test` (once configured) passes in CI-equivalent conditions; README/`context.md` contain no claims that don't match the current code; a fresh clone + documented setup steps produce a fully working local stack without undocumented manual steps.
**Priority:** P1 (test suite foundation), ongoing through the whole plan (QA + docs)
**Estimated Effort:** 5–7 days, overlapping with all four other members' timelines

---

## PHASE 8 — File Ownership Matrix (avoiding collisions)

| File/Directory | Owner | Other Contributors | Risk |
|---|---|---|---|
| `backend/src/index.ts` | Member 2 (routes) & Member 3 (CORS/rate-limit lines only) | Member 4 (AI Tutor route contract) | **High** — this single file holds nearly every route; Members 2 and 3 must coordinate on non-overlapping line ranges (CORS block near the top vs. route bodies further down) and merge frequently in small commits. |
| `backend/prisma/schema.prisma` | Member 3 | Member 2 (if Doubt Forum kept) | Medium — schema changes should be single-owner per PR; Member 2 proposes, Member 3 lands. |
| `backend/src/lib/ai/**`, `backend/src/lib/scraper.ts`, `backend/src/lib/tts.ts` | Member 4 | — | Low — largely isolated. |
| `backend/src/routes/visionBoard.ts`, `books.ts`, `media.ts`, `news.ts` | Member 2 | Member 4 (content-fetcher keys/behavior) | Low |
| `backend/src/services/*Cron.ts`, `backend/src/lib/cronScraper.ts`, `backend/src/lib/queues/*` | Member 4 | Member 3 (Redis/BullMQ infra) | Medium — both touch Redis connection config. |
| `frontend/src/components/Layout/InteractiveAssistant.tsx` | Member 1 | Member 4 (contract), Member 2 (endpoint) | **High** — this is the file all three must agree on before Member 1 touches it; land the backend contract first. |
| `frontend/src/store/workspaceStore.ts` | Member 1 | Member 2 (whenever an API response shape changes) | Medium — central state file touched by many features; keep changes additive. |
| `frontend/src/app/**` (pages) | Member 1 | — | Low, mostly parallel-safe since pages are independent. |
| `k8s/**`, `docker-compose.yml` | Member 3 | Member 5 (verification) | Low |
| `README.md`, `context.md` | Member 5 | Whoever closes the underlying gap adds their own line | Medium — avoid two people editing the same doc section in the same week; batch doc updates at the end of each sprint. |
| `backend/package.json`, `frontend/package.json` | Whoever adds/removes the dependency | Member 5 (final dependency-hygiene pass) | Low |

---

## PHASE 9 — Dependency Graph

```
Platform Security & Config (Member 3: CORS fix, rate limiting, K8s secrets)
        ↓ (unblocks safe local/staging testing)
Backend route fixes (Member 2: password rule, Tutor endpoint, forum decision)
        ↓ (needs AI contract from Member 4 first for the Tutor specifically)
AI / Integration work (Member 4: Tutor prompt design, key verification, market-data honesty)
        ↓
Frontend integration (Member 1: Tutor UI rebuild, password copy fix, empty/error states)
        ↓
Testing & Final QA (Member 5: regression tests written alongside each fix, then full E2E pass)
        ↓
Documentation reconciliation (Member 5, continuous — updated as each gap closes)
```

**Can work in parallel from day one:**
- Member 3's CORS fix, rate-limit fix, and K8s secret wiring (fully independent of everyone else).
- Member 1's dead-code removal, accessibility pass, and unused-dependency cleanup.
- Member 4's key verification for News/YouTube/PodcastIndex/Books/Google OAuth (independent research/config task).
- Member 5 scaffolding a test runner (no code dependency, just tooling setup).

**Must wait for:**
- Member 1's Tutor UI rebuild must wait for Member 4's prompt/contract design **and** Member 2's endpoint implementation.
- Member 3's Doubt-Forum schema (if kept) must land before Member 2's forum routes, which must land before Member 1's forum UI.
- Member 5's regression tests for CORS/rate-limiting/password-strength must wait for Member 3/Member 2 to actually land those specific fixes (write test immediately after, not speculatively before).
- The final K8s smoke test (Member 5) must wait for Member 3's secret wiring.

---

## PHASE 10 — Development Roadmap

**Phase 1 — Foundation & Security (this sprint's real priority):** CORS fix, rate limiting, K8s secrets, password-strength enforcement, remove misleading console logging. This is not "new features" — it's making the existing, mostly-working product actually safe and deployable.

**Phase 2 — Core Feature Repair:** Rebuild the AI Tutor chat to actually converse; decide and execute on the Doubt Forum (build or formally cut); decide and execute on Subscription/credits (build or formally cut).

**Phase 3 — Integration Verification & Honesty Pass:** Verify every "unverifiable" third-party integration with real keys in staging; replace or relabel the fabricated LinkedIn market-demand data; evaluate the TTS provider.

**Phase 4 — Testing & Bug Fixing:** Stand up the test runner; write regression tests alongside each Phase 1/2 fix; run a full manual E2E pass across every user journey.

**Phase 5 — Finalization:** Accessibility pass, dead-code/dependency cleanup, documentation reconciliation (README/`context.md` match reality), Docker + K8s full smoke test, demo prep.

---

## PHASE 11 — Timeline (5-member team, no fixed deadline supplied — estimate below)

| Week | Member 1 (Frontend) | Member 2 (Backend) | Member 3 (Security/Infra) | Member 4 (AI/Integrations) | Member 5 (Test/DevOps/QA) |
|---|---|---|---|---|---|
| 1 | Dead-code + dependency cleanup; start accessibility pass | Password-strength enforcement; remove log noise | CORS fix; rate limiting; K8s secret wiring **(all P0, parallel)** | Key verification for OAuth/News/YouTube/PodcastIndex/Books in staging | Scaffold test runner; write tests for Member 3's fixes as they land |
| 2 | Empty/error state pass across content pages | Doubt Forum decision + routes (if kept) / Subscription decision | Doubt Forum schema (if kept); investigate migration history | Design Tutor's real conversational contract; hand off to Member 2 | Tests for password rule, auth flows |
| 3 | **Rebuild AI Tutor chat UI** against Member 2/4's new contract | **Implement real Tutor endpoint** | Support K8s smoke-test blockers as they surface | Finalize market-data honesty fix (relabel or replace LinkedIn data) | Tests for Tutor endpoint; begin IDOR regression suite |
| 4 | Final polish, accessibility fixes from audit findings | Forum/Subscription implementation continued if in scope | TTS storage strategy decision + implementation start | TTS provider evaluation; SSO round-trip check with sibling teams | Full E2E manual pass; K8s + Docker smoke test |
| 5 (buffer) | Bug-fix buffer, cross-review | Bug-fix buffer, cross-review | Bug-fix buffer, cross-review | Bug-fix buffer, cross-review | Documentation reconciliation; final sign-off checklist |

Weeks 1 is the only strictly parallel week; from Week 2 onward, the Tutor-chat thread (1→2→4) is the critical path. Adjust the buffer week based on whether Doubt Forum/Subscription are kept (adds real days) or formally cut (removes them).

---

## PHASE 12 — Git / Branch Strategy

```
main
│
├── fix/security-hardening        (Member 3 — CORS, rate limiting, K8s secrets)
├── fix/auth-password-policy      (Member 2)
├── feature/ai-tutor-rebuild      (Member 4 designs contract → Member 2 implements → Member 1 wires UI; shared branch, sequential commits)
├── feature/doubt-forum           (Members 2+3, only if kept — otherwise delete this line item from the plan)
├── chore/frontend-cleanup        (Member 1 — dead code, unused deps, a11y)
├── chore/integration-verification (Member 4 — no code changes expected, mostly config/notes)
└── test/regression-suite         (Member 5 — grows continuously, rebased frequently against the above)
```

- **Branch naming:** `fix/`, `feature/`, `chore/`, `test/` prefixes as above; one branch per backlog item where possible to keep PRs small and reviewable.
- **Commit strategy:** small, single-purpose commits; every commit that closes a Phase 3 gap should reference the specific finding (e.g., "fix: enforce allowedOrigins in cors() — closes CORS bypass finding").
- **Pull request strategy:** every PR touching `backend/src/index.ts` gets reviewed by both Member 2 and Member 3, since that file is the highest-collision-risk asset in the repo (Phase 8). PRs touching the AI Tutor require sign-off from Member 1, 2, and 4 together before merge, since it spans three roles.
- **When to merge:** P0 branches (`fix/security-hardening`, `fix/auth-password-policy`) merge to `main` independently and immediately once reviewed — they have no dependents blocking them. `feature/ai-tutor-rebuild` merges only once all three sequential pieces (contract → endpoint → UI) are complete and Member 5 has a passing regression test for it.
- **Avoiding conflicts:** daily rebase of long-lived branches against `main`; nobody edits `backend/src/index.ts` without pulling latest first, given how central it is.

---

## PHASE 13 — Integration Plan

1. **First to complete:** Member 3's P0 security fixes (CORS, rate limiting, K8s secrets) — nothing else depends on them being *unfinished*, and they de-risk everything that follows.
2. **Database changes merge:** as soon as the Doubt Forum/Subscription decisions are made (Week 1–2), so Member 2's routes and Member 1's UI aren't built against a moving schema.
3. **Backend APIs available:** the Tutor's new endpoint should be feature-complete and manually verified by Member 2+4 before Member 1 starts the UI rebuild (Week 3 per the timeline).
4. **Frontend connects to APIs:** immediately once each backend piece lands — this codebase already follows that pattern well (axios calls scoped per page), so no special integration ceremony is needed beyond normal PR review.
5. **AI integration:** the core AI pipeline is already integrated; the only *new* AI integration work is the Tutor's real contract (Week 2–3) and the market-data honesty fix (Week 3).
6. **Complete-system testing begins:** Week 3–4, once the Tutor thread lands — that's the last major moving piece; testing anything before that just tests code that's about to change.
7. **Feature freeze:** end of Week 4, before the Week 5 buffer — no new scope after that point, only bug fixes found during E2E QA.

**Final integration checklist**
- [ ] CORS allowlist verified against a real cross-origin request test
- [ ] Rate limits verified with a scripted burst test against `/auth/login` and `/generate`
- [ ] `kubectl apply -f k8s/` produces a Ready backend pod using real Secrets, not the bare ConfigMap
- [ ] AI Tutor chat answers the literal question typed, verified manually with three distinct questions
- [ ] Doubt Forum either fully functional end-to-end or fully removed from README/`context.md`
- [ ] Every "unverifiable" integration in Phase 3.6 has a written PASS/FAIL from staging
- [ ] `README.md` and `context.md` re-read end-to-end and confirmed accurate against the merged code
- [ ] Full manual E2E pass: signup → onboarding → roadmap → notes (all 7 modes) → PDF export → dashboard → vision-board → hub → logout

---

## PHASE 14 — Final Project Checklist

**Functional**
- [ ] All required features implemented (or formally descoped in docs)
- [ ] All user flows work (especially AI Tutor)
- [ ] No broken buttons
- [ ] No placeholder functionality presented as real (Hub cards, market-demand data)

**Frontend**
- [ ] Responsive
- [ ] Loading states
- [ ] Error states
- [ ] Empty states
- [ ] Navigation
- [ ] Accessibility (WCAG 2.1 AA)

**Backend**
- [ ] APIs working
- [ ] Validation (including password strength)
- [ ] Error handling
- [ ] Authentication
- [ ] Authorization (IDOR checks — already strong, keep it that way in new routes)
- [ ] CORS restricted to real allowlist
- [ ] Rate limiting live on auth + AI-cost routes

**Database**
- [ ] Schema finalized (resolve Subscription/credits one way or another)
- [ ] Relationships correct
- [ ] Migration history confirmed
- [ ] Data persistence verified

**AI**
- [ ] Real AI integration confirmed (already true for notes/roadmap/facts/classification)
- [ ] Correct prompts (already true)
- [ ] API key secured (already true — server-side only)
- [ ] Error handling (already reasonable — fallback model chain on Groq)
- [ ] Fallback behavior (already true for classification; Tutor needs its real behavior built)

**Testing**
- [ ] Unit tests
- [ ] API tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] Manual testing sign-off

**Deployment**
- [ ] Environment variables (wired into K8s Secrets, not just `.env`)
- [ ] Production build verified
- [ ] Docker (both modes) verified
- [ ] Kubernetes deployment verified end-to-end
- [ ] Production testing

**Documentation**
- [ ] README accurate
- [ ] `context.md` accurate
- [ ] Setup instructions verified on a clean machine
- [ ] API documentation (currently only exists as comments in `index.ts` — consider extracting)
- [ ] Demo instructions

---

## PHASE 15 — Final Output Summary

**1. Executive Summary.** EdLearn's core learning loop — pick a goal, get an AI-generated roadmap, generate deeply-prompted study notes in one of seven pedagogical modes with real double-pass review and citation tracking, track progress, export a PDF — genuinely works, and is the strongest part of the codebase. Around that core, several supporting features are either fully fabricated (the "LinkedIn" market-demand data), broken in a way that isn't visible from the UI (the AI Tutor chat), or documented as done but absent from the code (the Doubt Forum, rate limiting, password-strength enforcement). The project is also not currently safe to expose publicly as configured (CORS accepts any origin) and would not boot in the Kubernetes manifests as written (secrets are never injected).

**2. Current Completion:** ~58% overall. Frontend 70%, Backend 65%, Database 80%, APIs 65%, AI 75%, Authentication 80%, Testing 0%, Deployment 40%, Documentation 45%.

**3. What Is Already Done (genuinely working).** Email/password + Google OAuth (code-complete) authentication; roadmap generation; all 7 study-note pedagogical modes with real double-pass AI review and citation persistence; branded PDF export; dashboard with Redis caching; day-completion + badge system backed by real DB tables; Vision Board (the most complete feature in the app); the GitHub half of market-demand tracking; the real integrations behind news/media/books (pending live key verification); IDOR-safe ownership checks across nearly every authenticated route.

**4. What Is Missing.** Automated tests of any kind; enforced signup password strength; applied rate limiting; a working Doubt/discussion forum; a real Stripe/subscription system; K8s Secret wiring for the backend deployment; a genuinely conversational AI Tutor.

**5. What Is Broken.** CORS (`origin: true` bypasses the computed allowlist entirely); the AI Tutor chat (answers an unrelated regenerated-notes snippet instead of the user's question); the K8s backend deployment (will crash-loop without manual secret injection that isn't currently documented as required).

**6. Fake/Mock Implementations.** Market-demand "LinkedIn" data (hardcoded array + random jitter, not scraped); the AI Tutor's reply (real AI call, wrong purpose — effectively theater); Hub page's mentor/compass cards (honestly gated behind `false` flags, so not shown to users, but the feature itself doesn't exist).

**7. Critical Gaps (block calling this "done").** CORS bypass; missing rate limiting; non-functional AI Tutor; non-bootable K8s config; zero test coverage; README/`context.md` drift from actual code.

**8. Prioritized Backlog.** See Phase 5 in full — P0 items are CORS fix, rate limiting, K8s secret wiring, AI Tutor rebuild, and password-strength enforcement.

**9. 5-Member Responsibility Matrix**

| Area | Member 1 (Frontend) | Member 2 (Backend) | Member 3 (Security/Infra) | Member 4 (AI/Integrations) | Member 5 (Test/DevOps/QA) |
|---|---|---|---|---|---|
| AI Tutor fix | UI rebuild | Endpoint impl. | — | Prompt/contract design | Regression tests |
| Security hardening | — | Supports validation logic | Owns CORS/rate-limit/K8s secrets | — | Verifies with scripted tests |
| Doubt Forum (if kept) | UI | Routes | Schema | — | Tests |
| Integration verification | — | — | — | Owns all key/staging verification | Logs PASS/FAIL results |
| Testing foundation | Component tests | API tests | Infra smoke tests | — | Owns the whole suite |
| Documentation | — | — | — | — | Owns README/context.md accuracy |

**10–13. Detailed tasks, dependencies, timeline, and git strategy:** see Phases 7, 9, 11, and 12 above in full.

**14. Final Definition of Done.** EdLearn can be called complete when: every claim in `README.md`/`context.md` is true of the merged code; a request from a non-allowlisted origin is rejected and a burst of auth/AI requests is rate-limited; `kubectl apply -f k8s/` produces a running backend without manual intervention; the AI Tutor answers the literal question a student types; the Doubt Forum and Subscription systems are either fully functional or formally removed from scope; a baseline automated test suite passes covering auth, IDOR, and the AI generation happy path; and a fresh clone of the repository, following only the documented setup steps, produces a fully working local stack.

---

## Recommended Execution Order (start here)

1. Member 3 starts immediately on CORS + rate limiting (self-contained, highest risk-reduction per hour).
2. Member 3 in parallel wires K8s Secrets (independent of #1, same person can sequence these).
3. Member 4 starts key verification for the "unverifiable" integrations and begins designing the AI Tutor's real conversational contract.
4. Member 2 implements the password-strength fix immediately (independent, quick win), then picks up the Tutor endpoint once Member 4's contract is ready.
5. Member 1 starts cleanup/accessibility work now (independent), then rebuilds the Tutor UI once Member 2's endpoint is live.
6. Member 5 scaffolds the test runner from day one and writes each regression test the moment its corresponding fix lands — not at the end.
7. Everyone reconvenes for the Week 3–4 Tutor integration point, then moves into the Phase 4/5 testing, QA, and documentation-reconciliation pass described above.
