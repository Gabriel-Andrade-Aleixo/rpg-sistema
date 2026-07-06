import '../../models/catalog_models.dart';
import '../../models/character.dart';
import '../../models/character_records.dart';
import '../../services/trello_parser_service.dart';

class EquipmentCalculator {
  const EquipmentCalculator(this._parser);

  final TrelloParserService _parser;

  List<Modifier> modifiers(Character character, OfficialCatalog catalog) {
    final result = <Modifier>[];
    for (final item in character.equipment) {
      final entry = catalog.findById(item.catalogId);
      result.addAll(
        _parser.parseEquipmentModifiers(
          entry ??
              CatalogEntry(
                id: item.id,
                name: item.name,
                description: '${item.description}\n${item.bonus}',
                category: item.type,
                imageUrl: item.imageUrl,
              ),
        ),
      );
    }
    return result;
  }
}
