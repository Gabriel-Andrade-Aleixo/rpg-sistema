import { requestHandler } from '../server.js';
import { restoreOriginalUrl } from '../lib/vercelRouting.js';

export default function vercelCatchAllHandler(req, res) {
  const incomingUrl = req.url;
  req.url = restoreOriginalUrl(req.url, req.query);
  console.info('[vercel-routing]', {
    entrypoint: 'catch-all',
    incomingPath: new URL(incomingUrl || '/', 'https://runalith.local').pathname,
    restoredPath: new URL(req.url || '/', 'https://runalith.local').pathname,
    queryKeys: Object.keys(req.query || {}),
    routeMatch: req.headers?.['x-now-route-matches'] || null,
    matchedPath: req.headers?.['x-matched-path'] || null,
  });
  return requestHandler(req, res);
}
