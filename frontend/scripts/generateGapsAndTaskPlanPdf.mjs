import { jsPDF } from 'jspdf';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const doc = new jsPDF({
  orientation: 'portrait',
  unit: 'mm',
  format: 'a4',
});

const PW = 210;
const PH = 297;
const MARGIN = 16;
const CONTENT_W = PW - MARGIN * 2;
let y = 20;

// Color Palette
const C = {
  slate900: [15, 23, 42],
  slate800: [30, 41, 59],
  slate700: [51, 65, 85],
  slate600: [71, 85, 105],
  slate400: [148, 163, 184],
  slate200: [226, 232, 240],
  slate100: [241, 245, 249],
  slate50:  [248, 250, 252],
  blue600:  [37, 99, 235],
  blue700:  [29, 78, 216],
  blue50:   [239, 246, 255],
  emerald600: [5, 150, 105],
  emerald50:  [236, 253, 245],
  amber600:   [217, 119, 6],
  amber50:    [255, 251, 235],
  rose600:    [225, 29, 72],
  rose50:     [255, 241, 242],
  indigo600:  [79, 70, 229],
  white:      [255, 255, 255],
};

function checkPageBreak(neededHeight) {
  if (y + neededHeight > PH - 16) {
    doc.addPage();
    y = 20;
    addPageChrome();
  }
}

function addPageChrome() {
  const pageNum = doc.internal.getNumberOfPages();
  if (pageNum === 1) return; // Skip cover page header

  // Header bar
  doc.setFillColor(...C.slate900);
  doc.rect(0, 0, PW, 12, 'F');

  doc.setFillColor(...C.blue600);
  doc.rect(0, 0, 3.5, 12, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.white);
  doc.text('EdLearn', 7, 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.slate400);
  doc.text('Remaining Gaps & 5-Member Implementation Task Plan', 25, 8);

  // Footer bar
  doc.setDrawColor(...C.slate200);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, PH - 10, PW - MARGIN, PH - 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.slate600);
  doc.text('EdLearn Engineering Architecture & Sprint Planning', MARGIN, PH - 6);
  doc.text(`Page ${pageNum}`, PW - MARGIN - 12, PH - 6);
}

function addSectionTitle(title, tag = '') {
  checkPageBreak(16);
  doc.setFillColor(...C.blue50);
  doc.roundedRect(MARGIN, y, CONTENT_W, 9, 1.5, 1.5, 'F');
  
  doc.setFillColor(...C.blue600);
  doc.rect(MARGIN, y, 2.5, 9, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...C.blue700);
  doc.text(title, MARGIN + 5, y + 6);

  if (tag) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...C.slate600);
    const tagWidth = doc.getTextWidth(tag);
    doc.text(tag, PW - MARGIN - tagWidth - 2, y + 6);
  }

  y += 12;
}

function addSubSectionTitle(title) {
  checkPageBreak(10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.slate900);
  doc.text(title, MARGIN, y);
  y += 4.5;
}

function addParagraph(text) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.slate700);
  const lines = doc.splitTextToSize(text, CONTENT_W);
  checkPageBreak(lines.length * 3.4 + 2);
  doc.text(lines, MARGIN, y);
  y += lines.length * 3.4 + 2;
}

function addBullet(label, desc) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.slate900);
  
  const bulletPrefix = `• ${label}: `;
  const prefixWidth = doc.getTextWidth(bulletPrefix);
  
  const fullText = `• ${label}: ${desc}`;
  const lines = doc.splitTextToSize(fullText, CONTENT_W);
  checkPageBreak(lines.length * 3.4 + 1.5);

  doc.text(lines, MARGIN, y);
  y += lines.length * 3.4 + 1.5;
}

function drawTable(headers, rows, colWidths, opts = {}) {
  const rowHeight = opts.rowHeight || 6;
  const headerHeight = opts.headerHeight || 7;
  const fontSize = opts.fontSize || 7;

  checkPageBreak(headerHeight + rowHeight * Math.min(rows.length, 3));

  // Header
  doc.setFillColor(...C.slate900);
  doc.rect(MARGIN, y, CONTENT_W, headerHeight, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSize);
  doc.setTextColor(...C.white);

  let currentX = MARGIN;
  headers.forEach((h, i) => {
    doc.text(h, currentX + 2, y + headerHeight - 2.5);
    currentX += colWidths[i];
  });
  y += headerHeight;

  // Rows
  rows.forEach((row, rIdx) => {
    // Calculate max lines in row
    let maxLines = 1;
    row.forEach((cell, cIdx) => {
      const cellText = String(cell);
      const lines = doc.splitTextToSize(cellText, colWidths[cIdx] - 4);
      if (lines.length > maxLines) maxLines = lines.length;
    });

    const actualRowHeight = Math.max(rowHeight, maxLines * 3.2 + 3);
    checkPageBreak(actualRowHeight);

    // Row background
    if (rIdx % 2 === 0) {
      doc.setFillColor(...C.slate50);
      doc.rect(MARGIN, y, CONTENT_W, actualRowHeight, 'F');
    }

    doc.setDrawColor(...C.slate200);
    doc.setLineWidth(0.2);
    doc.rect(MARGIN, y, CONTENT_W, actualRowHeight, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(...C.slate800);

    let cellX = MARGIN;
    row.forEach((cell, cIdx) => {
      const cellText = String(cell);
      const lines = doc.splitTextToSize(cellText, colWidths[cIdx] - 4);
      doc.text(lines, cellX + 2, y + 3.8);
      cellX += colWidths[cIdx];
    });

    y += actualRowHeight;
  });

  y += 3;
}

function addCalloutBox(title, text, type = 'info') {
  const bg = type === 'success' ? C.emerald50 : type === 'warning' ? C.amber50 : C.blue50;
  const border = type === 'success' ? C.emerald600 : type === 'warning' ? C.amber600 : C.blue600;
  const textCol = type === 'success' ? [4, 120, 87] : type === 'warning' ? [180, 83, 9] : C.blue700;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const lines = doc.splitTextToSize(text, CONTENT_W - 8);
  const boxHeight = lines.length * 3.4 + 10;

  checkPageBreak(boxHeight + 2);

  doc.setFillColor(...bg);
  doc.roundedRect(MARGIN, y, CONTENT_W, boxHeight, 1.5, 1.5, 'F');
  
  doc.setFillColor(...border);
  doc.rect(MARGIN, y, 2.5, boxHeight, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...textCol);
  doc.text(title, MARGIN + 5, y + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(...C.slate700);
  doc.text(lines, MARGIN + 5, y + 8.5);

  y += boxHeight + 3;
}

// ==============================================================================
// PAGE 1: COVER PAGE
// ==============================================================================
doc.setFillColor(...C.slate900);
doc.rect(0, 0, PW, PH, 'F');

// Accent top line
doc.setFillColor(...C.blue600);
doc.rect(0, 0, PW, 6, 'F');

// Brand
doc.setFont('helvetica', 'bold');
doc.setFontSize(16);
doc.setTextColor(...C.white);
doc.text('EdLearn', MARGIN, 28);
doc.setTextColor(...C.blue600);
doc.text('Enterprise Platform Engineering', MARGIN + 28, 28);

// Main Hero Title
doc.setFont('helvetica', 'bold');
doc.setFontSize(26);
doc.setTextColor(...C.white);
doc.text('Remaining Gaps & 5-Member', MARGIN, 55);
doc.text('Implementation Task Plan', MARGIN, 67);

doc.setFont('helvetica', 'bold');
doc.setFontSize(12);
doc.setTextColor(...C.blue600);
doc.text('Architectural Audit, Remaining Gap Matrix & Sprint Execution Roadmap', MARGIN, 78);

// Meta Card
doc.setFillColor(...C.slate800);
doc.roundedRect(MARGIN, 92, CONTENT_W, 58, 2, 2, 'F');
doc.setDrawColor(...C.slate700);
doc.setLineWidth(0.4);
doc.roundedRect(MARGIN, 92, CONTENT_W, 58, 2, 2, 'S');

doc.setFont('helvetica', 'bold');
doc.setFontSize(8.5);
doc.setTextColor(...C.white);
doc.text('PROJECT METADATA & BASELINE AUDIT SUMMARY', MARGIN + 6, 100);

doc.setFont('helvetica', 'normal');
doc.setFontSize(7.5);
doc.setTextColor(...C.slate400);

const metaLeft = [
  'Platform: EdLearn Learning Ecosystem',
  'Frontend: Next.js 16.2 (App Router), React 19, Tailwind v4',
  'Backend: Express 4.x, TypeScript, Prisma 7.8',
  'Databases: PostgreSQL 16, MongoDB 7.0, Redis 7.2',
];

const metaRight = [
  `Document Date: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
  'Current Status: Baseline Upgrades Complete (84/84 Tests Passed)',
  'Typecheck Health: 0 Errors (Frontend & Backend)',
  'Target Release: Production Release Candidate (v2.0)',
];

let metaY = 108;
metaLeft.forEach((txt) => {
  doc.text(txt, MARGIN + 6, metaY);
  metaY += 7.5;
});

metaY = 108;
metaRight.forEach((txt) => {
  doc.text(txt, MARGIN + 95, metaY);
  metaY += 7.5;
});

// Table of Contents Preview Box
doc.setFillColor(...C.slate800);
doc.roundedRect(MARGIN, 158, CONTENT_W, 110, 2, 2, 'F');
doc.setDrawColor(...C.slate700);
doc.roundedRect(MARGIN, 158, CONTENT_W, 110, 2, 2, 'S');

doc.setFont('helvetica', 'bold');
doc.setFontSize(8.5);
doc.setTextColor(...C.white);
doc.text('TABLE OF CONTENTS & DOCUMENT ROADMAP', MARGIN + 6, 166);

const tocItems = [
  ['01. Executive Summary & Baseline Architecture', '09. Member 3: Database & Core Learning Data'],
  ['02. Completed vs Remaining Status Matrix', '10. Member 4: Advanced Features & Community'],
  ['03. Detailed Remaining Gap Analysis (10 Gaps)', '11. Member 5: Testing, DevOps & Production QA'],
  ['04. Actionable Epic/Feature/Task Breakdown', '12. Cross-Functional Ownership Matrix'],
  ['05. Exact 5-Member Team Allocation', '13. Dependency Map & Execution Sequence'],
  ['06. Workstream Definitions & Boundaries', '14. 4-Week Sprint Execution Roadmap'],
  ['07. Member 1: Frontend, UX & Interactive Learning', '15. Git Workflow & PR Protocol'],
  ['08. Member 2: Backend, APIs & Business Logic', '16. Top 20 Remaining Tasks & Target State'],
];

let tocY = 176;
tocItems.forEach(([col1, col2]) => {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.slate400);
  doc.text(col1, MARGIN + 6, tocY);
  doc.text(col2, MARGIN + 95, tocY);
  tocY += 9.5;
});

doc.setFont('helvetica', 'normal');
doc.setFontSize(7);
doc.setTextColor(...C.slate400);
doc.text('Confidential — Prepared for Engineering Management & Academic Review', MARGIN, PH - 10);

// ==============================================================================
// PAGE 2: EXECUTIVE SUMMARY & CURRENT PROJECT STATUS
// ==============================================================================
doc.addPage();
y = 20;
addPageChrome();

addSectionTitle('1. Executive Summary & Current Baseline Architecture');
addParagraph('EdLearn is a full-stack educational platform designed to provide multi-modal AI tutoring, structured learning roadmaps, and content curation. Over the initial engineering sprints, the platform established a robust baseline comprising Next.js 16, React 19, TypeScript, Tailwind CSS v4, Express, PostgreSQL with Prisma 7.8, Redis caching, and multi-provider AI failovers.');

addCalloutBox(
  'CURRENT PLATFORM VERIFICATION STATUS (ALL 84 TESTS PASSING)',
  '• Backend Vitest Suite: 84 / 84 tests passing across 6 test suites (auth, content, gdpr, generate, roadmap, platform_features).\n• TypeScript Typecheck: 0 compilation errors across both frontend (npx tsc --noEmit) and backend (npm run typecheck).\n• Database Schema: PostgreSQL 16 schema generated with UUID primary keys, compound indexes, and cascade integrity.',
  'success'
);

addSectionTitle('2. Completed vs Remaining Features Comparison Matrix');
addParagraph('The following table establishes the exact source-of-truth baseline for EdLearn, clearly distinguishing completed components from remaining gaps to prevent duplicate assignments.');

const compHeaders = ['Subsystem / Area', 'Current Implementation State', 'Status', 'Remaining Action Required'];
const compWidths = [38, 70, 28, 42];
const compRows = [
  ['Authentication & 2FA', 'JWT access/refresh rotation, TOTP 2FA, backup codes, Google OAuth.', 'COMPLETED', 'None. Stable and tested.'],
  ['Pedagogical Modes 1-7', 'Accelerator, Socratic, Simplifier, Roadmap, Gap Finder, Feynman, Duo Podcast.', 'COMPLETED', 'None. AI prompt engine active.'],
  ['Content Hubs', 'Books summaries, Media (YouTube/podcasts), News aggregator with crons.', 'COMPLETED', 'None. Curation crons functional.'],
  ['Bookmarks & Search', 'Universal bookmarks (/bookmarks) and Cmd+K global search modal.', 'COMPLETED', 'None. Full-stack active.'],
  ['Progress & Streaks', 'Timezone-aware streak counter and 365-day activity heatmap on dashboard.', 'COMPLETED', 'None. Redis cached.'],
  ['Quizzes & Notes', 'QuizRunner interactive tester with scoring and personal notes editor.', 'COMPLETED', 'None. Real-time auto-saving.'],
  ['RBAC & Admin Portal', 'Role middleware (ADMIN, USER, MOD) and telemetry portal at /admin.', 'COMPLETED', 'None. Protected route active.'],
  ['In-App Notifications', 'NotificationCenter bell with unread badge counter and read toggles.', 'COMPLETED', 'None. Polling active.'],
  ['AI Provider Failover', 'Automatic circuit breaker switching between Groq and Gemini on 429/5xx.', 'COMPLETED', 'None. Fully resilient.'],
  ['Spaced Repetition (SM-2)', 'Quiz attempts saved, but incorrect answers not scheduled for recall.', 'NOT STARTED', 'Build SM-2 flashcard review engine.'],
  ['Live Collaborative Rooms', 'Single-player study only. No real-time peer audio/whiteboard.', 'NOT STARTED', 'Implement Socket.io study rooms.'],
  ['PWA & Offline Sync', 'Requires active connection. No offline cache or background sync queue.', 'NOT STARTED', 'Add Service Worker & IndexedDB.'],
  ['Topic Discussions & Q&A', 'Notes are private. No public lesson discussions or peer answers.', 'NOT STARTED', 'Add threaded Q&A under topics.'],
  ['Automated Email Digests', 'In-app notifications only. No scheduled weekly email reports.', 'NOT STARTED', 'Build Nodemailer/Resend cron worker.'],
  ['Verifiable Certificates', 'Awards in-app badges only. No downloadable PDF certificates.', 'NOT STARTED', 'Build verifiable PDF certificate engine.'],
];
drawTable(compHeaders, compRows, compWidths, { fontSize: 6.5, rowHeight: 4.8 });

// ==============================================================================
// PAGE 3: DETAILED REMAINING GAP ANALYSIS (10 REMAINING GAPS)
// ==============================================================================
doc.addPage();
y = 20;
addPageChrome();

addSectionTitle('3. Detailed Remaining Gap Analysis (10 Core Gaps)');
addParagraph('Each remaining gap has been rigorously audited against the codebase to ensure no duplicate work is assigned. The following 10 gaps represent the concrete scope for the 5-member team.');

const gapHeaders = ['Gap ID', 'Category', 'Description & Missing Functionality', 'Priority', 'Impact', 'Owner'];
const gapWidths = [16, 26, 78, 16, 22, 20];
const gapRows = [
  ['GAP-01', 'Learning Gap', 'Spaced Repetition System (SM-2): Missed quiz answers are not scheduled into SuperMemo-2 review intervals for long-term retention.', 'P0', 'High Learning Retention', 'Member 2 / 3'],
  ['GAP-02', 'Collaboration', 'Real-Time Peer Study Rooms: No synchronous study sessions, shared Pomodoro timers, or collaborative whiteboard notes.', 'P0', 'High Engagement', 'Member 4 / 1'],
  ['GAP-03', 'PWA / Offline', 'PWA Offline Cache & Sync Queue: Inability to review cached study notes or queue quiz attempts during network dropouts.', 'P1', 'Mobile & Offline Access', 'Member 1 / 5'],
  ['GAP-04', 'Community', 'Threaded Topic Discussions & Q&A: Lack of peer-to-peer lesson discussion threads, code question upvoting, and moderation.', 'P1', 'Social Learning', 'Member 4 / 3'],
  ['GAP-05', 'Engagement', 'Automated Email Digest & Retention Crons: No weekly progress emails, streak reminder alerts, or personalized digest delivery.', 'P1', 'User Re-engagement', 'Member 2 / 5'],
  ['GAP-06', 'Credentialing', 'Cryptographically Verifiable Certificates: Missing official PDF completion certificates with unique SHA-256 validation hashes.', 'P1', 'Academic Credibility', 'Member 2 / 1'],
  ['GAP-07', 'Monetization', 'Subscription Tiers & Stripe Webhooks: Credit consumption is flat; lacks Pro/Student tier gating and automated webhook quota resets.', 'P2', 'Platform Scalability', 'Member 2 / 3'],
  ['GAP-08', 'Quality Assur.', 'Playwright E2E Test Suite: Vitest unit/integration tests pass, but end-to-end browser journeys are unautomated.', 'P1', 'Regression Defense', 'Member 5'],
  ['GAP-09', 'AI & Discovery', 'Semantic Recommendation Engine: Recommendations rely on simple genre filters rather than cosine embedding similarity.', 'P2', 'Discovery Relevance', 'Member 3 / 2'],
  ['GAP-10', 'DevOps & Logs', 'Centralized Log Streaming & Backup Automation: Missing automated pg_dump cron jobs and structured Pino log aggregation.', 'P1', 'Disaster Recovery', 'Member 5'],
];
drawTable(gapHeaders, gapRows, gapWidths, { fontSize: 6.5, rowHeight: 5.5 });

// ==============================================================================
// PAGE 4: DETAILED TASK BREAKDOWN (EPIC -> FEATURE -> TASK -> SUBTASK)
// ==============================================================================
doc.addPage();
y = 20;
addPageChrome();

addSectionTitle('4. Detailed Task Breakdown: Epic -> Feature -> Task -> Subtasks');

addSubSectionTitle('EPIC 1: Retention & Spaced Repetition (GAP-01)');
addBullet('FEATURE 1.1: SM-2 Flashcard Review Engine', 'Automate conversion of missed quiz questions into daily spaced repetition decks.');
addParagraph('   • Subtask 1.1.1: Add Flashcard and FlashcardReview models to Prisma schema with easeFactor, interval, and repetitions fields.\n   • Subtask 1.1.2: Implement SM-2 mathematical algorithm service in backend calculating next review dates (1d, 6d, interval*EF).\n   • Subtask 1.1.3: Build POST /api/flashcards/review endpoint to record recall grades (0-5) and update card scheduling.\n   • Subtask 1.1.4: Build interactive FlipCard.tsx and /flashcards study runner UI with keyboard navigation (Space to flip, 1-4 to grade).\n   • Subtask 1.1.5: Hook quiz failure event to auto-create flashcards for incorrect questions.');

addSubSectionTitle('EPIC 2: Real-Time Social Learning & Study Rooms (GAP-02, GAP-04)');
addBullet('FEATURE 2.1: Collaborative Live Study Rooms', 'Multi-user virtual study rooms with synchronized Pomodoro timers and shared canvas.');
addParagraph('   • Subtask 2.1.1: Initialize Socket.io server with room namespaces (/study-room/:roomId) and JWT handshake authentication.\n   • Subtask 2.1.2: Implement synchronized room state (timer start/pause/reset, active participants list, presence heartbeats).\n   • Subtask 2.1.3: Build collaborative shared scratchpad with operational transform / debounced broadcast updates.\n   • Subtask 2.1.4: Create frontend /study-rooms/[id] layout with participant avatars, chat dock, and synced timer widget.');

addBullet('FEATURE 2.2: Threaded Lesson Discussion Forum', 'Peer Q&A threads embedded under each roadmap topic lesson.');
addParagraph('   • Subtask 2.2.1: Add TopicComment model in Prisma with self-referential parentId for infinite threading and upvote counts.\n   • Subtask 2.2.2: Create GET/POST /api/topics/:topicId/comments and POST /api/comments/:id/upvote endpoints.\n   • Subtask 2.2.3: Build TopicDiscussionSection.tsx with markdown rendering, reply nesting, and moderator delete badges.');

addSubSectionTitle('EPIC 3: Platform Credibility & Certification (GAP-06)');
addBullet('FEATURE 3.1: Verifiable Course Completion Certificates', 'Generate tamper-proof PDF certificates with public verification.');
addParagraph('   • Subtask 3.1.1: Add Certificate model in Prisma storing certificateId, userId, roadmapId, sha256Hash, and issuedAt.\n   • Subtask 3.1.2: Build backend PDF generation service rendering gold-bordered diploma with student name, course title, and QR code.\n   • Subtask 3.1.3: Create public verification route GET /api/certificates/verify/:hash and frontend /verify/[hash] lookup page.');

// ==============================================================================
// PAGE 5: MEMBER 1 TASK SHEET (FRONTEND, UX & INTERACTIVE LEARNING)
// ==============================================================================
doc.addPage();
y = 20;
addPageChrome();

addSectionTitle('5. Member 1 Task Sheet: Frontend, UX & Interactive Learning', 'OWNER: MEMBER 1');
addCalloutBox(
  'MEMBER 1 WORKSTREAM PROFILE',
  '• Primary Role: Lead Frontend Engineer & UX Architect\n• Git Branch: feature/member1-frontend-ux\n• Core Ownership: Flashcards study UI, PWA service worker, collaborative study room interface, certificate viewer.\n• Shared Touchpoints: frontend/src/components/Document/LivingDocument.tsx, frontend/src/components/Layout/Sidebar.tsx',
  'info'
);

addSubSectionTitle('Assigned Tasks & Subtasks:');
addBullet('TASK M1-01 (GAP-01)', 'Interactive Flashcards Study Canvas (/flashcards)');
addParagraph('   • Build 3D card-flip component with smooth CSS perspective transitions.\n   • Implement 1-5 recall rating buttons (Again, Hard, Good, Easy) with keyboard shortcuts (1, 2, 3, 4, Space).\n   • Display daily due cards counter, deck completion summary, and streak celebration confetti.');

addBullet('TASK M1-02 (GAP-02)', 'Virtual Study Room UI & Shared Canvas (/study-rooms/[id])');
addParagraph('   • Build responsive study room layout with synced circular Pomodoro timer widget.\n   • Create live participant strip showing user avatars, audio pulse indicators, and active study badges.\n   • Implement real-time room chat drawer and shared markdown scratchpad with live typing indicators.');

addBullet('TASK M1-03 (GAP-03)', 'PWA Service Worker & Offline Storage');
addParagraph('   • Configure next-pwa / Workbox service worker caching for static assets and generated notes.\n   • Build offline indicator banner and IndexedDB queueing for offline quiz submissions.');

addBullet('TASK M1-04 (GAP-06)', 'Certificate Modal & Verification Page (/verify/[hash])');
addParagraph('   • Create celebratory certificate unlock modal on roadmap completion.\n   • Build responsive public verification page displaying certificate authenticity badge, student name, and course details.');

const m1Headers = ['Task ID', 'Deliverable Module', 'Est. Hours', 'Dependencies', 'Acceptance Gate'];
const m1Widths = [22, 60, 24, 34, 38];
const m1Rows = [
  ['M1-01', 'frontend/src/app/flashcards/page.tsx', '14h', 'M3-01 (DB), M2-01 (API)', 'Flashcards flip & grade smoothly.'],
  ['M1-02', 'frontend/src/app/study-rooms/[id]/page.tsx', '18h', 'M4-01 (Socket.io)', 'Synced timer & live peer presence.'],
  ['M1-03', 'frontend/public/sw.js, IndexedDB sync', '12h', 'None', 'Notes load offline without network.'],
  ['M1-04', 'frontend/src/app/verify/[hash]/page.tsx', '8h', 'M2-03 (Certificate API)', 'Public certificate verification renders.'],
];
drawTable(m1Headers, m1Rows, m1Widths, { fontSize: 6.8, rowHeight: 5 });

// ==============================================================================
// PAGE 6: MEMBER 2 TASK SHEET (BACKEND, APIS & BUSINESS LOGIC)
// ==============================================================================
doc.addPage();
y = 20;
addPageChrome();

addSectionTitle('6. Member 2 Task Sheet: Backend, APIs & Business Logic', 'OWNER: MEMBER 2');
addCalloutBox(
  'MEMBER 2 WORKSTREAM PROFILE',
  '• Primary Role: Lead Backend Engineer & Systems Architect\n• Git Branch: feature/member2-backend-apis\n• Core Ownership: SM-2 algorithm engine, email digest cron workers, certificate generation & validation, Stripe billing.\n• Shared Touchpoints: backend/src/index.ts, backend/src/services/contentCrons.ts',
  'info'
);

addSubSectionTitle('Assigned Tasks & Subtasks:');
addBullet('TASK M2-01 (GAP-01)', 'Spaced Repetition (SM-2) Scheduling Engine');
addParagraph('   • Implement sm2Service.ts: calculate new interval, repetitions, and easeFactor based on user quality rating (0-5).\n   • Build GET /api/flashcards/due (returns cards due today) and POST /api/flashcards/review.\n   • Add automatic card creation hook when QuizAttempt score is below 80%.');

addBullet('TASK M2-02 (GAP-05)', 'Automated Email Digest & Retention Worker');
addParagraph('   • Build emailService.ts using Nodemailer / Resend with HTML email templates.\n   • Implement weeklyDigestCron.ts running every Sunday at 08:00 UTC sending streak stats, weekly hours, and next lessons.\n   • Add user email notification preferences endpoint (PATCH /api/user/preferences/email).');

addBullet('TASK M2-03 (GAP-06)', 'Certificate Generation & Cryptographic Verification');
addParagraph('   • Implement certificateService.ts using PDFKit / jsPDF generating high-res diploma with SHA-256 signature.\n   • Build POST /api/certificates/generate/:roadmapId and GET /api/certificates/verify/:hash.');

addBullet('TASK M2-04 (GAP-07)', 'Subscription Tiers & Stripe Webhook Handler');
addParagraph('   • Build stripeService.ts for Pro/Student subscription checkout sessions.\n   • Implement POST /api/billing/webhook with signature verification handling invoice.paid and customer.subscription.deleted.');

const m2Headers = ['Task ID', 'Deliverable Module', 'Est. Hours', 'Dependencies', 'Acceptance Gate'];
const m2Widths = [22, 60, 24, 34, 38];
const m2Rows = [
  ['M2-01', 'backend/src/services/sm2Service.ts', '14h', 'M3-01 (Schema)', 'SM-2 intervals compute accurately.'],
  ['M2-02', 'backend/src/services/emailDigest.ts', '12h', 'M3-02 (User Prefs)', 'Digest emails deliver on schedule.'],
  ['M2-03', 'backend/src/services/certificate.ts', '10h', 'M3-03 (Cert Model)', 'SHA-256 signature verified.'],
  ['M2-04', 'backend/src/routes/billing.ts', '14h', 'M3-04 (Sub Model)', 'Stripe webhooks update user tiers.'],
];
drawTable(m2Headers, m2Rows, m2Widths, { fontSize: 6.8, rowHeight: 5 });

// ==============================================================================
// PAGE 7: MEMBER 3 TASK SHEET (DATABASE, LEARNING SYSTEM & CORE DATA)
// ==============================================================================
doc.addPage();
y = 20;
addPageChrome();

addSectionTitle('7. Member 3 Task Sheet: Database, Learning System & Core Data', 'OWNER: MEMBER 3');
addCalloutBox(
  'MEMBER 3 WORKSTREAM PROFILE',
  '• Primary Role: Lead Database Engineer & Data Architect\n• Git Branch: feature/member3-database-core\n• Core Ownership: Prisma schema extensions, database migrations, indexes, vector similarity queries, data integrity.\n• Shared Touchpoints: backend/prisma/schema.prisma, backend/src/lib/db.ts, backend/src/tests/setup.ts',
  'info'
);

addSubSectionTitle('Assigned Tasks & Subtasks:');
addBullet('TASK M3-01 (GAP-01, GAP-04)', 'Prisma Schema Extensions & Migrations');
addParagraph('   • Add Flashcard model: id, userId, dayId, front, back, easeFactor (Float @default(2.5)), interval (Int @default(0)), repetitions (Int @default(0)), dueDate (DateTime).\n   • Add TopicComment model: id, userId, topicId, parentId (nullable), content, upvotes (Int @default(0)), createdAt.\n   • Add Certificate model: id, userId, roadmapId, sha256Hash (unique), pdfUrl, issuedAt.\n   • Run npx prisma migrate dev and update mockDb in backend/src/tests/setup.ts.');

addBullet('TASK M3-02 (GAP-04)', 'Discussion Threads & Moderation Data Layer');
addParagraph('   • Build database queries for nested hierarchical comment trees with pagination.\n   • Implement database transactions for atomic comment upvoting and preventing duplicate user upvotes.');

addBullet('TASK M3-03 (GAP-09)', 'Semantic Vector Similarity & Tag Recommendation Engine');
addParagraph('   • Implement tag and topic similarity query in recommendationService.ts matching student difficulty and study history.\n   • Add composite indexes on Topic(dayId, title) and Progress(userId, completedAt) for query acceleration.');

const m3Headers = ['Task ID', 'Deliverable Module', 'Est. Hours', 'Dependencies', 'Acceptance Gate'];
const m3Widths = [22, 60, 24, 34, 38];
const m3Rows = [
  ['M3-01', 'backend/prisma/schema.prisma', '12h', 'None (Foundation)', 'Prisma migration clean, 0 orphans.'],
  ['M3-02', 'backend/src/routes/comments.ts', '12h', 'M3-01 (Schema)', 'Nested comments query < 50ms.'],
  ['M3-03', 'backend/src/services/recommendation.ts', '14h', 'M3-01 (Indexes)', 'Personalized recommendations return.'],
  ['M3-04', 'backend/src/tests/setup.ts', '6h', 'M3-01 (Schema)', 'All mockDb methods up-to-date.'],
];
drawTable(m3Headers, m3Rows, m3Widths, { fontSize: 6.8, rowHeight: 5 });

// ==============================================================================
// PAGE 8: MEMBER 4 TASK SHEET (ADVANCED FEATURES & COMMUNITY)
// ==============================================================================
doc.addPage();
y = 20;
addPageChrome();

addSectionTitle('8. Member 4 Task Sheet: Advanced Features & Community', 'OWNER: MEMBER 4');
addCalloutBox(
  'MEMBER 4 WORKSTREAM PROFILE',
  '• Primary Role: Lead Real-Time Systems & Community Engineer\n• Git Branch: feature/member4-collaboration-community\n• Core Ownership: Socket.io real-time server, WebRTC signaling, live study room sync, topic Q&A discussion engine.\n• Shared Touchpoints: backend/src/index.ts, frontend/src/components/Document/LivingDocument.tsx',
  'info'
);

addSubSectionTitle('Assigned Tasks & Subtasks:');
addBullet('TASK M4-01 (GAP-02)', 'Socket.io Real-Time Study Room Server');
addParagraph('   • Set up Socket.io server with Redis adapter for multi-instance horizontal scaling.\n   • Implement room lifecycle events: join-room, leave-room, timer-sync, chat-message, scratchpad-delta.\n   • Add heartbeat ping/pong mechanism to prune disconnected participants within 10s.');

addBullet('TASK M4-02 (GAP-02)', 'Collaborative Whiteboard / Scratchpad Sync');
addParagraph('   • Build operational broadcast protocol for shared study notes in active study rooms.\n   • Implement state conflict resolution so simultaneous typers do not overwrite each other.');

addBullet('TASK M4-03 (GAP-04)', 'Threaded Topic Discussion & Q&A Service');
addParagraph('   • Build backend controller for topic discussions: GET /api/topics/:topicId/comments, POST comments, POST upvote.\n   • Implement content moderation filter screening vulgarity and auto-flagging spam.');

const m4Headers = ['Task ID', 'Deliverable Module', 'Est. Hours', 'Dependencies', 'Acceptance Gate'];
const m4Widths = [22, 60, 24, 34, 38];
const m4Rows = [
  ['M4-01', 'backend/src/lib/socket.ts', '16h', 'M3-01 (DB)', 'Rooms support 50+ concurrent users.'],
  ['M4-02', 'backend/src/services/roomSync.ts', '14h', 'M4-01 (Socket)', 'Scratchpad syncs < 100ms latency.'],
  ['M4-03', 'backend/src/routes/comments.ts', '12h', 'M3-02 (DB Query)', 'Threaded replies & upvotes active.'],
];
drawTable(m4Headers, m4Rows, m4Widths, { fontSize: 6.8, rowHeight: 5 });

// ==============================================================================
// PAGE 9: MEMBER 5 TASK SHEET (TESTING, DEVOPS & PRODUCTION READINESS)
// ==============================================================================
doc.addPage();
y = 20;
addPageChrome();

addSectionTitle('9. Member 5 Task Sheet: Testing, DevOps & Production QA', 'OWNER: MEMBER 5');
addCalloutBox(
  'MEMBER 5 WORKSTREAM PROFILE',
  '• Primary Role: Lead QA, Security & DevOps Engineer\n• Git Branch: feature/member5-quality-devops\n• Core Ownership: Playwright E2E testing, Docker multi-stage hardening, database backup crons, Prometheus alerts, security audit.\n• Shared Touchpoints: backend/Dockerfile, docker-compose.yml, .github/workflows/ci.yml',
  'info'
);

addSubSectionTitle('Assigned Tasks & Subtasks:');
addBullet('TASK M5-01 (GAP-08)', 'Playwright End-to-End Test Suite');
addParagraph('   • Configure Playwright with test fixtures for authenticated student sessions.\n   • Implement E2E specs: e2e/auth-flow.spec.ts, e2e/study-flow.spec.ts (create roadmap -> study notes -> quiz -> pass -> streak update), e2e/admin-flow.spec.ts.\n   • Integrate Playwright runs into GitHub Actions CI pipeline.');

addBullet('TASK M5-02 (GAP-10)', 'Production Docker Hardening & Database Backup Automation');
addParagraph('   • Optimize backend and frontend multi-stage Dockerfiles with unprivileged non-root users and slim Node 20 base.\n   • Build automated PostgreSQL daily backup script (scripts/backup_db.sh) with S3 upload and retention pruning.\n   • Configure Prometheus alerts for 5xx spike (>1%), Redis memory (>80%), and DB connection pool saturation.');

addBullet('TASK M5-03 (GAP-08, GAP-10)', 'OWASP Security & Dependency Audit');
addParagraph('   • Audit JWT token validation, rate limiters, and CORS configurations.\n   • Run npm audit and automated vulnerability scans across all backend and frontend dependencies.');

const m5Headers = ['Task ID', 'Deliverable Module', 'Est. Hours', 'Dependencies', 'Acceptance Gate'];
const m5Widths = [22, 60, 24, 34, 38];
const m5Rows = [
  ['M5-01', 'frontend/e2e/*.spec.ts, CI workflow', '16h', 'All Feature Streams', 'E2E tests pass in headless CI.'],
  ['M5-02', 'Dockerfile, scripts/backup_db.sh', '12h', 'None', 'Docker image < 200MB, backups run.'],
  ['M5-03', 'Prometheus alerts & OWASP audit', '10h', 'None', '0 critical/high vulnerabilities.'],
];
drawTable(m5Headers, m5Rows, m5Widths, { fontSize: 6.8, rowHeight: 5 });

// ==============================================================================
// PAGE 10: OWNERSHIP MATRIX & CROSS-FUNCTIONAL WORKFLOW
// ==============================================================================
doc.addPage();
y = 20;
addPageChrome();

addSectionTitle('10. Cross-Functional Responsibility & Ownership Matrix');
addParagraph('To guarantee zero merge conflicts and absolute accountability, every remaining task has exactly ONE Primary Owner (P), with designated Reviewers (R), Dependencies (D), and Support (S).');

const matrixHeaders = ['Task ID & Description', 'Member 1 (UI)', 'Member 2 (API)', 'Member 3 (DB)', 'Member 4 (Realtime)', 'Member 5 (QA/DevOps)'];
const matrixWidths = [50, 25, 25, 25, 27, 26];
const matrixRows = [
  ['M1-01: Flashcards Study UI', 'PRIMARY (P)', 'Dependency (D)', 'Dependency (D)', '—', 'Review (R)'],
  ['M1-02: Study Room Layout', 'PRIMARY (P)', '—', '—', 'Dependency (D)', 'Review (R)'],
  ['M1-03: PWA Offline Caching', 'PRIMARY (P)', '—', '—', '—', 'Support (S)'],
  ['M2-01: SM-2 Algorithm Engine', 'Review (R)', 'PRIMARY (P)', 'Dependency (D)', '—', 'Review (R)'],
  ['M2-02: Email Digest Worker', '—', 'PRIMARY (P)', 'Dependency (D)', '—', 'Support (S)'],
  ['M2-03: Certificate Generation', 'Review (R)', 'PRIMARY (P)', 'Dependency (D)', '—', 'Review (R)'],
  ['M3-01: Prisma Schema & Migrations', '—', 'Dependency (D)', 'PRIMARY (P)', 'Dependency (D)', 'Review (R)'],
  ['M3-03: Vector Recommendations', 'Review (R)', 'Dependency (D)', 'PRIMARY (P)', '—', 'Review (R)'],
  ['M4-01: Socket.io Room Server', 'Dependency (D)', '—', 'Dependency (D)', 'PRIMARY (P)', 'Review (R)'],
  ['M4-03: Threaded Topic Q&A', 'Dependency (D)', '—', 'Dependency (D)', 'PRIMARY (P)', 'Review (R)'],
  ['M5-01: Playwright E2E Suite', 'Support (S)', 'Support (S)', 'Support (S)', 'Support (S)', 'PRIMARY (P)'],
  ['M5-02: Docker & Backup Automation', '—', '—', 'Dependency (D)', '—', 'PRIMARY (P)'],
];
drawTable(matrixHeaders, matrixRows, matrixWidths, { fontSize: 6.5, rowHeight: 4.8 });

addCalloutBox(
  'CONFLICT PREVENTION & WORKSTREAM BOUNDARY RULES',
  '1. Database migrations (Member 3) MUST be merged first before API or UI work begins.\n2. Members 1 and 4 work in separate route directories (/flashcards, /study-rooms, /verify) to prevent file contention.\n3. Shared stores (workspaceStore.ts) require PR approval from the Lead Architect before modifying.',
  'warning'
);

// ==============================================================================
// PAGE 11: DEPENDENCY MAP & IMPLEMENTATION PHASES
// ==============================================================================
doc.addPage();
y = 20;
addPageChrome();

addSectionTitle('11. Dependency Map & Sequential Execution Phases');
addParagraph('The implementation of the remaining 10 gaps follows a strict 5-phase dependency order:');

addSubSectionTitle('PHASE 1: Core Schema & Infrastructure Foundations (Days 1–5)');
addBullet('Deliverables', 'Prisma schema extensions (Flashcard, TopicComment, Certificate, SubscriptionTier), database migrations, mockDb updates, and Socket.io server skeleton.');
addBullet('Primary Owners', 'Member 3 (Database Lead) & Member 4 (Real-time Lead).');

addSubSectionTitle('PHASE 2: Backend Business Logic & Algorithmic Engines (Days 6–12)');
addBullet('Deliverables', 'SM-2 spaced repetition scheduler, certificate generation service, email digest worker, and Socket.io room lifecycle event handlers.');
addBullet('Primary Owners', 'Member 2 (Backend Lead) & Member 4 (Real-time Lead).');

addSubSectionTitle('PHASE 3: Frontend Interfaces & Interactive Canvases (Days 13–20)');
addBullet('Deliverables', 'Interactive flashcards study UI, virtual study room canvas with synced timer, PWA service worker, and topic discussion section.');
addBullet('Primary Owners', 'Member 1 (Frontend Lead) & Member 4 (Community Lead).');

addSubSectionTitle('PHASE 4: End-to-End Integration & Security Hardening (Days 21–25)');
addBullet('Deliverables', 'Playwright E2E test suite covering complete user journeys, OWASP dependency audit, and Stripe webhook integration.');
addBullet('Primary Owners', 'Member 5 (QA/DevOps Lead) & Member 2 (Backend Lead).');

addSubSectionTitle('PHASE 5: Production Deployment & Observability (Days 26–28)');
addBullet('Deliverables', 'Multi-stage Docker hardening, automated database backup cron verification, Prometheus alert rule configuration, and release sign-off.');
addBullet('Primary Owners', 'Member 5 (DevOps Lead) & Lead Architect.');

// ==============================================================================
// PAGE 12: 4-WEEK SPRINT PLAN
// ==============================================================================
doc.addPage();
y = 20;
addPageChrome();

addSectionTitle('12. 4-Week Sprint Plan (Weekly Execution Roadmap)');

const sprintHeaders = ['Week', 'Member 1 (UI)', 'Member 2 (API)', 'Member 3 (DB)', 'Member 4 (Realtime)', 'Member 5 (QA/DevOps)'];
const sprintWidths = [18, 32, 32, 32, 32, 32];
const sprintRows = [
  ['Week 1', 'PWA Service Worker setup & UI wireframes.', 'SM-2 algorithm design & email templates.', 'Prisma schema models & migrations (M3-01).', 'Socket.io server skeleton & Redis adapter.', 'Playwright test harness setup & CI config.'],
  ['Week 2', 'Flashcards UI (/flashcards) & card-flip.', 'SM-2 endpoints & Email digest cron worker.', 'TopicComment queries & recommendation engine.', 'Study room event sync & presence tracking.', 'Auth & study journey E2E specs.'],
  ['Week 3', 'Study room canvas & synced timer widget.', 'Certificate generator & QR verification.', 'Database index optimization & vacuuming.', 'Threaded topic Q&A & moderation API.', 'Docker multi-stage build & backup scripts.'],
  ['Week 4', 'Certificate viewer & PWA offline sync.', 'Stripe subscription webhook handler.', 'Data migration dry-run & schema lock.', 'Whiteboard conflict resolution & load test.', 'Full E2E regression run & security sign-off.'],
];
drawTable(sprintHeaders, sprintRows, sprintWidths, { fontSize: 6.5, rowHeight: 6 });

addCalloutBox(
  'WEEKLY SPRINT GATES & MILESTONES',
  '• End of Week 1: Database migrations merged; all local dev environments updated with new Prisma client.\n• End of Week 2: SM-2 and Socket.io endpoints active; flashcard UI connected to backend.\n• End of Week 3: Study rooms and certificates operational; E2E tests executing in CI.\n• End of Week 4: Zero regressions, 100% test pass rate, Docker images hardened for production release.',
  'info'
);

// ==============================================================================
// PAGE 13: GIT STRATEGY, PR WORKFLOW & QA PROTOCOL
// ==============================================================================
doc.addPage();
y = 20;
addPageChrome();

addSectionTitle('13. Git Strategy, Pull Request Protocol & Quality Assurance');

addSubSectionTitle('13.1 Branching Convention & Isolation');
addParagraph('Each member operates on an isolated feature branch branched directly from main:');
addBullet('Member 1', 'feature/member1-frontend-ux');
addBullet('Member 2', 'feature/member2-backend-apis');
addBullet('Member 3', 'feature/member3-database-core');
addBullet('Member 4', 'feature/member4-collaboration-community');
addBullet('Member 5', 'feature/member5-quality-devops');

addSubSectionTitle('13.2 Commit Message Standards (Conventional Commits)');
addParagraph('All commit messages must adhere to the Conventional Commits format:\n• feat(flashcards): implement 3D card-flip interaction with keyboard shortcuts\n• fix(sm2): correct interval calculation when quality rating is 3\n• test(e2e): add Playwright spec for complete roadmap study and quiz journey\n• chore(docker): add non-root user and optimize layer caching in Dockerfile');

addSubSectionTitle('13.3 Pull Request Acceptance Gate Checklist');
addParagraph('Every pull request must fulfill the following automated and peer-reviewed criteria before merging:\n[ ] 1. TypeScript compilation passes with 0 errors (npm run typecheck in backend & frontend).\n[ ] 2. All existing and new Vitest integration tests pass (npm test in backend).\n[ ] 3. No merge conflicts with main; rebased on latest main prior to PR submission.\n[ ] 4. All new API endpoints have Zod schema validation and rate limit guards.\n[ ] 5. Peer review approval from at least ONE other team member and Lead Architect.');

// ==============================================================================
// PAGE 14: TOP 20 REMAINING TASKS RANKING
// ==============================================================================
doc.addPage();
y = 20;
addPageChrome();

addSectionTitle('14. Top 20 Remaining Tasks Ranking (Prioritized Execution Backlog)');

const topHeaders = ['#', 'Task Title & Scope', 'Priority', 'Owner', 'Est. Hours', 'Core Justification'];
const topWidths = [8, 62, 16, 22, 18, 52];
const topRows = [
  ['1', 'M3-01: Prisma Schema Extensions (Flashcard, Cert, etc.)', 'P0', 'Member 3', '12h', 'Unblocks all backend and realtime feature streams.'],
  ['2', 'M2-01: SM-2 Spaced Repetition Algorithm Engine', 'P0', 'Member 2', '14h', 'Transforms passive quiz results into active recall.'],
  ['3', 'M4-01: Socket.io Real-Time Room Server & Handshake', 'P0', 'Member 4', '16h', 'Enables live peer collaboration and shared sessions.'],
  ['4', 'M1-01: Interactive Flashcards Study Canvas UI', 'P0', 'Member 1', '14h', 'Provides student study interface for spaced review.'],
  ['5', 'M1-02: Virtual Study Room Layout & Synced Timer', 'P0', 'Member 1', '18h', 'Delivers virtual study group experience.'],
  ['6', 'M5-01: Playwright End-to-End Test Suite in CI', 'P1', 'Member 5', '16h', 'Guarantees zero regressions across full student flows.'],
  ['7', 'M2-03: Certificate PDF Generator & Verification', 'P1', 'Member 2', '10h', 'Adds official credentialing for course completions.'],
  ['8', 'M4-03: Threaded Topic Q&A Discussion Engine', 'P1', 'Member 4', '12h', 'Enables peer discussion directly on study topics.'],
  ['9', 'M1-03: PWA Service Worker & Offline Storage', 'P1', 'Member 1', '12h', 'Allows study notes review without internet connectivity.'],
  ['10', 'M2-02: Weekly Email Digest & Retention Worker', 'P1', 'Member 2', '12h', 'Drives weekly learner re-engagement and streak reminders.'],
  ['11', 'M5-02: Production Docker Hardening & Backup Script', 'P1', 'Member 5', '12h', 'Secures production containers and automates DB dumps.'],
  ['12', 'M4-02: Collaborative Whiteboard State Sync', 'P1', 'Member 4', '14h', 'Allows synchronous note-taking in study rooms.'],
  ['13', 'M1-04: Public Certificate Verification Page (/verify)', 'P1', 'Member 1', '8h', 'Enables third-party credential verification.'],
  ['14', 'M3-02: Hierarchical Comment Queries & Upvoting', 'P1', 'Member 3', '12h', 'Ensures high performance on discussion threads.'],
  ['15', 'M2-04: Stripe Subscription Tiers & Webhooks', 'P2', 'Member 2', '14h', 'Enables Pro tier quota management and billing.'],
  ['16', 'M3-03: Semantic Vector Recommendation Service', 'P2', 'Member 3', '14h', 'Recommends content based on difficulty & history.'],
  ['17', 'M5-03: Prometheus Alert Rules & OWASP Audit', 'P2', 'Member 5', '10h', 'Monitors production error spikes and vulnerabilities.'],
  ['18', 'M3-04: Test Harness MockDB Updates', 'P1', 'Member 3', '6h', 'Maintains 100% test pass rate across new models.'],
  ['19', 'M1-05: Discussion Forum UI Component in Notes', 'P1', 'Member 1', '8h', 'Renders nested peer Q&A at bottom of lessons.'],
  ['20', 'M5-04: Release Candidate Validation & Smoke Tests', 'P0', 'Member 5', '8h', 'Final pre-launch verification across all browsers.'],
];
drawTable(topHeaders, topRows, topWidths, { fontSize: 6.2, rowHeight: 4.8 });

// ==============================================================================
// PAGE 15: FINAL PROJECT STATUS & TARGET STATE VISION
// ==============================================================================
doc.addPage();
y = 20;
addPageChrome();

addSectionTitle('15. Final Project Status & Target State Vision');

addSubSectionTitle('15.1 Current EdLearn Baseline Status');
addParagraph('• Completed & Verified: Multi-Factor Authentication (2FA), 7 Pedagogical AI Modes, Duo Podcast Audio Synthesis, Books/Media/News Curation Hubs, Universal Bookmarks, Cmd+K Global Search, Streak Calculation Engine, 365-Day Activity Heatmap, Interactive QuizRunner, Personal Notes Scratchpad, Role-Based Access Control, Admin Portal, In-App Notifications, and AI Failover Circuit Breaker.');
addParagraph('• Quality Baseline: 84/84 Vitest integration tests passing, 0 TypeScript compiler errors.');

addSubSectionTitle('15.2 Target State After Completion of 5-Member Plan');
addParagraph('Upon completion of the 4-week implementation plan, EdLearn will stand as a state-of-the-art, fully autonomous learning platform offering:\n1. Active Recall & Long-Term Mastery: Automatic conversion of quiz struggles into daily SM-2 flashcard review sessions.\n2. Synchronous Social Learning: Live peer study rooms with synchronized Pomodoro timers, shared whiteboards, and lesson Q&A.\n3. Offline Resilience: Full PWA support enabling uninterrupted note study and offline quiz caching.\n4. Certified Academic Credentials: Tamper-proof, cryptographically verifiable course completion certificates.\n5. Production-Hardened Infrastructure: Sub-200MB Docker containers, automated daily database backups, and complete Playwright E2E test coverage.');

// Sign-off Card
doc.setFillColor(...C.slate50);
doc.roundedRect(MARGIN, y + 4, CONTENT_W, 36, 2, 2, 'F');
doc.setDrawColor(...C.slate200);
doc.roundedRect(MARGIN, y + 4, CONTENT_W, 36, 2, 2, 'S');

doc.setFont('helvetica', 'bold');
doc.setFontSize(8.5);
doc.setTextColor(...C.slate900);
doc.text('ENGINEERING MANAGEMENT APPROVAL & SIGN-OFF', MARGIN + 6, y + 12);

doc.setFont('helvetica', 'normal');
doc.setFontSize(7.5);
doc.setTextColor(...C.slate600);
doc.text('Prepared by: Lead Software Architect, Product Analyst & Engineering Manager', MARGIN + 6, y + 19);
doc.text(`Approved for Sprint Execution: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, MARGIN + 6, y + 25);
doc.text('Target Release: EdLearn v2.0 Production Release Candidate', MARGIN + 6, y + 31);

doc.setFont('helvetica', 'bold');
doc.setFontSize(9);
doc.setTextColor(...C.blue600);
doc.text('[ APPROVED FOR SPRINT EXECUTION ]', PW - MARGIN - 65, y + 25);

const outputDir = path.resolve(__dirname, '../../');
const outputPath = path.join(outputDir, 'EdLearn_Team_Task_Assignments.pdf');
const outputPathAlt = path.join(outputDir, 'EdLearn_Remaining_Gaps_and_5_Member_Plan.pdf');

const pdfBytes = doc.output('arraybuffer');
fs.writeFileSync(outputPath, Buffer.from(pdfBytes));
fs.writeFileSync(outputPathAlt, Buffer.from(pdfBytes));

console.log(`✅ PDF successfully generated at:\n1. ${outputPath}\n2. ${outputPathAlt}`);
