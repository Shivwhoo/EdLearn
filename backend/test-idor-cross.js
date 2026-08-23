const http = require('http');

async function main() {
  const emailA = `userA_${Date.now()}@example.com`;
  const emailB = `userB_${Date.now()}@example.com`;
  
  let tokenA = '', tokenB = '';

  // 1. Create two users
  for (const email of [emailA, emailB]) {
    try {
      let res = await fetch('http://localhost:5000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'Password123!', fullName: email })
      });
      let data = await res.json();
      if (email === emailA) tokenA = data.token;
      else tokenB = data.token;
    } catch(e) {
      console.error('Auth error', e);
      return;
    }
  }

  // 2. Setup a topic for User A via API
  console.log("Setting up topic for User A...");
  await fetch('http://localhost:5000/api/roadmap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ title: 'Test RM', goal: 'Test', difficulty: 'Beginner' })
  });
  
  const dashRes = await fetch('http://localhost:5000/api/dashboard/summary', {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const dashData = await dashRes.json();
  const dayId = dashData.activeDay.id;
  
  const genResTopic = await fetch('http://localhost:5000/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ topic: 'Test Topic', mode: 1, difficulty: 'Beginner', dayId })
  });
  const genDataTopic = await genResTopic.json();
  const topicId = genDataTopic.dbTopic.id;

  // 3. User A triggers flashcard generation to get a Job ID
  console.log("User A triggering flashcard generation for topic:", topicId);
  const genRes = await fetch(`http://localhost:5000/api/topics/${topicId}/flashcards/generate`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const genData = await genRes.json();
  const jobId = genData.jobId;

  if (!jobId) {
    console.log("Failed to get jobId", genData);
    process.exit(1);
  }
  
  console.log(`Generated Job ID (belongs to User A): ${jobId}`);

  // 4. Test IDOR: Try to fetch User A's job with User B's token
  console.log("\n--- IDOR TEST: User B fetching User A's job ---");
  const idorRes = await fetch(`http://localhost:5000/api/jobs/${jobId}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  
  console.log("Status:", idorRes.status);
  console.log("Response:", await idorRes.json());
}

main().catch(console.error).finally(() => process.exit(0));
