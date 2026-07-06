import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:rpg_sheet_app/domain/calculators/combat_calculator.dart';
import 'package:rpg_sheet_app/domain/calculators/official_formula_calculator.dart';
import 'package:rpg_sheet_app/domain/services/character_recalculation_service.dart';
import 'package:rpg_sheet_app/models/catalog_models.dart';
import 'package:rpg_sheet_app/models/character.dart';
import 'package:rpg_sheet_app/models/rpg_rule_models.dart';
import 'package:rpg_sheet_app/services/trello_parser_service.dart';

void main() {
  const parser = TrelloParserService();

  String rules(Map<String, dynamic> data) =>
      '<!-- RPG_RULES_JSON_START -->\n${jsonEncode(data)}\n<!-- RPG_RULES_JSON_END -->';

  final race = CatalogEntry(
    id: 'race',
    name: 'Thri-kreen',
    description: rules({
      'type': 'race',
      'attributeBonuses': {'dexterity': 1},
      'variants': [
        {
          'id': 'four_arms',
          'name': 'Quatro braços',
          'skillRollBonuses': {'furtividade': 1},
        },
        {
          'id': 'wings',
          'name': 'Asas',
          'attributeRollBonuses': {'dexterity': 1},
        },
      ],
    }),
    category: 'Racas',
  );

  final characterClass = CatalogEntry(
    id: 'class',
    name: 'Arqueiro Espectral',
    description: rules({
      'type': 'class',
      'defense': {
        'base': 0,
        'terms': {'constitution': .4, 'dexterity': .3, 'intelligence': .3},
      },
      'hp': {
        'initial': {
          'base': 10,
          'terms': {'constitution': 2, 'dexterity': 2},
        },
        'perLevel': {
          'fixed': {
            'base': 5,
            'terms': {'constitution': 1},
          },
          'roll': {
            'die': 8,
            'base': 0,
            'terms': {'constitution': 1},
          },
          'hybrid': {
            'die': 4,
            'base': 4,
            'terms': {'constitution': 1},
          },
        },
      },
      'mana': {
        'base': 15,
        'terms': {'intelligence': 1, 'dexterity': 2},
      },
      'attributeProgression': [
        {
          'from': 1,
          'to': 3,
          'perLevel': {'dexterity': 1},
        },
        {
          'from': 4,
          'to': 10,
          'perLevel': {'dexterity': 1, 'intelligence': 1},
        },
      ],
    }),
    category: 'Classes',
  );

  test('metadados estruturados calculam progressão, mana, HP e CA', () {
    final catalog = OfficialCatalog(entries: [race, characterClass]);
    final character = Character(
      id: 'character',
      name: 'Teste',
      playerName: 'Jogador',
      raceId: race.id,
      raceVariant: 'four_arms',
      classId: characterClass.id,
      attributes: {
        AttributeId.strength: 0,
        AttributeId.dexterity: 2,
        AttributeId.constitution: 3,
        AttributeId.intelligence: 1,
        AttributeId.charisma: 0,
        AttributeId.faith: 0,
      },
    );
    final recalculated = CharacterRecalculationService().recalculate(
      character,
      catalog,
    );
    final parsedClass = parser.parseClass(characterClass);

    expect(recalculated.maxMana, 24);
    expect(
      recalculated.modifiers.any(
        (item) => item.targetType == 'skillRoll' && item.value == 1,
      ),
      isTrue,
    );
    expect(
      const OfficialFormulaCalculator().evaluate(
        parsedClass.hpInitialFormula,
        recalculated,
      ),
      24,
    );
    expect(
      const CombatCalculator().armorClass(
        recalculated,
        parsedClass.defenseFormula,
      ),
      12,
    );
  });

  test('variante com asas aplica bônus apenas na rolagem de Destreza', () {
    final parsed = parser.parseRace(race, 'wings');
    expect(parsed.selectedVariant?.name, 'Asas');
    expect(
      parsed.modifiers
          .singleWhere((item) => item.targetType == 'attributeRoll')
          .targetId,
      'dexterity',
    );
    expect(
      parsed.modifiers
          .singleWhere((item) => item.targetType == 'attribute')
          .value,
      1,
    );
  });

  test('Thri-kreen Arqueiro Espectral inicia com +2 Destreza de bônus', () {
    final catalog = OfficialCatalog(entries: [race, characterClass]);
    final recalculated = CharacterRecalculationService().recalculate(
      Character(
        id: 'thri-archer',
        name: 'Teste',
        playerName: 'Jogador',
        raceId: race.id,
        raceVariant: 'four_arms',
        classId: characterClass.id,
      ),
      catalog,
    );
    final dexterityBonus = recalculated.modifiers
        .where(
          (item) =>
              item.targetType == 'attribute' &&
              item.targetId == AttributeId.dexterity.name,
        )
        .fold<int>(0, (sum, item) => sum + item.value.round());
    expect(dexterityBonus, 2);
  });

  test('armadura equipada aumenta Defesa e CA', () {
    final armor = CatalogEntry(
      id: 'leather',
      name: 'Armadura de Couro',
      category: 'Itens',
      description: rules({
        'type': 'item',
        'modifiers': [
          {'targetType': 'stat', 'targetId': 'defense', 'value': 1},
        ],
      }),
    );
    final catalog = OfficialCatalog(entries: [race, characterClass, armor]);
    final base = Character(
      id: 'armor-test',
      name: 'Teste',
      playerName: 'Jogador',
      raceId: race.id,
      classId: characterClass.id,
      attributes: {
        AttributeId.strength: 0,
        AttributeId.dexterity: 4,
        AttributeId.constitution: 3,
        AttributeId.intelligence: 2,
        AttributeId.charisma: 0,
        AttributeId.faith: 0,
      },
    );
    final service = CharacterRecalculationService();
    final unequipped = service.recalculate(base, catalog);
    final equipped = service.recalculate(
      base.copyWith(
        equipment: [
          const InventoryItem(
            id: 'owned-leather',
            catalogId: 'leather',
            name: 'Armadura de Couro',
          ),
        ],
      ),
      catalog,
    );
    final formula = parser.parseClass(characterClass).defenseFormula;
    expect(
      const CombatCalculator().defense(equipped, formula),
      const CombatCalculator().defense(unequipped, formula) + 1,
    );
    expect(
      const CombatCalculator().armorClass(equipped, formula),
      const CombatCalculator().armorClass(unequipped, formula) + 1,
    );
  });

  test('item personalizado só aplica bônus quando equipado', () {
    final catalog = OfficialCatalog(entries: [race, characterClass]);
    const custom = InventoryItem(
      id: 'custom',
      name: 'Colete artesanal',
      type: 'Armadura',
      bonus: 'Defesa: +2',
    );
    final base = Character(
      id: 'custom-test',
      name: 'Teste',
      playerName: 'Jogador',
      raceId: race.id,
      classId: characterClass.id,
    );
    final service = CharacterRecalculationService();
    final stored = service.recalculate(
      base.copyWith(inventory: [custom]),
      catalog,
    );
    final equipped = service.recalculate(
      base.copyWith(equipment: [custom]),
      catalog,
    );
    final formula = parser.parseClass(characterClass).defenseFormula;
    expect(
      const CombatCalculator().defense(equipped, formula),
      const CombatCalculator().defense(stored, formula) + 2,
    );
  });
}
