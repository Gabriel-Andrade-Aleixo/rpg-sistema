import 'package:flutter/material.dart';

import '../../../domain/services/character_recalculation_service.dart';
import '../../../models/catalog_models.dart';
import '../../../models/character.dart';
import '../../../utils/id_generator.dart';
import '../../widgets/rpg_image.dart';

class InventoryManagementScreen extends StatefulWidget {
  const InventoryManagementScreen({
    super.key,
    required this.character,
    required this.catalog,
  });

  final Character character;
  final OfficialCatalog catalog;

  @override
  State<InventoryManagementScreen> createState() =>
      _InventoryManagementScreenState();
}

class _InventoryManagementScreenState extends State<InventoryManagementScreen> {
  final _recalculation = CharacterRecalculationService();
  final _search = TextEditingController();
  late Character _character;
  String _type = 'Todos';

  @override
  void initState() {
    super.initState();
    _character = widget.character;
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _update(Character next) {
    setState(() {
      _character = _recalculation.recalculate(next, widget.catalog);
    });
  }

  @override
  Widget build(BuildContext context) => DefaultTabController(
    length: 3,
    child: Scaffold(
      appBar: AppBar(
        title: const Text('Inventário e equipamentos'),
        bottom: const TabBar(
          tabs: [
            Tab(text: 'Inventário'),
            Tab(text: 'Equipados'),
            Tab(text: 'Catálogo'),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Concluir',
            onPressed: () => Navigator.pop(context, _character),
            icon: const Icon(Icons.check),
          ),
        ],
      ),
      body: TabBarView(
        children: [
          _ownedList(_character.inventory, equipment: false),
          _ownedList(_character.equipment, equipment: true),
          _catalog(),
        ],
      ),
    ),
  );

  Widget _ownedList(List<InventoryItem> items, {required bool equipment}) {
    if (items.isEmpty) {
      return Center(
        child: Text(
          equipment
              ? 'Nenhum equipamento ativo.'
              : 'Nenhum item no inventário.',
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index];
        final entry = widget.catalog.findById(item.catalogId);
        return Card(
          margin: const EdgeInsets.only(bottom: 10),
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: RpgImage(
                    url: entry?.imageUrl ?? item.imageUrl,
                    width: 58,
                    height: 58,
                    icon: Icons.inventory_2_outlined,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: InkWell(
                    onTap: () => _details(entry, item),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          entry?.name ?? item.name,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        Text(entry?.category ?? item.type),
                        if (item.bonus.isNotEmpty)
                          Text(
                            item.bonus,
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.secondary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        if (!equipment)
                          Row(
                            children: [
                              IconButton(
                                tooltip: 'Diminuir quantidade',
                                onPressed: item.quantity <= 1
                                    ? null
                                    : () => _quantity(item, -1),
                                icon: const Icon(Icons.remove_circle_outline),
                              ),
                              Text('${item.quantity}'),
                              IconButton(
                                tooltip: 'Aumentar quantidade',
                                onPressed: () => _quantity(item, 1),
                                icon: const Icon(Icons.add_circle_outline),
                              ),
                            ],
                          ),
                      ],
                    ),
                  ),
                ),
                PopupMenuButton<String>(
                  onSelected: (value) {
                    if (value == 'move') _move(item, equipment: equipment);
                    if (value == 'remove') _remove(item, equipment: equipment);
                    if (value == 'details') _details(entry, item);
                  },
                  itemBuilder: (_) => [
                    PopupMenuItem(
                      value: 'move',
                      child: Text(equipment ? 'Desequipar' : 'Equipar'),
                    ),
                    const PopupMenuItem(
                      value: 'details',
                      child: Text('Detalhes'),
                    ),
                    const PopupMenuItem(
                      value: 'remove',
                      child: Text('Remover'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _catalog() {
    final types = {
      'Todos',
      ...widget.catalog.items.map((entry) => entry.category),
    }.toList();
    final query = normalizeCatalogText(_search.text);
    final entries = widget.catalog.items.where((entry) {
      final matchesType = _type == 'Todos' || entry.category == _type;
      final matchesQuery = normalizeCatalogText(
        '${entry.name} ${entry.description}',
      ).contains(query);
      return matchesType && matchesQuery;
    }).toList();
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              TextField(
                controller: _search,
                decoration: const InputDecoration(
                  labelText: 'Buscar item oficial',
                  prefixIcon: Icon(Icons.search),
                ),
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: _type,
                decoration: const InputDecoration(labelText: 'Tipo'),
                items: [
                  for (final type in types)
                    DropdownMenuItem(value: type, child: Text(type)),
                ],
                onChanged: (value) => setState(() => _type = value ?? 'Todos'),
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
            itemCount: entries.length,
            itemBuilder: (context, index) {
              final entry = entries[index];
              final count = [..._character.inventory, ..._character.equipment]
                  .where((item) => item.catalogId == entry.id)
                  .fold<int>(0, (sum, item) => sum + item.quantity);
              return ListTile(
                contentPadding: const EdgeInsets.symmetric(vertical: 5),
                leading: ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: RpgImage(
                    url: entry.imageUrl,
                    width: 52,
                    height: 52,
                    icon: Icons.inventory_2_outlined,
                  ),
                ),
                title: Text(entry.name),
                subtitle: Text(
                  '${entry.category}${count > 0 ? ' · possuído: $count' : ''}',
                ),
                onTap: () => _details(entry, null),
                trailing: IconButton(
                  tooltip: 'Adicionar ao inventário',
                  onPressed: () => _add(entry),
                  icon: const Icon(Icons.add_circle_outline),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  void _add(CatalogEntry entry) {
    final inventory = List<InventoryItem>.of(_character.inventory);
    final index = inventory.indexWhere((item) => item.catalogId == entry.id);
    if (index >= 0) {
      inventory[index] = inventory[index].copyWith(
        quantity: inventory[index].quantity + 1,
      );
    } else {
      inventory.add(
        InventoryItem(
          id: newId('item'),
          catalogId: entry.id,
          name: entry.name,
          type: entry.category,
          imageUrl: entry.imageUrl,
          quantity: 1,
        ),
      );
    }
    _update(_character.copyWith(inventory: inventory));
  }

  void _quantity(InventoryItem item, int delta) {
    final inventory = _character.inventory
        .map(
          (current) => current.id == item.id
              ? current.copyWith(
                  quantity: (current.quantity + delta).clamp(1, 9999),
                )
              : current,
        )
        .toList();
    _update(_character.copyWith(inventory: inventory));
  }

  void _move(InventoryItem item, {required bool equipment}) {
    if (equipment) {
      _update(
        _character.copyWith(
          equipment: _character.equipment
              .where((current) => current.id != item.id)
              .toList(),
          inventory: [..._character.inventory, item],
        ),
      );
    } else {
      _update(
        _character.copyWith(
          inventory: _character.inventory
              .where((current) => current.id != item.id)
              .toList(),
          equipment: [
            ..._character.equipment.where((current) => current.id != item.id),
            item,
          ],
        ),
      );
    }
  }

  void _remove(InventoryItem item, {required bool equipment}) {
    _update(
      equipment
          ? _character.copyWith(
              equipment: _character.equipment
                  .where((current) => current.id != item.id)
                  .toList(),
            )
          : _character.copyWith(
              inventory: _character.inventory
                  .where((current) => current.id != item.id)
                  .toList(),
            ),
    );
  }

  void _details(CatalogEntry? entry, InventoryItem? item) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
        child: ListView(
          shrinkWrap: true,
          children: [
            Text(
              entry?.name ?? item?.name ?? 'Item',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            Text(entry?.category ?? item?.type ?? ''),
            const SizedBox(height: 14),
            Text(
              entry?.displayDescription ??
                  item?.description ??
                  'Sem descrição no Trello.',
            ),
            if (item?.bonus.isNotEmpty == true) ...[
              const SizedBox(height: 12),
              Text(
                'Bônus: ${item!.bonus}',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ],
            if (entry?.sourceUrl.isNotEmpty == true) ...[
              const SizedBox(height: 14),
              SelectableText('Origem: ${entry!.sourceUrl}'),
            ],
          ],
        ),
      ),
    );
  }
}
