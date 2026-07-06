import '../../models/character.dart';
import '../../models/character_records.dart';
import '../../models/official_rule_models.dart';

class HealthCalculator {
  const HealthCalculator();

  int effectiveMaximum(Character character, List<Modifier> modifiers) {
    final bonus = modifiers
        .where((item) => item.targetId == 'health')
        .fold<int>(0, (sum, item) => sum + item.value.round());
    return (character.maxHp + bonus).clamp(0, 999999);
  }

  int levelBase(OfficialCharacterClass characterClass) =>
      characterClass.baseHp ?? ((characterClass.hitDie ?? 0) / 2).ceil();
}
