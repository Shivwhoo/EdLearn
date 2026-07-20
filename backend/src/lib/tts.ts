import * as googleTTS from 'google-tts-api';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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
  // Strip HTML tags and markdown syntax before synthesising speech so the
  // audio player doesn't literally say "less-than p greater-than" etc.
  const plainText = text
    .replace(/<[^>]+>/g, ' ')          // HTML tags
    .replace(/[*_`#~>]+/g, ' ')        // Markdown punctuation
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Markdown links → label only
    .replace(/\s+/g, ' ')
    .trim();

  const cleanText = plainText.slice(0, 5000); // sanity cap on input size
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

/**
 * Generates (or reuses) an MP3 for a two-host podcast script by stitching
 * alternating voices together based on the speaker role. The Host is voiced
 * with a US English accent ('en') and the Expert with a UK accent ('en-GB')
 * so the two speakers are audibly distinct.
 *
 * The output filename is derived from a content hash of the (cleaned) script,
 * which gives us free, correct caching: an identical script reuses the exact
 * same file (no re-synthesis, no extra Google TTS calls), while any change to
 * the script produces a brand-new file — so we never serve stale audio for
 * updated content. This is intentionally decoupled from the database: the
 * caller may or may not have a real Topic row, and audio must work either way.
 */
export async function generatePodcastAudio(
  lines: { speaker: string; line: string }[]
): Promise<string> {
  const clean = (s: string) =>
    s
      .replace(/<[^>]+>/g, ' ')              // HTML tags
      .replace(/[*_`#~>]+/g, ' ')            // Markdown punctuation
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Markdown links → label only
      .replace(/\s+/g, ' ')
      .trim();

  // Normalise + drop empty turns before synthesis.
  const turns = (lines || [])
    .map((t) => ({ speaker: String(t?.speaker || 'Host'), line: clean(String(t?.line || '')) }))
    .filter((t) => t.line.length > 0);

  if (turns.length === 0) {
    throw new Error('Podcast script contained no speakable lines.');
  }

  // Content-addressed filename → identical scripts reuse the same audio file.
  const hash = crypto.createHash('sha1').update(JSON.stringify(turns)).digest('hex').slice(0, 16);
  const filename = `podcast_${hash}.mp3`;
  const filePath = path.join(AUDIO_DIR, filename);
  const publicUrl = `/api/tts/audio/${filename}`;

  // Cache hit: the file for this exact script already exists — serve it as-is.
  if (fs.existsSync(filePath)) {
    return publicUrl;
  }

  const buffers: Buffer[] = [];
  for (const turn of turns) {
    const lang = turn.speaker.toLowerCase() === 'host' ? 'en' : 'en-GB';

    // Google's TTS endpoint caps each request near 200 chars, so
    // getAllAudioUrls() splits a long line into multiple chunk URLs.
    const chunks = await (googleTTS as any).getAllAudioUrls(turn.line, {
      lang,
      slow: false,
      host: 'https://translate.google.com',
    });

    for (const chunk of chunks) {
      const response = await axios.get(chunk.url, { responseType: 'arraybuffer' });
      buffers.push(Buffer.from(response.data));
    }
  }

  const combined = Buffer.concat(buffers);
  fs.writeFileSync(filePath, combined);
  return publicUrl;
}
