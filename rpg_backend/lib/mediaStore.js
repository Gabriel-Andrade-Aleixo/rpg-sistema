import { query } from './postgres.js';

const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const maximumBytes = 2 * 1024 * 1024;

export async function createMediaAsset({ dataUrl, alt = '', uploadedBy }) {
  const match = String(dataUrl || '').match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([a-z0-9+/=\r\n]+)$/i);
  if (!match || !allowedTypes.has(match[1].toLowerCase())) throw mediaError('Envie uma imagem PNG, JPEG, WebP ou GIF.', 400);
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > maximumBytes) throw mediaError('A imagem deve ter no máximo 2 MB.', 413);
  const result = await query(
    `INSERT INTO media_assets (uploaded_by, mime_type, byte_size, content, alt_text)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, mime_type, byte_size, alt_text, created_at`,
    [uploadedBy, match[1].toLowerCase(), bytes.length, bytes, sanitizeAlt(alt)],
  );
  return mediaMetadata(result.rows[0]);
}

export async function getMediaAsset(id) {
  const result = await query(
    'SELECT id, mime_type, byte_size, content, alt_text, created_at FROM media_assets WHERE id = $1',
    [id],
  );
  return result.rows[0] || null;
}

export async function deleteMediaAsset(id) {
  const result = await query('DELETE FROM media_assets WHERE id = $1', [id]);
  if (!result.rowCount) throw mediaError('Imagem não encontrada.', 404);
}

function mediaMetadata(row) {
  return {
    id: row.id,
    mimeType: row.mime_type,
    byteSize: Number(row.byte_size || 0),
    alt: row.alt_text || '',
    createdAt: row.created_at,
  };
}

function sanitizeAlt(value) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 240);
}

function mediaError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
