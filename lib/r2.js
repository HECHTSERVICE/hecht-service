/**
 * Hecht Service — Cloudflare R2 Helper
 *
 * Server-side only. Lazy init S3 client (R2 is S3-compatible).
 * Used for daily database backups to hecht-backups bucket.
 *
 * Required env vars:
 *   R2_ENDPOINT          — https://[account-id].r2.cloudflarestorage.com
 *   R2_ACCESS_KEY_ID     — from R2 API token
 *   R2_SECRET_ACCESS_KEY — from R2 API token
 *   R2_BUCKET_NAME       — hecht-backups
 */

import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

let cachedClient = null;

function getR2Client() {
  if (typeof window !== 'undefined') {
    throw new Error('R2 client cannot run in browser — server-side only');
  }
  if (cachedClient) return cachedClient;

  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'R2 env vars missing — check Vercel: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY'
    );
  }

  cachedClient = new S3Client({
    region: 'auto', // R2 doesn't use regions
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });

  return cachedClient;
}

function getBucketName() {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    throw new Error('R2_BUCKET_NAME env var missing');
  }
  return bucket;
}

/**
 * Upload buffer to R2.
 * @param {string} key — object key (e.g. "backup-2026-04-25.json.gz")
 * @param {Buffer} body — file contents
 * @param {string} contentType — MIME type (default: application/gzip)
 * @returns {Promise<{key: string, size: number}>}
 */
export async function uploadToR2(key, body, contentType = 'application/gzip') {
  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return { key, size: body.length };
}

/**
 * List objects in R2 bucket with optional prefix filter.
 * @param {string} prefix — filter (e.g. "backup-")
 * @returns {Promise<Array<{key: string, size: number, lastModified: Date}>>}
 */
export async function listR2Objects(prefix = '') {
  const client = getR2Client();
  const result = await client.send(
    new ListObjectsV2Command({
      Bucket: getBucketName(),
      Prefix: prefix,
    })
  );
  return (result.Contents || []).map((obj) => ({
    key: obj.Key,
    size: obj.Size,
    lastModified: obj.LastModified,
  }));
}

/**
 * Delete object from R2.
 * @param {string} key — object key to delete
 */
export async function deleteFromR2(key) {
  const client = getR2Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: getBucketName(),
      Key: key,
    })
  );
}
