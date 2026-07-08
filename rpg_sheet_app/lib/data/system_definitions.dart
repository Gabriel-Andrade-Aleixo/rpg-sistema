import '../models/rpg_rule_models.dart';

const initialAttributePoints = 10;
const naturalAttributeMax = 10;
const absoluteAttributeMax = 20;

const skills = <SkillDefinition>[
  SkillDefinition(
    id: 'acrobatics',
    name: 'Acrobacia',
    components: [
      WeightedAttribute(AttributeId.dexterity, .90),
      WeightedAttribute(AttributeId.strength, .10),
    ],
  ),
  SkillDefinition(
    id: 'medicine',
    name: 'Medicina',
    components: [
      WeightedAttribute(AttributeId.intelligence, .60),
      WeightedAttribute(AttributeId.constitution, .40),
    ],
  ),
  SkillDefinition(
    id: 'perception',
    name: 'Percepcao',
    components: [
      WeightedAttribute(AttributeId.intelligence, .90),
      WeightedAttribute(AttributeId.faith, .10),
    ],
  ),
  SkillDefinition(
    id: 'intimidation',
    name: 'Intimidacao',
    components: [
      WeightedAttribute(AttributeId.strength, .60),
      WeightedAttribute(AttributeId.constitution, .30),
      WeightedAttribute(AttributeId.charisma, .10),
    ],
  ),
  SkillDefinition(
    id: 'religion',
    name: 'Religiao',
    components: [WeightedAttribute(AttributeId.faith, 1)],
  ),
  SkillDefinition(
    id: 'stealth',
    name: 'Furtividade',
    components: [
      WeightedAttribute(AttributeId.dexterity, .70),
      WeightedAttribute(AttributeId.intelligence, .30),
    ],
  ),
];

const races = <RaceDefinition>[
  RaceDefinition(
    id: 'human',
    name: 'Humano',
    traits: ['Sem bonus mecanico definido no documento.'],
  ),
  RaceDefinition(
    id: 'elf',
    name: 'Elfo',
    traits: ['Sem bonus mecanico definido no documento.'],
  ),
  RaceDefinition(
    id: 'dwarf',
    name: 'Anao',
    traits: ['Sem bonus mecanico definido no documento.'],
  ),
  RaceDefinition(
    id: 'thri_kreen',
    name: 'Thri-kreen',
    variants: ['Com asas', 'Quatro bracos'],
    attributeBonuses: {AttributeId.dexterity: 1},
    skillBonuses: {'stealth': 1},
    traits: [
      'Variante de quatro bracos possui ambidestria.',
      'Resistencia a calor.',
      'Sofre mais dano de ataques congelantes.',
    ],
  ),
  RaceDefinition(
    id: 'vedalken',
    name: 'Vedalken',
    variants: ['Mago comum', 'Espiritual'],
    attributeBonuses: {AttributeId.intelligence: 1},
    skillBonuses: {'perception': 1},
    traits: ['Variante espiritual conversa com espiritos.'],
  ),
  RaceDefinition(
    id: 'lizardfolk',
    name: 'Lizardfolk',
    attributeBonuses: {AttributeId.strength: 1},
    traits: [
      '+2 CA passivo.',
      'Levanta mais peso que o normal.',
      'Em regioes geladas perde 2 metros de locomocao.',
      'Curas leves e medias curam ate no maximo 75% da vida maxima.',
    ],
  ),
  RaceDefinition(
    id: 'genasi',
    name: 'Genasi',
    skillBonuses: {'religion': 6},
    traits: [
      'Comeca com Religiao 2, equivalente a Religiao entre 6 e 9.',
      'Pode usar artefatos religiosos de segundo nivel.',
      'Familia rica pode iniciar com artefato religioso nivel 2.',
      'Imune a dano de fogo.',
      'Sem sol, gasta mais Humanidade em magias divinas.',
    ],
    notes:
        'O documento define Religiao 2 como faixa 6-9; o MVP aplica +6 como ponto de entrada configuravel.',
  ),
  RaceDefinition(
    id: 'goliath',
    name: 'Goliath',
    traits: ['Sem bonus mecanico definido no documento.'],
  ),
  RaceDefinition(
    id: 'orc',
    name: 'Orc',
    traits: ['Sem bonus mecanico definido no documento.'],
  ),
  RaceDefinition(
    id: 'minotaur',
    name: 'Minotauro',
    traits: ['Sem bonus mecanico definido no documento.'],
  ),
  RaceDefinition(
    id: 'bugbear',
    name: 'Bugbear',
    traits: ['Sem bonus mecanico definido no documento.'],
  ),
  RaceDefinition(
    id: 'firbolg',
    name: 'Firbolg',
    traits: ['Sem bonus mecanico definido no documento.'],
  ),
];

const defaultDefense = FormulaDefinition(
  label: 'Defesa padrao',
  components: [
    WeightedAttribute(AttributeId.dexterity, .70),
    WeightedAttribute(AttributeId.constitution, .30),
  ],
);

const classes = <CharacterClassDefinition>[
  CharacterClassDefinition(
    id: 'barbarian',
    name: 'Barbaro',
    description:
        'Combatente brutal que cresce em poder quanto mais ferido esta.',
    defense: FormulaDefinition(
      label: 'Defesa',
      components: [
        WeightedAttribute(AttributeId.dexterity, .50),
        WeightedAttribute(AttributeId.constitution, .50),
      ],
    ),
    hp: HpFormulaDefinition(
      initial: FormulaDefinition(
        label: 'HP inicial',
        base: 20,
        components: [WeightedAttribute(AttributeId.constitution, 3)],
      ),
      fixedPerLevel: '8 + Constituicao',
      rollPerLevel: '1d12 + Constituicao',
      hybridPerLevel: '6 + 1d6 + Constituicao',
    ),
    attributeProgression: [
      'Niveis 1-3: +1 Forca por nivel.',
      'Niveis 4-10: +1 Forca e +1 Constituicao por nivel.',
    ],
    allowedCombatXpAttributes: [
      AttributeId.strength,
      AttributeId.constitution,
      AttributeId.dexterity,
    ],
    abilities: [
      AbilityDefinition(
        level: 1,
        name: 'Furia',
        description:
            'A cada 25% de vida perdida: +1 Forca e +1 dano fisico. Recebe +50% dano magico; abaixo de 20% recebe +50% de todo dano, sem acumular.',
      ),
      AbilityDefinition(
        level: 3,
        name: 'Intimidacao Furiosa',
        description:
            'Ao entrar em Furia, testa Intimidacao em inimigos a 9m e recebe +1 no teste.',
      ),
      AbilityDefinition(
        level: 4,
        name: 'Pele Resistente',
        description: 'Recebe -1 de dano fisico fixo.',
      ),
      AbilityDefinition(
        level: 5,
        name: 'Rerrolar Dano',
        description: 'Pode rerrolar o dano de 1 ataque por turno.',
      ),
      AbilityDefinition(
        level: 6,
        name: 'Instinto Brutal',
        description:
            'Abaixo de 50% da vida, escolhe 1 ataque adicional ou rerrolar dano.',
      ),
      AbilityDefinition(
        level: 7,
        name: 'Vigor da Vitoria',
        description:
            'Ao derrotar inimigo diretamente, recupera 2d2 + floor(Constituicao / 2) de vida.',
      ),
      AbilityDefinition(
        level: 8,
        name: 'Sem Medo',
        description:
            'Abaixo de 25% da vida, ignora medo, stun e controles leves.',
      ),
      AbilityDefinition(
        level: 9,
        name: 'Avanco Brutal',
        description:
            '1 vez por turno, move-se ate inimigo proximo sem gastar movimento.',
      ),
    ],
    excellences: [
      ExcellenceDefinition(
        id: 'immortal',
        name: 'O Imortal',
        focus: 'Sobrevivencia extrema',
        effect:
            'Abaixo de 25% da vida, 1 vez a cada 5 turnos, cura 50% do dano causado contra um alvo.',
        requirement:
            'Sobreviver 4 turnos com menos de 25% da vida, sem se curar e sem cair.',
      ),
      ExcellenceDefinition(
        id: 'unstoppable',
        name: 'O Imparavel',
        focus: 'Resistencia a controle',
        effect:
            'Abaixo de 20% da vida, entra em Super Furia por 2 turnos e recebe dano normal de todas as fontes.',
        requirement:
            'Resistir a 3 controles ou debuffs significativos em um combate.',
      ),
      ExcellenceDefinition(
        id: 'devastator',
        name: 'O Devastador',
        focus: 'Dano em area',
        effect:
            'Em Furia e abaixo de 30% da vida, ataques causam dano em area arredondado para baixo.',
        requirement:
            'Atingir 3 inimigos em um turno abaixo de 25% da vida e permanecer consciente.',
      ),
    ],
  ),
  CharacterClassDefinition(
    id: 'mage',
    name: 'Mago',
    description: 'Conjurador arcano versatil baseado em Inteligencia e Mana.',
    defense: defaultDefense,
    hp: HpFormulaDefinition(
      initial: FormulaDefinition(
        label: 'HP inicial',
        base: 10,
        components: [WeightedAttribute(AttributeId.constitution, 3)],
      ),
      fixedPerLevel: '7 + Constituicao',
      rollPerLevel: '1d8 + Constituicao',
      hybridPerLevel: '3 + 1d6 + Constituicao',
    ),
    mana: FormulaDefinition(
      label: 'Mana maxima',
      base: 10,
      components: [WeightedAttribute(AttributeId.intelligence, 3)],
    ),
    attributeProgression: ['A cada nivel: +1 Inteligencia.'],
    allowedCombatXpAttributes: [AttributeId.intelligence, AttributeId.charisma],
    abilities: [
      AbilityDefinition(
        level: 3,
        name: 'Escrever Magias',
        description:
            'Pode adquirir/criar grimorio e usar 1 reacao magica por rodada com o grimorio em maos.',
      ),
      AbilityDefinition(
        level: 5,
        name: 'Conjuracao Dupla',
        description:
            'Ao conjurar magia do grimorio, gera segunda conjuracao com 30% do dano original, sem efeitos e no mesmo alvo.',
      ),
      AbilityDefinition(
        level: 8,
        name: 'Marca Arcana',
        description:
            'Marca inimigos; quando alvo marcado sofre dano magico, aplica +30% do dano + Inteligencia e dano secundario aos demais marcados.',
      ),
    ],
    excellences: [
      ExcellenceDefinition(
        id: 'arcane_overload',
        name: 'Sobrecarga Arcana',
        focus: 'Gasto adicional de mana',
        effect:
            'Para cada 5% da mana maxima adicional gasta, +10% dano ou efeito.',
        requirement: 'Gastar 30% da mana maxima em uma magia em um turno.',
      ),
      ExcellenceDefinition(
        id: 'arcane_transcendence',
        name: 'Transcendencia Arcana',
        focus: 'Corpo fortalecido por mana',
        effect:
            'A cada 20% da mana maxima gasta em combate, ganha acumuladores fisicos ate 3.',
        requirement:
            'Derrotar inimigo equivalente ou superior usando apenas ataques fisicos.',
      ),
      ExcellenceDefinition(
        id: 'arcane_source',
        name: 'Fonte Arcana',
        focus: 'Recuperacao de mana',
        effect:
            'Ao atingir 10% ou menos da mana, recupera mana por 5 turnos uma vez por combate.',
        requirement:
            'Criar e conjurar magia que consuma 50% da mana maxima e sobreviver.',
      ),
    ],
  ),
  CharacterClassDefinition(
    id: 'spectral_archer',
    name: 'Arqueiro Espectral',
    parentClassId: 'ranger',
    description:
        'Subclasse de Ranger focada em multi-hit, mana, foco e cadencia.',
    defense: FormulaDefinition(
      label: 'Defesa',
      components: [
        WeightedAttribute(AttributeId.constitution, .40),
        WeightedAttribute(AttributeId.dexterity, .30),
        WeightedAttribute(AttributeId.intelligence, .30),
      ],
    ),
    hp: HpFormulaDefinition(
      initial: FormulaDefinition(
        label: 'HP inicial',
        base: 10,
        components: [
          WeightedAttribute(AttributeId.constitution, 2),
          WeightedAttribute(AttributeId.dexterity, 2),
        ],
      ),
      fixedPerLevel: '5 + Constituicao',
      rollPerLevel: '1d8 + Constituicao',
      hybridPerLevel: '4 + 1d4 + Constituicao',
    ),
    mana: FormulaDefinition(
      label: 'Mana maxima',
      base: 15,
      components: [
        WeightedAttribute(AttributeId.intelligence, 1),
        WeightedAttribute(AttributeId.dexterity, 2),
      ],
    ),
    resources: [
      ResourceDefinition(
        id: 'focus',
        name: 'Foco',
        formula: FormulaDefinition(
          label: 'Foco maximo',
          base: 6,
          components: [WeightedAttribute(AttributeId.intelligence, 2)],
        ),
        description: 'Recupera +2 por turno e tudo fora de combate.',
      ),
      ResourceDefinition(
        id: 'cadence',
        name: 'Cadencia',
        description: 'Cada ataque bem-sucedido gera +1, maximo 3.',
      ),
    ],
    attributeProgression: [
      'Ate nivel 3: +1 Destreza.',
      'Do nivel 4 ao 10: +1 Destreza e +1 Inteligencia.',
    ],
    allowedCombatXpAttributes: [
      AttributeId.dexterity,
      AttributeId.intelligence,
    ],
    abilities: [
      AbilityDefinition(
        level: 1,
        name: 'Disparo Rapido',
        description:
            'Realiza 2 ataques por turno, com penalidade de dano/foco conforme regra.',
      ),
      AbilityDefinition(
        level: 2,
        name: 'Passo Fantasma',
        description:
            '1 vez por turno, movimento curto sem provocar reacao; pode gastar foco para aumentar esquiva.',
      ),
      AbilityDefinition(
        level: 3,
        name: 'Ritmo de Combate',
        description:
            'Com 2 Cadencia recebe +1 ataque; com 3 ignora penalidade do Disparo Rapido.',
      ),
      AbilityDefinition(
        level: 5,
        name: 'Rajada de Flechas',
        description:
            'Custa 2 Cadencia + 2 Foco, realiza 4 ataques com reducao descrita.',
      ),
      AbilityDefinition(
        level: 9,
        name: 'Tempestade de Flechas',
        description:
            'Custa 3 Cadencia + 3 Foco, realiza 5 ataques e 1 infusao gratuita.',
      ),
    ],
  ),
  CharacterClassDefinition(
    id: 'cleric',
    name: 'Clerigo',
    description:
        'Canal divino focado em cura, protecao e combate contra corrupcao.',
    defense: FormulaDefinition(
      label: 'Defesa',
      components: [
        WeightedAttribute(AttributeId.dexterity, .20),
        WeightedAttribute(AttributeId.constitution, .40),
        WeightedAttribute(AttributeId.faith, .40),
      ],
    ),
    hp: HpFormulaDefinition(
      initial: FormulaDefinition(
        label: 'HP inicial',
        base: 16,
        components: [WeightedAttribute(AttributeId.constitution, 3)],
      ),
      fixedPerLevel: '7 + Constituicao',
      rollPerLevel: '1d10 + Constituicao',
      hybridPerLevel: '5 + 1d6 + Constituicao',
    ),
    mana: FormulaDefinition(
      label: 'Mana divina maxima',
      base: 10,
      components: [
        WeightedAttribute(AttributeId.intelligence, 1),
        WeightedAttribute(AttributeId.faith, 2),
      ],
    ),
    attributeProgression: [
      'Niveis 1-3: +1 Fe por nivel.',
      'Niveis 4-10: +1 Fe e +1 Inteligencia.',
    ],
    allowedCombatXpAttributes: [AttributeId.faith, AttributeId.intelligence],
    abilities: [
      AbilityDefinition(
        level: 3,
        name: 'Purificacao Divina',
        description:
            'Purificacao baseada no Deus seguido. Depende do dominio divino.',
      ),
      AbilityDefinition(
        level: 5,
        name: 'Maldicao Divina',
        description: 'Maldicao relacionada ao Deus seguido.',
      ),
      AbilityDefinition(
        level: 7,
        name: 'Acao Divina',
        description:
            '1 vez por turno, realiza magia divina adicional consumindo Divindade.',
      ),
      AbilityDefinition(
        level: 8,
        name: 'Aura de Santidade',
        description:
            'Aliados a 3m recebem +1 contra medo, controle mental e corrupcao leve.',
      ),
      AbilityDefinition(
        level: 9,
        name: 'Milagre de Campo',
        description:
            '1 vez por sessao, efeito definido pelo Deus e pelo mestre.',
      ),
    ],
  ),
  CharacterClassDefinition(
    id: 'paladin',
    name: 'Paladino',
    description:
        'Guerreiro sagrado que usa Fe, combate fisico, Humanidade e Divindade.',
    defense: FormulaDefinition(
      label: 'Defesa',
      components: [
        WeightedAttribute(AttributeId.dexterity, .20),
        WeightedAttribute(AttributeId.constitution, .40),
        WeightedAttribute(AttributeId.faith, .40),
      ],
    ),
    hp: HpFormulaDefinition(
      initial: FormulaDefinition(
        label: 'HP inicial',
        base: 18,
        components: [WeightedAttribute(AttributeId.constitution, 3)],
      ),
      fixedPerLevel: '8 + Constituicao',
      rollPerLevel: '1d12 + Constituicao',
      hybridPerLevel: '6 + 1d6 + Constituicao',
    ),
    attributeProgression: [
      'Niveis 1-3: +1 Fe por nivel.',
      'Niveis 4-10: +1 Fe e +1 Constituicao.',
    ],
    allowedCombatXpAttributes: [
      AttributeId.faith,
      AttributeId.strength,
      AttributeId.constitution,
      AttributeId.dexterity,
    ],
    abilities: [
      AbilityDefinition(
        level: 1,
        name: 'Conversao Divina',
        description: 'Metade do dano fisico causado vira dano divino.',
      ),
      AbilityDefinition(
        level: 3,
        name: 'Presenca Imponente',
        description:
            'Inimigos a 6m testam contra 5 + floor(Fe/2) + floor(Constituicao/3).',
      ),
      AbilityDefinition(
        level: 5,
        name: 'Ataque Extra',
        description: 'Pode realizar 2 ataques no mesmo turno.',
      ),
      AbilityDefinition(
        level: 6,
        name: 'Missao Divina',
        description:
            'No inicio do combate recebe missao; ao cumprir, ganha bonus igual a floor(Fe/3).',
      ),
      AbilityDefinition(
        level: 7,
        name: 'Marca Divina',
        description:
            'Alvo marcado sofre dano divino adicional igual a floor(Fe/3) por 2 turnos.',
      ),
      AbilityDefinition(
        level: 9,
        name: 'Ascensao Divina',
        description:
            'Gasta Humanidade, ganha Divindade igual e recebe bonus de atributos floor(Humanidade gasta/10).',
      ),
    ],
  ),
  CharacterClassDefinition(
    id: 'rogue',
    name: 'Ladino',
    description: 'Especialista em furtividade, precisao e oportunismo.',
    defense: FormulaDefinition(
      label: 'Defesa',
      components: [
        WeightedAttribute(AttributeId.constitution, .70),
        WeightedAttribute(AttributeId.dexterity, .30),
      ],
    ),
    hp: HpFormulaDefinition(
      initial: FormulaDefinition(
        label: 'HP inicial',
        base: 12,
        components: [WeightedAttribute(AttributeId.constitution, 3)],
      ),
      fixedPerLevel: '5 + Constituicao',
      rollPerLevel: '1d8 + Constituicao',
      hybridPerLevel: '4 + 1d4 + Constituicao',
    ),
    attributeProgression: [
      'Niveis 1-3: +1 Destreza por nivel.',
      'Niveis 4-10: +1 Destreza e +1 Inteligencia.',
    ],
    allowedCombatXpAttributes: [
      AttributeId.dexterity,
      AttributeId.intelligence,
    ],
    abilities: [
      AbilityDefinition(
        level: 1,
        name: 'Esquiva Reativa',
        description:
            '1 vez por turno, ao sofrer ataque direto, pode tentar esquivar.',
      ),
      AbilityDefinition(
        level: 1,
        name: 'Ataque Oportunista',
        description: 'Contra alvos vulneraveis causa +1 dano.',
      ),
      AbilityDefinition(
        level: 3,
        name: 'Apunhalar',
        description: 'Ao atingir pelas costas sem ser detectado, causa +2d6.',
      ),
      AbilityDefinition(
        level: 3,
        name: 'Movimento Aprimorado',
        description: 'Locomocao base aumenta de 9m para 12m.',
      ),
      AbilityDefinition(
        level: 5,
        name: 'Camuflar',
        description:
            'Cooldown 3 turnos apos sair da furtividade; proximo ataque recebe +1d8.',
      ),
      AbilityDefinition(
        level: 7,
        name: 'Entrar nas Sombras',
        description: 'Cooldown 5 turnos; teleporta entre sombras visiveis.',
      ),
      AbilityDefinition(
        level: 9,
        name: 'Expor Ponto Fraco',
        description:
            'Teste 1d20 + Inteligencia + floor(Destreza/2); sucesso ignora reducoes fisicas e causa +1d6.',
      ),
    ],
  ),
  CharacterClassDefinition(
    id: 'ranger',
    name: 'Ranger',
    description:
        'Especialista em caca, rastreamento, terreno e marcacao de alvos.',
    defense: FormulaDefinition(
      label: 'Defesa',
      components: [
        WeightedAttribute(AttributeId.constitution, .60),
        WeightedAttribute(AttributeId.dexterity, .30),
        WeightedAttribute(AttributeId.intelligence, .10),
      ],
    ),
    hp: HpFormulaDefinition(
      initial: FormulaDefinition(
        label: 'HP inicial',
        base: 14,
        components: [WeightedAttribute(AttributeId.constitution, 3)],
      ),
      fixedPerLevel: '6 + Constituicao',
      rollPerLevel: '1d10 + Constituicao',
      hybridPerLevel: '5 + 1d4 + Constituicao',
    ),
    attributeProgression: [
      'Niveis 1-3: +1 Destreza por nivel.',
      'Niveis 4-10: +1 Destreza e +1 Inteligencia.',
    ],
    allowedCombatXpAttributes: [
      AttributeId.dexterity,
      AttributeId.intelligence,
    ],
    abilities: [
      AbilityDefinition(
        level: 1,
        name: 'Olhos do Cacador',
        description: '+1 em testes de Percepcao.',
      ),
      AbilityDefinition(
        level: 2,
        name: 'Disparo Preciso',
        description: '+1 em rolagens de acerto a distancia.',
      ),
      AbilityDefinition(
        level: 3,
        name: 'Armadilhas',
        description:
            'Cria armadilhas conforme terreno, materiais e aprovacao do mestre.',
      ),
      AbilityDefinition(
        level: 3,
        name: 'Defesa Adaptativa',
        description:
            'Com inimigo a menos de 2m, Defesa = Dex 60% + Con 30% + Int 10%.',
      ),
      AbilityDefinition(
        level: 4,
        name: 'Adaptacao ao Terreno',
        description:
            'Progride de ignorar penalidades ate Dominio de Terreno apos 5 combates.',
      ),
      AbilityDefinition(
        level: 5,
        name: 'Marca do Predador',
        description: 'Marca alvo; contra marcados recebe +1 acerto e +1 dano.',
      ),
      AbilityDefinition(
        level: 6,
        name: 'Tiro Duplo',
        description: 'Realiza 2 ataques a distancia no mesmo turno.',
      ),
      AbilityDefinition(
        level: 7,
        name: 'Instinto do Cacador',
        description: '+1 em testes de Percepcao.',
      ),
      AbilityDefinition(
        level: 8,
        name: 'Olhos da Cacada',
        description: '+1 acerto a distancia; contra marcados +2 em acertos.',
      ),
    ],
  ),
  CharacterClassDefinition(
    id: 'bard',
    name: 'Bardo',
    description: 'Manipulador de emocoes, inspiracao e controle social.',
    defense: FormulaDefinition(
      label: 'Defesa',
      components: [
        WeightedAttribute(AttributeId.constitution, .50),
        WeightedAttribute(AttributeId.charisma, .25),
        WeightedAttribute(AttributeId.intelligence, .25),
      ],
    ),
    hp: HpFormulaDefinition(
      initial: FormulaDefinition(
        label: 'HP inicial',
        base: 12,
        components: [WeightedAttribute(AttributeId.constitution, 3)],
      ),
      fixedPerLevel: '5 + Constituicao',
      rollPerLevel: '1d8 + Constituicao',
      hybridPerLevel: '4 + 1d4 + Constituicao',
    ),
    mana: FormulaDefinition(
      label: 'Mana maxima',
      base: 10,
      components: [
        WeightedAttribute(AttributeId.charisma, 1),
        WeightedAttribute(AttributeId.intelligence, .50),
      ],
    ),
    attributeProgression: [
      'Niveis 1-3: +1 Carisma por nivel.',
      'Niveis 4-10: +1 Carisma e +1 Constituicao.',
    ],
    allowedCombatXpAttributes: [AttributeId.charisma, AttributeId.constitution],
    abilities: [
      AbilityDefinition(
        level: 1,
        name: 'Inspiracao',
        description:
            '1 vez por turno, aliado a 9m recebe +1 em uma rolagem ate o proximo turno.',
      ),
      AbilityDefinition(
        level: 2,
        name: 'Performance Encantadora',
        description:
            '1 vez por combate, aplica emocao se alvo falhar teste definido pelo mestre.',
      ),
      AbilityDefinition(
        level: 3,
        name: 'Cancao Inspiradora',
        description:
            'Aliados a 9m recebem +1m movimento e +1 no proximo teste.',
      ),
      AbilityDefinition(
        level: 5,
        name: 'Harmonia Restauradora',
        description:
            '1 vez por combate, cura 1d6 + Carisma; +1 se alvo estiver sob efeito negativo.',
      ),
      AbilityDefinition(
        level: 9,
        name: 'Climax Emocional',
        description:
            '1 vez por combate, dobra efeito de uma emocao por 1 turno.',
      ),
    ],
  ),
  CharacterClassDefinition(
    id: 'tactical_maestro',
    name: 'Maestro Tatico',
    parentClassId: 'bard',
    description:
        'Subclasse de Bardo focada em compasso, buffs, debuffs e ritmo de combate.',
    defense: FormulaDefinition(
      label: 'Defesa',
      components: [
        WeightedAttribute(AttributeId.dexterity, .40),
        WeightedAttribute(AttributeId.charisma, .40),
        WeightedAttribute(AttributeId.intelligence, .20),
      ],
    ),
    hp: HpFormulaDefinition(
      initial: FormulaDefinition(
        label: 'HP inicial',
        base: 10,
        components: [
          WeightedAttribute(AttributeId.constitution, 3),
          WeightedAttribute(AttributeId.charisma, 2),
        ],
      ),
      fixedPerLevel: '5 + Constituicao',
      rollPerLevel: '1d8 + Constituicao',
      hybridPerLevel: '4 + 1d4 + Constituicao',
    ),
    mana: FormulaDefinition(
      label: 'Mana maxima',
      base: 7,
      components: [
        WeightedAttribute(AttributeId.intelligence, 1),
        WeightedAttribute(AttributeId.charisma, 3),
      ],
    ),
    resources: [
      ResourceDefinition(
        id: 'compasso',
        name: 'Compasso',
        description: 'Habilidade usada com sucesso gera +1, maximo 3.',
      ),
    ],
    attributeProgression: [
      'Ate nivel 3: +1 Carisma.',
      'Do nivel 4 ao 10: +1 Carisma e +1 Inteligencia.',
    ],
    allowedCombatXpAttributes: [AttributeId.charisma, AttributeId.intelligence],
    abilities: [
      AbilityDefinition(
        level: 1,
        name: 'Nota Guiada',
        description:
            'Aliado a 9m recebe +1 em uma rolagem e, com Compasso, +1 deslocamento.',
      ),
      AbilityDefinition(
        level: 2,
        name: 'Dissonancia Direcionada',
        description:
            'Inimigo a 9m testa contra Carisma; se falhar sofre +1 dano de ataques.',
      ),
      AbilityDefinition(
        level: 3,
        name: 'Eco Tatico',
        description:
            '1 vez por turno, replica ultimo buff/debuff em outro alvo com 50% do efeito.',
      ),
      AbilityDefinition(
        level: 5,
        name: 'Melodia Restauradora',
        description:
            'Cura 1d4 + Carisma + Inteligencia e, com Compasso, remove efeito negativo leve.',
      ),
      AbilityDefinition(
        level: 10,
        name: 'Maestro do Compasso',
        description:
            'Inicia combate com 1 Compasso; ao atingir 3, recebe acao adicional de movimento ou suporte.',
      ),
    ],
  ),
  CharacterClassDefinition(
    id: 'fighter',
    name: 'Lutador',
    description: 'Especialista em combate físico, armas e técnicas desarmadas.',
    defense: FormulaDefinition(
      label: 'Defesa',
      components: [
        WeightedAttribute(AttributeId.constitution, .40),
        WeightedAttribute(AttributeId.strength, .30),
        WeightedAttribute(AttributeId.dexterity, .30),
      ],
    ),
    hp: HpFormulaDefinition(
      initial: FormulaDefinition(
        label: 'HP inicial',
        base: 18,
        components: [WeightedAttribute(AttributeId.constitution, 3)],
      ),
      fixedPerLevel: '7 + Constituicao',
      rollPerLevel: '1d10 + Constituicao',
      hybridPerLevel: '5 + 1d6 + Constituicao',
    ),
    attributeProgression: [
      'Niveis 1-3: +1 Forca por nivel.',
      'Niveis 4-10: +1 Forca e +1 Destreza.',
    ],
    allowedCombatXpAttributes: [
      AttributeId.strength,
      AttributeId.dexterity,
      AttributeId.constitution,
    ],
    abilities: [
      AbilityDefinition(
        level: 1,
        name: 'Sequencia de Ataques',
        description:
            'Resultado natural 17 ou mais permite um ataque adicional que não gera nova sequência.',
      ),
      AbilityDefinition(
        level: 2,
        name: 'Treinamento I',
        description:
            'Após 8 horas de treino, especializa uma técnica desarmada ou categoria de arma.',
      ),
      AbilityDefinition(
        level: 3,
        name: 'Arremesso',
        description:
            '1 vez por turno, arremessa inimigo até Força metros, máximo 9; colisão causa 1d6.',
      ),
      AbilityDefinition(
        level: 5,
        name: 'Ataque Desestabilizante',
        description:
            'Ao acertar corpo a corpo, pode derrubar ou desarmar o alvo.',
      ),
      AbilityDefinition(
        level: 6,
        name: 'Treinamento II',
        description: 'Aprimora o treinamento anterior ou inicia um novo.',
      ),
      AbilityDefinition(
        level: 7,
        name: 'Experiencia de Combate',
        description: 'Recebe -1 de dano físico.',
      ),
      AbilityDefinition(
        level: 9,
        name: 'Sequencia Avancada',
        description:
            'O primeiro ataque adicional com natural 17 ou mais gera um segundo ataque adicional.',
      ),
    ],
  ),
];

RaceDefinition raceById(String id) =>
    races.firstWhere((race) => race.id == id, orElse: () => races.first);

CharacterClassDefinition classById(String id) =>
    classes.firstWhere((klass) => klass.id == id, orElse: () => classes.first);

SkillDefinition skillById(String id) =>
    skills.firstWhere((skill) => skill.id == id, orElse: () => skills.first);
