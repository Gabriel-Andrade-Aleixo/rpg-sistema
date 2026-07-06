import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';

import '../../domain/services/dice_roller_service.dart';
import '../../models/character_records.dart';
import 'animated_dice.dart';

class DiceResultModal extends StatefulWidget {
  const DiceResultModal({
    super.key,
    required this.characterId,
    required this.type,
    required this.name,
    required this.sides,
    this.modifiers = const [],
    this.penalties = 0,
  });

  final String characterId;
  final String type;
  final String name;
  final int sides;
  final List<Modifier> modifiers;
  final int penalties;

  static Future<DiceRollRecord?> show(
    BuildContext context, {
    required String characterId,
    required String type,
    required String name,
    required int sides,
    List<Modifier> modifiers = const [],
    int penalties = 0,
  }) => showDialog<DiceRollRecord>(
    context: context,
    barrierDismissible: false,
    builder: (_) => DiceResultModal(
      characterId: characterId,
      type: type,
      name: name,
      sides: sides,
      modifiers: modifiers,
      penalties: penalties,
    ),
  );

  @override
  State<DiceResultModal> createState() => _DiceResultModalState();
}

class _DiceResultModalState extends State<DiceResultModal> {
  final _random = Random();
  final _service = DiceRollerService();
  DiceRollRecord? _record;
  int _display = 1;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(milliseconds: 70), (_) {
      if (mounted) setState(() => _display = _random.nextInt(widget.sides) + 1);
    });
    Future<void>.delayed(const Duration(milliseconds: 950), _finish);
  }

  void _finish() {
    if (!mounted) return;
    _timer?.cancel();
    final result = _service.roll(
      characterId: widget.characterId,
      type: widget.type,
      name: widget.name,
      sides: widget.sides,
      modifiers: widget.modifiers,
      penalties: widget.penalties,
    );
    setState(() {
      _record = result;
      _display = result.rawResult;
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(widget.name),
    content: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AnimatedDice(
          sides: widget.sides,
          rolling: _record == null,
          result: _display,
        ),
        const SizedBox(height: 18),
        if (_record == null)
          const Text('Rolando...')
        else ...[
          Text(
            'Resultado final: ${_record!.finalResult}',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 6),
          Text(
            '${_record!.die}: ${_record!.rawResult}  |  ${_record!.formula}',
          ),
        ],
      ],
    ),
    actions: [
      FilledButton(
        onPressed: _record == null
            ? null
            : () => Navigator.pop(context, _record),
        child: const Text('Concluir'),
      ),
    ],
  );
}
