import '../models/character.dart';
import '../services/backend_api_service.dart';
import '../services/local_cache_service.dart';

class CharacterRepository {
  CharacterRepository({required BackendApiService backendApiService})
    : _backendApiService = backendApiService,
      _localCacheService = LocalCacheService();

  final BackendApiService _backendApiService;
  final LocalCacheService _localCacheService;

  bool get usingBackend => _backendApiService.isConfigured;
  bool get usingRemote => usingBackend;

  String get backendLabel {
    if (usingBackend) return 'Backend';
    return 'Armazenamento local';
  }

  Future<void> setupRemote() async {
    if (!usingBackend) return;
    try {
      await _backendApiService.setupRemote();
    } catch (_) {
      // A listagem ainda pode usar o espelho local enquanto o backend retorna.
    }
  }

  Future<List<Character>> listCharacters() async {
    if (usingBackend) {
      try {
        final remote = await _backendApiService.listCharacters();
        await _localCacheService.replaceCharacters(remote);
        return remote;
      } catch (_) {
        return _localCacheService.listCharacters();
      }
    }
    return _localCacheService.listCharacters();
  }

  Future<Character?> getCharacter(String id) async {
    if (usingBackend) {
      try {
        final remote = await _backendApiService.getCharacter(id);
        if (remote != null) await _localCacheService.saveCharacter(remote);
        return remote;
      } catch (_) {
        // Continua no espelho local.
      }
    }
    for (final character in await _localCacheService.listCharacters()) {
      if (character.id == id) return character;
    }
    return null;
  }

  Future<Character> saveCharacter(Character character) async {
    if (usingBackend) {
      final persisted = await _backendApiService.saveCharacter(character);
      await _localCacheService.saveCharacter(persisted);
      return persisted;
    }
    await _localCacheService.saveCharacter(character);
    return character;
  }

  Future<void> deleteCharacter(String id) async {
    if (usingBackend) {
      await _backendApiService.deleteCharacter(id);
      return;
    }
    await _localCacheService.deleteCharacter(id);
  }
}
