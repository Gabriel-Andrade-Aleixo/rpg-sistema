import 'package:flutter/material.dart';

import 'core/theme/app_theme.dart';
import 'repositories/character_repository.dart';
import 'screens/home_screen.dart';
import 'services/app_config.dart';
import 'services/backend_api_service.dart';
import 'repositories/catalog_repository.dart';

void main() {
  final backendApiService = BackendApiService(baseUrl: AppConfig.backendUrl);
  runApp(
    RpgSheetApp(
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
  });

  final CharacterRepository repository;
  final CatalogRepository catalogRepository;

  @override
  State<RpgSheetApp> createState() => _RpgSheetAppState();
}

class _RpgSheetAppState extends State<RpgSheetApp> {
  ThemeMode _themeMode = ThemeMode.dark;

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
      home: HomeScreen(
        repository: widget.repository,
        catalogRepository: widget.catalogRepository,
        themeMode: _themeMode,
        onToggleTheme: _toggleTheme,
      ),
    );
  }
}
