import crypto from 'node:crypto';

import { query, transaction } from './postgres.js';

export async function enforceRateLimit(scope, identifier, options = {}) {
  const maximum = Math.max(1, Number(options.maximum || 5));
  const windowSeconds = Math.max(30, Number(options.windowSeconds || 900));
  const blockSeconds = Math.max(windowSeconds, Number(options.blockSeconds || windowSeconds));
  const keyHash = crypto.createHash('sha256').update(String(identifier || 'unknown')).digest('hex');
  const result = await transaction(async (client) => {
    await client.query(
      `INSERT INTO auth_rate_limits (scope, key_hash)
       VALUES ($1, $2)
       ON CONFLICT (scope, key_hash) DO NOTHING`,
      [scope, keyHash],
    );
    const locked = await client.query(
      `SELECT attempts, window_started_at, blocked_until
       FROM auth_rate_limits
       WHERE scope = $1 AND key_hash = $2
       FOR UPDATE`,
      [scope, keyHash],
    );
    const row = locked.rows[0];
    const now = Date.now();
    const blockedUntil = row?.blocked_until ? new Date(row.blocked_until).getTime() : 0;
    if (blockedUntil > now) return { blocked: true, retryAfter: Math.ceil((blockedUntil - now) / 1000) };

    const startedAt = row?.window_started_at ? new Date(row.window_started_at).getTime() : 0;
    const expired = now - startedAt >= windowSeconds * 1000;
    const attempts = expired ? 1 : Number(row?.attempts || 0) + 1;
    const shouldBlock = attempts > maximum;
    const nextBlockedUntil = shouldBlock ? new Date(now + blockSeconds * 1000) : null;
    await client.query(
      `UPDATE auth_rate_limits
       SET attempts = $3,
           window_started_at = CASE WHEN $4 THEN now() ELSE window_started_at END,
           blocked_until = $5,
           updated_at = now()
       WHERE scope = $1 AND key_hash = $2`,
      [scope, keyHash, attempts, expired, nextBlockedUntil],
    );
    return { blocked: shouldBlock, retryAfter: shouldBlock ? blockSeconds : 0 };
  });

  if (Math.random() < 0.01) {
    transaction((client) => client.query("DELETE FROM auth_rate_limits WHERE updated_at < now() - interval '2 days'"))
      .catch(() => undefined);
  }
  if (result.blocked) {
    const error = new Error('Muitas tentativas. Aguarde antes de tentar novamente.');
    error.statusCode = 429;
    error.details = { code: 'RATE_LIMITED', retryAfter: result.retryAfter };
    throw error;
  }
}

export function requestIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket?.remoteAddress || 'unknown';
}

export async function clearRateLimit(scope, identifier) {
  const keyHash = crypto.createHash('sha256').update(String(identifier || 'unknown')).digest('hex');
  await query('DELETE FROM auth_rate_limits WHERE scope = $1 AND key_hash = $2', [scope, keyHash]);
}
