import './loadEnv';
import db from './lib/db';

async function testQuery() {
  console.log('Testing Topic findMany database query...');
  try {
    const topics = await db.topic.findMany({
      include: {
        citations: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    });
    console.log('Query success! Retreived topics count:', topics.length);
    console.log('Sample topic:', JSON.stringify(topics[0], null, 2));
  } catch (err: any) {
    console.error('Prisma query failed with error:');
    console.error(err.message || err);
  }
}

testQuery();
