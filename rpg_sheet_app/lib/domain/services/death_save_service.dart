import '../../models/character.dart';

class DeathSaveService {
  const DeathSaveService();

  Character changeHitPoints(Character character, int nextHp) {
    final currentHp = nextHp.clamp(0, character.maxHp);
    if (currentHp == 0) return character.copyWith(currentHp: 0);
    return character.copyWith(
      currentHp: currentHp,
      resources: {
        ...character.resources,
        'deathSuccesses': 0,
        'deathFailures': 0,
        'dead': 0,
      },
    );
  }

  Character record(Character character, {required bool success}) {
    if (character.currentHp > 0 || character.resources['dead'] == 1) {
      return character;
    }
    final resources = Map<String, int>.of(character.resources);
    final key = success ? 'deathSuccesses' : 'deathFailures';
    resources[key] = ((resources[key] ?? 0) + 1).clamp(0, 3);
    if (success && resources[key] == 3) {
      return character.copyWith(
        currentHp: 1,
        resources: {
          ...resources,
          'deathSuccesses': 0,
          'deathFailures': 0,
          'dead': 0,
        },
      );
    }
    if (!success && resources[key] == 3) resources['dead'] = 1;
    return character.copyWith(resources: resources);
  }

  Character reset(Character character) => character.copyWith(
    resources: {
      ...character.resources,
      'deathSuccesses': 0,
      'deathFailures': 0,
      'dead': 0,
    },
  );
}
