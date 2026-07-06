import 'package:flutter_test/flutter_test.dart';
import 'package:rpg_sheet_app/models/catalog_models.dart';
import 'package:rpg_sheet_app/services/trello_parser_service.dart';

void main() {
  const parser = TrelloParserService();

  test('extrai apenas regras explicitamente descritas da raça', () {
    const entry = CatalogEntry(
      id: 'race-1',
      name: 'Anão',
      category: 'Raças',
      description: 'Força +2\nProficiência: armas pesadas\nVisão no escuro.',
    );

    final race = parser.parseRace(entry);

    expect(race.modifiers.single.targetId, 'strength');
    expect(race.modifiers.single.value, 2);
    expect(race.proficiencies, contains('Proficiência: armas pesadas'));
    expect(race.traits, contains('Visão no escuro.'));
  });

  test('mantém ausente regra que não existe no cartão da classe', () {
    const entry = CatalogEntry(
      id: 'class-1',
      name: 'Classe oficial',
      category: 'Classes',
      description: 'Dado de vida: d10\nNível 3: Ataque Extra',
    );

    final characterClass = parser.parseClass(entry);

    expect(characterClass.hitDie, 10);
    expect(characterClass.baseHp, isNull);
    expect(characterClass.skillPointsPerLevel, isNull);
    expect(characterClass.unlocks.single.name, 'Ataque Extra');
  });
}
