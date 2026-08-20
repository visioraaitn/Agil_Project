import { useState, useRef } from 'react';
import {
  Bold,
  Italic,
  Heading2,
  Code,
  List,
  CheckSquare,
  Quote,
  Image as ImageIcon,
  Eye,
  Edit3,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownViewer } from './MarkdownViewer';

interface MarkdownEditorProps {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
  onUploadImage?: (file: File) => Promise<string>;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Rédigez en Markdown ou collez une capture d’écran (Ctrl + V)...',
  minHeight = '140px',
  className,
  onUploadImage,
}: MarkdownEditorProps) {
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [uploading, setUploading] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertText = (before: string, after = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.substring(start, end);
    const replacement = `${before}${selected || 'texte'}${after}`;
    const nextValue = value.substring(0, start) + replacement + value.substring(end);

    onChange(nextValue);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + (selected.length || 'texte'.length),
      );
    }, 0);
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) continue;
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        const textarea = textareaRef.current;
        const start = textarea?.selectionStart ?? value.length;
        const end = textarea?.selectionEnd ?? value.length;

        if (onUploadImage) {
          try {
            setUploading(true);
            const imageUrl = await onUploadImage(file);
            const imageMarkdown = `\n\n![Capture d'écran](${imageUrl})\n\n`;
            const nextValue = value.substring(0, start) + imageMarkdown + value.substring(end);
            onChange(nextValue);
            setNotification('Capture d’écran enregistrée dans le stockage objet avec succès !');
            setTimeout(() => setNotification(null), 3000);
          } catch {
            // fallback local base64 preview
            fallbackBase64(file, start, end);
          } finally {
            setUploading(false);
          }
        } else {
          fallbackBase64(file, start, end);
        }
        break;
      }
    }
  };

  const fallbackBase64 = (file: File, start: number, end: number) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        const imageMarkdown = `\n\n![Capture d'écran](${dataUrl})\n\n`;
        const nextValue = value.substring(0, start) + imageMarkdown + value.substring(end);
        onChange(nextValue);
        setNotification('Capture d’écran insérée avec succès !');
        setTimeout(() => setNotification(null), 3000);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={cn('border-border-default bg-surface rounded border overflow-hidden flex flex-col', className)}>
      {/* Barre d'outils Markdown */}
      <div className="bg-surface-muted border-border-subtle border-b px-2 py-1 flex items-center justify-between gap-1 flex-wrap">
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            icon={Bold}
            title="Gras (**texte**)"
            onClick={() => insertText('**', '**')}
          />
          <ToolbarButton
            icon={Italic}
            title="Italique (*texte*)"
            onClick={() => insertText('*', '*')}
          />
          <ToolbarButton
            icon={Heading2}
            title="Titre (### Titre)"
            onClick={() => insertText('### ', '')}
          />
          <span className="bg-border-default h-4 w-px mx-1" />
          <ToolbarButton
            icon={Code}
            title="Bloc de code (```ts ... ```)"
            onClick={() => insertText('```typescript\n', '\n```')}
          />
          <ToolbarButton
            icon={List}
            title="Liste à puces (- item)"
            onClick={() => insertText('- ', '')}
          />
          <ToolbarButton
            icon={CheckSquare}
            title="Liste de tâches (- [ ] tâche)"
            onClick={() => insertText('- [ ] ', '')}
          />
          <ToolbarButton
            icon={Quote}
            title="Citation (> citation)"
            onClick={() => insertText('> ', '')}
          />
          <ToolbarButton
            icon={ImageIcon}
            title="Insérer image (![alt](url))"
            onClick={() => insertText('![Description](', ')')}
          />
        </div>

        {/* Onglets Écrire / Aperçu */}
        <div className="flex items-center gap-1 bg-surface-sunken p-0.5 rounded border border-border-subtle">
          <button
            type="button"
            onClick={() => setTab('write')}
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded transition-colors',
              tab === 'write' ? 'bg-surface text-ink-900 shadow-xs' : 'text-ink-500 hover:text-ink-900',
            )}
          >
            <Edit3 className="size-3" />
            <span>Écrire</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('preview')}
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded transition-colors',
              tab === 'preview' ? 'bg-surface text-ink-900 shadow-xs' : 'text-ink-500 hover:text-ink-900',
            )}
          >
            <Eye className="size-3" />
            <span>Aperçu</span>
          </button>
        </div>
      </div>

      {uploading && (
        <div className="bg-blue-50 text-blue-800 border-b border-blue-200 px-3 py-1 text-xs font-medium flex items-center gap-2 animate-in fade-in">
          <Loader2 className="size-3.5 animate-spin text-blue-600" />
          <span>Téléversement de la capture d’écran vers le stockage objet...</span>
        </div>
      )}

      {notification && (
        <div className="bg-emerald-50 text-emerald-800 border-b border-emerald-200 px-3 py-1 text-xs font-medium animate-in fade-in">
          {notification}
        </div>
      )}

      {/* Zone de saisie ou d'aperçu */}
      {tab === 'write' ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={handlePaste}
          placeholder={placeholder}
          style={{ minHeight }}
          className="text-ink-900 placeholder:text-ink-400 bg-surface w-full resize-y p-3 text-sm focus:outline-none font-mono"
        />
      ) : (
        <div style={{ minHeight }} className="p-3 bg-surface overflow-y-auto">
          <MarkdownViewer content={value} />
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  title,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="text-ink-500 hover:text-ink-900 hover:bg-surface rounded p-1 transition-colors"
    >
      <Icon className="size-3.5" />
    </button>
  );
}
