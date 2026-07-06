export function humanityValue(character) {
  return clamp(character?.resources?.humanity ?? 100, 0, 100);
}

export function divinityValue(character) {
  return clamp(character?.resources?.divinity ?? 0, 0, 100);
}

export function humanityStatus(character, classEntry = null) {
  const humanity = humanityValue(character);
  if (humanity === 0) return { name: 'Manifestação Divina Total', description: 'Personagem injogável. Só pode ser ferido por Magia Divina e perde 1d20 de vida por turno.', difficulty: null, playable: false };
  if (humanity === 1) return { name: 'Estado de Avatar', description: 'Teste de controle a cada turno. Falha reduz a Humanidade para 0.', difficulty: null, playable: true };
  if (humanity <= 10) return { name: 'Humanidade crítica', description: 'Apenas Milagres reduzem Humanidade. Os bônus divinos continuam escalando.', difficulty: 19, playable: true };
  if (humanity <= 25) return { name: 'Domínio divino severo', description: 'Falha pode causar perda da ação, controle temporário e 1d20 de dano.', difficulty: 18, playable: true };
  if (humanity <= 50) return { name: 'Influência divina', description: 'Magias Divinas recebem dano base + Fé e bônus de acerto pela Divindade.', difficulty: 18, playable: true };
  if (humanity > 80) return { name: 'Humanidade plena', description: 'Sem influência divina suficiente para exigir teste de resistência.', difficulty: null, playable: true };
  const className = normalize(classEntry?.name || '');
  const divineClass = className === 'clerigo' || className === 'paladino';
  return { name: 'Humanidade estável', description: 'Transformações mínimas e sem bônus ofensivos especiais.', difficulty: divineClass ? 15 : 17, playable: true };
}

export function humanityResistanceBonus(character) {
  return Math.floor(humanityValue(character) / 10);
}

export function divineAccuracyBonus(character) {
  if (humanityValue(character) > 50) return 0;
  return Math.min(5, Math.floor(divinityValue(character) / 15));
}

export function hasFaithDamageBonus(character) {
  const humanity = humanityValue(character);
  return humanity >= 26 && humanity <= 50;
}

export function changeHumanity(character, delta, reason = '') {
  const beforeHumanity = humanityValue(character);
  const beforeDivinity = divinityValue(character);
  const afterHumanity = clamp(beforeHumanity + Number(delta || 0), 0, 100);
  const actualChange = afterHumanity - beforeHumanity;
  if (!actualChange) return character;
  const afterDivinity = clamp(beforeDivinity - actualChange, 0, 100);
  const record = {
    id: `humanity_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    humanityBefore: beforeHumanity,
    humanityAfter: afterHumanity,
    divinityBefore: beforeDivinity,
    divinityAfter: afterDivinity,
    reason: reason.trim() || 'Ajuste definido pelo mestre',
    createdAt: new Date().toISOString(),
  };
  return {
    ...character,
    resources: { ...character.resources, humanity: afterHumanity, divinity: afterDivinity },
    humanityHistory: [record, ...(character.humanityHistory || [])],
  };
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value) || 0));
}

function normalize(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
