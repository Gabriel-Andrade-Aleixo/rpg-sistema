import fs from 'node:fs';

import { closePool } from '../lib/postgres.js';
import {
  metadataFromDescription,
  saveCharacterToDatabase,
  upsertCatalogEntry,
} from '../lib/catalogStore.js';

loadDotEnv();

const key = process.env.TRELLO_API_KEY || '';
const token = process.env.TRELLO_TOKEN || '';
const boardId = process.env.TRELLO_BOARD_ID || '';
const boardName = process.env.TRELLO_BOARD_NAME || 'GERENCIAMENTO RPG';

if (!key || !token) {
  throw new Error('Configure TRELLO_API_KEY e TRELLO_TOKEN somente para a migração única.');
}

try {
  const idBoard = boardId || await resolveBoard();
  const [lists, cards] = await Promise.all([
    trello('GET', `/1/boards/${idBoard}/lists`, { fields: 'name,closed,pos' }),
    trello('GET', `/1/boards/${idBoard}/cards`, {
      fields: 'name,desc,idList,labels,closed,url,idAttachmentCover,dateLastActivity',
      attachments: 'true',
      attachment_fields: 'name,url,previews,mimeType',
      limit: '1000',
    }),
  ]);
  const activeLists = lists.filter((list) => !list.closed);
  let catalogCount = 0;
  let characterCount = 0;

  for (const card of cards.filter((item) => !item.closed)) {
    const list = activeLists.find((item) => item.id === card.idList);
    if (!list) continue;
    if (normalize(list.name) === 'personagens') {
      const character = characterFromDescription(card.desc);
      if (!character?.id) continue;
      await saveCharacterToDatabase({
        ...character,
        name: character.name || card.name || 'Personagem sem nome',
        syncRevision: Number(character.syncRevision || 0),
        updatedAt: card.dateLastActivity || new Date().toISOString(),
      }, ['migration']);
      characterCount += 1;
      continue;
    }
    const attachments = (card.attachments || []).map((attachment) => ({
      id: attachment.id,
      name: attachment.name || '',
      url: attachment.url || '',
      mimeType: attachment.mimeType || '',
      previewUrl: largestPreviewUrl(attachment.previews || []),
    }));
    const cover = attachments.find((attachment) => attachment.id === card.idAttachmentCover);
    const firstImage = attachments.find((attachment) =>
      String(attachment.mimeType || '').startsWith('image/') || attachment.previewUrl,
    );
    await upsertCatalogEntry(list.name, {
      name: card.name,
      description: card.desc || '',
      labels: (card.labels || []).map((label) => ({
        id: label.id,
        name: label.name || '',
        color: label.color || '',
      })),
      imageUrl: cover?.previewUrl || cover?.url || firstImage?.previewUrl || firstImage?.url || '',
      attachments,
      sourceUrl: card.url || '',
      metadata: metadataFromDescription(card.desc || ''),
    });
    catalogCount += 1;
  }

  console.log(`Migração concluída: ${catalogCount} entrada(s) de catálogo e ${characterCount} personagem(ns).`);
} finally {
  await closePool();
}

async function resolveBoard() {
  const boards = await trello('GET', '/1/members/me/boards', { fields: 'name,closed' });
  const board = boards.find((item) => item.name === boardName && !item.closed);
  if (!board) throw new Error(`Quadro não encontrado: ${boardName}`);
  return board.id;
}

async function trello(method, path, payload = {}) {
  const url = new URL(path, 'https://api.trello.com');
  url.searchParams.set('key', key);
  url.searchParams.set('token', token);
  const options = { method };
  if (method === 'GET') {
    for (const [name, value] of Object.entries(payload)) url.searchParams.set(name, String(value));
  } else {
    options.headers = { 'Content-Type': 'application/json; charset=utf-8' };
    options.body = JSON.stringify(payload);
  }
  const response = await fetch(url, options);
  const text = await response.text();
  if (!response.ok) throw new Error(`Trello ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

function characterFromDescription(description) {
  const match = String(description || '').match(
    /<!-- RPG_CHARACTER_JSON_START -->([\s\S]*?)<!-- RPG_CHARACTER_JSON_END -->/,
  );
  if (!match) return null;
  try {
    return JSON.parse(match[1].trim());
  } catch {
    return null;
  }
}

function largestPreviewUrl(previews) {
  if (!previews.length) return '';
  return [...previews].sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url || '';
}

function normalize(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function loadDotEnv() {
  const path = new URL('../.env', import.meta.url);
  if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 0) continue;
    const name = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[name]) process.env[name] = value;
  }
}
