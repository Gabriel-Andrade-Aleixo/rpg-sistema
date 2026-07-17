import 'dart:convert';

import 'package:flutter/material.dart';

import '../../../models/catalog_models.dart';
import '../../../models/character.dart';

class AdminOwnershipDirectory {
  const AdminOwnershipDirectory({
    required this.users,
    required this.characters,
  });

  final List<Map<String, dynamic>> users;
  final List<Map<String, dynamic>> characters;
}

class AdminScreen extends StatefulWidget {
  const AdminScreen({
    super.key,
    required this.catalog,
    required this.characters,
    required this.onRefresh,
    required this.onSaveEntry,
    required this.onDeleteEntry,
    required this.onLoadOwnership,
    required this.onTransferOwner,
    this.embedded = false,
  });

  final OfficialCatalog catalog;
  final List<Character> characters;
  final Future<void> Function(
    String kind,
    Map<String, dynamic> entry,
    String? id,
  )
  onSaveEntry;
  final Future<void> Function(String kind, String id) onDeleteEntry;
  final Future<AdminOwnershipDirectory> Function() onLoadOwnership;
  final Future<void> Function(String characterId, String ownerUserId)
  onTransferOwner;
  final Future<void> Function() onRefresh;
  final bool embedded;

  @override
  State<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends State<AdminScreen> {
  var _tab = 0;
  var _query = '';
  Future<AdminOwnershipDirectory>? _ownershipFuture;
  final Map<String, String> _ownerSelection = {};

  List<CatalogEntry> get _spells => widget.catalog.entriesFor('magias');

  @override
  Widget build(BuildContext context) {
    final body = Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Modo mestre',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        Text(
                          'Conteúdo oficial salvo no Supabase.',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  IconButton.filledTonal(
                    tooltip: 'Sincronizar catálogo',
                    onPressed: widget.onRefresh,
                    icon: const Icon(Icons.sync),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: SegmentedButton<int>(
                  segments: const [
                    ButtonSegment(
                      value: 0,
                      icon: Icon(Icons.dashboard_outlined),
                      label: Text('Resumo'),
                    ),
                    ButtonSegment(
                      value: 1,
                      icon: Icon(Icons.inventory_2_outlined),
                      label: Text('Itens'),
                    ),
                    ButtonSegment(
                      value: 2,
                      icon: Icon(Icons.auto_awesome_outlined),
                      label: Text('Magias'),
                    ),
                    ButtonSegment(
                      value: 3,
                      icon: Icon(Icons.swap_horiz_outlined),
                      label: Text('Fichas'),
                    ),
                  ],
                  selected: {_tab},
                  showSelectedIcon: false,
                  onSelectionChanged: (value) => setState(() {
                    _tab = value.first;
                    _query = '';
                    if (_tab == 3) {
                      _ownershipFuture ??= widget.onLoadOwnership();
                    }
                  }),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: _tab == 0
              ? _overview(context)
              : _tab == 3
              ? _ownership(context)
              : _manager(context, _tab == 2 ? 'spell' : 'item'),
        ),
      ],
    );
    if (widget.embedded) return body;
    return Scaffold(
      appBar: AppBar(title: const Text('Modo mestre')),
      body: body,
    );
  }

  Widget _overview(BuildContext context) {
    final withoutDescription = widget.catalog.entries
        .where((entry) => entry.description.trim().isEmpty)
        .length;
    final withoutImage = widget.catalog.entries
        .where((entry) => entry.imageUrl.trim().isEmpty)
        .length;
    final invalid = widget.characters
        .where(
          (character) =>
              widget.catalog.findById(character.raceId)?.hasStructuredRules !=
                  true ||
              widget.catalog.findById(character.classId)?.hasStructuredRules !=
                  true,
        )
        .length;
    final metrics = [
      ('Entradas oficiais', widget.catalog.entries.length, Icons.library_books),
      ('Itens', widget.catalog.items.length, Icons.inventory_2_outlined),
      ('Magias', _spells.length, Icons.auto_awesome_outlined),
      ('Personagens', widget.characters.length, Icons.groups_outlined),
      ('Sem imagem', withoutImage, Icons.broken_image_outlined),
      ('Sem descrição', withoutDescription, Icons.description_outlined),
    ];
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        LayoutBuilder(
          builder: (context, constraints) {
            final width = constraints.maxWidth > 680
                ? (constraints.maxWidth - 20) / 3
                : (constraints.maxWidth - 10) / 2;
            return Wrap(
              spacing: 10,
              runSpacing: 10,
              children: metrics
                  .map(
                    (metric) => SizedBox(
                      width: width,
                      child: Card(
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Row(
                            children: [
                              Icon(
                                metric.$3,
                                color: Theme.of(context).colorScheme.secondary,
                              ),
                              const SizedBox(width: 10),
                              Expanded(child: Text(metric.$1)),
                              Text(
                                '${metric.$2}',
                                style: Theme.of(context).textTheme.titleLarge,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  )
                  .toList(),
            );
          },
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  invalid == 0
                      ? Icons.check_circle_outline
                      : Icons.warning_amber,
                  color: invalid == 0
                      ? Theme.of(context).colorScheme.tertiary
                      : Theme.of(context).colorScheme.error,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Qualidade do catálogo',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        invalid == 0
                            ? 'As fichas estão consistentes com o catálogo atual.'
                            : '$invalid ficha(s) precisam de revisão de raça ou classe.',
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _ownership(BuildContext context) {
    _ownershipFuture ??= widget.onLoadOwnership();
    return FutureBuilder<AdminOwnershipDirectory>(
      future: _ownershipFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.cloud_off_outlined, size: 42),
                  const SizedBox(height: 12),
                  Text(
                    'Não foi possível carregar as fichas.\n${snapshot.error}',
                  ),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed: _reloadOwnership,
                    icon: const Icon(Icons.refresh),
                    label: const Text('Tentar novamente'),
                  ),
                ],
              ),
            ),
          );
        }
        final directory = snapshot.data!;
        final query = normalizeCatalogText(_query);
        final characters = directory.characters.where((character) {
          final text = [
            _mapText(character, 'name'),
            _mapText(character, 'playerName'),
            _mapText(character, 'ownerName'),
            _mapText(character, 'ownerEmail'),
          ].join(' ');
          return normalizeCatalogText(text).contains(query);
        }).toList();
        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      decoration: const InputDecoration(
                        hintText: 'Buscar fichas...',
                        prefixIcon: Icon(Icons.search),
                      ),
                      onChanged: (value) => setState(() => _query = value),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filledTonal(
                    tooltip: 'Atualizar fichas',
                    onPressed: _reloadOwnership,
                    icon: const Icon(Icons.refresh),
                  ),
                ],
              ),
            ),
            Expanded(
              child: characters.isEmpty
                  ? Center(
                      child: Text(
                        _query.isEmpty
                            ? 'Nenhuma ficha cadastrada.'
                            : 'Nenhuma ficha encontrada.',
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                      itemCount: characters.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
                      itemBuilder: (context, index) => _ownershipCard(
                        context,
                        characters[index],
                        directory.users,
                      ),
                    ),
            ),
          ],
        );
      },
    );
  }

  Widget _ownershipCard(
    BuildContext context,
    Map<String, dynamic> character,
    List<Map<String, dynamic>> users,
  ) {
    final id = _mapText(character, 'id');
    final currentOwner = _mapText(character, 'ownerUserId');
    final selectedOwner = _ownerSelection[id] ?? currentOwner;
    final selectedExists = users.any(
      (user) => _mapText(user, 'id') == selectedOwner,
    );
    final race = widget.catalog.findById(_mapText(character, 'raceId'));
    final characterClass = widget.catalog.findById(
      _mapText(character, 'classId'),
    );
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _characterThumbnail(context, character),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _mapText(character, 'name').isEmpty
                            ? 'Sem nome'
                            : _mapText(character, 'name'),
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        '${race?.name ?? 'Raça indisponível'} · ${characterClass?.name ?? 'Classe indisponível'} · Nível ${_mapText(character, 'level').isEmpty ? '1' : _mapText(character, 'level')}',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        '${_mapText(character, 'isPrivate') == 'true' ? 'Privada' : 'Pública'} · Dono atual: ${_mapText(character, 'ownerName').isEmpty ? _mapText(character, 'ownerEmail') : _mapText(character, 'ownerName')}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: selectedExists ? selectedOwner : null,
              decoration: const InputDecoration(labelText: 'Novo dono'),
              items: users
                  .map(
                    (user) => DropdownMenuItem(
                      value: _mapText(user, 'id'),
                      child: Text(
                        '${_mapText(user, 'displayName').isEmpty ? _mapText(user, 'email') : _mapText(user, 'displayName')} · ${_mapText(user, 'email')}',
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  )
                  .toList(),
              onChanged: (value) => setState(() {
                if (value == null || value.isEmpty) {
                  _ownerSelection.remove(id);
                } else {
                  _ownerSelection[id] = value;
                }
              }),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed:
                    selectedOwner.isEmpty || selectedOwner == currentOwner
                    ? null
                    : () => _transferOwner(id, selectedOwner),
                icon: const Icon(Icons.swap_horiz),
                label: const Text('Transferir ficha'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _characterThumbnail(
    BuildContext context,
    Map<String, dynamic> character,
  ) {
    final imageUrl = _mapText(character, 'imageUrl');
    return ClipRRect(
      borderRadius: BorderRadius.circular(7),
      child: SizedBox(
        width: 58,
        height: 58,
        child: imageUrl.isEmpty
            ? ColoredBox(
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                child: const Icon(Icons.shield_outlined),
              )
            : Image.network(
                imageUrl,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) =>
                    const Icon(Icons.broken_image_outlined),
              ),
      ),
    );
  }

  Future<void> _reloadOwnership() async {
    setState(() {
      _ownershipFuture = widget.onLoadOwnership();
      _ownerSelection.clear();
    });
  }

  Future<void> _transferOwner(String characterId, String ownerUserId) async {
    await _runAction(context, () async {
      await widget.onTransferOwner(characterId, ownerUserId);
      await _reloadOwnership();
    }, 'Ficha transferida.');
  }

  Widget _manager(BuildContext context, String kind) {
    final all = kind == 'spell' ? _spells : widget.catalog.items;
    final entries = all
        .where(
          (entry) => normalizeCatalogText(
            entry.name,
          ).contains(normalizeCatalogText(_query)),
        )
        .toList();
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  decoration: InputDecoration(
                    hintText: kind == 'spell'
                        ? 'Buscar magias...'
                        : 'Buscar itens...',
                    prefixIcon: const Icon(Icons.search),
                  ),
                  onChanged: (value) => setState(() => _query = value),
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filled(
                tooltip: kind == 'spell' ? 'Criar magia' : 'Criar item',
                onPressed: () => _showEditor(context, kind),
                icon: const Icon(Icons.add),
              ),
            ],
          ),
        ),
        Expanded(
          child: entries.isEmpty
              ? Center(
                  child: Text(
                    _query.isEmpty
                        ? 'Nenhum cadastro nesta área.'
                        : 'Nenhum resultado encontrado.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                  itemCount: entries.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final entry = entries[index];
                    return Card(
                      child: ListTile(
                        contentPadding: const EdgeInsets.fromLTRB(10, 6, 4, 6),
                        leading: _thumbnail(context, entry),
                        title: Text(
                          entry.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        subtitle: Text(
                          _summary(entry),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        trailing: PopupMenuButton<String>(
                          tooltip: 'Ações',
                          onSelected: (action) {
                            if (action == 'edit') {
                              _showEditor(context, kind, entry);
                            } else {
                              _confirmDelete(context, kind, entry);
                            }
                          },
                          itemBuilder: (_) => const [
                            PopupMenuItem(
                              value: 'edit',
                              child: ListTile(
                                leading: Icon(Icons.edit_outlined),
                                title: Text('Editar'),
                              ),
                            ),
                            PopupMenuItem(
                              value: 'delete',
                              child: ListTile(
                                leading: Icon(Icons.delete_outline),
                                title: Text('Excluir'),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  Widget _thumbnail(BuildContext context, CatalogEntry entry) => ClipRRect(
    borderRadius: BorderRadius.circular(7),
    child: SizedBox(
      width: 54,
      height: 54,
      child: entry.imageUrl.isEmpty
          ? ColoredBox(
              color: Theme.of(context).colorScheme.surfaceContainerHighest,
              child: const Icon(Icons.image_outlined),
            )
          : Image.network(
              entry.imageUrl,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) =>
                  const Icon(Icons.broken_image_outlined),
            ),
    ),
  );

  Future<void> _confirmDelete(
    BuildContext context,
    String kind,
    CatalogEntry entry,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Excluir ${entry.name}?'),
        content: const Text('O cadastro será removido da biblioteca oficial.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Excluir'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    await _runAction(
      context,
      () => widget.onDeleteEntry(kind, entry.id),
      '${kind == 'spell' ? 'Magia' : 'Item'} removido do catálogo.',
    );
  }

  Future<void> _showEditor(
    BuildContext context,
    String kind, [
    CatalogEntry? entry,
  ]) async {
    final metadata = entry == null ? <String, dynamic>{} : _metadata(entry);
    final modifier = ((metadata['modifiers'] as List?) ?? [])
        .whereType<Map>()
        .firstOrNull;
    final costs = Map<String, dynamic>.from((metadata['costs'] as Map?) ?? {});
    final name = TextEditingController(text: entry?.name ?? '');
    final description = TextEditingController(
      text: entry == null ? '' : _summary(entry),
    );
    final image = TextEditingController(text: entry?.imageUrl ?? '');
    final bonus = TextEditingController(text: '${modifier?['value'] ?? 1}');
    final weight = TextEditingController(text: '${metadata['weight'] ?? 0}');
    final level = TextEditingController(text: '${metadata['level'] ?? 0}');
    final topic = TextEditingController(
      text: '${metadata['topic'] ?? 'Sem tópico'}',
    );
    final className = TextEditingController(
      text: '${metadata['className'] ?? ''}',
    );
    final mana = TextEditingController(text: '${costs['mana'] ?? 0}');
    final focus = TextEditingController(text: '${costs['focus'] ?? 0}');
    final humanity = TextEditingController(text: '${costs['humanity'] ?? 0}');
    final range = TextEditingController(text: '${metadata['range'] ?? ''}');
    final damage = TextEditingController(text: '${metadata['damage'] ?? ''}');
    var type = metadata['armorCategory'] != null
        ? 'Armadura'
        : _itemType(entry);
    var armorCategory = _armorCategory(metadata['armorCategory']);
    var bonusTarget =
        '${modifier?['targetId'] ?? (type == 'Armadura' ? 'defense' : '')}';
    var school = _school(metadata['school']);
    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(entry == null ? 'Novo cadastro' : 'Editar cadastro'),
          content: SizedBox(
            width: 520,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: name,
                    autofocus: true,
                    decoration: const InputDecoration(labelText: 'Nome'),
                    onChanged: (_) => setDialogState(() {}),
                  ),
                  if (kind == 'item') ...[
                    DropdownButtonFormField<String>(
                      initialValue: type,
                      decoration: const InputDecoration(labelText: 'Tipo'),
                      items:
                          const [
                                'Armadura',
                                'Arma',
                                'Consumível',
                                'Artefato',
                                'Outro',
                              ]
                              .map(
                                (value) => DropdownMenuItem(
                                  value: value,
                                  child: Text(value),
                                ),
                              )
                              .toList(),
                      onChanged: (value) =>
                          setDialogState(() => type = value ?? type),
                    ),
                    if (type == 'Armadura')
                      DropdownButtonFormField<String>(
                        initialValue: armorCategory,
                        decoration: const InputDecoration(
                          labelText: 'Categoria',
                        ),
                        items: const ['Leve', 'Média', 'Pesada', 'Escudo']
                            .map(
                              (value) => DropdownMenuItem(
                                value: value,
                                child: Text(value),
                              ),
                            )
                            .toList(),
                        onChanged: (value) => setDialogState(
                          () => armorCategory = value ?? armorCategory,
                        ),
                      ),
                    DropdownButtonFormField<String>(
                      initialValue: bonusTarget,
                      decoration: const InputDecoration(labelText: 'Bônus em'),
                      items:
                          const {
                                '': 'Sem bônus',
                                'defense': 'Defesa',
                                'armorClass': 'CA',
                                'attack': 'Ataque',
                                'damage': 'Dano',
                                'health': 'Vida',
                                'mana': 'Mana',
                                'strength': 'Força',
                                'dexterity': 'Destreza',
                                'constitution': 'Constituição',
                                'intelligence': 'Inteligência',
                                'charisma': 'Carisma',
                                'faith': 'Fé',
                              }.entries
                              .map(
                                (item) => DropdownMenuItem(
                                  value: item.key,
                                  child: Text(item.value),
                                ),
                              )
                              .toList(),
                      onChanged: (value) =>
                          setDialogState(() => bonusTarget = value ?? ''),
                    ),
                    TextField(
                      controller: bonus,
                      enabled: bonusTarget.isNotEmpty,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Valor do bônus',
                      ),
                    ),
                    TextField(
                      controller: weight,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      decoration: const InputDecoration(labelText: 'Peso'),
                    ),
                  ] else ...[
                    DropdownButtonFormField<String>(
                      initialValue: school,
                      decoration: const InputDecoration(
                        labelText: 'Tipo de magia',
                      ),
                      items:
                          const [
                                'Arcana',
                                'Divina',
                                'Espectral',
                                'Elemental',
                                'Demoníaca',
                                'Natural',
                                'Outra',
                              ]
                              .map(
                                (value) => DropdownMenuItem(
                                  value: value,
                                  child: Text(value),
                                ),
                              )
                              .toList(),
                      onChanged: (value) =>
                          setDialogState(() => school = value ?? school),
                    ),
                    TextField(
                      controller: level,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Nível'),
                    ),
                    TextField(
                      controller: topic,
                      decoration: const InputDecoration(labelText: 'Tópico'),
                    ),
                    TextField(
                      controller: className,
                      decoration: const InputDecoration(
                        labelText: 'Classe indicada',
                      ),
                    ),
                    TextField(
                      controller: mana,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Custo de mana',
                      ),
                    ),
                    TextField(
                      controller: focus,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Custo de foco',
                      ),
                    ),
                    TextField(
                      controller: humanity,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Custo de humanidade',
                      ),
                    ),
                    TextField(
                      controller: range,
                      decoration: const InputDecoration(labelText: 'Alcance'),
                    ),
                    TextField(
                      controller: damage,
                      decoration: const InputDecoration(
                        labelText: 'Dano ou efeito',
                      ),
                    ),
                  ],
                  TextField(
                    controller: description,
                    minLines: 3,
                    maxLines: 6,
                    decoration: const InputDecoration(labelText: 'Descrição'),
                  ),
                  TextField(
                    controller: image,
                    keyboardType: TextInputType.url,
                    decoration: const InputDecoration(
                      labelText: 'URL da imagem',
                    ),
                    onChanged: (_) => setDialogState(() {}),
                  ),
                  if (image.text.trim().isNotEmpty) ...[
                    const SizedBox(height: 10),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(7),
                      child: AspectRatio(
                        aspectRatio: 16 / 7,
                        child: Image.network(
                          image.text.trim(),
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => const Center(
                            child: Icon(Icons.broken_image_outlined),
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: name.text.trim().length < 2
                  ? null
                  : () => Navigator.pop(
                      context,
                      kind == 'item'
                          ? {
                              'name': name.text.trim(),
                              'type': type,
                              'armorCategory': type == 'Armadura'
                                  ? armorCategory
                                  : '',
                              'bonusTarget': bonusTarget,
                              'bonusValue': int.tryParse(bonus.text) ?? 0,
                              'weight':
                                  double.tryParse(
                                    weight.text.replaceAll(',', '.'),
                                  ) ??
                                  0,
                              'description': description.text.trim(),
                              'imageUrl': image.text.trim(),
                            }
                          : {
                              'name': name.text.trim(),
                              'school': school,
                              'level': int.tryParse(level.text) ?? 0,
                              'topic': topic.text.trim(),
                              'className': className.text.trim(),
                              'actionType': metadata['actionType'] ?? '',
                              'actionId': metadata['actionId'] ?? '',
                              'manaCost': int.tryParse(mana.text) ?? 0,
                              'focusCost': int.tryParse(focus.text) ?? 0,
                              'humanityCost': int.tryParse(humanity.text) ?? 0,
                              'range': range.text.trim(),
                              'damage': damage.text.trim(),
                              'description': description.text.trim(),
                              'imageUrl': image.text.trim(),
                            },
                    ),
              child: Text(
                entry == null ? 'Criar cadastro' : 'Salvar alterações',
              ),
            ),
          ],
        ),
      ),
    );
    for (final controller in [
      name,
      description,
      image,
      bonus,
      weight,
      level,
      topic,
      className,
      mana,
      focus,
      humanity,
      range,
      damage,
    ]) {
      controller.dispose();
    }
    if (result == null || !context.mounted) return;
    await _runAction(
      context,
      () => widget.onSaveEntry(kind, result, entry?.id),
      '${kind == 'spell' ? 'Magia' : 'Item'} salvo na biblioteca oficial.',
    );
  }

  Future<void> _runAction(
    BuildContext context,
    Future<void> Function() action,
    String success,
  ) async {
    try {
      await action();
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(success)));
      }
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Não foi possível concluir: $error')),
        );
      }
    }
  }

  Map<String, dynamic> _metadata(CatalogEntry entry) {
    final match = RegExp(
      r'<!-- RPG_RULES_JSON_START -->([\s\S]*?)<!-- RPG_RULES_JSON_END -->',
    ).firstMatch(entry.description);
    if (match == null) return {};
    try {
      return Map<String, dynamic>.from(jsonDecode(match.group(1)!.trim()));
    } catch (_) {
      return {};
    }
  }

  String _summary(CatalogEntry entry) => entry.displayDescription
      .split(RegExp(r'\r?\n'))
      .where(
        (line) =>
            line.isNotEmpty &&
            !line.startsWith('# ') &&
            !RegExp(
              r'^\*\*(Tipo|Categoria|Peso|Nível|Tópico|Classe|Custo|Alcance|Dano/Efeito):\*\*',
              caseSensitive: false,
            ).hasMatch(line) &&
            !line.startsWith('O bônus é aplicado'),
      )
      .join('\n')
      .trim();

  String _itemType(CatalogEntry? entry) {
    if (entry == null) return 'Armadura';
    for (final label in entry.labels) {
      if (label.name.startsWith('Tipo: ')) return label.name.substring(6);
    }
    return 'Outro';
  }

  String _armorCategory(dynamic value) => switch ('$value') {
    'media' => 'Média',
    'pesada' => 'Pesada',
    'escudo' => 'Escudo',
    _ => 'Leve',
  };

  String _school(dynamic value) => switch ('$value') {
    'divina' => 'Divina',
    'espectral' => 'Espectral',
    'elemental' => 'Elemental',
    'demoniaca' => 'Demoníaca',
    'natural' => 'Natural',
    'outra' => 'Outra',
    _ => 'Arcana',
  };

  String _mapText(Map<String, dynamic> map, String key) =>
      map[key]?.toString() ?? '';
}
