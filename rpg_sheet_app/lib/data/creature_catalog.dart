import '../models/creature.dart';
import '../models/rpg_rule_models.dart';

// Catalogo inicial para o mestre. O documento descreve povos, demônios,
// espíritos, entidades e ameaças, mas não traz blocos completos de monstro.
// Por isso, estatísticas numéricas ficam opcionais/configuráveis.
const creatureCatalog = <Creature>[
  Creature(
    id: 'common_spirit',
    name: 'Espirito comum',
    type: 'Espirito',
    role: 'Entidade de pacto',
    threat: 'Variavel',
    description: 'Entidade natural ou invisivel usada em magia espiritual.',
    abilities: [
      'Pode conceder pactos, efeitos passivos ou reducao de custo de mana.',
    ],
    notes:
        'Espiritos podem recusar ajuda, impor condicoes e cobrar precos nao materiais.',
  ),
  Creature(
    id: 'minor_demon',
    name: 'Demonio menor',
    type: 'Demonio',
    role: 'Pactuante ou inimigo',
    threat: 'Media',
    description: 'Demonio capaz de firmar pacto e conceder magia demoniaca.',
    abilities: [
      'Impoe clausulas de pacto.',
      'Pode causar 2d20 de dano se desobedecido.',
    ],
    vulnerabilities: [
      'Magia divina de Clerigos ou Paladinos pode destruir nucleo exposto.',
    ],
  ),
  Creature(
    id: 'manifested_demon',
    name: 'Demonio manifestado',
    type: 'Demonio',
    role: 'Chefe',
    threat: 'Mortal',
    description: 'Surge quando Corrupcao chega a 100 e o pactuante morre.',
    abilities: [
      'Surge com Vida e Mana completas.',
      'Age livremente no mundo fisico.',
    ],
    vulnerabilities: [
      'Nucleo deve ser destruido por Clerigo ou Paladino com Magia Divina.',
    ],
  ),
  Creature(
    id: 'divine_manifestation',
    name: 'Manifestacao divina total',
    type: 'Divino',
    role: 'Entidade',
    threat: 'Lendaria',
    description:
        'Estado de 0 Humanidade e 100 Divindade. O personagem torna-se injogavel.',
    abilities: [
      'So pode ser ferida por Magia Divina.',
      'Pode destruir demonio manifestado sem testes.',
    ],
    resistances: ['Dano nao divino'],
  ),
  Creature(
    id: 'corrupted_creature',
    name: 'Criatura corrompida',
    type: 'Corrompido',
    role: 'Inimigo',
    threat: 'Variavel',
    description:
        'Criatura afetada por corrupcao, demonios ou poderes contrarios a uma divindade.',
    vulnerabilities: ['Dano divino', 'Purificacao divina'],
  ),
  Creature(
    id: 'undead',
    name: 'Morto-vivo',
    type: 'Morto-vivo',
    role: 'Inimigo',
    threat: 'Variavel',
    description: 'Alvo tipico de punicao divina e efeitos contra mortos-vivos.',
    vulnerabilities: ['Dano divino', 'Maldições e julgamento divino'],
  ),
  Creature(
    id: 'wild_beast',
    name: 'Fera selvagem',
    type: 'Fera',
    role: 'Criatura de caca',
    threat: 'Baixa a alta',
    description:
        'Animal ou monstro de terreno usado em cenas de caca, sobrevivencia e armadilhas.',
    attributes: {AttributeId.dexterity: 2, AttributeId.constitution: 2},
    skills: {'perception': 1},
  ),
  Creature(
    id: 'enemy_soldier',
    name: 'Soldado inimigo',
    type: 'Humanoide',
    role: 'Combatente',
    threat: 'Baixa a media',
    description: 'Modelo generico para soldados de reinos, tribos ou faccoes.',
    attributes: {AttributeId.strength: 2, AttributeId.constitution: 2},
    skills: {'intimidation': 1},
  ),
  Creature(
    id: 'divine_champion',
    name: 'Campeao divino',
    type: 'Divino',
    role: 'Elite',
    threat: 'Alta',
    description: 'Servo, campeao ou executor de uma divindade.',
    attributes: {AttributeId.faith: 5, AttributeId.constitution: 3},
    abilities: ['Usa poderes baseados em Fe e na vontade do Deus seguido.'],
  ),
];
