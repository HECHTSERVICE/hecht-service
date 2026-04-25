/**
 * Hecht Service — Daily Database Backup Cron Endpoint
 *
 * Triggered by Vercel Cron at 03:00 UTC daily (see vercel.json).
 * Creates JSON dump of all tables, gzips, uploads to Cloudflare R2,
 * applies GFS retention.
 *
 * Auth: Bearer token in Authorization header OR ?secret= query param.
 *       Both compared against CRON_SECRET env var.
 *
 * Runtime: nodejs (zlib, AWS SDK need Node, not Edge).
 * Max duration: 60s (default Vercel limit on Pro plan).
 */

import { NextResponse } from 'next/server';
import { runBackup } from '../../../../lib/backup';

export const runtime = 'nodejs';
export const maxDuration = 60;

function isAuthorized(request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  // 1. Check Authorization header (Vercel Cron sends this automatically)
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${expected}`) return true;

  // 2. Check ?secret= query param (for manual testing in browser)
  const { searchParams } = new URL(request.url);
  const secretParam = searchParams.get('secret');
  if (secretParam === expected) return true;

  return false;
}

export async function GET(request) {
  // Auth check
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Run backup
  try {
    const result = await runBackup();
    return NextResponse.json(result);
  } catch (err) {
    console.error('[backup] Failed:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Backup failed',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      },
      { status: 500 }
    );
  }
}
