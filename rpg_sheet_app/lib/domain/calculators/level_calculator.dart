import '../../models/official_rule_models.dart';

class LevelUpPreview {
  const LevelUpPreview({
    required this.fromLevel,
    required this.toLevel,
    required this.skillPoints,
    required this.classPoints,
    required this.unlocks,
    required this.proficiencies,
    required this.hitDie,
    required this.baseHp,
  });

  final int fromLevel;
  final int toLevel;
  final int skillPoints;
  final int classPoints;
  final List<String> unlocks;
  final List<String> proficiencies;
  final int? hitDie;
  final int? baseHp;
}

class LevelCalculator {
  const LevelCalculator();

  LevelUpPreview preview(
    int currentLevel,
    OfficialCharacterClass characterClass,
  ) {
    final next = currentLevel + 1;
    return LevelUpPreview(
      fromLevel: currentLevel,
      toLevel: next,
      skillPoints: characterClass.skillPointsPerLevel ?? 0,
      classPoints: characterClass.classPointsPerLevel ?? 0,
      unlocks: characterClass.unlocksAt(next).map((item) => item.name).toList(),
      proficiencies: const [],
      hitDie: characterClass.hitDie,
      baseHp: characterClass.hpPerLevelBase,
    );
  }
}
