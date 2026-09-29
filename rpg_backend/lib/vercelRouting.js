export function restoreOriginalUrl(requestUrl = '/') {
  const url = new URL(requestUrl, 'https://runalith.local');
  const routedPath = url.searchParams.get('__runalith_path');
  if (routedPath == null) return `${url.pathname}${url.search}`;

  url.searchParams.delete('__runalith_path');
  const pathname = `/${routedPath}`.replace(/\/{2,}/g, '/');
  const query = url.searchParams.toString();
  return `${pathname}${query ? `?${query}` : ''}`;
}
