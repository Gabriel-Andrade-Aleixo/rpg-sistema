import 'catalog_models.dart';
import 'character_records.dart';

class OfficialRace {
  const OfficialRace({
    required this.entry,
    this.modifiers = const [],
    this.proficiencies = const [],
    this.abilities = const [],
    this.traits = const [],
    this.variants = const [],
    this.selectedVariant,
    this.mechanics = const {},
  });

  final CatalogEntry entry;
  final List<Modifier> modifiers;
  final List<String> proficiencies;
  final List<String> abilities;
  final List<String> traits;
  final List<OfficialRaceVariant> variants;
  final OfficialRaceVariant? selectedVariant;
  final Map<String, dynamic> mechanics;
}

class OfficialRaceVariant {
  const OfficialRaceVariant({
    required this.id,
    required this.name,
    this.traits = const [],
  });

  final String id;
  final String name;
  final List<String> traits;
}

class OfficialFormula {
  const OfficialFormula({this.base = 0, this.terms = const {}});

  final double base;
  final Map<String, double> terms;
}

class OfficialAttributeProgression {
  const OfficialAttributeProgression({
    required this.from,
    required this.to,
    required this.perLevel,
  });

  final int from;
  final int to;
  final Map<String, int> perLevel;
}

class OfficialResourceRule {
  const OfficialResourceRule({
    required this.id,
    required this.name,
    this.maximum,
  });

  final String id;
  final String name;
  final OfficialFormula? maximum;
}

class OfficialSkill {
  const OfficialSkill({required this.entry, this.terms = const []});

  final CatalogEntry entry;
  final List<OfficialSkillTerm> terms;
}

class OfficialSkillTerm {
  const OfficialSkillTerm({required this.attributeId, required this.weight});

  final String attributeId;
  final double weight;
}

class LevelUnlock {
  const LevelUnlock({
    required this.level,
    required this.name,
    this.description = '',
  });

  final int level;
  final String name;
  final String description;
}

class OfficialCharacterClass {
  const OfficialCharacterClass({
    required this.entry,
    this.hitDie,
    this.baseHp,
    this.hpPerLevelBase,
    this.skillPointsPerLevel,
    this.classPointsPerLevel,
    this.proficiencies = const [],
    this.resources = const [],
    this.unlocks = const [],
    this.modifiers = const [],
    this.hybridDie,
    this.defenseFormula,
    this.conditionalDefenseFormula,
    this.hpInitialFormula,
    this.hpFixedFormula,
    this.hpRollFormula,
    this.hpHybridFormula,
    this.manaFormula,
    this.attributeProgression = const [],
    this.allowedCombatXpAttributes = const [],
    this.resourceRules = const [],
    this.hasStructuredRules = false,
    this.mechanics = const {},
  });

  final CatalogEntry entry;
  final int? hitDie;
  final int? baseHp;
  final int? hpPerLevelBase;
  final int? skillPointsPerLevel;
  final int? classPointsPerLevel;
  final List<String> proficiencies;
  final List<String> resources;
  final List<LevelUnlock> unlocks;
  final List<Modifier> modifiers;
  final int? hybridDie;
  final OfficialFormula? defenseFormula;
  final OfficialFormula? conditionalDefenseFormula;
  final OfficialFormula? hpInitialFormula;
  final OfficialFormula? hpFixedFormula;
  final OfficialFormula? hpRollFormula;
  final OfficialFormula? hpHybridFormula;
  final OfficialFormula? manaFormula;
  final List<OfficialAttributeProgression> attributeProgression;
  final List<String> allowedCombatXpAttributes;
  final List<OfficialResourceRule> resourceRules;
  final bool hasStructuredRules;
  final Map<String, dynamic> mechanics;

  List<LevelUnlock> unlocksAt(int level) =>
      unlocks.where((item) => item.level == level).toList(growable: false);
}
