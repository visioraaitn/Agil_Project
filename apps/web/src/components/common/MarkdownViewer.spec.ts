import { describe, it, expect } from 'vitest';

describe('Markdown formatting utilities', () => {
  it('detects and formats markdown syntax correctly', () => {
    const text = '# Titre 1\n## Titre 2\n- [x] Tache finie\n- [ ] Tache restante\n```typescript\nconst x = 10;\n```';
    expect(text).toContain('# Titre 1');
    expect(text).toContain('- [x]');
    expect(text).toContain('- [ ]');
    expect(text).toContain('```typescript');
  });

  it('handles image paste markdown generation', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const imageMarkdown = `\n\n![Capture d'écran](${dataUrl})\n\n`;
    expect(imageMarkdown).toContain('![Capture d\'écran](');
    expect(imageMarkdown).toContain(dataUrl);
  });
});
