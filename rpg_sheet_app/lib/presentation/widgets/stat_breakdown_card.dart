import 'package:flutter/material.dart';

import '../../models/character_records.dart';

class StatBreakdownCard extends StatelessWidget {
  const StatBreakdownCard({
    super.key,
    required this.label,
    required this.base,
    required this.total,
    this.modifiers = const [],
  });

  final String label;
  final int base;
  final int total;
  final List<Modifier> modifiers;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ExpansionTile(
        title: Text(label),
        trailing: Text('$total', style: Theme.of(context).textTheme.titleLarge),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        children: [
          _row('Base', base),
          for (final modifier in modifiers)
            _row(modifier.sourceName, modifier.value.round()),
          const Divider(),
          _row('Total', total, bold: true),
        ],
      ),
    );
  }

  Widget _row(String name, int value, {bool bold = false}) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(
      children: [
        Expanded(
          child: Text(
            name,
            style: bold ? const TextStyle(fontWeight: FontWeight.w700) : null,
          ),
        ),
        Text(
          '${value >= 0 && name != 'Base' && name != 'Total' ? '+' : ''}$value',
        ),
      ],
    ),
  );
}
