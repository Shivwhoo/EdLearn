import { Worker, Job } from 'bullmq';
import { queueConnection } from '../lib/queue';
import db from '../lib/db';
import aiService from '../lib/ai/aiService';

export const aiWorker = new Worker(
  'ai-generation',
  async (job: Job) => {
    switch (job.name) {
      case 'generate_flashcards': {
        const { topicId, userId } = job.data;
        
        // 1. Fetch the topic
        const topic = await db.topic.findFirst({
          where: { id: topicId, day: { roadmap: { userId } } }
        });
        
        if (!topic) {
          throw new Error(`Topic not found or access denied for ID: ${topicId}`);
        }

        // 2. Data Cleanliness: Delete old flashcards for superseded topic versions in the same Day
        await db.flashcard.deleteMany({
          where: {
            topic: { dayId: topic.dayId },
            topicId: { not: topicId },
            userId
          }
        });

        // 3. Check if current topic already has flashcards (idempotency safety net)
        const existingCards = await db.flashcard.findMany({
          where: { userId, topicId },
          include: { progress: true }
        });
        
        if (existingCards.length > 0) {
          return { flashcards: existingCards };
        }

        // 4. Generate with AI
        const generatedCards = await aiService.generateFlashcards(topic.notesHtml);

        // 5. Persist to DB
        await db.$transaction(
          generatedCards.map(card => 
            db.flashcard.create({
              data: {
                userId,
                topicId,
                front: card.front,
                back: card.back,
                progress: { create: { userId } } 
              }
            })
          )
        );

        // 6. Fetch full result
        const savedFlashcards = await db.flashcard.findMany({
          where: { userId, topicId },
          include: { progress: true }
        });

        return { flashcards: savedFlashcards };
      }

      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  },
  { connection: queueConnection as any }
);

aiWorker.on('completed', (job: Job) => {
  console.log(`[BullMQ] Job ${job.id} (${job.name}) completed successfully.`);
});

aiWorker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(`[BullMQ] Job ${job?.id} (${job?.name}) failed:`, err);
});
