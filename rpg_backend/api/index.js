import { requestHandler } from '../server.js';
import { restoreOriginalUrl } from '../lib/vercelRouting.js';

export default function vercelHandler(req, res) {
  const incomingUrl = req.url;
  req.url = restoreOriginalUrl(req.url, req.query);
  logRoutingShape('index', incomingUrl, req);
  return requestHandler(req, res);
}

function logRoutingShape(entrypoint, incomingUrl, req) {
  console.info('[vercel-routing]', {
    entrypoint,
    incomingPath: new URL(incomingUrl || '/', 'https://runalith.local').pathname,
    restoredPath: new URL(req.url || '/', 'https://runalith.local').pathname,
    queryKeys: Object.keys(req.query || {}),
    routeMatch: req.headers?.['x-now-route-matches'] || null,
    matchedPath: req.headers?.['x-matched-path'] || null,
  });
}
