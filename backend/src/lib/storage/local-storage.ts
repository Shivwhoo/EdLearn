import fs from 'fs';
import path from 'path';
import type { StorageProvider, StorageUploadParams } from './storage.service';

// Same directory TTS has always used (backend/tts-audio), overridable via
// LOCAL_STORAGE_DIR. Preserves exact prior behavior for local development
// and any deployment that intentionally stays on local disk.
const LOCAL_DIR = process.env.LOCAL_STORAGE_DIR
  ? path.resolve(process.env.LOCAL_STORAGE_DIR)
  : path.join(__dirname, '../../../tts-audio');

/**
 * Default storage provider. Writes files to local disk and returns the same
 * `/api/tts/audio/<key>` URL shape the app has always used — that route is
 * mounted via express.static in index.ts and proxied by the frontend's
 * existing "/api/:path*" rewrite, so no frontend changes are needed.
 *
 * NOTE: local disk does not survive redeploys and is not shared across
 * replicas. It remains the default for zero-config local dev, but
 * STORAGE_PROVIDER=s3 is required for a correct multi-replica production
 * deployment (see hpa.yaml comments in k8s/).
 */
export class LocalStorageProvider implements StorageProvider {
  constructor() {
    if (!fs.existsSync(LOCAL_DIR)) {
      fs.mkdirSync(LOCAL_DIR, { recursive: true });
    }
  }

  async upload({ buffer, key }: StorageUploadParams): Promise<string> {
    try {
      const filePath = path.join(LOCAL_DIR, key);
      fs.writeFileSync(filePath, buffer);
      return `/api/tts/audio/${key}`;
    } catch (err) {
      throw new Error(
        `Local storage write failed for key "${key}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  async exists(key: string): Promise<boolean> {
    return fs.existsSync(path.join(LOCAL_DIR, key));
  }

  urlFor(key: string): string {
    return `/api/tts/audio/${key}`;
  }
}
