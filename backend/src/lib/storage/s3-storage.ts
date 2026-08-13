import type { StorageProvider, StorageUploadParams } from './storage.service';

/**
 * S3 / S3-compatible (Cloudflare R2, MinIO, etc.) storage provider.
 *
 * Required env vars:
 *   STORAGE_PROVIDER=s3
 *   S3_BUCKET               - target bucket name
 * Optional env vars:
 *   S3_REGION               - defaults to "auto" (correct for R2; set a real
 *                              AWS region like "us-east-1" for AWS S3)
 *   S3_ENDPOINT              - custom endpoint, required for R2/MinIO
 *                              (e.g. https://<account-id>.r2.cloudflarestorage.com)
 *   S3_ACCESS_KEY_ID
 *   S3_SECRET_ACCESS_KEY
 *   S3_FORCE_PATH_STYLE      - "true" for MinIO/most non-AWS endpoints
 *   S3_PUBLIC_URL_BASE       - public base URL to prefix onto the object key
 *                              (a CDN domain, R2 public bucket URL, or
 *                              CloudFront distribution). Strongly recommended
 *                              in production — without it this falls back to
 *                              a best-effort AWS-shaped URL that will NOT be
 *                              correct for R2/MinIO.
 *
 * Credentials are read from env only. Never hardcode them here.
 */
export class S3StorageProvider implements StorageProvider {
  private client: import('@aws-sdk/client-s3').S3Client;
  private bucket: string;
  private publicUrlBase?: string;
  private region: string;
  private endpoint?: string;

  constructor() {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) {
      throw new Error(
        'STORAGE_PROVIDER=s3 requires S3_BUCKET to be set. Refusing to start with an unusable storage backend.'
      );
    }
    this.bucket = bucket;
    this.region = process.env.S3_REGION || 'auto';
    this.endpoint = process.env.S3_ENDPOINT;
    this.publicUrlBase = process.env.S3_PUBLIC_URL_BASE;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { S3Client } = require('@aws-sdk/client-s3');
    const hasExplicitCreds = Boolean(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);

    this.client = new S3Client({
      region: this.region,
      endpoint: this.endpoint,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      // If explicit keys aren't provided, fall through to the SDK's default
      // credential chain (IAM role, env, shared config) rather than passing
      // undefined credentials, which the SDK treats as "anonymous."
      ...(hasExplicitCreds
        ? {
          credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY_ID as string,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
          },
        }
        : {}),
    });
  }

  async upload({ buffer, key, contentType }: StorageUploadParams): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType || 'audio/mpeg',
        })
      );
    } catch (err) {
      throw new Error(
        `S3 upload failed for key "${key}" in bucket "${this.bucket}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
    return this.publicUrl(key);
  }

  async exists(key: string): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { HeadObjectCommand } = require('@aws-sdk/client-s3');
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  urlFor(key: string): string {
    return this.publicUrl(key);
  }

  private publicUrl(key: string): string {
    if (this.publicUrlBase) {
      return `${this.publicUrlBase.replace(/\/+$/, '')}/${key}`;
    }
    if (this.endpoint) {
      // Best-effort for R2/MinIO when no public URL base was configured.
      // This is very likely NOT publicly reachable without a public bucket
      // policy or CDN in front — set S3_PUBLIC_URL_BASE for a correct URL.
      return `${this.endpoint.replace(/\/+$/, '')}/${this.bucket}/${key}`;
    }
    // Standard AWS S3 virtual-hosted-style URL.
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }
}
