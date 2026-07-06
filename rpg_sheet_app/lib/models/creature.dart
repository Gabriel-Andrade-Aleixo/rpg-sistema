import 'rpg_rule_models.dart';

class Creature {
  const Creature({
    required this.id,
    required this.name,
    required this.type,
    this.role = '',
    this.threat = '',
    this.description = '',
    this.armorClass,
    this.hitPoints,
    this.mana,
    this.movementMeters,
    this.attributes = const {},
    this.skills = const {},
    this.abilities = const [],
    this.resistances = const [],
    this.vulnerabilities = const [],
    this.notes = '',
  });

  final String id;
  final String name;
  final String type;
  final String role;
  final String threat;
  final String description;
  final int? armorClass;
  final int? hitPoints;
  final int? mana;
  final int? movementMeters;
  final Map<AttributeId, int> attributes;
  final Map<String, int> skills;
  final List<String> abilities;
  final List<String> resistances;
  final List<String> vulnerabilities;
  final String notes;

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'type': type,
    'role': role,
    'threat': threat,
    'description': description,
    'armorClass': armorClass,
    'hitPoints': hitPoints,
    'mana': mana,
    'movementMeters': movementMeters,
    'attributes': attributes.map((key, value) => MapEntry(key.name, value)),
    'skills': skills,
    'abilities': abilities,
    'resistances': resistances,
    'vulnerabilities': vulnerabilities,
    'notes': notes,
  };
}
