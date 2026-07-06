import '../../models/character.dart';
import '../../models/character_records.dart';
import '../../models/rpg_rule_models.dart';

class StatBreakdown {
  const StatBreakdown({
    required this.base,
    required this.modifiers,
    required this.total,
  });

  final int base;
  final List<Modifier> modifiers;
  final int total;
}

class AttributeCalculator {
  const AttributeCalculator();

  StatBreakdown calculate(
    Character character,
    AttributeId attribute,
    List<Modifier> modifiers,
  ) {
    final relevant = modifiers
        .where(
          (item) =>
              item.targetType == 'attribute' && item.targetId == attribute.name,
        )
        .toList();
    var total = character.attributes[attribute] ?? 0;
    for (final modifier in relevant) {
      total = _apply(total, modifier);
    }
    total = total.clamp(-999999, 20);
    return StatBreakdown(
      base: character.attributes[attribute] ?? 0,
      modifiers: relevant,
      total: total,
    );
  }

  int _apply(int current, Modifier modifier) => switch (modifier.operation) {
    ModifierOperation.add => current + modifier.value.round(),
    ModifierOperation.subtract => current - modifier.value.round(),
    ModifierOperation.multiply => (current * modifier.value).round(),
    ModifierOperation.overrideValue => modifier.value.round(),
  };
}
