export interface GenerateOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface IAIServiceProvider {
  /**
   * Generates a complete text response from the AI provider.
   * @param prompt The main user prompt.
   * @param options Execution settings (system prompt, temperature, jsonMode).
   */
  generate(prompt: string, options?: GenerateOptions): Promise<string>;

  /**
   * Generates a streaming text response from the AI provider.
   * @param prompt The main user prompt.
   * @param options Execution settings (system prompt, temperature, jsonMode).
   * @returns A ReadableStream emitting text chunks as strings.
   */
  generateStream(prompt: string, options?: GenerateOptions): Promise<ReadableStream<string>>;
}
