import { changeHumanity } from './humanity.js';

export const spectralInfusions = [
  { id: 'precision', name: 'Precisão', manaCost: 1, focusCost: 1, effect: '+2 no teste de ataque e ignora penalidades leves.' },
  { id: 'impact', name: 'Impacto', manaCost: 2, focusCost: 1, effect: '+1 dano; com 3 Cadência, +2 dano.' },
  { id: 'piercing', name: 'Perfurante', manaCost: 2, focusCost: 1, effect: 'Ignora redução leve/moderada e causa +1 dano.' },
  { id: 'kinetic', name: 'Cinética', manaCost: 1, focusCost: 1, effect: 'Empurra o alvo ou aplica -1 movimento.' },
  { id: 'spectral', name: 'Espectral', manaCost: 2, focusCost: 1, effect: 'Se errar o ataque, causa 40% do dano.' },
];

export const spectralSpellPresets = [
  { name: 'Flecha Mágica', type: 'Espectral', topic: 'Flecha Mágica', description: 'Disparo mágico básico do Arqueiro Espectral. Role 2d4 para determinar o dano.', damage: '2d4', range: 'Alcance do arco', manaCost: 0, focusCost: 0, humanityCost: 0, actionType: 'spectral_arrow', actionId: 'spectral_arrow' },
  ...spectralInfusions.map((infusion) => ({ name: `Infusão: ${infusion.name}`, type: 'Espectral', topic: 'Flecha Mágica · Aprimoramentos', description: infusion.effect, damage: infusion.id === 'impact' ? '2d4 +1; com 3 Cadência, 2d4 +2' : infusion.id === 'piercing' ? '2d4 +1' : infusion.id === 'spectral' ? '2d4; no erro, 40% do total' : '2d4', range: 'Alcance do arco', manaCost: infusion.manaCost, focusCost: infusion.focusCost, humanityCost: 0, actionType: 'spectral_infusion', actionId: infusion.id })),
];

export function magicArrowDamage(firstDie = null, secondDie = null) {
  const d1 = firstDie === null ? Math.floor(Math.random() * 4) + 1 : Math.min(4, Math.max(1, Number(firstDie) || 1));
  const d2 = secondDie === null ? Math.floor(Math.random() * 4) + 1 : Math.min(4, Math.max(1, Number(secondDie) || 1));
  return { dice: [d1, d2], total: d1 + d2 };
}

export function infusionManaCost(infusion, cadence = 0, attacksThisTurn = 1) {
  const cadenceReduction = Number(cadence) >= 3 ? 1 : 0;
  const multipleAttackPenalty = Number(attacksThisTurn) >= 3 ? 1 : 0;
  return Math.max(1, Number(infusion.manaCost) - cadenceReduction + multipleAttackPenalty);
}

export function infusionDamage(infusion, baseDamage, cadence = 0) {
  const base = Math.max(0, Number(baseDamage) || 0);
  if (infusion.id === 'impact') return { hit: base + (Number(cadence) >= 3 ? 2 : 1), miss: 0 };
  if (infusion.id === 'piercing') return { hit: base + 1, miss: 0 };
  if (infusion.id === 'spectral') return { hit: base, miss: Math.floor(base * .4) };
  return { hit: base, miss: 0 };
}

function actionRecord(name, manaSpent, focusSpent, humanitySpent, result = '') {
  return { id: `action_${Date.now()}_${Math.random().toString(16).slice(2)}`, name, manaSpent, focusSpent, humanitySpent, result, createdAt: new Date().toISOString() };
}

export function useInfusion(character, infusion, { baseDamage = 0, attacksThisTurn = 1, successful = true, spellId = '' } = {}) {
  const cadence = Number(character.resources?.cadenciaCurrent || 0);
  const manaCost = infusionManaCost(infusion, cadence, attacksThisTurn);
  const focusCost = infusion.focusCost;
  if (Number(character.currentMana || 0) < manaCost) return { character, error: 'Mana insuficiente.' };
  if (Number(character.resources?.focoCurrent || 0) < focusCost) return { character, error: 'Foco insuficiente.' };
  const cadenceEffect = cadence >= 2 ? ' Bônus de Cadência: +1 efeito.' : '';
  const damage = infusionDamage(infusion, baseDamage, cadence);
  const damageEffect = baseDamage > 0 ? ` Dano no acerto: ${damage.hit}.${infusion.id === 'spectral' ? ` Dano no erro: ${damage.miss}.` : ''}` : '';
  return {
    character: {
      ...character,
      currentMana: character.currentMana - manaCost,
      resources: { ...character.resources, focoCurrent: character.resources.focoCurrent - focusCost },
      spells: (character.spells || []).map((spell) => spell.id === spellId ? { ...spell, successfulUses: Number(spell.successfulUses || 0) + (successful ? 1 : 0) } : spell),
      actionHistory: [actionRecord(`Flecha Mágica · Infusão ${infusion.name}`, manaCost, focusCost, 0, `${successful ? 'Sucesso' : 'Falha'}. ${infusion.effect}${cadenceEffect}${damageEffect}`), ...(character.actionHistory || [])].slice(0, 30),
    },
    error: '',
  };
}

export function useMagicArrow(character, spell, { successful = true, dice = null } = {}) {
  const damage = dice || magicArrowDamage();
  return {
    character: {
      ...character,
      spells: (character.spells || []).map((item) => item.id === spell.id ? { ...item, successfulUses: Number(item.successfulUses || 0) + (successful ? 1 : 0) } : item),
      actionHistory: [actionRecord('Flecha Mágica', 0, 0, 0, `${successful ? 'Sucesso' : 'Falha'} · 2d4 = ${damage.dice.join(' + ')} = ${damage.total} de dano`), ...(character.actionHistory || [])].slice(0, 30),
    },
    error: '',
    damage,
  };
}

export function useSpell(character, spell, successful) {
  if (Number(character.currentMana || 0) < Number(spell.manaCost || 0)) return { character, error: 'Mana insuficiente.' };
  if (Number(character.resources?.focoCurrent || 0) < Number(spell.focusCost || 0)) return { character, error: 'Foco insuficiente.' };
  if (Number(character.resources?.humanity ?? 100) < Number(spell.humanityCost || 0)) return { character, error: 'Humanidade insuficiente.' };
  let next = { ...character, currentMana: character.currentMana - Number(spell.manaCost || 0), resources: { ...character.resources, focoCurrent: Number(character.resources?.focoCurrent || 0) - Number(spell.focusCost || 0) } };
  if (spell.humanityCost) next = changeHumanity(next, -Number(spell.humanityCost), `Magia: ${spell.name}`);
  next.spells = (next.spells || []).map((item) => item.id === spell.id ? { ...item, successfulUses: Number(item.successfulUses || 0) + (successful ? 1 : 0) } : item);
  next.actionHistory = [actionRecord(spell.name, Number(spell.manaCost || 0), Number(spell.focusCost || 0), Number(spell.humanityCost || 0), successful ? 'Sucesso' : 'Falha'), ...(next.actionHistory || [])].slice(0, 30);
  return { character: next, error: '' };
}
