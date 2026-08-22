import { IAIServiceProvider, GenerateOptions } from './types';
import { GroqProvider } from './providers/groqProvider';
import { GeminiProvider } from './providers/geminiProvider';
import { z } from 'zod';

const QuizSchema = z.object({
  questions: z.array(z.object({
    questionText: z.string(),
    options: z.array(z.string()).length(4),
    correctIndex: z.number().min(0).max(3),
    explanation: z.string().optional()
  })).length(3)
});

const FlashcardsSchema = z.object({
  flashcards: z.array(z.object({
    front: z.string(),
    back: z.string()
  })).min(5).max(10)
});

const EvaluationSchema = z.object({
  isCorrect: z.boolean(),
  explanation: z.string()
});

export class AIService implements IAIServiceProvider {
  private activeProvider: IAIServiceProvider | null = null;
  private providerName: string = 'GROQ';

  constructor() {
    // Provider is resolved lazily upon first query to prevent ES import hoisting issues
  }

  private getProvider(): IAIServiceProvider {
    if (!this.activeProvider) {
      this.providerName = process.env.AI_PROVIDER || 'GROQ';
      this.activeProvider = this.createProvider(this.providerName);
    }
    return this.activeProvider;
  }

  private createProvider(providerName: string): IAIServiceProvider {
    switch (providerName.toUpperCase()) {
      case 'GEMINI':
        return new GeminiProvider();
      case 'GROQ':
      default:
        return new GroqProvider();
    }
  }

  /**
   * Switches the active AI provider dynamically at runtime.
   * Useful for immediate fallbacks if rate limits are hit.
   * @param providerName The target provider ('GROQ' | 'GEMINI')
   * @param apiKey Optional custom API key to override environment settings.
   * @param model Optional custom model name to use.
   */
  public setProvider(providerName: 'GROQ' | 'GEMINI', apiKey?: string, model?: string) {
    this.providerName = providerName.toUpperCase();
    if (this.providerName === 'GEMINI') {
      this.activeProvider = new GeminiProvider(apiKey, model);
    } else {
      this.activeProvider = new GroqProvider(apiKey, model);
    }
  }

  /**
   * Returns the name of the currently active provider.
   */
  public getActiveProviderName(): string {
    this.getProvider();
    return this.providerName;
  }

  /**
   * Standard call to generate complete text responses.
   */
  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    return this.getProvider().generate(prompt, options);
  }

  /**
   * Streaming call to generate and pipe text chunks.
   */
  async generateStream(prompt: string, options?: GenerateOptions): Promise<ReadableStream<string>> {
    return this.getProvider().generateStream(prompt, options);
  }

  async generateQuiz(topicContent: string): Promise<z.infer<typeof QuizSchema>['questions']> {
    const prompt = `You are an expert educator. Generate a 3-question multiple choice quiz based on the following topic content.
Return ONLY strict JSON matching this schema: { "questions": [{ "questionText": "...", "options": ["...", "...", "...", "..."], "correctIndex": 0, "explanation": "..." }] }.
Content: ${topicContent}`;

    let response = await this.generate(prompt, { jsonMode: true });
    try {
      const parsed = JSON.parse(response);
      return QuizSchema.parse(parsed).questions;
    } catch (e) {
      console.warn('AI failed strict validation for quiz, retrying once...', e);
      const retryPrompt = `${prompt}\n\nCRITICAL: You must return valid JSON with exactly 3 questions, 4 options each, and a numeric correctIndex (0-3).`;
      response = await this.generate(retryPrompt, { jsonMode: true });
      const parsed = JSON.parse(response);
      return QuizSchema.parse(parsed).questions;
    }
  }

  async generateFlashcards(topicContent: string): Promise<z.infer<typeof FlashcardsSchema>['flashcards']> {
    const prompt = `You are an expert educator. Generate 5-10 spaced-repetition flashcards based on the following topic content.
Return ONLY strict JSON matching this schema: { "flashcards": [{ "front": "...", "back": "..." }] }.
Content: ${topicContent}`;

    let response = await this.generate(prompt, { jsonMode: true });
    try {
      const parsed = JSON.parse(response);
      return FlashcardsSchema.parse(parsed).flashcards;
    } catch (e) {
      console.warn('AI failed strict validation for flashcards, retrying once...', e);
      const retryPrompt = `${prompt}\n\nCRITICAL: You must return valid JSON with 5 to 10 flashcards containing 'front' and 'back' string fields.`;
      response = await this.generate(retryPrompt, { jsonMode: true });
      const parsed = JSON.parse(response);
      return FlashcardsSchema.parse(parsed).flashcards;
    }
  }

  async evaluateFlashcardAnswer(question: string, expectedAnswer: string, userAnswer: string): Promise<z.infer<typeof EvaluationSchema>> {
    const prompt = `You are a strict but fair tutor evaluating a flashcard answer.
Question: ${question}
Expected Answer: ${expectedAnswer}
Student's Typed Answer: ${userAnswer}

Determine if the student's answer demonstrates correct understanding. Be forgiving of minor typos or phrasing differences, but strict on core concepts.
Return ONLY strict JSON matching this schema: { "isCorrect": boolean, "explanation": "A short 1-2 sentence explanation of why it is correct or incorrect." }`;

    let response = await this.generate(prompt, { jsonMode: true, temperature: 0.1 });
    try {
      const parsed = JSON.parse(response);
      return EvaluationSchema.parse(parsed);
    } catch (e) {
      console.warn('AI failed strict validation for flashcard evaluation, retrying once...', e);
      const retryPrompt = `${prompt}\n\nCRITICAL: You must return valid JSON with boolean 'isCorrect' and string 'explanation'.`;
      response = await this.generate(retryPrompt, { jsonMode: true, temperature: 0.1 });
      const parsed = JSON.parse(response);
      return EvaluationSchema.parse(parsed);
    }
  }
}

// Global service singleton
export const aiService = new AIService();
export default aiService;
