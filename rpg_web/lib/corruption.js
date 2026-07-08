export function corruptionValue(character) {
  return clamp(character?.resources?.corruption ?? 0, 0, 100);
}

export function corruptionStatus(character) {
  const corruption = corruptionValue(character);
  if (corruption >= 100) return { name: 'Manifestação Demoníaca', description: 'O pactuante morreu e o demônio assumiu sua forma verdadeira.', playable: false, demonicOnly: true, canCreateZone: false, lastOrder: false };
  if (corruption >= 95) return { name: 'Última Ordem', description: 'O combate deve terminar em 5 turnos. A Corrupção aumenta em +1 a cada turno.', playable: true, demonicOnly: true, canCreateZone: false, lastOrder: true };
  if (corruption >= 80) return { name: 'Zona Demoníaca', description: 'Pode criar uma zona de 10 a 50 metros. Poderes demoníacos têm vantagem, mas o corpo recebe dano adicional.', playable: true, demonicOnly: true, canCreateZone: true, lastOrder: false };
  if (corruption >= 50) return { name: 'Domínio Demoníaco', description: 'Só pode atacar com Magia Demoníaca. Dano e custo dessas magias escalam com a Corrupção.', playable: true, demonicOnly: true, canCreateZone: false, lastOrder: false };
  if (corruption >= 20) return { name: 'Ordens Diretas', description: 'O demônio pode exigir ações específicas. Desobedecer causa 2d20 de dano ou perda temporária dos poderes.', playable: true, demonicOnly: false, canCreateZone: false, lastOrder: false };
  return { name: 'Influência Mínima', description: 'Alterações mínimas e voz constante do demônio.', playable: true, demonicOnly: false, canCreateZone: false, lastOrder: false };
}

export function demonicDamageBonus(character) {
  return corruptionValue(character) >= 50 ? Math.floor(corruptionValue(character) / 10) : 0;
}

export function demonicSpellCost(character, baseCost) {
  return Math.max(0, Number(baseCost) || 0) + demonicDamageBonus(character);
}

export function demonicIncomingDamageBonus(character) {
  return character?.resources?.demonicZoneActive === 1 ? Math.floor(corruptionValue(character) / 15) : 0;
}

export function isDemonicSpell(spell) {
  return normalize(`${spell?.type || ''} ${spell?.school || ''}`).includes('demoni');
}

export function changeCorruption(character, delta, reason = '') {
  const before = corruptionValue(character);
  const after = clamp(before + Number(delta || 0), 0, 100);
  if (before === after) return character;
  const manifested = after >= 100;
  const record = {
    id: `corruption_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    before,
    after,
    reason: reason.trim() || 'Ajuste definido pelo mestre',
    createdAt: new Date().toISOString(),
  };
  return {
    ...character,
    currentHp: manifested ? 0 : character.currentHp,
    resources: {
      ...character.resources,
      corruption: after,
      demonicManifested: manifested ? 1 : 0,
      dead: manifested ? 1 : character.resources?.dead || 0,
      demonicZoneActive: after >= 80 && after < 95 ? character.resources?.demonicZoneActive || 0 : 0,
    },
    corruptionHistory: [record, ...(character.corruptionHistory || [])],
  };
}

export function advanceDemonicTurn(character) {
  if (!corruptionStatus(character).lastOrder) return character;
  return changeCorruption(character, 1, 'Turno da Última Ordem');
}

export function toggleDemonicZone(character) {
  if (!corruptionStatus(character).canCreateZone) return character;
  return { ...character, resources: { ...character.resources, demonicZoneActive: character.resources?.demonicZoneActive === 1 ? 0 : 1 } };
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value) || 0));
}

function normalize(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
