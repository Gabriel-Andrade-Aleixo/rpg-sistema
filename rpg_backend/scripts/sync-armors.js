import fs from 'node:fs';

loadDotEnv();

const key = process.env.TRELLO_API_KEY || '';
const token = process.env.TRELLO_TOKEN || '';
const boardId = process.env.TRELLO_BOARD_ID || '';
if (!key || !token || !boardId) throw new Error('Credenciais ou TRELLO_BOARD_ID ausentes no .env.');

const labels = {
  armor: ['Armadura', 'blue'],
  light: ['Armadura Leve', 'green'],
  medium: ['Armadura Média', 'yellow'],
  heavy: ['Armadura Pesada', 'red'],
  shield: ['Escudo', 'purple'],
};

const armors = [
  { name: 'Armadura de Couro', category: 'Leve', defense: 1, weight: 5, description: 'Proteção leve e flexível, adequada para mobilidade e furtividade.' },
  { name: 'Armadura de Couro Batido', category: 'Leve', defense: 2, weight: 7, description: 'Couro reforçado em camadas para absorver impactos sem limitar muito os movimentos.' },
  { name: 'Cota de Escamas', category: 'Média', defense: 3, weight: 12, description: 'Placas sobrepostas oferecem proteção intermediária e cobertura ampla.' },
  { name: 'Peitoral', category: 'Média', defense: 4, weight: 10, description: 'Placa metálica protege o torso mantendo braços e pernas relativamente livres.' },
  { name: 'Cota de Malha', category: 'Pesada', defense: 5, weight: 18, description: 'Malha metálica pesada que distribui o impacto por toda a superfície.' },
  { name: 'Armadura de Placas', category: 'Pesada', defense: 6, weight: 25, description: 'Conjunto completo de placas, oferecendo a maior proteção do catálogo inicial.' },
  { name: 'Escudo', category: 'Escudo', defense: 1, weight: 4, description: 'Proteção empunhada que pode ser combinada com uma armadura.' },
];

const listId = await ensureList('Equipamentos');
const labelIds = await ensureLabels();
for (const armor of armors) {
  const subtype = armor.category === 'Leve' ? 'light' : armor.category === 'Média' ? 'medium' : armor.category === 'Pesada' ? 'heavy' : 'shield';
  await upsertCard(listId, armor, [labelIds.armor, labelIds[subtype]]);
}
await archiveGeneratedDuplicates('Itens', listId);

console.log(`Armaduras sincronizadas: ${armors.length} cartões e ${Object.keys(labels).length} etiquetas.`);

async function ensureList(name) {
  const lists = await trello('GET', `/1/boards/${boardId}/lists`, { fields: 'name,closed' });
  const existing = lists.find((item) => normalize(item.name) === normalize(name) && !item.closed);
  if (existing) return existing.id;
  return (await trello('POST', '/1/lists', { idBoard: boardId, name })).id;
}

async function ensureLabels() {
  const existing = await trello('GET', `/1/boards/${boardId}/labels`, { fields: 'name,color', limit: 1000 });
  const result = {};
  for (const [id, [name, color]] of Object.entries(labels)) {
    const found = existing.find((item) => normalize(item.name) === normalize(name));
    result[id] = found?.id || (await trello('POST', '/1/labels', { idBoard: boardId, name, color })).id;
  }
  return result;
}

async function upsertCard(idList, armor, idLabels) {
  const cards = await trello('GET', `/1/lists/${idList}/cards`, { fields: 'name,closed', limit: 1000 });
  const card = cards.find((item) => normalize(item.name) === normalize(armor.name) && !item.closed);
  const metadata = {
    schemaVersion: 1,
    type: 'item',
    itemType: 'armor',
    armorCategory: armor.category.toLowerCase(),
    weight: armor.weight,
    modifiers: [{ targetType: 'stat', targetId: 'defense', value: armor.defense }],
  };
  const desc = `# ${armor.name}\n\n**Tipo:** Armadura ${armor.category}\n**Defesa:** +${armor.defense}\n**Peso:** ${armor.weight}\n\n${armor.description}\n\nO bônus de Defesa é aplicado somente enquanto o item estiver equipado.\n\n---\nMetadados usados automaticamente pelos aplicativos. Edite com cuidado.\n<!-- RPG_RULES_JSON_START -->\n${JSON.stringify(metadata, null, 2)}\n<!-- RPG_RULES_JSON_END -->`;
  const payload = { name: armor.name, desc, idLabels: idLabels.join(',') };
  if (card) await trello('PUT', `/1/cards/${card.id}`, payload);
  else await trello('POST', '/1/cards', { idList, ...payload });
}

async function archiveGeneratedDuplicates(listName, canonicalListId) {
  const lists = await trello('GET', `/1/boards/${boardId}/lists`, { fields: 'name,closed' });
  const list = lists.find((item) => normalize(item.name) === normalize(listName) && !item.closed);
  if (!list || list.id === canonicalListId) return;
  const names = new Set(armors.map((item) => normalize(item.name)));
  const cards = await trello('GET', `/1/lists/${list.id}/cards`, { fields: 'name,desc,closed', limit: 1000 });
  for (const card of cards) {
    if (!names.has(normalize(card.name)) || card.closed) continue;
    if (!card.desc.includes('"itemType": "armor"')) continue;
    await trello('PUT', `/1/cards/${card.id}`, { closed: true });
  }
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
