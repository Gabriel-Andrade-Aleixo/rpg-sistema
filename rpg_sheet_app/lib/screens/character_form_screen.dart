import 'package:flutter/material.dart';

import '../domain/calculators/attribute_calculator.dart';
import '../domain/calculators/official_formula_calculator.dart';
import '../domain/services/character_recalculation_service.dart';
import '../domain/validators/rule_validation_service.dart';
import '../models/catalog_models.dart';
import '../models/character.dart';
import '../models/character_records.dart';
import '../models/official_rule_models.dart';
import '../models/rpg_rule_models.dart';
import '../repositories/character_repository.dart';
import '../services/trello_parser_service.dart';
import '../utils/id_generator.dart';
import '../presentation/widgets/rpg_image.dart';
import '../presentation/widgets/stat_breakdown_card.dart';

class CharacterFormScreen extends StatefulWidget {
  const CharacterFormScreen({
    super.key,
    required this.repository,
    required this.catalog,
    this.existingCharacter,
  });

  final CharacterRepository repository;
  final OfficialCatalog catalog;
  final Character? existingCharacter;

  @override
  State<CharacterFormScreen> createState() => _CharacterFormScreenState();
}

class _CharacterFormScreenState extends State<CharacterFormScreen> {
  static const _parser = TrelloParserService();
  static const _attributeCalculator = AttributeCalculator();
  static const _formulaCalculator = OfficialFormulaCalculator();
  static const _validator = RuleValidationService();
  final _recalculation = CharacterRecalculationService();
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _player = TextEditingController();
  final _imageUrl = TextEditingController();
  final _background = TextEditingController();
  final _lore = TextEditingController();
  final _notes = TextEditingController();
  final _initialHealthRoll = TextEditingController();
  late Character _character;
  int _step = 0;
  bool _saving = false;

  OfficialRace? get _race {
    final entry = widget.catalog.findById(_character.raceId);
    return entry == null
        ? null
        : _parser.parseRace(entry, _character.raceVariant);
  }

  OfficialCharacterClass? get _characterClass {
    final entry = widget.catalog.findById(_character.classId);
    return entry == null ? null : _parser.parseClass(entry);
  }

  @override
  void initState() {
    super.initState();
    _character =
        widget.existingCharacter ??
        Character(
          id: newId('char'),
          name: '',
          playerName: '',
          raceId: '',
          classId: '',
        );
    _name.text = _character.name;
    _player.text = _character.playerName;
    _imageUrl.text = _character.imageUrl;
    _background.text = _character.background;
    _lore.text = _character.lore;
    _notes.text = _character.notes.join('\n');
    _character = _recalculation.recalculate(_character, widget.catalog);
  }

  @override
  void dispose() {
    _name.dispose();
    _player.dispose();
    _imageUrl.dispose();
    _background.dispose();
    _lore.dispose();
    _notes.dispose();
    _initialHealthRoll.dispose();
    super.dispose();
  }

  void _update(Character Function(Character current) change) {
    setState(() {
      _character = _recalculation.recalculate(
        change(_character),
        widget.catalog,
      );
    });
  }

  Future<void> _save() async {
    if (_saving || !_formKey.currentState!.validate()) return;
    var updated = _character.copyWith(
      name: _name.text.trim(),
      playerName: _player.text.trim(),
      imageUrl: _imageUrl.text.trim(),
      background: _background.text.trim(),
      lore: _lore.text.trim(),
      notes: _notes.text
          .split('\n')
          .map((line) => line.trim())
          .where((line) => line.isNotEmpty)
          .toList(),
    );
    updated = _recalculation.recalculate(updated, widget.catalog);
    final validation = _validator.validate(updated, widget.catalog);
    if (!validation.isValid) {
      setState(() => _step = 10);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(validation.errors.join('\n'))));
      return;
    }
    setState(() => _saving = true);
    try {
      final persisted = await widget.repository.saveCharacter(updated);
      if (persisted.id != updated.id) {
        throw StateError('O backend confirmou uma ficha diferente da enviada.');
      }
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Não foi possível salvar: $error')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(
        widget.existingCharacter == null
            ? 'Criar personagem'
            : 'Editar personagem',
      ),
      actions: [
        IconButton(
          tooltip: 'Salvar',
          onPressed: _saving ? null : _save,
          icon: const Icon(Icons.save_outlined),
        ),
      ],
    ),
    body: Form(
      key: _formKey,
      child: Stepper(
        currentStep: _step,
        onStepTapped: (value) => setState(() => _step = value),
        onStepContinue: _step == 10 ? _save : () => setState(() => _step++),
        onStepCancel: _step == 0 ? null : () => setState(() => _step--),
        controlsBuilder: (context, details) => Padding(
          padding: const EdgeInsets.only(top: 16),
          child: Row(
            children: [
              FilledButton(
                onPressed: details.onStepContinue,
                child: Text(_step == 10 ? 'Salvar ficha' : 'Continuar'),
              ),
              if (_step > 0)
                TextButton(
                  onPressed: details.onStepCancel,
                  child: const Text('Voltar'),
                ),
            ],
          ),
        ),
        steps: [
          Step(
            title: const Text('Dados básicos'),
            content: _basicStep(),
            isActive: _step >= 0,
          ),
          Step(
            title: const Text('Imagem'),
            content: _imageStep(),
            isActive: _step >= 1,
          ),
          Step(
            title: const Text('Raça'),
            content: _raceStep(),
            isActive: _step >= 2,
          ),
          Step(
            title: const Text('Classe'),
            content: _classStep(),
            isActive: _step >= 3,
          ),
          Step(
            title: const Text('Atributos'),
            content: _attributeStep(),
            isActive: _step >= 4,
          ),
          Step(
            title: const Text('Proficiências'),
            content: _proficiencyStep(),
            isActive: _step >= 5,
          ),
          Step(
            title: const Text('Vida inicial'),
            content: _healthStep(),
            isActive: _step >= 6,
          ),
          Step(
            title: const Text('Equipamentos'),
            content: _equipmentStep(),
            isActive: _step >= 7,
          ),
          Step(
            title: const Text('Habilidades'),
            content: _abilityStep(),
            isActive: _step >= 8,
          ),
          Step(
            title: const Text('História'),
            content: _storyStep(),
            isActive: _step >= 9,
          ),
          Step(
            title: const Text('Revisão'),
            content: _reviewStep(),
            isActive: _step >= 10,
          ),
        ],
      ),
    ),
  );

  Widget _basicStep() => Column(
    children: [
      TextFormField(
        controller: _name,
        decoration: const InputDecoration(labelText: 'Nome do personagem'),
        validator: (value) =>
            value == null || value.trim().isEmpty ? 'Informe o nome.' : null,
      ),
      const SizedBox(height: 12),
      TextFormField(
        controller: _player,
        decoration: const InputDecoration(labelText: 'Nome do jogador'),
      ),
    ],
  );

  Widget _imageStep() => Column(
    children: [
      ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: RpgImage(
          url: _imageUrl.text,
          width: double.infinity,
          height: 190,
          icon: Icons.person_outline,
        ),
      ),
      const SizedBox(height: 12),
      TextFormField(
        controller: _imageUrl,
        decoration: const InputDecoration(
          labelText: 'URL do avatar',
          prefixIcon: Icon(Icons.image_outlined),
        ),
        onChanged: (_) => setState(() {}),
      ),
    ],
  );

  Widget _raceStep() {
    final races = widget.catalog.playableRaces;
    if (races.isEmpty) {
      return _missing(
        'Nenhuma raça com regras completas foi encontrada no Trello.',
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DropdownButtonFormField<String>(
          initialValue: races.any((item) => item.id == _character.raceId)
              ? _character.raceId
              : null,
          decoration: const InputDecoration(labelText: 'Raça oficial'),
          items: [
            for (final race in races)
              DropdownMenuItem(value: race.id, child: Text(race.name)),
          ],
          onChanged: (value) => _update(
            (character) =>
                character.copyWith(raceId: value ?? '', raceVariant: ''),
          ),
        ),
        if (_race case final race?) ...[
          const SizedBox(height: 12),
          if (race.variants.isNotEmpty) ...[
            DropdownButtonFormField<String>(
              initialValue: race.selectedVariant?.id,
              decoration: const InputDecoration(labelText: 'Variante racial'),
              items: [
                for (final variant in race.variants)
                  DropdownMenuItem(
                    value: variant.id,
                    child: Text(variant.name),
                  ),
              ],
              onChanged: (value) => _update(
                (character) => character.copyWith(raceVariant: value ?? ''),
              ),
            ),
            const SizedBox(height: 12),
          ],
          Text(
            race.entry.displayDescription,
            maxLines: 10,
            overflow: TextOverflow.fade,
          ),
          for (final modifier in race.modifiers)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.add_circle_outline),
              title: Text('${modifier.targetId}: +${modifier.value}'),
              subtitle: Text('Origem: ${modifier.sourceName}'),
            ),
          for (final trait in race.traits)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.auto_awesome_outlined),
              title: Text(trait),
            ),
        ],
      ],
    );
  }

  Widget _classStep() {
    final classes = widget.catalog.playableClasses;
    if (classes.isEmpty) {
      return _missing(
        'Nenhuma classe com regras completas foi encontrada no Trello.',
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DropdownButtonFormField<String>(
          initialValue: classes.any((item) => item.id == _character.classId)
              ? _character.classId
              : null,
          decoration: const InputDecoration(labelText: 'Classe oficial'),
          items: [
            for (final item in classes)
              DropdownMenuItem(value: item.id, child: Text(item.name)),
          ],
          onChanged: (value) => _update(
            (character) => character.copyWith(
              classId: value ?? '',
              maxHp: 0,
              currentHp: 0,
              levelHistory: [],
            ),
          ),
        ),
        if (_characterClass case final item?) ...[
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              Chip(
                label: Text(
                  item.hitDie == null
                      ? 'Dado de vida não informado'
                      : 'd${item.hitDie}',
                ),
              ),
              Chip(
                label: Text(
                  item.baseHp == null
                      ? 'Vida base não informada'
                      : 'Vida base ${item.baseHp}',
                ),
              ),
              Chip(
                label: Text(
                  'Pontos de habilidade: ${item.skillPointsPerLevel?.toString() ?? 'não informado'}',
                ),
              ),
              Chip(
                label: Text(
                  'Pontos de classe: ${item.classPointsPerLevel?.toString() ?? 'não informado'}',
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            item.entry.displayDescription,
            maxLines: 14,
            overflow: TextOverflow.fade,
          ),
          for (final progression in item.attributeProgression)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.trending_up),
              title: Text(
                'Níveis ${progression.from}-${progression.to}: ${progression.perLevel.entries.map((entry) => '+${entry.value} ${entry.key}').join(', ')} por nível',
              ),
            ),
        ],
      ],
    );
  }

  Widget _attributeStep() {
    final spent = _character.attributes.values.fold<int>(
      0,
      (sum, value) => sum + value,
    );
    return Column(
      children: [
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Pontos distribuídos'),
          trailing: Text('$spent/10'),
        ),
        for (final attribute in AttributeId.values) ...[
          Row(
            children: [
              Expanded(child: Text(attribute.label)),
              IconButton(
                tooltip: 'Diminuir',
                onPressed: (_character.attributes[attribute] ?? 0) <= 0
                    ? null
                    : () => _setAttribute(attribute, -1),
                icon: const Icon(Icons.remove_circle_outline),
              ),
              SizedBox(
                width: 36,
                child: Text(
                  '${_character.attributes[attribute] ?? 0}',
                  textAlign: TextAlign.center,
                ),
              ),
              IconButton(
                tooltip: 'Aumentar',
                onPressed:
                    spent >= 10 || (_character.attributes[attribute] ?? 0) >= 20
                    ? null
                    : () => _setAttribute(attribute, 1),
                icon: const Icon(Icons.add_circle_outline),
              ),
            ],
          ),
          StatBreakdownCard(
            label: '${attribute.label} final',
            base: _character.attributes[attribute] ?? 0,
            total: _attributeCalculator
                .calculate(_character, attribute, _character.modifiers)
                .total,
            modifiers: _attributeCalculator
                .calculate(_character, attribute, _character.modifiers)
                .modifiers,
          ),
        ],
      ],
    );
  }

  Widget _proficiencyStep() {
    final automatic = {
      ...?_race?.proficiencies,
      ...?_characterClass?.proficiencies,
    };
    final skills = widget.catalog.skills;
    if (skills.isEmpty) {
      return _missing('Nenhuma perícia oficial foi encontrada no Trello.');
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Uma perícia proficiente adiciona novamente seu valor bruto à rolagem.',
        ),
        const SizedBox(height: 10),
        for (final skill in skills)
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(skill.name),
            subtitle: Text(
              automatic.any(
                    (item) =>
                        normalizeCatalogText(item) == skill.normalizedName,
                  )
                  ? 'Concedida automaticamente pela raça ou classe'
                  : 'Proficiência escolhida',
            ),
            value:
                automatic.any(
                  (item) => normalizeCatalogText(item) == skill.normalizedName,
                ) ||
                _character.manualProficiencies.any(
                  (item) => normalizeCatalogText(item) == skill.normalizedName,
                ),
            onChanged:
                automatic.any(
                  (item) => normalizeCatalogText(item) == skill.normalizedName,
                )
                ? null
                : (selected) => _update((character) {
                    final values =
                        List<String>.of(character.manualProficiencies)
                          ..removeWhere(
                            (item) =>
                                normalizeCatalogText(item) ==
                                skill.normalizedName,
                          );
                    if (selected == true) values.add(skill.name);
                    return character.copyWith(manualProficiencies: values);
                  }),
          ),
      ],
    );
  }

  Widget _healthStep() {
    final item = _characterClass;
    if (item == null) {
      return _missing('Selecione uma classe antes de definir a vida.');
    }
    final initialHp = _formulaCalculator.evaluate(
      item.hpInitialFormula,
      _character,
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'HP inicial calculado: ${item.hpInitialFormula == null ? 'indisponível' : initialHp}',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 12),
        const Text(
          'A vida do nível 1 já inclui o ganho do método escolhido. Rolagem e híbrido exigem o resultado bruto do dado agora e a cada novo nível.',
        ),
        const SizedBox(height: 12),
        SegmentedButton<HpProgressionMode>(
          segments: [
            ButtonSegment(
              value: HpProgressionMode.fixed,
              label: const Text('Fixo'),
              icon: const Icon(Icons.favorite_outline),
              enabled: item.hpFixedFormula != null,
            ),
            ButtonSegment(
              value: HpProgressionMode.roll,
              label: Text('d${item.hitDie ?? '?'}'),
              icon: const Icon(Icons.casino_outlined),
              enabled: item.hpRollFormula != null,
            ),
            ButtonSegment(
              value: HpProgressionMode.hybrid,
              label: Text('Híbrido d${item.hybridDie ?? '?'}'),
              icon: const Icon(Icons.join_inner),
              enabled: item.hpHybridFormula != null,
            ),
          ],
          selected: {_character.hpProgressionMode},
          onSelectionChanged: item.hpInitialFormula == null
              ? null
              : (selection) {
                  _initialHealthRoll.clear();
                  _update(
                    (character) => character.copyWith(
                      hpProgressionMode: selection.first,
                      maxHp: 0,
                      currentHp: 0,
                      levelHistory: character.levelHistory
                          .where((entry) => entry.level != 1)
                          .toList(),
                    ),
                  );
                },
        ),
        if (_character.hpProgressionMode != HpProgressionMode.fixed) ...[
          const SizedBox(height: 12),
          TextField(
            controller: _initialHealthRoll,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              labelText: 'Resultado bruto do dado no nível 1',
              helperText:
                  'Digite um valor de 1 a ${_character.hpProgressionMode == HpProgressionMode.hybrid ? item.hybridDie : item.hitDie}.',
            ),
            onChanged: (_) => setState(() {}),
          ),
        ],
        const SizedBox(height: 10),
        FilledButton.icon(
          onPressed: item.hpInitialFormula == null
              ? null
              : () => _defineInitialHealth(item, _character.hpProgressionMode),
          icon: const Icon(Icons.check),
          label: const Text('Confirmar método e calcular HP'),
        ),
        const SizedBox(height: 8),
        Text('Vida registrada: ${_character.currentHp}/${_character.maxHp}'),
        if (item.hpInitialFormula == null)
          _missing(
            'A classe não possui fórmula estruturada de HP inicial. Ajuste o bloco RPG_RULES_JSON no cartão.',
          ),
      ],
    );
  }

  Widget _equipmentStep() {
    final items = widget.catalog.items;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (items.isEmpty)
          _missing('Nenhum item ou equipamento foi encontrado no Trello.'),
        for (final item in items)
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(item.name),
            subtitle: Text(item.category),
            value: _character.equipment.any(
              (selected) => selected.catalogId == item.id,
            ),
            onChanged: (selected) => _toggleEquipment(item, selected ?? false),
          ),
      ],
    );
  }

  Widget _abilityStep() {
    final values = [
      ...?_race?.abilities,
      ...?_characterClass?.unlocks
          .where((item) => item.level <= 1)
          .map((item) => item.name),
    ];
    return values.isEmpty
        ? _missing('Nenhuma habilidade inicial foi identificada no Trello.')
        : Column(
            children: [
              for (final item in values)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.bolt_outlined),
                  title: Text(item),
                ),
            ],
          );
  }

  Widget _storyStep() => Column(
    children: [
      TextFormField(
        controller: _background,
        decoration: const InputDecoration(labelText: 'Antecedente / origem'),
      ),
      const SizedBox(height: 12),
      TextFormField(
        controller: _lore,
        decoration: const InputDecoration(labelText: 'História'),
        minLines: 4,
        maxLines: 8,
      ),
      const SizedBox(height: 12),
      TextFormField(
        controller: _notes,
        decoration: const InputDecoration(labelText: 'Anotações'),
        minLines: 3,
        maxLines: 6,
      ),
    ],
  );

  Widget _reviewStep() {
    final validation = _validator.validate(
      _character.copyWith(name: _name.text.trim()),
      widget.catalog,
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          _name.text.isEmpty ? 'Personagem sem nome' : _name.text,
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        Text('Raça: ${_race?.entry.name ?? 'não selecionada'}'),
        Text('Classe: ${_characterClass?.entry.name ?? 'não selecionada'}'),
        Text('Vida: ${_character.currentHp}/${_character.maxHp}'),
        Text('Equipamentos: ${_character.equipment.length}'),
        const SizedBox(height: 12),
        for (final error in validation.errors)
          _message(
            error,
            Icons.error_outline,
            Theme.of(context).colorScheme.error,
          ),
        for (final warning in validation.warnings)
          _message(warning, Icons.warning_amber, Colors.orange),
        for (final suggestion in validation.suggestions)
          _message(
            suggestion,
            Icons.lightbulb_outline,
            Theme.of(context).colorScheme.primary,
          ),
      ],
    );
  }

  Widget _message(String value, IconData icon, Color color) => ListTile(
    contentPadding: EdgeInsets.zero,
    leading: Icon(icon, color: color),
    title: Text(value),
  );
  Widget _missing(String text) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 12),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(Icons.info_outline),
        const SizedBox(width: 10),
        Expanded(child: Text(text)),
      ],
    ),
  );

  void _setAttribute(AttributeId attribute, int delta) => _update((character) {
    final attributes = Map<AttributeId, int>.of(character.attributes);
    attributes[attribute] = ((attributes[attribute] ?? 0) + delta).clamp(0, 99);
    return character.copyWith(attributes: attributes);
  });

  void _defineInitialHealth(
    OfficialCharacterClass item,
    HpProgressionMode mode,
  ) {
    final initial = _formulaCalculator.evaluate(
      item.hpInitialFormula,
      _character,
    );
    final formula = switch (mode) {
      HpProgressionMode.fixed => item.hpFixedFormula,
      HpProgressionMode.roll => item.hpRollFormula,
      HpProgressionMode.hybrid => item.hpHybridFormula,
    };
    final progression = _formulaCalculator.evaluate(formula, _character);
    final die = mode == HpProgressionMode.hybrid ? item.hybridDie : item.hitDie;
    final raw = int.tryParse(_initialHealthRoll.text);
    if (mode != HpProgressionMode.fixed &&
        (raw == null || raw < 1 || raw > (die ?? 0))) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Digite um resultado válido entre 1 e ${die ?? 0}.'),
        ),
      );
      return;
    }
    final value =
        initial + progression + (mode == HpProgressionMode.fixed ? 0 : raw!);
    final history = LevelHistory(
      level: 1,
      hpMethod: mode.name,
      die: mode == HpProgressionMode.fixed ? '' : 'd$die',
      rollResult: mode == HpProgressionMode.fixed ? null : raw,
      hpAdded: value,
      modifiers: initial + progression,
      createdAt: DateTime.now(),
    );
    _update(
      (character) => character.copyWith(
        maxHp: value,
        currentHp: value,
        hpProgressionMode: mode,
        levelHistory: [
          history,
          ...character.levelHistory.where((entry) => entry.level != 1),
        ],
      ),
    );
  }

  void _toggleEquipment(CatalogEntry entry, bool selected) =>
      _update((character) {
        final items = List<InventoryItem>.of(character.equipment)
          ..removeWhere((item) => item.catalogId == entry.id);
        if (selected) {
          items.add(
            InventoryItem(
              id: newId('item'),
              catalogId: entry.id,
              name: entry.name,
              type: entry.category,
              imageUrl: entry.imageUrl,
            ),
          );
        }
        return character.copyWith(equipment: items);
      });
}
