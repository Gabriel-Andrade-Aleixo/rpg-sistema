enum AttributeId {
  strength,
  dexterity,
  constitution,
  intelligence,
  charisma,
  faith,
}

enum HpProgressionMode { fixed, roll, hybrid }

extension AttributeLabel on AttributeId {
  String get label => switch (this) {
    AttributeId.strength => 'Forca',
    AttributeId.dexterity => 'Destreza',
    AttributeId.constitution => 'Constituicao',
    AttributeId.intelligence => 'Inteligencia',
    AttributeId.charisma => 'Carisma',
    AttributeId.faith => 'Fe',
  };
}

extension HpProgressionModeLabel on HpProgressionMode {
  String get label => switch (this) {
    HpProgressionMode.fixed => 'Valor fixo',
    HpProgressionMode.roll => 'Rolagem',
    HpProgressionMode.hybrid => 'Hibrido',
  };
}

class WeightedAttribute {
  const WeightedAttribute(this.attribute, this.weight);

  final AttributeId attribute;
  final double weight;
}

class SkillDefinition {
  const SkillDefinition({
    required this.id,
    required this.name,
    required this.components,
    this.notes,
  });

  final String id;
  final String name;
  final List<WeightedAttribute> components;
  final String? notes;
}

class AbilityDefinition {
  const AbilityDefinition({
    required this.name,
    required this.level,
    required this.description,
    this.mechanicalNote,
  });

  final String name;
  final int level;
  final String description;
  final String? mechanicalNote;
}

class ExcellenceDefinition {
  const ExcellenceDefinition({
    required this.id,
    required this.name,
    required this.focus,
    required this.effect,
    required this.requirement,
  });

  final String id;
  final String name;
  final String focus;
  final String effect;
  final String requirement;
}

class FormulaDefinition {
  const FormulaDefinition({
    required this.label,
    required this.components,
    this.base = 0,
    this.flatBonuses = const {},
    this.notes,
  });

  final String label;
  final int base;
  final List<WeightedAttribute> components;
  final Map<String, int> flatBonuses;
  final String? notes;
}

class HpFormulaDefinition {
  const HpFormulaDefinition({
    required this.initial,
    required this.fixedPerLevel,
    required this.rollPerLevel,
    required this.hybridPerLevel,
  });

  final FormulaDefinition initial;
  final String fixedPerLevel;
  final String rollPerLevel;
  final String hybridPerLevel;
}

class ResourceDefinition {
  const ResourceDefinition({
    required this.id,
    required this.name,
    this.formula,
    this.description,
  });

  final String id;
  final String name;
  final FormulaDefinition? formula;
  final String? description;
}

class RaceDefinition {
  const RaceDefinition({
    required this.id,
    required this.name,
    this.variants = const [],
    this.attributeBonuses = const {},
    this.skillBonuses = const {},
    this.traits = const [],
    this.notes,
  });

  final String id;
  final String name;
  final List<String> variants;
  final Map<AttributeId, int> attributeBonuses;
  final Map<String, int> skillBonuses;
  final List<String> traits;
  final String? notes;
}

class CharacterClassDefinition {
  const CharacterClassDefinition({
    required this.id,
    required this.name,
    this.parentClassId,
    required this.description,
    required this.defense,
    required this.hp,
    this.mana,
    this.resources = const [],
    this.attributeProgression = const [],
    this.allowedCombatXpAttributes = const [],
    this.abilities = const [],
    this.excellences = const [],
    this.notes,
  });

  final String id;
  final String name;
  final String? parentClassId;
  final String description;
  final FormulaDefinition defense;
  final HpFormulaDefinition hp;
  final FormulaDefinition? mana;
  final List<ResourceDefinition> resources;
  final List<String> attributeProgression;
  final List<AttributeId> allowedCombatXpAttributes;
  final List<AbilityDefinition> abilities;
  final List<ExcellenceDefinition> excellences;
  final String? notes;
}
