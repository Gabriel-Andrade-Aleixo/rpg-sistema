import 'package:flutter/material.dart';

import '../../models/character_records.dart';

class StatBreakdownCard extends StatelessWidget {
  const StatBreakdownCard({
    super.key,
    required this.label,
    required this.base,
    required this.total,
    this.rawTotal,
    this.modifiers = const [],
    this.onRoll,
  });

  final String label;
  final int base;
  final int total;
  final double? rawTotal;
  final List<Modifier> modifiers;
  final VoidCallback? onRoll;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ExpansionTile(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label),
            Text(
              '$base pontos investidos',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (onRoll != null)
              IconButton(
                tooltip: 'Rolar $label',
                onPressed: onRoll,
                icon: const Icon(Icons.casino_outlined),
              ),
            Text('$total', style: Theme.of(context).textTheme.titleLarge),
          ],
        ),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        children: [
          _row('Pontos investidos', base),
          for (final modifier in modifiers)
            _row(modifier.sourceName, modifier.value),
          if (rawTotal != null && rawTotal != total)
            _row('Antes de arredondar', rawTotal!),
          const Divider(),
          _row('Valor atual', total, bold: true),
        ],
      ),
    );
  }

  Widget _row(String name, num value, {bool bold = false}) => Padding(
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
          '${value >= 0 && name != 'Pontos investidos' && name != 'Valor atual' && name != 'Antes de arredondar' ? '+' : ''}${value is int || value % 1 == 0 ? value.toInt() : value.toStringAsFixed(1).replaceAll('.', ',')}',
        ),
      ],
    ),
  );
}
