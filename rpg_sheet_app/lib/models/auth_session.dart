class AuthSession {
  const AuthSession({
    required this.token,
    required this.email,
    required this.displayName,
    required this.role,
    this.expiresAt = '',
  });

  final String token;
  final String email;
  final String displayName;
  final String role;
  final String expiresAt;

  bool get isAdmin => role == 'admin';

  Map<String, dynamic> toJson() => {
    'token': token,
    'email': email,
    'displayName': displayName,
    'role': role,
    'expiresAt': expiresAt,
  };

  factory AuthSession.fromJson(Map<String, dynamic> json) => AuthSession(
    token: json['token']?.toString() ?? '',
    email: json['email']?.toString() ?? '',
    displayName: json['displayName']?.toString() ?? '',
    role: json['role']?.toString() ?? 'player',
    expiresAt: json['expiresAt']?.toString() ?? '',
  );
}
