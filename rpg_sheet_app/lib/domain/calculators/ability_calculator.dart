import '../../models/character.dart';
import '../../models/official_rule_models.dart';

class AbilityCalculator {
  const AbilityCalculator();

  List<String> calculate(
    Character character,
    OfficialRace race,
    OfficialCharacterClass characterClass,
  ) => {
    ...race.abilities,
    ...characterClass.unlocks
        .where((item) => item.level <= character.level)
        .map((item) => item.name),
    ...character.abilities,
  }.toList();
}
