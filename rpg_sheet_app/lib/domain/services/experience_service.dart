import '../../models/character.dart';
import '../../models/character_records.dart';
import '../../models/rpg_rule_models.dart';
import '../../utils/id_generator.dart';

class ClassXpBreakdown {
  const ClassXpBreakdown(this.values);

  final Map<String, int> values;

  int get total => values.values.fold(0, (sum, value) => sum + value);

  String get summary => values.entries
      .where((entry) => entry.value > 0)
      .map((entry) => '${ClassXpRules.labels[entry.key]} +${entry.value}')
      .join(' · ');
}

abstract final class ClassXpRules {
  static const labels = <String, String>{
    'participation': 'Participação na sessão',
    'combat': 'Combate',
    'strategy': 'Ação estratégica',
    'creativity': 'Uso criativo',
    'roleplay': 'Interpretação',
    'memorableMoment': 'Momento marcante',
    'importantProblem': 'Problema importante',
    'storyProgress': 'Avanço da narrativa',
    'difficultDecision': 'Decisão difícil',
    'sessionObjective': 'Objetivo da sessão',
    'personalObjective': 'Objetivo pessoal',
    'highlight': 'Destaque da sessão',
  };

  static ClassXpBreakdown calculate(Map<String, int> raw) {
    int clamp(String key, int maximum) => (raw[key] ?? 0).clamp(0, maximum);
    int allowed(String key, List<int> values) {
      final value = raw[key] ?? 0;
      return values.contains(value) ? value : 0;
    }

    return ClassXpBreakdown({
      'participation': clamp('participation', 1),
      'combat': clamp('combat', 5),
      'strategy': clamp('strategy', 1),
      'creativity': clamp('creativity', 1),
      'roleplay': clamp('roleplay', 1),
      'memorableMoment': clamp('memorableMoment', 1),
      'importantProblem': allowed('importantProblem', [0, 2]),
      'storyProgress': allowed('storyProgress', [0, 2, 3]),
      'difficultDecision': clamp('difficultDecision', 2),
      'sessionObjective': allowed('sessionObjective', [0, 2]),
      'personalObjective': clamp('personalObjective', 2),
      'highlight': clamp('highlight', 1),
    });
  }
}

class ExperienceService {
  const ExperienceService();

  int classXpRequired(int currentLevel) =>
      currentLevel >= 10 ? 75 : (currentLevel < 5 ? 20 : 40);

  Character registerClassXp(
    Character character,
    int amount,
    String note, {
    Map<String, int> breakdown = const {},
  }) {
    final safeAmount = amount < 0 ? 0 : amount;
    if (safeAmount == 0) return character;
    final record = ClassXpRecord(
      id: newId('class_xp'),
      amount: safeAmount,
      note: note.trim().isEmpty ? 'Sessão' : note.trim(),
      createdAt: DateTime.now(),
      breakdown: breakdown,
    );
    return character.copyWith(
      classXp: character.classXp + safeAmount,
      classXpTotal: character.classXpTotal + safeAmount,
      classXpHistory: [record, ...character.classXpHistory],
    );
  }

  Character registerAreaXp(Character character, String area, int amount) {
    final safeAmount = amount.clamp(1, 4);
    final values = Map<String, int>.of(character.areaExperience);
    values[area] = (values[area] ?? 0) + safeAmount;
    return character.copyWith(
      areaExperience: values,
      experienceHistory: [
        _record('area', safeAmount, '$area: XP por cena'),
        ...character.experienceHistory,
      ],
    );
  }

  Character registerCombatXp(Character character, int base, int participation) {
    final amount = (base.clamp(0, 4) + participation.clamp(0, 4)).clamp(0, 8);
    if (amount == 0) return character;
    return character.copyWith(
      combatXp: character.combatXp + amount,
      experienceHistory: [
        _record(
          'combat',
          amount,
          'Combate: base $base + participação $participation',
        ),
        ...character.experienceHistory,
      ],
    );
  }

  Character convertAreaToSkill(
    Character character,
    String area,
    String skillId,
  ) {
    final balance = character.areaExperience[area] ?? 0;
    if (balance < 20) return character;
    final areas = Map<String, int>.of(character.areaExperience)
      ..[area] = balance - 20;
    final bonuses = Map<String, int>.of(character.skillBonuses)
      ..[skillId] = (character.skillBonuses[skillId] ?? 0) + 1;
    return character.copyWith(
      areaExperience: areas,
      skillBonuses: bonuses,
      experienceHistory: [
        _record('conversion', -20, '$area: +1 permanente na perícia'),
        ...character.experienceHistory,
      ],
    );
  }

  Character convertAreaToAttribute(
    Character character,
    String area,
    AttributeId attribute,
  ) {
    final balance = character.areaExperience[area] ?? 0;
    final current =
        (character.attributes[attribute] ?? 0) +
        (character.permanentAttributeBonuses[attribute] ?? 0);
    if (balance < 20 || current >= 20) return character;
    final areas = Map<String, int>.of(character.areaExperience)
      ..[area] = balance - 20;
    final bonuses = Map<AttributeId, int>.of(
      character.permanentAttributeBonuses,
    )..[attribute] = (character.permanentAttributeBonuses[attribute] ?? 0) + 1;
    return character.copyWith(
      areaExperience: areas,
      permanentAttributeBonuses: bonuses,
      experienceHistory: [
        _record(
          'conversion',
          -20,
          '$area: +1 permanente em ${attribute.label}',
        ),
        ...character.experienceHistory,
      ],
    );
  }

  Character convertCombatToAttribute(
    Character character,
    AttributeId attribute,
  ) {
    final current =
        (character.attributes[attribute] ?? 0) +
        (character.permanentAttributeBonuses[attribute] ?? 0);
    if (character.combatXp < 25 || current >= 20) return character;
    final bonuses = Map<AttributeId, int>.of(
      character.permanentAttributeBonuses,
    )..[attribute] = (character.permanentAttributeBonuses[attribute] ?? 0) + 1;
    return character.copyWith(
      combatXp: character.combatXp - 25,
      permanentAttributeBonuses: bonuses,
      experienceHistory: [
        _record(
          'conversion',
          -25,
          'Combate: +1 permanente em ${attribute.label}',
        ),
        ...character.experienceHistory,
      ],
    );
  }

  List<AttributeId> allowedCombatAttributes(String className) {
    final normalized = className.toLowerCase();
    if (normalized.contains('paladino')) {
      return const [
        AttributeId.faith,
        AttributeId.strength,
        AttributeId.constitution,
        AttributeId.dexterity,
      ];
    }
    if (normalized == 'mago') {
      return const [AttributeId.intelligence, AttributeId.charisma];
    }
    return const [];
  }

  ExperienceRecord _record(String type, int amount, String description) =>
      ExperienceRecord(
        id: newId('xp'),
        type: type,
        amount: amount,
        description: description,
        createdAt: DateTime.now(),
      );
}
