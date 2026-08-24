/** Retourne uniquement une URL HTTP(S) sans identifiants intégrés. */
export function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value, 'https://visiora.invalid');
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return value.startsWith('/') ? value : url.href;
  } catch {
    return null;
  }
}
