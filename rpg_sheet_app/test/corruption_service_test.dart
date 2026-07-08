import 'package:flutter_test/flutter_test.dart';
import 'package:rpg_sheet_app/domain/services/class_action_service.dart';
import 'package:rpg_sheet_app/domain/services/corruption_service.dart';
import 'package:rpg_sheet_app/models/character.dart';
import 'package:rpg_sheet_app/models/character_records.dart';

Character characterAt(int corruption) => Character(
  id: 'test',
  name: 'Teste',
  playerName: 'Jogador',
  raceId: 'human',
  classId: 'mage',
  maxHp: 20,
  currentHp: 20,
  maxMana: 30,
  currentMana: 30,
  resources: {'corruption': corruption, 'humanity': 100},
);

void main() {
  const corruption = CorruptionService();

  test('faixas aplicam restrições, custo e dano oficiais', () {
    expect(corruption.status(characterAt(49)).demonicOnly, isFalse);
    expect(corruption.status(characterAt(50)).demonicOnly, isTrue);
    expect(corruption.damageBonus(characterAt(79)), 7);
    expect(corruption.spellCost(characterAt(79), 3), 10);
  });

  test('Zona Demoníaca aumenta o dano recebido', () {
    final active = corruption.toggleZone(characterAt(80));
    expect(active.resources['demonicZoneActive'], 1);
    expect(corruption.incomingZoneDamageBonus(active), 5);
  });

  test('Última Ordem termina na manifestação demoníaca', () {
    var current = corruption.change(characterAt(94), 1, 'Última Ordem');
    for (var turn = 0; turn < 5; turn++) {
      current = corruption.advanceTurn(current);
    }
    expect(corruption.value(current), 100);
    expect(current.currentHp, 0);
    expect(current.resources['demonicManifested'], 1);
    expect(corruption.status(current).playable, isFalse);
  });

  test('magia demoníaca usa custo e dano escalados', () {
    final spell = CharacterSpell(
      id: 'demon',
      name: 'Chama Abissal',
      type: 'Demoníaca',
      manaCost: 2,
      createdAt: DateTime(2026),
    );
    final result = const ClassActionService().useSpell(
      characterAt(50),
      spell,
      successful: true,
    );
    expect(result.character.currentMana, 23);
    expect(result.character.actionHistory.first.result, contains('+5'));
  });
}
