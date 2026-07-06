enum ModifierOperation { add, subtract, multiply, overrideValue }

class Modifier {
  const Modifier({
    required this.id,
    required this.sourceId,
    required this.sourceName,
    required this.sourceType,
    required this.targetType,
    required this.targetId,
    required this.value,
    this.operation = ModifierOperation.add,
    this.description = '',
  });

  final String id;
  final String sourceId;
  final String sourceName;
  final String sourceType;
  final String targetType;
  final String targetId;
  final num value;
  final ModifierOperation operation;
  final String description;

  Map<String, dynamic> toJson() => {
    'id': id,
    'sourceId': sourceId,
    'sourceName': sourceName,
    'sourceType': sourceType,
    'targetType': targetType,
    'targetId': targetId,
    'value': value,
    'operation': operation.name,
    'description': description,
  };

  factory Modifier.fromJson(Map<String, dynamic> json) => Modifier(
    id: json['id']?.toString() ?? '',
    sourceId: json['sourceId']?.toString() ?? '',
    sourceName: json['sourceName']?.toString() ?? '',
    sourceType: json['sourceType']?.toString() ?? '',
    targetType: json['targetType']?.toString() ?? '',
    targetId: json['targetId']?.toString() ?? '',
    value: (json['value'] as num?) ?? 0,
    operation: ModifierOperation.values.firstWhere(
      (item) => item.name == json['operation'],
      orElse: () => ModifierOperation.add,
    ),
    description: json['description']?.toString() ?? '',
  );
}

class DiceRollRecord {
  const DiceRollRecord({
    required this.id,
    required this.characterId,
    required this.type,
    required this.name,
    required this.die,
    required this.rawResult,
    required this.finalResult,
    required this.createdAt,
    this.modifiers = const [],
    this.penalties = 0,
    this.origin = 'character_sheet',
  });

  final String id;
  final String characterId;
  final String type;
  final String name;
  final String die;
  final int rawResult;
  final int finalResult;
  final DateTime createdAt;
  final List<Modifier> modifiers;
  final int penalties;
  final String origin;

  String get formula {
    final bonus = modifiers.fold<num>(0, (sum, item) => sum + item.value);
    return '$die ${bonus >= 0 ? '+' : '-'} ${bonus.abs()}${penalties == 0 ? '' : ' - $penalties'}';
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'characterId': characterId,
    'type': type,
    'name': name,
    'die': die,
    'rawResult': rawResult,
    'finalResult': finalResult,
    'createdAt': createdAt.toIso8601String(),
    'modifiers': modifiers.map((item) => item.toJson()).toList(),
    'penalties': penalties,
    'origin': origin,
  };

  factory DiceRollRecord.fromJson(Map<String, dynamic> json) => DiceRollRecord(
    id: json['id']?.toString() ?? '',
    characterId: json['characterId']?.toString() ?? '',
    type: json['type']?.toString() ?? '',
    name: json['name']?.toString() ?? '',
    die: json['die']?.toString() ?? 'd20',
    rawResult: (json['rawResult'] as num?)?.toInt() ?? 0,
    finalResult: (json['finalResult'] as num?)?.toInt() ?? 0,
    createdAt:
        DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
        DateTime.now(),
    modifiers: ((json['modifiers'] as List?) ?? [])
        .whereType<Map>()
        .map((item) => Modifier.fromJson(Map<String, dynamic>.from(item)))
        .toList(),
    penalties: (json['penalties'] as num?)?.toInt() ?? 0,
    origin: json['origin']?.toString() ?? 'character_sheet',
  );
}

class LevelHistory {
  const LevelHistory({
    required this.level,
    required this.hpMethod,
    required this.hpAdded,
    required this.createdAt,
    this.die = '',
    this.rollResult,
    this.modifiers = 0,
    this.skillPoints = 0,
    this.classPoints = 0,
    this.abilities = const [],
    this.proficiencies = const [],
    this.xpSpent = 0,
  });

  final int level;
  final String hpMethod;
  final String die;
  final int? rollResult;
  final int modifiers;
  final int hpAdded;
  final int skillPoints;
  final int classPoints;
  final List<String> abilities;
  final List<String> proficiencies;
  final int xpSpent;
  final DateTime createdAt;

  Map<String, dynamic> toJson() => {
    'level': level,
    'hpMethod': hpMethod,
    'die': die,
    'rollResult': rollResult,
    'modifiers': modifiers,
    'hpAdded': hpAdded,
    'skillPoints': skillPoints,
    'classPoints': classPoints,
    'abilities': abilities,
    'proficiencies': proficiencies,
    'xpSpent': xpSpent,
    'createdAt': createdAt.toIso8601String(),
  };

  factory LevelHistory.fromJson(Map<String, dynamic> json) => LevelHistory(
    level: (json['level'] as num?)?.toInt() ?? 1,
    hpMethod: json['hpMethod']?.toString() ?? 'base',
    die: json['die']?.toString() ?? '',
    rollResult: (json['rollResult'] as num?)?.toInt(),
    modifiers: (json['modifiers'] as num?)?.toInt() ?? 0,
    hpAdded: (json['hpAdded'] as num?)?.toInt() ?? 0,
    skillPoints: (json['skillPoints'] as num?)?.toInt() ?? 0,
    classPoints: (json['classPoints'] as num?)?.toInt() ?? 0,
    abilities: List<String>.from((json['abilities'] as List?) ?? []),
    proficiencies: List<String>.from((json['proficiencies'] as List?) ?? []),
    xpSpent: (json['xpSpent'] as num?)?.toInt() ?? 0,
    createdAt:
        DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
        DateTime.now(),
  );
}

class ExperienceRecord {
  const ExperienceRecord({
    required this.id,
    required this.type,
    required this.amount,
    required this.description,
    required this.createdAt,
  });

  final String id;
  final String type;
  final int amount;
  final String description;
  final DateTime createdAt;

  Map<String, dynamic> toJson() => {
    'id': id,
    'type': type,
    'amount': amount,
    'description': description,
    'createdAt': createdAt.toIso8601String(),
  };

  factory ExperienceRecord.fromJson(Map<String, dynamic> json) =>
      ExperienceRecord(
        id: json['id']?.toString() ?? '',
        type: json['type']?.toString() ?? '',
        amount: (json['amount'] as num?)?.toInt() ?? 0,
        description: json['description']?.toString() ?? '',
        createdAt:
            DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
            DateTime.now(),
      );
}

class ClassXpRecord {
  const ClassXpRecord({
    required this.id,
    required this.amount,
    required this.note,
    required this.createdAt,
    this.breakdown = const {},
  });

  final String id;
  final int amount;
  final String note;
  final DateTime createdAt;
  final Map<String, int> breakdown;

  Map<String, dynamic> toJson() => {
    'id': id,
    'amount': amount,
    'note': note,
    'createdAt': createdAt.toIso8601String(),
    'breakdown': breakdown,
  };

  factory ClassXpRecord.fromJson(Map<String, dynamic> json) => ClassXpRecord(
    id: json['id']?.toString() ?? '',
    amount: (json['amount'] as num?)?.toInt() ?? 0,
    note: json['note']?.toString() ?? '',
    createdAt:
        DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
        DateTime.now(),
    breakdown: {
      for (final entry in ((json['breakdown'] as Map?) ?? {}).entries)
        entry.key.toString(): (entry.value as num?)?.toInt() ?? 0,
    },
  );
}

class HumanityRecord {
  const HumanityRecord({
    required this.id,
    required this.humanityBefore,
    required this.humanityAfter,
    required this.divinityBefore,
    required this.divinityAfter,
    required this.reason,
    required this.createdAt,
  });

  final String id;
  final int humanityBefore;
  final int humanityAfter;
  final int divinityBefore;
  final int divinityAfter;
  final String reason;
  final DateTime createdAt;

  Map<String, dynamic> toJson() => {
    'id': id,
    'humanityBefore': humanityBefore,
    'humanityAfter': humanityAfter,
    'divinityBefore': divinityBefore,
    'divinityAfter': divinityAfter,
    'reason': reason,
    'createdAt': createdAt.toIso8601String(),
  };

  factory HumanityRecord.fromJson(Map<String, dynamic> json) => HumanityRecord(
    id: json['id']?.toString() ?? '',
    humanityBefore: (json['humanityBefore'] as num?)?.toInt() ?? 100,
    humanityAfter: (json['humanityAfter'] as num?)?.toInt() ?? 100,
    divinityBefore: (json['divinityBefore'] as num?)?.toInt() ?? 0,
    divinityAfter: (json['divinityAfter'] as num?)?.toInt() ?? 0,
    reason: json['reason']?.toString() ?? '',
    createdAt:
        DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
        DateTime.now(),
  );
}

class CharacterSpell {
  const CharacterSpell({
    required this.id,
    required this.name,
    required this.type,
    required this.createdAt,
    this.description = '',
    this.manaCost = 0,
    this.humanityCost = 0,
    this.focusCost = 0,
    this.successfulUses = 0,
    this.catalogId = '',
    this.topic = 'Sem tópico',
    this.range = '',
    this.damage = '',
    this.imageUrl = '',
  });

  final String id;
  final String name;
  final String type;
  final String description;
  final int manaCost;
  final int humanityCost;
  final int focusCost;
  final int successfulUses;
  final String catalogId;
  final String topic;
  final String range;
  final String damage;
  final String imageUrl;
  final DateTime createdAt;

  bool get mastered => successfulUses >= 3;

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'type': type,
    'description': description,
    'manaCost': manaCost,
    'humanityCost': humanityCost,
    'focusCost': focusCost,
    'successfulUses': successfulUses,
    'catalogId': catalogId,
    'topic': topic,
    'range': range,
    'damage': damage,
    'imageUrl': imageUrl,
    'createdAt': createdAt.toIso8601String(),
  };

  factory CharacterSpell.fromJson(Map<String, dynamic> json) => CharacterSpell(
    id: json['id']?.toString() ?? '',
    name: json['name']?.toString() ?? '',
    type: json['type']?.toString() ?? 'Comum',
    description: json['description']?.toString() ?? '',
    manaCost: (json['manaCost'] as num?)?.toInt() ?? 0,
    humanityCost: (json['humanityCost'] as num?)?.toInt() ?? 0,
    focusCost: (json['focusCost'] as num?)?.toInt() ?? 0,
    successfulUses: (json['successfulUses'] as num?)?.toInt() ?? 0,
    catalogId: json['catalogId']?.toString() ?? '',
    topic:
        json['topic']?.toString() ?? json['type']?.toString() ?? 'Sem tópico',
    range: json['range']?.toString() ?? '',
    damage: json['damage']?.toString() ?? '',
    imageUrl: json['imageUrl']?.toString() ?? '',
    createdAt:
        DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
        DateTime.now(),
  );

  CharacterSpell copyWith({int? successfulUses, String? topic}) =>
      CharacterSpell(
        id: id,
        name: name,
        type: type,
        description: description,
        manaCost: manaCost,
        humanityCost: humanityCost,
        focusCost: focusCost,
        successfulUses: successfulUses ?? this.successfulUses,
        catalogId: catalogId,
        topic: topic ?? this.topic,
        range: range,
        damage: damage,
        imageUrl: imageUrl,
        createdAt: createdAt,
      );
}

class ActionUseRecord {
  const ActionUseRecord({
    required this.id,
    required this.name,
    required this.createdAt,
    this.manaSpent = 0,
    this.focusSpent = 0,
    this.humanitySpent = 0,
    this.result = '',
  });

  final String id;
  final String name;
  final int manaSpent;
  final int focusSpent;
  final int humanitySpent;
  final String result;
  final DateTime createdAt;

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'manaSpent': manaSpent,
    'focusSpent': focusSpent,
    'humanitySpent': humanitySpent,
    'result': result,
    'createdAt': createdAt.toIso8601String(),
  };

  factory ActionUseRecord.fromJson(Map<String, dynamic> json) =>
      ActionUseRecord(
        id: json['id']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        manaSpent: (json['manaSpent'] as num?)?.toInt() ?? 0,
        focusSpent: (json['focusSpent'] as num?)?.toInt() ?? 0,
        humanitySpent: (json['humanitySpent'] as num?)?.toInt() ?? 0,
        result: json['result']?.toString() ?? '',
        createdAt:
            DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
            DateTime.now(),
      );
}

class RuleValidationResult {
  const RuleValidationResult({
    this.errors = const [],
    this.warnings = const [],
    this.suggestions = const [],
  });

  final List<String> errors;
  final List<String> warnings;
  final List<String> suggestions;
  bool get isValid => errors.isEmpty;
}
