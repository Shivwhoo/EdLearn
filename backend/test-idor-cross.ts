import db from './src/lib/db';
import { enqueueAITask } from './src/lib/queue';

import { generateToken } from './src/lib/auth';

async function main() {
  const emailA = `userA_${Date.now()}@example.com`;
  const emailB = `userB_${Date.now()}@example.com`;
  
  // 1. Create two users in DB directly
  const userA = await db.user.create({ data: { email: emailA, passwordHash: 'hash' } });
  const userB = await db.user.create({ data: { email: emailB, passwordHash: 'hash' } });

  // 2. Generate tokens for them
  const tokenA = generateToken(userA);
  const tokenB = generateToken(userB);
  
  // 3. Enqueue a fake job using User A's ID
  const job = await enqueueAITask('generate_flashcards', { topicId: 'fake-topic' }, userA.id);
  const jobId = job.id;
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
