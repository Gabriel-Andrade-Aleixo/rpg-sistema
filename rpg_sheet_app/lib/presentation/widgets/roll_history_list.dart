import 'package:flutter/material.dart';

import '../../models/character_records.dart';

class RollHistoryList extends StatelessWidget {
  const RollHistoryList({super.key, required this.records, this.onClear});

  final List<DiceRollRecord> records;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    if (records.isEmpty) return const Text('Nenhuma rolagem registrada.');
    return Column(
      children: [
        Align(
          alignment: Alignment.centerRight,
          child: TextButton.icon(
            onPressed: onClear,
            icon: const Icon(Icons.delete_sweep_outlined),
            label: const Text('Limpar'),
          ),
        ),
        for (final record in records.take(30))
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: CircleAvatar(child: Text('${record.finalResult}')),
            title: Text(record.name),
            subtitle: Text(
              '${record.die}: ${record.rawResult} | ${record.formula}\n${record.createdAt.toLocal()}',
            ),
          ),
      ],
    );
  }
}
