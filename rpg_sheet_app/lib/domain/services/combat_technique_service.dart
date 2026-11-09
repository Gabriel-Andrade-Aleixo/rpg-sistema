import '../../models/character.dart';
import '../../models/character_records.dart';
import '../../models/official_rule_models.dart';

class TechniqueActionResult {
  const TechniqueActionResult(this.character, [this.error = '']);

  final Character character;
  final String error;
}

class CombatTechniqueService {
  const CombatTechniqueService();

  bool canLearn(OfficialCharacterClass? characterClass) =>
      characterClass != null &&
      (characterClass.manaFormula == null ||
          characterClass.mechanics['usesWeapons'] == true);

  TechniqueActionResult save(
    Character character, {
    required String name,
    required String description,
    required String damage,
    required String training,
    required String costType,
    required int cooldownTurns,
    int learningDifficulty = 15,
    int executionDifficulty = 10,
    String editingId = '',
  }) {
    if (character.combatContext['inCombat'] == true) {
      return TechniqueActionResult(
        character,
        'Técnicas só podem ser aprendidas ou alteradas fora de combate.',
      );
    }
    final cleanName = name.trim();
    if (cleanName.isEmpty) {
      return TechniqueActionResult(character, 'Informe o nome da técnica.');
    }
    final normalizedCost =
        const ['none', 'once_per_combat', 'cooldown'].contains(costType)
        ? costType
        : 'none';
    final previous = editingId.isEmpty
        ? null
        : character.techniques
              .where((item) => item.id == editingId)
              .firstOrNull;
    final technique = CombatTechnique(
      id: editingId.isEmpty
          ? 'technique_${DateTime.now().microsecondsSinceEpoch}'
          : editingId,
      name: _limit(cleanName, 120),
      description: _limit(description, 1200),
      damage: _limit(damage, 200),
      training: _limit(training, 500),
      costType: normalizedCost,
      cooldownTurns: normalizedCost == 'cooldown'
          ? cooldownTurns.clamp(1, 99)
          : 0,
      learningDifficulty: learningDifficulty.clamp(1, 30),
      executionDifficulty: executionDifficulty.clamp(1, 29),
      trainingSuccesses: previous?.trainingSuccesses ?? 0,
      executionSuccesses: previous?.executionSuccesses ?? 0,
      masteryTrainingSuccesses: previous?.masteryTrainingSuccesses ?? 0,
      trainingHours: previous?.trainingHours ?? 0,
      learningState: previous?.learningState ?? 'unlearned',
      createdAt: previous?.createdAt ?? DateTime.now(),
    );
    final updated = editingId.isEmpty
        ? [technique, ...character.techniques]
        : character.techniques
              .map((item) => item.id == editingId ? technique : item)
              .toList();
    return TechniqueActionResult(character.copyWith(techniques: updated));
  }

  TechniqueActionResult use(
    Character character,
    String techniqueId, {
    bool executionSucceeded = false,
  }) {
    if (character.combatContext['inCombat'] != true) {
      return TechniqueActionResult(
        character,
        'Inicie o combate antes de usar uma técnica.',
      );
    }
    final technique = character.techniques
        .where((item) => item.id == techniqueId)
        .firstOrNull;
    if (technique == null) {
      return TechniqueActionResult(character, 'Técnica não encontrada.');
    }
    if (technique.learningState == 'unlearned') {
      return TechniqueActionResult(
        character,
        'A técnica ainda não foi aprendida parcialmente.',
      );
    }
    if (technique.learningState == 'partial' && !executionSucceeded) {
      return TechniqueActionResult(
        character,
        'A técnica parcial exige sucesso na CD de Execução ${technique.executionDifficulty}.',
      );
    }
    if (technique.usedThisCombat) {
      return TechniqueActionResult(
        character,
        'Esta técnica já foi usada neste combate.',
      );
    }
    if (technique.cooldownRemaining > 0) {
      return TechniqueActionResult(
        character,
        'A técnica recarrega em ${technique.cooldownRemaining} turno(s).',
      );
    }
    final techniques = character.techniques
        .map(
          (item) => item.id != techniqueId
              ? item
              : item.copyWith(
                  executionSuccesses: item.learningState == 'partial'
                      ? item.executionSuccesses + 1
                      : item.executionSuccesses,
                  learningState:
                      item.learningState == 'partial' &&
                          item.executionSuccesses + 1 >= 3
                      ? 'mastered'
                      : item.learningState,
                  usedThisCombat: item.costType == 'once_per_combat',
                  cooldownRemaining: item.costType == 'cooldown'
                      ? item.cooldownTurns
                      : 0,
                ),
        )
        .toList();
    final history = [
      ActionUseRecord(
        id: 'action_${DateTime.now().microsecondsSinceEpoch}_$techniqueId',
        name: technique.name,
        result: technique.damage.isNotEmpty
            ? technique.damage
            : technique.description.isNotEmpty
            ? technique.description
            : 'Técnica utilizada',
        createdAt: DateTime.now(),
      ),
      ...character.actionHistory,
    ].take(100).toList();
    return TechniqueActionResult(
      character.copyWith(techniques: techniques, actionHistory: history),
    );
  }

  TechniqueActionResult recordTraining(
    Character character,
    String techniqueId, {
    required bool succeeded,
  }) {
    if (character.combatContext['inCombat'] == true) {
      return TechniqueActionResult(
        character,
        'O treinamento deve ocorrer fora de combate.',
      );
    }
    final technique = character.techniques
        .where((item) => item.id == techniqueId)
        .firstOrNull;
    if (technique == null) {
      return TechniqueActionResult(character, 'Técnica não encontrada.');
    }
    final trainingSuccesses =
        technique.trainingSuccesses +
        (succeeded && technique.learningState == 'unlearned' ? 1 : 0);
    final masterySuccesses =
        technique.masteryTrainingSuccesses +
        (succeeded && technique.learningState == 'partial' ? 1 : 0);
    final state =
        technique.learningState == 'unlearned' && trainingSuccesses >= 3
        ? 'partial'
        : technique.learningState == 'partial' && masterySuccesses >= 5
        ? 'mastered'
        : technique.learningState;
    return TechniqueActionResult(
      character.copyWith(
        techniques: character.techniques
            .map(
              (item) => item.id == techniqueId
                  ? item.copyWith(
                      trainingHours: item.trainingHours + 1,
                      trainingSuccesses: trainingSuccesses.clamp(0, 3),
                      masteryTrainingSuccesses: masterySuccesses.clamp(0, 5),
                      learningState: state,
                    )
                  : item,
            )
            .toList(),
      ),
    );
  }

  Character advanceTurn(Character character) => character.copyWith(
    techniques: character.techniques
        .map(
          (item) => item.copyWith(
            cooldownRemaining: (item.cooldownRemaining - 1).clamp(
              0,
              item.cooldownTurns,
            ),
          ),
        )
        .toList(),
  );

  Character setCombatState(Character character, bool active) =>
      character.copyWith(
        combatContext: {...character.combatContext, 'inCombat': active},
        techniques: character.techniques
            .map(
              (item) => item.copyWith(
                cooldownRemaining: active ? item.cooldownRemaining : 0,
                usedThisCombat: active ? item.usedThisCombat : false,
              ),
            )
            .toList(),
      );

  String _limit(String value, int maximum) {
    final clean = value.trim();
    return clean.length <= maximum ? clean : clean.substring(0, maximum);
  }
}
