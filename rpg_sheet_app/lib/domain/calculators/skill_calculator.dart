import '../../models/character_records.dart';
import '../../models/character.dart';
import '../../models/official_rule_models.dart';
import '../../models/rpg_rule_models.dart';
import 'attribute_calculator.dart';

class SkillCalculator {
  const SkillCalculator();

  int calculate({
    required int attributeValue,
    required int proficiencyBonus,
    List<Modifier> modifiers = const [],
  }) =>
      attributeValue +
      proficiencyBonus +
      modifiers.fold<int>(0, (sum, item) => sum + item.value.round());

  int officialValue(Character character, OfficialSkill skill) {
    const calculator = AttributeCalculator();
    var weighted = 0.0;
    for (final term in skill.terms) {
      final attribute = AttributeId.values.firstWhere(
        (item) => item.name == term.attributeId,
      );
      weighted +=
          calculator
              .calculate(character, attribute, character.modifiers)
              .total *
          term.weight;
    }
    final catalogBonus = character.modifiers
        .where(
          (item) =>
              item.targetType == 'skill' &&
              item.targetId == skill.entry.normalizedName,
        )
        .fold<int>(0, (sum, item) => sum + item.value.round());
    return weighted.floor() +
        catalogBonus +
        (character.skillBonuses[skill.entry.id] ?? 0);
  }
}
