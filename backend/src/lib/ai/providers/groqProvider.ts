import Groq from 'groq-sdk';
import { IAIServiceProvider, GenerateOptions } from '../types';

export class GroqProvider implements IAIServiceProvider {
  private client: Groq;
  private model: string;

  constructor(apiKey?: string, model: string = 'llama-3.3-70b-versatile') {
    const key = apiKey || process.env.GROQ_API_KEY;
    this.client = new Groq({ apiKey: key || 'placeholder_key_if_not_configured' });
    this.model = model;
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          ...(options?.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
          { role: 'user' as const, content: prompt }
        ],
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
        response_format: options?.jsonMode ? { type: 'json_object' } : undefined,
      });
      return response.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('Groq generation error:', error);
      throw error;
    }
  }

  async generateStream(prompt: string, options?: GenerateOptions): Promise<ReadableStream<string>> {
    try {
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          ...(options?.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
          { role: 'user' as const, content: prompt }
        ],
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
        response_format: options?.jsonMode ? { type: 'json_object' } : undefined,
        stream: true,
      });

      return new ReadableStream<string>({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              const content = chunk.choices[0]?.delta?.content || '';
              if (content) {
                controller.enqueue(content);
              }
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        }
      });
    } catch (error) {
      console.error('Groq streaming error:', error);
      throw error;
    }
  }
}
