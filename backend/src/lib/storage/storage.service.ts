// M2: Storage abstraction for durable media (TTS audio today; any future
// generated-file use tomorrow) instead of scattering S3/R2 calls throughout
// the app. Callers only ever talk to this module — never to fs or the AWS
// SDK directly — so swapping the backend is a one-line env var change.
//
// STORAGE_PROVIDER=local (default) → writes to disk, served by Express's
//   existing express.static mount. Fine for local dev / a single replica.
// STORAGE_PROVIDER=s3            → writes to S3 or an S3-compatible bucket
//   (Cloudflare R2, MinIO, etc.) using standard AWS SDK v3 env-based config.
//   Required for correctness once the backend runs with >1 replica, since a
//   file written to one pod's local disk is invisible to the others.

export interface StorageUploadParams {
  /** Raw file bytes to persist. */
  buffer: Buffer;
  /** Storage key / filename, e.g. "podcast_ab12cd34.mp3". Must be unique per object. */
  key: string;
  /** MIME type, defaults to audio/mpeg since TTS is the only current caller. */
  contentType?: string;
}

export interface StorageProvider {
  /** Persists the buffer and returns a stable, publicly-fetchable URL for it. */
  upload(params: StorageUploadParams): Promise<string>;
  /** Cheap existence check, used for content-hash caching (e.g. podcast audio). */
  exists(key: string): Promise<boolean>;
  /**
   * Deterministically derives the public URL for a key without any I/O.
   * Lets callers reuse an already-uploaded object (a cache hit) without
   * re-uploading, while still returning the correct URL for the active
   * provider (relative path for local, bucket/CDN URL for S3).
   */
  urlFor(key: string): string;
}

let cachedProvider: StorageProvider | null = null;

/**
 * Returns the process-wide storage provider, chosen once from
 * STORAGE_PROVIDER and cached. Throws only if STORAGE_PROVIDER=s3 is
 * requested without the required S3_BUCKET env var — local storage always
 * succeeds so local development is never blocked on cloud credentials.
 */
export function getStorageProvider(): StorageProvider {
  if (cachedProvider) return cachedProvider;

  const kind = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();

  if (kind === 's3') {
    // Lazy require: keeps @aws-sdk/client-s3 out of the local-dev path
    // entirely (no need to even have it installed) unless S3 is actually used.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { S3StorageProvider } = require('./s3-storage');
    cachedProvider = new S3StorageProvider();
  } else {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { LocalStorageProvider } = require('./local-storage');
    cachedProvider = new LocalStorageProvider();
  }

  return cachedProvider as StorageProvider;
}

/** Test-only escape hatch to reset the cached singleton between test runs. */
export function __resetStorageProviderForTests(): void {
  cachedProvider = null;
}
