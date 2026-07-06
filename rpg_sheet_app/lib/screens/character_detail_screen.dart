import 'dart:convert';

import 'package:flutter/material.dart';

import '../domain/calculators/attribute_calculator.dart';
import '../domain/calculators/combat_calculator.dart';
import '../domain/calculators/skill_calculator.dart';
import '../domain/services/character_export_service.dart';
import '../domain/services/class_action_service.dart';
import '../domain/services/character_recalculation_service.dart';
import '../domain/services/death_save_service.dart';
import '../domain/services/experience_service.dart';
import '../domain/services/humanity_service.dart';
import '../models/catalog_models.dart';
import '../models/character.dart';
import '../models/character_records.dart';
import '../models/rpg_rule_models.dart';
import '../repositories/character_repository.dart';
import '../services/trello_parser_service.dart';
import '../utils/id_generator.dart';
import '../presentation/screens/level_up/level_up_screen.dart';
import '../presentation/screens/inventory/inventory_management_screen.dart';
import '../presentation/widgets/dice_result_modal.dart';
import '../presentation/widgets/roll_history_list.dart';
import '../presentation/widgets/rpg_image.dart';
import '../presentation/widgets/stat_breakdown_card.dart';
import '../widgets/section_card.dart';

class CharacterDetailScreen extends StatefulWidget {
  const CharacterDetailScreen({
    super.key,
    required this.character,
    required this.repository,
    required this.catalog,
    this.onEdit,
  });

  final Character character;
  final CharacterRepository repository;
  final OfficialCatalog catalog;
  final VoidCallback? onEdit;

  @override
  State<CharacterDetailScreen> createState() => _CharacterDetailScreenState();
}

class _CharacterDetailScreenState extends State<CharacterDetailScreen> {
  static const _attributes = AttributeCalculator();
  static const _skills = SkillCalculator();
  static const _combat = CombatCalculator();
  static const _experience = ExperienceService();
  static const _humanity = HumanityService();
  static const _deathSaves = DeathSaveService();
  static const _classActions = ClassActionService();
  static const _parser = TrelloParserService();
  static const _export = CharacterExportService();
  final _recalculation = CharacterRecalculationService();
  late Character _character;
  int _tabIndex = 0;

  CatalogEntry? get _race => widget.catalog.findById(_character.raceId);
  CatalogEntry? get _class => widget.catalog.findById(_character.classId);

  @override
  void initState() {
    super.initState();
    _character = _recalculation.recalculate(widget.character, widget.catalog);
  }

  Future<void> _persist(Character next) async {
    final compact = next.copyWith(
      rollHistory: next.rollHistory.take(20).toList(),
      experienceHistory: next.experienceHistory.take(20).toList(),
      classXpHistory: next.classXpHistory.take(20).toList(),
      humanityHistory: next.humanityHistory.take(20).toList(),
    );
    final recalculated = _recalculation.recalculate(compact, widget.catalog);
    setState(() => _character = recalculated);
    await widget.repository.saveCharacter(recalculated);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Ficha de personagem'),
      actions: [
        IconButton(
          tooltip: 'Exportar ficha',
          onPressed: _showExport,
          icon: const Icon(Icons.ios_share_outlined),
        ),
        IconButton(
          tooltip: 'Editar',
          onPressed: widget.onEdit,
          icon: const Icon(Icons.edit_outlined),
        ),
      ],
    ),
    body: _tabBody(),
    bottomNavigationBar: NavigationBar(
      selectedIndex: _tabIndex,
      labelBehavior: NavigationDestinationLabelBehavior.onlyShowSelected,
      onDestinationSelected: (value) => setState(() => _tabIndex = value),
      destinations: const [
        NavigationDestination(
          icon: Icon(Icons.dashboard_outlined),
          selectedIcon: Icon(Icons.dashboard),
          label: 'Resumo',
        ),
        NavigationDestination(
          icon: Icon(Icons.sports_martial_arts_outlined),
          selectedIcon: Icon(Icons.sports_martial_arts),
          label: 'Combate',
        ),
        NavigationDestination(
          icon: Icon(Icons.auto_awesome_outlined),
          selectedIcon: Icon(Icons.auto_awesome),
          label: 'Magias',
        ),
        NavigationDestination(
          icon: Icon(Icons.trending_up_outlined),
          selectedIcon: Icon(Icons.trending_up),
          label: 'Evolução',
        ),
        NavigationDestination(
          icon: Icon(Icons.backpack_outlined),
          selectedIcon: Icon(Icons.backpack),
          label: 'Itens',
        ),
        NavigationDestination(
          icon: Icon(Icons.menu_book_outlined),
          selectedIcon: Icon(Icons.menu_book),
          label: 'História',
        ),
      ],
    ),
  );

  Widget _tabBody() {
    final sections = switch (_tabIndex) {
      0 => <Widget>[
        _resources(),
        SectionCard(title: 'Humanidade e Divindade', child: _humanitySection()),
        SectionCard(
          title: 'Defesa e Classe de Armadura',
          child: _defenseSection(),
        ),
      ],
      1 => <Widget>[
        if (normalizeCatalogText(_class?.name ?? '') == 'arqueiro espectral')
          SectionCard(title: 'Flechas mágicas', child: _infusionSection()),
        SectionCard(title: 'Atributos', child: _attributeSection()),
        SectionCard(
          title: 'Proficiências e perícias',
          child: _proficiencySection(),
        ),
        SectionCard(title: 'Combate e rolagens', child: _combatSection()),
        SectionCard(
          title: 'Rolagens recentes',
          child: RollHistoryList(
            records: _character.rollHistory,
            onClear: () => _persist(_character.copyWith(rollHistory: [])),
          ),
        ),
      ],
      2 => <Widget>[
        SectionCard(
          title: 'Grimório do personagem',
          child: _spellbookSection(),
        ),
      ],
      3 => <Widget>[
        SectionCard(title: 'Experiência', child: _experienceSection()),
        SectionCard(
          title: 'Habilidades',
          child: _stringList(
            _character.abilities,
            'Nenhuma habilidade identificada no catálogo.',
          ),
        ),
        SectionCard(title: 'Histórico de evolução', child: _levelHistory()),
      ],
      4 => <Widget>[
        SectionCard(
          title: 'Equipamentos',
          trailing: IconButton(
            tooltip: 'Gerenciar inventário',
            onPressed: _openInventory,
            icon: const Icon(Icons.inventory_2_outlined),
          ),
          child: _itemList(_character.equipment),
        ),
        SectionCard(
          title: 'Inventário',
          child: _itemList(_character.inventory),
        ),
      ],
      _ => <Widget>[
        SectionCard(
          title: 'Personagem',
          child: Text(
            [
              if (_character.background.isNotEmpty)
                'Antecedente: ${_character.background}',
              _character.lore.isEmpty
                  ? 'Sem história cadastrada.'
                  : _character.lore,
            ].join('\n\n'),
          ),
        ),
        SectionCard(
          title: _race?.name ?? 'Raça',
          child: Text(
            _race?.displayDescription.isNotEmpty == true
                ? _race!.displayDescription
                : 'Descrição da raça indisponível.',
          ),
        ),
        SectionCard(
          title: _class?.name ?? 'Classe',
          child: Text(
            _class?.displayDescription.isNotEmpty == true
                ? _class!.displayDescription
                : 'Descrição da classe indisponível.',
          ),
        ),
        SectionCard(
          title: 'Anotações',
          child: Text(
            _character.notes.isEmpty
                ? 'Sem anotações.'
                : _character.notes.join('\n'),
          ),
        ),
      ],
    };
    return ListView(
      key: PageStorageKey('character_tab_$_tabIndex'),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [_header(), const SizedBox(height: 12), ...sections],
    );
  }

  Widget _header() => Card(
    clipBehavior: Clip.antiAlias,
    child: Padding(
      padding: const EdgeInsets.all(14),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final compact = constraints.maxWidth < 520;
          final identity = Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(7),
                child: RpgImage(
                  url: _character.imageUrl,
                  width: compact ? 76 : 92,
                  height: compact ? 76 : 92,
                  icon: Icons.person_outline,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'FICHA ATIVA',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: Theme.of(context).colorScheme.secondary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      _character.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${_race?.name ?? 'Raça indisponível'} · ${_class?.name ?? 'Classe indisponível'} · Nível ${_character.level}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ],
          );
          final levelButton = FilledButton.icon(
            onPressed: _class == null ? null : _levelUp,
            icon: const Icon(Icons.trending_up),
            label: Text(
              _character.level >= 10
                  ? 'Registrar XP / Excelência'
                  : 'Subir de nível',
            ),
          );
          if (compact) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [identity, const SizedBox(height: 12), levelButton],
            );
          }
          return Row(
            children: [
              Expanded(child: identity),
              const SizedBox(width: 16),
              levelButton,
            ],
          );
        },
      ),
    ),
  );

  Widget _resources() => SectionCard(
    title: 'Vida e recursos',
    child: Column(
      children: [
        _resourceControl(
          'Vida',
          _character.currentHp,
          _character.maxHp,
          (value) => _persist(_deathSaves.changeHitPoints(_character, value)),
        ),
        const SizedBox(height: 16),
        _resourceControl(
          'Mana',
          _character.currentMana,
          _character.maxMana,
          (value) => _persist(_character.copyWith(currentMana: value)),
        ),
        for (final entry in _character.resources.entries.where(
          (entry) => entry.key.endsWith('Max'),
        )) ...[
          const SizedBox(height: 16),
          _resourceControl(
            entry.key.substring(0, entry.key.length - 3),
            _character
                    .resources['${entry.key.substring(0, entry.key.length - 3)}Current'] ??
                0,
            entry.value,
            (value) {
              final id = entry.key.substring(0, entry.key.length - 3);
              _persist(
                _character.copyWith(
                  resources: {..._character.resources, '${id}Current': value},
                ),
              );
            },
          ),
        ],
        if (_character.currentHp == 0) ...[
          const SizedBox(height: 16),
          _deathSaveControls(),
        ],
      ],
    ),
  );

  Widget _resourceControl(
    String label,
    int current,
    int max,
    ValueChanged<int> onChanged,
  ) {
    final safeMax = max.clamp(0, 999999);
    final safeCurrent = current.clamp(0, safeMax);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
            IconButton(
              tooltip: 'Diminuir',
              onPressed: safeCurrent <= 0
                  ? null
                  : () => onChanged(safeCurrent - 1),
              icon: const Icon(Icons.remove_circle_outline),
            ),
            Text('$safeCurrent/$safeMax'),
            IconButton(
              tooltip: 'Aumentar',
              onPressed: safeCurrent >= safeMax
                  ? null
                  : () => onChanged(safeCurrent + 1),
              icon: const Icon(Icons.add_circle_outline),
            ),
            IconButton(
              tooltip: 'Ajustar quantidade',
              onPressed: safeMax <= 0
                  ? null
                  : () => _showResourceAdjustment(
                      label,
                      safeCurrent,
                      safeMax,
                      onChanged,
                    ),
              icon: const Icon(Icons.tune),
            ),
          ],
        ),
        LinearProgressIndicator(
          value: safeMax == 0 ? 0 : safeCurrent / safeMax,
          minHeight: 8,
        ),
      ],
    );
  }

  Future<void> _showResourceAdjustment(
    String label,
    int current,
    int maximum,
    ValueChanged<int> onChanged,
  ) async {
    final amount = TextEditingController(text: '1');
    final operation = await showDialog<int>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Ajustar $label'),
        content: TextField(
          controller: amount,
          autofocus: true,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'Quantidade'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          OutlinedButton.icon(
            onPressed: () => Navigator.pop(context, -1),
            icon: const Icon(Icons.remove),
            label: const Text('Subtrair'),
          ),
          FilledButton.icon(
            onPressed: () => Navigator.pop(context, 1),
            icon: const Icon(Icons.add),
            label: const Text('Somar'),
          ),
        ],
      ),
    );
    final value = int.tryParse(amount.text) ?? 0;
    amount.dispose();
    if (operation == null || value <= 0) return;
    onChanged((current + operation * value).clamp(0, maximum));
  }

  Widget _deathSaveControls() {
    final successes = _character.resources['deathSuccesses'] ?? 0;
    final failures = _character.resources['deathFailures'] ?? 0;
    final dead = _character.resources['dead'] == 1;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          dead ? 'Personagem morto' : 'Testes contra a morte',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        Text('Acertos $successes/3 · Erros $failures/3'),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            FilledButton(
              onPressed: dead
                  ? null
                  : () =>
                        _persist(_deathSaves.record(_character, success: true)),
              child: const Text('Registrar acerto'),
            ),
            OutlinedButton(
              onPressed: dead
                  ? null
                  : () => _persist(
                      _deathSaves.record(_character, success: false),
                    ),
              child: const Text('Registrar erro'),
            ),
            TextButton(
              onPressed: () => _persist(_deathSaves.reset(_character)),
              child: const Text('Zerar testes'),
            ),
          ],
        ),
        const Text('Com 3 acertos, o personagem retorna com 1 de vida.'),
      ],
    );
  }

  Widget _infusionSection() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const Text(
        'Informe o dano obtido com o arco. A ficha aplica a infusão, a Cadência e a penalidade por múltiplos ataques.',
      ),
      const SizedBox(height: 10),
      for (final infusion in ClassActionService.infusions)
        Card(
          child: ListTile(
            title: Text('Flecha ${infusion.name}'),
            subtitle: Text(
              '${infusion.effect}\n${_infusionDamageLabel(infusion)}\n${_infusionManaCost(infusion)} PM · ${infusion.focusCost} Foco',
            ),
            isThreeLine: true,
            trailing: FilledButton(
              onPressed: () => _useInfusion(infusion),
              child: const Text('Usar'),
            ),
          ),
        ),
    ],
  );

  Widget _spellbookSection() {
    final grouped = <String, List<CharacterSpell>>{};
    for (final spell in _character.spells) {
      final topic = spell.topic.trim().isEmpty ? 'Sem tópico' : spell.topic;
      grouped.putIfAbsent(topic, () => []).add(spell);
    }
    final topics = grouped.keys.toList()
      ..sort((left, right) => left.compareTo(right));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            Chip(
              label: Text(
                'Mana ${_character.currentMana}/${_character.maxMana}',
              ),
            ),
            Chip(
              label: Text('Foco ${_character.resources['focoCurrent'] ?? 0}'),
            ),
            Chip(label: Text('Humanidade ${_humanity.humanity(_character)}')),
            Chip(label: Text('${_character.spells.length} magias')),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                onPressed: _addExistingSpell,
                icon: const Icon(Icons.library_add_outlined),
                label: const Text('Adicionar existente'),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.outlined(
              tooltip: 'Criar magia personalizada',
              onPressed: _addSpell,
              icon: const Icon(Icons.add),
            ),
          ],
        ),
        const SizedBox(height: 14),
        if (topics.isEmpty)
          const Center(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: 36),
              child: Text(
                'Adicione magias do catálogo para montar o grimório.',
              ),
            ),
          )
        else
          for (final topic in topics)
            Card(
              margin: const EdgeInsets.only(bottom: 10),
              child: ExpansionTile(
                initiallyExpanded: true,
                title: Text(topic),
                subtitle: Text('${grouped[topic]!.length} magia(s)'),
                children: [
                  for (final spell in grouped[topic]!) _spellTile(spell),
                ],
              ),
            ),
        if (_character.actionHistory.isNotEmpty)
          ExpansionTile(
            tilePadding: EdgeInsets.zero,
            title: const Text('Histórico de uso'),
            children: [
              for (final action in _character.actionHistory.take(20))
                ListTile(
                  title: Text(action.name),
                  subtitle: Text(
                    '${action.result} · ${action.manaSpent} PM · ${action.focusSpent} Foco · ${action.humanitySpent} Humanidade',
                  ),
                ),
            ],
          ),
      ],
    );
  }

  Widget _spellTile(CharacterSpell spell) => Padding(
    padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(7),
          child: RpgImage(
            url: spell.imageUrl,
            width: 56,
            height: 56,
            icon: Icons.auto_awesome_outlined,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(spell.name, style: Theme.of(context).textTheme.titleSmall),
              Text(
                '${spell.type} · ${spell.manaCost} PM${spell.focusCost > 0 ? ' · ${spell.focusCost} Foco' : ''}${spell.humanityCost > 0 ? ' · ${spell.humanityCost} HM' : ''}',
              ),
              Text(
                spell.mastered
                    ? 'Estável após 3 sucessos'
                    : '${spell.successfulUses}/3 usos bem-sucedidos',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              if (spell.damage.isNotEmpty) Text('Dano/Efeito: ${spell.damage}'),
              if (spell.range.isNotEmpty) Text('Alcance: ${spell.range}'),
              if (spell.description.isNotEmpty) Text(spell.description),
              const SizedBox(height: 8),
              Wrap(
                spacing: 7,
                runSpacing: 7,
                children: [
                  FilledButton(
                    onPressed: () => _castSpell(spell, true),
                    child: const Text('Usar'),
                  ),
                  OutlinedButton(
                    onPressed: () => _castSpell(spell, false),
                    child: const Text('Falha'),
                  ),
                  IconButton.outlined(
                    tooltip: 'Organizar tópico',
                    onPressed: () => _editSpellTopic(spell),
                    icon: const Icon(Icons.drive_file_move_outline),
                  ),
                  IconButton.outlined(
                    tooltip: 'Remover magia',
                    onPressed: () => _removeSpell(spell),
                    icon: const Icon(Icons.delete_outline),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    ),
  );

  // Kept while old saves are migrated through the same casting helpers.
  // ignore: unused_element
  Widget _classActionsSection() {
    final spectralArcher =
        normalizeCatalogText(_class?.name ?? '') == 'arqueiro espectral';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (spectralArcher) ...[
          Text(
            'Flechas mágicas do Arqueiro Espectral',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const Text(
            'Informe o dano obtido com o arco ao usar. A ficha aplica o dano da infusão, a Cadência e a penalidade de PM por múltiplos ataques.',
          ),
          const SizedBox(height: 10),
          for (final infusion in ClassActionService.infusions)
            Card(
              child: ListTile(
                title: Text('Flecha ${infusion.name}'),
                subtitle: Text(
                  '${infusion.effect}\n${_infusionDamageLabel(infusion)}\n${_infusionManaCost(infusion)} PM · ${infusion.focusCost} Foco',
                ),
                isThreeLine: true,
                trailing: FilledButton(
                  onPressed: () => _useInfusion(infusion),
                  child: const Text('Usar'),
                ),
              ),
            ),
          const Divider(height: 28),
        ],
        Row(
          children: [
            Expanded(
              child: Text(
                'Grimório pessoal',
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            IconButton(
              tooltip: 'Criar magia',
              onPressed: _addSpell,
              icon: const Icon(Icons.add_circle_outline),
            ),
          ],
        ),
        if (_character.spells.isEmpty)
          const Text('Nenhuma magia criada.')
        else
          for (final spell in _character.spells)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            spell.name,
                            style: Theme.of(context).textTheme.titleSmall,
                          ),
                        ),
                        IconButton(
                          tooltip: 'Remover magia',
                          onPressed: () => _removeSpell(spell),
                          icon: const Icon(Icons.delete_outline),
                        ),
                      ],
                    ),
                    Text(
                      '${spell.type} · ${spell.manaCost} PM · ${spell.focusCost} Foco · ${spell.humanityCost} Humanidade',
                    ),
                    Text(
                      spell.mastered
                          ? 'Estável após 3 sucessos'
                          : '${spell.successfulUses}/3 usos bem-sucedidos',
                    ),
                    if (spell.description.isNotEmpty) Text(spell.description),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      children: [
                        FilledButton(
                          onPressed: () => _castSpell(spell, true),
                          child: const Text('Usar com sucesso'),
                        ),
                        OutlinedButton(
                          onPressed: () => _castSpell(spell, false),
                          child: const Text('Registrar falha'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
        if (_character.actionHistory.isNotEmpty)
          ExpansionTile(
            tilePadding: EdgeInsets.zero,
            title: const Text('Histórico de ações'),
            children: [
              for (final action in _character.actionHistory.take(20))
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(action.name),
                  subtitle: Text(
                    '${action.result} · ${action.manaSpent} PM · ${action.focusSpent} Foco · ${action.humanitySpent} Humanidade',
                  ),
                ),
            ],
          ),
      ],
    );
  }

  int _infusionManaCost(SpectralInfusion infusion) {
    final cadence = _character.resources['cadenciaCurrent'] ?? 0;
    return _classActions.infusionManaCost(infusion, cadence, 1);
  }

  String _infusionDamageLabel(SpectralInfusion infusion) =>
      switch (infusion.id) {
        'impact' => 'Dano: base do arco +1; +2 com 3 Cadência',
        'piercing' => 'Dano: base do arco +1',
        'spectral' => 'Dano: base do arco; no erro, 40% arredondado para baixo',
        _ => 'Dano: base do arco',
      };

  Future<void> _useInfusion(SpectralInfusion infusion) async {
    final baseDamage = TextEditingController(text: '0');
    final attacks = TextEditingController(text: '1');
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Usar Flecha ${infusion.name}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: baseDamage,
              autofocus: true,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Dano obtido com o arco',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: attacks,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Ataques realizados no turno',
                helperText: '3 ou mais ataques aumentam o custo em 1 PM.',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Usar flecha'),
          ),
        ],
      ),
    );
    final damage = (int.tryParse(baseDamage.text) ?? 0).clamp(0, 999999);
    final attackCount = (int.tryParse(attacks.text) ?? 1).clamp(1, 99);
    baseDamage.dispose();
    attacks.dispose();
    if (confirmed != true) return;
    final result = _classActions.useInfusion(
      _character,
      infusion,
      baseDamage: damage,
      attacksThisTurn: attackCount,
    );
    if (!result.succeeded) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(result.error)));
      }
      return;
    }
    await _persist(result.character);
  }

  Future<void> _addExistingSpell() async {
    var query = '';
    final owned = _character.spells
        .map((spell) => spell.catalogId)
        .where((id) => id.isNotEmpty)
        .toSet();
    final selected = await showModalBottomSheet<CatalogEntry>(
      context: context,
      isScrollControlled: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) {
          final normalizedQuery = normalizeCatalogText(query);
          final available = widget.catalog.spells
              .where(
                (entry) =>
                    !owned.contains(entry.id) &&
                    normalizeCatalogText(
                      '${entry.name} ${entry.description} ${entry.labels.map((label) => label.name).join(' ')}',
                    ).contains(normalizedQuery),
              )
              .toList();
          return SafeArea(
            child: SizedBox(
              height: MediaQuery.sizeOf(context).height * .78,
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                    child: TextField(
                      autofocus: true,
                      decoration: const InputDecoration(
                        labelText: 'Buscar magia oficial',
                        prefixIcon: Icon(Icons.search),
                      ),
                      onChanged: (value) => setSheetState(() => query = value),
                    ),
                  ),
                  Expanded(
                    child: available.isEmpty
                        ? const Center(child: Text('Nenhuma magia disponível.'))
                        : ListView.separated(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
                            itemCount: available.length,
                            separatorBuilder: (_, _) =>
                                const SizedBox(height: 7),
                            itemBuilder: (context, index) {
                              final entry = available[index];
                              final spell = _catalogSpell(entry);
                              return Card(
                                child: ListTile(
                                  leading: ClipRRect(
                                    borderRadius: BorderRadius.circular(7),
                                    child: RpgImage(
                                      url: entry.imageUrl,
                                      width: 50,
                                      height: 50,
                                      icon: Icons.auto_awesome_outlined,
                                    ),
                                  ),
                                  title: Text(entry.name),
                                  subtitle: Text(
                                    '${spell.topic} · ${spell.manaCost} PM · ${spell.humanityCost} HM\n${spell.damage.isNotEmpty ? spell.damage : spell.description}',
                                    maxLines: 3,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  isThreeLine: true,
                                  trailing: const Icon(
                                    Icons.add_circle_outline,
                                  ),
                                  onTap: () => Navigator.pop(context, entry),
                                ),
                              );
                            },
                          ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
    if (selected == null) return;
    await _persist(
      _character.copyWith(
        spells: [_catalogSpell(selected), ..._character.spells],
      ),
    );
  }

  CharacterSpell _catalogSpell(CatalogEntry entry) {
    final metadata = _ruleMetadata(entry);
    final costs = Map<String, dynamic>.from(
      (metadata['costs'] as Map?) ?? const {},
    );
    const schools = {
      'arcana': 'Arcana',
      'divina': 'Divina',
      'espectral': 'Espectral',
      'elemental': 'Elemental',
      'demoniaca': 'Demoníaca',
      'natural': 'Natural',
      'outra': 'Outra',
    };
    return CharacterSpell(
      id: newId('spell'),
      catalogId: entry.id,
      name: entry.name,
      type:
          schools[normalizeCatalogText('${metadata['school'] ?? ''}')] ??
          'Comum',
      topic: metadata['topic']?.toString().trim().isNotEmpty == true
          ? metadata['topic'].toString()
          : 'Sem tópico',
      description: _spellSummary(entry),
      manaCost: (costs['mana'] as num?)?.toInt() ?? 0,
      focusCost: (costs['focus'] as num?)?.toInt() ?? 0,
      humanityCost: (costs['humanity'] as num?)?.toInt() ?? 0,
      range: metadata['range']?.toString() ?? '',
      damage: metadata['damage']?.toString() ?? '',
      imageUrl: entry.imageUrl,
      createdAt: DateTime.now(),
    );
  }

  Map<String, dynamic> _ruleMetadata(CatalogEntry entry) {
    final match = RegExp(
      r'<!-- RPG_RULES_JSON_START -->([\s\S]*?)<!-- RPG_RULES_JSON_END -->',
    ).firstMatch(entry.description);
    if (match == null) return {};
    try {
      return Map<String, dynamic>.from(jsonDecode(match.group(1)!.trim()));
    } catch (_) {
      return {};
    }
  }

  String _spellSummary(CatalogEntry entry) => entry.displayDescription
      .split(RegExp(r'\r?\n'))
      .where(
        (line) =>
            line.isNotEmpty &&
            !line.startsWith('# ') &&
            !RegExp(
              r'^\*\*(Tipo|Nível|Tópico|Classe|Custo|Alcance|Dano/Efeito):\*\*',
              caseSensitive: false,
            ).hasMatch(line),
      )
      .join('\n')
      .trim();

  Future<void> _editSpellTopic(CharacterSpell spell) async {
    final controller = TextEditingController(text: spell.topic);
    final topic = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Organizar magia'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'Tópico',
            hintText: 'Ex.: Favoritas, Grau 1, Cura',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: const Text('Salvar'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (topic == null) return;
    await _persist(
      _character.copyWith(
        spells: _character.spells
            .map(
              (item) => item.id == spell.id
                  ? item.copyWith(topic: topic.isEmpty ? 'Sem tópico' : topic)
                  : item,
            )
            .toList(),
      ),
    );
  }

  Future<void> _castSpell(CharacterSpell spell, bool successful) async {
    final result = _classActions.useSpell(
      _character,
      spell,
      successful: successful,
    );
    if (!result.succeeded) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(result.error)));
      }
      return;
    }
    await _persist(result.character);
  }

  Future<void> _removeSpell(CharacterSpell spell) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Remover magia'),
        content: Text('Remover ${spell.name} do grimório?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Remover'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await _persist(
      _character.copyWith(
        spells: _character.spells.where((item) => item.id != spell.id).toList(),
      ),
    );
  }

  Future<void> _addSpell() async {
    final name = TextEditingController();
    final topic = TextEditingController(text: 'Sem tópico');
    final description = TextEditingController();
    final damage = TextEditingController();
    final range = TextEditingController();
    final mana = TextEditingController(text: '0');
    final focus = TextEditingController(text: '0');
    final humanity = TextEditingController(text: '0');
    var type = 'Comum';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Criar magia'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: name,
                  decoration: const InputDecoration(labelText: 'Nome'),
                ),
                TextField(
                  controller: topic,
                  decoration: const InputDecoration(labelText: 'Tópico'),
                ),
                DropdownButtonFormField<String>(
                  initialValue: type,
                  decoration: const InputDecoration(labelText: 'Tipo'),
                  items:
                      const [
                            'Comum',
                            'Espiritual',
                            'Divina',
                            'Feitiço',
                            'Demoníaca',
                          ]
                          .map(
                            (value) => DropdownMenuItem(
                              value: value,
                              child: Text(value),
                            ),
                          )
                          .toList(),
                  onChanged: (value) =>
                      setDialogState(() => type = value ?? type),
                ),
                TextField(
                  controller: mana,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Custo de Mana'),
                ),
                TextField(
                  controller: focus,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Custo de Foco'),
                ),
                TextField(
                  controller: humanity,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Custo de Humanidade',
                  ),
                ),
                TextField(
                  controller: damage,
                  decoration: const InputDecoration(
                    labelText: 'Dano ou efeito',
                  ),
                ),
                TextField(
                  controller: range,
                  decoration: const InputDecoration(labelText: 'Alcance'),
                ),
                TextField(
                  controller: description,
                  minLines: 2,
                  maxLines: 4,
                  decoration: const InputDecoration(labelText: 'Descrição'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Criar'),
            ),
          ],
        ),
      ),
    );
    if (confirmed == true && name.text.trim().isNotEmpty) {
      await _persist(
        _character.copyWith(
          spells: [
            CharacterSpell(
              id: newId('spell'),
              name: name.text.trim(),
              type: type,
              topic: topic.text.trim().isEmpty
                  ? 'Sem tópico'
                  : topic.text.trim(),
              description: description.text.trim(),
              damage: damage.text.trim(),
              range: range.text.trim(),
              manaCost: (int.tryParse(mana.text) ?? 0).clamp(0, 999),
              focusCost: (int.tryParse(focus.text) ?? 0).clamp(0, 999),
              humanityCost: (int.tryParse(humanity.text) ?? 0).clamp(0, 100),
              createdAt: DateTime.now(),
            ),
            ..._character.spells,
          ],
        ),
      );
    }
    name.dispose();
    topic.dispose();
    description.dispose();
    damage.dispose();
    range.dispose();
    mana.dispose();
    focus.dispose();
    humanity.dispose();
  }

  Widget _humanitySection() {
    final humanity = _humanity.humanity(_character);
    final divinity = _humanity.divinity(_character);
    final status = _humanity.status(_character, className: _class?.name ?? '');
    final accuracyBonus = _humanity.divineAccuracyBonus(_character);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _humanityBar('Humanidade', humanity, 100),
        const SizedBox(height: 12),
        _humanityBar('Divindade', divinity, 100),
        const SizedBox(height: 14),
        Text(status.name, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 4),
        Text(status.description),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            Chip(
              label: Text(
                status.resistanceDifficulty == null
                    ? (humanity == 1 ? 'CD Divina especial' : 'CD Divina —')
                    : 'CD Divina ${status.resistanceDifficulty}',
              ),
            ),
            Chip(
              label: Text(
                'Resistência +${_humanity.resistanceBonus(_character)}',
              ),
            ),
            Chip(label: Text('Acerto divino +$accuracyBonus')),
            if (_humanity.getFaithDamageBonus(_character))
              const Chip(label: Text('Dano divino +Fé')),
            if (!status.playable)
              const Chip(label: Text('Personagem injogável')),
          ],
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            FilledButton.icon(
              onPressed: humanity <= 0
                  ? null
                  : () => _changeHumanity(spend: true),
              icon: const Icon(Icons.local_fire_department_outlined),
              label: const Text('Gastar Humanidade'),
            ),
            OutlinedButton.icon(
              onPressed: humanity >= 100
                  ? null
                  : () => _changeHumanity(spend: false),
              icon: const Icon(Icons.healing_outlined),
              label: const Text('Restaurar'),
            ),
            OutlinedButton.icon(
              onPressed: status.resistanceDifficulty == null
                  ? null
                  : _rollDivineResistance,
              icon: const Icon(Icons.casino_outlined),
              label: const Text('Resistência Divina'),
            ),
          ],
        ),
        if (_character.humanityHistory.isNotEmpty) ...[
          const Divider(height: 28),
          ExpansionTile(
            tilePadding: EdgeInsets.zero,
            title: const Text('Histórico de Humanidade'),
            children: [
              for (final record in _character.humanityHistory.take(20))
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(record.reason),
                  subtitle: Text(
                    'Humanidade ${record.humanityBefore} → ${record.humanityAfter} · '
                    'Divindade ${record.divinityBefore} → ${record.divinityAfter}',
                  ),
                ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _humanityBar(String label, int value, int maximum) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
          Text('$value/$maximum'),
        ],
      ),
      const SizedBox(height: 6),
      LinearProgressIndicator(value: value / maximum, minHeight: 8),
    ],
  );

  Future<void> _changeHumanity({required bool spend}) async {
    final amount = TextEditingController(text: '1');
    final reason = TextEditingController(
      text: spend ? 'Uso de poder divino' : 'Restauração definida pelo mestre',
    );
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(spend ? 'Gastar Humanidade' : 'Restaurar Humanidade'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: amount,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Quantidade'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: reason,
              decoration: const InputDecoration(labelText: 'Motivo'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Confirmar'),
          ),
        ],
      ),
    );
    final parsedAmount = int.tryParse(amount.text) ?? 0;
    final parsedReason = reason.text;
    amount.dispose();
    reason.dispose();
    if (confirmed != true || parsedAmount <= 0) return;
    await _persist(
      spend
          ? _humanity.spend(_character, parsedAmount, parsedReason)
          : _humanity.restore(_character, parsedAmount, parsedReason),
    );
  }

  Future<void> _rollDivineResistance() async {
    final status = _humanity.status(_character, className: _class?.name ?? '');
    final difficulty = status.resistanceDifficulty;
    if (difficulty == null) return;
    final bonus = _humanity.resistanceBonus(_character);
    final result = await DiceResultModal.show(
      context,
      characterId: _character.id,
      type: 'divine_resistance',
      name: 'Resistência Divina · CD $difficulty',
      sides: 20,
      modifiers: [
        Modifier(
          id: 'humanity_resistance',
          sourceId: _character.id,
          sourceName: 'Humanidade ÷ 10',
          sourceType: 'humanity',
          targetType: 'roll',
          targetId: 'divineResistance',
          value: bonus,
        ),
      ],
    );
    if (result == null) return;
    await _persist(
      _character.copyWith(rollHistory: [result, ..._character.rollHistory]),
    );
    if (mounted) {
      _message(
        result.finalResult >= difficulty
            ? 'Resistência Divina bem-sucedida.'
            : 'Falha na Resistência Divina. Aplique o efeito do estado atual.',
      );
    }
  }

  Widget _attributeSection() => Column(
    children: [
      for (final attribute in AttributeId.values)
        Builder(
          builder: (context) {
            final breakdown = _attributes.calculate(
              _character,
              attribute,
              _character.modifiers,
            );
            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: StatBreakdownCard(
                    label: attribute.label,
                    base: breakdown.base,
                    total: breakdown.total,
                    modifiers: breakdown.modifiers,
                  ),
                ),
                IconButton(
                  tooltip: 'Rolar ${attribute.label}',
                  onPressed: () => _rollAttribute(attribute, breakdown),
                  icon: const Icon(Icons.casino_outlined),
                ),
              ],
            );
          },
        ),
    ],
  );

  Widget _proficiencySection() {
    if (widget.catalog.skills.isEmpty) {
      return const Text(
        'Nenhuma perícia encontrada na lista Perícias do Trello.',
      );
    }
    return Column(
      children: [
        for (final entry in widget.catalog.skills)
          Builder(
            builder: (context) {
              final skill = _parser.parseSkill(entry);
              final value = _skills.officialValue(_character, skill);
              final proficient = _character.proficiencies.any(
                (item) =>
                    normalizeCatalogText(item) ==
                    normalizeCatalogText(entry.name),
              );
              final rollValue = value + (proficient ? value : 0);
              return ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(child: Text('+$rollValue')),
                title: Text(entry.name),
                subtitle: Text(
                  '${proficient ? 'Proficiente · valor bruto +$value · ' : ''}${skill.terms.map((term) => '${AttributeId.values.firstWhere((item) => item.name == term.attributeId).label} ${(term.weight * 100).round()}%').join(' • ')}',
                ),
                trailing: IconButton(
                  tooltip: 'Rolar ${entry.name}',
                  onPressed: () => _rollSkill(entry.name, entry.id, value),
                  icon: const Icon(Icons.casino_outlined),
                ),
              );
            },
          ),
      ],
    );
  }

  Widget _combatSection() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          FilledButton.icon(
            onPressed: () => _rollSimple('attack', 'Ataque'),
            icon: const Icon(Icons.gps_fixed),
            label: const Text('Ataque'),
          ),
          OutlinedButton.icon(
            onPressed: () => _rollSimple('damage', 'Dano', sides: 6),
            icon: const Icon(Icons.flash_on_outlined),
            label: const Text('Dano'),
          ),
          OutlinedButton.icon(
            onPressed: () => _rollSimple('resistance', 'Resistência'),
            icon: const Icon(Icons.shield_outlined),
            label: const Text('Resistência'),
          ),
          OutlinedButton.icon(
            onPressed: () => _rollSimple('general', 'Teste geral'),
            icon: const Icon(Icons.casino_outlined),
            label: const Text('Teste geral'),
          ),
        ],
      ),
    ],
  );

  Widget _defenseSection() {
    final parsedClass = _class == null ? null : _parser.parseClass(_class!);
    final formula = parsedClass?.defenseFormula;
    final defense = _combat.defense(_character, formula);
    final armorClass = _combat.armorClass(_character, formula);
    final terms = formula?.terms.entries.map((entry) {
      final attribute = AttributeId.values
          .where((item) => item.name == entry.key)
          .firstOrNull;
      return '${attribute?.label ?? entry.key} × ${(entry.value * 100).round()}%';
    }).toList();
    final formulaText = terms?.isNotEmpty == true
        ? 'Defesa = floor(${terms!.join(' + ')})'
        : 'Defesa = floor(Destreza × 70% + Constituição × 30%)';
    final equipment = _character.modifiers.where(
      (item) =>
          item.sourceType == 'equipment' &&
          item.targetType == 'stat' &&
          (item.targetId == 'defense' || item.targetId == 'armorClass'),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Defesa'),
                trailing: Text(
                  '$defense',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
              ),
            ),
            Expanded(
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('CA'),
                trailing: Text(
                  '$armorClass',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
              ),
            ),
          ],
        ),
        Text('$formulaText\nCA = 10 + Defesa + bônus direto de CA'),
        if (equipment.isNotEmpty) ...[
          const SizedBox(height: 10),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final modifier in equipment)
                Chip(
                  label: Text(
                    '${modifier.sourceName}: +${modifier.value} ${modifier.targetId == 'defense' ? 'Defesa' : 'CA'}',
                  ),
                ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _experienceSection() {
    final classCost = _experience.classXpRequired(_character.level);
    final eligibleAreas = _character.areaExperience.entries
        .where((entry) => entry.value >= 20)
        .toList();
    final combatTargets = _class == null
        ? <AttributeId>[]
        : _parser
              .parseClass(_class!)
              .allowedCombatXpAttributes
              .map(
                (id) => AttributeId.values
                    .where((item) => item.name == id)
                    .firstOrNull,
              )
              .whereType<AttributeId>()
              .toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('XP de Classe'),
          subtitle: Text(
            _character.level >= 10
                ? 'Progresso para Excelência'
                : 'Necessário para o próximo nível',
          ),
          trailing: Text('${_character.classXp}/$classCost'),
        ),
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('XP de Combate'),
          subtitle: const Text(
            '25 XP podem ser convertidos em atributo permitido',
          ),
          trailing: Text('${_character.combatXp}/25'),
        ),
        for (final entry in _character.areaExperience.entries)
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(entry.key),
            subtitle: const Text('20 XP permitem uma conversão'),
            trailing: Text('${entry.value}/20'),
          ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            OutlinedButton.icon(
              onPressed: _registerAreaXp,
              icon: const Icon(Icons.add_task),
              label: const Text('XP de área'),
            ),
            OutlinedButton.icon(
              onPressed: _registerCombatXp,
              icon: const Icon(Icons.sports_martial_arts_outlined),
              label: const Text('XP de combate'),
            ),
            OutlinedButton.icon(
              onPressed: eligibleAreas.isEmpty
                  ? null
                  : () => _convertAreaXp(eligibleAreas),
              icon: const Icon(Icons.swap_horiz),
              label: const Text('Converter área'),
            ),
            OutlinedButton.icon(
              onPressed: _character.combatXp < 25 || combatTargets.isEmpty
                  ? null
                  : () => _convertCombatXp(combatTargets),
              icon: const Icon(Icons.upgrade),
              label: const Text('Converter combate'),
            ),
          ],
        ),
        if (_character.combatXp >= 25 && combatTargets.isEmpty)
          const Padding(
            padding: EdgeInsets.only(top: 10),
            child: Text(
              'O arquivo não lista os atributos permitidos para esta classe; a conversão de combate permanece bloqueada.',
            ),
          ),
        if (_character.experienceHistory.isNotEmpty) ...[
          const Divider(height: 28),
          ExpansionTile(
            tilePadding: EdgeInsets.zero,
            title: const Text('Histórico de XP'),
            children: [
              for (final entry in _character.experienceHistory.take(20))
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: CircleAvatar(
                    child: Text(
                      entry.amount > 0 ? '+${entry.amount}' : '${entry.amount}',
                    ),
                  ),
                  title: Text(entry.description),
                  subtitle: Text('${entry.createdAt.toLocal()}'),
                ),
            ],
          ),
        ],
      ],
    );
  }

  Future<void> _registerAreaXp() async {
    final areas = <String>{
      'Investigação',
      'Coleta',
      'Medicina',
      'Religião',
      'Furtividade',
      'Diplomacia',
      'Sobrevivência',
      ...widget.catalog.skills.map((entry) => entry.name),
    }.toList()..sort();
    var selectedArea = areas.first;
    var amount = 1;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Registrar XP de área'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                initialValue: selectedArea,
                decoration: const InputDecoration(labelText: 'Área'),
                items: [
                  for (final area in areas)
                    DropdownMenuItem(value: area, child: Text(area)),
                ],
                onChanged: (value) =>
                    setDialogState(() => selectedArea = value ?? selectedArea),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<int>(
                initialValue: amount,
                decoration: const InputDecoration(labelText: 'Impacto na cena'),
                items: const [
                  DropdownMenuItem(
                    value: 1,
                    child: Text('Participação leve · 1 XP'),
                  ),
                  DropdownMenuItem(
                    value: 2,
                    child: Text('Boa participação · 2 XP'),
                  ),
                  DropdownMenuItem(
                    value: 3,
                    child: Text('Destaque claro · 3 XP'),
                  ),
                  DropdownMenuItem(
                    value: 4,
                    child: Text('Performance excepcional · 4 XP'),
                  ),
                ],
                onChanged: (value) => setDialogState(() => amount = value ?? 1),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Registrar'),
            ),
          ],
        ),
      ),
    );
    if (confirmed == true) {
      await _persist(
        _experience.registerAreaXp(_character, selectedArea, amount),
      );
    }
  }

  Future<void> _registerCombatXp() async {
    var base = 1;
    var participation = 1;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Registrar XP de combate'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<int>(
                initialValue: base,
                decoration: const InputDecoration(labelText: 'Dificuldade'),
                items: const [
                  DropdownMenuItem(value: 0, child: Text('Não participou · 0')),
                  DropdownMenuItem(value: 1, child: Text('Fácil · 1')),
                  DropdownMenuItem(value: 2, child: Text('Moderado · 2')),
                  DropdownMenuItem(value: 3, child: Text('Difícil · 3')),
                  DropdownMenuItem(value: 4, child: Text('Mortal · 4')),
                ],
                onChanged: (value) => setDialogState(() => base = value ?? 0),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<int>(
                initialValue: participation,
                decoration: const InputDecoration(labelText: 'Participação'),
                items: const [
                  DropdownMenuItem(value: 0, child: Text('Sem adicional · 0')),
                  DropdownMenuItem(value: 1, child: Text('Pouca · 1')),
                  DropdownMenuItem(value: 2, child: Text('Moderada · 2')),
                  DropdownMenuItem(value: 3, child: Text('Bastante · 3')),
                  DropdownMenuItem(value: 4, child: Text('Carregou · 4')),
                ],
                onChanged: (value) =>
                    setDialogState(() => participation = value ?? 0),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: Text('Registrar ${base + participation} XP'),
            ),
          ],
        ),
      ),
    );
    if (confirmed == true) {
      await _persist(
        _experience.registerCombatXp(_character, base, participation),
      );
    }
  }

  Widget _stringList(List<String> values, String empty) => values.isEmpty
      ? Text(empty)
      : Column(
          children: [
            for (final value in values)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.bolt_outlined),
                title: Text(value),
              ),
          ],
        );

  Widget _itemList(List<InventoryItem> items) => items.isEmpty
      ? const Text('Nenhum item cadastrado.')
      : Column(
          children: [
            for (final item in items)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: RpgImage(
                    url: item.imageUrl,
                    width: 48,
                    height: 48,
                    icon: Icons.inventory_2_outlined,
                  ),
                ),
                title: Text('${item.name} ×${item.quantity}'),
                subtitle: Text(
                  [
                    item.type,
                    item.bonus,
                  ].where((value) => value.isNotEmpty).join('\n'),
                ),
              ),
          ],
        );

  Widget _levelHistory() => _character.levelHistory.isEmpty
      ? const Text('Nenhuma evolução registrada.')
      : Column(
          children: [
            for (final entry in _character.levelHistory)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(child: Text('${entry.level}')),
                title: Text('Nível ${entry.level} • +${entry.hpAdded} vida'),
                subtitle: Text(
                  '${entry.rollResult != null
                      ? '${entry.die}: ${entry.rollResult}'
                      : entry.hpMethod.startsWith('initial_')
                      ? 'HP inicial · método ${entry.hpMethod.replaceFirst('initial_', '')}'
                      : 'Valor fixo'}\nXP consumido: ${entry.xpSpent} • habilidade: ${entry.skillPoints} • classe: ${entry.classPoints}\n${entry.createdAt.toLocal()}',
                ),
              ),
          ],
        );

  Future<void> _convertAreaXp(List<MapEntry<String, int>> eligible) async {
    var selectedArea = eligible.first.key;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Converter XP de área'),
          content: DropdownButtonFormField<String>(
            initialValue: selectedArea,
            decoration: const InputDecoration(labelText: 'Área'),
            items: [
              for (final entry in eligible)
                DropdownMenuItem(
                  value: entry.key,
                  child: Text('${entry.key} · ${entry.value} XP'),
                ),
            ],
            onChanged: (value) =>
                setDialogState(() => selectedArea = value ?? selectedArea),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Continuar'),
            ),
          ],
        ),
      ),
    );
    if (confirmed != true || !mounted) return;
    final skillEntry = widget.catalog.skills
        .where(
          (entry) =>
              normalizeCatalogText(entry.name) ==
              normalizeCatalogText(selectedArea),
        )
        .firstOrNull;
    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Converter 20 XP de $selectedArea'),
        content: const Text(
          'A conversão em atributo exige aprovação do mestre.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          if (skillEntry != null)
            OutlinedButton(
              onPressed: () => Navigator.pop(context, 'skill'),
              child: Text('+1 ${skillEntry.name}'),
            ),
          for (final attribute in AttributeId.values)
            OutlinedButton(
              onPressed: () => Navigator.pop(context, attribute.name),
              child: Text('+1 ${attribute.label}'),
            ),
        ],
      ),
    );
    if (result == null) return;
    if (result == 'skill' && skillEntry != null) {
      await _persist(
        _experience.convertAreaToSkill(_character, selectedArea, skillEntry.id),
      );
      return;
    }
    final attribute = AttributeId.values
        .where((item) => item.name == result)
        .firstOrNull;
    if (attribute != null) {
      await _persist(
        _experience.convertAreaToAttribute(_character, selectedArea, attribute),
      );
    }
  }

  Future<void> _convertCombatXp(List<AttributeId> targets) async {
    var selected = targets.first;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Converter 25 XP de combate'),
          content: DropdownButtonFormField<AttributeId>(
            initialValue: selected,
            decoration: const InputDecoration(labelText: 'Atributo permitido'),
            items: [
              for (final attribute in targets)
                DropdownMenuItem(
                  value: attribute,
                  child: Text(attribute.label),
                ),
            ],
            onChanged: (value) =>
                setDialogState(() => selected = value ?? selected),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Confirmar com o mestre'),
            ),
          ],
        ),
      ),
    );
    if (confirmed == true) {
      await _persist(
        _experience.convertCombatToAttribute(_character, selected),
      );
    }
  }

  Future<void> _rollSkill(String name, String id, int value) async {
    final proficient = _character.proficiencies.any(
      (item) => normalizeCatalogText(item) == normalizeCatalogText(name),
    );
    final modifiers = [
      Modifier(
        id: 'skill_$id',
        sourceId: id,
        sourceName: name,
        sourceType: 'skill',
        targetType: 'roll',
        targetId: id,
        value: value,
      ),
      if (proficient)
        Modifier(
          id: 'proficiency_$id',
          sourceId: _character.id,
          sourceName: 'Proficiência · valor bruto',
          sourceType: 'proficiency',
          targetType: 'roll',
          targetId: id,
          value: value,
        ),
      ..._character.modifiers.where(
        (item) =>
            item.targetType == 'skillRoll' &&
            item.targetId == normalizeCatalogText(name),
      ),
    ];
    final result = await DiceResultModal.show(
      context,
      characterId: _character.id,
      type: 'skill',
      name: name,
      sides: 20,
      modifiers: modifiers,
    );
    if (result != null) {
      await _persist(
        _character.copyWith(rollHistory: [result, ..._character.rollHistory]),
      );
    }
  }

  Future<void> _rollAttribute(
    AttributeId attribute,
    StatBreakdown breakdown,
  ) async {
    final modifiers = [
      Modifier(
        id: 'base_${attribute.name}',
        sourceId: _character.id,
        sourceName: '${attribute.label} base',
        sourceType: 'character',
        targetType: 'roll',
        targetId: attribute.name,
        value: breakdown.base,
      ),
      ...breakdown.modifiers,
      ..._character.modifiers.where(
        (item) =>
            item.targetType == 'attributeRoll' &&
            item.targetId == attribute.name,
      ),
    ];
    final result = await DiceResultModal.show(
      context,
      characterId: _character.id,
      type: 'attribute',
      name: attribute.label,
      sides: 20,
      modifiers: modifiers,
    );
    if (result != null) {
      await _persist(
        _character.copyWith(rollHistory: [result, ..._character.rollHistory]),
      );
    }
  }

  Future<void> _rollSimple(String type, String name, {int sides = 20}) async {
    final result = await DiceResultModal.show(
      context,
      characterId: _character.id,
      type: type,
      name: name,
      sides: sides,
    );
    if (result != null) {
      await _persist(
        _character.copyWith(rollHistory: [result, ..._character.rollHistory]),
      );
    }
  }

  Future<void> _levelUp() async {
    final updated = await Navigator.of(context).push<Character>(
      MaterialPageRoute(
        builder: (_) => LevelUpScreen(
          character: _character,
          characterClass: _parser.parseClass(_class!),
          catalog: widget.catalog,
        ),
      ),
    );
    if (updated != null) await _persist(updated);
  }

  Future<void> _openInventory() async {
    final updated = await Navigator.of(context).push<Character>(
      MaterialPageRoute(
        builder: (_) => InventoryManagementScreen(
          character: _character,
          catalog: widget.catalog,
        ),
      ),
    );
    if (updated != null) await _persist(updated);
  }

  void _message(String value) => ScaffoldMessenger.of(
    context,
  ).showSnackBar(SnackBar(content: Text(value)));

  void _showExport() => showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: .8,
      builder: (context, controller) => ListView(
        controller: controller,
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        children: [
          Text(
            'Prévia de exportação',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 12),
          SelectableText(_export.jsonPreview(_character)),
        ],
      ),
    ),
  );
}
