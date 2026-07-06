import 'package:flutter_test/flutter_test.dart';
import 'package:rpg_sheet_app/domain/calculators/proficiency_calculator.dart';
import 'package:rpg_sheet_app/domain/services/class_action_service.dart';
import 'package:rpg_sheet_app/domain/services/death_save_service.dart';
import 'package:rpg_sheet_app/models/character.dart';
import 'package:rpg_sheet_app/models/character_records.dart';

void main() {
  Character character({
    int hp = 20,
    int mana = 10,
    Map<String, int>? resources,
    List<String>? proficiencies,
  }) => Character(
    id: 'test',
    name: 'Teste',
    playerName: 'Jogador',
    raceId: 'race',
    classId: 'class',
    maxHp: 20,
    currentHp: hp,
    maxMana: 10,
    currentMana: mana,
    resources: resources,
    proficiencies: proficiencies,
  );

  test('proficiência adiciona novamente o valor bruto da perícia', () {
    const service = ProficiencyCalculator();
    expect(
      service.rawRollBonus(
        character(proficiencies: ['Furtividade']),
        'Furtividade',
        4,
      ),
      4,
    );
    expect(service.rawRollBonus(character(), 'Furtividade', 4), 0);
  });

  test('três acertos contra a morte recuperam 1 de vida', () {
    const service = DeathSaveService();
    var current = character(hp: 0);
    current = service.record(current, success: true);
    current = service.record(current, success: true);
    current = service.record(current, success: true);
    expect(current.currentHp, 1);
    expect(current.resources['deathSuccesses'], 0);
  });

  test('infusão desconta mana e foco com bônus de cadência', () {
    const service = ClassActionService();
    final result = service.useInfusion(
      character(
        resources: {'focoMax': 8, 'focoCurrent': 8, 'cadenciaCurrent': 3},
      ),
      ClassActionService.infusions[1],
    );
    expect(result.succeeded, isTrue);
    expect(result.character.currentMana, 9);
    expect(result.character.resources['focoCurrent'], 7);
    expect(result.character.actionHistory.single.result, contains('+1 efeito'));
  });

  test('flechas mágicas calculam dano e custo por múltiplos ataques', () {
    const service = ClassActionService();
    final impact = ClassActionService.infusions[1];
    final spectral = ClassActionService.infusions[4];
    expect(service.infusionDamage(impact, 8, 3).hit, 10);
    expect(service.infusionDamage(spectral, 9, 0).miss, 3);
    expect(service.infusionManaCost(impact, 3, 3), 2);
  });

  test('magia oficial preserva tópico e desconta mana e humanidade', () {
    const service = ClassActionService();
    final spell = CharacterSpell(
      id: 'spell_solar',
      catalogId: 'trello_solar',
      name: 'Sentença Solar',
      type: 'Divina',
      topic: 'Grau 1 · Utilidade e punição',
      manaCost: 1,
      humanityCost: 3,
      damage: '1d8 + Fé',
      createdAt: DateTime(2026),
    );
    final restored = CharacterSpell.fromJson(spell.toJson());
    final result = service.useSpell(
      character(resources: {'humanity': 100}).copyWith(spells: [restored]),
      restored,
      successful: true,
    );
    expect(restored.catalogId, 'trello_solar');
    expect(restored.topic, startsWith('Grau 1'));
    expect(result.character.currentMana, 9);
    expect(result.character.resources['humanity'], 97);
    expect(result.character.spells.single.successfulUses, 1);
  });
}
