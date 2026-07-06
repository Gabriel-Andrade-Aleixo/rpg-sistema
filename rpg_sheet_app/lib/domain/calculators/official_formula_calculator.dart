import '../../models/character.dart';
import '../../models/character_records.dart';
import '../../models/official_rule_models.dart';
import '../../models/rpg_rule_models.dart';
import 'attribute_calculator.dart';

class OfficialFormulaCalculator {
  const OfficialFormulaCalculator();

  int evaluate(
    OfficialFormula? formula,
    Character character, {
    List<Modifier>? modifiers,
  }) {
    if (formula == null) return 0;
    const attributes = AttributeCalculator();
    final activeModifiers = modifiers ?? character.modifiers;
    var total = formula.base;
    for (final term in formula.terms.entries) {
      final attribute = AttributeId.values
          .where((item) => item.name == term.key)
          .firstOrNull;
      if (attribute == null) continue;
      total +=
          attributes.calculate(character, attribute, activeModifiers).total *
          term.value;
    }
    return total.floor().clamp(0, 999999);
  }
}
