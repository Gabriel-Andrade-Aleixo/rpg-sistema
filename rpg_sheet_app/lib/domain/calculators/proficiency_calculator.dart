import '../../models/character.dart';
import '../../models/official_rule_models.dart';

class ProficiencyCalculator {
  const ProficiencyCalculator();

  List<String> calculate(
    Character character,
    OfficialRace race,
    OfficialCharacterClass characterClass,
  ) => {
    ...race.proficiencies,
    ...characterClass.proficiencies,
    ...character.manualProficiencies,
  }.toList();

  int rawRollBonus(Character character, String proficiency, int rawValue) {
    final normalized = proficiency.toLowerCase();
    final hasIt = character.proficiencies.any(
      (item) => item.toLowerCase().contains(normalized),
    );
    return hasIt ? rawValue : 0;
  }
}
