import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../models/character.dart';

class LocalCacheService {
  static const _charactersKey = 'rpg_characters_v2';

  Future<List<Character>> listCharacters() async {
    final preferences = await SharedPreferences.getInstance();
    final raw = preferences.getString(_charactersKey);
    if (raw == null || raw.isEmpty) return [];
    final list = jsonDecode(raw) as List<dynamic>;
    return list
        .whereType<Map>()
        .map((item) => Character.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  Future<void> saveCharacter(Character character) async {
    final characters = await listCharacters();
    final index = characters.indexWhere((item) => item.id == character.id);
    if (index == -1) {
      characters.add(character);
    } else {
      characters[index] = character;
    }
    await _write(characters);
  }

  Future<void> deleteCharacter(String id) async {
    final characters = await listCharacters();
    characters.removeWhere((item) => item.id == id);
    await _write(characters);
  }

  Future<void> replaceCharacters(List<Character> characters) =>
      _write(characters);

  Future<void> _write(List<Character> characters) async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.setString(
      _charactersKey,
      jsonEncode(characters.map((item) => item.toJson()).toList()),
    );
  }
}
