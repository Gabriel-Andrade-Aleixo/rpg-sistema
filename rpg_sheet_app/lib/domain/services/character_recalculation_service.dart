import '../../models/catalog_models.dart';
import '../../models/character.dart';
import '../../models/character_records.dart';
import '../../models/official_rule_models.dart';
import '../../services/trello_parser_service.dart';
import '../calculators/ability_calculator.dart';
import '../calculators/equipment_calculator.dart';
import '../calculators/proficiency_calculator.dart';
import '../calculators/official_formula_calculator.dart';

class CharacterRecalculationService {
  CharacterRecalculationService({
    TrelloParserService parser = const TrelloParserService(),
  }) : _parser = parser,
       _equipment = EquipmentCalculator(parser);

  final TrelloParserService _parser;
  final EquipmentCalculator _equipment;
  static const _proficiencies = ProficiencyCalculator();
  static const _abilities = AbilityCalculator();
  static const _formulas = OfficialFormulaCalculator();

  Character recalculate(Character character, OfficialCatalog catalog) {
    final raceEntry = catalog.findById(character.raceId);
    final classEntry = catalog.findById(character.classId);
    if (raceEntry == null || classEntry == null) return character;
    final race = _parser.parseRace(raceEntry, character.raceVariant);
    final characterClass = _parser.parseClass(classEntry);
    final modifiers = [
      ...race.modifiers,
      ...characterClass.modifiers,
      ..._classProgressionModifiers(character, classEntry, characterClass),
      ...character.permanentAttributeBonuses.entries
          .where((entry) => entry.value != 0)
          .map(
            (entry) => Modifier(
              id: 'permanent_${entry.key.name}',
              sourceId: character.id,
              sourceName: 'Progressão permanente',
              sourceType: 'experience',
              targetType: 'attribute',
              targetId: entry.key.name,
              value: entry.value,
              description: 'Bônus permanente obtido por conversão de XP.',
            ),
          ),
      ..._equipment.modifiers(character, catalog),
    ];
    final maximumMana = characterClass.manaFormula == null
        ? character.maxMana
        : _formulas.evaluate(
            characterClass.manaFormula,
            character,
            modifiers: modifiers,
          );
    final currentMana = _nextCurrent(
      character.currentMana,
      character.maxMana,
      maximumMana,
    );
    final resources = Map<String, int>.of(character.resources);
    for (final resource in characterClass.resourceRules) {
      final maximum = _formulas.evaluate(
        resource.maximum,
        character,
        modifiers: modifiers,
      );
      final maxKey = '${resource.id}Max';
      final currentKey = '${resource.id}Current';
      resources[currentKey] = _nextCurrent(
        resources[currentKey] ?? 0,
        resources[maxKey] ?? 0,
        maximum,
      );
      resources[maxKey] = maximum;
    }
    return character.copyWith(
      modifiers: modifiers,
      proficiencies: _proficiencies.calculate(character, race, characterClass),
      abilities: _abilities.calculate(character, race, characterClass),
      currentHp: character.currentHp.clamp(0, character.maxHp),
      maxMana: maximumMana,
      currentMana: currentMana,
      resources: resources,
    );
  }

  List<Modifier> _classProgressionModifiers(
    Character character,
    CatalogEntry classEntry,
    OfficialCharacterClass characterClass,
  ) {
    final result = <Modifier>[];
    for (final range in characterClass.attributeProgression) {
      final attained =
          (character.level.clamp(range.from, range.to) - range.from + 1).clamp(
            0,
            range.to - range.from + 1,
          );
      if (character.level < range.from) continue;
      for (final grant in range.perLevel.entries) {
        result.add(
          Modifier(
            id: '${classEntry.id}_level_${range.from}_${grant.key}',
            sourceId: classEntry.id,
            sourceName: '${classEntry.name} · níveis ${range.from}-${range.to}',
            sourceType: 'class_level',
            targetType: 'attribute',
            targetId: grant.key,
            value: grant.value * attained,
            description: 'Progressão automática definida no cadastro da classe.',
          ),
        );
      }
    }
    return result;
  }

  int _nextCurrent(int current, int oldMaximum, int newMaximum) {
    if (oldMaximum != newMaximum &&
        (oldMaximum == 0 || current == oldMaximum)) {
      return newMaximum;
    }
    return current.clamp(0, newMaximum);
  }
}
