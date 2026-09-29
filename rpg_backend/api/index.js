import { requestHandler } from '../server.js';
import { restoreOriginalUrl } from '../lib/vercelRouting.js';

export default function vercelHandler(req, res) {
  const incomingUrl = req.url;
  req.url = restoreOriginalUrl(req.url, req.query);
  setRoutingDebugHeaders(res, 'index', incomingUrl, req.url);
  logRoutingShape('index', incomingUrl, req);
  return requestHandler(req, res);
}

function setRoutingDebugHeaders(res, entrypoint, incomingUrl, restoredUrl) {
  res.setHeader('X-Runalith-Entrypoint', entrypoint);
  res.setHeader('X-Runalith-Incoming-Path', safePathname(incomingUrl));
  res.setHeader('X-Runalith-Restored-Path', safePathname(restoredUrl));
}

function safePathname(value) {
  return new URL(value || '/', 'https://runalith.local').pathname;
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
