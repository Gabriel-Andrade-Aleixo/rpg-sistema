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
DATABASE_POOL_MAX=1
ALLOWED_ORIGINS=http://localhost:3000,https://seu-site.vercel.app
PASSWORD_RESET_BASE_URL=http://localhost:3000
AUTH_EXPOSE_RESET_TOKEN=true
SMTP_HOST=smtp.seu-provedor.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=usuario@dominio.com
SMTP_PASS=sua-senha-ou-app-password
MAIL_FROM="Runalith RPG <usuario@dominio.com>"
```

Use `AUTH_EXPOSE_RESET_TOKEN=true` somente em desenvolvimento. Em produção, deixe desativado. A redefinição de senha disponível na interface é feita pelo Mestre e encerra todas as sessões antigas do usuário.

Antes de iniciar o backend após uma atualização de esquema:

```bash
npm run db:migrate
```

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
- O Mestre pode enviar imagens PNG, JPEG, WebP ou GIF de até 2 MB, ou informar uma URL HTTPS; sem imagem, o app mostra um fallback visual.
- Regras ausentes permanecem indisponíveis e geram aviso. O app não cria valores genéricos.
- Personagens são salvos em JSONB na tabela `characters`, com histórico em `character_revisions`.
- Contas ficam em `rpg_users`, sessões em `auth_sessions` e recuperação de senha em `password_reset_tokens`.
- Cada usuário pode ter várias fichas. Fichas públicas aparecem para outros usuários apenas como resumo: nome, imagem, raça, classe e nível. Fichas privadas aparecem somente para o dono.
