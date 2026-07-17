import 'package:flutter/material.dart';

import '../repositories/auth_repository.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key, required this.repository, required this.onDone});

  final AuthRepository repository;
  final Future<void> Function() onDone;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _displayName = TextEditingController();
  final _token = TextEditingController();
  var _mode = 'login';
  var _loading = false;
  var _message = '';

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _displayName.dispose();
    _token.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _message = '';
    });
    try {
      if (_mode == 'register') {
        await widget.repository.register(
          _email.text.trim(),
          _password.text,
          _displayName.text.trim(),
        );
        await widget.onDone();
      } else if (_mode == 'forgot') {
        final token = await widget.repository.requestPasswordReset(
          _email.text.trim(),
        );
        setState(() {
          _message = token.isEmpty
              ? 'Se o email existir, enviaremos as instruções de recuperação.'
              : 'Token de recuperação: $token';
        });
      } else if (_mode == 'reset') {
        await widget.repository.resetPassword(_token.text.trim(), _password.text);
        setState(() {
          _mode = 'login';
          _message = 'Senha atualizada. Entre novamente.';
        });
      } else {
        await widget.repository.login(_email.text.trim(), _password.text);
        await widget.onDone();
      }
    } catch (error) {
      setState(() => _message = 'Não foi possível continuar: $error');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 460),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: Theme.of(context).colorScheme.primary,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Text(
                            '20',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'RPG Manager',
                                style: Theme.of(context).textTheme.titleLarge,
                              ),
                              Text(
                                _title(),
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    if (_mode != 'reset')
                      TextField(
                        controller: _email,
                        keyboardType: TextInputType.emailAddress,
                        decoration: const InputDecoration(
                          labelText: 'Email',
                          prefixIcon: Icon(Icons.email_outlined),
                        ),
                      ),
                    if (_mode == 'register') ...[
                      const SizedBox(height: 12),
                      TextField(
                        controller: _displayName,
                        decoration: const InputDecoration(
                          labelText: 'Nome de exibição',
                          prefixIcon: Icon(Icons.person_outline),
                        ),
                      ),
                    ],
                    if (_mode == 'reset') ...[
                      const SizedBox(height: 12),
                      TextField(
                        controller: _token,
                        decoration: const InputDecoration(
                          labelText: 'Token de recuperação',
                          prefixIcon: Icon(Icons.key_outlined),
                        ),
                      ),
                    ],
                    if (_mode != 'forgot') ...[
                      const SizedBox(height: 12),
                      TextField(
                        controller: _password,
                        obscureText: true,
                        decoration: const InputDecoration(
                          labelText: 'Senha',
                          prefixIcon: Icon(Icons.lock_outline),
                        ),
                      ),
                    ],
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: _loading ? null : _submit,
                      child: Text(_loading ? 'Aguarde...' : _button()),
                    ),
                    if (_message.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      Text(_message),
                    ],
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        TextButton(
                          onPressed: () => setState(() {
                            _mode = _mode == 'login' ? 'register' : 'login';
                            _message = '';
                          }),
                          child: Text(
                            _mode == 'login' ? 'Criar conta' : 'Já tenho conta',
                          ),
                        ),
                        TextButton(
                          onPressed: () => setState(() {
                            _mode = 'forgot';
                            _message = '';
                          }),
                          child: const Text('Esqueci a senha'),
                        ),
                        TextButton(
                          onPressed: () => setState(() {
                            _mode = 'reset';
                            _message = '';
                          }),
                          child: const Text('Tenho token'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );

  String _title() => switch (_mode) {
    'register' => 'Criar conta',
    'forgot' => 'Recuperar senha',
    'reset' => 'Definir nova senha',
    _ => 'Entrar',
  };

  String _button() => switch (_mode) {
    'register' => 'Cadastrar',
    'forgot' => 'Solicitar recuperação',
    'reset' => 'Trocar senha',
    _ => 'Entrar',
  };
}
