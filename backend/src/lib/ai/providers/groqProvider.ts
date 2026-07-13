/**
 * GroqProvider — uses Node's built-in fetch (v18+) instead of groq-sdk's
 * bundled node-fetch, which has a gzip decompression bug on Node.js v24
 * that causes ERR_STREAM_PREMATURE_CLOSE on large responses.
 */
import { IAIServiceProvider, GenerateOptions } from '../types';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GroqRequestBody {
  model: string;
  messages: GroqMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  response_format?: { type: 'json_object' | 'text' };
}

async function groqFetch(body: GroqRequestBody, apiKey: string): Promise<Response> {
  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  return res;
}

export class GroqProvider implements IAIServiceProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model: string = 'llama-3.3-70b-versatile') {
    this.apiKey = apiKey || process.env.GROQ_API_KEY || '';
    this.model = model;
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    const messages: GroqMessage[] = [
      ...(options?.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
      { role: 'user' as const, content: prompt },
    ];

    // Fallback model chain: large → small (much higher TPM limit on free tier)
    const modelChain = [this.model, 'llama-3.1-8b-instant'];
    let lastError: any;

    for (const model of modelChain) {
      const body: GroqRequestBody = {
        model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4096,
        response_format: options?.jsonMode ? { type: 'json_object' } : undefined,
      };

      // Retry up to 3 times with smart rate-limit backoff
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const res = await groqFetch(body, this.apiKey);

          if (!res.ok) {
            const errText = await res.text();
            const err = new Error(`Groq API error ${res.status}: ${errText}`);
            (err as any).status = res.status;
            (err as any).errText = errText;
            throw err;
          }

          const data = await res.json() as any;
          if (model !== this.model) {
            console.warn(`[Groq] Used fallback model "${model}" due to rate limits on "${this.model}"`);
          }
          return data?.choices?.[0]?.message?.content || '';
        } catch (err: any) {
          lastError = err;
          console.error(`Groq attempt ${attempt} (model: ${model}) failed:`, err?.message || err);

          // Parse "try again in Xs" from the 429 error body
          if (err?.status === 429 || err?.message?.includes('429')) {
            const match = err.message?.match(/try again in ([\d.]+)(ms|s)/i);
            let waitMs = 5000; // default 5 s
            if (match) {
              const val = parseFloat(match[1]);
              waitMs = match[2].toLowerCase() === 'ms' ? val : val * 1000;
              waitMs += 500; // add 500 ms buffer
            }
            if (attempt < 3) {
              console.warn(`[Groq] Rate-limited on "${model}". Waiting ${(waitMs / 1000).toFixed(1)}s before retry...`);
              await new Promise(r => setTimeout(r, waitMs));
            }
          } else if (attempt < 3) {
            // Non-rate-limit errors: short exponential backoff
            await new Promise(r => setTimeout(r, 1000 * attempt));
          }
        }
      }

      // All retries on this model exhausted — try next model in chain
      console.warn(`[Groq] Switching from "${model}" to next fallback model...`);
    }

    throw lastError;
  }

  async generateStream(prompt: string, options?: GenerateOptions): Promise<ReadableStream<string>> {
    const messages: GroqMessage[] = [
      ...(options?.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
      { role: 'user' as const, content: prompt },
    ];

    const body: GroqRequestBody = {
      model: this.model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
      response_format: options?.jsonMode ? { type: 'json_object' } : undefined,
      stream: true,
    };

    const res = await groqFetch(body, this.apiKey);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Groq API error ${res.status}: ${errText}`);
    }

    if (!res.body) {
      throw new Error('Groq stream response body is null');
    }

    const decoder = new TextDecoder();
    const reader = res.body.getReader();

    return new ReadableStream<string>({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed === 'data: [DONE]') continue;
              if (!trimmed.startsWith('data: ')) continue;

              try {
                const parsed = JSON.parse(trimmed.slice(6));
                const content = parsed?.choices?.[0]?.delta?.content || '';
                if (content) controller.enqueue(content);
              } catch {
                // Ignore malformed SSE lines
              }
            }
          }
          controller.close();
        } catch (err) {
          console.error('Groq stream read error:', err);
          controller.error(err);
        }
      },
      cancel() {
        reader.cancel();
      },
    });
  }
}
