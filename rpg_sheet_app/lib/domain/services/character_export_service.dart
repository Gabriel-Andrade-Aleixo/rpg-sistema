import 'dart:convert';

import '../../models/character.dart';

class CharacterExportService {
  const CharacterExportService();

  String jsonPreview(Character character) =>
      const JsonEncoder.withIndent('  ').convert(character.toJson());
}
