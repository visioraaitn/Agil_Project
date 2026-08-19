import { useState, useMemo } from 'react';
import { CheckSquare, Copy, Check, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarkdownViewerProps {
  content?: string | null;
  className?: string;
  onToggleTask?: (taskIndex: number, newChecked: boolean) => void;
}

export function MarkdownViewer({ content, className, onToggleTask }: MarkdownViewerProps) {
  const elements = useMemo(
    () => (content && content.trim() ? parseMarkdown(content, onToggleTask) : null),
    [content, onToggleTask],
  );

  if (!elements) {
    return <p className="text-ink-400 text-sm italic">Aucun contenu.</p>;
  }

  return (
    <div className={cn('markdown-body text-ink-800 text-sm leading-relaxed space-y-2', className)}>
      {elements}
    </div>
  );
}

function parseMarkdown(
  text: string,
  onToggleTask?: (taskIndex: number, newChecked: boolean) => void,
): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLang = '';
  let codeBuffer: string[] = [];
  let taskCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;

    // Blocs de code ```lang ... ```
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <CodeBlock
            key={`code-${i}`}
            code={codeBuffer.join('\n')}
            language={codeLang}
          />,
        );
        inCodeBlock = false;
        codeBuffer = [];
        codeLang = '';
      } else {
        inCodeBlock = true;
        codeLang = line.trim().slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    // Titres #, ##, ###
    if (line.startsWith('### ')) {
      elements.push(
        <h4 key={i} className="text-ink-900 font-bold text-sm mt-3 mb-1">
          {renderInline(line.slice(4))}
        </h4>,
      );
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h3 key={i} className="text-ink-900 font-bold text-base mt-3 mb-1 border-b border-border-subtle pb-1">
          {renderInline(line.slice(3))}
        </h3>,
      );
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(
        <h2 key={i} className="text-ink-900 font-bold text-lg mt-4 mb-2 border-b border-border-default pb-1">
          {renderInline(line.slice(2))}
        </h2>,
      );
      continue;
    }

    // Citations >
    if (line.startsWith('> ')) {
      elements.push(
        <blockquote
          key={i}
          className="border-l-4 border-accent-400 bg-surface-muted px-3 py-1 text-ink-600 rounded-r italic"
        >
          {renderInline(line.slice(2))}
        </blockquote>,
      );
      continue;
    }

    // Listes de tâches - [ ] ou - [x]
    const taskMatch = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (taskMatch && taskMatch[1] !== undefined && taskMatch[2] !== undefined) {
      const isChecked = taskMatch[1].toLowerCase() === 'x';
      const taskText = taskMatch[2];
      const currentTaskIndex = taskCounter++;

      elements.push(
        <div key={i} className="flex items-center gap-2 py-0.5">
          <button
            type="button"
            onClick={() => onToggleTask?.(currentTaskIndex, !isChecked)}
            className="text-accent-600 hover:text-accent-700 cursor-pointer"
          >
            {isChecked ? (
              <CheckSquare className="size-4 text-accent-600" />
            ) : (
              <Square className="size-4 text-ink-400" />
            )}
          </button>
          <span className={cn('text-sm', isChecked && 'line-through text-ink-400')}>
            {renderInline(taskText)}
          </span>
        </div>,
      );
      continue;
    }

    // Listes à puces - ou *
    if (line.match(/^[-*]\s+(.*)$/)) {
      const itemText = line.replace(/^[-*]\s+/, '');
      elements.push(
        <li key={i} className="ml-4 list-disc text-sm">
          {renderInline(itemText)}
        </li>,
      );
      continue;
    }

    // Lignes vides
    if (!line.trim()) {
      elements.push(<div key={i} className="h-1.5" />);
      continue;
    }

    // Paragraphe classique
    elements.push(
      <p key={i} className="text-sm">
        {renderInline(line)}
      </p>,
    );
  }

  if (inCodeBlock && codeBuffer.length > 0) {
    elements.push(
      <CodeBlock
        key="code-final"
        code={codeBuffer.join('\n')}
        language={codeLang}
      />,
    );
  }

  return elements;
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-surface-sunken border-border-default my-2 overflow-hidden rounded border font-mono text-xs shadow-inner">
      <div className="bg-surface-muted border-border-subtle flex items-center justify-between border-b px-3 py-1">
        <span className="text-ink-500 font-semibold uppercase">{language || 'code'}</span>
        <button
          type="button"
          onClick={copy}
          className="text-ink-400 hover:text-ink-900 flex items-center gap-1 text-[11px]"
        >
          {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
          <span>{copied ? 'Copié' : 'Copier'}</span>
        </button>
      </div>
      <pre className="scrollbar-thin overflow-x-auto p-3 text-ink-900">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  // Images ![alt](url)
  const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  if (imgRegex.test(text)) {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    imgRegex.lastIndex = 0;
    while ((match = imgRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(renderInlineFormatting(text.slice(lastIndex, match.index)));
      }
      const imgSrc = match[2];
      const imgAlt = match[1] || 'Capture';
      if (imgSrc) {
        parts.push(
          <img
            key={match.index}
            src={imgSrc}
            alt={imgAlt}
            className="max-h-80 my-2 rounded border border-border-default object-contain shadow-sm cursor-zoom-in"
            onClick={() => window.open(imgSrc, '_blank')}
          />,
        );
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push(renderInlineFormatting(text.slice(lastIndex)));
    }
    return <>{parts}</>;
  }

  return renderInlineFormatting(text);
}

function renderInlineFormatting(text: string): React.ReactNode {
  // Parsing gras **text**, code `code`, italique *text*, liens [text](url)
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g);

  return tokens.map((tok, idx) => {
    if (tok.startsWith('`') && tok.endsWith('`') && tok.length >= 2) {
      return (
        <code
          key={idx}
          className="bg-surface-sunken text-accent-700 rounded border border-border-subtle px-1 py-0.5 font-mono text-xs"
        >
          {tok.slice(1, -1)}
        </code>
      );
    }
    if (tok.startsWith('**') && tok.endsWith('**') && tok.length >= 4) {
      return (
        <strong key={idx} className="font-semibold text-ink-900">
          {tok.slice(2, -2)}
        </strong>
      );
    }
    if (tok.startsWith('*') && tok.endsWith('*') && tok.length >= 2) {
      return (
        <em key={idx} className="italic">
          {tok.slice(1, -1)}
        </em>
      );
    }
    const linkMatch = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch && linkMatch[1] && linkMatch[2]) {
      return (
        <a
          key={idx}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-600 hover:text-accent-800 underline font-medium"
        >
          {linkMatch[1]}
        </a>
      );
    }
    return tok;
  });
}
