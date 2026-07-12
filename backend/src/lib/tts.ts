import * as googleTTS from 'google-tts-api';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Files are written here and served back out via a static route mounted at
// /api/tts/audio in index.ts (that path is deliberately under /api so the
// existing frontend rewrite in next.config.ts, which proxies "/api/:path*"
// to the backend, picks it up automatically — no frontend config changes).
const AUDIO_DIR = path.join(__dirname, '../../tts-audio');

if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

/**
 * Generates a single MP3 file for the given text using google-tts-api,
 * which wraps Google Translate's public TTS endpoint (free, no API key).
 *
 * NOTE ON VERIFICATION: this uses google-tts-api's documented public API —
 * getAllAudioUrls() — from memory of its published README, since this
 * environment has no network access to the npm registry to re-check it
 * live. If the import shape or function name doesn't match what actually
 * installed, TypeScript will fail to compile with a clear "no exported
 * member" error right here — that's the one thing worth confirming on the
 * first run.
 *
 * Google's endpoint caps each request at roughly 200 characters, so
 * getAllAudioUrls() splits the input into multiple chunk URLs; this
 * function fetches every chunk's audio bytes and concatenates them into
 * one MP3 file. Simple byte-concatenation of MP3 frames is a common,
 * good-enough trick for playback — it is not perfectly gapless, but it
 * works correctly in a standard <audio> element.
 */
export async function generateSpeechFile(text: string, topicId: string): Promise<string> {
  const cleanText = text.replace(/\s+/g, ' ').trim().slice(0, 5000); // sanity cap on input size
  if (!cleanText) {
    throw new Error('No text provided to synthesize.');
  }

  const chunks = await (googleTTS as any).getAllAudioUrls(cleanText, {
    lang: 'en',
    slow: false,
    host: 'https://translate.google.com',
  });

  if (!Array.isArray(chunks) || chunks.length === 0) {
    throw new Error('google-tts-api returned no audio chunks for this text.');
  }

  const buffers: Buffer[] = [];
  for (const chunk of chunks) {
    const response = await axios.get(chunk.url, { responseType: 'arraybuffer' });
    buffers.push(Buffer.from(response.data));
  }

  const combined = Buffer.concat(buffers);
  const filename = `${topicId}.mp3`;
  const filePath = path.join(AUDIO_DIR, filename);
  fs.writeFileSync(filePath, combined);

  return `/api/tts/audio/${filename}`;
}
