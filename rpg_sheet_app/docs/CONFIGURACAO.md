# Configuração

O Flutter acessa o Trello exclusivamente pelo backend Node.js. Chaves e tokens nunca devem ser enviados no aplicativo.

## Backend

Configure `../rpg_backend/.env` a partir de `.env.example` e execute:

```bash
cd ../rpg_backend
node server.js
```

O backend expõe personagens e o catálogo oficial do quadro `GERENCIAMENTO RPG`.

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

- Raças, classes, itens, equipamentos, habilidades e proficiências são lidos dos cartões do Trello.
- Imagens usam o anexo/capa do cartão; sem anexo, o app mostra um fallback visual.
- Regras ausentes permanecem indisponíveis e geram aviso. O app não cria valores genéricos.
- Personagens são salvos como JSON entre os marcadores do cartão na lista `Personagens`.
