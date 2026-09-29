import { requestHandler } from '../server.js';
import { restoreOriginalUrl } from '../lib/vercelRouting.js';

export default function vercelHandler(req, res) {
  req.url = restoreOriginalUrl(req.url, req.query);
  return requestHandler(req, res);
}
