const idPattern = /^[A-Za-z0-9_-]{11}$/;

export function parseYouTubeId(input: string): string | null {
  const value = input.trim();
  if (idPattern.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    let id: string | null = null;
    if (url.hostname === 'youtu.be' && parts.length === 1) id = parts[0];
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) {
      if (url.pathname === '/watch') id = url.searchParams.get('v');
      else if (parts.length === 2 && ['shorts', 'live'].includes(parts[0])) id = parts[1];
    }
    return id && idPattern.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function youtubeWatchUrl(id: string | null | undefined) {
  return id && idPattern.test(id) ? `https://www.youtube.com/watch?v=${id}` : null;
}
