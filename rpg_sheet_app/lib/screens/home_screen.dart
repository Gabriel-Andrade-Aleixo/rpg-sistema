import 'package:flutter/material.dart';

import '../models/catalog_models.dart';
import '../models/character.dart';
import '../presentation/screens/admin/admin_screen.dart';
import '../presentation/screens/catalog/catalog_screen.dart';
import '../presentation/widgets/rpg_image.dart';
import '../repositories/catalog_repository.dart';
import '../repositories/character_repository.dart';
import '../utils/id_generator.dart';
import '../widgets/dice_roller.dart';
import 'character_detail_screen.dart';
import 'character_form_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({
    super.key,
    required this.repository,
    required this.catalogRepository,
    required this.themeMode,
    required this.onToggleTheme,
  });

  final CharacterRepository repository;
  final CatalogRepository catalogRepository;
  final ThemeMode themeMode;
  final VoidCallback onToggleTheme;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeData {
  const _HomeData({
    required this.characters,
    required this.catalog,
    this.catalogError,
  });

  final List<Character> characters;
  final OfficialCatalog catalog;
  final Object? catalogError;
}

class _HomeScreenState extends State<HomeScreen> {
  late Future<_HomeData> _future;
  int _destination = 0;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  void _reload({bool refreshCatalog = false}) {
    _future = _load(refreshCatalog: refreshCatalog);
  }

  Future<_HomeData> _load({bool refreshCatalog = false}) async {
    await widget.repository.setupRemote();
    final characters = await widget.repository.listCharacters();
    try {
      final catalog = await widget.catalogRepository.load(
        refresh: refreshCatalog,
      );
      return _HomeData(characters: characters, catalog: catalog);
    } catch (error) {
      return _HomeData(
        characters: characters,
        catalog: const OfficialCatalog(entries: []),
        catalogError: error,
      );
    }
  }

  Future<void> _openForm(
    OfficialCatalog catalog, [
    Character? character,
  ]) async {
    if (catalog.entries.isEmpty) {
      _message(
        'O catálogo oficial está indisponível. Sincronize o Trello antes de criar ou editar fichas.',
      );
      return;
    }
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => CharacterFormScreen(
          repository: widget.repository,
          catalog: catalog,
          existingCharacter: character,
        ),
      ),
    );
    if (saved == true && mounted) setState(_reload);
  }

  Future<void> _openDetail(Character character, OfficialCatalog catalog) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => CharacterDetailScreen(
          character: character,
          repository: widget.repository,
          catalog: catalog,
          onEdit: () {
            Navigator.of(context).pop();
            _openForm(catalog, character);
          },
        ),
      ),
    );
    if (mounted) setState(_reload);
  }

  Future<void> _duplicate(Character character) async {
    final copy = character.copyWith(
      id: newId('char'),
      name: '${character.name} (cópia)',
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    );
    await widget.repository.saveCharacter(copy);
    if (mounted) setState(_reload);
  }

  Future<void> _delete(Character character) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Excluir personagem'),
        content: Text(
          'Excluir ${character.name}? Esta ação não pode ser desfeita.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton.icon(
            onPressed: () => Navigator.pop(context, true),
            icon: const Icon(Icons.delete_outline),
            label: const Text('Excluir'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    await widget.repository.deleteCharacter(character.id);
    if (mounted) setState(_reload);
  }

  void _showDice() => showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (_) => const DiceRoller(),
  );

  @override
  Widget build(BuildContext context) => FutureBuilder<_HomeData>(
    future: _future,
    builder: (context, snapshot) {
      final data = snapshot.data;
      return Scaffold(
        appBar: AppBar(
          toolbarHeight: 72,
          titleSpacing: 16,
          title: const _BrandTitle(),
          actions: [
            IconButton(
              tooltip: 'Rolar dados',
              icon: const Icon(Icons.casino_outlined),
              onPressed: _showDice,
            ),
            IconButton(
              tooltip: 'Sincronizar dados',
              icon: const Icon(Icons.sync),
              onPressed: snapshot.connectionState != ConnectionState.done
                  ? null
                  : () => setState(() => _reload(refreshCatalog: true)),
            ),
            PopupMenuButton<String>(
              tooltip: 'Mais opções',
              icon: const Icon(Icons.more_vert),
              onSelected: (value) {
                if (value == 'theme') widget.onToggleTheme();
              },
              itemBuilder: (_) => [
                PopupMenuItem(
                  value: 'theme',
                  child: ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(
                      widget.themeMode == ThemeMode.dark
                          ? Icons.light_mode_outlined
                          : Icons.dark_mode_outlined,
                    ),
                    title: Text(
                      widget.themeMode == ThemeMode.dark
                          ? 'Tema claro'
                          : 'Tema escuro',
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
        body: _body(snapshot),
        bottomNavigationBar: NavigationBar(
          selectedIndex: _destination,
          onDestinationSelected: (value) => setState(() {
            _destination = value;
          }),
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.shield_outlined),
              selectedIcon: Icon(Icons.shield),
              label: 'Fichas',
            ),
            NavigationDestination(
              icon: Icon(Icons.library_books_outlined),
              selectedIcon: Icon(Icons.library_books),
              label: 'Catálogo',
            ),
            NavigationDestination(
              icon: Icon(Icons.admin_panel_settings_outlined),
              selectedIcon: Icon(Icons.admin_panel_settings),
              label: 'Mestre',
            ),
          ],
        ),
        floatingActionButton: _destination == 0 && data != null
            ? FloatingActionButton.extended(
                onPressed: () => _openForm(data.catalog),
                icon: const Icon(Icons.add),
                label: const Text('Criar personagem'),
              )
            : null,
      );
    },
  );

  Widget _body(AsyncSnapshot<_HomeData> snapshot) {
    if (snapshot.connectionState != ConnectionState.done) {
      return const _LoadingState();
    }
    if (snapshot.hasError) {
      return _ErrorState(
        message: 'Não foi possível carregar as fichas.\n${snapshot.error}',
        onRetry: () => setState(_reload),
      );
    }
    final data = snapshot.data!;
    if (_destination == 1) {
      return CatalogScreen(catalog: data.catalog, embedded: true);
    }
    if (_destination == 2) {
      return AdminScreen(
        catalog: data.catalog,
        characters: data.characters,
        onSaveEntry: (kind, entry, id) async {
          await widget.catalogRepository.saveEntry(kind, entry, id: id);
          setState(() => _reload(refreshCatalog: true));
          await _future;
        },
        onDeleteEntry: (kind, id) async {
          await widget.catalogRepository.deleteEntry(kind, id);
          setState(() => _reload(refreshCatalog: true));
          await _future;
        },
        onRefresh: () async {
          setState(() => _reload(refreshCatalog: true));
          await _future;
        },
        embedded: true,
      );
    }
    return Column(
      children: [
        if (data.catalogError != null)
          MaterialBanner(
            content: const Text(
              'O catálogo do Trello está temporariamente indisponível.',
            ),
            leading: const Icon(Icons.cloud_off_outlined),
            actions: [
              TextButton(
                onPressed: () => setState(() => _reload(refreshCatalog: true)),
                child: const Text('Tentar novamente'),
              ),
            ],
          ),
        Expanded(child: data.characters.isEmpty ? _empty() : _characters(data)),
      ],
    );
  }

  Widget _empty() => Center(
    child: SingleChildScrollView(
      padding: const EdgeInsets.all(32),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 76,
              height: 76,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primary,
                border: Border.all(
                  color: Theme.of(context).colorScheme.secondary,
                ),
                borderRadius: BorderRadius.circular(8),
              ),
              alignment: Alignment.center,
              child: Text(
                'd20',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(color: Colors.white),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Nenhum personagem criado',
              style: Theme.of(context).textTheme.titleLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'Crie sua primeira ficha usando as raças, classes e equipamentos oficiais do Trello.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    ),
  );

  Widget _characters(_HomeData data) => RefreshIndicator(
    onRefresh: () async {
      setState(_reload);
      await _future;
    },
    child: CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        SliverToBoxAdapter(child: _Overview(data: data)),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 96),
          sliver: SliverLayoutBuilder(
            builder: (context, constraints) {
              final columns = constraints.crossAxisExtent >= 760 ? 2 : 1;
              return SliverGrid.builder(
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: columns,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                  mainAxisExtent: 126,
                ),
                itemCount: data.characters.length,
                itemBuilder: (context, index) {
                  final character = data.characters[index];
                  final race =
                      data.catalog.findById(character.raceId)?.name ??
                      'Raça indisponível';
                  final characterClass =
                      data.catalog.findById(character.classId)?.name ??
                      'Classe indisponível';
                  return _CharacterCard(
                    character: character,
                    race: race,
                    characterClass: characterClass,
                    onOpen: () => _openDetail(character, data.catalog),
                    onEdit: () => _openForm(data.catalog, character),
                    onDuplicate: () => _duplicate(character),
                    onDelete: () => _delete(character),
                  );
                },
              );
            },
          ),
        ),
      ],
    ),
  );

  void _message(String value) => ScaffoldMessenger.of(
    context,
  ).showSnackBar(SnackBar(content: Text(value)));
}

class _BrandTitle extends StatelessWidget {
  const _BrandTitle();

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Container(
        width: 42,
        height: 42,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.primary,
          border: Border.all(color: Theme.of(context).colorScheme.secondary),
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Text(
          '20',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900),
        ),
      ),
      const SizedBox(width: 10),
      Expanded(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'RPG Manager',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            Text(
              'Fichas inteligentes',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    ],
  );
}

class _Overview extends StatelessWidget {
  const _Overview({required this.data});

  final _HomeData data;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
    child: Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Suas fichas',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 3),
              Text(
                'Acompanhe recursos e retome sua sessão.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
        _CountBadge(label: '${data.characters.length} fichas'),
        const SizedBox(width: 6),
        _CountBadge(label: '${data.catalog.entries.length} cartões'),
      ],
    ),
  );
}

class _CountBadge extends StatelessWidget {
  const _CountBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
      borderRadius: BorderRadius.circular(6),
    ),
    child: Text(label, style: Theme.of(context).textTheme.labelSmall),
  );
}

class _CharacterCard extends StatelessWidget {
  const _CharacterCard({
    required this.character,
    required this.race,
    required this.characterClass,
    required this.onOpen,
    required this.onEdit,
    required this.onDuplicate,
    required this.onDelete,
  });

  final Character character;
  final String race;
  final String characterClass;
  final VoidCallback onOpen;
  final VoidCallback onEdit;
  final VoidCallback onDuplicate;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final hpProgress = character.maxHp <= 0
        ? 0.0
        : (character.currentHp / character.maxHp).clamp(0.0, 1.0);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onOpen,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(7),
                child: RpgImage(
                  url: character.imageUrl,
                  width: 82,
                  height: 102,
                  icon: Icons.person_outline,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      character.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '$race · $characterClass',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Text(
                          'Nível ${character.level}',
                          style: Theme.of(context).textTheme.labelSmall,
                        ),
                        const Spacer(),
                        Text(
                          'Vida ${character.currentHp}/${character.maxHp}',
                          style: Theme.of(context).textTheme.labelSmall,
                        ),
                      ],
                    ),
                    const SizedBox(height: 5),
                    LinearProgressIndicator(value: hpProgress, minHeight: 5),
                  ],
                ),
              ),
              PopupMenuButton<String>(
                tooltip: 'Ações da ficha',
                onSelected: (value) {
                  if (value == 'edit') onEdit();
                  if (value == 'duplicate') onDuplicate();
                  if (value == 'delete') onDelete();
                },
                itemBuilder: (_) => const [
                  PopupMenuItem(
                    value: 'edit',
                    child: ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(Icons.edit_outlined),
                      title: Text('Editar'),
                    ),
                  ),
                  PopupMenuItem(
                    value: 'duplicate',
                    child: ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(Icons.copy_outlined),
                      title: Text('Duplicar'),
                    ),
                  ),
                  PopupMenuItem(
                    value: 'delete',
                    child: ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(Icons.delete_outline),
                      title: Text('Excluir'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LoadingState extends StatelessWidget {
  const _LoadingState();

  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const CircularProgressIndicator(),
        const SizedBox(height: 14),
        Text(
          'Sincronizando Trello...',
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    ),
  );
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.cloud_off_outlined,
              size: 48,
              color: Theme.of(context).colorScheme.error,
            ),
            const SizedBox(height: 14),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Tentar novamente'),
            ),
          ],
        ),
      ),
    ),
  );
}
