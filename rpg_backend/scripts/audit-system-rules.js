import assert from 'node:assert/strict';
import fs from 'node:fs';

loadDotEnv();

const key = process.env.TRELLO_API_KEY || '';
const token = process.env.TRELLO_TOKEN || '';
const boardId = process.env.TRELLO_BOARD_ID || '';
if (!key || !token || !boardId) {
  throw new Error('Credenciais ou TRELLO_BOARD_ID ausentes no .env.');
}

const f = (base, terms = {}) => ({ base, terms });
const hp = (initial, fixed, roll, hybrid) => ({
  initial,
  perLevel: { fixed, roll, hybrid },
});
const p = (from, to, perLevel) => ({ from, to, perLevel });

const expectedClasses = {
  Barbaro: {
    id: 'barbarian',
    defense: f(0, { dexterity: .5, constitution: .5 }),
    hp: hp(f(20, { constitution: 3 }), f(8, { constitution: 1 }), { die: 12, ...f(0, { constitution: 1 }) }, { die: 6, ...f(6, { constitution: 1 }) }),
    attributeProgression: [p(1, 3, { strength: 1 }), p(4, 10, { strength: 1, constitution: 1 })],
    allowedCombatXpAttributes: ['strength', 'constitution', 'dexterity'],
    text: 'Híbrido: 6 + 1d6 + Constituição',
  },
  Mago: {
    id: 'mage',
    defense: f(0, { dexterity: .7, constitution: .3 }),
    hp: null,
    mana: f(10, { intelligence: 3 }),
    attributeProgression: [p(1, 10, { intelligence: 1 })],
    allowedCombatXpAttributes: ['intelligence', 'charisma'],
    text: 'Mana = 10 + (Inteligência × 3)',
  },
  'Arqueiro Espectral': {
    id: 'spectral_archer',
    defense: f(0, { constitution: .4, dexterity: .3, intelligence: .3 }),
    hp: hp(f(10, { constitution: 2, dexterity: 2 }), f(5, { constitution: 1 }), { die: 8, ...f(0, { constitution: 1 }) }, { die: 4, ...f(4, { constitution: 1 }) }),
    mana: f(15, { intelligence: 1, dexterity: 2 }),
    resources: [{ id: 'foco', name: 'Foco', maximum: f(6, { intelligence: 2 }) }, { id: 'cadencia', name: 'Cadência', maximum: f(3) }],
    attributeProgression: [p(1, 3, { dexterity: 1 }), p(4, 10, { dexterity: 1, intelligence: 1 })],
    allowedCombatXpAttributes: ['dexterity', 'intelligence'],
    text: 'Realiza 5 ataques',
  },
  'Maestro Tatico': {
    id: 'tactical_maestro',
    defense: f(0, { dexterity: .4, charisma: .4, intelligence: .2 }),
    hp: hp(f(10, { constitution: 3, charisma: 2 }), f(5, { constitution: 1 }), { die: 8, ...f(0, { constitution: 1 }) }, { die: 4, ...f(4, { constitution: 1 }) }),
    mana: f(7, { intelligence: 1, charisma: 3 }),
    resources: [{ id: 'compasso', name: 'Compasso', maximum: f(3) }],
    attributeProgression: [p(1, 3, { charisma: 1 }), p(4, 10, { charisma: 1, intelligence: 1 })],
    allowedCombatXpAttributes: ['charisma', 'intelligence'],
    text: 'Pode aplicar debuff uma segunda vez',
  },
  Clerigo: {
    id: 'cleric',
    defense: f(0, { dexterity: .2, constitution: .4, faith: .4 }),
    hp: hp(f(16, { constitution: 3 }), f(7, { constitution: 1 }), { die: 10, ...f(0, { constitution: 1 }) }, { die: 6, ...f(5, { constitution: 1 }) }),
    mana: f(10, { intelligence: 1, faith: 2 }),
    attributeProgression: [p(1, 3, { faith: 1 }), p(4, 10, { faith: 1, intelligence: 1 })],
    allowedCombatXpAttributes: ['faith', 'intelligence'],
    text: 'Mana = 10 + Inteligência + (Fé × 2)',
  },
  Paladino: {
    id: 'paladin',
    defense: f(0, { dexterity: .2, constitution: .4, faith: .4 }),
    hp: hp(f(18, { constitution: 3 }), f(8, { constitution: 1 }), { die: 12, ...f(0, { constitution: 1 }) }, { die: 6, ...f(6, { constitution: 1 }) }),
    attributeProgression: [p(1, 3, { faith: 1 }), p(4, 10, { faith: 1, constitution: 1 })],
    allowedCombatXpAttributes: ['faith', 'strength', 'constitution', 'dexterity'],
    text: 'Finalizar um combate sem gastar Humanidade',
  },
  Ladino: {
    id: 'rogue',
    defense: f(0, { constitution: .7, dexterity: .3 }),
    hp: hp(f(12, { constitution: 3 }), f(5, { constitution: 1 }), { die: 8, ...f(0, { constitution: 1 }) }, { die: 4, ...f(4, { constitution: 1 }) }),
    attributeProgression: [p(1, 3, { dexterity: 1 }), p(4, 10, { dexterity: 1, intelligence: 1 })],
    allowedCombatXpAttributes: ['dexterity', 'intelligence'],
    text: '1d20 + Inteligência + (Destreza ÷ 2)',
  },
  Ranger: {
    id: 'ranger',
    defense: f(0, { constitution: .6, dexterity: .3, intelligence: .1 }),
    hp: hp(f(14, { constitution: 3 }), f(6, { constitution: 1 }), { die: 10, ...f(0, { constitution: 1 }) }, { die: 4, ...f(5, { constitution: 1 }) }),
    attributeProgression: [p(1, 3, { dexterity: 1 }), p(4, 10, { dexterity: 1, intelligence: 1 })],
    allowedCombatXpAttributes: ['dexterity', 'intelligence'],
    text: 'Defesa = (Destreza × 60%) + (Constituição × 30%) + (Inteligência × 10%)',
  },
  Bardo: {
    id: 'bard',
    defense: f(0, { constitution: .5, charisma: .25, intelligence: .25 }),
    hp: hp(f(12, { constitution: 3 }), f(5, { constitution: 1 }), { die: 8, ...f(0, { constitution: 1 }) }, { die: 4, ...f(4, { constitution: 1 }) }),
    mana: f(10, { charisma: 1, intelligence: .5 }),
    attributeProgression: [p(1, 3, { charisma: 1 }), p(4, 10, { charisma: 1, constitution: 1 })],
    allowedCombatXpAttributes: ['charisma', 'constitution'],
    text: '10 + Carisma + (Inteligência ÷ 2)',
  },
};

const expectedRaces = {
  'Thri-kreen': { attributeBonuses: { dexterity: 1 }, variants: ['four_arms', 'wings'] },
  Vedalken: { variants: ['common', 'spiritual'] },
  Lizardfolk: { attributeBonuses: { strength: 1 }, statBonuses: { armorClass: 2 } },
  Genasi: { skillBonuses: { religiao: 2 } },
};

const expectedSkills = {
  Acrobacia: { dexterity: 90, strength: 10 },
  Medicina: { intelligence: 60, constitution: 40 },
  'Percepção': { intelligence: 90, faith: 10 },
  'Intimidação': { strength: 60, constitution: 30, charisma: 10 },
  'Religião': { faith: 100 },
  Furtividade: { dexterity: 70, intelligence: 30 },
};

const lists = await trello('GET', `/1/boards/${boardId}/lists`, { fields: 'name,closed' });
const classCards = await cardsFor('Classes');
const raceCards = await cardsFor('Racas');
const skillCards = await cardsFor('Perícias');
const systemCards = await cardsFor('Sistema');

for (const [name, expected] of Object.entries(expectedClasses)) {
  const card = findCard(classCards, name);
  assert.ok(card, `Cartão de classe ausente: ${name}`);
  const metadata = metadataOf(card);
  assert.equal(metadata?.type, 'class', `${name}: metadados de classe ausentes`);
  for (const field of ['id', 'defense', 'hp', 'mana', 'resources', 'attributeProgression', 'allowedCombatXpAttributes']) {
    if (!(field in expected)) continue;
    assert.deepEqual(metadata[field], expected[field], `${name}: ${field} diverge do documento`);
  }
  assert.ok(normalize(card.desc).includes(normalize(expected.text)), `${name}: descrição atualizada não encontrada`);
}

for (const [name, expected] of Object.entries(expectedRaces)) {
  const card = findCard(raceCards, name);
  assert.ok(card, `Cartão de raça ausente: ${name}`);
  const metadata = metadataOf(card);
  assert.equal(metadata?.type, 'race', `${name}: metadados de raça ausentes`);
  if (expected.variants) assert.deepEqual((metadata.variants || []).map((item) => item.id), expected.variants, `${name}: variantes`);
  if (expected.attributeBonuses) assert.deepEqual(metadata.attributeBonuses, expected.attributeBonuses, `${name}: atributos`);
  if (expected.statBonuses) assert.deepEqual(metadata.statBonuses, expected.statBonuses, `${name}: estatísticas`);
  if (expected.skillBonuses) assert.deepEqual(metadata.skillBonuses, expected.skillBonuses, `${name}: perícias`);
}

const attributeNames = {
  strength: 'forca', dexterity: 'destreza', constitution: 'constituicao',
  intelligence: 'inteligencia', charisma: 'carisma', faith: 'fe',
};
for (const [name, terms] of Object.entries(expectedSkills)) {
  const card = findCard(skillCards, name);
  assert.ok(card, `Cartão de perícia ausente: ${name}`);
  const description = normalize(card.desc);
  for (const [attribute, percent] of Object.entries(terms)) {
    assert.ok(description.includes(`${attributeNames[attribute]} ${percent}`), `${name}: peso de ${attribute} incorreto`);
  }
}

const humanityCard = findCard(systemCards, 'Humanidade e Divindade');
assert.ok(humanityCard, 'Cartão do sistema de Humanidade ausente');
assert.ok(normalize(humanityCard.desc).includes('humanidade 10'), 'Fórmula de Resistência Divina divergente');
const experienceCard = findCard(systemCards, 'Experiencia e Nivel');
assert.ok(experienceCard, 'Cartão do sistema de XP ausente');
assert.ok(normalize(experienceCard.desc).includes('participacao na sessao 1'), 'XP automático de participação ausente');

const unsupported = classCards
  .filter((card) => !metadataOf(card))
  .map((card) => card.name)
  .sort();
const unsupportedRaces = raceCards
  .filter((card) => !metadataOf(card))
  .map((card) => card.name)
  .sort();

console.log(`Auditoria concluída: ${Object.keys(expectedClasses).length} classes, ${Object.keys(expectedRaces).length} raças, ${Object.keys(expectedSkills).length} perícias, Humanidade e XP corretos.`);
console.log('Aviso conhecido: Mago não possui regras de HP no documento atual.');
console.log(`Classes de catálogo sem regras jogáveis: ${unsupported.join(', ') || 'nenhuma'}.`);
console.log(`Raças de catálogo sem regras jogáveis: ${unsupportedRaces.join(', ') || 'nenhuma'}.`);

async function cardsFor(listName) {
  const list = lists.find((item) => normalize(item.name) === normalize(listName) && !item.closed);
  assert.ok(list, `Lista ausente: ${listName}`);
  return trello('GET', `/1/lists/${list.id}/cards`, { fields: 'name,desc,closed', limit: 1000 });
}

function findCard(cards, name) {
  return cards.find((card) => !card.closed && normalize(card.name) === normalize(name));
}

function metadataOf(card) {
  const match = String(card?.desc || '').match(/<!-- RPG_RULES_JSON_START -->([\s\S]*?)<!-- RPG_RULES_JSON_END -->/);
  if (!match) return null;
  return JSON.parse(match[1].trim());
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
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
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
    if (!process.env[name]) process.env[name] = trimmed.slice(index + 1).trim();
  }
}
