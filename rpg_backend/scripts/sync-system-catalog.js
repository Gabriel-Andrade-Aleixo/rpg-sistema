import fs from 'node:fs';

import { closePool } from '../lib/postgres.js';
import { ensureCatalogCategories, upsertCatalogEntry } from '../lib/catalogStore.js';

loadDotEnv();

const attributes = ['Força', 'Destreza', 'Constituição', 'Inteligência', 'Carisma', 'Fé'];
const skills = [
  ['Acrobacia', 'floor((Destreza × 90%) + (Força × 10%))', 'Destreza 90%; Força 10%.'],
  ['Medicina', 'floor((Inteligência × 60%) + (Constituição × 40%))', 'Inteligência 60%; Constituição 40%.'],
  ['Percepção', 'floor((Inteligência × 90%) + (Fé × 10%))', 'Inteligência 90%; Fé 10%.'],
  ['Intimidação', 'floor((Força × 60%) + (Constituição × 30%) + (Carisma × 10%))', 'Força 60%; Constituição 30%; Carisma 10%. A presença física e a resistência são predominantes.'],
  ['Religião', 'floor(Fé × 100%)', 'Fé 100%.'],
  ['Furtividade', 'floor((Destreza × 70%) + (Inteligência × 30%))', 'Destreza 70%; Inteligência 30%.'],
];

try {
  await ensureCatalogCategories();

  for (const name of attributes) {
    await upsertCatalogEntry('Atributos', {
      name,
      description: attributeDescription(name),
      labels: [{ id: 'label_atributo', name: 'Atributo', color: 'blue' }],
      metadata: { schemaVersion: 1, type: 'attribute' },
    });
  }

  for (const [name, formula, weights] of skills) {
    await upsertCatalogEntry('Perícias', {
      name,
      description: skillDescription(name, formula, weights),
      labels: [{ id: 'label_pericia', name: 'Perícia', color: 'green' }],
      metadata: { schemaVersion: 1, type: 'skill' },
    });
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
    await upsertCatalogEntry('Sistema', {
      name,
      description,
      labels: [{ id: 'label_sistema', name: 'Sistema', color: 'purple' }],
      metadata: { schemaVersion: 1, type: 'system' },
    });
  }

  console.log(`Sincronização concluída: ${attributes.length} atributos, ${skills.length} perícias e ${Object.keys(systemCards).length} regras.`);
} finally {
  await closePool();
}

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
- 1 Ponto de Desenvolvimento concede +1 permanente nesta perícia.
- O bônus comprado com PD possui limite de +5 por perícia.

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
  return `# Experiência de Classe e Desenvolvimento

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

| Evolução | Custo |
| --- | ---: |
| Nível 1 → 2 | 10 XP |
| Nível 2 → 3 | 15 XP |
| Nível 3 → 4 | 20 XP |
| Nível 4 → 5 | 25 XP |
| Nível 5 → 6 | 30 XP |
| Nível 6 → 7 | 35 XP |
| Nível 7 → 8 | 45 XP |
| Nível 8 → 9 | 50 XP |
| Nível 9 → 10 | 55 XP |

Excelência após o nível 10 custa 75 XP adicionais e exige o requisito da classe.

## XP de Desenvolvimento

Combate, investigação, interação social, exploração, sobrevivência e treinamento usam um único contador. O mestre concede individualmente de 1 a 4 XP por cena relevante: participação relevante, boa contribuição, grande contribuição ou feito excepcional. Ações repetitivas e sem risco podem conceder 0 XP.

A cada 20 XP, o personagem recebe 1 Ponto de Desenvolvimento e os 20 XP são consumidos.

- Atributo atual de +0 a +5: 1 PD por +1.
- Atributo atual de +6 a +10: 2 PD por +1.
- Atributo acima de +10: 5 PD por +1.
- Perícia: 1 PD por +1 permanente, limitado a +5 comprado com PD.

O limite absoluto de atributo continua sendo +20 e toda evolução depende da aprovação do mestre.`;
}

function humanityDescription() {
  return `# Humanidade e Divindade

Todo personagem possui Humanidade e Divindade entre 0 e 100. Ao gastar Humanidade, a Divindade aumenta na mesma proporção.

**Resistência Divina:** 1d20 + floor(Humanidade ÷ 10)

| Humanidade | Estado | CD | Efeitos principais |
| --- | --- | ---: | --- |
| 100-81 | Humanidade plena | - | Sem influência suficiente para exigir teste. |
| 80-51 | Humanidade estável | 17 | Transformações mínimas; Clérigo e Paladino usam CD 15 pela regra específica da classe. |
| 50-26 | Influência divina | 18 | Dano de Magia Divina recebe +5% da Divindade. Acerto divino = floor(Divindade ÷ 15), máximo +5. |
| 25-11 | Domínio divino severo | 18 | Falha pode causar perda da ação, controle temporário e 1d20 de dano. |
| 10-2 | Humanidade crítica | 19 | Apenas Milagres reduzem Humanidade; bônus continuam escalando. |
| 1 | Estado de Avatar | Especial | Teste de controle a cada turno; falha leva a Humanidade 0. |
| 0 | Manifestação Divina Total | - | Personagem injogável; só recebe dano de Magia Divina e perde 1d20 de vida por turno. |

Retorno da Manifestação ocorre apenas pelas condições descritas no sistema: morrer e passar nos testes de morte, ou outro Clérigo selar os poderes divinos.`;
}

function armorClassDescription() {
  return `# Classe de Armadura e Combate

**Defesa:** floor((Destreza × 70%) + (Constituição × 30%))

**Classe de Armadura:** CA = 10 + Defesa

O resultado da Defesa é sempre arredondado para baixo. Equipamentos, habilidades e efeitos podem aplicar modificadores adicionais quando estiverem explicitamente descritos em seus cadastros.`;
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
