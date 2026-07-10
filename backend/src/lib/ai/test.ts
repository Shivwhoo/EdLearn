import { aiService } from './aiService';

async function testAI() {
  console.log('===================================================');
  console.log('Testing EdLearn AI Service Abstraction Layer...');
  console.log('===================================================');
  console.log('Active Default Provider:', aiService.getActiveProviderName());

  const prompt = 'Explain the concept of Socratic questioning in exactly one sentence.';

  console.log('\n--- Test 1: Standard Generation ---');
  try {
    const response = await aiService.generate(prompt, {
      systemPrompt: 'You are a helpful, direct pedagogical assistant.',
      temperature: 0.5,
    });
    console.log('Response Success!');
    console.log('Output:', response.trim());
  } catch (error) {
    console.log('Generation failed (expected if API keys are placeholders):');
    console.error(error instanceof Error ? error.message : error);
  }

  console.log('\n--- Test 2: Streaming Generation ---');
  try {
    const stream = await aiService.generateStream(prompt, {
      systemPrompt: 'You are a helpful, direct pedagogical assistant.',
      temperature: 0.5,
    });

    const reader = stream.getReader();
    let result = '';
    
    process.stdout.write('Stream Output: ');
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += value;
      process.stdout.write(value);
    }
    console.log('\nStream Success!');
  } catch (error) {
    console.log('Streaming failed (expected if API keys are placeholders):');
    console.error(error instanceof Error ? error.message : error);
  }
  console.log('===================================================');
}

testAI();
