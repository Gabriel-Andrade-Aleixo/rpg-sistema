import 'dart:math' as math;

import '../../models/character.dart';

class SwordsmanCombatState {
  const SwordsmanCombatState({
    required this.threats,
    required this.concentration,
    required this.dodgeUsed,
    required this.openingUsed,
  });

  final int threats;
  final int concentration;
  final bool dodgeUsed;
  final bool openingUsed;
}

class SwordsmanCombatService {
  const SwordsmanCombatService();

  SwordsmanCombatState state(Character character) {
    final resources = character.resources;
    final threats = math.min(
      20,
      math.max(0, resources['swordsmanThreats'] ?? 0),
    );
    return SwordsmanCombatState(
      threats: threats,
      concentration: math.min(
        2,
        math.max(
          0,
          resources['swordsmanConcentration'] ??
              math.min(2, math.max(0, threats - 1)),
        ),
      ),
      dodgeUsed: (resources['swordsmanDodgeUsed'] ?? 0) != 0,
      openingUsed: (resources['swordsmanOpeningUsed'] ?? 0) != 0,
    );
  }

  Character setThreats(Character character, int count) {
    final current = state(character);
    final threats = math.min(20, math.max(0, count));
    final required = math.min(2, math.max(0, threats - 1));
    final concentration = threats > current.threats
        ? math.max(current.concentration, required)
        : current.concentration;
    return character.copyWith(
      resources: {
        ...character.resources,
        'swordsmanThreats': threats,
        'swordsmanConcentration': concentration,
      },
    );
  }

  Character startTurn(Character character) {
    final current = state(character);
    final required = math.min(2, math.max(0, current.threats - 1));
    final recovery = character.level >= 9 && current.threats <= 1 ? 2 : 1;
    final concentration = math.max(required, current.concentration - recovery);
    return character.copyWith(
      resources: {
        ...character.resources,
        'swordsmanConcentration': concentration,
        'swordsmanDodgeUsed': 0,
        'swordsmanOpeningUsed': 0,
      },
    );
  }

  Character markAction(Character character, String action) {
    final key = action == 'dodge'
        ? 'swordsmanDodgeUsed'
        : 'swordsmanOpeningUsed';
    return character.copyWith(resources: {...character.resources, key: 1});
  }
}
