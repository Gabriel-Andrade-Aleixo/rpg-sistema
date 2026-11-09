import { changeHumanity, faithDamageBonus } from './humanity.js';
import { demonicDamageBonus, demonicSpellCost, isDemonicSpell } from './corruption.js';

export const spectralInfusions = [
  { id: 'precision', name: 'Precisão', manaCost: 1, focusCost: 1, effect: '+2 no teste de ataque (+1 quando aplicada em mais de um ataque) e ignora penalidades leves.' },
  { id: 'impact', name: 'Impacto', manaCost: 2, focusCost: 1, effect: '+1 dano; com 3 Cadência, +2 dano.' },
  { id: 'piercing', name: 'Perfurante', manaCost: 2, focusCost: 1, effect: 'Ignora redução leve/moderada e causa +1 dano.' },
  { id: 'kinetic', name: 'Cinética', manaCost: 1, focusCost: 1, effect: 'Empurra o alvo ou aplica -1 movimento.' },
  { id: 'spectral', name: 'Espectral', manaCost: 2, focusCost: 1, effect: 'Ao acertar, pode encadear até 2 ataques em outros alvos a até 6m; os ataques extras não recebem infusão.' },
];

export const spectralSpellPresets = [
  { name: 'Flecha Mágica', type: 'Espectral', topic: 'Flecha Mágica', description: 'Disparo mágico básico do Arqueiro Espectral. Role 2d4 para determinar o dano.', damage: '2d4', range: 'Alcance do arco', manaCost: 0, focusCost: 0, humanityCost: 0, actionType: 'spectral_arrow', actionId: 'spectral_arrow' },
  ...spectralInfusions.map((infusion) => ({ name: `Infusão: ${infusion.name}`, type: 'Espectral', topic: 'Flecha Mágica · Aprimoramentos', description: infusion.effect, damage: infusion.id === 'impact' ? '2d4 +1; com 3 Cadência, 2d4 +2' : infusion.id === 'piercing' ? '2d4 +1' : infusion.id === 'spectral' ? '2d4; até 2 ataques encadeados' : '2d4', range: 'Alcance do arco', manaCost: infusion.manaCost, focusCost: infusion.focusCost, humanityCost: 0, actionType: 'spectral_infusion', actionId: infusion.id })),
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

export function infusionDamage(infusion, baseDamage, cadence = 0, cadenceDamage = 0) {
  const base = Math.max(0, Number(baseDamage) || 0);
  const cadenceBonus = Number(cadence) >= 3 ? Math.max(0, Number(cadenceDamage) || 0) : 0;
  if (infusion.id === 'impact') return { hit: base + 1 + cadenceBonus, miss: 0, cadenceBonus };
  if (infusion.id === 'piercing') return { hit: base + 1 + cadenceBonus, miss: 0, cadenceBonus };
  return { hit: base + cadenceBonus, miss: 0, cadenceBonus };
}

function actionRecord(name, manaSpent, focusSpent, humanitySpent, result = '') {
  return { id: `action_${Date.now()}_${Math.random().toString(16).slice(2)}`, name, manaSpent, focusSpent, humanitySpent, result, createdAt: new Date().toISOString() };
}

export function useInfusion(character, infusion, { baseDamage = 0, attacksThisTurn = 1, successful = true, critical = false, spellId = '' } = {}) {
  const cadence = Number(character.resources?.cadenciaCurrent || 0);
  const used = Number(character.resources?.infusionsThisTurn || 0);
  const limit = Math.min(4, Math.max(1, Number(attacksThisTurn) || 1));
  if (used >= limit) return { character, error: `Limite de ${limit} infusão(ões) neste turno.` };
  if (infusion.id === 'spectral' && character.resources?.spectralInfusionUsedThisTurn) return { character, error: 'A Infusão Espectral só pode ser usada em uma flecha por turno.' };
  const manaCost = infusionManaCost(infusion, cadence, attacksThisTurn);
  const focusCost = infusion.focusCost;
  if (Number(character.resources?.focoCurrent || 0) < focusCost) return { character, error: 'Foco insuficiente.' };
  const cadenceRoll = cadence >= 3 ? Math.floor(Math.random() * (critical ? 8 : 4)) + 1 : 0;
  const damage = infusionDamage(infusion, baseDamage, cadence, cadenceRoll);
  const attackBonus = infusion.id === 'precision' ? (Number(attacksThisTurn) > 1 ? 1 : 2) : 0;
  const chain = infusion.id === 'spectral' && successful ? 2 : 0;
  const cadenceEffect = cadence >= 2 ? ' Bônus de Cadência: +1 efeito e +1 no primeiro acerto.' : '';
  const damageEffect = baseDamage > 0 ? ` Dano no acerto: ${damage.hit}.${damage.cadenceBonus ? ` Cadência +${damage.cadenceBonus}.` : ''}` : '';
  const mana = spendManaOrHealth(character, manaCost);
  return {
    character: {
      ...mana.character,
      resources: { ...mana.character.resources, focoCurrent: character.resources.focoCurrent - focusCost, infusionsThisTurn: used + 1, spectralInfusionUsedThisTurn: infusion.id === 'spectral' || Boolean(character.resources?.spectralInfusionUsedThisTurn), cadenciaCurrent: successful ? Math.min(3, cadence + 1) : cadence },
      spells: (character.spells || []).map((spell) => spell.id === spellId ? { ...spell, successfulUses: Number(spell.successfulUses || 0) + (successful ? 1 : 0) } : spell),
      actionHistory: [actionRecord(`Flecha Mágica · Infusão ${infusion.name}`, manaCost, focusCost, 0, `${successful ? 'Sucesso' : 'Falha'}. ${infusion.effect}${attackBonus ? ` Bônus de acerto +${attackBonus}.` : ''}${chain ? ` Até ${chain} ataques encadeados.` : ''}${cadenceEffect}${damageEffect}${mana.healthSpent ? ` Mana insuficiente: ${mana.healthSpent} de Vida consumida.` : ''}`), ...(character.actionHistory || [])].slice(0, 30),
    },
    error: '',
    damage,
    attackBonus,
    chainAttacks: chain,
  };
}

export function advanceSpectralTurn(character, { attacked = true, tookDamage = false } = {}) {
  const cadence = Number(character.resources?.cadenciaCurrent || 0);
  return { ...character, resources: { ...character.resources, infusionsThisTurn: 0, spectralInfusionUsedThisTurn: false, cadenciaCurrent: !attacked || tookDamage ? Math.max(0, cadence - 1) : cadence, focoCurrent: Math.min(Number(character.resources?.focoMax || 0), Number(character.resources?.focoCurrent || 0) + 2) } };
}

export function useMagicArrow(character, spell, { successful = true, dice = null } = {}) {
  const damage = dice || magicArrowDamage();
  const cadence = Number(character.resources?.cadenciaCurrent || 0);
  return {
    character: {
      ...character,
      resources: { ...character.resources, cadenciaCurrent: successful ? Math.min(3, cadence + 1) : cadence },
      spells: (character.spells || []).map((item) => item.id === spell.id ? { ...item, successfulUses: Number(item.successfulUses || 0) + (successful ? 1 : 0) } : item),
      actionHistory: [actionRecord('Flecha Mágica', 0, 0, 0, `${successful ? 'Sucesso' : 'Falha'} · 2d4 = ${damage.dice.join(' + ')} = ${damage.total} de dano`), ...(character.actionHistory || [])].slice(0, 30),
    },
    error: '',
    damage,
  };
}

export function useSpell(character, spell, successful) {
  const demonic = isDemonicSpell(spell);
  const divine = String(spell.type || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === 'divina';
  const manaCost = demonic ? demonicSpellCost(character, spell.manaCost) : Number(spell.manaCost || 0);
  const corruptionBonus = demonic ? demonicDamageBonus(character) : 0;
  const divineBonus = divine ? faithDamageBonus(character) : 0;
  const requiredReligion = Number(spell.degree || spell.level || 0);
  if (divine && requiredReligion > religionGrade(character)) return { character, error: `Religião ${requiredReligion} é necessária para usar esta magia.` };
  if (Number(character.resources?.focoCurrent || 0) < Number(spell.focusCost || 0)) return { character, error: 'Foco insuficiente.' };
  if (Number(character.resources?.humanity ?? 100) < Number(spell.humanityCost || 0)) return { character, error: 'Humanidade insuficiente.' };
  const mana = spendManaOrHealth(character, manaCost);
  let next = { ...mana.character, resources: { ...mana.character.resources, focoCurrent: Number(character.resources?.focoCurrent || 0) - Number(spell.focusCost || 0) } };
  if (spell.humanityCost) next = changeHumanity(next, -Number(spell.humanityCost), `Magia: ${spell.name}`);
  next.spells = (next.spells || []).map((item) => item.id === spell.id ? { ...item, successfulUses: Number(item.successfulUses || 0) + (successful ? 1 : 0) } : item);
  const corruptionEffect = demonic && corruptionBonus ? ` · dano demoníaco +${corruptionBonus}` : '';
  const divineEffect = divine && divineBonus ? ` · dano divino +${divineBonus} (5% da Divindade)` : '';
  next.actionHistory = [actionRecord(spell.name, manaCost, Number(spell.focusCost || 0), Number(spell.humanityCost || 0), `${successful ? 'Sucesso' : 'Falha'}${corruptionEffect}${divineEffect}${mana.healthSpent ? ` · ${mana.healthSpent} de Vida consumida por falta de Mana` : ''}`), ...(next.actionHistory || [])].slice(0, 30);
  return { character: next, error: '', damageBonus: corruptionBonus + divineBonus };
}

export function religionValue(character) {
  const faith = Number(character.attributes?.faith || 0) + (character.modifiers || []).filter((item) => item.targetType === 'attribute' && item.targetId === 'faith').reduce((sum, item) => sum + Number(item.value || 0), 0);
  const minimum = (character.modifiers || []).filter((item) => item.targetType === 'skillMinimum' && String(item.targetId || '').includes('relig')).reduce((value, item) => Math.max(value, Number(item.value || 0)), 0);
  return Math.max(0, Math.floor(faith), minimum, Number(character.skillBonuses?.religiao || 0) + Math.floor(faith));
}

export function religionGrade(character) {
  const value = religionValue(character);
  return value >= 10 ? 3 : value >= 6 ? 2 : 1;
}

function spendManaOrHealth(character, cost) {
  const mana = Math.max(0, Number(character.currentMana || 0));
  const healthSpent = Math.max(0, Number(cost || 0) - mana);
  return { healthSpent, character: { ...character, currentMana: Math.max(0, mana - cost), currentHp: Math.max(0, Number(character.currentHp || 0) - healthSpent) } };
}
