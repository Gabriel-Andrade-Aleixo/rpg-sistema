import 'dart:async';
import 'dart:convert';

import '../models/character.dart';
import '../services/backend_api_service.dart';
import '../services/local_cache_service.dart';

class CharacterRepository {
  CharacterRepository({required BackendApiService backendApiService})
    : _backendApiService = backendApiService,
      _localCacheService = LocalCacheService();

  final BackendApiService _backendApiService;
  final LocalCacheService _localCacheService;
  final Map<String, Character> _savedCharacters = {};
  final Map<String, Character> _pendingCharacters = {};
  final Map<String, Timer> _saveTimers = {};
  final Map<String, Future<void>> _writeChains = {};

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
        _savedCharacters.addEntries(
          remote.map((item) => MapEntry(item.id, item)),
        );
        final merged = <String, Character>{
          for (final character in remote) character.id: character,
          ..._pendingCharacters,
        }.values.toList();
        await _localCacheService.replaceCharacters(merged);
        return merged;
      } catch (_) {
        return _localCacheService.listCharacters();
      }
    }
    return _localCacheService.listCharacters();
  }

  Future<Character?> getCharacter(String id) async {
    final pending = _pendingCharacters[id];
    if (pending != null) return pending;
    if (usingBackend) {
      try {
        final remote = await _backendApiService.getCharacter(id);
        if (remote != null) {
          _savedCharacters[id] = remote;
          await _localCacheService.saveCharacter(remote);
        }
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
    _saveTimers.remove(character.id)?.cancel();
    _pendingCharacters.remove(character.id);
    if (usingBackend) {
      final persisted = await _backendApiService.saveCharacter(character);
      _savedCharacters[persisted.id] = persisted;
      await _localCacheService.saveCharacter(persisted);
      return persisted;
    }
    await _localCacheService.saveCharacter(character);
    return character;
  }

  Future<Character> queueCharacterSave(Character character) async {
    await _localCacheService.saveCharacter(character);
    if (!usingBackend) return character;
    _pendingCharacters[character.id] = character;
    _saveTimers.remove(character.id)?.cancel();
    _saveTimers[character.id] = Timer(
      const Duration(milliseconds: 1200),
      () => _flushCharacter(character.id),
    );
    return character;
  }

  Future<void> flushCharacter(String id) async {
    _saveTimers.remove(id)?.cancel();
    await _flushCharacter(id);
    await (_writeChains[id] ?? Future<void>.value());
  }

  Future<void> _flushCharacter(String id) {
    _saveTimers.remove(id)?.cancel();
    final previousWrite = _writeChains[id] ?? Future<void>.value();
    final write = previousWrite.catchError((_) {}).then((_) async {
      final pending = _pendingCharacters.remove(id);
      if (pending == null) return;
      final previous = _savedCharacters[id];
      final changedFields = _changedFields(previous, pending);
      if (changedFields.isEmpty) return;
      try {
        final persisted = await _backendApiService.saveCharacter(
          pending,
          baseRevision: previous?.syncRevision ?? 0,
          changedFields: changedFields,
        );
        _savedCharacters[id] = persisted;
        final newer = _pendingCharacters[id];
        if (newer == null) {
          await _localCacheService.saveCharacter(persisted);
        } else {
          final revised = newer.copyWith(syncRevision: persisted.syncRevision);
          _pendingCharacters[id] = revised;
          await _localCacheService.saveCharacter(revised);
        }
      } catch (_) {
        _pendingCharacters.putIfAbsent(id, () => pending);
        _saveTimers[id] = Timer(
          const Duration(seconds: 4),
          () => _flushCharacter(id),
        );
      }
      if (_pendingCharacters.containsKey(id) && !_saveTimers.containsKey(id)) {
        _saveTimers[id] = Timer(
          const Duration(milliseconds: 1200),
          () => _flushCharacter(id),
        );
      }
    });
    late final Future<void> trackedWrite;
    trackedWrite = write.whenComplete(() {
      if (identical(_writeChains[id], trackedWrite)) _writeChains.remove(id);
    });
    _writeChains[id] = trackedWrite;
    return trackedWrite;
  }

  List<String> _changedFields(Character? previous, Character next) {
    final before = previous?.toJson() ?? const <String, dynamic>{};
    final after = next.toJson();
    const ignored = {'modifiers', 'syncRevision', 'updatedAt'};
    return after.keys
        .where(
          (key) =>
              !ignored.contains(key) &&
              jsonEncode(before[key]) != jsonEncode(after[key]),
        )
        .toList();
  }

  Future<void> deleteCharacter(String id) async {
    _saveTimers.remove(id)?.cancel();
    _pendingCharacters.remove(id);
    _savedCharacters.remove(id);
    if (usingBackend) {
      await _backendApiService.deleteCharacter(id);
    }
    await _localCacheService.deleteCharacter(id);
  }
}
