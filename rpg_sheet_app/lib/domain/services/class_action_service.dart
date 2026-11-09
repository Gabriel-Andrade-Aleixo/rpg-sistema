import 'dart:math';

import '../../models/character.dart';
import '../../models/character_records.dart';
import '../../models/rpg_rule_models.dart';
import '../../utils/id_generator.dart';
import 'humanity_service.dart';
import 'corruption_service.dart';

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
      'Ao acertar, encadeia até 2 ataques em alvos a até 6m; os ataques extras não recebem infusão.',
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
    int cadence, [
    int cadenceDamage = 0,
  ]) {
    final base = baseDamage.clamp(0, 999999);
    final cadenceBonus = cadence >= 3 ? cadenceDamage.clamp(0, 8) : 0;
    return switch (infusion.id) {
      'impact' => (hit: base + 1 + cadenceBonus, miss: 0),
      'piercing' => (hit: base + 1 + cadenceBonus, miss: 0),
      'spectral' => (hit: base + cadenceBonus, miss: 0),
      _ => (hit: base + cadenceBonus, miss: 0),
    };
  }

  ClassActionResult useInfusion(
    Character character,
    SpectralInfusion infusion, {
    int baseDamage = 0,
    int attacksThisTurn = 1,
    bool successful = true,
    bool critical = false,
    String spellId = '',
  }) {
    final cadence = character.resources['cadenciaCurrent'] ?? 0;
    final used = character.resources['infusionsThisTurn'] ?? 0;
    final limit = attacksThisTurn.clamp(1, 4);
    if (used >= limit) {
      return ClassActionResult(
        character,
        error: 'Limite de $limit infusão(ões) neste turno.',
      );
    }
    if (infusion.id == 'spectral' &&
        (character.resources['spectralInfusionUsedThisTurn'] ?? 0) == 1) {
      return ClassActionResult(
        character,
        error: 'A Infusão Espectral só pode ser usada uma vez por turno.',
      );
    }
    final manaCost = infusionManaCost(infusion, cadence, attacksThisTurn);
    final focus = character.resources['focoCurrent'] ?? 0;
    if (focus < infusion.focusCost) {
      return ClassActionResult(character, error: 'Foco insuficiente.');
    }
    final cadenceDamage = cadence >= 3
        ? Random().nextInt(critical ? 8 : 4) + 1
        : 0;
    final damage = infusionDamage(infusion, baseDamage, cadence, cadenceDamage);
    final healthSpent = (manaCost - character.currentMana).clamp(0, manaCost);
    final chainAttacks = infusion.id == 'spectral' && successful ? 2 : 0;
    final attackBonus = infusion.id == 'precision'
        ? (attacksThisTurn > 1 ? 1 : 2)
        : 0;
    final damageEffect = baseDamage > 0
        ? ' Dano no acerto: ${damage.hit}.'
        : '';
    final result =
        '${infusion.effect}'
        '${attackBonus > 0 ? ' Bônus de acerto +$attackBonus.' : ''}'
        '${chainAttacks > 0 ? ' Até $chainAttacks ataques encadeados.' : ''}'
        '${cadence >= 2 ? ' Bônus de Cadência: +1 efeito e +1 no primeiro acerto.' : ''}'
        '$damageEffect'
        '${cadenceDamage > 0 ? ' Cadência +$cadenceDamage de dano.' : ''}'
        '${healthSpent > 0 ? ' Mana insuficiente: $healthSpent de Vida consumida.' : ''}';
    return ClassActionResult(
      character.copyWith(
        currentMana: (character.currentMana - manaCost).clamp(
          0,
          character.maxMana,
        ),
        currentHp: (character.currentHp - healthSpent).clamp(
          0,
          character.maxHp,
        ),
        resources: {
          ...character.resources,
          'focoCurrent': focus - infusion.focusCost,
          'infusionsThisTurn': used + 1,
          'spectralInfusionUsedThisTurn': infusion.id == 'spectral'
              ? 1
              : character.resources['spectralInfusionUsedThisTurn'] ?? 0,
          'cadenciaCurrent': successful ? (cadence + 1).clamp(0, 3) : cadence,
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

  Character advanceSpectralTurn(
    Character character, {
    bool attacked = true,
    bool tookDamage = false,
  }) {
    final cadence = character.resources['cadenciaCurrent'] ?? 0;
    final focus = character.resources['focoCurrent'] ?? 0;
    final focusMax = character.resources['focoMax'] ?? focus;
    return character.copyWith(
      resources: {
        ...character.resources,
        'infusionsThisTurn': 0,
        'spectralInfusionUsedThisTurn': 0,
        'cadenciaCurrent': !attacked || tookDamage
            ? (cadence - 1).clamp(0, 3)
            : cadence,
        'focoCurrent': (focus + 2).clamp(0, focusMax),
      },
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
        resources: {
          ...character.resources,
          'cadenciaCurrent': successful
              ? ((character.resources['cadenciaCurrent'] ?? 0) + 1).clamp(0, 3)
              : character.resources['cadenciaCurrent'] ?? 0,
        },
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
    const corruption = CorruptionService();
    const humanity = HumanityService();
    final demonic = corruption.isDemonicSpell(spell);
    final divine = _normalize(spell.type) == 'divina';
    final manaCost = demonic
        ? corruption.spellCost(character, spell.manaCost)
        : spell.manaCost;
    final damageBonus = demonic ? corruption.damageBonus(character) : 0;
    final divineBonus = divine ? humanity.faithDamageBonus(character) : 0;
    if (divine && spell.degree > religionGrade(character)) {
      return ClassActionResult(
        character,
        error: 'Religião ${spell.degree} é necessária para usar esta magia.',
      );
    }
    final healthSpent = (manaCost - character.currentMana).clamp(0, manaCost);
    final focus = character.resources['focoCurrent'] ?? 0;
    if (focus < spell.focusCost) {
      return ClassActionResult(character, error: 'Foco insuficiente.');
    }
    if ((character.resources['humanity'] ?? 100) < spell.humanityCost) {
      return ClassActionResult(character, error: 'Humanidade insuficiente.');
    }
    var next = character.copyWith(
      currentMana: (character.currentMana - manaCost).clamp(
        0,
        character.maxMana,
      ),
      currentHp: (character.currentHp - healthSpent).clamp(0, character.maxHp),
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
          manaSpent: manaCost,
          focusSpent: spell.focusCost,
          humanitySpent: spell.humanityCost,
          result:
              '${successful ? 'Sucesso' : 'Falha'}${damageBonus > 0 ? ' · dano demoníaco +$damageBonus' : ''}${divineBonus > 0 ? ' · dano divino +$divineBonus (5% da Divindade)' : ''}${healthSpent > 0 ? ' · $healthSpent de Vida consumida por falta de Mana' : ''}',
          createdAt: DateTime.now(),
        ),
        ...next.actionHistory,
      ].take(30).toList(),
    );
    return ClassActionResult(next);
  }

  int religionValue(Character character) {
    final faith = character.attributes[AttributeId.faith] ?? 0;
    final skill = character.skillBonuses.entries
        .where((entry) => _normalize(entry.key).contains('relig'))
        .fold<int>(
          0,
          (value, entry) => value > entry.value ? value : entry.value,
        );
    return (faith + skill).clamp(0, 999);
  }

  int religionGrade(Character character) {
    final value = religionValue(character);
    return value >= 10
        ? 3
        : value >= 6
        ? 2
        : 1;
  }

  String _normalize(String value) => value
      .toLowerCase()
      .replaceAll(RegExp('[áàãâä]'), 'a')
      .replaceAll(RegExp('[éèêë]'), 'e')
      .replaceAll(RegExp('[íìîï]'), 'i')
      .replaceAll(RegExp('[óòõôö]'), 'o')
      .replaceAll(RegExp('[úùûü]'), 'u')
      .replaceAll('ç', 'c')
      .trim();
}
