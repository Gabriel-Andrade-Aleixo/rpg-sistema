# Integração Trello

As credenciais `TRELLO_API_KEY`, `TRELLO_TOKEN`, `TRELLO_BOARD_NAME` e `TRELLO_BOARD_ID` pertencem somente ao arquivo `../rpg_backend/.env`, que está ignorado pelo Git.

O mobile chama o backend por `BACKEND_URL`. A rota `GET /catalog` lê listas, cartões, etiquetas, anexos, capas e descrições do quadro. A rota aceita `?refresh=true` para invalidar o cache de cinco minutos.

Listas reconhecidas incluem `Personagens`, `Raças`, `Classes`, `Itens`, `Equipamentos`, `Habilidades`, `Proficiências`, `Criaturas e Monstros` e `Sistema`. Cada personagem é armazenado em um cartão com JSON entre os marcadores:

```text
<!-- RPG_CHARACTER_JSON_START -->
...
<!-- RPG_CHARACTER_JSON_END -->
```

Não edite manualmente o conteúdo entre os marcadores.

## Regras estruturadas

Classes e raças oficiais podem conter um segundo bloco:

```text
<!-- RPG_RULES_JSON_START -->
...
<!-- RPG_RULES_JSON_END -->
```

Esse JSON controla fórmulas de HP, mana, Defesa/CA, recursos, progressão de atributos, variantes raciais e bônus de rolagem. Alterações válidas passam a valer no web e no mobile após sincronizar o catálogo.

Para restaurar os metadados iniciais extraídos de `RPG SISTEMA.docx`:

```bash
cd ../rpg_backend
npm run sync:rules
```

O comando sobrescreve apenas o bloco estruturado das nove classes e quatro raças com regras fechadas; o texto legível do cartão é preservado.
