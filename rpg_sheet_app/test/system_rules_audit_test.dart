import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:rpg_sheet_app/domain/calculators/combat_calculator.dart';
import 'package:rpg_sheet_app/domain/calculators/official_formula_calculator.dart';
import 'package:rpg_sheet_app/domain/calculators/skill_calculator.dart';
import 'package:rpg_sheet_app/domain/services/character_recalculation_service.dart';
import 'package:rpg_sheet_app/domain/validators/rule_validation_service.dart';
import 'package:rpg_sheet_app/models/catalog_models.dart';
import 'package:rpg_sheet_app/models/character.dart';
import 'package:rpg_sheet_app/models/official_rule_models.dart';
import 'package:rpg_sheet_app/models/rpg_rule_models.dart';
import 'package:rpg_sheet_app/services/trello_parser_service.dart';

void main() {
  const parser = TrelloParserService();
  const formulas = OfficialFormulaCalculator();
  const combat = CombatCalculator();

  Map<String, dynamic> formula(num base, [Map<String, num> terms = const {}]) =>
      {'base': base, 'terms': terms};

  Map<String, dynamic> hp(
    Map<String, dynamic> initial,
    Map<String, dynamic> fixed,
    Map<String, dynamic> roll,
    Map<String, dynamic> hybrid,
  ) => {
    'initial': initial,
    'perLevel': {'fixed': fixed, 'roll': roll, 'hybrid': hybrid},
  };

  Map<String, dynamic> progression(int from, int to, Map<String, int> values) =>
      {'from': from, 'to': to, 'perLevel': values};

  final rules = <Map<String, dynamic>>[
    {
      'name': 'Bárbaro',
      'id': 'barbarian',
      'defense': formula(0, {'dexterity': .5, 'constitution': .5}),
      'hp': hp(
        formula(20, {'constitution': 3}),
        formula(8, {'constitution': 1}),
        {
          'die': 12,
          ...formula(0, {'constitution': 1}),
        },
        {
          'die': 6,
          ...formula(6, {'constitution': 1}),
        },
      ),
      'progression': [
        progression(1, 3, {'strength': 1}),
        progression(4, 10, {'strength': 1, 'constitution': 1}),
      ],
      'expected': {
        'defense': 3,
        'initialHp': 32,
        'fixedHp': 12,
        'rollBonus': 4,
        'hybridBonus': 10,
        'level10': {'strength': 10, 'constitution': 7},
      },
    },
    {
      'name': 'Mago',
      'id': 'mage',
      'defense': formula(0, {'dexterity': .7, 'constitution': .3}),
      'hp': hp(
        formula(10, {'constitution': 3}),
        formula(7, {'constitution': 1}),
        {
          'die': 8,
          ...formula(0, {'constitution': 1}),
        },
        {
          'die': 6,
          ...formula(3, {'constitution': 1}),
        },
      ),
      'mana': formula(10, {'intelligence': 3}),
      'progression': [
        progression(1, 10, {'intelligence': 1}),
      ],
      'expected': {
        'defense': 3,
        'initialHp': 22,
        'fixedHp': 11,
        'rollBonus': 4,
        'hybridBonus': 7,
        'mana': 25,
        'level10': {'intelligence': 10},
      },
    },
    {
      'name': 'Arqueiro Espectral',
      'id': 'spectral_archer',
      'defense': formula(0, {
        'constitution': .4,
        'dexterity': .3,
        'intelligence': .3,
      }),
      'hp': hp(
        formula(10, {'constitution': 2, 'dexterity': 2}),
        formula(5, {'constitution': 1}),
        {
          'die': 8,
          ...formula(0, {'constitution': 1}),
        },
        {
          'die': 4,
          ...formula(4, {'constitution': 1}),
        },
      ),
      'mana': formula(15, {'intelligence': 1, 'dexterity': 2}),
      'progression': [
        progression(1, 3, {'dexterity': 1}),
        progression(4, 10, {'dexterity': 1, 'intelligence': 1}),
      ],
      'expected': {
        'defense': 4,
        'initialHp': 24,
        'fixedHp': 9,
        'rollBonus': 4,
        'hybridBonus': 8,
        'mana': 26,
        'level10': {'dexterity': 10, 'intelligence': 7},
      },
    },
    {
      'name': 'Maestro Tático',
      'id': 'tactical_maestro',
      'defense': formula(0, {
        'dexterity': .4,
        'charisma': .4,
        'intelligence': .2,
      }),
      'hp': hp(
        formula(10, {'constitution': 3, 'charisma': 2}),
        formula(5, {'constitution': 1}),
        {
          'die': 8,
          ...formula(0, {'constitution': 1}),
        },
        {
          'die': 4,
          ...formula(4, {'constitution': 1}),
        },
      ),
      'mana': formula(7, {'intelligence': 1, 'charisma': 3}),
      'progression': [
        progression(1, 3, {'charisma': 1}),
        progression(4, 10, {'charisma': 1, 'intelligence': 1}),
      ],
      'expected': {
        'defense': 4,
        'initialHp': 34,
        'fixedHp': 9,
        'rollBonus': 4,
        'hybridBonus': 8,
        'mana': 30,
        'level10': {'charisma': 10, 'intelligence': 7},
      },
    },
    {
      'name': 'Clérigo',
      'id': 'cleric',
      'defense': formula(0, {'dexterity': .2, 'constitution': .4, 'faith': .4}),
      'hp': hp(
        formula(16, {'constitution': 3}),
        formula(7, {'constitution': 1}),
        {
          'die': 10,
          ...formula(0, {'constitution': 1}),
        },
        {
          'die': 6,
          ...formula(5, {'constitution': 1}),
        },
      ),
      'mana': formula(10, {'intelligence': 1, 'faith': 2}),
      'progression': [
        progression(1, 3, {'faith': 1}),
        progression(4, 10, {'faith': 1, 'intelligence': 1}),
      ],
      'expected': {
        'defense': 5,
        'initialHp': 28,
        'fixedHp': 11,
        'rollBonus': 4,
        'hybridBonus': 9,
        'mana': 29,
        'level10': {'faith': 10, 'intelligence': 7},
      },
    },
    {
      'name': 'Paladino',
      'id': 'paladin',
      'defense': formula(0, {'dexterity': .2, 'constitution': .4, 'faith': .4}),
      'hp': hp(
        formula(18, {'constitution': 3}),
        formula(8, {'constitution': 1}),
        {
          'die': 12,
          ...formula(0, {'constitution': 1}),
        },
        {
          'die': 6,
          ...formula(6, {'constitution': 1}),
        },
      ),
      'progression': [
        progression(1, 3, {'faith': 1}),
        progression(4, 10, {'faith': 1, 'constitution': 1}),
      ],
      'expected': {
        'defense': 5,
        'initialHp': 30,
        'fixedHp': 12,
        'rollBonus': 4,
        'hybridBonus': 10,
        'level10': {'faith': 10, 'constitution': 7},
      },
    },
    {
      'name': 'Ladino',
      'id': 'rogue',
      'defense': formula(0, {'constitution': .7, 'dexterity': .3}),
      'hp': hp(
        formula(12, {'constitution': 3}),
        formula(5, {'constitution': 1}),
        {
          'die': 8,
          ...formula(0, {'constitution': 1}),
        },
        {
          'die': 4,
          ...formula(4, {'constitution': 1}),
        },
      ),
      'progression': [
        progression(1, 3, {'dexterity': 1}),
        progression(4, 10, {'dexterity': 1, 'intelligence': 1}),
      ],
      'expected': {
        'defense': 3,
        'initialHp': 24,
        'fixedHp': 9,
        'rollBonus': 4,
        'hybridBonus': 8,
        'level10': {'dexterity': 10, 'intelligence': 7},
      },
    },
    {
      'name': 'Ranger',
      'id': 'ranger',
      'defense': formula(0, {
        'constitution': .6,
        'dexterity': .3,
        'intelligence': .1,
      }),
      'hp': hp(
        formula(14, {'constitution': 3}),
        formula(6, {'constitution': 1}),
        {
          'die': 10,
          ...formula(0, {'constitution': 1}),
        },
        {
          'die': 4,
          ...formula(5, {'constitution': 1}),
        },
      ),
      'progression': [
        progression(1, 3, {'dexterity': 1}),
        progression(4, 10, {'dexterity': 1, 'intelligence': 1}),
      ],
      'expected': {
        'defense': 3,
        'initialHp': 26,
        'fixedHp': 10,
        'rollBonus': 4,
        'hybridBonus': 9,
        'level10': {'dexterity': 10, 'intelligence': 7},
      },
    },
    {
      'name': 'Bardo',
      'id': 'bard',
      'defense': formula(0, {
        'constitution': .5,
        'charisma': .25,
        'intelligence': .25,
      }),
      'hp': hp(
        formula(12, {'constitution': 3}),
        formula(5, {'constitution': 1}),
        {
          'die': 8,
          ...formula(0, {'constitution': 1}),
        },
        {
          'die': 4,
          ...formula(4, {'constitution': 1}),
        },
      ),
      'mana': formula(10, {'charisma': 1, 'intelligence': .5}),
      'progression': [
        progression(1, 3, {'charisma': 1}),
        progression(4, 10, {'charisma': 1, 'constitution': 1}),
      ],
      'expected': {
        'defense': 4,
        'initialHp': 24,
        'fixedHp': 9,
        'rollBonus': 4,
        'hybridBonus': 8,
        'mana': 18,
        'level10': {'charisma': 10, 'constitution': 7},
      },
    },
    {
      'name': 'Lutador',
      'id': 'fighter',
      'defense': formula(0, {
        'constitution': .4,
        'strength': .3,
        'dexterity': .3,
      }),
      'hp': hp(
        formula(18, {'constitution': 3}),
        formula(7, {'constitution': 1}),
        {
          'die': 10,
          ...formula(0, {'constitution': 1}),
        },
        {
          'die': 6,
          ...formula(5, {'constitution': 1}),
        },
      ),
      'progression': [
        progression(1, 3, {'strength': 1}),
        progression(4, 10, {'strength': 1, 'dexterity': 1}),
      ],
      'expected': {
        'defense': 3,
        'initialHp': 30,
        'fixedHp': 11,
        'rollBonus': 4,
        'hybridBonus': 9,
        'level10': {'strength': 10, 'dexterity': 7},
      },
    },
  ];

  CatalogEntry entryFor(Map<String, dynamic> rule) => CatalogEntry(
    id: rule['id'] as String,
    name: rule['name'] as String,
    category: 'Classes',
    description:
        '<!-- RPG_RULES_JSON_START -->\n${jsonEncode({'schemaVersion': 1, 'type': 'class', 'id': rule['id'], 'defense': rule['defense'], 'hp': rule['hp'], 'mana': rule['mana'], 'attributeProgression': rule['progression']})}\n<!-- RPG_RULES_JSON_END -->',
  );

  final character = Character(
    id: 'audit',
    name: 'Auditoria',
    playerName: 'Teste',
    raceId: 'race',
    classId: 'class',
    attributes: const {
      AttributeId.strength: 2,
      AttributeId.dexterity: 3,
      AttributeId.constitution: 4,
      AttributeId.intelligence: 5,
      AttributeId.charisma: 6,
      AttributeId.faith: 7,
    },
  );

  test('as dez classes seguem as fórmulas oficiais do documento', () {
    for (final rule in rules) {
      final parsed = parser.parseClass(entryFor(rule));
      final expected = rule['expected'] as Map<String, dynamic>;
      expect(
        formulas.evaluate(parsed.defenseFormula, character),
        expected['defense'],
        reason: '${rule['name']}: Defesa',
      );
      expect(
        combat.armorClass(character, parsed.defenseFormula),
        10 + (expected['defense'] as int),
        reason: '${rule['name']}: CA',
      );
      if (expected.containsKey('initialHp')) {
        expect(
          formulas.evaluate(parsed.hpInitialFormula, character),
          expected['initialHp'],
          reason: '${rule['name']}: HP inicial',
        );
        expect(
          formulas.evaluate(parsed.hpFixedFormula, character),
          expected['fixedHp'],
          reason: '${rule['name']}: HP fixo',
        );
        expect(
          formulas.evaluate(parsed.hpRollFormula, character),
          expected['rollBonus'],
          reason: '${rule['name']}: bônus da rolagem',
        );
        expect(
          formulas.evaluate(parsed.hpHybridFormula, character),
          expected['hybridBonus'],
          reason: '${rule['name']}: bônus híbrido',
        );
      } else {
        expect(parsed.hpInitialFormula, isNull, reason: '${rule['name']}: HP');
      }
      if (expected.containsKey('mana')) {
        expect(
          formulas.evaluate(parsed.manaFormula, character),
          expected['mana'],
          reason: '${rule['name']}: Mana',
        );
      } else {
        expect(parsed.manaFormula, isNull, reason: '${rule['name']}: Mana');
      }
    }
  });

  test('progressão automática acumula os bônus corretos até o nível 10', () {
    final race = CatalogEntry(
      id: 'race',
      name: 'Raça neutra',
      category: 'Racas',
      description:
          '<!-- RPG_RULES_JSON_START -->\n${jsonEncode({'type': 'race'})}\n<!-- RPG_RULES_JSON_END -->',
    );
    for (final rule in rules) {
      final classEntry = entryFor(rule);
      final recalculated = CharacterRecalculationService().recalculate(
        Character(
          id: 'level-audit',
          name: 'Auditoria',
          playerName: 'Teste',
          raceId: race.id,
          classId: classEntry.id,
          level: 10,
        ),
        OfficialCatalog(entries: [race, classEntry]),
      );
      final expected = Map<String, dynamic>.from(
        (rule['expected'] as Map<String, dynamic>)['level10'] as Map,
      );
      for (final item in expected.entries) {
        final attribute = AttributeId.values.singleWhere(
          (value) => value.name == item.key,
        );
        expect(
          recalculated.modifiers
              .where(
                (modifier) =>
                    modifier.targetType == 'attribute' &&
                    modifier.targetId == attribute.name,
              )
              .fold<int>(0, (sum, modifier) => sum + modifier.value.round()),
          item.value,
          reason: '${rule['name']}: ${item.key}',
        );
      }
    }
  });

  test('as seis perícias usam pesos e arredondamento para baixo', () {
    final skills = <(String, String, int)>[
      ('Acrobacia', 'Destreza 90%; Força 10%.', 2),
      ('Medicina', 'Inteligência 60%; Constituição 40%.', 4),
      ('Percepção', 'Inteligência 90%; Fé 10%.', 5),
      ('Intimidação', 'Força 60%; Constituição 30%; Carisma 10%.', 3),
      ('Religião', 'Fé 100%.', 7),
      ('Furtividade', 'Destreza 70%; Inteligência 30%.', 3),
    ];
    for (final skill in skills) {
      final parsed = parser.parseSkill(
        CatalogEntry(
          id: skill.$1,
          name: skill.$1,
          description: skill.$2,
          category: 'Perícias',
        ),
      );
      expect(
        const SkillCalculator().officialValue(character, parsed),
        skill.$3,
        reason: skill.$1,
      );
    }
  });

  test('classes sem metadados ficam fora da criação e falham na validação', () {
    const incompleteClass = CatalogEntry(
      id: 'fighter',
      name: 'Guerreiro',
      description: 'Sem metadados.',
      category: 'Classes',
    );
    const race = CatalogEntry(
      id: 'race',
      name: 'Raça',
      description: '',
      category: 'Racas',
    );
    final catalog = OfficialCatalog(entries: [race, incompleteClass]);
    final result = const RuleValidationService().validate(
      Character(
        id: 'invalid',
        name: 'Teste',
        playerName: 'Teste',
        raceId: race.id,
        classId: incompleteClass.id,
        maxHp: 10,
        currentHp: 10,
      ),
      catalog,
    );
    expect(catalog.playableClasses, isEmpty);
    expect(result.isValid, isFalse);
    expect(result.errors, contains(contains('regras completas')));
  });

  test('o valor efetivo de um atributo respeita o limite absoluto de +20', () {
    final result = const OfficialFormulaCalculator().evaluate(
      const OfficialFormula(base: 0, terms: {'faith': 1}),
      character.copyWith(
        attributes: {...character.attributes, AttributeId.faith: 40},
      ),
    );
    expect(result, 20);
  });
}
