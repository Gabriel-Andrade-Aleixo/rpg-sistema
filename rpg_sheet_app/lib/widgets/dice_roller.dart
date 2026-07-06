import 'dart:math';

import 'package:flutter/material.dart';

import '../presentation/widgets/animated_dice.dart';

class DiceRoller extends StatefulWidget {
  const DiceRoller({super.key});

  @override
  State<DiceRoller> createState() => _DiceRollerState();
}

class _DiceRollerState extends State<DiceRoller> {
  static const _dice = [4, 6, 8, 10, 12, 20, 100];
  final _random = Random();
  final List<String> _history = [];
  int _sides = 20;
  int _result = 20;
  bool _rolling = false;

  Future<void> _roll() async {
    if (_rolling) return;
    setState(() => _rolling = true);
    for (var i = 0; i < 14; i++) {
      await Future<void>.delayed(const Duration(milliseconds: 55));
      if (!mounted) return;
      setState(() => _result = _random.nextInt(_sides) + 1);
    }
    final finalResult = _random.nextInt(_sides) + 1;
    setState(() {
      _result = finalResult;
      _history.insert(0, 'd$_sides: $finalResult');
      if (_history.length > 6) _history.removeLast();
      _rolling = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Rolagem de dados',
            style: Theme.of(context).textTheme.titleLarge,
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
          const SizedBox(height: 20),
          Center(
            child: GestureDetector(
              onTap: _rolling ? null : _roll,
              child: AnimatedDice(
                sides: _sides,
                rolling: _rolling,
                result: _result,
              ),
            ),
          ),
          const SizedBox(height: 18),
          Center(
            child: FilledButton.icon(
              onPressed: _rolling ? null : _roll,
              icon: const Icon(Icons.casino_outlined),
              label: Text(_rolling ? 'Rolando...' : 'Rolar d$_sides'),
            ),
          ),
          if (_history.isNotEmpty) ...[
            const SizedBox(height: 18),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final item in _history)
                  Chip(
                    label: Text(item),
                    side: BorderSide(
                      color: Theme.of(context).colorScheme.outlineVariant,
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
