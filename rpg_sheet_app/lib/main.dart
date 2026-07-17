import 'package:flutter/material.dart';

import 'core/theme/app_theme.dart';
import 'models/auth_session.dart';
import 'repositories/auth_repository.dart';
import 'repositories/character_repository.dart';
import 'screens/auth_screen.dart';
import 'screens/home_screen.dart';
import 'services/app_config.dart';
import 'services/backend_api_service.dart';
import 'repositories/catalog_repository.dart';

void main() {
  final backendApiService = BackendApiService(baseUrl: AppConfig.backendUrl);
  runApp(
    RpgSheetApp(
      authRepository: AuthRepository(backendApiService),
      repository: CharacterRepository(backendApiService: backendApiService),
      catalogRepository: CatalogRepository(backendApiService),
    ),
  );
}

class RpgSheetApp extends StatefulWidget {
  const RpgSheetApp({
    super.key,
    required this.repository,
    required this.catalogRepository,
    required this.authRepository,
  });

  final AuthRepository authRepository;
  final CharacterRepository repository;
  final CatalogRepository catalogRepository;

  @override
  State<RpgSheetApp> createState() => _RpgSheetAppState();
}

class _RpgSheetAppState extends State<RpgSheetApp> {
  ThemeMode _themeMode = ThemeMode.dark;
  late Future<AuthSession?> _sessionFuture;
  AuthSession? _session;
  bool _introDone = false;

  @override
  void initState() {
    super.initState();
    _sessionFuture = widget.authRepository.loadSession();
    Future<void>.delayed(const Duration(milliseconds: 1800), () {
      if (mounted) setState(() => _introDone = true);
    });
  }

  void _toggleTheme() {
    setState(() {
      _themeMode = _themeMode == ThemeMode.dark
          ? ThemeMode.light
          : ThemeMode.dark;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Runalith RPG',
      debugShowCheckedModeBanner: false,
      themeMode: _themeMode,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      home: FutureBuilder<AuthSession?>(
        future: _sessionFuture,
        builder: (context, snapshot) {
          if (!_introDone) return const RunalithIntro();
          if (snapshot.connectionState != ConnectionState.done) {
            return const RunalithIntro(compact: true);
          }
          _session ??= snapshot.data;
          if (_session == null) {
            return AuthScreen(
              repository: widget.authRepository,
              onDone: () async {
                final session = await widget.authRepository.loadSession();
                setState(() => _session = session);
              },
            );
          }
          return HomeScreen(
            repository: widget.repository,
            catalogRepository: widget.catalogRepository,
            authRepository: widget.authRepository,
            session: _session!,
            onLogout: () async {
              await widget.authRepository.logout();
              setState(() {
                _session = null;
                _sessionFuture = Future.value(null);
              });
            },
            themeMode: _themeMode,
            onToggleTheme: _toggleTheme,
          );
        },
      ),
    );
  }
}

class RunalithIntro extends StatelessWidget {
  const RunalithIntro({super.key, this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      body: Center(
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: 1),
          duration: const Duration(milliseconds: 780),
          curve: Curves.easeOutCubic,
          builder: (context, value, child) => Opacity(
            opacity: value,
            child: Transform.translate(
              offset: Offset(0, 18 * (1 - value)),
              child: Transform.scale(scale: .94 + value * .06, child: child),
            ),
          ),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 320),
            child: Padding(
              padding: const EdgeInsets.all(28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: scheme.secondary),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: .24),
                          blurRadius: 28,
                          offset: const Offset(0, 16),
                        ),
                      ],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(9),
                      child: Image.asset(
                        'assets/brand/runalith_icon.png',
                        width: compact ? 78 : 96,
                        height: compact ? 78 : 96,
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  Text(
                    'Runalith RPG',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    compact
                        ? 'Preparando sessão...'
                        : 'Fichas, grimório e dados vivos',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 22),
                  SizedBox(
                    width: 34,
                    height: 34,
                    child: CircularProgressIndicator(
                      strokeWidth: 3,
                      color: scheme.secondary,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
