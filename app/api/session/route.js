/**
 * Hecht Service — Session check endpoint
 * Повертає {valid, role, name} після перевірки cookie JWT.
 */

import { getSession } from '../../../lib/auth';

export async function GET(request) {
  const session = await getSession(request);

  if (!session) {
    return Response.json({ valid: false });
  }

  return Response.json({
    valid: true,
    role: session.role,
    name: session.name || null,
  });
}
