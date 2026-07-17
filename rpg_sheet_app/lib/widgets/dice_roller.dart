import 'dart:convert';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../presentation/widgets/animated_dice.dart';

class DiceRoller extends StatefulWidget {
  const DiceRoller({super.key});

  @override
  State<DiceRoller> createState() => _DiceRollerState();
}

class _DiceRollerState extends State<DiceRoller> {
  static const _dice = [4, 6, 8, 10, 12, 20, 100];
  static const _storageKey = 'runalith_dice_history_v1';

  final _random = Random.secure();
  final _modifier = TextEditingController(text: '0');
  final _label = TextEditingController(text: 'Rolagem livre');
  final List<_DiceHistoryEntry> _history = [];

  int _sides = 20;
  int _rawResult = 20;
  int _finalResult = 20;
  bool _rolling = false;

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  @override
  void dispose() {
    _modifier.dispose();
    _label.dispose();
    super.dispose();
  }

  Future<void> _loadHistory() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_storageKey);
    if (raw == null || raw.isEmpty) return;
    try {
      final decoded = (jsonDecode(raw) as List)
          .whereType<Map>()
          .map(
            (item) =>
                _DiceHistoryEntry.fromJson(Map<String, dynamic>.from(item)),
          )
          .take(30)
          .toList();
      if (!mounted) return;
      setState(() => _history.addAll(decoded));
    } catch (_) {
      await prefs.remove(_storageKey);
    }
  }

  Future<void> _saveHistory() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _storageKey,
      jsonEncode(_history.take(30).map((item) => item.toJson()).toList()),
    );
  }

  Future<void> _roll() async {
    if (_rolling) return;
    final modifier = int.tryParse(_modifier.text.trim()) ?? 0;
    setState(() => _rolling = true);
    for (var i = 0; i < 16; i++) {
      await Future<void>.delayed(const Duration(milliseconds: 46));
      if (!mounted) return;
      setState(() {
        _rawResult = _random.nextInt(_sides) + 1;
        _finalResult = _rawResult + modifier;
      });
    }
    final raw = _random.nextInt(_sides) + 1;
    final entry = _DiceHistoryEntry(
      name: _label.text.trim().isEmpty
          ? 'Rolagem d$_sides'
          : _label.text.trim(),
      die: 'd$_sides',
      raw: raw,
      modifier: modifier,
      finalResult: raw + modifier,
      createdAt: DateTime.now(),
    );
    setState(() {
      _rawResult = raw;
      _finalResult = entry.finalResult;
      _history.insert(0, entry);
      if (_history.length > 30) _history.removeRange(30, _history.length);
      _rolling = false;
    });
    await _saveHistory();
  }

  Future<void> _clearHistory() async {
    setState(_history.clear);
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_storageKey);
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return CustomScrollView(
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 100),
          sliver: SliverList.list(
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: scheme.surface,
                  border: Border.all(color: scheme.outlineVariant),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.asset(
                        'assets/brand/runalith_icon.png',
                        width: 62,
                        height: 62,
                        fit: BoxFit.cover,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Dice Roller',
                            style: Theme.of(context).textTheme.headlineSmall,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Role dados com modificador e mantenha as últimas 30 rolagens salvas neste celular.',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'Mesa de rolagem',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _label,
                        decoration: const InputDecoration(
                          labelText: 'Nome da rolagem',
                          prefixIcon: Icon(Icons.edit_note_outlined),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          for (final die in _dice)
                            ChoiceChip(
                              label: Text('d$die'),
                              selected: _sides == die,
                              onSelected: _rolling
                                  ? null
                                  : (_) => setState(() => _sides = die),
                            ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _modifier,
                        keyboardType: const TextInputType.numberWithOptions(
                          signed: true,
                        ),
                        decoration: const InputDecoration(
                          labelText: 'Modificador',
                          prefixIcon: Icon(Icons.exposure_outlined),
                        ),
                      ),
                      const SizedBox(height: 18),
                      Center(
                        child: GestureDetector(
                          onTap: _rolling ? null : _roll,
                          child: AnimatedDice(
                            sides: _sides,
                            rolling: _rolling,
                            result: _rawResult,
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Center(
                        child: Column(
                          children: [
                            Text(
                              'Resultado final',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                            Text(
                              '$_finalResult',
                              style: Theme.of(context).textTheme.displaySmall
                                  ?.copyWith(
                                    color: scheme.secondary,
                                    fontWeight: FontWeight.w900,
                                  ),
                            ),
                            Text('d$_sides: $_rawResult ${_modifierLabel()}'),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      FilledButton.icon(
                        onPressed: _rolling ? null : _roll,
                        icon: const Icon(Icons.casino_outlined),
                        label: Text(_rolling ? 'Rolando...' : 'Rolar d$_sides'),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Histórico local',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  IconButton(
                    tooltip: 'Limpar histórico',
                    onPressed: _history.isEmpty ? null : _clearHistory,
                    icon: const Icon(Icons.delete_outline),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              if (_history.isEmpty)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Text(
                      'Nenhuma rolagem salva ainda.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                )
              else
                ..._history.map(
                  (entry) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Card(
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: scheme.primaryContainer,
                          child: Text(
                            '${entry.finalResult}',
                            style: TextStyle(
                              color: scheme.secondary,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                        title: Text(entry.name),
                        subtitle: Text(
                          '${entry.die}: ${entry.raw} ${entry.modifierLabel} · ${_formatDate(entry.createdAt)}',
                        ),
                        trailing: IconButton(
                          tooltip: 'Repetir',
                          icon: const Icon(Icons.refresh),
                          onPressed: _rolling
                              ? null
                              : () {
                                  final sides =
                                      int.tryParse(
                                        entry.die.replaceFirst('d', ''),
                                      ) ??
                                      20;
                                  setState(() {
                                    _sides = sides;
                                    _label.text = entry.name;
                                    _modifier.text = '${entry.modifier}';
                                  });
                                  _roll();
                                },
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  String _modifierLabel() {
    final value = int.tryParse(_modifier.text.trim()) ?? 0;
    if (value == 0) return '+ 0';
    return value > 0 ? '+ $value' : '- ${value.abs()}';
  }

  String _formatDate(DateTime date) {
    final local = date.toLocal();
    String two(int value) => value.toString().padLeft(2, '0');
    return '${two(local.day)}/${two(local.month)} ${two(local.hour)}:${two(local.minute)}';
  }
}

class _DiceHistoryEntry {
  const _DiceHistoryEntry({
    required this.name,
    required this.die,
    required this.raw,
    required this.modifier,
    required this.finalResult,
    required this.createdAt,
  });

  final String name;
  final String die;
  final int raw;
  final int modifier;
  final int finalResult;
  final DateTime createdAt;

  String get modifierLabel {
    if (modifier == 0) return '+ 0';
    return modifier > 0 ? '+ $modifier' : '- ${modifier.abs()}';
  }

  Map<String, dynamic> toJson() => {
    'name': name,
    'die': die,
    'raw': raw,
    'modifier': modifier,
    'finalResult': finalResult,
    'createdAt': createdAt.toIso8601String(),
  };

  factory _DiceHistoryEntry.fromJson(Map<String, dynamic> json) =>
      _DiceHistoryEntry(
        name: json['name']?.toString() ?? 'Rolagem',
        die: json['die']?.toString() ?? 'd20',
        raw: (json['raw'] as num?)?.toInt() ?? 0,
        modifier: (json['modifier'] as num?)?.toInt() ?? 0,
        finalResult: (json['finalResult'] as num?)?.toInt() ?? 0,
        createdAt:
            DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
            DateTime.now(),
      );
}
