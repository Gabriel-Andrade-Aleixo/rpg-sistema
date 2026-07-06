import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/character.dart';
import '../models/catalog_models.dart';

class BackendApiService {
  BackendApiService({required this.baseUrl, http.Client? client})
    : _client = client ?? http.Client();

  final String baseUrl;
  final http.Client _client;

  bool get isConfigured => baseUrl.trim().isNotEmpty;

  Future<void> setupRemote() async {
    await _post('/setup', {});
  }

  Future<OfficialCatalog> loadCatalog({bool refresh = false}) async {
    final data = await _get('/catalog${refresh ? '?refresh=true' : ''}');
    final catalog = data['catalog'];
    if (catalog is! Map) throw StateError('Catalogo invalido no backend.');
    return OfficialCatalog.fromJson(Map<String, dynamic>.from(catalog));
  }

  Future<CatalogEntry> createCatalogItem(Map<String, dynamic> item) async {
    final data = await _post('/catalog/items', {'item': item});
    final created = data['item'];
    if (created is! Map) {
      throw StateError('O backend não confirmou o item criado.');
    }
    return CatalogEntry.fromJson(Map<String, dynamic>.from(created));
  }

  Future<CatalogEntry> createCatalogSpell(Map<String, dynamic> spell) async {
    final data = await _post('/catalog/spells', {'spell': spell});
    final created = data['spell'];
    if (created is! Map) {
      throw StateError('O backend não confirmou a magia criada.');
    }
    return CatalogEntry.fromJson(Map<String, dynamic>.from(created));
  }

  Future<CatalogEntry> updateCatalogEntry(
    String kind,
    String id,
    Map<String, dynamic> entry,
  ) async {
    final resource = kind == 'spell' ? 'spells' : 'items';
    final data = await _put('/catalog/$resource/${Uri.encodeComponent(id)}', {
      kind: entry,
    });
    final updated = data[kind];
    if (updated is! Map) {
      throw StateError('O backend não confirmou a alteração.');
    }
    return CatalogEntry.fromJson(Map<String, dynamic>.from(updated));
  }

  Future<void> deleteCatalogEntry(String kind, String id) async {
    final resource = kind == 'spell' ? 'spells' : 'items';
    await _delete('/catalog/$resource/${Uri.encodeComponent(id)}');
  }

  Future<List<Character>> listCharacters() async {
    final data = await _get('/characters');
    final characters = (data['characters'] as List?) ?? [];
    return characters
        .whereType<Map>()
        .map((json) => Character.fromJson(Map<String, dynamic>.from(json)))
        .toList();
  }

  Future<Character?> getCharacter(String id) async {
    final data = await _get('/characters/${Uri.encodeComponent(id)}');
    final character = data['character'];
    if (character is! Map) return null;
    return Character.fromJson(Map<String, dynamic>.from(character));
  }

  Future<Character> saveCharacter(Character character) async {
    final data = await _post('/characters', {'character': character.toJson()});
    final persisted = data['character'];
    if (persisted is! Map) {
      throw StateError('O backend não confirmou a ficha salva.');
    }
    return Character.fromJson(Map<String, dynamic>.from(persisted));
  }

  Future<void> deleteCharacter(String id) async {
    await _delete('/characters/${Uri.encodeComponent(id)}');
  }

  Future<Map<String, dynamic>> _get(String path) async {
    final response = await _client.get(_uri(path));
    return _decode(response);
  }

  Future<Map<String, dynamic>> _post(
    String path,
    Map<String, dynamic> payload,
  ) async {
    final response = await _client.post(
      _uri(path),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(payload),
    );
    return _decode(response);
  }

  Future<Map<String, dynamic>> _delete(String path) async {
    final response = await _client.delete(_uri(path));
    return _decode(response);
  }

  Future<Map<String, dynamic>> _put(
    String path,
    Map<String, dynamic> payload,
  ) async {
    final response = await _client.put(
      _uri(path),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(payload),
    );
    return _decode(response);
  }

  Uri _uri(String path) {
    final trimmed = baseUrl.endsWith('/')
        ? baseUrl.substring(0, baseUrl.length - 1)
        : baseUrl;
    return Uri.parse('$trimmed$path');
  }

  Map<String, dynamic> _decode(http.Response response) {
    final data = jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError(
        'Backend respondeu ${response.statusCode}: ${response.body}',
      );
    }
    if (data is! Map) throw StateError('Resposta invalida do backend.');
    if (data['ok'] != true) {
      throw StateError(
        data['error']?.toString() ?? 'Erro desconhecido no backend.',
      );
    }
    return Map<String, dynamic>.from(data);
  }
}
