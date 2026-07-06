import 'package:flutter_test/flutter_test.dart';
import 'package:rpg_sheet_app/domain/calculators/skill_calculator.dart';
import 'package:rpg_sheet_app/domain/services/experience_service.dart';
import 'package:rpg_sheet_app/domain/services/humanity_service.dart';
import 'package:rpg_sheet_app/models/catalog_models.dart';
import 'package:rpg_sheet_app/models/character.dart';
import 'package:rpg_sheet_app/models/rpg_rule_models.dart';
import 'package:rpg_sheet_app/services/trello_parser_service.dart';

void main() {
  const experience = ExperienceService();
  const parser = TrelloParserService();
  const skillCalculator = SkillCalculator();

  Character character() => Character(
    id: 'test',
    name: 'Teste',
    playerName: 'Jogador',
    raceId: 'race',
    classId: 'class',
    attributes: {
      AttributeId.strength: 10,
      AttributeId.dexterity: 8,
      AttributeId.constitution: 6,
      AttributeId.intelligence: 4,
      AttributeId.charisma: 2,
      AttributeId.faith: 1,
    },
  );

  test('XP de Classe usa custos de 20, 40 e 75', () {
    expect(experience.classXpRequired(1), 20);
    expect(experience.classXpRequired(5), 40);
    expect(experience.classXpRequired(10), 75);

    final updated = experience.registerClassXp(character(), 12, 'Sessão 1');
    expect(updated.classXp, 12);
    expect(updated.classXpTotal, 12);
    expect(updated.classXpHistory.single.note, 'Sessão 1');
  });

  test('XP de cena e combate respeita os limites por concessão', () {
    var updated = experience.registerAreaXp(character(), 'Medicina', 9);
    updated = experience.registerCombatXp(updated, 4, 9);

    expect(updated.areaExperience['Medicina'], 4);
    expect(updated.combatXp, 8);
  });

  test('20 XP de área convertem em bônus permanente de perícia', () {
    var updated = character().copyWith(areaExperience: {'Medicina': 20});
    updated = experience.convertAreaToSkill(
      updated,
      'Medicina',
      'skill-medicine',
    );

    expect(updated.areaExperience['Medicina'], 0);
    expect(updated.skillBonuses['skill-medicine'], 1);
  });

  test('perícia oficial usa pesos do cartão e arredonda para baixo', () {
    const entry = CatalogEntry(
      id: 'acrobatics',
      name: 'Acrobacia',
      category: 'Perícias',
      description: 'Destreza 90%; Força 10%.',
    );
    final skill = parser.parseSkill(entry);

    expect(skillCalculator.officialValue(character(), skill), 8);
  });

  test('XP de Classe soma cada critério da sessão dentro dos limites', () {
    final breakdown = ClassXpRules.calculate({
      'participation': 1,
      'combat': 5,
      'strategy': 1,
      'creativity': 1,
      'roleplay': 1,
      'memorableMoment': 1,
      'importantProblem': 2,
      'storyProgress': 3,
      'difficultDecision': 2,
      'sessionObjective': 2,
      'personalObjective': 2,
      'highlight': 1,
    });
    expect(breakdown.total, 22);
    final updated = experience.registerClassXp(
      character(),
      breakdown.total,
      breakdown.summary,
      breakdown: breakdown.values,
    );
    expect(updated.classXp, 22);
    expect(updated.classXpHistory.single.breakdown['combat'], 5);
  });

  test('Humanidade altera Divindade, estados e resistência', () {
    const humanity = HumanityService();
    var updated = humanity.spend(character(), 55, 'Milagre');
    expect(humanity.humanity(updated), 45);
    expect(humanity.divinity(updated), 55);
    expect(humanity.status(updated).resistanceDifficulty, 18);
    expect(humanity.resistanceBonus(updated), 4);
    expect(humanity.divineAccuracyBonus(updated), 3);
    expect(humanity.getFaithDamageBonus(updated), isTrue);

    updated = humanity.restore(updated, 10, 'Intervenção do mestre');
    expect(humanity.humanity(updated), 55);
    expect(humanity.divinity(updated), 45);
    expect(updated.humanityHistory.length, 2);
  });

  test('CD divina começa em 80 e respeita a classe', () {
    const humanity = HumanityService();
    final full = character();
    expect(
      humanity
          .status(full, className: 'Arqueiro Espectral')
          .resistanceDifficulty,
      isNull,
    );
    final atEighty = full.copyWith(
      resources: {...full.resources, 'humanity': 80, 'divinity': 20},
    );
    expect(
      humanity
          .status(atEighty, className: 'Arqueiro Espectral')
          .resistanceDifficulty,
      17,
    );
    expect(
      humanity.status(atEighty, className: 'Clérigo').resistanceDifficulty,
      15,
    );
    expect(
      humanity.status(atEighty, className: 'Paladino').resistanceDifficulty,
      15,
    );
  });
}
