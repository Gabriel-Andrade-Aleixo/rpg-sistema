import 'dart:math';

import '../../models/character.dart';
import '../../models/character_records.dart';
import '../../utils/id_generator.dart';
import 'humanity_service.dart';

class SpectralInfusion {
  const SpectralInfusion(this.id, this.name, this.manaCost, this.effect);
  final String id;
  final String name;
  final int manaCost;
  final String effect;
  int get focusCost => 1;
}

class ClassActionResult {
  const ClassActionResult(this.character, {this.error = ''});
  final Character character;
  final String error;
  bool get succeeded => error.isEmpty;
}

class ClassActionService {
  const ClassActionService();

  static const infusions = [
    SpectralInfusion(
      'precision',
      'Precisão',
      1,
      '+2 no teste de ataque e ignora penalidades leves.',
    ),
    SpectralInfusion(
      'impact',
      'Impacto',
      2,
      '+1 dano; com 3 Cadência, +2 dano.',
    ),
    SpectralInfusion(
      'piercing',
      'Perfurante',
      2,
      'Ignora redução leve/moderada e causa +1 dano.',
    ),
    SpectralInfusion(
      'kinetic',
      'Cinética',
      1,
      'Empurra o alvo ou aplica -1 movimento.',
    ),
    SpectralInfusion(
      'spectral',
      'Espectral',
      2,
      'Se errar o ataque, causa 40% do dano.',
    ),
  ];

  ({List<int> dice, int total}) magicArrowDamage([
    int? firstDie,
    int? secondDie,
  ]) {
    final random = Random();
    final first = (firstDie ?? random.nextInt(4) + 1).clamp(1, 4);
    final second = (secondDie ?? random.nextInt(4) + 1).clamp(1, 4);
    return (dice: [first, second], total: first + second);
  }

  int infusionManaCost(
    SpectralInfusion infusion,
    int cadence,
    int attacksThisTurn,
  ) {
    final cadenceReduction = cadence >= 3 ? 1 : 0;
    final multipleAttackPenalty = attacksThisTurn >= 3 ? 1 : 0;
    return (infusion.manaCost - cadenceReduction + multipleAttackPenalty).clamp(
      1,
      99,
    );
  }

  ({int hit, int miss}) infusionDamage(
    SpectralInfusion infusion,
    int baseDamage,
    int cadence,
  ) {
    final base = baseDamage.clamp(0, 999999);
    return switch (infusion.id) {
      'impact' => (hit: base + (cadence >= 3 ? 2 : 1), miss: 0),
      'piercing' => (hit: base + 1, miss: 0),
      'spectral' => (hit: base, miss: (base * .4).floor()),
      _ => (hit: base, miss: 0),
    };
  }

  ClassActionResult useInfusion(
    Character character,
    SpectralInfusion infusion, {
    int baseDamage = 0,
    int attacksThisTurn = 1,
    bool successful = true,
    String spellId = '',
  }) {
    final cadence = character.resources['cadenciaCurrent'] ?? 0;
    final manaCost = infusionManaCost(infusion, cadence, attacksThisTurn);
    if (character.currentMana < manaCost) {
      return ClassActionResult(character, error: 'Mana insuficiente.');
    }
    final focus = character.resources['focoCurrent'] ?? 0;
    if (focus < infusion.focusCost) {
      return ClassActionResult(character, error: 'Foco insuficiente.');
    }
    final damage = infusionDamage(infusion, baseDamage, cadence);
    final damageEffect = baseDamage > 0
        ? ' Dano no acerto: ${damage.hit}.${infusion.id == 'spectral' ? ' Dano no erro: ${damage.miss}.' : ''}'
        : '';
    final result =
        '${infusion.effect}${cadence >= 2 ? ' Bônus de Cadência: +1 efeito.' : ''}$damageEffect';
    return ClassActionResult(
      character.copyWith(
        currentMana: character.currentMana - manaCost,
        resources: {
          ...character.resources,
          'focoCurrent': focus - infusion.focusCost,
        },
        spells: character.spells
            .map(
              (spell) => spell.id == spellId
                  ? spell.copyWith(
                      successfulUses:
                          spell.successfulUses + (successful ? 1 : 0),
                    )
                  : spell,
            )
            .toList(),
        actionHistory: [
          ActionUseRecord(
            id: newId('action'),
            name: 'Flecha Mágica · Infusão ${infusion.name}',
            manaSpent: manaCost,
            focusSpent: infusion.focusCost,
            result: '${successful ? 'Sucesso' : 'Falha'}. $result',
            createdAt: DateTime.now(),
          ),
          ...character.actionHistory,
        ].take(30).toList(),
      ),
    );
  }

  ClassActionResult useMagicArrow(
    Character character,
    CharacterSpell spell, {
    required bool successful,
    int? firstDie,
    int? secondDie,
  }) {
    final damage = magicArrowDamage(firstDie, secondDie);
    return ClassActionResult(
      character.copyWith(
        spells: character.spells
            .map(
              (item) => item.id == spell.id
                  ? item.copyWith(
                      successfulUses:
                          item.successfulUses + (successful ? 1 : 0),
                    )
                  : item,
            )
            .toList(),
        actionHistory: [
          ActionUseRecord(
            id: newId('action'),
            name: 'Flecha Mágica',
            result:
                '${successful ? 'Sucesso' : 'Falha'} · 2d4 = ${damage.dice.join(' + ')} = ${damage.total} de dano',
            createdAt: DateTime.now(),
          ),
          ...character.actionHistory,
        ].take(30).toList(),
      ),
    );
  }

  ClassActionResult useSpell(
    Character character,
    CharacterSpell spell, {
    required bool successful,
  }) {
    if (character.currentMana < spell.manaCost) {
      return ClassActionResult(character, error: 'Mana insuficiente.');
    }
    final focus = character.resources['focoCurrent'] ?? 0;
    if (focus < spell.focusCost) {
      return ClassActionResult(character, error: 'Foco insuficiente.');
    }
    if ((character.resources['humanity'] ?? 100) < spell.humanityCost) {
      return ClassActionResult(character, error: 'Humanidade insuficiente.');
    }
    var next = character.copyWith(
      currentMana: character.currentMana - spell.manaCost,
      resources: {
        ...character.resources,
        'focoCurrent': focus - spell.focusCost,
      },
    );
    if (spell.humanityCost > 0) {
      next = const HumanityService().spend(
        next,
        spell.humanityCost,
        'Magia: ${spell.name}',
      );
    }
    next = next.copyWith(
      spells: next.spells
          .map(
            (item) => item.id == spell.id
                ? item.copyWith(
                    successfulUses: item.successfulUses + (successful ? 1 : 0),
                  )
                : item,
          )
          .toList(),
      actionHistory: [
        ActionUseRecord(
          id: newId('action'),
          name: spell.name,
          manaSpent: spell.manaCost,
          focusSpent: spell.focusCost,
          humanitySpent: spell.humanityCost,
          result: successful ? 'Sucesso' : 'Falha',
          createdAt: DateTime.now(),
        ),
        ...next.actionHistory,
      ].take(30).toList(),
    );
    return ClassActionResult(next);
  }
}
