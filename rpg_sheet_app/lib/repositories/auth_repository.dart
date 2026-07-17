import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../models/auth_session.dart';
import '../services/backend_api_service.dart';

class AuthRepository {
  AuthRepository(this._backend);

  static const _sessionKey = 'rpg_auth_session_v1';

  final BackendApiService _backend;

  Future<AuthSession?> loadSession() async {
    final preferences = await SharedPreferences.getInstance();
    final raw = preferences.getString(_sessionKey);
    if (raw == null || raw.isEmpty) return null;
    final session = AuthSession.fromJson(
      Map<String, dynamic>.from(jsonDecode(raw) as Map),
    );
    _backend.setAuthToken(session.token);
    return session.token.isEmpty ? null : session;
  }

  Future<AuthSession> login(String email, String password) async {
    final data = await _backend.login(email: email, password: password);
    return _save(data);
  }

  Future<AuthSession> register(
    String email,
    String password,
    String displayName,
  ) async {
    final data = await _backend.register(
      email: email,
      password: password,
      displayName: displayName,
    );
    return _save(data);
  }

  Future<Map<String, dynamic>> requestPasswordReset(String email) async {
    final data = await _backend.requestPasswordReset(email);
    return data;
  }

  Future<void> resetPassword(String token, String password) =>
      _backend.resetPassword(token: token, password: password);

  Future<void> logout() async {
    await _backend.logout();
    final preferences = await SharedPreferences.getInstance();
    await preferences.remove(_sessionKey);
  }

  Future<AuthSession> _save(Map<String, dynamic> data) async {
    final user = Map<String, dynamic>.from((data['user'] as Map?) ?? {});
    final session = AuthSession(
      token: data['token']?.toString() ?? '',
      email: user['email']?.toString() ?? '',
      displayName: user['displayName']?.toString() ?? '',
      role: user['role']?.toString() ?? 'player',
      expiresAt: data['expiresAt']?.toString() ?? '',
    );
    _backend.setAuthToken(session.token);
    final preferences = await SharedPreferences.getInstance();
    await preferences.setString(_sessionKey, jsonEncode(session.toJson()));
    return session;
  }
}
