import crypto from 'node:crypto';
import { promisify } from 'node:util';

import { emailDeliveryConfigured, sendPasswordResetEmail } from './emailService.js';
import { query, transaction } from './postgres.js';

const pbkdf2 = promisify(crypto.pbkdf2);
const PASSWORD_ITERATIONS = 210_000;
const SESSION_DAYS = 30;
const RESET_MINUTES = 30;

export async function registerUser({ email, password, displayName }) {
  const normalizedEmail = normalizeEmail(email);
  assertPassword(password);
  const cleanName = sanitizeName(displayName) || normalizedEmail.split('@')[0];
  const passwordHash = await hashPassword(password);
  return transaction(async (client) => {
    const count = await client.query('SELECT count(*)::int AS total FROM rpg_users WHERE deleted_at IS NULL');
    const role = count.rows[0]?.total === 0 ? 'admin' : 'player';
    try {
      const created = await client.query(
        `INSERT INTO rpg_users (email, display_name, password_hash, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, display_name, role, created_at`,
        [normalizedEmail, cleanName, passwordHash, role],
      );
      const session = await createSessionWithClient(client, created.rows[0].id);
      return { user: userFromRow(created.rows[0]), ...session };
    } catch (error) {
      if (error?.code === '23505') {
        const duplicate = new Error('Já existe um usuário cadastrado com este email.');
        duplicate.statusCode = 409;
        throw duplicate;
      }
      throw error;
    }
  });
}

export async function loginUser({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const result = await query(
    `SELECT id, email, display_name, password_hash, role, created_at
     FROM rpg_users
     WHERE lower(email) = lower($1) AND deleted_at IS NULL`,
    [normalizedEmail],
  );
  const row = result.rows[0];
  if (!row || !await verifyPassword(password, row.password_hash)) {
    const error = new Error('Email ou senha inválidos.');
    error.statusCode = 401;
    throw error;
  }
  const session = await transaction((client) => createSessionWithClient(client, row.id));
  return { user: userFromRow(row), ...session };
}

export async function userFromBearerHeader(header) {
  const token = bearerToken(header);
  if (!token) return null;
  const tokenHash = hashToken(token);
  const result = await query(
    `SELECT u.id, u.email, u.display_name, u.role, u.created_at, s.id AS session_id
     FROM auth_sessions s
     JOIN rpg_users u ON u.id = s.user_id
     WHERE s.token_hash = $1
       AND s.expires_at > now()
       AND u.deleted_at IS NULL`,
    [tokenHash],
  );
  const row = result.rows[0];
  if (!row) return null;
  await query('UPDATE auth_sessions SET last_seen_at = now() WHERE id = $1', [row.session_id]);
  return userFromRow(row);
}

export async function logoutToken(header) {
  const token = bearerToken(header);
  if (!token) return;
  await query('DELETE FROM auth_sessions WHERE token_hash = $1', [hashToken(token)]);
}

export async function createPasswordReset({ email }) {
  const normalizedEmail = normalizeEmail(email);
  const emailConfigured = emailDeliveryConfigured();
  const result = await query(
    `SELECT id, email, display_name, role, created_at
     FROM rpg_users
     WHERE lower(email) = lower($1) AND deleted_at IS NULL`,
    [normalizedEmail],
  );
  const row = result.rows[0];
  if (!row) return { delivered: false, emailConfigured, resetToken: '' };
  const token = randomToken();
  await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + ($3 || ' minutes')::interval)`,
    [row.id, hashToken(token), RESET_MINUTES],
  );
  const user = userFromRow(row);
  const link = resetUrl(token);
  const delivery = await deliverPasswordReset({ user, token, resetUrl: link });
  return {
    delivered: delivery.delivered,
    emailConfigured: delivery.configured,
    resetToken: shouldExposeResetToken() ? token : '',
    resetUrl: link,
    user,
  };
}

export async function listUsersForAdmin() {
  const result = await query(
    `SELECT id, email, display_name, role, created_at
     FROM rpg_users
     WHERE deleted_at IS NULL
     ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, display_name, email`,
  );
  return result.rows.map(userFromRow);
}

export async function resetPassword({ token, password }) {
  assertPassword(password);
  const tokenHash = hashToken(token || '');
  return transaction(async (client) => {
    const result = await client.query(
      `SELECT id, user_id
       FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
       LIMIT 1`,
      [tokenHash],
    );
    const row = result.rows[0];
    if (!row) {
      const error = new Error('Token de recuperação inválido ou expirado.');
      error.statusCode = 400;
      throw error;
    }
    await client.query(
      'UPDATE rpg_users SET password_hash = $1, updated_at = now() WHERE id = $2',
      [await hashPassword(password), row.user_id],
    );
    await client.query('UPDATE password_reset_tokens SET used_at = now() WHERE id = $1', [row.id]);
    await client.query('DELETE FROM auth_sessions WHERE user_id = $1', [row.user_id]);
  });
}

export function publicUser(user) {
  return user ? {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    createdAt: user.createdAt,
  } : null;
}

export function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 180) {
    const error = new Error('Informe um email válido.');
    error.statusCode = 400;
    throw error;
  }
  return email;
}

async function createSessionWithClient(client, userId) {
  const token = randomToken();
  const inserted = await client.query(
    `INSERT INTO auth_sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + ($3 || ' days')::interval)
     RETURNING expires_at`,
    [userId, hashToken(token), SESSION_DAYS],
  );
  return { token, expiresAt: inserted.rows[0].expires_at };
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const derived = await pbkdf2(password, salt, PASSWORD_ITERATIONS, 32, 'sha256');
  return `pbkdf2_sha256$${PASSWORD_ITERATIONS}$${salt}$${derived.toString('base64url')}`;
}

async function verifyPassword(password, stored) {
  const [algorithm, iterations, salt, hash] = String(stored || '').split('$');
  if (algorithm !== 'pbkdf2_sha256' || !iterations || !salt || !hash) return false;
  const derived = await pbkdf2(String(password || ''), salt, Number(iterations), 32, 'sha256');
  const expected = Buffer.from(hash, 'base64url');
  return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
}

function assertPassword(password) {
  const value = String(password || '');
  if (value.length < 8 || value.length > 200) {
    const error = new Error('A senha precisa ter entre 8 e 200 caracteres.');
    error.statusCode = 400;
    throw error;
  }
}

function bearerToken(header) {
  const match = String(header || '').match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function randomToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function sanitizeName(value) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 120);
}

function userFromRow(row) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name || row.displayName || '',
    role: row.role || 'player',
    createdAt: row.created_at || row.createdAt || null,
  };
}

function shouldExposeResetToken() {
  return process.env.AUTH_EXPOSE_RESET_TOKEN === 'true' || (!process.env.VERCEL && process.env.NODE_ENV !== 'production');
}

function resetUrl(token) {
  const base = process.env.PASSWORD_RESET_BASE_URL || '';
  if (!base || !token) return '';
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}token=${encodeURIComponent(token)}`;
}

async function deliverPasswordReset({ user, token, resetUrl }) {
  if (!emailDeliveryConfigured()) return { delivered: false, configured: false };
  try {
    return await sendPasswordResetEmail({
      user,
      token,
      resetUrl,
      expiresMinutes: RESET_MINUTES,
    });
  } catch (error) {
    console.error('Falha ao enviar email de recuperação de senha.', error);
    return { delivered: false, configured: true };
  }
}
