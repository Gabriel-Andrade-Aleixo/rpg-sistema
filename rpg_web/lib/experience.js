export const classXpCriteria = [
  ['participation', 'Participação na sessão', [0, 1]],
  ['combat', 'Combate', [0, 1, 2, 3, 4, 5]],
  ['strategy', 'Ação inteligente ou estratégica', [0, 1]],
  ['creativity', 'Uso criativo de habilidade/classe', [0, 1]],
  ['roleplay', 'Boa interpretação', [0, 1]],
  ['memorableMoment', 'Momento marcante', [0, 1]],
  ['importantProblem', 'Resolver problema importante', [0, 2]],
  ['storyProgress', 'Avanço significativo da narrativa', [0, 2, 3]],
  ['difficultDecision', 'Decisão difícil com impacto', [0, 1, 2]],
  ['sessionObjective', 'Objetivo da sessão', [0, 2]],
  ['personalObjective', 'Objetivo pessoal', [0, 1, 2]],
  ['highlight', 'Destaque da sessão', [0, 1]],
];

export function calculateClassSessionXp(raw = {}) {
  const breakdown = Object.fromEntries(classXpCriteria.map(([id, , allowed]) => {
    const value = Number(raw[id] || 0);
    return [id, allowed.includes(value) ? value : 0];
  }));
  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  const summary = classXpCriteria
    .filter(([id]) => breakdown[id] > 0)
    .map(([id, label]) => `${label} +${breakdown[id]}`)
    .join(' · ');
  return { breakdown, total, summary };
}
