import '../../models/catalog_models.dart';
import '../../models/character.dart';
import '../../models/character_records.dart';
import '../../services/trello_parser_service.dart';

class RuleValidationService {
  const RuleValidationService();

  RuleValidationResult validate(Character character, OfficialCatalog catalog) {
    final errors = <String>[];
    final warnings = <String>[];
    final suggestions = <String>[];
    if (character.name.trim().isEmpty) {
      errors.add('Informe o nome do personagem.');
    }
    if (catalog.findById(character.raceId) == null) {
      errors.add('Selecione uma raça do catálogo oficial.');
    }
    final raceEntry = catalog.findById(character.raceId);
    if (raceEntry != null) {
      if (!raceEntry.hasStructuredRules) {
        errors.add(
          'A raça selecionada ainda não possui regras completas do sistema.',
        );
      } else {
        final race = const TrelloParserService().parseRace(
          raceEntry,
          character.raceVariant,
        );
        if (race.variants.isNotEmpty && race.selectedVariant == null) {
          errors.add('Selecione uma variante válida da raça.');
        }
      }
    }
    final classEntry = catalog.findById(character.classId);
    if (classEntry == null) {
      errors.add('Selecione uma classe do catálogo oficial.');
    } else if (!classEntry.hasStructuredRules) {
      errors.add(
        'A classe selecionada ainda não possui regras completas do sistema.',
      );
    }
    if (character.attributes.values.any((value) => value < 0)) {
      errors.add('Atributos não podem ser negativos.');
    }
    if (character.attributes.values.fold<int>(0, (sum, value) => sum + value) >
        10) {
      errors.add('A distribuição inicial excede os 10 pontos disponíveis.');
    }
    if (character.attributes.keys.any(
      (attribute) =>
          (character.attributes[attribute] ?? 0) +
              (character.permanentAttributeBonuses[attribute] ?? 0) >
          20,
    )) {
      errors.add('O limite absoluto de um atributo é +20.');
    }
    if (catalog.entries.isEmpty) {
      errors.add('O catálogo do Trello está vazio ou indisponível.');
    }
    if (character.maxHp <= 0) {
      errors.add('A vida inicial ainda não foi definida.');
    }
    if (character.imageUrl.isEmpty) {
      suggestions.add('Adicione um avatar ao personagem.');
    }
    return RuleValidationResult(
      errors: errors,
      warnings: warnings,
      suggestions: suggestions,
    );
  }

  RuleValidationResult validateEquipment(
    Character character,
    CatalogEntry item,
  ) {
    final warnings = <String>[];
    if (item.description.toLowerCase().contains('requisito')) {
      warnings.add(
        'Confira os requisitos descritos no cartão antes de equipar.',
      );
    }
    return RuleValidationResult(warnings: warnings);
  }
}
