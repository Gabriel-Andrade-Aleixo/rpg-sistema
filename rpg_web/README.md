# RPG Web

Frontend web em Next.js, separado do app mobile Flutter.

## Rodar

```bash
npm install
npm run dev
```

Configure `.env.local`:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8787
```

O Trello não é acessado diretamente pelo web. O navegador conversa apenas com o backend.

## Recursos

- Criação guiada por raças, classes e itens oficiais do Trello.
- Bônus raciais e de equipamentos com origem rastreável.
- Fórmulas oficiais de vida, mana e recursos de classe.
- Vida inicial e por nível usando rolagem animada ou valor fixo.
- Histórico de rolagens e evolução salvo na ficha.
- Inventário, equipamentos, dinheiro e recursos durante a sessão.
- Catálogo pesquisável, modo mestre e validação de inconsistências.
- Prévia de exportação JSON preparada para futura geração de PDF e imagem.

Regras ausentes no Trello permanecem indisponíveis; o web não cria valores genéricos.
