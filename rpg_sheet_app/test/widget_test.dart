import 'package:flutter_test/flutter_test.dart';
import 'package:rpg_sheet_app/main.dart';
import 'package:rpg_sheet_app/repositories/auth_repository.dart';
import 'package:rpg_sheet_app/repositories/character_repository.dart';
import 'package:rpg_sheet_app/services/backend_api_service.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:rpg_sheet_app/repositories/catalog_repository.dart';

void main() {
  testWidgets('mostra tela inicial vazia', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final repository = CharacterRepository(
      backendApiService: BackendApiService(baseUrl: ''),
    );

    await tester.pumpWidget(
      RpgSheetApp(
        authRepository: AuthRepository(BackendApiService(baseUrl: '')),
        repository: repository,
        catalogRepository: CatalogRepository(BackendApiService(baseUrl: '')),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('RPG Manager'), findsOneWidget);
    expect(find.text('Entrar'), findsWidgets);
  });
}
