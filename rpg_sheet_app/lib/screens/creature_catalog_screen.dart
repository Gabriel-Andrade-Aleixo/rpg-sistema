import 'package:flutter/material.dart';

import '../data/creature_catalog.dart';
import '../models/creature.dart';
import '../models/rpg_rule_models.dart';
import '../widgets/responsive_grid.dart';
import '../widgets/section_card.dart';
import '../widgets/stat_tile.dart';

class CreatureCatalogScreen extends StatelessWidget {
  const CreatureCatalogScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Criaturas')),
      body: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: creatureCatalog.length,
        itemBuilder: (context, index) {
          final creature = creatureCatalog[index];
          return Card(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
            child: ListTile(
              title: Text(creature.name),
              subtitle: Text('${creature.type} - ${creature.threat}'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => CreatureDetailScreen(creature: creature),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class CreatureDetailScreen extends StatelessWidget {
  const CreatureDetailScreen({super.key, required this.creature});

  final Creature creature;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(creature.name)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          SectionCard(
            title: 'Resumo',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Tipo: ${creature.type}'),
                Text('Papel: ${creature.role.isEmpty ? '-' : creature.role}'),
                Text(
                  'Ameaca: ${creature.threat.isEmpty ? '-' : creature.threat}',
                ),
                const SizedBox(height: 8),
                Text(creature.description),
              ],
            ),
          ),
          SectionCard(
            title: 'Estatisticas',
            child: ResponsiveGrid(
              children: [
                StatTile(
                  label: 'CA',
                  value: creature.armorClass?.toString() ?? '-',
                ),
                StatTile(
                  label: 'PV',
                  value: creature.hitPoints?.toString() ?? '-',
                ),
                StatTile(
                  label: 'Mana',
                  value: creature.mana?.toString() ?? '-',
                ),
                StatTile(
                  label: 'Movimento',
                  value: creature.movementMeters == null
                      ? '-'
                      : '${creature.movementMeters}m',
                ),
              ],
            ),
          ),
          if (creature.attributes.isNotEmpty)
            SectionCard(
              title: 'Atributos',
              child: ResponsiveGrid(
                children: [
                  for (final entry in creature.attributes.entries)
                    StatTile(label: entry.key.label, value: '${entry.value}'),
                ],
              ),
            ),
          if (creature.skills.isNotEmpty)
            SectionCard(
              title: 'Pericias',
              child: Column(
                children: [
                  for (final entry in creature.skills.entries)
                    ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      title: Text(entry.key),
                      trailing: Text('+${entry.value}'),
                    ),
                ],
              ),
            ),
          _listSection('Habilidades', creature.abilities),
          _listSection('Resistencias', creature.resistances),
          _listSection('Vulnerabilidades', creature.vulnerabilities),
          if (creature.notes.isNotEmpty)
            SectionCard(title: 'Notas', child: Text(creature.notes)),
        ],
      ),
    );
  }

  Widget _listSection(String title, List<String> values) {
    if (values.isEmpty) return const SizedBox.shrink();
    return SectionCard(
      title: title,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final value in values)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Text(value),
            ),
        ],
      ),
    );
  }
}
