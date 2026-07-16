import 'package:flutter/material.dart';

import '../../../domain/calculators/level_calculator.dart';
import '../../../domain/calculators/official_formula_calculator.dart';
import '../../../domain/services/character_recalculation_service.dart';
import '../../../domain/services/experience_service.dart';
import '../../../models/catalog_models.dart';
import '../../../models/character.dart';
import '../../../models/character_records.dart';
import '../../../models/official_rule_models.dart';
import '../../../models/rpg_rule_models.dart';

class LevelUpScreen extends StatefulWidget {
  const LevelUpScreen({
    super.key,
    required this.character,
    required this.characterClass,
    required this.catalog,
  });

  final Character character;
  final OfficialCharacterClass characterClass;
  final OfficialCatalog catalog;

  @override
  State<LevelUpScreen> createState() => _LevelUpScreenState();
}

class _LevelUpScreenState extends State<LevelUpScreen> {
  static const _levels = LevelCalculator();
  static const _experience = ExperienceService();
  static const _formulas = OfficialFormulaCalculator();
  final _recalculation = CharacterRecalculationService();
  final _xpGain = TextEditingController(text: '1');
  final _xpNote = TextEditingController(text: 'Participação na sessão +1');
  final _rawRoll = TextEditingController();
  ClassXpBreakdown? _xpBreakdown = ClassXpRules.calculate({'participation': 1});

  @override
  void dispose() {
    _xpGain.dispose();
    _xpNote.dispose();
    _rawRoll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final preview = _levels.preview(
      widget.character.level,
      widget.characterClass,
    );
    final maximumLevel = widget.character.level >= 10;
    final xpCost = _experience.classXpRequired(widget.character.level);
    final xpGain = (int.tryParse(_xpGain.text) ?? 0).clamp(0, 999999);
    final availableXp = widget.character.classXp + xpGain;
    final nextCharacter = _recalculation.recalculate(
      widget.character.copyWith(level: preview.toLevel),
      widget.catalog,
    );
    final method = widget.character.hpProgressionMode;
    final formula = switch (method) {
      HpProgressionMode.fixed => widget.characterClass.hpFixedFormula,
      HpProgressionMode.roll => widget.characterClass.hpRollFormula,
      HpProgressionMode.hybrid => widget.characterClass.hpHybridFormula,
    };
    final die = switch (method) {
      HpProgressionMode.fixed => null,
      HpProgressionMode.roll => widget.characterClass.hitDie,
      HpProgressionMode.hybrid => widget.characterClass.hybridDie,
    };
    final formulaValue = formula == null
        ? null
        : _formulas.evaluate(formula, nextCharacter);
    final raw = int.tryParse(_rawRoll.text);
    final validRoll = die != null && raw != null && raw >= 1 && raw <= die;
    final hp = method == HpProgressionMode.fixed
        ? formulaValue
        : validRoll
        ? (formulaValue ?? 0) + raw
        : null;

    return Scaffold(
      appBar: AppBar(
        title: Text(maximumLevel ? 'XP e Excelência' : 'Subir de nível'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            maximumLevel
                ? 'Nível 10 · Excelência'
                : 'Nível ${preview.fromLevel} → ${preview.toLevel}',
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _xpGain,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'XP de Classe ganho'),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: _calculateSessionXp,
            icon: const Icon(Icons.calculate_outlined),
            label: const Text('Calcular XP por critérios da sessão'),
          ),
          const SizedBox(height: 10),
          TextFormField(
            controller: _xpNote,
            decoration: const InputDecoration(labelText: 'Origem / sessão'),
          ),
          const SizedBox(height: 12),
          _summary(
            maximumLevel ? 'Progresso de Excelência' : 'XP para subir',
            '$availableXp / $xpCost XP',
          ),
          if (!maximumLevel) ...[
            _summary('Método de vida', method.label),
            _summary(
              'Base e modificadores no novo nível',
              formulaValue?.toString() ?? 'não definido no cadastro',
            ),
            if (method != HpProgressionMode.fixed) ...[
              const SizedBox(height: 10),
              TextFormField(
                controller: _rawRoll,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: 'Resultado bruto do d${die ?? '?'}',
                  helperText: 'Digite apenas o valor que caiu no dado.',
                ),
                onChanged: (_) => setState(() {}),
              ),
            ],
            _summary(
              'Vida adicionada',
              hp?.toString() ?? 'informe um resultado válido',
            ),
            _summary(
              'Pontos de habilidade',
              widget.characterClass.skillPointsPerLevel?.toString() ??
                  'não informado no catálogo',
            ),
            _summary(
              'Pontos de classe',
              widget.characterClass.classPointsPerLevel?.toString() ??
                  'não informado no catálogo',
            ),
            _summary(
              'Habilidades',
              preview.unlocks.isEmpty
                  ? 'nenhuma identificada'
                  : preview.unlocks.join(', '),
            ),
          ],
          const SizedBox(height: 18),
          OutlinedButton(
            onPressed: xpGain <= 0 ? null : _registerOnly,
            child: const Text('Apenas registrar XP'),
          ),
          if (!maximumLevel) ...[
            const SizedBox(height: 8),
            FilledButton(
              onPressed: hp == null || availableXp < xpCost
                  ? null
                  : () => _confirm(preview, hp, xpCost, formulaValue ?? 0, raw),
              child: const Text('Consumir XP e subir de nível'),
            ),
          ],
        ],
      ),
    );
  }

  Widget _summary(String label, String value) => Card(
    child: ListTile(title: Text(label), subtitle: Text(value)),
  );

  Character _withRegisteredXp() => _experience.registerClassXp(
    widget.character,
    int.tryParse(_xpGain.text) ?? 0,
    _xpNote.text,
    breakdown: _xpBreakdown?.total == (int.tryParse(_xpGain.text) ?? 0)
        ? _xpBreakdown!.values
        : const {},
  );

  Future<void> _calculateSessionXp() async {
    final values = <String, int>{'participation': 1, ...?_xpBreakdown?.values};
    const criteria = <(String, String, List<int>)>[
      ('participation', 'Participação na sessão', [0, 1]),
      ('combat', 'Combate', [0, 1, 2, 3, 4, 5]),
      ('strategy', 'Ação inteligente ou estratégica', [0, 1]),
      ('creativity', 'Uso criativo de habilidade/classe', [0, 1]),
      ('roleplay', 'Boa interpretação', [0, 1]),
      ('memorableMoment', 'Momento marcante', [0, 1]),
      ('importantProblem', 'Resolver problema importante', [0, 2]),
      ('storyProgress', 'Avanço significativo da narrativa', [0, 2, 3]),
      ('difficultDecision', 'Decisão difícil com impacto', [0, 1, 2]),
      ('sessionObjective', 'Objetivo da sessão', [0, 2]),
      ('personalObjective', 'Objetivo pessoal', [0, 1, 2]),
      ('highlight', 'Destaque da sessão', [0, 1]),
    ];
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) {
          final breakdown = ClassXpRules.calculate(values);
          return AlertDialog(
            title: Text('XP da sessão · ${breakdown.total} XP'),
            content: SizedBox(
              width: 520,
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: criteria.length,
                separatorBuilder: (_, _) => const SizedBox(height: 10),
                itemBuilder: (context, index) {
                  final criterion = criteria[index];
                  return DropdownButtonFormField<int>(
                    initialValue: values[criterion.$1] ?? 0,
                    decoration: InputDecoration(labelText: criterion.$2),
                    items: [
                      for (final value in criterion.$3)
                        DropdownMenuItem(
                          value: value,
                          child: Text(
                            value == 0 ? 'Não conceder' : '+$value XP',
                          ),
                        ),
                    ],
                    onChanged: (value) =>
                        setDialogState(() => values[criterion.$1] = value ?? 0),
                  );
                },
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancelar'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Usar total'),
              ),
            ],
          );
        },
      ),
    );
    if (confirmed != true) return;
    final breakdown = ClassXpRules.calculate(values);
    setState(() {
      _xpBreakdown = breakdown;
      _xpGain.text = '${breakdown.total}';
      _xpNote.text = breakdown.summary.isEmpty ? 'Sessão' : breakdown.summary;
    });
  }

  void _registerOnly() => Navigator.pop(context, _withRegisteredXp());

  void _confirm(
    LevelUpPreview preview,
    int hp,
    int xpCost,
    int formulaValue,
    int? raw,
  ) {
    final withXp = _withRegisteredXp();
    final method = widget.character.hpProgressionMode;
    final die = method == HpProgressionMode.roll
        ? widget.characterClass.hitDie
        : method == HpProgressionMode.hybrid
        ? widget.characterClass.hybridDie
        : null;
    final history = LevelHistory(
      level: preview.toLevel,
      hpMethod: method.name,
      die: die == null ? '' : 'd$die',
      rollResult: method == HpProgressionMode.fixed ? null : raw,
      modifiers: formulaValue,
      hpAdded: hp,
      skillPoints: preview.skillPoints,
      classPoints: preview.classPoints,
      abilities: preview.unlocks,
      proficiencies: preview.proficiencies,
      xpSpent: xpCost,
      createdAt: DateTime.now(),
    );
    Navigator.pop(
      context,
      withXp.copyWith(
        classXp: withXp.classXp - xpCost,
        level: preview.toLevel,
        maxHp: withXp.maxHp + hp,
        currentHp: withXp.currentHp + hp,
        skillPoints: withXp.skillPoints + preview.skillPoints,
        classPoints: withXp.classPoints + preview.classPoints,
        levelHistory: [history, ...withXp.levelHistory],
      ),
    );
  }
}
