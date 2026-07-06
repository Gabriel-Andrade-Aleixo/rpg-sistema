class CatalogLabel {
  const CatalogLabel({required this.id, required this.name, this.color = ''});

  final String id;
  final String name;
  final String color;

  factory CatalogLabel.fromJson(Map<String, dynamic> json) => CatalogLabel(
    id: json['id']?.toString() ?? '',
    name: json['name']?.toString() ?? '',
    color: json['color']?.toString() ?? '',
  );
}

class CatalogEntry {
  const CatalogEntry({
    required this.id,
    required this.name,
    required this.description,
    required this.category,
    this.labels = const [],
    this.imageUrl = '',
    this.sourceUrl = '',
    this.updatedAt,
  });

  final String id;
  final String name;
  final String description;
  final String category;
  final List<CatalogLabel> labels;
  final String imageUrl;
  final String sourceUrl;
  final DateTime? updatedAt;

  String get normalizedCategory => _normalize(category);
  String get normalizedName => _normalize(name);
  String get displayDescription => description
      .replaceAll(
        RegExp(
          r'\n*---\nMetadados usados automaticamente pelos aplicativos\.[\s\S]*$',
        ),
        '',
      )
      .replaceAll(
        RegExp(
          r'<!-- RPG_RULES_JSON_START -->[\s\S]*?<!-- RPG_RULES_JSON_END -->',
        ),
        '',
      )
      .trim();

  bool categoryMatches(String value) =>
      normalizedCategory.contains(_normalize(value));

  bool get hasStructuredRules => RegExp(
    r'<!-- RPG_RULES_JSON_START -->[\s\S]*?<!-- RPG_RULES_JSON_END -->',
  ).hasMatch(description);

  factory CatalogEntry.fromJson(Map<String, dynamic> json) => CatalogEntry(
    id: json['id']?.toString() ?? '',
    name: json['name']?.toString() ?? '',
    description: json['description']?.toString() ?? '',
    category: json['category']?.toString() ?? '',
    labels: ((json['labels'] as List?) ?? [])
        .whereType<Map>()
        .map((item) => CatalogLabel.fromJson(Map<String, dynamic>.from(item)))
        .toList(),
    imageUrl: json['imageUrl']?.toString() ?? '',
    sourceUrl: json['sourceUrl']?.toString() ?? '',
    updatedAt: DateTime.tryParse(json['updatedAt']?.toString() ?? ''),
  );
}

class OfficialCatalog {
  const OfficialCatalog({
    required this.entries,
    this.boardName = '',
    this.boardUrl = '',
    this.fetchedAt,
  });

  final List<CatalogEntry> entries;
  final String boardName;
  final String boardUrl;
  final DateTime? fetchedAt;

  List<CatalogEntry> entriesFor(String category) => entries
      .where((entry) => entry.categoryMatches(category))
      .toList(growable: false);

  List<CatalogEntry> get races => entriesFor('racas');
  List<CatalogEntry> get playableRaces =>
      races.where((entry) => entry.hasStructuredRules).toList(growable: false);
  List<CatalogEntry> get classes => entriesFor('classes');
  List<CatalogEntry> get playableClasses => classes
      .where((entry) => entry.hasStructuredRules)
      .toList(growable: false);
  List<CatalogEntry> get items => [
    ...entriesFor('itens'),
    ...entriesFor('equipamentos'),
  ];
  List<CatalogEntry> get abilities => entriesFor('habilidades');
  List<CatalogEntry> get spells => entriesFor('magias');
  List<CatalogEntry> get proficiencies => entriesFor('proficiencias');
  List<CatalogEntry> get skills => entriesFor('pericias');

  CatalogEntry? findById(String id) {
    for (final entry in entries) {
      if (entry.id == id) return entry;
    }
    return null;
  }

  factory OfficialCatalog.fromJson(Map<String, dynamic> json) {
    final board = Map<String, dynamic>.from((json['board'] as Map?) ?? {});
    return OfficialCatalog(
      entries: ((json['entries'] as List?) ?? [])
          .whereType<Map>()
          .map((item) => CatalogEntry.fromJson(Map<String, dynamic>.from(item)))
          .toList(),
      boardName: board['name']?.toString() ?? '',
      boardUrl: board['url']?.toString() ?? '',
      fetchedAt: DateTime.tryParse(json['fetchedAt']?.toString() ?? ''),
    );
  }
}

String normalizeCatalogText(String value) => _normalize(value);

String _normalize(String value) {
  const accented = 'áàãâäéèêëíìîïóòõôöúùûüç';
  const plain = 'aaaaaeeeeiiiiooooouuuuc';
  var result = value.toLowerCase();
  for (var index = 0; index < accented.length; index++) {
    result = result.replaceAll(accented[index], plain[index]);
  }
  return result.trim();
}
