import assert from 'node:assert/strict';
import test from 'node:test';

import { restoreOriginalUrl } from '../lib/vercelRouting.js';

test('restaura a rota de saúde encaminhada pela Vercel', () => {
  assert.equal(restoreOriginalUrl('/api?__runalith_path=health'), '/health');
});

test('preserva query string das rotas do backend', () => {
  assert.equal(
    restoreOriginalUrl('/api?__runalith_path=catalog&refresh=true'),
    '/catalog?refresh=true',
  );
});

test('restaura a rota usando req.query fornecido pela Vercel', () => {
  assert.equal(
    restoreOriginalUrl('/api', {
      __runalith_path: 'catalog',
      refresh: 'true',
      tag: ['arma', 'rara'],
    }),
    '/catalog?refresh=true&tag=arma&tag=rara',
  );
});

test('preserva segmentos dinâmicos codificados', () => {
  assert.equal(
    restoreOriginalUrl(
      '/api?__runalith_path=admin%2Fusers%2Fuser_123%2Fpassword',
    ),
    '/admin/users/user_123/password',
  );
});

test('não altera URLs recebidas diretamente no desenvolvimento local', () => {
  assert.equal(restoreOriginalUrl('/health'), '/health');
});
