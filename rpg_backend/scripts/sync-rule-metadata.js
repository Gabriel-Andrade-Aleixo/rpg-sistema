import fs from 'node:fs';

loadDotEnv();

const key = process.env.TRELLO_API_KEY || '';
const token = process.env.TRELLO_TOKEN || '';
const boardId = process.env.TRELLO_BOARD_ID || '';
if (!key || !token || !boardId) throw new Error('Credenciais ou TRELLO_BOARD_ID ausentes no .env.');

const f = (base, terms = {}) => ({ base, terms });
const hp = (initial, fixed, roll, hybrid) => ({ initial, perLevel: { fixed, roll, hybrid } });
const progression = (from, to, grants) => ({ from, to, perLevel: grants });

const classes = {
  Barbaro: {
    id: 'barbarian', defense: f(0, { dexterity: .5, constitution: .5 }),
    hp: hp(f(20, { constitution: 3 }), f(8, { constitution: 1 }), { die: 12, ...f(0, { constitution: 1 }) }, { die: 6, ...f(6, { constitution: 1 }) }),
    attributeProgression: [progression(1, 3, { strength: 1 }), progression(4, 10, { strength: 1, constitution: 1 })],
    allowedCombatXpAttributes: ['strength', 'constitution', 'dexterity'],
  },
  Mago: {
    id: 'mage', defense: f(0, { dexterity: .7, constitution: .3 }),
    hp: hp(f(10, { constitution: 3 }), f(7, { constitution: 1 }), { die: 8, ...f(0, { constitution: 1 }) }, { die: 6, ...f(3, { constitution: 1 }) }),
    mana: f(10, { intelligence: 3 }),
    attributeProgression: [progression(1, 10, { intelligence: 1 })],
    allowedCombatXpAttributes: ['intelligence', 'charisma'],
  },
  'Arqueiro Espectral': {
    id: 'spectral_archer', defense: f(0, { constitution: .4, dexterity: .3, intelligence: .3 }),
    hp: hp(f(10, { constitution: 2, dexterity: 2 }), f(5, { constitution: 1 }), { die: 8, ...f(0, { constitution: 1 }) }, { die: 4, ...f(4, { constitution: 1 }) }),
    mana: f(15, { intelligence: 1, dexterity: 2 }), resources: [{ id: 'foco', name: 'Foco', maximum: f(6, { intelligence: 2 }) }, { id: 'cadencia', name: 'Cadência', maximum: f(3) }],
    actions: [
      { id: 'infusion_precision', name: 'Flecha de Precisão', manaCost: 1, focusCost: 1, damage: 'dano base do arco', effect: '+2 no teste de ataque; ignora penalidades leves' },
      { id: 'infusion_impact', name: 'Flecha de Impacto', manaCost: 2, focusCost: 1, damage: 'dano base +1; dano base +2 com 3 Cadência', effect: '+1 dano; +2 dano com 3 Cadência' },
      { id: 'infusion_piercing', name: 'Flecha Perfurante', manaCost: 2, focusCost: 1, damage: 'dano base +1', effect: 'Ignora redução leve/moderada; +1 dano' },
      { id: 'infusion_kinetic', name: 'Flecha Cinética', manaCost: 1, focusCost: 1, damage: 'dano base do arco', effect: 'Empurra o alvo ou aplica -1 movimento' },
      { id: 'infusion_spectral', name: 'Flecha Espectral', manaCost: 2, focusCost: 1, damage: 'dano base; no erro, 40% arredondado para baixo', effect: 'Se errar, causa 40% do dano' },
    ],
    infusionRules: { cadence2: '+1 efeito', cadence3: '-1 PM, mínimo 1', threeOrMoreAttacks: '+1 PM' },
    attributeProgression: [progression(1, 3, { dexterity: 1 }), progression(4, 10, { dexterity: 1, intelligence: 1 })],
    allowedCombatXpAttributes: ['dexterity', 'intelligence'],
  },
  'Maestro Tatico': {
    id: 'tactical_maestro', defense: f(0, { dexterity: .4, charisma: .4, intelligence: .2 }),
    hp: hp(f(10, { constitution: 3, charisma: 2 }), f(5, { constitution: 1 }), { die: 8, ...f(0, { constitution: 1 }) }, { die: 4, ...f(4, { constitution: 1 }) }),
    mana: f(7, { intelligence: 1, charisma: 3 }), resources: [{ id: 'compasso', name: 'Compasso', maximum: f(3) }],
    attributeProgression: [progression(1, 3, { charisma: 1 }), progression(4, 10, { charisma: 1, intelligence: 1 })],
    allowedCombatXpAttributes: ['charisma', 'intelligence'],
  },
  Clerigo: {
    id: 'cleric', defense: f(0, { dexterity: .2, constitution: .4, faith: .4 }),
    hp: hp(f(16, { constitution: 3 }), f(7, { constitution: 1 }), { die: 10, ...f(0, { constitution: 1 }) }, { die: 6, ...f(5, { constitution: 1 }) }),
    mana: f(10, { intelligence: 1, faith: 2 }),
    divineResistance: { formula: '1d20 + floor(Humanidade / 10)', difficulty: [{ from: 81, to: 100, value: null }, { from: 51, to: 80, value: 15 }, { from: 26, to: 50, value: 18 }, { from: 11, to: 25, value: 18 }, { from: 2, to: 10, value: 19 }] },
    attributeProgression: [progression(1, 3, { faith: 1 }), progression(4, 10, { faith: 1, intelligence: 1 })],
    allowedCombatXpAttributes: ['faith', 'intelligence'],
  },
  Paladino: {
    id: 'paladin', defense: f(0, { dexterity: .2, constitution: .4, faith: .4 }),
    hp: hp(f(18, { constitution: 3 }), f(8, { constitution: 1 }), { die: 12, ...f(0, { constitution: 1 }) }, { die: 6, ...f(6, { constitution: 1 }) }),
    divineResistance: { formula: '1d20 + floor(Humanidade / 10)', difficulty: [{ from: 81, to: 100, value: null }, { from: 51, to: 80, value: 15 }, { from: 26, to: 50, value: 18 }, { from: 11, to: 25, value: 18 }, { from: 2, to: 10, value: 19 }] },
    attributeProgression: [progression(1, 3, { faith: 1 }), progression(4, 10, { faith: 1, constitution: 1 })],
    allowedCombatXpAttributes: ['faith', 'strength', 'constitution', 'dexterity'],
  },
  Ladino: {
    id: 'rogue', defense: f(0, { constitution: .7, dexterity: .3 }),
    hp: hp(f(12, { constitution: 3 }), f(5, { constitution: 1 }), { die: 8, ...f(0, { constitution: 1 }) }, { die: 4, ...f(4, { constitution: 1 }) }),
    attributeProgression: [progression(1, 3, { dexterity: 1 }), progression(4, 10, { dexterity: 1, intelligence: 1 })],
    allowedCombatXpAttributes: ['dexterity', 'intelligence'],
  },
  Ranger: {
    id: 'ranger', defense: f(0, { constitution: .6, dexterity: .3, intelligence: .1 }),
    hp: hp(f(14, { constitution: 3 }), f(6, { constitution: 1 }), { die: 10, ...f(0, { constitution: 1 }) }, { die: 4, ...f(5, { constitution: 1 }) }),
    attributeProgression: [progression(1, 3, { dexterity: 1 }), progression(4, 10, { dexterity: 1, intelligence: 1 })],
    allowedCombatXpAttributes: ['dexterity', 'intelligence'],
  },
  Bardo: {
    id: 'bard', defense: f(0, { constitution: .5, charisma: .25, intelligence: .25 }),
    hp: hp(f(12, { constitution: 3 }), f(5, { constitution: 1 }), { die: 8, ...f(0, { constitution: 1 }) }, { die: 4, ...f(4, { constitution: 1 }) }),
    mana: f(10, { charisma: 1, intelligence: .5 }),
    attributeProgression: [progression(1, 3, { charisma: 1 }), progression(4, 10, { charisma: 1, constitution: 1 })],
    allowedCombatXpAttributes: ['charisma', 'constitution'],
  },
  Lutador: {
    id: 'fighter', defense: f(0, { constitution: .4, strength: .3, dexterity: .3 }),
    hp: hp(f(18, { constitution: 3 }), f(7, { constitution: 1 }), { die: 10, ...f(0, { constitution: 1 }) }, { die: 6, ...f(5, { constitution: 1 }) }),
    attributeProgression: [progression(1, 3, { strength: 1 }), progression(4, 10, { strength: 1, dexterity: 1 })],
    allowedCombatXpAttributes: ['strength', 'dexterity', 'constitution'],
  },
};

const races = {
  'Thri-kreen': {
    id: 'thri_kreen', attributeBonuses: { dexterity: 1 }, traits: ['Resistência a calor', 'Vulnerabilidade a ataques congelantes'],
    variants: [
      { id: 'four_arms', name: 'Quatro braços', skillRollBonuses: { furtividade: 1 }, traits: ['Ambidestria', 'Pode usar duas armas em cada mão; não pode usar dois arcos longos'] },
      { id: 'wings', name: 'Asas', attributeRollBonuses: { dexterity: 1 }, traits: ['Possui asas'] },
    ],
  },
  Vedalken: {
    id: 'vedalken', variants: [
      { id: 'common', name: 'Comum' },
      { id: 'spiritual', name: 'Espiritual', attributeBonuses: { intelligence: 1 }, skillBonuses: { percepcao: 1 }, abilities: ['Conversar com espíritos'] },
    ],
  },
  Lizardfolk: {
    id: 'lizardfolk', attributeBonuses: { strength: 1 }, statBonuses: { armorClass: 2 },
    traits: ['Levanta mais peso que o normal', 'Em regiões geladas perde 2m de deslocamento', 'Curas leves e médias recuperam no máximo 75% da vida; descanso longo cura tudo'],
  },
  Genasi: {
    id: 'genasi', skillBonuses: { religiao: 2 }, traits: ['Imunidade a fogo', 'Maior custo de humanidade sem luz solar', 'Família rica pode começar com artefato religioso de nível 2'],
  },
};

await updateCards('Classes', classes, 'class');
await updateCards('Racas', races, 'race');
console.log(`Metadados sincronizados: ${Object.keys(classes).length} classes e ${Object.keys(races).length} raças.`);

async function updateCards(listName, rules, type) {
  const lists = await trello('GET', `/1/boards/${boardId}/lists`, { fields: 'name,closed' });
  const list = lists.find((item) => normalize(item.name) === normalize(listName) && !item.closed);
  if (!list) throw new Error(`Lista não encontrada: ${listName}`);
  const cards = await trello('GET', `/1/lists/${list.id}/cards`, { fields: 'name,desc,closed', limit: 1000 });
  for (const [name, rule] of Object.entries(rules)) {
    const card = cards.find((item) => normalize(item.name) === normalize(name) && !item.closed);
    if (!card) throw new Error(`Cartão não encontrado em ${listName}: ${name}`);
    const metadata = { schemaVersion: 1, type, ...rule };
    const desc = replaceBlock(card.desc || '', metadata);
    await trello('PUT', `/1/cards/${card.id}`, { desc });
  }
}

function replaceBlock(description, metadata) {
  const start = '<!-- RPG_RULES_JSON_START -->';
  const end = '<!-- RPG_RULES_JSON_END -->';
  const clean = description.replace(new RegExp(`${start}[\\s\\S]*?${end}`, 'g'), '').trim();
  return `${clean}\n\n---\nMetadados usados automaticamente pelos aplicativos. Edite com cuidado.\n${start}\n${JSON.stringify(metadata, null, 2)}\n${end}`;
}

async function trello(method, path, payload = {}) {
  const url = new URL(path, 'https://api.trello.com');
  url.searchParams.set('key', key); url.searchParams.set('token', token);
  const options = { method };
  if (method === 'GET') for (const [name, value] of Object.entries(payload)) url.searchParams.set(name, String(value));
  else { options.headers = { 'Content-Type': 'application/json; charset=utf-8' }; options.body = JSON.stringify(payload); }
  const response = await fetch(url, options); const text = await response.text();
  if (!response.ok) throw new Error(`Trello ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

function normalize(value) { return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
function loadDotEnv() {
  const path = new URL('../.env', import.meta.url); if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim(); if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('='); if (index < 0) continue;
    const name = trimmed.slice(0, index).trim(); if (!process.env[name]) process.env[name] = trimmed.slice(index + 1).trim();
  }
}
