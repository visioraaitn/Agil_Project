import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { AcceptanceCriterionInput } from '@visiora/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AcceptanceCriteriaEditorProps {
  criteria: AcceptanceCriterionInput[];
  onChange: (criteria: AcceptanceCriterionInput[]) => void;
  readOnly: boolean;
}

/** D.2 · Critères d'acceptation (Definition of Done). */
export function AcceptanceCriteriaEditor({
  criteria,
  onChange,
  readOnly,
}: AcceptanceCriteriaEditorProps) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const content = draft.trim();
    if (!content) return;
    onChange([...criteria, { content, isMet: false }]);
    setDraft('');
  };

  const met = criteria.filter((criterion) => criterion.isMet).length;

  return (
    <section>
      <div className="mb-1 flex items-center gap-2">
        <h3 className="text-ink-700 text-sm font-semibold">Critères d'acceptation</h3>
        {criteria.length > 0 && (
          <span className="text-ink-400 text-xs">
            {met}/{criteria.length} validé(s)
          </span>
        )}
      </div>

      {criteria.length === 0 && (
        <p className="text-ink-400 text-sm">Aucun critère défini.</p>
      )}

      <ul className="flex flex-col gap-1">
        {criteria.map((criterion, index) => (
          <li key={index} className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={criterion.isMet}
              disabled={readOnly}
              aria-label={`Critère validé : ${criterion.content}`}
              onChange={(event) =>
                onChange(
                  criteria.map((item, position) =>
                    position === index ? { ...item, isMet: event.target.checked } : item,
                  ),
                )
              }
              className="mt-1 size-3.5 shrink-0"
            />
            <span
              className={`flex-1 text-base ${criterion.isMet ? 'text-ink-400 line-through' : 'text-ink-700'}`}
            >
              {criterion.content}
            </span>
            {!readOnly && (
              <Button
                size="sm"
                variant="ghost"
                aria-label="Supprimer ce critère"
                onClick={() => onChange(criteria.filter((_, position) => position !== index))}
              >
                <Trash2 className="text-danger size-3" strokeWidth={1.75} />
              </Button>
            )}
          </li>
        ))}
      </ul>

      {!readOnly && (
        <div className="mt-1.5 flex gap-1.5">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                add();
              }
            }}
            placeholder="Ajouter un critère…"
            aria-label="Nouveau critère d'acceptation"
            className="h-6.5 text-sm"
          />
          <Button size="sm" onClick={add} disabled={!draft.trim()}>
            <Plus className="size-3.5" strokeWidth={2.5} />
          </Button>
        </div>
      )}
    </section>
  );
}
