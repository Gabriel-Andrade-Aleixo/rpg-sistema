import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/character.dart';
import '../models/catalog_models.dart';

class BackendApiService {
  BackendApiService({required this.baseUrl, http.Client? client})
    : _client = client ?? http.Client();

  final String baseUrl;
  final http.Client _client;
  String _authToken = '';

  bool get isConfigured => baseUrl.trim().isNotEmpty;

  void setAuthToken(String token) {
    _authToken = token;
  }

  Future<void> setupRemote() async {
    await _post('/setup', {});
  }

  Future<Map<String, dynamic>> register({
    required String email,
    required String password,
    required String displayName,
  }) async {
    final data = await _post('/auth/register', {
      'email': email,
      'password': password,
      'displayName': displayName,
    });
    _authToken = data['token']?.toString() ?? '';
    return data;
  }

  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    final data = await _post('/auth/login', {
      'email': email,
      'password': password,
    });
    _authToken = data['token']?.toString() ?? '';
    return data;
  }

  Future<void> logout() async {
    if (_authToken.isNotEmpty) {
      try {
        await _post('/auth/logout', {});
      } catch (_) {
        // A sessão local ainda deve ser limpa.
      }
    }
    _authToken = '';
  }

  Future<Map<String, dynamic>> requestPasswordReset(String email) =>
      _post('/auth/password/request', {'email': email});

  Future<void> resetPassword({
    required String token,
    required String password,
  }) async {
    await _post('/auth/password/reset', {'token': token, 'password': password});
  }

  Future<Map<String, dynamic>> resetAdminUserPassword({
    required String userId,
    required String password,
  }) async {
    final data = await _put(
      '/admin/users/${Uri.encodeComponent(userId)}/password',
      {'password': password},
    );
    final user = data['user'];
    if (user is! Map) {
      throw StateError('O backend não confirmou a redefinição de senha.');
    }
    return Map<String, dynamic>.from(user);
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

  Future<List<Character>> listPublicCharacters() async {
    final data = await _get('/characters');
    final characters = (data['publicCharacters'] as List?) ?? [];
    return characters
        .whereType<Map>()
        .map((json) => Character.fromJson(Map<String, dynamic>.from(json)))
        .toList();
  }

  Future<List<Map<String, dynamic>>> listAdminUsers() async {
    final data = await _get('/admin/users');
    final users = (data['users'] as List?) ?? [];
    return users
        .whereType<Map>()
        .map((json) => Map<String, dynamic>.from(json))
        .toList();
  }

  Future<List<Map<String, dynamic>>> listAdminCharacters() async {
    final data = await _get('/admin/characters');
    final characters = (data['characters'] as List?) ?? [];
    return characters
        .whereType<Map>()
        .map((json) => Map<String, dynamic>.from(json))
        .toList();
  }

  Future<Map<String, dynamic>> transferCharacterOwner({
    required String characterId,
    required String ownerUserId,
  }) async {
    final data = await _put(
      '/admin/characters/${Uri.encodeComponent(characterId)}/owner',
      {'ownerUserId': ownerUserId},
    );
    final character = data['character'];
    if (character is! Map) {
      throw StateError('O backend não confirmou a transferência.');
    }
    return Map<String, dynamic>.from(character);
  }

  Future<Character?> getCharacter(String id) async {
    final data = await _get('/characters/${Uri.encodeComponent(id)}');
    final character = data['character'];
    if (character is! Map) return null;
    return Character.fromJson(Map<String, dynamic>.from(character));
  }

  Future<Character> saveCharacter(
    Character character, {
    int? baseRevision,
    List<String>? changedFields,
  }) async {
    final payload = <String, dynamic>{'character': character.toJson()};
    if (baseRevision != null) payload['baseRevision'] = baseRevision;
    if (changedFields != null && changedFields.isNotEmpty) {
      payload['changedFields'] = changedFields;
    }
    final data = await _post('/characters', payload);
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
    final response = await _client
        .get(_uri(path), headers: _headers())
        .timeout(const Duration(seconds: 25));
    return _decode(response);
  }

  Future<Map<String, dynamic>> _post(
    String path,
    Map<String, dynamic> payload,
  ) async {
    final response = await _client
        .post(_uri(path), headers: _headers(), body: jsonEncode(payload))
        .timeout(const Duration(seconds: 25));
    return _decode(response);
  }

  Future<Map<String, dynamic>> _delete(String path) async {
    final response = await _client
        .delete(_uri(path), headers: _headers())
        .timeout(const Duration(seconds: 25));
    return _decode(response);
  }

  Future<Map<String, dynamic>> _put(
    String path,
    Map<String, dynamic> payload,
  ) async {
    final response = await _client
        .put(_uri(path), headers: _headers(), body: jsonEncode(payload))
        .timeout(const Duration(seconds: 25));
    return _decode(response);
  }

  Uri _uri(String path) {
    final trimmed = baseUrl.endsWith('/')
        ? baseUrl.substring(0, baseUrl.length - 1)
        : baseUrl;
    return Uri.parse('$trimmed$path');
  }

  Map<String, String> _headers() => {
    'Content-Type': 'application/json',
    if (_authToken.isNotEmpty) 'Authorization': 'Bearer $_authToken',
  };

  Map<String, dynamic> _decode(http.Response response) {
    dynamic data;
    try {
      data = jsonDecode(response.body);
    } on FormatException {
      throw StateError(
        'O backend respondeu em um formato inválido (${response.statusCode}).',
      );
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = data is Map
          ? data['error']?.toString()
          : 'Backend respondeu ${response.statusCode}.';
      throw StateError(message ?? 'Backend respondeu ${response.statusCode}.');
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
