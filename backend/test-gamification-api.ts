import axios from 'axios';
import db from './src/lib/db';
import { v4 as uuid } from 'uuid';

const PORT = 5000;
const BASE_URL = `http://localhost:${PORT}`;

async function main() {
  const userEmail = `testuser_${Date.now()}@example.com`;
  const userPassword = 'password123';

  console.log(`\n--- 1. Creating Test User ---`);
  // Signup
  const signupRes = await axios.post(`${BASE_URL}/api/auth/signup`, {
    email: userEmail,
    password: userPassword,
    fullName: 'Test User'
  });
  const token = signupRes.data.token;
  const userId = signupRes.data.user.id;
  console.log(`Signup Response:`, signupRes.data);

  // Setup DB prerequisites
  console.log(`\n--- 2. Setting up DB Data ---`);
  const roadmap = await db.roadmap.create({
    data: { userId, title: 'Test Roadmap', deadline: new Date() }
  });
  const day = await db.day.create({
    data: { roadmapId: roadmap.id, dayNumber: 1, title: 'Day 1', duration: 30 }
  });
  const topic = await db.topic.create({
    data: { dayId: day.id, title: 'Test Topic', mode: 1, notesHtml: '' }
  });
  const quiz = await db.quiz.create({
    data: { userId, topicId: topic.id }
  });
  await db.question.create({
    data: { quizId: quiz.id, questionText: 'Q1', options: ['A', 'B'], correctIndex: 0 }
  });
  const flashcard = await db.flashcard.create({
    data: { userId, topicId: topic.id, front: 'Front', back: 'Back' }
  });
  const fcProgress = await db.flashcardProgress.create({
    data: { flashcardId: flashcard.id, userId }
  });

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  console.log(`\n--- 3. Submitting Quiz (Expected: Success + XP) ---`);
  try {
    const quizSubmitRes = await axios.post(`${BASE_URL}/api/quiz/${quiz.id}/submit`, {
      answers: [0]
    }, authHeaders);
    console.log(`Response:`, quizSubmitRes.data);
  } catch (err: any) {
    console.error(`Error:`, err.response?.data || err.message);
  }

  console.log(`\n--- 4. Resubmitting Quiz (Expected: 409 Conflict) ---`);
  try {
    const quizSubmitRes2 = await axios.post(`${BASE_URL}/api/quiz/${quiz.id}/submit`, {
      answers: [0]
    }, authHeaders);
    console.log(`Response:`, quizSubmitRes2.data);
  } catch (err: any) {
    console.error(`Error ${err.response?.status}:`, err.response?.data || err.message);
  }

  console.log(`\n--- 5. Reviewing Flashcard (Expected: Success + XP) ---`);
  try {
    const fcReviewRes = await axios.post(`${BASE_URL}/api/flashcards/${flashcard.id}/review`, {
      rating: 'good'
    }, authHeaders);
    console.log(`Response:`, fcReviewRes.data);
  } catch (err: any) {
    console.error(`Error:`, err.response?.data || err.message);
  }

  console.log(`\n--- 6. Checking /api/auth/me (Expected: xp and streakCount > 0) ---`);
  try {
    const meRes = await axios.get(`${BASE_URL}/api/auth/me`, authHeaders);
    console.log(`XP:`, meRes.data.user.xp);
    console.log(`Streak:`, meRes.data.user.streakCount);
    console.log(`Full Response User Object:`, Object.keys(meRes.data.user));
  } catch (err: any) {
    console.error(`Error:`, err.response?.data || err.message);
  }

  // Cleanup
  await db.user.delete({ where: { id: userId } });
}

main().catch(console.error);
