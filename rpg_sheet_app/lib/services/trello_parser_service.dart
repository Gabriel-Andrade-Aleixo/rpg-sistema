import 'dart:convert';

import '../models/catalog_models.dart';
import '../models/character_records.dart';
import '../models/official_rule_models.dart';

class TrelloParserService {
  const TrelloParserService();

  OfficialRace parseRace(CatalogEntry entry, [String variantId = '']) {
    final metadata = _ruleMetadata(entry);
    if (metadata?['type'] == 'race') {
      final variants = ((metadata?['variants'] as List?) ?? [])
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
      Map<String, dynamic>? selected;
      for (final variant in variants) {
        if (variant['id']?.toString() == variantId) selected = variant;
      }
      return OfficialRace(
        entry: entry,
        modifiers: [
          ..._metadataModifiers(
            entry,
            'race',
            'attribute',
            metadata?['attributeBonuses'],
          ),
          ..._metadataModifiers(
            entry,
            'race_variant',
            'attribute',
            selected?['attributeBonuses'],
          ),
          ..._metadataModifiers(
            entry,
            'race',
            'stat',
            metadata?['statBonuses'],
          ),
          ..._metadataModifiers(
            entry,
            'race',
            'skill',
            metadata?['skillBonuses'],
          ),
          ..._metadataModifiers(
            entry,
            'race_variant',
            'skill',
            selected?['skillBonuses'],
          ),
          ..._metadataModifiers(
            entry,
            'race_variant',
            'skillRoll',
            selected?['skillRollBonuses'],
          ),
          ..._metadataModifiers(
            entry,
            'race_variant',
            'attributeRoll',
            selected?['attributeRollBonuses'],
          ),
          ..._metadataModifiers(
            entry,
            'race',
            'skillMinimum',
            metadata?['skillMinimums'],
          ),
        ],
        proficiencies: List<String>.from(
          (metadata?['proficiencies'] as List?) ?? [],
        ),
        abilities: [
          ...List<String>.from((metadata?['abilities'] as List?) ?? []),
          ...List<String>.from((selected?['abilities'] as List?) ?? []),
        ],
        traits: [
          ...List<String>.from((metadata?['traits'] as List?) ?? []),
          ...List<String>.from((selected?['traits'] as List?) ?? []),
        ],
        variants: variants
            .map(
              (item) => OfficialRaceVariant(
                id: item['id']?.toString() ?? '',
                name: item['name']?.toString() ?? '',
                traits: List<String>.from((item['traits'] as List?) ?? []),
              ),
            )
            .toList(),
        selectedVariant: selected == null
            ? null
            : OfficialRaceVariant(
                id: selected['id']?.toString() ?? '',
                name: selected['name']?.toString() ?? '',
                traits: List<String>.from((selected['traits'] as List?) ?? []),
              ),
        mechanics: Map<String, dynamic>.from(metadata ?? const {}),
      );
    }
    final lines = _lines(entry.description);
    return OfficialRace(
      entry: entry,
      modifiers: _attributeModifiers(entry, 'race'),
      proficiencies: _valuesAfterKeyword(lines, 'profici'),
      abilities: _valuesAfterKeyword(lines, 'habilidad'),
      traits: lines.where((line) {
        final normalized = normalizeCatalogText(line);
        return normalized.contains('resistencia') ||
            normalized.contains('deslocamento') ||
            normalized.contains('visao') ||
            normalized.contains('tamanho');
      }).toList(),
    );
  }

  OfficialCharacterClass parseClass(CatalogEntry entry) {
    final metadata = _ruleMetadata(entry);
    if (metadata?['type'] == 'class') {
      final hp = metadata?['hp'] is Map
          ? Map<String, dynamic>.from(metadata?['hp'] as Map)
          : <String, dynamic>{};
      final perLevel = hp['perLevel'] is Map
          ? Map<String, dynamic>.from(hp['perLevel'] as Map)
          : <String, dynamic>{};
      final roll = perLevel['roll'] is Map
          ? Map<String, dynamic>.from(perLevel['roll'] as Map)
          : <String, dynamic>{};
      final hybrid = perLevel['hybrid'] is Map
          ? Map<String, dynamic>.from(perLevel['hybrid'] as Map)
          : <String, dynamic>{};
      final progressions = ((metadata?['attributeProgression'] as List?) ?? [])
          .whereType<Map>()
          .map((raw) {
            final item = Map<String, dynamic>.from(raw);
            return OfficialAttributeProgression(
              from: (item['from'] as num?)?.toInt() ?? 1,
              to: (item['to'] as num?)?.toInt() ?? 1,
              perLevel: _intMap(item['perLevel']),
            );
          })
          .toList();
      final resources = ((metadata?['resources'] as List?) ?? [])
          .whereType<Map>()
          .map((raw) {
            final item = Map<String, dynamic>.from(raw);
            return OfficialResourceRule(
              id: item['id']?.toString() ?? '',
              name: item['name']?.toString() ?? '',
              maximum: _metadataFormula(item['maximum']),
            );
          })
          .toList();
      return OfficialCharacterClass(
        entry: entry,
        hitDie: (roll['die'] as num?)?.toInt(),
        hybridDie: (hybrid['die'] as num?)?.toInt(),
        baseHp:
            (hp['initial'] is Map
                    ? (hp['initial'] as Map)['base'] as num?
                    : null)
                ?.toInt(),
        hpPerLevelBase:
            (perLevel['fixed'] is Map
                    ? (perLevel['fixed'] as Map)['base'] as num?
                    : null)
                ?.toInt(),
        skillPointsPerLevel: (metadata?['skillPointsPerLevel'] as num?)
            ?.toInt(),
        classPointsPerLevel: (metadata?['classPointsPerLevel'] as num?)
            ?.toInt(),
        proficiencies: List<String>.from(
          (metadata?['proficiencies'] as List?) ?? [],
        ),
        resources: resources.map((item) => item.name).toList(),
        resourceRules: resources,
        unlocks: _levelUnlocks(_lines(entry.description)),
        defenseFormula: _metadataFormula(metadata?['defense']),
        conditionalDefenseFormula: _metadataFormula(
          metadata?['conditionalDefense'] is Map
              ? (metadata?['conditionalDefense'] as Map)['enemyWithinTwoMeters']
              : null,
        ),
        hpInitialFormula: _metadataFormula(hp['initial']),
        hpFixedFormula: _metadataFormula(perLevel['fixed']),
        hpRollFormula: _metadataFormula(perLevel['roll']),
        hpHybridFormula: _metadataFormula(perLevel['hybrid']),
        manaFormula: _metadataFormula(metadata?['mana']),
        attributeProgression: progressions,
        allowedCombatXpAttributes: List<String>.from(
          (metadata?['allowedCombatXpAttributes'] as List?) ?? [],
        ),
        hasStructuredRules: true,
        mechanics: Map<String, dynamic>.from(metadata ?? const {}),
      );
    }
    final lines = _lines(entry.description);
    return OfficialCharacterClass(
      entry: entry,
      hitDie: _firstInt(entry.description, [
        RegExp(
          r'dado\s+de\s+vida[^d\d]*d(4|6|8|10|12|20)',
          caseSensitive: false,
        ),
        RegExp(r'vida[^\n]{0,60}?1d(4|6|8|10|12|20)', caseSensitive: false),
        RegExp(r'rolagem\s*:\s*1d(4|6|8|10|12|20)', caseSensitive: false),
      ]),
      baseHp: _firstInt(entry.description, [
        RegExp(
          r'(?:vida|hp)\s+(?:inicial|base)\D{0,15}(\d+)',
          caseSensitive: false,
        ),
      ]),
      hpPerLevelBase: _firstInt(entry.description, [
        RegExp(r'(?:fixo|m[eé]dia)\s*:\s*(\d+)', caseSensitive: false),
      ]),
      skillPointsPerLevel: _firstInt(entry.description, [
        RegExp(
          r'(\d+)\s+pontos?\s+de\s+habilidade\s+(?:por|a\s+cada)\s+n[ií]vel',
          caseSensitive: false,
        ),
        RegExp(
          r'pontos?\s+de\s+habilidade\s+(?:por|a\s+cada)\s+n[ií]vel\D{0,10}(\d+)',
          caseSensitive: false,
        ),
      ]),
      classPointsPerLevel: _firstInt(entry.description, [
        RegExp(
          r'(\d+)\s+pontos?\s+(?:da|de)\s+classe\s+(?:por|a\s+cada)\s+n[ií]vel',
          caseSensitive: false,
        ),
        RegExp(
          r'pontos?\s+(?:da|de)\s+classe\s+(?:por|a\s+cada)\s+n[ií]vel\D{0,10}(\d+)',
          caseSensitive: false,
        ),
      ]),
      proficiencies: _valuesAfterKeyword(lines, 'profici'),
      resources: lines
          .where(
            (line) => RegExp(
              r'\b(mana|energia|furia|foco|compasso|cadencia|divindade|humanidade)\b',
              caseSensitive: false,
            ).hasMatch(line),
          )
          .take(12)
          .toList(),
      unlocks: _levelUnlocks(lines),
      modifiers: _explicitClassModifiers(entry),
    );
  }

  OfficialSkill parseSkill(CatalogEntry entry) {
    final terms = <OfficialSkillTerm>[];
    for (final target in _attributeAliases.entries) {
      for (final alias in target.value) {
        final match = RegExp(
          '${RegExp.escape(alias)}\\s*[(:]?\\s*(\\d+)\\s*%',
          caseSensitive: false,
        ).firstMatch(entry.description);
        final percent = int.tryParse(match?.group(1) ?? '');
        if (percent == null) continue;
        terms.add(
          OfficialSkillTerm(attributeId: target.key, weight: percent / 100),
        );
        break;
      }
    }
    return OfficialSkill(entry: entry, terms: terms);
  }

  List<Modifier> parseEquipmentModifiers(CatalogEntry entry) {
    final metadata = _ruleMetadata(entry);
    if (metadata?['type'] == 'item') {
      return ((metadata?['modifiers'] as List?) ?? [])
          .whereType<Map>()
          .map((raw) {
            final item = Map<String, dynamic>.from(raw);
            return Modifier(
              id: '${entry.id}_${item['targetId']}',
              sourceId: entry.id,
              sourceName: entry.name,
              sourceType: 'equipment',
              targetType: item['targetType']?.toString() ?? 'stat',
              targetId: item['targetId']?.toString() ?? '',
              value: (item['value'] as num?) ?? 0,
              description: 'Bônus estruturado do catálogo oficial.',
            );
          })
          .where((item) => item.targetId.isNotEmpty && item.value != 0)
          .toList();
    }
    return _allNumericModifiers(entry, 'equipment');
  }

  List<Modifier> _explicitClassModifiers(CatalogEntry entry) {
    final lines = _lines(entry.description)
        .where((line) => normalizeCatalogText(line).contains('bonus de classe'))
        .join('\n');
    if (lines.isEmpty) return const [];
    return _attributeModifiers(
      CatalogEntry(
        id: entry.id,
        name: entry.name,
        description: lines,
        category: entry.category,
      ),
      'class',
    );
  }

  List<Modifier> _attributeModifiers(CatalogEntry entry, String sourceType) {
    final result = <Modifier>[];
    final text = entry.description;
    for (final target in _attributeAliases.entries) {
      for (final alias in target.value) {
        final escaped = RegExp.escape(alias);
        final patterns = [
          RegExp('$escaped\\s*[:=]?\\s*([+-]\\d+)', caseSensitive: false),
          RegExp('([+-]\\d+)\\s+(?:em\\s+)?$escaped', caseSensitive: false),
        ];
        for (final pattern in patterns) {
          final match = pattern.firstMatch(text);
          final value = int.tryParse(match?.group(1) ?? '');
          if (value == null) continue;
          result.add(
            Modifier(
              id: '${entry.id}_${target.key}',
              sourceId: entry.id,
              sourceName: entry.name,
              sourceType: sourceType,
              targetType: 'attribute',
              targetId: target.key,
              value: value,
              description: 'Bônus descrito no catálogo oficial.',
            ),
          );
          break;
        }
        if (result.any((item) => item.targetId == target.key)) break;
      }
    }
    return result;
  }

  List<Modifier> _allNumericModifiers(CatalogEntry entry, String sourceType) {
    final modifiers = _attributeModifiers(entry, sourceType);
    const targets = {
      'defense': ['defesa'],
      'armorClass': ['ca', 'classe de armadura'],
      'attack': ['ataque', 'acerto'],
      'damage': ['dano'],
      'health': ['vida', 'hp'],
      'mana': ['mana'],
    };
    for (final target in targets.entries) {
      for (final alias in target.value) {
        final match = RegExp(
          '${RegExp.escape(alias)}\\s*[:=]?\\s*([+-]\\d+)',
          caseSensitive: false,
        ).firstMatch(entry.description);
        final value = int.tryParse(match?.group(1) ?? '');
        if (value == null) continue;
        modifiers.add(
          Modifier(
            id: '${entry.id}_${target.key}',
            sourceId: entry.id,
            sourceName: entry.name,
            sourceType: sourceType,
            targetType: 'stat',
            targetId: target.key,
            value: value,
            description: 'Efeito descrito no catálogo oficial.',
          ),
        );
        break;
      }
    }
    return modifiers;
  }

  List<LevelUnlock> _levelUnlocks(List<String> lines) {
    final result = <LevelUnlock>[];
    for (var index = 0; index < lines.length; index++) {
      final line = lines[index];
      final match = RegExp(
        r'(?:n[ií]vel|lvl)\s*(\d+)\s*[-:–]?\s*(.*)',
        caseSensitive: false,
      ).firstMatch(line);
      if (match == null) continue;
      final level = int.tryParse(match.group(1) ?? '');
      final title = (match.group(2) ?? '').replaceAll(
        RegExp(r'^[#*\s]+|[#*\s]+$'),
        '',
      );
      if (level == null || title.isEmpty) continue;
      final description = index + 1 < lines.length ? lines[index + 1] : '';
      result.add(
        LevelUnlock(level: level, name: title, description: description),
      );
    }
    return result;
  }

  int? _firstInt(String text, List<RegExp> patterns) {
    for (final pattern in patterns) {
      final value = int.tryParse(pattern.firstMatch(text)?.group(1) ?? '');
      if (value != null) return value;
    }
    return null;
  }

  List<String> _valuesAfterKeyword(List<String> lines, String keyword) {
    final matches = lines.where(
      (line) => normalizeCatalogText(line).contains(keyword),
    );
    return matches
        .map((line) => line.replaceAll(RegExp(r'^[#*\-\s]+'), ''))
        .toSet()
        .toList();
  }

  Map<String, dynamic>? _ruleMetadata(CatalogEntry entry) {
    final match = RegExp(
      r'<!-- RPG_RULES_JSON_START -->([\s\S]*?)<!-- RPG_RULES_JSON_END -->',
    ).firstMatch(entry.description);
    final raw = match?.group(1)?.trim();
    if (raw == null || raw.isEmpty) return null;
    try {
      return Map<String, dynamic>.from(jsonDecode(raw) as Map);
    } catch (_) {
      return null;
    }
  }

  OfficialFormula? _metadataFormula(dynamic raw) {
    if (raw is! Map) return null;
    final map = Map<String, dynamic>.from(raw);
    return OfficialFormula(
      base: (map['base'] as num?)?.toDouble() ?? 0,
      terms: {
        for (final entry in ((map['terms'] as Map?) ?? {}).entries)
          entry.key.toString(): (entry.value as num?)?.toDouble() ?? 0,
      },
    );
  }

  Map<String, int> _intMap(dynamic raw) => {
    for (final entry in ((raw as Map?) ?? {}).entries)
      entry.key.toString(): (entry.value as num?)?.toInt() ?? 0,
  };

  List<Modifier> _metadataModifiers(
    CatalogEntry entry,
    String sourceType,
    String targetType,
    dynamic raw,
  ) => [
    for (final item in ((raw as Map?) ?? {}).entries)
      Modifier(
        id: '${entry.id}_${sourceType}_${item.key}',
        sourceId: entry.id,
        sourceName: entry.name,
        sourceType: sourceType,
        targetType: targetType,
        targetId: normalizeCatalogText(item.key.toString()),
        value: (item.value as num?) ?? 0,
        description: 'Regra estruturada no catálogo oficial.',
      ),
  ];

  List<String> _lines(String text) => text
      .split(RegExp(r'\r?\n'))
      .map((line) => line.trim())
      .where((line) => line.isNotEmpty)
      .toList();
}

const _attributeAliases = <String, List<String>>{
  'strength': ['força', 'forca'],
  'dexterity': ['destreza'],
  'constitution': ['constituição', 'constituicao'],
  'intelligence': ['inteligência', 'inteligencia'],
  'charisma': ['carisma'],
  'faith': ['fé', 'fe'],
};
