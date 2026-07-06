import 'dart:math';

import '../data/system_definitions.dart';
import '../models/character.dart';
import '../models/rpg_rule_models.dart';

class CharacterCalculator {
  const CharacterCalculator();

  Map<AttributeId, int> effectiveAttributes(Character character) {
    final race = raceById(character.raceId);
    return {
      for (final attribute in AttributeId.values)
        attribute:
            (character.attributes[attribute] ?? 0) +
            (race.attributeBonuses[attribute] ?? 0),
    };
  }

  int spentAttributePoints(Character character) {
    return character.attributes.values.fold(0, (sum, value) => sum + value);
  }

  String? validateAttributes(Character character) {
    final spent = spentAttributePoints(character);
    if (spent > initialAttributePoints) {
      return 'Distribuicao excede $initialAttributePoints pontos iniciais.';
    }
    for (final entry in character.attributes.entries) {
      if (entry.value < 0) return '${entry.key.label} nao pode ser negativo.';
      if (entry.value > naturalAttributeMax) {
        return '${entry.key.label} passou do limite natural $naturalAttributeMax.';
      }
    }
    return null;
  }

  int evaluateFormula(
    FormulaDefinition formula,
    Map<AttributeId, int> attributes,
  ) {
    final weighted = formula.components.fold<double>(
      formula.base.toDouble(),
      (sum, component) =>
          sum + ((attributes[component.attribute] ?? 0) * component.weight),
    );
    final flat = formula.flatBonuses.values.fold<int>(
      0,
      (sum, value) => sum + value,
    );
    return weighted.floor() + flat;
  }

  int skillValue(Character character, SkillDefinition skill) {
    final race = raceById(character.raceId);
    final attributes = effectiveAttributes(character);
    return evaluateFormula(
          FormulaDefinition(label: skill.name, components: skill.components),
          attributes,
        ) +
        (race.skillBonuses[skill.id] ?? 0) +
        (character.skillBonuses[skill.id] ?? 0);
  }

  Map<String, int> allSkillValues(Character character) => {
    for (final skill in skills) skill.id: skillValue(character, skill),
  };

  int defense(Character character, {bool rangerAdaptive = false}) {
    final klass = classById(character.classId);
    if (rangerAdaptive && klass.id == 'ranger') {
      return evaluateFormula(
        const FormulaDefinition(
          label: 'Defesa Adaptativa',
          components: [
            WeightedAttribute(AttributeId.dexterity, .60),
            WeightedAttribute(AttributeId.constitution, .30),
            WeightedAttribute(AttributeId.intelligence, .10),
          ],
        ),
        effectiveAttributes(character),
      );
    }
    return evaluateFormula(klass.defense, effectiveAttributes(character));
  }

  int armorClass(Character character) {
    var value = 10 + defense(character);
    if (character.raceId == 'lizardfolk') value += 2;
    value += _bonusFromItems(character.equipment, 'ca');
    value += _bonusFromItems(character.inventory, 'ca');
    return value;
  }

  int initialHp(Character character) {
    final klass = classById(character.classId);
    return evaluateFormula(klass.hp.initial, effectiveAttributes(character));
  }

  int maxMana(Character character) {
    final mana = classById(character.classId).mana;
    if (mana == null) return 0;
    return max(0, evaluateFormula(mana, effectiveAttributes(character)));
  }

  int resourceMax(Character character, ResourceDefinition resource) {
    final formula = resource.formula;
    if (formula == null) return character.resources[resource.id] ?? 0;
    return evaluateFormula(formula, effectiveAttributes(character));
  }

  int divineResistanceDc(int humanity) {
    if (humanity >= 51) return 15;
    if (humanity >= 26) return 18;
    if (humanity >= 11) return 18;
    if (humanity >= 2) return 19;
    return 20;
  }

  int divineResistanceBonus(int humanity) => (humanity / 10).floor();

  int divinityAttributeBuff(int divinity) => min(5, (divinity / 15).floor());

  int corruptionDamageBonus(int corruption) => (corruption / 10).floor();

  Currency normalizeCurrency(Currency currency) => currency.normalized();

  int _bonusFromItems(List<InventoryItem> items, String key) {
    var total = 0;
    final pattern = RegExp('$key\\s*([+-]\\d+)', caseSensitive: false);
    for (final item in items) {
      final match = pattern.firstMatch(item.bonus);
      if (match != null) total += int.tryParse(match.group(1) ?? '') ?? 0;
    }
    return total;
  }
}
