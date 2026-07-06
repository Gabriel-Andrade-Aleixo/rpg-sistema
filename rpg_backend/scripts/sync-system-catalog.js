import fs from 'node:fs';

loadDotEnv();

const API_KEY = process.env.TRELLO_API_KEY || '';
const TOKEN = process.env.TRELLO_TOKEN || '';
const BOARD_ID = process.env.TRELLO_BOARD_ID || '';
const BOARD_NAME = process.env.TRELLO_BOARD_NAME || 'GERENCIAMENTO RPG';

if (!API_KEY || !TOKEN) throw new Error('Configure TRELLO_API_KEY e TRELLO_TOKEN no .env.');

const attributes = ['Força', 'Destreza', 'Constituição', 'Inteligência', 'Carisma', 'Fé'];
const skills = [
  ['Acrobacia', 'floor((Destreza × 90%) + (Força × 10%))', 'Destreza 90%; Força 10%.'],
  ['Medicina', 'floor((Inteligência × 60%) + (Constituição × 40%))', 'Inteligência 60%; Constituição 40%.'],
  ['Percepção', 'floor((Inteligência × 90%) + (Fé × 10%))', 'Inteligência 90%; Fé 10%.'],
  ['Intimidação', 'floor((Força × 60%) + (Constituição × 30%) + (Carisma × 10%))', 'Força 60%; Constituição 30%; Carisma 10%. A presença física e a resistência são predominantes.'],
  ['Religião', 'floor(Fé × 100%)', 'Fé 100%.'],
  ['Furtividade', 'floor((Destreza × 70%) + (Inteligência × 30%))', 'Destreza 70%; Inteligência 30%.'],
];

const boardId = await resolveBoard();
const attributesListId = await ensureList(boardId, 'Atributos');
const skillsListId = await ensureList(boardId, 'Perícias');
const systemListId = await ensureList(boardId, 'Sistema');

for (const name of attributes) {
  await upsertCard(attributesListId, name, attributeDescription(name));
}

for (const [name, formula, weights] of skills) {
  await upsertCard(skillsListId, name, skillDescription(name, formula, weights));
}

const systemCards = {
  'Atributos e Progressao': attributesSystemDescription(),
  'Pericias e Formulas': skillsSystemDescription(),
  'Experiencia e Nivel': experienceDescription(),
  'Humanidade e Divindade': humanityDescription(),
  'Classe de Armadura e Combate': armorClassDescription(),
  Sorte: luckDescription(),
};

for (const [name, description] of Object.entries(systemCards)) {
  await upsertCard(systemListId, name, description);
}

console.log(`Sincronização concluída: ${attributes.length} atributos, ${skills.length} perícias e ${Object.keys(systemCards).length} regras.`);

function attributeDescription(name) {
  return `# ${name}

**Tipo:** Atributo base
**Rolagem direta:** 1d20 + ${name}

## Distribuição inicial

- Cada personagem recebe 10 pontos totais para distribuir entre os seis atributos base.
- A raça pode alterar o valor inicial.
- Cada 1 ponto no atributo concede +1 nas rolagens daquele atributo.

## Custo de progressão

- Valor atual de +0 até +5: custa 1 ponto para receber +1.
- Valor atual de +6 até +10: custa 2 pontos para receber +1.
- Acima de +10: custa 5 pontos para receber +1, ou exige item, magia ou efeito especial.

## Limites

- Limite natural recomendado: +10.
- Limite absoluto: +20, reservado para entidades lendárias ou divinas.

Fonte: regras oficiais fornecidas pelo autor do sistema.`;
}

function skillDescription(name, formula, weights) {
  return `# ${name}

**Tipo:** Perícia
**Atributos e pesos:** ${weights}
**Fórmula:** ${formula}
**Rolagem:** 1d20 + valor da perícia

O resultado do cálculo é sempre arredondado para baixo.

## Progressão

- Evolui indiretamente quando seus atributos aumentam.
- A cada 20 XP acumulados na área correspondente, o jogador pode converter o XP em +1 permanente nesta perícia.
- Alternativamente, os 20 XP podem virar +1 em um atributo relacionado, com aprovação do mestre e respeitando o custo/limite do atributo.

Fonte: regras oficiais fornecidas pelo autor do sistema.`;
}

function attributesSystemDescription() {
  return `# Atributos e Progressão

## Atributos base

- Força
- Destreza
- Constituição
- Inteligência
- Carisma
- Fé

## Distribuição inicial

O personagem recebe 10 pontos totais. Cada ponto investido concede +1 nas rolagens do atributo. A raça pode alterar os valores iniciais.

## Custos

| Valor atual | Custo para +1 |
| --- | ---: |
| +0 a +5 | 1 ponto |
| +6 a +10 | 2 pontos |
| Acima de +10 | 5 pontos ou efeito especial |

Limite natural recomendado: +10. Limite absoluto: +20.`;
}

function skillsSystemDescription() {
  return `# Perícias e Fórmulas

Perícia = soma de cada atributo multiplicado por seu peso, sempre arredondada para baixo.

| Perícia | Fórmula |
| --- | --- |
| Acrobacia | Destreza 90% + Força 10% |
| Medicina | Inteligência 60% + Constituição 40% |
| Percepção | Inteligência 90% + Fé 10% |
| Intimidação | Força 60% + Constituição 30% + Carisma 10% |
| Religião | Fé 100% |
| Furtividade | Destreza 70% + Inteligência 30% |

Rolagem de perícia: 1d20 + valor da perícia.
Teste direto: 1d20 + atributo.`;
}

function experienceDescription() {
  return `# Experiência de Classe, Área e Combate

## XP de Classe por sessão

Todo personagem participante recebe +1 XP de Classe. O mestre soma os critérios aplicáveis:

| Critério | XP |
| --- | ---: |
| Participação na sessão | +1 |
| Combate fácil / médio / difícil / chefe | +1 / +2 / +3 / +4 a +5 |
| Ação inteligente ou estratégica | +1 |
| Uso criativo de habilidade ou classe | +1 |
| Boa interpretação | +1 |
| Momento marcante ou decisão relevante | +1 |
| Resolver problema importante | +2 |
| Avançar significativamente a narrativa | +2 a +3 |
| Decisão difícil com impacto | +1 a +2 |
| Completar objetivo da sessão | +2 |
| Completar objetivo pessoal | +1 a +2 |
| Destaque da sessão | +1 |

Custos: para atingir os níveis 2–5 são necessários 20 XP; para atingir os níveis 6–10 são necessários 40 XP; Excelência após o nível 10 custa 75 XP e exige o requisito da classe.

## Experiência por Área e Combate

XP não é um valor geral único. O personagem mantém XP separado por área e um contador de XP de combate.

## Fora de combate

Áreas sugeridas: Investigação, Coleta, Medicina, Religião, Furtividade, Diplomacia, Sobrevivência e outras definidas pelo mestre.

| Impacto na cena | XP |
| --- | ---: |
| Participação leve | 1 |
| Boa participação | 2 |
| Destaque claro | 3 |
| Performance excepcional | 4 |

A cada 20 XP em uma área, converta em +1 permanente na perícia específica ou +1 no atributo relacionado, mediante aprovação do mestre.

## Combate

XP recebido = XP base da dificuldade + XP individual de participação.

| Dificuldade | XP base |
| --- | ---: |
| Fácil | 1 |
| Moderado | 2 |
| Difícil | 3 |
| Mortal | 4 |

| Participação | XP extra |
| --- | ---: |
| Participou pouco | 1 |
| Participação moderada | 2 |
| Participou bastante | 3 |
| Carregou o combate | 4 |

O máximo em combate Mortal é 8 XP. Quem não participou recebe 0 XP.

A cada 25 XP de combate, converta em +1 em um atributo permitido pela classe. A escolha deve ser coerente com o estilo usado no combate e aprovada pelo mestre.`;
}

function humanityDescription() {
  return `# Humanidade e Divindade

Todo personagem possui Humanidade e Divindade entre 0 e 100. Ao gastar Humanidade, a Divindade aumenta na mesma proporção.

**Resistência Divina:** 1d20 + floor(Humanidade ÷ 10)

| Humanidade | Estado | CD | Efeitos principais |
| --- | --- | ---: | --- |
| 100–81 | Humanidade plena | — | Sem influência suficiente para exigir teste. |
| 80–51 | Humanidade estável | 17 | Transformações mínimas; Clérigo e Paladino usam CD 15 pela regra específica da classe. |
| 50–26 | Influência divina | 18 | Dano de Magia Divina recebe +Fé. Acerto divino = floor(Divindade ÷ 15), máximo +5. |
| 25–11 | Domínio divino severo | 18 | Falha pode causar perda da ação, controle temporário e 1d20 de dano. |
| 10–2 | Humanidade crítica | 19 | Apenas Milagres reduzem Humanidade; bônus continuam escalando. |
| 1 | Estado de Avatar | Especial | Teste de controle a cada turno; falha leva a Humanidade 0. |
| 0 | Manifestação Divina Total | — | Personagem injogável; só recebe dano de Magia Divina e perde 1d20 de vida por turno. |

Retorno da Manifestação ocorre apenas pelas condições descritas no sistema: morrer e passar nos testes de morte, ou outro Clérigo selar os poderes divinos.`;
}

function armorClassDescription() {
  return `# Classe de Armadura e Combate

**Defesa:** floor((Destreza × 70%) + (Constituição × 30%))

**Classe de Armadura:** CA = 10 + Defesa

O resultado da Defesa é sempre arredondado para baixo. Equipamentos, habilidades e efeitos podem aplicar modificadores adicionais quando estiverem explicitamente descritos em seus cartões.`;
}

function luckDescription() {
  return `# Sistema de Sorte

- Todos começam com Sorte 0.
- Sorte só vem de itens extremamente raros.
- Valor máximo: 3.
- Efeitos não se acumulam; prevalece o maior.
- A Sorte volta a 0 ao final da sessão ou após seu uso.

## Efeitos

- Sorte 1: repete uma rolagem qualquer uma vez por sessão; o segundo resultado é obrigatório.
- Sorte 2: adiciona +1 a uma rolagem, depois de rolar e antes da confirmação, uma vez por sessão.
- Sorte 3: repete o dano de um único ataque uma vez por sessão; o segundo resultado é obrigatório.`;
}

async function resolveBoard() {
  if (BOARD_ID) return BOARD_ID;
  const boards = await trello('GET', '/1/members/me/boards', { fields: 'name,closed' });
  const board = boards.find((item) => item.name === BOARD_NAME && !item.closed);
  if (!board) throw new Error(`Quadro não encontrado: ${BOARD_NAME}`);
  return board.id;
}

async function ensureList(idBoard, name) {
  const lists = await trello('GET', `/1/boards/${idBoard}/lists`, { fields: 'name,closed' });
  const existing = lists.find((item) => item.name === name && !item.closed);
  if (existing) return existing.id;
  return (await trello('POST', '/1/lists', { idBoard, name })).id;
}

async function upsertCard(idList, name, desc) {
  const cards = await trello('GET', `/1/lists/${idList}/cards`, { fields: 'name,closed', limit: 1000 });
  const matching = cards.filter((card) => normalize(card.name) === normalize(name) && !card.closed);
  if (matching.length) {
    await trello('PUT', `/1/cards/${matching[0].id}`, { name, desc });
    for (const duplicate of matching.slice(1)) await trello('PUT', `/1/cards/${duplicate.id}`, { closed: true });
    return;
  }
  await trello('POST', '/1/cards', { idList, name, desc });
}

async function trello(method, path, payload = {}) {
  const url = new URL(path, 'https://api.trello.com');
  url.searchParams.set('key', API_KEY);
  url.searchParams.set('token', TOKEN);
  const options = { method };
  if (method === 'GET' || method === 'DELETE') {
    for (const [key, value] of Object.entries(payload)) url.searchParams.set(key, String(value));
  } else {
    options.headers = { 'Content-Type': 'application/json; charset=utf-8' };
    options.body = JSON.stringify(payload);
  }
  const response = await fetch(url, options);
  const text = await response.text();
  if (!response.ok) throw new Error(`Trello respondeu ${response.status}: ${text}`);
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
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}
