import { IAIServiceProvider, GenerateOptions } from './types';
import { GroqProvider } from './providers/groqProvider';
import { GeminiProvider } from './providers/geminiProvider';
import { logger } from '../logger';

export class AIService implements IAIServiceProvider {
  private activeProvider: IAIServiceProvider | null = null;
  private fallbackProvider: IAIServiceProvider | null = null;
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

  private getFallbackProvider(): IAIServiceProvider {
    if (!this.fallbackProvider) {
      const fallbackName = this.providerName.toUpperCase() === 'GEMINI' ? 'GROQ' : 'GEMINI';
      this.fallbackProvider = this.createProvider(fallbackName);
    }
    return this.fallbackProvider;
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
      this.fallbackProvider = new GroqProvider();
    } else {
      this.activeProvider = new GroqProvider(apiKey, model);
      this.fallbackProvider = new GeminiProvider();
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
   * Standard call to generate complete text responses with automatic provider failover.
   */
  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    try {
      return await this.getProvider().generate(prompt, options);
    } catch (primaryError: any) {
      const isRateOrServerError =
        primaryError?.status === 429 ||
        primaryError?.status >= 500 ||
        primaryError?.message?.includes('429') ||
        primaryError?.message?.includes('rate limit') ||
        primaryError?.message?.includes('quota') ||
        primaryError?.message?.includes('overloaded');

      if (isRateOrServerError) {
        const fallbackName = this.providerName.toUpperCase() === 'GEMINI' ? 'GROQ' : 'GEMINI';
        logger?.warn?.(
          { primaryProvider: this.providerName, fallbackProvider: fallbackName, error: primaryError?.message },
          'Primary AI provider failed with rate limit or server error. Attempting failover to secondary provider.'
        );

        try {
          return await this.getFallbackProvider().generate(prompt, options);
        } catch (fallbackError) {
          logger?.error?.({ fallbackError }, 'Fallback AI provider also failed.');
          throw primaryError;
        }
      }

      throw primaryError;
    }
  }

  /**
   * Streaming call to generate and pipe text chunks.
   */
  async generateStream(prompt: string, options?: GenerateOptions): Promise<ReadableStream<string>> {
    try {
      return await this.getProvider().generateStream(prompt, options);
    } catch (primaryError: any) {
      try {
        return await this.getFallbackProvider().generateStream(prompt, options);
      } catch {
        throw primaryError;
      }
    }
  }
}

// Global service singleton
export const aiService = new AIService();
export default aiService;
