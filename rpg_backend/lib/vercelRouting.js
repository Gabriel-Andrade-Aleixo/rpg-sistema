export function restoreOriginalUrl(requestUrl = '/', requestQuery = null) {
  const url = new URL(requestUrl, 'https://runalith.local');
  const routedPath = firstQueryValue(requestQuery?.__runalith_path)
    ?? url.searchParams.get('__runalith_path');
  const catchAllPath = queryPathValue(requestQuery?.path);
  if (routedPath == null && catchAllPath == null) {
    return `${stripApiPrefix(url.pathname)}${url.search}`;
  }

  const searchParams = requestQuery
    ? queryObjectToSearchParams(requestQuery)
    : new URLSearchParams(url.searchParams);
  searchParams.delete('__runalith_path');
  searchParams.delete('path');
  const pathname = `/${routedPath ?? catchAllPath}`.replace(/\/{2,}/g, '/');
  const query = searchParams.toString();
  return `${pathname}${query ? `?${query}` : ''}`;
}

function stripApiPrefix(pathname) {
  if (pathname === '/api') return '/';
  return pathname.startsWith('/api/') ? pathname.slice(4) : pathname;
}

function queryObjectToSearchParams(query) {
  const result = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(query || {})) {
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) {
      if (value != null) result.append(key, String(value));
    }
  }
  return result;
}

function firstQueryValue(value) {
  if (Array.isArray(value)) return value[0] == null ? null : String(value[0]);
  return value == null ? null : String(value);
}

function queryPathValue(value) {
  if (Array.isArray(value)) return value.map(String).join('/');
  return value == null ? null : String(value);
}
