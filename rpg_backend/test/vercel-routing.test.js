import assert from 'node:assert/strict';
import test from 'node:test';

import { restoreOriginalUrl } from '../lib/vercelRouting.js';

process.env.VERCEL = '1';

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

test('remove o prefixo interno da função catch-all', () => {
  assert.equal(
    restoreOriginalUrl('/api/catalog?refresh=true'),
    '/catalog?refresh=true',
  );
});

test('restaura segmentos da rota dinâmica fornecidos pela Vercel', () => {
  assert.equal(
    restoreOriginalUrl('/api', {
      path: ['admin', 'users'],
      page: '2',
    }),
    '/admin/users?page=2',
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

test('o adaptador catch-all entrega /health ao backend', async () => {
  const { default: handler } = await import('../api/[...path].js');
  const response = createMockResponse();
  const request = {
    method: 'GET',
    url: '/api/health',
    query: { path: ['health'] },
    headers: { host: 'rpg-sistema-api-liart.vercel.app' },
  };

  await handler(request, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), {
    ok: true,
    backend: 'rpg-backend',
    storage: 'postgres',
  });
});

function createMockResponse() {
  return {
    statusCode: null,
    body: '',
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      Object.assign(this.headers, headers);
    },
    end(value = '') {
      this.body += value;
    },
  };
}
