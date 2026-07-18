import '../../models/character.dart';
import '../../models/character_records.dart';
import '../../models/rpg_rule_models.dart';
import '../../utils/id_generator.dart';

class HumanityStatus {
  const HumanityStatus({
    required this.name,
    required this.description,
    this.resistanceDifficulty,
    this.playable = true,
  });

  final String name;
  final String description;
  final int? resistanceDifficulty;
  final bool playable;
}

class HumanityService {
  const HumanityService();

  int humanity(Character character) =>
      (character.resources['humanity'] ?? 100).clamp(0, 100);

  int divinity(Character character) =>
      (character.resources['divinity'] ?? 0).clamp(0, 100);

  int resistanceBonus(Character character) => humanity(character) ~/ 10;

  int divineAccuracyBonus(Character character) {
    if (humanity(character) > 50) return 0;
    return (divinity(character) ~/ 15).clamp(0, 5);
  }

  bool getFaithDamageBonus(Character character) {
    final value = humanity(character);
    return value >= 26 && value <= 50;
  }

  int faithDamageBonus(Character character) {
    if (!getFaithDamageBonus(character)) return 0;
    final base = character.attributes[AttributeId.faith] ?? 0;
    final modifiers = character.modifiers
        .where(
          (modifier) =>
              modifier.targetType == 'attribute' &&
              modifier.targetId == AttributeId.faith.name,
        )
        .fold<int>(0, (total, modifier) => total + modifier.value.round());
    return ((base + modifiers).clamp(0, 20) / 2).floor();
  }

  HumanityStatus status(Character character, {String className = ''}) =>
      statusFor(humanity(character), className: className);

  HumanityStatus statusFor(int rawHumanity, {String className = ''}) {
    final value = rawHumanity.clamp(0, 100);
    if (value == 0) {
      return const HumanityStatus(
        name: 'Manifestação Divina Total',
        description:
            'Personagem injogável. Só pode ser ferido por Magia Divina e perde 1d20 de vida por turno.',
        playable: false,
      );
    }
    if (value == 1) {
      return const HumanityStatus(
        name: 'Estado de Avatar',
        description:
            'Teste de controle a cada turno. Falha reduz a Humanidade para 0.',
      );
    }
    if (value <= 10) {
      return const HumanityStatus(
        name: 'Humanidade crítica',
        description:
            'Apenas Milagres reduzem Humanidade. Os bônus divinos continuam escalando.',
        resistanceDifficulty: 19,
      );
    }
    if (value <= 25) {
      return const HumanityStatus(
        name: 'Domínio divino severo',
        description:
            'Falha pode causar perda da ação, controle temporário e 1d20 de dano.',
        resistanceDifficulty: 18,
      );
    }
    if (value <= 50) {
      return const HumanityStatus(
        name: 'Influência divina',
        description:
            'Magias Divinas recebem dano base + Fé / 2 e bônus de acerto pela Divindade.',
        resistanceDifficulty: 18,
      );
    }
    if (value > 80) {
      return const HumanityStatus(
        name: 'Humanidade plena',
        description:
            'Sem influência divina suficiente para exigir teste de resistência.',
      );
    }
    final normalizedClass = _normalize(className);
    final divineClass =
        normalizedClass == 'clerigo' || normalizedClass == 'paladino';
    return HumanityStatus(
      name: 'Humanidade estável',
      description: 'Transformações mínimas e sem bônus ofensivos especiais.',
      resistanceDifficulty: divineClass ? 15 : 17,
    );
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

  Character spend(Character character, int amount, String reason) =>
      _change(character, -amount.abs(), reason);

  Character restore(Character character, int amount, String reason) =>
      _change(character, amount.abs(), reason);

  Character _change(Character character, int delta, String reason) {
    final beforeHumanity = humanity(character);
    final beforeDivinity = divinity(character);
    final afterHumanity = (beforeHumanity + delta).clamp(0, 100);
    final actualChange = afterHumanity - beforeHumanity;
    final afterDivinity = (beforeDivinity - actualChange).clamp(0, 100);
    if (actualChange == 0) return character;
    final resources = Map<String, int>.of(character.resources)
      ..['humanity'] = afterHumanity
      ..['divinity'] = afterDivinity;
    final record = HumanityRecord(
      id: newId('humanity'),
      humanityBefore: beforeHumanity,
      humanityAfter: afterHumanity,
      divinityBefore: beforeDivinity,
      divinityAfter: afterDivinity,
      reason: reason.trim().isEmpty
          ? 'Ajuste definido pelo mestre'
          : reason.trim(),
      createdAt: DateTime.now(),
    );
    return character.copyWith(
      resources: resources,
      humanityHistory: [record, ...character.humanityHistory],
    );
  }
}
