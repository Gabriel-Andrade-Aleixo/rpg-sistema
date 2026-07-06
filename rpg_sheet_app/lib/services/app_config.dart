class AppConfig {
  const AppConfig._();

  // Recebe a URL por --dart-define ou --dart-define-from-file.
  // Enquanto estiver vazio, o app usa armazenamento em memoria para testes.
  static const backendUrl = String.fromEnvironment(
    'BACKEND_URL',
    defaultValue: '',
  );
}
