import 'package:flutter_test/flutter_test.dart';
import 'package:rpg_sheet_app/domain/services/swordsman_combat_service.dart';
import 'package:rpg_sheet_app/models/character.dart';

void main() {
  const service = SwordsmanCombatService();

  Character swordsman(int level) => Character(
    id: 'char_swordsman',
    name: 'Espadachim',
    playerName: 'Teste',
    raceId: 'race',
    classId: 'class_swordsman',
    level: level,
  );

  test('Concentração cai imediatamente e recupera um estágio por turno', () {
    var character = service.setThreats(swordsman(3), 3);
    expect(service.state(character).concentration, 2);
    character = service.setThreats(character, 1);
    expect(service.state(character).concentration, 2);
    character = service.markAction(character, 'opening');
    character = service.startTurn(character);
    expect(service.state(character).concentration, 1);
    expect(service.state(character).openingUsed, isFalse);
    character = service.startTurn(character);
    expect(service.state(character).concentration, 0);
  });

  test('no nível 9, um alvo permite recuperação imediata', () {
    var character = service.setThreats(swordsman(9), 3);
    character = service.setThreats(character, 1);
    character = service.startTurn(character);
    expect(service.state(character).concentration, 0);
  });
}
