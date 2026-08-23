import { GoogleGenerativeAI } from '@google/generative-ai';
import { IAIServiceProvider, GenerateOptions } from '../types';

export class GeminiProvider implements IAIServiceProvider {
  private client: GoogleGenerativeAI;
  private modelName: string;

  constructor(apiKey?: string, modelName: string = 'gemini-3.6-flash') {
    const key = apiKey || process.env.GEMINI_API_KEY;
    this.client = new GoogleGenerativeAI(key || 'placeholder_key_if_not_configured');
    this.modelName = modelName;
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    try {
      const model = this.client.getGenerativeModel({ model: this.modelName });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options?.temperature ?? 0.7,
          maxOutputTokens: options?.maxTokens,
        },
        systemInstruction: options?.systemPrompt,
      });

      const response = await result.response;
      return response.text() || '';
    } catch (error) {
      console.error('Gemini generation error:', error);
      throw error;
    }
  }

  async generateStream(prompt: string, options?: GenerateOptions): Promise<ReadableStream<string>> {
    try {
      const model = this.client.getGenerativeModel({ model: this.modelName });
      const resultStream = await model.generateContentStream({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options?.temperature ?? 0.7,
          maxOutputTokens: options?.maxTokens,
        },
        systemInstruction: options?.systemPrompt,
      });

      return new ReadableStream<string>({
        async start(controller) {
          try {
            for await (const chunk of resultStream.stream) {
              const text = chunk.text();
              if (text) {
                controller.enqueue(text);
              }
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        }
      });
    } catch (error) {
      console.error('Gemini streaming error:', error);
      throw error;
    }
  }
}
