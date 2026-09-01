import 'package:flutter_test/flutter_test.dart';
import 'package:rpg_sheet_app/domain/services/combat_technique_service.dart';
import 'package:rpg_sheet_app/models/catalog_models.dart';
import 'package:rpg_sheet_app/models/character.dart';
import 'package:rpg_sheet_app/models/official_rule_models.dart';

void main() {
  const service = CombatTechniqueService();
  final weaponClass = OfficialCharacterClass(
    entry: const CatalogEntry(
      id: 'fighter',
      name: 'Lutador',
      category: 'Classes',
      description: '',
    ),
    mechanics: const {'usesWeapons': true},
  );

  test('classe com armas pode treinar técnica fora de combate', () {
    final character = Character(
      id: 'fighter-1',
      name: 'Teste',
      playerName: 'Jogador',
      raceId: 'human',
      classId: weaponClass.entry.id,
    );

    expect(service.canLearn(weaponClass), isTrue);
    final learned = service.save(
      character,
      name: 'Golpe giratório',
      description: 'Atinge os inimigos adjacentes.',
      damage: '2 ataques',
      training: 'Treino com arma pesada',
      costType: 'cooldown',
      cooldownTurns: 2,
    );

    expect(learned.error, isEmpty);
    expect(learned.character.techniques, hasLength(1));
    expect(learned.character.techniques.single.cooldownTurns, 2);
  });

  test('recarga avança por turno e reinicia ao encerrar o combate', () {
    var character = Character(
      id: 'fighter-2',
      name: 'Teste',
      playerName: 'Jogador',
      raceId: 'human',
      classId: weaponClass.entry.id,
    );
    character = service
        .save(
          character,
          name: 'Golpe giratório',
          description: 'Atinge os inimigos adjacentes.',
          damage: '2 ataques',
          training: '',
          costType: 'cooldown',
          cooldownTurns: 2,
        )
        .character;
    final techniqueId = character.techniques.single.id;
    character = service.setCombatState(character, true);

    final used = service.use(character, techniqueId);
    expect(used.error, isEmpty);
    expect(used.character.techniques.single.cooldownRemaining, 2);
    expect(used.character.actionHistory.first.name, 'Golpe giratório');

    final blockedEdit = service.save(
      used.character,
      name: 'Outra técnica',
      description: '',
      damage: '',
      training: '',
      costType: 'none',
      cooldownTurns: 0,
    );
    expect(blockedEdit.error, contains('fora de combate'));

    character = service.advanceTurn(used.character);
    expect(character.techniques.single.cooldownRemaining, 1);
    character = service.advanceTurn(character);
    expect(character.techniques.single.cooldownRemaining, 0);
    expect(service.use(character, techniqueId).error, isEmpty);

    character = service.setCombatState(character, false);
    expect(character.techniques.single.cooldownRemaining, 0);
    expect(character.techniques.single.usedThisCombat, isFalse);
  });
}
