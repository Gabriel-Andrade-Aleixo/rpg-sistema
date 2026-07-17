# Configuração

O Flutter acessa o Supabase/Postgres exclusivamente pelo backend Node.js. A URL do banco nunca deve ser enviada no aplicativo.

## Backend

Configure `../rpg_backend/.env` a partir de `.env.example` e execute:

```bash
cd ../rpg_backend
node server.js
```

O backend expõe autenticação, personagens e o catálogo oficial salvo no Supabase. A conexão do Supabase/Postgres fica somente no `.env` do backend:

```env
DATABASE_URL=postgresql://...
PASSWORD_RESET_BASE_URL=http://localhost:3000
AUTH_EXPOSE_RESET_TOKEN=true
```

Use `AUTH_EXPOSE_RESET_TOKEN=true` apenas em desenvolvimento ou enquanto ainda não houver envio real de email. Em produção, deixe desativado e conecte um provedor de email para entregar o link de recuperação.

## Flutter

O arquivo local `env.local.json` contém somente a URL do backend e está ignorado pelo Git:

```json
{
  "BACKEND_URL": "http://localhost:8787"
}
```

Execute:

```bash
flutter run --dart-define-from-file=env.local.json
```

Em um celular físico, troque `localhost` pelo IP do computador na rede local. Sem backend, fichas existentes podem ser mantidas no cache local, mas criação e edição ficam bloqueadas porque o catálogo oficial não pode ser validado.

## Fonte oficial

- Raças, classes, itens, equipamentos, habilidades e proficiências são lidos do catálogo oficial no Supabase.
- Imagens usam a URL cadastrada no item/magia; sem imagem, o app mostra um fallback visual.
- Regras ausentes permanecem indisponíveis e geram aviso. O app não cria valores genéricos.
- Personagens são salvos em JSONB na tabela `characters`, com histórico em `character_revisions`.
- Contas ficam em `rpg_users`, sessões em `auth_sessions` e recuperação de senha em `password_reset_tokens`.
- Cada usuário pode ter várias fichas. Fichas públicas aparecem para outros usuários apenas como resumo: nome, imagem, raça, classe e nível. Fichas privadas aparecem somente para o dono.
