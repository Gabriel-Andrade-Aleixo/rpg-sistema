import '../../models/character_records.dart';
import '../../models/character.dart';
import '../../models/rpg_rule_models.dart';
import 'attribute_calculator.dart';
import 'official_formula_calculator.dart';
import '../../models/official_rule_models.dart';

class CombatCalculator {
  const CombatCalculator();

  int value(String target, List<Modifier> modifiers, {int base = 0}) =>
      modifiers
          .where((item) => item.targetType == 'stat' && item.targetId == target)
          .fold<int>(base, (sum, item) => sum + item.value.round());

  int defense(Character character, [OfficialFormula? formula]) {
    final equipmentBonus = value('defense', character.modifiers);
    if (formula != null) {
      return const OfficialFormulaCalculator().evaluate(formula, character) +
          equipmentBonus;
    }
    const calculator = AttributeCalculator();
    final dexterity = calculator
        .calculate(character, AttributeId.dexterity, character.modifiers)
        .total;
    final constitution = calculator
        .calculate(character, AttributeId.constitution, character.modifiers)
        .total;
    return (dexterity * .7 + constitution * .3).floor() + equipmentBonus;
  }

  int armorClass(Character character, [OfficialFormula? formula]) =>
      10 +
      defense(character, formula) +
      value('armorClass', character.modifiers);
}
