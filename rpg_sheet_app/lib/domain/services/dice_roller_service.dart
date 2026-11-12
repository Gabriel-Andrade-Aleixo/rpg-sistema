import 'dart:math';

import '../../models/character_records.dart';
import '../../utils/id_generator.dart';

class DiceRollerService {
  DiceRollerService({Random? random}) : _random = random ?? Random.secure();

  final Random _random;

  DiceRollRecord roll({
    required String characterId,
    required String type,
    required String name,
    required int sides,
    List<Modifier> modifiers = const [],
    int penalties = 0,
    String origin = 'character_sheet',
    String rollMode = 'normal',
  }) {
    if (![4, 6, 8, 10, 12, 20, 100].contains(sides)) {
      throw ArgumentError.value(sides, 'sides', 'Dado não suportado.');
    }
    final first = _random.nextInt(sides) + 1;
    final secondary = rollMode == 'normal' ? null : _random.nextInt(sides) + 1;
    final raw = rollMode == 'disadvantage'
        ? min(first, secondary!)
        : rollMode == 'advantage'
        ? max(first, secondary!)
        : first;
    final bonus = modifiers.fold<int>(
      0,
      (sum, item) => sum + item.value.round(),
    );
    return DiceRollRecord(
      id: newId('roll'),
      characterId: characterId,
      type: type,
      name: name,
      die: 'd$sides',
      rawResult: raw,
      firstResult: first,
      secondaryResult: secondary,
      rollMode: rollMode,
      finalResult: raw + bonus - penalties,
      modifiers: modifiers,
      penalties: penalties,
      origin: origin,
      createdAt: DateTime.now(),
    );
  }
}
