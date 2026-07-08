import 'rpg_rule_models.dart';
import 'character_records.dart';

class Currency {
  const Currency({this.copper = 0, this.silver = 0, this.gold = 0});

  final int copper;
  final int silver;
  final int gold;

  int get totalCopper => copper + (silver * 50) + (gold * 2500);

  Currency normalized() {
    final total = totalCopper;
    final normalizedGold = total ~/ 2500;
    final remainingAfterGold = total % 2500;
    final normalizedSilver = remainingAfterGold ~/ 50;
    final normalizedCopper = remainingAfterGold % 50;
    return Currency(
      copper: normalizedCopper,
      silver: normalizedSilver,
      gold: normalizedGold,
    );
  }

  String get label {
    final value = normalized();
    return '${value.gold} ouro, ${value.silver} prata, ${value.copper} cobre';
  }

  Map<String, dynamic> toJson() => {
    'copper': copper,
    'silver': silver,
    'gold': gold,
  };

  factory Currency.fromJson(Map<String, dynamic> json) => Currency(
    copper: (json['copper'] as num?)?.toInt() ?? 0,
    silver: (json['silver'] as num?)?.toInt() ?? 0,
    gold: (json['gold'] as num?)?.toInt() ?? 0,
  ).normalized();

  Currency copyWith({int? copper, int? silver, int? gold}) => Currency(
    copper: copper ?? this.copper,
    silver: silver ?? this.silver,
    gold: gold ?? this.gold,
  ).normalized();
}

class InventoryItem {
  const InventoryItem({
    required this.id,
    required this.name,
    this.type = '',
    this.description = '',
    this.weight = 0,
    this.quantity = 1,
    this.bonus = '',
    this.notes = '',
    this.catalogId = '',
    this.imageUrl = '',
    this.requirements = '',
  });

  final String id;
  final String name;
  final String type;
  final String description;
  final double weight;
  final int quantity;
  final String bonus;
  final String notes;
  final String catalogId;
  final String imageUrl;
  final String requirements;

  double get totalWeight => weight * quantity;

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'type': type,
    'description': description,
    'weight': weight,
    'quantity': quantity,
    'bonus': bonus,
    'notes': notes,
    'catalogId': catalogId,
    'imageUrl': imageUrl,
    'requirements': requirements,
  };

  factory InventoryItem.fromJson(Map<String, dynamic> json) => InventoryItem(
    id: json['id']?.toString() ?? '',
    name: json['name']?.toString() ?? '',
    type: json['type']?.toString() ?? '',
    description: json['description']?.toString() ?? '',
    weight: (json['weight'] as num?)?.toDouble() ?? 0,
    quantity: (json['quantity'] as num?)?.toInt() ?? 1,
    bonus: json['bonus']?.toString() ?? '',
    notes: json['notes']?.toString() ?? '',
    catalogId: json['catalogId']?.toString() ?? '',
    imageUrl: json['imageUrl']?.toString() ?? '',
    requirements: json['requirements']?.toString() ?? '',
  );

  InventoryItem copyWith({
    String? id,
    String? name,
    String? type,
    String? description,
    double? weight,
    int? quantity,
    String? bonus,
    String? notes,
    String? catalogId,
    String? imageUrl,
    String? requirements,
  }) => InventoryItem(
    id: id ?? this.id,
    name: name ?? this.name,
    type: type ?? this.type,
    description: description ?? this.description,
    weight: weight ?? this.weight,
    quantity: quantity ?? this.quantity,
    bonus: bonus ?? this.bonus,
    notes: notes ?? this.notes,
    catalogId: catalogId ?? this.catalogId,
    imageUrl: imageUrl ?? this.imageUrl,
    requirements: requirements ?? this.requirements,
  );
}

class Character {
  Character({
    required this.id,
    required this.name,
    required this.playerName,
    required this.raceId,
    this.raceVariant = '',
    required this.classId,
    this.level = 1,
    this.background = '',
    this.lore = '',
    this.imageUrl = '',
    this.hpProgressionMode = HpProgressionMode.fixed,
    Map<AttributeId, int>? attributes,
    Map<String, int>? skillBonuses,
    Map<String, int>? resources,
    Currency? currency,
    List<String>? notes,
    List<InventoryItem>? inventory,
    List<InventoryItem>? equipment,
    this.maxHp = 0,
    this.currentHp = 0,
    this.maxMana = 0,
    this.currentMana = 0,
    this.skillPoints = 0,
    this.classPoints = 0,
    List<String>? proficiencies,
    List<String>? manualProficiencies,
    List<String>? abilities,
    List<Modifier>? modifiers,
    List<DiceRollRecord>? rollHistory,
    List<LevelHistory>? levelHistory,
    Map<AttributeId, int>? permanentAttributeBonuses,
    this.classXp = 0,
    this.classXpTotal = 0,
    List<ClassXpRecord>? classXpHistory,
    Map<String, int>? areaExperience,
    this.combatXp = 0,
    List<ExperienceRecord>? experienceHistory,
    List<HumanityRecord>? humanityHistory,
    List<CorruptionRecord>? corruptionHistory,
    List<CharacterSpell>? spells,
    List<ActionUseRecord>? actionHistory,
    this.syncRevision = 0,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) : attributes = attributes ?? _defaultAttributes(),
       skillBonuses = skillBonuses ?? {},
       resources = {..._defaultResources(), ...?resources},
       currency = currency ?? const Currency(),
       notes = notes ?? [],
       inventory = inventory ?? [],
       equipment = equipment ?? [],
       proficiencies = proficiencies ?? [],
       manualProficiencies = manualProficiencies ?? [],
       abilities = abilities ?? [],
       modifiers = modifiers ?? [],
       rollHistory = rollHistory ?? [],
       levelHistory = levelHistory ?? [],
       permanentAttributeBonuses = permanentAttributeBonuses ?? {},
       classXpHistory = classXpHistory ?? [],
       areaExperience = areaExperience ?? {},
       experienceHistory = experienceHistory ?? [],
       humanityHistory = humanityHistory ?? [],
       corruptionHistory = corruptionHistory ?? [],
       spells = spells ?? [],
       actionHistory = actionHistory ?? [],
       createdAt = createdAt ?? DateTime.now(),
       updatedAt = updatedAt ?? DateTime.now();

  final String id;
  final String name;
  final String playerName;
  final String raceId;
  final String raceVariant;
  final String classId;
  final int level;
  final String background;
  final String lore;
  final String imageUrl;
  final HpProgressionMode hpProgressionMode;
  final Map<AttributeId, int> attributes;
  final Map<String, int> skillBonuses;
  final Map<String, int> resources;
  final Currency currency;
  final List<String> notes;
  final List<InventoryItem> inventory;
  final List<InventoryItem> equipment;
  final int maxHp;
  final int currentHp;
  final int maxMana;
  final int currentMana;
  final int skillPoints;
  final int classPoints;
  final List<String> proficiencies;
  final List<String> manualProficiencies;
  final List<String> abilities;
  final List<Modifier> modifiers;
  final List<DiceRollRecord> rollHistory;
  final List<LevelHistory> levelHistory;
  final Map<AttributeId, int> permanentAttributeBonuses;
  final int classXp;
  final int classXpTotal;
  final List<ClassXpRecord> classXpHistory;
  final Map<String, int> areaExperience;
  final int combatXp;
  final List<ExperienceRecord> experienceHistory;
  final List<HumanityRecord> humanityHistory;
  final List<CorruptionRecord> corruptionHistory;
  final List<CharacterSpell> spells;
  final List<ActionUseRecord> actionHistory;
  final int syncRevision;
  final DateTime createdAt;
  final DateTime updatedAt;

  static Map<AttributeId, int> _defaultAttributes() => {
    for (final attribute in AttributeId.values) attribute: 0,
  };

  static Map<String, int> _defaultResources() => {
    'luck': 0,
    'humanity': 100,
    'divinity': 0,
    'corruption': 0,
    'deathSuccesses': 0,
    'deathFailures': 0,
    'dead': 0,
  };

  double get totalInventoryWeight =>
      inventory.fold(0, (sum, item) => sum + item.totalWeight);

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'playerName': playerName,
    'raceId': raceId,
    'raceVariant': raceVariant,
    'classId': classId,
    'level': level,
    'background': background,
    'lore': lore,
    'imageUrl': imageUrl,
    'hpProgressionMode': hpProgressionMode.name,
    'attributes': attributes.map((key, value) => MapEntry(key.name, value)),
    'skillBonuses': skillBonuses,
    'resources': resources,
    'currency': currency.toJson(),
    'notes': notes,
    'inventory': inventory.map((item) => item.toJson()).toList(),
    'equipment': equipment.map((item) => item.toJson()).toList(),
    'maxHp': maxHp,
    'currentHp': currentHp,
    'maxMana': maxMana,
    'currentMana': currentMana,
    'skillPoints': skillPoints,
    'classPoints': classPoints,
    'proficiencies': proficiencies,
    'manualProficiencies': manualProficiencies,
    'abilities': abilities,
    'modifiers': modifiers.map((item) => item.toJson()).toList(),
    'rollHistory': rollHistory.map((item) => item.toJson()).toList(),
    'levelHistory': levelHistory.map((item) => item.toJson()).toList(),
    'permanentAttributeBonuses': permanentAttributeBonuses.map(
      (key, value) => MapEntry(key.name, value),
    ),
    'classXp': classXp,
    'classXpTotal': classXpTotal,
    'classXpHistory': classXpHistory.map((item) => item.toJson()).toList(),
    'areaExperience': areaExperience,
    'combatXp': combatXp,
    'experienceHistory': experienceHistory
        .map((item) => item.toJson())
        .toList(),
    'humanityHistory': humanityHistory.map((item) => item.toJson()).toList(),
    'corruptionHistory': corruptionHistory
        .map((item) => item.toJson())
        .toList(),
    'spells': spells.map((item) => item.toJson()).toList(),
    'actionHistory': actionHistory.map((item) => item.toJson()).toList(),
    'syncRevision': syncRevision,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
  };

  factory Character.fromJson(Map<String, dynamic> json) {
    final rawAttributes = (json['attributes'] as Map?) ?? {};
    return Character(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      playerName: json['playerName']?.toString() ?? '',
      raceId: json['raceId']?.toString() ?? 'human',
      raceVariant: json['raceVariant']?.toString() ?? '',
      classId: json['classId']?.toString() ?? 'barbarian',
      level: (json['level'] as num?)?.toInt() ?? 1,
      background: json['background']?.toString() ?? '',
      lore: json['lore']?.toString() ?? '',
      imageUrl: json['imageUrl']?.toString() ?? '',
      hpProgressionMode: HpProgressionMode.values.firstWhere(
        (mode) => mode.name == json['hpProgressionMode'],
        orElse: () => HpProgressionMode.fixed,
      ),
      attributes: {
        for (final attribute in AttributeId.values)
          attribute: (rawAttributes[attribute.name] as num?)?.toInt() ?? 0,
      },
      skillBonuses: Map<String, int>.from((json['skillBonuses'] as Map?) ?? {}),
      resources: Map<String, int>.from((json['resources'] as Map?) ?? {}),
      currency: Currency.fromJson(
        Map<String, dynamic>.from((json['currency'] as Map?) ?? {}),
      ),
      notes: List<String>.from((json['notes'] as List?) ?? []),
      inventory: ((json['inventory'] as List?) ?? [])
          .whereType<Map>()
          .map(
            (item) => InventoryItem.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList(),
      equipment: ((json['equipment'] as List?) ?? [])
          .whereType<Map>()
          .map(
            (item) => InventoryItem.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList(),
      maxHp: (json['maxHp'] as num?)?.toInt() ?? 0,
      currentHp:
          (json['currentHp'] as num?)?.toInt() ??
          (json['resources'] is Map
              ? ((json['resources'] as Map)['hpCurrent'] as num?)?.toInt() ?? 0
              : 0),
      maxMana: (json['maxMana'] as num?)?.toInt() ?? 0,
      currentMana:
          (json['currentMana'] as num?)?.toInt() ??
          (json['resources'] is Map
              ? ((json['resources'] as Map)['manaCurrent'] as num?)?.toInt() ??
                    0
              : 0),
      skillPoints: (json['skillPoints'] as num?)?.toInt() ?? 0,
      classPoints: (json['classPoints'] as num?)?.toInt() ?? 0,
      proficiencies: List<String>.from((json['proficiencies'] as List?) ?? []),
      manualProficiencies: List<String>.from(
        (json['manualProficiencies'] as List?) ?? [],
      ),
      abilities: List<String>.from((json['abilities'] as List?) ?? []),
      modifiers: ((json['modifiers'] as List?) ?? [])
          .whereType<Map>()
          .map((item) => Modifier.fromJson(Map<String, dynamic>.from(item)))
          .toList(),
      rollHistory: ((json['rollHistory'] as List?) ?? [])
          .whereType<Map>()
          .map(
            (item) => DiceRollRecord.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList(),
      levelHistory: ((json['levelHistory'] as List?) ?? [])
          .whereType<Map>()
          .map((item) => LevelHistory.fromJson(Map<String, dynamic>.from(item)))
          .toList(),
      permanentAttributeBonuses: {
        for (final attribute in AttributeId.values)
          if (((json['permanentAttributeBonuses'] as Map?) ?? {}).containsKey(
            attribute.name,
          ))
            attribute:
                ((((json['permanentAttributeBonuses'] as Map?) ??
                            {})[attribute.name])
                        as num?)
                    ?.toInt() ??
                0,
      },
      classXp: (json['classXp'] as num?)?.toInt() ?? 0,
      classXpTotal: (json['classXpTotal'] as num?)?.toInt() ?? 0,
      classXpHistory: ((json['classXpHistory'] as List?) ?? [])
          .whereType<Map>()
          .map(
            (item) => ClassXpRecord.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList(),
      areaExperience: {
        for (final entry in ((json['areaExperience'] as Map?) ?? {}).entries)
          entry.key.toString(): entry.value is Map
              ? ((entry.value as Map)['xp'] as num?)?.toInt() ?? 0
              : (entry.value as num?)?.toInt() ?? 0,
      },
      combatXp: (json['combatXp'] as num?)?.toInt() ?? 0,
      experienceHistory: ((json['experienceHistory'] as List?) ?? [])
          .whereType<Map>()
          .map(
            (item) =>
                ExperienceRecord.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList(),
      humanityHistory: ((json['humanityHistory'] as List?) ?? [])
          .whereType<Map>()
          .map(
            (item) => HumanityRecord.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList(),
      corruptionHistory: ((json['corruptionHistory'] as List?) ?? [])
          .whereType<Map>()
          .map(
            (item) =>
                CorruptionRecord.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList(),
      spells: ((json['spells'] as List?) ?? [])
          .whereType<Map>()
          .map(
            (item) => CharacterSpell.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList(),
      actionHistory: ((json['actionHistory'] as List?) ?? [])
          .whereType<Map>()
          .map(
            (item) => ActionUseRecord.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList(),
      syncRevision: (json['syncRevision'] as num?)?.toInt() ?? 0,
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
      updatedAt: DateTime.tryParse(json['updatedAt']?.toString() ?? ''),
    );
  }

  Character copyWith({
    String? id,
    String? name,
    String? playerName,
    String? raceId,
    String? raceVariant,
    String? classId,
    int? level,
    String? background,
    String? lore,
    String? imageUrl,
    HpProgressionMode? hpProgressionMode,
    Map<AttributeId, int>? attributes,
    Map<String, int>? skillBonuses,
    Map<String, int>? resources,
    Currency? currency,
    List<String>? notes,
    List<InventoryItem>? inventory,
    List<InventoryItem>? equipment,
    int? maxHp,
    int? currentHp,
    int? maxMana,
    int? currentMana,
    int? skillPoints,
    int? classPoints,
    List<String>? proficiencies,
    List<String>? manualProficiencies,
    List<String>? abilities,
    List<Modifier>? modifiers,
    List<DiceRollRecord>? rollHistory,
    List<LevelHistory>? levelHistory,
    Map<AttributeId, int>? permanentAttributeBonuses,
    int? classXp,
    int? classXpTotal,
    List<ClassXpRecord>? classXpHistory,
    Map<String, int>? areaExperience,
    int? combatXp,
    List<ExperienceRecord>? experienceHistory,
    List<HumanityRecord>? humanityHistory,
    List<CorruptionRecord>? corruptionHistory,
    List<CharacterSpell>? spells,
    List<ActionUseRecord>? actionHistory,
    int? syncRevision,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) => Character(
    id: id ?? this.id,
    name: name ?? this.name,
    playerName: playerName ?? this.playerName,
    raceId: raceId ?? this.raceId,
    raceVariant: raceVariant ?? this.raceVariant,
    classId: classId ?? this.classId,
    level: level ?? this.level,
    background: background ?? this.background,
    lore: lore ?? this.lore,
    imageUrl: imageUrl ?? this.imageUrl,
    hpProgressionMode: hpProgressionMode ?? this.hpProgressionMode,
    attributes: attributes ?? Map.of(this.attributes),
    skillBonuses: skillBonuses ?? Map.of(this.skillBonuses),
    resources: resources ?? Map.of(this.resources),
    currency: currency ?? this.currency,
    notes: notes ?? List.of(this.notes),
    inventory: inventory ?? List.of(this.inventory),
    equipment: equipment ?? List.of(this.equipment),
    maxHp: maxHp ?? this.maxHp,
    currentHp: currentHp ?? this.currentHp,
    maxMana: maxMana ?? this.maxMana,
    currentMana: currentMana ?? this.currentMana,
    skillPoints: skillPoints ?? this.skillPoints,
    classPoints: classPoints ?? this.classPoints,
    proficiencies: proficiencies ?? List.of(this.proficiencies),
    manualProficiencies:
        manualProficiencies ?? List.of(this.manualProficiencies),
    abilities: abilities ?? List.of(this.abilities),
    modifiers: modifiers ?? List.of(this.modifiers),
    rollHistory: rollHistory ?? List.of(this.rollHistory),
    levelHistory: levelHistory ?? List.of(this.levelHistory),
    permanentAttributeBonuses:
        permanentAttributeBonuses ?? Map.of(this.permanentAttributeBonuses),
    classXp: classXp ?? this.classXp,
    classXpTotal: classXpTotal ?? this.classXpTotal,
    classXpHistory: classXpHistory ?? List.of(this.classXpHistory),
    areaExperience: areaExperience ?? Map.of(this.areaExperience),
    combatXp: combatXp ?? this.combatXp,
    experienceHistory: experienceHistory ?? List.of(this.experienceHistory),
    humanityHistory: humanityHistory ?? List.of(this.humanityHistory),
    corruptionHistory: corruptionHistory ?? List.of(this.corruptionHistory),
    spells: spells ?? List.of(this.spells),
    actionHistory: actionHistory ?? List.of(this.actionHistory),
    syncRevision: syncRevision ?? this.syncRevision,
    createdAt: createdAt ?? this.createdAt,
    updatedAt: updatedAt ?? DateTime.now(),
  );
}
