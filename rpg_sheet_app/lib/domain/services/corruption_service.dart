import '../../models/character.dart';
import '../../models/character_records.dart';
import '../../utils/id_generator.dart';

class CorruptionStatus {
  const CorruptionStatus({
    required this.name,
    required this.description,
    this.playable = true,
    this.demonicOnly = false,
    this.canCreateZone = false,
    this.lastOrder = false,
  });

  final String name;
  final String description;
  final bool playable;
  final bool demonicOnly;
  final bool canCreateZone;
  final bool lastOrder;
}

class CorruptionService {
  const CorruptionService();

  int value(Character character) =>
      (character.resources['corruption'] ?? 0).clamp(0, 100);

  CorruptionStatus status(Character character) {
    final corruption = value(character);
    if (corruption >= 100) {
      return const CorruptionStatus(
        name: 'Manifestação Demoníaca',
        description:
            'O pactuante morreu e o demônio assumiu sua forma verdadeira.',
        playable: false,
        demonicOnly: true,
      );
    }
    if (corruption >= 95) {
      return const CorruptionStatus(
        name: 'Última Ordem',
        description:
            'O combate deve terminar em 5 turnos. A Corrupção aumenta em +1 a cada turno.',
        demonicOnly: true,
        lastOrder: true,
      );
    }
    if (corruption >= 80) {
      return const CorruptionStatus(
        name: 'Zona Demoníaca',
        description:
            'Pode criar uma zona de 10 a 50 metros. Poderes demoníacos têm vantagem, mas o corpo recebe dano adicional.',
        demonicOnly: true,
        canCreateZone: true,
      );
    }
    if (corruption >= 50) {
      return const CorruptionStatus(
        name: 'Domínio Demoníaco',
        description:
            'Só pode atacar com Magia Demoníaca. Dano e custo escalam com a Corrupção.',
        demonicOnly: true,
      );
    }
    if (corruption >= 20) {
      return const CorruptionStatus(
        name: 'Ordens Diretas',
        description:
            'Desobedecer ao demônio causa 2d20 de dano ou perda temporária dos poderes.',
      );
    }
    return const CorruptionStatus(
      name: 'Influência Mínima',
      description: 'Alterações mínimas e voz constante do demônio.',
    );
  }

  int damageBonus(Character character) =>
      value(character) >= 50 ? value(character) ~/ 10 : 0;

  int spellCost(Character character, int baseCost) =>
      baseCost.clamp(0, 999) + damageBonus(character);

  int incomingZoneDamageBonus(Character character) =>
      character.resources['demonicZoneActive'] == 1
      ? value(character) ~/ 15
      : 0;

  bool isDemonicSpell(CharacterSpell spell) =>
      _normalize(spell.type).contains('demoni');

  Character change(Character character, int delta, String reason) {
    final before = value(character);
    final after = (before + delta).clamp(0, 100);
    if (before == after) return character;
    final manifested = after >= 100;
    final resources = Map<String, int>.of(character.resources)
      ..['corruption'] = after
      ..['demonicManifested'] = manifested ? 1 : 0
      ..['dead'] = manifested ? 1 : character.resources['dead'] ?? 0;
    if (after < 80 || after >= 95) resources['demonicZoneActive'] = 0;
    final record = CorruptionRecord(
      id: newId('corruption'),
      before: before,
      after: after,
      reason: reason.trim().isEmpty
          ? 'Ajuste definido pelo mestre'
          : reason.trim(),
      createdAt: DateTime.now(),
    );
    return character.copyWith(
      currentHp: manifested ? 0 : character.currentHp,
      resources: resources,
      corruptionHistory: [record, ...character.corruptionHistory],
    );
  }

  Character advanceTurn(Character character) => status(character).lastOrder
      ? change(character, 1, 'Turno da Última Ordem')
      : character;

  Character toggleZone(Character character) {
    if (!status(character).canCreateZone) return character;
    return character.copyWith(
      resources: {
        ...character.resources,
        'demonicZoneActive': character.resources['demonicZoneActive'] == 1
            ? 0
            : 1,
      },
    );
  }

  String _normalize(String value) => value
      .toLowerCase()
      .replaceAll(RegExp('[áàãâä]'), 'a')
      .replaceAll(RegExp('[éèêë]'), 'e')
      .replaceAll(RegExp('[íìîï]'), 'i')
      .replaceAll(RegExp('[óòõôö]'), 'o')
      .replaceAll(RegExp('[úùûü]'), 'u')
      .replaceAll('ç', 'c');
}
