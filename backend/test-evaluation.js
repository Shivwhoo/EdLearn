const http = require('http');

async function main() {
  const email = 'test_eval2@example.com';
  let token = '';

  try {
    const signupRes = await fetch('http://localhost:5000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Password123!', fullName: 'Eval Test' })
    });
    const data = await signupRes.json();
    if (data.token) {
      token = data.token;
    } else {
      const loginRes = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'Password123!' })
      });
      const loginData = await loginRes.json();
      token = loginData.token;
    }
  } catch(e) {
    console.error('Auth error', e);
    return;
  }

  if (!token) {
    console.log("No token obtained.");
    return;
  }

  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient();
  
  const user = await db.user.findUnique({ where: { email }});
  
  let topic = await db.topic.findFirst({ where: { day: { roadmap: { userId: user.id } } } });
  if (!topic) {
    const rm = await db.roadmap.create({ data: { userId: user.id, title: 'Test RM', goal: 'Test', difficulty: 'Beginner' }});
    const day = await db.day.create({ data: { roadmapId: rm.id, dayNumber: 1, title: 'Test Day' }});
    topic = await db.topic.create({ data: { dayId: day.id, title: 'Test Topic', notesHtml: '{"content": "Mock notes"}' }});
  }

  let flashcard = await db.flashcard.findFirst({ where: { userId: user.id }});
  if (!flashcard) {
    flashcard = await db.flashcard.create({
      data: {
        userId: user.id,
        topicId: topic.id,
        front: 'What is the powerhouse of the cell?',
        back: 'The mitochondria is the powerhouse of the cell.',
        progress: { create: { userId: user.id } }
      }
    });
  }

  const flashcardId = flashcard.id;
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

  console.log(`Testing with Flashcard ID: ${flashcardId}`);

  console.log('\n--- Test 1: Lenient Correct (Typo) ---');
  let res1 = await fetch(`http://localhost:5000/api/flashcards/${flashcardId}/evaluate`, {
    method: 'POST', headers, body: JSON.stringify({ userAnswer: 'the mitocondria' })
  });
  console.log('Result:', await res1.json());

  console.log('\n--- Test 2: Corrective Incorrect ---');
  let res2 = await fetch(`http://localhost:5000/api/flashcards/${flashcardId}/evaluate`, {
    method: 'POST', headers, body: JSON.stringify({ userAnswer: 'the nucleus' })
  });
  console.log('Result:', await res2.json());

  console.log('\n--- Test 3: Graceful Error (Empty Input) ---');
  let res3 = await fetch(`http://localhost:5000/api/flashcards/${flashcardId}/evaluate`, {
    method: 'POST', headers, body: JSON.stringify({ userAnswer: '' })
  });
  console.log('Status:', res3.status);
  console.log('Result:', await res3.json());
}

main().catch(console.error).finally(() => process.exit(0));
