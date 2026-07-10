import { IAIServiceProvider, GenerateOptions } from './types';
import { GroqProvider } from './providers/groqProvider';
import { GeminiProvider } from './providers/geminiProvider';

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
}

// Global service singleton
export const aiService = new AIService();
export default aiService;
