import 'package:flutter/material.dart';

import '../../../models/catalog_models.dart';
import '../../widgets/rpg_image.dart';

class CatalogScreen extends StatefulWidget {
  const CatalogScreen({
    super.key,
    required this.catalog,
    this.embedded = false,
  });

  final OfficialCatalog catalog;
  final bool embedded;

  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> {
  String _query = '';
  String? _category;

  @override
  Widget build(BuildContext context) {
    final categories =
        widget.catalog.entries.map((item) => item.category).toSet().toList()
          ..sort();
    final entries = widget.catalog.entries.where((entry) {
      final categoryMatches = _category == null || entry.category == _category;
      final text = '${entry.name} ${entry.description}'.toLowerCase();
      return categoryMatches && text.contains(_query.toLowerCase());
    }).toList();
    final content = Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (widget.embedded) ...[
                Text(
                  'Catálogo oficial',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 3),
                Text(
                  '${entries.length} de ${widget.catalog.entries.length} entradas do Trello',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 14),
              ],
              TextField(
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.search),
                  hintText: 'Buscar por nome, bônus ou requisito',
                ),
                onChanged: (value) => setState(() => _query = value),
              ),
              const SizedBox(height: 10),
              SizedBox(
                height: 40,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: [
                    ChoiceChip(
                      label: const Text('Todos'),
                      selected: _category == null,
                      onSelected: (_) => setState(() => _category = null),
                    ),
                    const SizedBox(width: 8),
                    for (final category in categories) ...[
                      ChoiceChip(
                        label: Text(category),
                        selected: _category == category,
                        onSelected: (_) => setState(() => _category = category),
                      ),
                      const SizedBox(width: 8),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: entries.isEmpty
              ? const Center(child: Text('Nenhuma entrada encontrada.'))
              : LayoutBuilder(
                  builder: (context, constraints) {
                    final columns = constraints.maxWidth >= 760 ? 2 : 1;
                    return GridView.builder(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: columns,
                        crossAxisSpacing: 12,
                        mainAxisSpacing: 10,
                        mainAxisExtent: 78,
                      ),
                      itemCount: entries.length,
                      itemBuilder: (context, index) =>
                          _entryCard(entries[index]),
                    );
                  },
                ),
        ),
      ],
    );
    if (widget.embedded) return content;
    return Scaffold(
      appBar: AppBar(title: const Text('Catálogo oficial')),
      body: content,
    );
  }

  Widget _entryCard(CatalogEntry entry) => Card(
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: () => showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (_) => DraggableScrollableSheet(
          expand: false,
          initialChildSize: .75,
          builder: (context, controller) => ListView(
            controller: controller,
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
            children: [
              RpgImage(
                url: entry.imageUrl,
                height: 220,
                width: double.infinity,
              ),
              const SizedBox(height: 16),
              Text(
                entry.name,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              Text(
                entry.category,
                style: Theme.of(context).textTheme.labelLarge,
              ),
              const SizedBox(height: 12),
              Text(
                entry.displayDescription.isEmpty
                    ? 'O cartão não possui descrição.'
                    : entry.displayDescription,
              ),
              if (entry.labels.isNotEmpty) ...[
                const SizedBox(height: 16),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final label in entry.labels)
                      Chip(
                        label: Text(
                          label.name.isEmpty ? label.color : label.name,
                        ),
                      ),
                  ],
                ),
              ],
              const SizedBox(height: 12),
              SelectableText('Origem: ${entry.sourceUrl}'),
            ],
          ),
        ),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 10),
        leading: ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: RpgImage(url: entry.imageUrl, width: 54, height: 54),
        ),
        title: Text(entry.name),
        subtitle: Text(entry.category),
        trailing: const Icon(Icons.chevron_right),
      ),
    ),
  );
}
