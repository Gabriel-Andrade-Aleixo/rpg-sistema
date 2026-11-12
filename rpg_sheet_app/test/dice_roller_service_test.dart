import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:rpg_sheet_app/domain/services/dice_roller_service.dart';
import 'package:rpg_sheet_app/models/character_records.dart';

void main() {
  test('desvantagem conserva as duas rolagens e usa o menor d20', () {
    final source = Random(42);
    final first = source.nextInt(20) + 1;
    final second = source.nextInt(20) + 1;
    final record = DiceRollerService(random: Random(42)).roll(
      characterId: 'char_swordsman',
      type: 'attack',
      name: 'Ataque de Abertura',
      sides: 20,
      rollMode: 'disadvantage',
    );
    expect(record.rawResult, min(first, second));
    expect(record.firstResult, first);
    expect(record.secondaryResult, second);
    expect(record.formula, contains('desvantagem'));
    final restored = DiceRollRecord.fromJson(record.toJson());
    expect(restored.rollMode, 'disadvantage');
    expect(restored.secondaryResult, second);
    expect(restored.firstResult, first);
  });
}
