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

  @override
  void initState() {
    super.initState();
    _sessionFuture = widget.authRepository.loadSession();
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
      title: 'Fichas de RPG',
      debugShowCheckedModeBanner: false,
      themeMode: _themeMode,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      home: FutureBuilder<AuthSession?>(
        future: _sessionFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
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
