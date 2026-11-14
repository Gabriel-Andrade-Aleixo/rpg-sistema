import '../../models/character.dart';
import '../../models/character_records.dart';
import '../../models/rpg_rule_models.dart';

class StatBreakdown {
  const StatBreakdown({
    required this.base,
    required this.modifiers,
    required this.total,
    required this.rawTotal,
  });

  final int base;
  final List<Modifier> modifiers;
  final int total;
  final double rawTotal;
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
    var rawTotal = (character.attributes[attribute] ?? 0).toDouble();
    for (final modifier in relevant) {
      rawTotal = _apply(rawTotal, modifier);
    }
    rawTotal = rawTotal.clamp(-999999, 20);
    return StatBreakdown(
      base: character.attributes[attribute] ?? 0,
      modifiers: relevant,
      rawTotal: rawTotal,
      total: rawTotal.floor(),
    );
  }

  static double pointBonus(num startingValue, num points) {
    var value = startingValue.toDouble();
    for (var index = 0; index < points.toInt(); index += 1) {
      value += value < 5 ? 1 : value < 10 ? .5 : .2;
    }
    return value - startingValue;
  }

  double _apply(double current, Modifier modifier) => switch (modifier.operation) {
    ModifierOperation.add => current + modifier.value,
    ModifierOperation.subtract => current - modifier.value,
    ModifierOperation.multiply => current * modifier.value,
    ModifierOperation.overrideValue => modifier.value.toDouble(),
  };
}
