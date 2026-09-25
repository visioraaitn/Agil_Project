# Backlog — Reference Implementation Audit

```
Repository:      visioraaitn/Agil_Project
Branch:          main
Commit:          5df87cd0e28e2b1e323cfa113245b1e21efe9f13
Audit scope:     Backlog feature — frontend + backend + database + permissions + tests
Audit method:    Static reverse-engineering of the checked-out working tree. No code was
                  modified, refactored or fixed as part of this audit.
```

> Every claim below is backed by a `File:` / `Line(s):` / `Symbol:` reference to code that
> exists in this commit. Where the UI screenshot described by the requester implies behavior
> that is **not** present in the code, this is explicitly marked `NOT CONFIRMED IN CODE` rather
> than assumed.

---

## 1. Executive Summary

The Backlog is one view over a **single unified ticket table** (`WorkItem`) that also powers the
Task Board, the Roadmap, Sprints, and Pull Request linkage. There is no separate `Epic`, `Story`,
or `Task` table — a `type` enum column (`EPIC | STORY | BUG | SUBTASK`) discriminates the row, and
a self-referencing `parentId` foreign key builds the hierarchy (`apps/api/prisma/schema.prisma:352-416`).

Architecture, end to end:

1. **Database (PostgreSQL/Prisma)** — `WorkItem` carries two independent ordering fields
   (`rank` for the backlog, `boardRank` for the Kanban column), a human-readable `number` that is
   allocated per `(projectId, type, parentId)` scope, and soft-delete via `deletedAt`
   (`schema.prisma:352-416`).
2. **Backend (NestJS)** — `WorkItemsService.getBacklog()` fetches **all** matching rows for the
   project in one query and rebuilds the tree in memory (`work-items.service.ts:45-71`), rather
   than doing N recursive queries. Row-level authorization is enforced by two global guards
   (`JwtAuthGuard`, `ProjectPermissionGuard`) that re-resolve the caller's role from the database
   on every request — no role or permission ever lives inside the JWT.
3. **API contract** — `GET /projects/:projectId/backlog` returns a `BacklogNode[]` tree; the same
   query-string filter shape (`WorkItemFilters`, defined once in `packages/shared`) drives both
   the backlog and the board, and both Zod schema and TypeScript type are shared between the
   NestJS `ZodValidationPipe` and the React form/query layer.
4. **Frontend data layer (TanStack Query)** — `useBacklog()` is a plain `useQuery`; there is no
   optimistic update for backlog reordering (unlike the board's `useMoveWorkItem`, which patches
   the cache before the server responds). Reordering the backlog waits for the server response and
   relies on broad query invalidation (`hooks.ts:154-161`).
5. **Frontend rendering** — `BacklogPage.tsx` flattens the tree client-side, respecting a
   `collapsed: Set<string>` of manually toggled rows, and renders one flat list of rows with
   `@dnd-kit` providing keyboard- and pointer-accessible drag handles.

Why it feels responsive and professional, from the code:
- A **single fetch** builds the whole tree, so expand/collapse is instant (client-side, no extra
  network round trip) — `BacklogPage.tsx:224-237` (`flattenVisible`).
- **Fractional (LexoRank) ranking** means a drag-and-drop move is always a single `UPDATE`
  statement, never a bulk renumbering of siblings (`packages/shared/src/lexorank.ts`).
- **Optimistic UI only where it matters for perceived latency** (the board's column drag), while
  the backlog — where reorders are rarer and less latency-sensitive — takes the simpler
  invalidate-and-refetch path.
- **One permission matrix** (`packages/shared/src/permissions.ts`) is imported by both the NestJS
  guard and the React `useProjectPermissions()` hook, so a role change is enforced in exactly one
  place and never drifts between client and server.

---

## 2. File Inventory

| Layer | File | Responsibility |
|---|---|---|
| DB | `apps/api/prisma/schema.prisma:352-431` | `WorkItem`, `WorkItemAssignee`, `WorkItemLabel` models |
| DB | `apps/api/prisma/migrations/20260807225705_work_item_board_rank/` | Introduces the separate `boardRank` column |
| DB | `apps/api/prisma/migrations/20260824170000_scope_work_item_numbers/` | Moves ticket numbering from a global counter to a scoped one |
| DB | `apps/api/prisma/migrations/20260825120000_project_roles_and_multiple_assignees/` | Adds `WorkItemAssignee` (multi-assignee) |
| Shared | `packages/shared/src/enums.ts` | `WorkItemType`, `WorkItemStatus`, `Priority`, `BOARD_COLUMNS`, `LABELS_FR` |
| Shared | `packages/shared/src/dto/work-item.ts` | `ALLOWED_PARENT_TYPES`, Zod schemas (`create`, `update`, `move`, `filters`), `WorkItemSummary`/`BacklogNode`/`BoardColumn` response shapes |
| Shared | `packages/shared/src/dto/work-item.spec.ts` | Unit tests for hierarchy rules and schemas |
| Shared | `packages/shared/src/permissions.ts` | `PERMISSIONS`, `ROLE_PERMISSIONS`, `can()` |
| Shared | `packages/shared/src/lexorank.ts` | Fractional-indexing rank algorithm |
| Shared | `packages/shared/src/lexorank.spec.ts` | Rank algorithm tests |
| Backend | `apps/api/src/modules/work-items/work-items.controller.ts` | REST endpoints: backlog, board, CRUD, move, reorder |
| Backend | `apps/api/src/modules/work-items/work-items.service.ts` | All business rules: hierarchy, numbering, filters, soft delete |
| Backend | `apps/api/src/modules/work-items/work-item.mapper.ts` | Prisma `select` shapes, `workItemKey()` (ticket key generation), row → DTO mapping |
| Backend | `apps/api/src/modules/work-items/ranking.service.ts` | `computeRank()` / `initialRanks()` — LexoRank neighbour resolution |
| Backend | `apps/api/src/modules/work-items/work-items.service.spec.ts` | Unit tests for multi-assignee create/update |
| Backend | `apps/api/src/modules/work-items/work-item-numbering.spec.ts` | Unit tests for `smallestAvailableNumber()` and `workItemKey()` |
| Backend | `apps/api/src/modules/work-items/ranking.service.spec.ts` | Unit tests for rank insertion, ties, board vs backlog isolation |
| Backend | `apps/api/src/modules/access/project-access.service.ts` | Resolves project role from DB per request |
| Backend | `apps/api/src/common/guards/project-permission.guard.ts` | Enforces `@RequirePermission()` + project membership |
| Backend | `apps/api/src/modules/labels/labels.service.ts` | Label CRUD (project-scoped) |
| Backend | `apps/api/src/modules/collaboration/collaboration.service.ts` | Comments + `ActivityLog` (comments only, see §24) |
| Backend | `apps/api/src/modules/reports/reports.service.ts` | Global search across work items (`search()`) |
| Frontend | `apps/web/src/features/backlog/pages/BacklogPage.tsx` | Backlog page: tree flattening, DnD, header, row rendering |
| Frontend | `apps/web/src/features/work-items/components/FiltersBar.tsx` | Shared filter toolbar (backlog + board) |
| Frontend | `apps/web/src/features/work-items/components/WorkItemChrome.tsx` | `TypeIcon`, `StatusPill`, `PriorityBadge`, `StoryPoints`, `LabelChips` |
| Frontend | `apps/web/src/features/work-items/components/CreateWorkItemDialog.tsx` | New-ticket modal |
| Frontend | `apps/web/src/features/work-items/components/WorkItemDetailPanel.tsx` | Slide-over ticket detail/edit panel |
| Frontend | `apps/web/src/features/work-items/components/AssigneeSelector.tsx` | Multi-select assignee checklist |
| Frontend | `apps/web/src/features/work-items/components/AcceptanceCriteriaEditor.tsx` | Acceptance criteria checklist editor |
| Frontend | `apps/web/src/features/work-items/hooks.ts` | TanStack Query hooks: `useBacklog`, `useReorderBacklog`, `useMoveWorkItem`, etc. |
| Frontend | `apps/web/src/features/work-items/api.ts` | REST client calls + query-string serialization |
| Frontend | `apps/web/src/features/work-items/use-url-work-item-filters.ts` | Filters ⇄ URL query string sync |
| Frontend | `apps/web/src/components/common/Avatar.tsx` | Single avatar (image or initials) |
| Frontend | `apps/web/src/components/common/AvatarStack.tsx` | Overlapping avatar stack with `+N` overflow |
| Frontend | `apps/web/src/features/board/pages/BoardPage.tsx` | Task Board (shares filters/hooks/chrome with backlog) |
| Frontend | `apps/web/src/features/work-items/components/WorkItemCard.tsx` | Board card (Jira-style) |
| Frontend | `apps/web/src/layouts/Sidebar.tsx` | Left nav, project switcher |
| Frontend | `apps/web/src/styles/globals.css` | Design tokens (color, type scale) |
| Test | `apps/web/tests/e2e/auth-navigation.spec.ts` | E2E: nav visibility, URL-persisted filters, keyboard DnD handles |
| Test | `packages/shared/src/permissions.spec.ts` | RBAC matrix tests |

---

## 3. Database Model

### 3.1 `WorkItem` (the unified ticket table)

`File: apps/api/prisma/schema.prisma:352-416`

| Column | Type | Notes |
|---|---|---|
| `id` | `String` (UUID) | PK |
| `projectId` | `String` | FK → `Project`, `onDelete: Cascade` |
| `number` | `Int` | Scoped, reusable local sequence — see §7 |
| `type` | `WorkItemType` | `EPIC \| STORY \| SUBTASK \| BUG` |
| `title` | `String` | |
| `status` | `WorkItemStatus` | `TODO \| IN_PROGRESS \| IN_TEST \| READY_FOR_APPROVAL \| DONE`, default `TODO` |
| `description` | `String?` | PO-facing framing text |
| `technicalNotes` | `String?` | Assignee-facing implementation notes |
| `priority` | `Priority` | `LOW \| MEDIUM \| HIGH \| CRITICAL`, default `MEDIUM` |
| `storyPoints` | `Int?` | Nullable — see §10 |
| `rank` | `String` | LexoRank key, backlog order among siblings |
| `boardRank` | `String` | LexoRank key, board-column order — **independent of `rank`** |
| `isBlocked` / `blockedReason` | `Boolean` / `String?` | Drives the dashboard's "blocked" widget |
| `startDate` / `dueDate` | `DateTime? @db.Date` | Roadmap positioning |
| `parentId` | `String?` | Self-FK, `onDelete: Cascade` |
| `sprintId` | `String?` | FK → `Sprint`, `onDelete: SetNull` |
| `assigneeId` | `String?` | FK → `User`, `onDelete: SetNull` — **legacy, first-assignee compatibility field** (see §12) |
| `reporterId` | `String` | FK → `User`, **not nullable**, no `onDelete: SetNull` clause shown — creator record |
| `createdAt` / `updatedAt` | `DateTime` | Standard timestamps |
| `closedAt` | `DateTime?` | Set when status transitions to `DONE`, cleared on reopen |
| `deletedAt` | `DateTime?` | Soft delete |

Relations: `project`, `parent`/`children` (self-relation `"WorkItemHierarchy"`), `sprint`,
`assignee` (legacy singular), `assignees` (`WorkItemAssignee[]`), `reporter`, `labels`
(`WorkItemLabel[]`), `acceptanceCriteria`, `attachments`, `comments`, `pullRequests`.

Indexes (`schema.prisma:408-415`):
```
@@index([projectId, status])
@@index([projectId, type, rank])
@@index([projectId, parentId, type, number])
@@index([projectId, status, boardRank])
@@index([sprintId, status])
@@index([assigneeId])
@@index([parentId])
@@index([deletedAt])
```
**No `@@unique` constraint exists on `(projectId, type, parentId, number)`** — uniqueness of the
ticket number is enforced purely at the application layer (see §7, §29). This is a documented
gap, not an assumption.

### 3.2 `WorkItemAssignee` — the real multi-assignee join table

`File: apps/api/prisma/schema.prisma:421-431`
Composite PK `(workItemId, userId)`, both `onDelete: Cascade`. The Prisma comment at line 418-420
states explicitly: *"`WorkItem.assigneeId` remains temporarily the first assignee for
API/rollback compatibility; this table is the source of truth for new writes."*

### 3.3 `WorkItemLabel` — many-to-many labels

`File: schema.prisma:298-308`. Composite PK `(workItemId, labelId)`, both cascade-delete.

### 3.4 `Label` — project-scoped, not global

`File: schema.prisma:285-296`. `@@unique([projectId, name])` — label names are unique per
project, not platform-wide. `color` is a free `String` with a default `#0078D4`, validated at the
application layer as a `#RRGGBB` hex string (`packages/shared/src/dto/label.ts:3-5`).

### 3.5 `AcceptanceCriterion`

`File: schema.prisma:434-445`. One row per criterion, `position: Int` for manual ordering,
`isMet: Boolean`. **Not** modeled as JSON — it's a proper child table with its own `id`.

### 3.6 Relations diagram (as implemented)

```
Project
 └─ WorkItem (type: EPIC | STORY | BUG | SUBTASK)
     ├─ parent → WorkItem?           (self-FK, onDelete Cascade)
     ├─ children[] → WorkItem[]
     ├─ reporter → User              (required, "creator", never null)
     ├─ assignee → User?             (legacy single-assignee compatibility column)
     ├─ assignees[] → WorkItemAssignee → User   (source of truth, many-to-many)
     ├─ labels[] → WorkItemLabel → Label        (many-to-many, project-scoped)
     ├─ acceptanceCriteria[] → AcceptanceCriterion
     ├─ sprint → Sprint?             (onDelete SetNull)
     ├─ attachments[] → Attachment
     ├─ comments[] → Comment
     ├─ pullRequests[] → PullRequest
     ├─ rank: String                 (backlog order, siblings only)
     └─ boardRank: String            (board-column order)
```

---

## 4. Parent/Child Hierarchy

**File:** `packages/shared/src/dto/work-item.ts:11-23`
**Symbol:** `ALLOWED_PARENT_TYPES`, `REQUIRES_PARENT`, `canBeChildOf()`

```ts
export const ALLOWED_PARENT_TYPES: Record<WorkItemType, readonly WorkItemType[]> = {
  [WorkItemType.EPIC]: [],
  [WorkItemType.STORY]: [WorkItemType.EPIC],
  [WorkItemType.BUG]: [WorkItemType.EPIC],
  [WorkItemType.SUBTASK]: [WorkItemType.STORY, WorkItemType.BUG],
};
export const REQUIRES_PARENT: readonly WorkItemType[] = [WorkItemType.SUBTASK];
```

Confirmed rules:
- **Epic** can never have a parent (root only).
- **Story** and **Bug** may be root-level *or* attached to an Epic (parent is optional).
- **Subtask** *must* have a parent, and that parent must be a Story or a Bug (never an Epic,
  never another Subtask). Enforced client-side (form validation, `CreateWorkItemDialog.tsx:59-61`)
  and authoritatively server-side (`WorkItemsService.assertHierarchy()`,
  `work-items.service.ts:505-537`).
- Hierarchy depth is **capped at 3 levels** by construction: `Epic → Story/Bug → Subtask`. There is
  no recursive "unlimited nesting" — `collectDescendants()` even comments *"la hiérarchie est
  bornée à 3 niveaux"* (`work-items.service.ts:558-574`).
- Cycle protection: `assertNoCycle()` walks the descendant set of the item being moved and rejects
  the change if the proposed new parent is itself a descendant, or the item itself
  (`work-items.service.ts:539-556`).

This table is **the single authority**; the note at `work-item.ts:6-10` states: *"Cette table est
la seule autorité — le service la consulte avant d'accepter un `parentId`."* Both the create
dialog and the detail panel filter their parent `<select>` options through
`ALLOWED_PARENT_TYPES[currentType]` (`CreateWorkItemDialog.tsx:59-60`,
`WorkItemDetailPanel.tsx:104`) — but this is UX convenience only; the server re-validates
independently (`work-items.service.ts:200-203`, `318-321`).

### 4.1 The `1/4` child counter — exact formula

**File:** `apps/api/src/modules/work-items/work-items.service.ts:486-503`
**Symbol:** `WorkItemsService.computeAggregates()`

```ts
private computeAggregates(rows: WorkItemSummaryRow[]): Map<string, ChildAggregate> {
  const aggregates = new Map<string, ChildAggregate>();
  for (const row of rows) {
    if (!row.parentId) continue;
    const current = aggregates.get(row.parentId) ?? { childCount: 0, doneChildCount: 0, rolledUpPoints: 0 };
    current.childCount += 1;
    if (row.status === WorkItemStatus.DONE) current.doneChildCount += 1;
    current.rolledUpPoints += row.storyPoints ?? 0;
    aggregates.set(row.parentId, current);
  }
  return aggregates;
}
```

`childCount` / `doneChildCount` = **count of direct children only** (one level down), computed
from the same flat row set already fetched for the backlog/board query — **not** a recursive
sum across the whole subtree, and **not** a separate `COUNT(*)` SQL query per row. Rendered at
`BacklogPage.tsx:316-320`:
```tsx
{hasChildren && (
  <span className="text-ink-400 shrink-0 text-xs">
    {node.doneChildCount}/{node.childCount}
  </span>
)}
```
So `1/4` reads literally as *"1 of this node's 4 direct children has `status === DONE`"*. A
Subtask under a Story does **not** count toward the Epic's ratio — only the Story would (a Story
with 4 Subtasks shows `x/4`; the Epic containing that Story shows its own direct-children ratio,
e.g. `x/1` if it has a single Story).

### 4.2 Story-points roll-up (related, same code path)

Also from `computeAggregates`: `rolledUpPoints` sums `storyPoints` of **direct children only**.
`toWorkItemSummary()` then does:
```ts
rolledUpPoints: aggregate.rolledUpPoints || (row.storyPoints ?? 0),
```
(`work-item.mapper.ts:157-162`) — i.e. if a node has no children (or all-null child points), it
falls back to its own `storyPoints`. This is **not** a recursive grandchildren sum: an Epic's
`rolledUpPoints` is the sum of its direct Stories'/Bugs' own `storyPoints`, not the sum of their
Subtasks. Confirmed by the epic-level hint text in the detail panel:
`WorkItemDetailPanel.tsx:268-275` → `` `Total descendants : ${item.rolledUpPoints}` ``, and by the
single-level aggregation logic above (there is no second pass over grandchildren).

---

## 5. Ticket Identifiers (`VIS-1`, `VIS-1-2`, …)

**File:** `apps/api/src/modules/work-items/work-item.mapper.ts:92-119`
**Symbol:** `workItemKey()`

The requester's prompt assumed a scheme like `IIT-1` / `IIT-1-1` / `IIT-1-2`. **The actual scheme
is different and type-aware.** Verified by
`apps/api/src/modules/work-items/work-item-numbering.spec.ts:13-26`:

```ts
workItemKey('VIS', epic)                         // → "VIS-1"
workItemKey('VIS', { ...story, parent: epic })    // → "VIS-1-2"
workItemKey('VIS', { ...subtask, parent: story }) // → "VIS-1-2-T1"
workItemKey('VIS', rootStory)                     // → "VIS-US-1"  (no epic parent)
workItemKey('VIS', rootBug)                       // → "VIS-B1"    (root-level bug)
```

Algorithm: walk from the node up to its root ancestor, then render each ancestor left-to-right:
- `BUG` → always `B{number}` (whether root or nested under an Epic, e.g. `VIS-1-B2`).
- `SUBTASK` → always `T{number}`.
- `STORY` **at the root** (no parent) → `US-{number}` (disambiguates a parentless story from a
  bare epic number).
- Anything else (an Epic, or a Story that *does* have an Epic parent) → the raw `{number}`.

So a Story attached to Epic `VIS-1` as its 2nd child is `VIS-1-2`; the **same Story type, without
an Epic**, would render as `VIS-US-1` — not `VIS-1`. This is intentional disambiguation (`VIS-1`
alone always means "Epic #1"; `VIS-US-1` means "root Story #1"). `Project.key` (e.g. `VIS`) is the
project's short code, unique per project (`schema.prisma:103`), used as the prefix.

### 5.1 Are keys database IDs?
No. The database primary key is a UUID (`id`). The **key is derived at read time** from
`(project.key, type, number, parent chain)` — it is never stored as a column. `number` is a plain
`Int` stored on `WorkItem` (§3.1).

### 5.2 Allocation and concurrency protection

**File:** `apps/api/src/modules/work-items/work-items.service.ts:450-483`
**Symbol:** `nextAvailableNumber()`, `numberedTransaction()`, `smallestAvailableNumber()`

```ts
private async nextAvailableNumber(tx, projectId, type, parentId): Promise<number> {
  const rows = await tx.workItem.findMany({
    where: { projectId, type, parentId, deletedAt: null },
    select: { number: true },
    orderBy: { number: 'asc' },
  });
  return smallestAvailableNumber(rows.map((row) => row.number));
}
```
`smallestAvailableNumber` (`work-items.service.ts:657-666`) returns the first strictly-positive
integer missing from the sorted list — i.e. **numbers are reused**, not monotonically increasing.
This allocation happens inside `numberedTransaction()`, which runs the whole
read-then-write at **`Serializable` isolation**, and **retries up to 4 times** on
`P2002` (unique violation) or `P2034` (serialization failure) before giving up
(`work-items.service.ts:465-483`). Two users creating a ticket in the same scope simultaneously
cannot receive the same number: Postgres will abort one of the two serializable transactions, and
the retry loop re-reads the now-updated sibling set.

> **Weakness worth flagging (§29, §35):** correctness depends entirely on the `Serializable`
> isolation level plus the retry loop — there is **no database-level unique constraint**
> backstopping `(projectId, type, parentId, number)`. If a future change accidentally used a
> lower isolation level, duplicate numbers would become silently possible.

### 5.3 Scope: `Project.lastItemNumber` is legacy

`schema.prisma:111-113`: *"Ancien compteur global conservé pour compatibilité avec les données
existantes. Les nouveaux tickets utilisent une numérotation locale par type et parent."*
(Old global counter kept for legacy-data compatibility; new tickets use scoped numbering.) It is
**not read or written** anywhere in `work-items.service.ts` — dead weight from a prior design,
confirmed by its absence from any `nextAvailableNumber`/`create` code path.

### 5.4 What happens on delete? Can keys change?

- **Soft delete** (§23) sets `deletedAt`; the row is excluded from `nextAvailableNumber`'s query
  (`deletedAt: null` filter), so its **number becomes available for reuse by a new ticket** in the
  same scope. The deleted ticket's own stored `number` does not change, but if it were ever
  restored (no restore feature exists in this codebase — see §23), it could collide with a newly
  created ticket that reused its number. **NOT CONFIRMED IN CODE**: there is no restore endpoint,
  so this collision scenario is theoretical, not reachable through the current API surface.
- **Re-parenting changes the key.** When `update()` or `move()` changes `parentId`
  (`changesParent === true`), the service calls `nextAvailableNumber()` again for the **new**
  scope and overwrites `number` (`work-items.service.ts:216-222` for `update`, `364-370` for
  `move`). Since the key is derived from `number` + parent chain, **moving a ticket to a different
  parent changes its displayed key** (e.g. `VIS-1-2` could become `VIS-1-5` if moved under a
  different Epic, or `VIS-US-1` if detached to root). This directly answers "can ticket keys
  change?" — **yes**, on re-parenting.

---

## 6. Status System

**File:** `packages/shared/src/enums.ts:55-70`, `packages/shared/src/enums.ts:171-177` (labels),
`apps/web/src/features/work-items/components/WorkItemChrome.tsx:44-54` (colors)

| Enum value | French label | Badge tone (Tailwind) | "Completed"? |
|---|---|---|---|
| `TODO` | À faire | `neutral` (`bg-surface-sunken text-ink-500`) | No |
| `IN_PROGRESS` | En cours | `accent` (`bg-accent-50 text-accent-700`) | No |
| `IN_TEST` | En test | `warning` (`bg-orange-50 text-warning`) | No |
| `READY_FOR_APPROVAL` | Prêt pour approbation | `warning` (same tone as `IN_TEST`) | No |
| `DONE` | Terminé | `success` (`bg-green-50 text-success`) | **Yes** |

`BOARD_COLUMNS` (`enums.ts:64-70`) fixes this exact order for the 5 Task Board columns.

- **Hardcoded, not database-configurable.** Statuses are a Prisma `enum` (`schema.prisma:337-343`)
  mirrored 1:1 as a TS const object in `packages/shared`. There is no `Status` table, no
  per-project workflow configuration. (The Board's *columns* are cosmetically configurable per
  project via `localStorage` — `board-config.ts:28-41` — but the underlying 5-value status enum is
  fixed; a custom board column still maps to one of these 5 statuses.)
- **"Completed" = `status === WorkItemStatus.DONE`**, a strict equality check, not a
  category/group concept. Confirmed at every site that treats completion:
  `hideDone` filter → `{ status: { not: WorkItemStatus.DONE } }` (`work-items.service.ts:430`);
  `doneChildCount` → `row.status === WorkItemStatus.DONE` (`work-items.service.ts:497`);
  row dimming → `node.status === WorkItemStatus.DONE && 'opacity-60'` (`BacklogPage.tsx:267`).
- **Allowed transitions: none are enforced.** `updateWorkItemSchema` accepts any
  `WorkItemStatus` value (`work-item.ts:63`) and the service applies it directly
  (`work-items.service.ts:228-240`) — there is no state machine / transition table. Any member with
  `workitem:update` (backlog/detail panel) or `workitem:move` (board drag) can set any status
  directly to any other status, including jumping straight from `TODO` to `DONE`.
- **Side effect on `DONE`:** `closedAt` is set to `new Date()` the moment status becomes `DONE`
  from a non-`DONE` state, and cleared (`null`) the moment it moves away from `DONE`
  (`work-items.service.ts:208-210, 249-250` for `update`; `330-332` for board `move`).
- **Who can change it:** `workitem:update` permission for the detail-panel `<select>`
  (`WorkItemDetailPanel.tsx:227-241`, gated by `RequirePermission('workitem:update')` on
  `PATCH /work-items/:itemId`); `workitem:move` for board drag-and-drop (`RequirePermission('workitem:move')`
  on `POST /work-items/:itemId/move`). Both are project-role permissions (`PROJECT_LEAD` has both by
  default; `MEMBER` has both too — see §25).

---

## 7. Priority System

**File:** `packages/shared/src/enums.ts:72-78`, `WorkItemChrome.tsx:33-42`

| Enum value | French label | Badge tone |
|---|---|---|
| `LOW` | Basse | `neutral` |
| `MEDIUM` | Moyenne | `neutral` (same tone as LOW — **not visually distinct** by color, only by text) |
| `HIGH` | Haute | `warning` |
| `CRITICAL` | Critique | `danger` |

- Stored as a plain Prisma `enum Priority` column, default `MEDIUM`
  (`schema.prisma:345-350, 367`).
- **No numeric sort weight exists.** `WorkItemSortBy.PRIORITY` sorts by the underlying Prisma
  column directly (`buildOrderBy()`, `work-items.service.ts:436-448`) — since Postgres enums sort
  by **declaration order**, and the enum is declared `LOW, MEDIUM, HIGH, CRITICAL`
  (`schema.prisma:345-350`), ascending sort puts `LOW` first and `CRITICAL` last; this is an
  incidental consequence of enum declaration order, not an explicit weight column.
- Filter: `workItemFiltersSchema.priority` is a single exact-match value (`work-item.ts:127`); the
  `FiltersBar` "Toutes priorités" `<select>` maps directly to this (`FiltersBar.tsx:96-108`).
  Default priority on creation is `MEDIUM` (`Priority.MEDIUM` default both in the Zod schema —
  `work-item.ts:35` — and in `CreateWorkItemDialog`'s `emptyForm()` — `CreateWorkItemDialog.tsx:275`).

---

## 8. Story Points

**File:** `schema.prisma:369` (`storyPoints Int?`), `packages/shared/src/dto/work-item.ts:36,65`
(Zod: `z.number().int().min(0).max(100).nullable().optional()`), `enums.ts:146`
(`STORY_POINT_SCALE = [1, 2, 3, 5, 8, 13, 21] as const`)

- **DB type:** nullable `Int`. Nullability is meaningful: `null` = "not estimated", rendered as no
  badge at all (`StoryPoints`, `WorkItemChrome.tsx:56-66`: `if (points === null) return null;`).
- **Validation:** integer, `0..100` inclusive. **The UI never lets the user type an arbitrary
  number** — both the create dialog and detail panel use a `<select>` populated strictly from
  `STORY_POINT_SCALE` (Fibonacci-like: 1,2,3,5,8,13,21) plus a "Non estimé" (unset) option
  (`CreateWorkItemDialog.tsx:191-204`, `WorkItemDetailPanel.tsx:277-290`). So while the *backend*
  would accept any integer 0-100, the *frontend* only ever sends one of those 7 values or `null`.
- **Aggregation:** see §4.2 — direct-children sum only, exposed as `rolledUpPoints`, with fallback
  to the node's own points if it has no estimated children. **Epics are never estimated
  themselves** — confirmed by the UI omitting the story-points `<select>` for Epics implicitly
  (the field is shown for all types in the dialogs, but §4.2's hint text
  `` `Total descendants : ${item.rolledUpPoints}` `` only appears when `item.type === EPIC`,
  steering the PO toward reading the roll-up rather than typing a number) and by the doc comment
  at `schema.prisma:368-369` / `work-item.mapper.ts:157-159`: *"un epic n'est pas estimé
  lui-même"*.
- **Editing:** part of the batch `PATCH` (§22) — not a standalone endpoint, not truly inline
  (see §20).

---

## 9. Creator Traceability ("Créé par")

**File:** `schema.prisma:388` (`reporterId String` — required, no default), `WORK_ITEM_SUMMARY_SELECT`
(`work-item.mapper.ts:25-53`, `reporter: { select: { id, name, email, avatarUrl } }`),
`WorkItemDetailPanel.tsx:208-215`

- Stored as `reporterId`, a **required, non-nullable** FK to `User`. `WorkItem.reporter` has no
  `onDelete: SetNull`/`Cascade` clause declared on that relation in the schema excerpt shown
  (`schema.prisma:401`: `reporter User @relation("WorkItemReporter", fields: [reporterId], references: [id])`)
  — meaning Postgres's default FK behavior (`RESTRICT`) applies: **a `User` row that authored a
  ticket cannot be hard-deleted** while that ticket exists. This is consistent with the platform's
  general pattern of soft-deleting users (`User.deletedAt`, `schema.prisma:46`,
  `User.isActive`) rather than removing them.
- **Live relation, not a snapshot.** Every read of a `WorkItem` joins live to `User` for `name`,
  `email`, `avatarUrl` (`work-item.mapper.ts:50`) — if the reporter's display name or avatar
  changes later, historical tickets show the *current* name, not the name at creation time.
- **Set once, at creation, from the authenticated caller** — `WorkItemsController.create()` passes
  `user.id` from `@CurrentUser()` as `reporterId` (`work-items.controller.ts:72-78` →
  `this.workItems.create(projectId, dto, user.id)`); the client cannot choose a different
  reporter (`CreateWorkItemInput` has no `reporterId` field at all —
  `work-item.ts:27-49`).
- **Never changeable after creation.** `updateWorkItemSchema` (`work-item.ts:58-80`) has no
  `reporterId` field, and `WorkItemsService.update()` never touches `reporterId` — it's absent
  from the whitelist passed to `pick()` (`work-items.service.ts:228-240`). There is no
  "change creator" affordance anywhere in the frontend.
- **If the user becomes inactive/soft-deleted:** the relation still resolves (the `User` row
  still exists, only `isActive`/`deletedAt` flags change), so "Créé par" keeps showing their name
  and avatar. **NOT CONFIRMED IN CODE**: no visual "inactive user" indicator was found on the
  creator badge.
- **Rendered** as an `Avatar` + name + `new Date(item.createdAt).toLocaleString('fr-FR')` in a
  highlighted `bg-surface-sunken` strip at the top of the detail panel
  (`WorkItemDetailPanel.tsx:208-215`), and as an `Avatar` + truncated name in the backlog row's
  "Créé par" column (`BacklogPage.tsx:332-337`).

---

## 10. Assignees

**File:** `schema.prisma:421-431` (`WorkItemAssignee`), `work-items.service.ts:648-655`
(`resolveAssigneeIds`), `work-item.mapper.ts:146-152`

- **Multiple assignees, many-to-many.** `WorkItemAssignee(workItemId, userId, assignedAt)`,
  composite PK, both FKs cascade-delete. The legacy singular `WorkItem.assigneeId` column is kept
  in sync as "the first assignee" purely for backward-compatible clients
  (`work-item.mapper.ts:146`: `assignee: row.assignees[0]?.user ?? row.assignee`).
- **No role restriction on who can be assigned** — any project member is eligible. **Hard
  constraint:** every assignee must already be a project member, enforced server-side
  (`assertReferences()`, `work-items.service.ts:576-593`) — a mismatch throws
  `400 ASSIGNEE_NOT_MEMBER`. This is the exact rule the CLAUDE.md project notes call out.
- **Write semantics — full replacement, not diff.** `resolveAssigneeIds()`
  (`work-items.service.ts:646-655`): if `assigneeIds` is present in the payload (even `[]`), the
  service deletes all existing `WorkItemAssignee` rows and recreates from the new list
  (`work-items.service.ts:265-274`). Sending an **empty array clears all assignees**. The legacy
  `assigneeId` field is still accepted for old clients and converted to a 1-element array.
- **Duplicates silently deduped:** both create (`work-items.service.ts:134`,
  `[...new Set(assigneeIds)]` inside `resolveAssigneeIds` too) and the Zod schema cap the list at
  20 entries (`work-item.ts:38,69`: `.max(20)`).
- **Frontend UI:** `AssigneeSelector` — a scrollable checklist (`max-h-32`) of project members,
  each row a checkbox + `Avatar` + name (`AssigneeSelector.tsx`). Used identically in the create
  dialog and the detail panel.
- **Avatar rendering:** `AvatarStack` shows up to 3 overlapping avatars (`-space-x-1.5`,
  `limit = 3` default) then a `+N` badge for the remainder; if the array is empty it renders a
  dashed-border `?` placeholder circle instead (`AvatarStack.tsx:8-14`). `Avatar` itself renders
  either an `<img>` (if `avatarUrl` set, prefixed with the API base URL for relative paths) or a
  colored initials circle (`bg-accent-600` + `initials(name)`) — `Avatar.tsx`.
- **Filtering by assignee:** `workItemFiltersSchema.assigneeId` is a single UUID
  (`work-item.ts:123`); the backend OR-matches against both the new join table and the legacy
  column for compatibility: `{ OR: [{ assignees: { some: { userId } } }, { assigneeId }] }`
  (`work-items.service.ts:403-409`). So filtering by assignee finds a ticket whether that person
  is assignee #1, #2, or #3 in the multi-assignee list.
- **Notifications triggered by assignment: NOT CONFIRMED IN CODE.** `NotificationType.ITEM_ASSIGNED`
  exists as an enum value (`enums.ts:126`) but grepping the entire API source for its usage found
  **zero call sites** — no notification is actually created when a ticket is assigned. Only
  `notifyMention()` (comment @mentions) and `notifyPullRequestEvent()` are wired up
  (`notifications.service.ts:33-97`). This is a real gap between the declared notification
  taxonomy and the implemented behavior — see §24 and §35.

---

## 11. Labels / Tags

**File:** `schema.prisma:285-308`, `apps/api/src/modules/labels/labels.service.ts`,
`packages/shared/src/dto/label.ts`

- **Project-level, not global.** `Label.projectId` FK, `@@unique([projectId, name])`
  (`schema.prisma:288, 295`) — the same label name can exist independently in different projects.
- **Color:** free-form hex string validated by Zod regex `^#[0-9a-fA-F]{6}$`
  (`label.ts:3-5`), default `#0078D4`. A palette of 7 suggested swatches exists
  (`LABEL_COLORS`, `label.ts:22-30`) but the color field is not constrained to that palette at
  the schema level — it's a UI suggestion only.
- **Many-to-many:** `WorkItemLabel(workItemId, labelId, assignedAt)`, composite PK, both
  cascade-delete (`schema.prisma:298-308`).
- **CRUD:** `LabelsService` (`labels.service.ts`) — `list/create/update/remove`, each project-scoped
  via `assertBelongsToProject()`. Deleting a label cascades the join-table rows (DB-level
  `onDelete: Cascade`), detaching it from every ticket — confirmed by the code comment at
  `labels.service.ts:37`.
- **Assignment on a ticket:** replace-in-bloc, same pattern as assignees —
  `updateWorkItemSchema.labelIds` replaces the entire set
  (`work-items.service.ts:254-263`).
- **Filtering:** single `labelId` filter, `{ labels: { some: { labelId } } }`
  (`work-items.service.ts:431`) — a ticket matches if that one label is among its (possibly many)
  labels.
- **Permission:** managing labels themselves (create/update/delete) requires `label:manage`,
  held only by `PROJECT_LEAD` (`permissions.ts:26,64`) — a plain `MEMBER` can *apply* existing
  labels to a ticket (via `workitem:update`) but cannot create new ones.
- **Rendering:** `LabelChips` — small colored pills, `backgroundColor: label.color`, white text
  (`WorkItemChrome.tsx:68-83`).

---

## 12. Backlog Ordering

**File:** `packages/shared/src/lexorank.ts`, `apps/api/src/modules/work-items/ranking.service.ts`

### 12.1 The rank field

`rank: String` — a **fractional/LexoRank string** over a base-36 alphabet
(`0123456789abcdefghijklmnopqrstuvwxyz`, `lexorank.ts:9-10`). `rankBetween(prev, next)`
computes a string strictly between two neighbours by descending digit-by-digit through the
midpoint of the two characters' alphabet indices; when characters are adjacent (no room), it
recurses one level deeper rather than renumbering anything (`lexorank.ts:22-56`). This is a
classic LexoRank/fractional-indexing scheme, confirmed correct by 200-iteration adjacent-insertion
stress tests in `lexorank.spec.ts:17-26` and `ranking.service.spec.ts:108-128`.

Two **independent** rank columns exist on `WorkItem`: `rank` (backlog, ordered *among siblings
only* — same `parentId`) and `boardRank` (board, ordered *within a status column*, ignoring
`parentId`). The Prisma doc comment is explicit: *"réordonner une carte sur le board ne doit pas
bousculer la priorisation du backlog"* (`schema.prisma:373-375`).

### 12.2 Neighbour-based positioning, not index-based

**File:** `packages/shared/src/dto/work-item.ts:83-98` (`moveWorkItemSchema`)

The client sends `beforeId`/`afterId` (the two adjacent tickets after the move), never a numeric
index. `RankingService.computeRank()` (`ranking.service.ts:24-58`):
1. Looks up the `rank`/`boardRank` of `beforeId` and `afterId` (parallel `Promise.all`).
2. If both given and `before >= after`, rejects with `400 INCONSISTENT_POSITION` — a stale client
   sent contradictory neighbours (someone else already reordered).
3. If either given, returns `rankBetween(before, after)`.
4. If neither given, falls back to "end of the targeted list" — a `findFirst` ordered
   `desc` on the field within the given scope (`projectId` + optionally `parentId`/`status`), then
   `rankBetween(lastRank, null)`, or `INITIAL_RANK` if the list is empty.

This means **two users reordering different pairs of cards concurrently never conflict** — each
move is a single `UPDATE ... SET rank = $1 WHERE id = $2`, no other row is touched. The only
conflict case is two users trying to insert into the exact same gap at the exact same instant,
handled by the `before >= after` guard turning into a client-visible error asking them to reload.

### 12.3 Drag-and-drop library and flow (backlog)

**Library:** `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/modifiers`
(`BacklogPage.tsx:3-19`) — confirmed as the sole DnD library; project conventions
(CLAUDE.md) explicitly note `react-beautiful-dnd` was rejected as unmaintained.

Flow, traced end to end:
1. `BacklogRow` calls `useSortable({ id: node.id, disabled: !draggable })`
   (`BacklogPage.tsx:253-256`); the drag handle is a dedicated `<button>` with
   `{...attributes} {...listeners}` — **not the whole row** — so clicking the title still opens
   the detail panel (`BacklogPage.tsx:270-281`).
2. `DndContext` uses `closestCenter` collision detection and `restrictToVerticalAxis`
   (`BacklogPage.tsx:160-171`) — cards can only move up/down, never sideways.
3. On drop, `onDragEnd()` (`BacklogPage.tsx:83-121`):
   - Rejects the move outright (sets a visible `dragError`, no API call) if the dragged row and
     the drop target don't share the same `parentId` — **the backlog explicitly refuses
     cross-parent drag-drop**; re-parenting must go through the explicit "Epic / parent" selector
     in the ticket detail panel instead (`BacklogPage.tsx:92-98`, confirmed by the code comment at
     lines 78-81: *"Un ticket se repriorise parmi ses frères ; changez son parent depuis le
     ticket."*).
   - Otherwise computes the sibling list excluding the dragged item, finds the drop target's index,
     and derives `beforeId`/`afterId` depending on drag direction (`movingDown` ternary,
     `BacklogPage.tsx:101-115`).
   - Calls `reorder.mutate({ itemId, input: { beforeId, afterId } })`
     (`useReorderBacklog`, `hooks.ts:154-161`) → `POST /projects/:id/work-items/:itemId/reorder`.
4. **No optimistic cache patch for the backlog** — `useReorderBacklog` just invalidates
   `['projects', projectRef]` on success (`hooks.ts:154-161`); the row visually snaps back into
   place only once the refetched tree arrives. This differs from the **board's**
   `useMoveWorkItem`, which *does* pre-patch the TanStack Query cache before the server responds
   (`hooks.ts:90-115`, explicit code comment: *"le cache est mis à jour avant la réponse serveur,
   sinon la carte reviendrait visiblement à sa place le temps de l'aller-retour"*), with
   `onError` rollback to the previous cache snapshot.
5. Backend: `POST /work-items/:itemId/reorder` → `WorkItemsController.reorder()`
   (`work-items.controller.ts:107-117`) strips any `status` from the payload (reordering never
   changes the column) and delegates to the same `WorkItemsService.move()` used by the board,
   which computes `rank` via `RankingService.computeRank('rank', ...)`
   (`work-items.service.ts:339-344`) and issues a single `workItem.update()`.

### 12.4 Server-side reorder permission

`@RequirePermission('backlog:reorder')` on the `/reorder` route
(`work-items.controller.ts:108`) — a **distinct** permission from `workitem:move` (used by the
board's `/move` route, line 97). Both `PROJECT_LEAD` and `MEMBER` hold `backlog:reorder` and
`workitem:move` in the default matrix (`permissions.ts:60-100`), so in practice every project
member can reorder — but the two are separately toggleable permissions, allowing future
role/permission edits to decouple them.

### 12.5 Initial rank on creation

`RankingService.initialRanks(projectId, parentId, status)` (`ranking.service.ts:61-83`) computes
both `rank` (last sibling under the same `parentId`, or `INITIAL_RANK`) and `boardRank` (last
item in the same `status` column) in parallel — every new ticket is appended to the **end** of
both its backlog sibling list and its board column.

---

## 13. Search

**File:** `apps/api/src/modules/work-items/work-items.service.ts:401-433` (`buildWhere`)

- **Server-side**, via a Prisma `contains`/`insensitive` filter across exactly three columns:
  `title`, `description`, `technicalNotes` (`work-items.service.ts:411-419`):
  ```ts
  OR: [
    { title: { contains: filters.search, mode: 'insensitive' } },
    { description: { contains: filters.search, mode: 'insensitive' } },
    { technicalNotes: { contains: filters.search, mode: 'insensitive' } },
  ]
  ```
  **Does not search:** the ticket key (`VIS-1-2`), creator name, assignee name, or label names.
  A search for `"VIS-1-2"` would only match if that literal string also happened to appear inside
  the title/description/notes text.
- **Case-insensitive** (`mode: 'insensitive'`, Prisma's Postgres `ILIKE`-equivalent).
- **No minimum character count** enforced server-side (Zod only caps length at 160 chars,
  `work-item.ts:122`); the frontend doesn't add a minimum either — every keystroke re-triggers a
  query (subject to TanStack Query's `staleTime`, see §30).
- **No debounce found in the frontend.** `FiltersBar`'s search `<input>` calls `set('search', ...)`
  synchronously on every `onChange` (`FiltersBar.tsx:46-51`), which updates the URL via
  `useUrlWorkItemFilters` → triggers a new `useBacklog()` query key → refetch. **NOT CONFIRMED IN
  CODE**: no `useDebouncedValue`/`setTimeout`/lodash-debounce wrapper was found anywhere in
  `FiltersBar.tsx` or `use-url-work-item-filters.ts`. This is a real, code-verified absence
  worth flagging under §31 (performance) and §35 (weaknesses).
- **No full-text index / trigram index** on `title`/`description` was found in any migration file
  — `contains` on an un-indexed `text` column means a sequential scan at scale (see §31).
- **URL persistence:** yes — `search` is one of the `FILTER_KEYS` synced to the query string by
  `useUrlWorkItemFilters` (`use-url-work-item-filters.ts:12-25`), confirmed working end-to-end by
  the E2E test `auth-navigation.spec.ts:28-47` (fills search, asserts `?search=api` in the URL,
  reloads, asserts the input still shows `api`).

---

## 14. Filter Engine

**File:** `packages/shared/src/dto/work-item.ts:121-136` (`workItemFiltersSchema`),
`apps/api/src/modules/work-items/work-items.service.ts:401-433` (`buildWhere`),
`apps/web/src/features/work-items/components/FiltersBar.tsx`

| Filter | Frontend control | URL param | Backend `where` clause |
|---|---|---|---|
| Search | Text input | `search` | `OR` across title/description/technicalNotes (contains, insensitive) |
| Type | `<select>` (all 4 `WorkItemType`) | `type` | `{ type }` exact match |
| Assignee | `<select>` (project members) | `assigneeId` | `OR` of `assignees.some` and legacy `assigneeId` |
| Creator | `<select>` (project members) | `creatorId` | `{ reporterId: creatorId }` exact match |
| Priority | `<select>` (4 values) | `priority` | `{ priority }` exact match |
| Label | `<select>` (project labels) | `labelId` | `{ labels: { some: { labelId } } }` |
| Sort field | `<select>` (7 fields incl. "Ordre manuel") | `sortBy` | Drives `ORDER BY`, see §14.1 |
| Sort direction | `<select>` (shown only if `sortBy` set) | `sortOrder` | `asc`/`desc` |
| Hide done (backlog only) | Checkbox | `hideDone` | `{ status: { not: DONE } }` — **see caveat below** |
| Status | *(no dedicated UI control in `FiltersBar`)* | `status` | `{ status }` exact match |
| Sprint | *(not exposed in `FiltersBar`; used elsewhere, e.g. board's active-sprint scoping)* | `sprintId` | `{ sprintId }` exact match |
| Blocked | *(no dedicated UI control in `FiltersBar`)* | `isBlocked` | `{ isBlocked }` boolean |

### 14.1 Combination semantics — confirmed AND, with one real edge case

All active filters combine with **AND** — every non-empty filter contributes its own key to a
single Prisma `where` object, and the compound (`search`, `assigneeId`) conditions are additionally
wrapped in an explicit `AND: compoundFilters` array (`work-items.service.ts:421-433`).

**Edge case found in code, not assumed:** `status` and `hideDone` both write to the **same**
object key (`status`) via sequential spreads:
```ts
...(filters.status ? { status: filters.status } : {}),
...(filters.hideDone ? { status: { not: WorkItemStatus.DONE } } : {}),
```
(`work-items.service.ts:425, 430`). Because object spread later-wins, **if a caller supplies both
`status` and `hideDone=true` in the same request, `hideDone` silently overwrites the explicit
`status` filter** — the resulting query becomes "not DONE", ignoring the requested status value
entirely. The shipped `FiltersBar` never lets the backlog UI set `status` directly (no status
`<select>` exists there), so this is not reachable through normal backlog navigation, but it *is*
reachable by hand-crafting the URL (`?status=IN_PROGRESS&hideDone=true`), since
`useUrlWorkItemFilters` round-trips whatever is in the query string. This is a genuine, minor
implementation gap — see §35.

- Sort default (`sortBy` unset / "Ordre manuel"): single `ORDER BY rank ASC` for the backlog,
  `boardRank ASC` for the board (`buildOrderBy()`, `work-items.service.ts:436-448`, `stableColumn`
  ternary). Any explicit `sortBy` adds that column first, `rank`/`boardRank` as a stable
  tiebreaker second.
- The backlog explicitly disables drag-and-drop when a non-rank sort is active:
  `const canReorder = can('backlog:reorder') && (!filters.sortBy || filters.sortBy === 'rank')`
  (`BacklogPage.tsx:61`) — you cannot drag-reorder while sorted by, say, "Priority"; manual rank
  order and explicit sort are mutually exclusive UX states, enforced client-side.

### 14.2 Parent-visibility rule when only a child matches a filter

**File:** `apps/api/src/modules/work-items/work-items.service.ts:45-71` (`getBacklog`)

The backend filters the **flat row set** first (`buildWhere`), *then* rebuilds the tree from
whatever rows survived:
```ts
const parent = row.parentId ? nodes.get(row.parentId) : undefined;
if (parent) parent.children.push(node);
else roots.push(node);   // ← parent was filtered out
```
So: **if a child matches a filter but its parent does not, the child is promoted to a top-level
row in the returned tree** (its `parentId` in the payload is unchanged, but it has no
`nodes.get(parentId)` to attach to, so it lands in `roots`). The code comment says exactly this:
*"Un ticket dont le parent est filtré remonte à la racine plutôt que de disparaître."* (a ticket
whose parent got filtered out rises to the root rather than disappearing) — confirmed at
`work-items.service.ts:65`. Conversely, **a matching parent does *not* pull in its non-matching
children** — an Epic that matches a search term still only shows whichever of its children also
independently matched the same filter set; non-matching children are simply absent from that
Epic's `children[]` in the response.

---

## 15. Completed Items ("Masquer les terminés")

**File:** `work-items.service.ts:430`, `FiltersBar.tsx:154-164`, `BacklogPage.tsx` prop
`showHideDone`

- `hideDone` = `{ status: { not: WorkItemStatus.DONE } }` — a strict, single-status exclusion.
  There is no "completed category" grouping multiple statuses; `DONE` is the only completed
  state (see §6).
- **Only offered on the Backlog**, not the Board: `<FiltersBar showHideDone>` on
  `BacklogPage.tsx:144`, vs. plain `<FiltersBar>` (no `showHideDone` prop, defaults `false`) on
  `BoardPage.tsx:258-263` — makes sense since the Board is scoped to an active sprint and its
  `DONE` column is already a visible, explicit column rather than noise to hide.
- **A parent whose children are all completed:** the parent itself keeps whatever status it has
  been explicitly set to — there is **no automatic "auto-complete parent when all children are
  done"** logic anywhere in `WorkItemsService`. An Epic or Story can sit at `IN_PROGRESS` forever
  even if `doneChildCount === childCount`; that ratio is purely informational (§4.1), never
  written back to the parent's own `status` column. If `hideDone` is checked and a parent is
  itself `DONE`, that parent row is excluded by the same top-level filter — but if the parent is
  *not* `DONE` while all its children *are*, the parent row still shows (now with `x/x` children,
  none of which are individually hidden by `hideDone` either, since that filter also applies to
  child rows in the same flat query).

---

## 16. Frontend Component Architecture

```
BacklogPage.tsx                              (page container)
 ├─ useUrlWorkItemFilters()                   → filters state, synced to URL
 ├─ useBacklog(projectKey, filters)           → BacklogNode[] tree (TanStack Query)
 ├─ useProjectMembers() / useProjectPermissions()
 ├─ useReorderBacklog()                       → drag-drop mutation
 ├─ flattenVisible(tree, collapsed)           → FlatRow[] (client-side, respects collapse state)
 ├─ <FiltersBar/>                             (shared with BoardPage)
 │   └─ useLabels(projectRef)
 ├─ <DndContext> (@dnd-kit)
 │   └─ <SortableContext>
 │       └─ <BacklogRow/> × N                 (one per FlatRow)
 │           ├─ useSortable()                 → drag handle wiring
 │           ├─ <TypeIcon/>                   (WorkItemChrome)
 │           ├─ expand/collapse <button>      (only if hasChildren)
 │           ├─ title <button onClick=onOpen> → opens WorkItemDetailPanel
 │           ├─ <LabelChips/>
 │           ├─ "bloqué" badge (conditional)
 │           ├─ child ratio "{done}/{count}"  (conditional, hasChildren)
 │           ├─ <StatusPill/>
 │           ├─ <PriorityBadge/>
 │           ├─ <StoryPoints/>
 │           ├─ <Avatar/> + reporter name     ("Créé par" column)
 │           └─ <AvatarStack/>                ("Assignés" column)
 ├─ <CreateWorkItemDialog/>                   (modal, opened by "+ Nouveau ticket")
 │   └─ <AssigneeSelector/>
 └─ <WorkItemDetailPanel/>                    (slide-over, opened by row title click)
     ├─ <AssigneeSelector/>
     ├─ <MarkdownEditor/> × 2                 (description, technicalNotes)
     ├─ <AcceptanceCriteriaEditor/>
     ├─ label toggle buttons
     ├─ subtasks list + inline "add subtask" input
     ├─ <CommentsPanel/>                      (comments + last-8 activity feed)
     └─ <AttachmentsPanel/>
```

Each row's data source is exclusively the `BacklogNode` object already present in the single
`useBacklog()` tree response — no per-row network fetch. The detail panel, once opened, issues its
own `useWorkItem(projectRef, itemId)` fetch for the full `WorkItemDetail` shape (adds
`description`, `technicalNotes`, `acceptanceCriteria`, `children`, `parent` — fields the summary
row doesn't carry).

---

## 17. UI Design Details

**File:** `apps/web/src/styles/globals.css`, `BacklogPage.tsx`, `WorkItemChrome.tsx`,
`components/ui/badge.tsx`

### 17.1 Design tokens (`globals.css:7-45`)

```css
--color-accent-500: #0078d4;   /* Azure-blue accent, matches Fluent UI */
--color-surface: #ffffff;
--color-surface-muted: #faf9f8;
--color-surface-sunken: #f3f2f1;
--color-border-subtle: #edebe9;
--color-border-default: #e1dfdd;
--color-border-strong: #c8c6c4;
--color-ink-900: #201f1e;  --color-ink-700: #323130;
--color-ink-500: #605e5c;  --color-ink-400: #8a8886;
--color-success: #107c10; --color-warning: #ca5010; --color-danger: #d13438;
--font-sans: 'Segoe UI', -apple-system, BlinkMacSystemFont, system-ui, 'Helvetica Neue', sans-serif;
```
The code comment explicitly states the intent: *"Toutes les couleurs de l'application passent par
ces jetons"* — every color in the app funnels through these tokens — and names the reference:
*"repères visuels d'Azure DevOps"*. A parallel `.dark { ... }` block (`globals.css:47-64`) redefines
the same tokens for dark mode (surface/ink/border/accent all re-mapped; **not implemented via
`prefers-color-scheme`, but via an explicit `.dark` class** — theme toggling is a controlled,
class-based switch, not automatic OS-detection-only).

### 17.2 Typography scale — deliberately compact

```css
--text-xs: 0.6875rem;   /* 11px */
--text-sm: 0.75rem;     /* 12px */
--text-base: 0.8125rem; /* 13px */
--text-lg: 0.9375rem;   /* 15px */
--text-xl: 1.125rem;    /* 18px */
--text-2xl: 1.375rem;   /* 22px */
```
`html { font-size: 16px }` is the only place the default 1rem=16px is set; every `text-*` class
above is *smaller* than Tailwind's stock scale, which is the direct implementation of the
CLAUDE.md requirement "typographie compacte" (compact typography). Comment at line 38: *"la
densité prime sur l'aération"* (density over whitespace).

### 17.3 Row anatomy (Backlog)

`BacklogPage.tsx:260-343`. Per-row:
- Container: `flex items-center gap-2 border-b px-4 py-1` — **`py-1`** (4px vertical padding) is
  the dominant driver of row density; combined with `text-base` = 13px, rows are visually tight,
  Azure-DevOps-like.
- Border: `border-border-subtle` (`#edebe9`) — a hairline, not a heavy divider.
- Hover: `hover:bg-surface-muted` (`#faf9f8`) — very subtle background tint.
- Dragging state: `isDragging && 'bg-accent-50 opacity-60'`.
- Done state: `node.status === DONE && 'opacity-60'` — visually recedes without disappearing.
- Header row (column titles): `border-b px-4 py-1 text-xs font-semibold uppercase text-ink-500`
  (`BacklogPage.tsx:172-180`) — fixed pixel widths per column (`w-28` status, `w-24` priority,
  `w-10` points, `w-36` creator, `w-20` assignees), flexible title column (`flex-1`).
- Indentation: `style={{ paddingLeft: depth * 14 }}` applied **twice per row** (once on the
  drag-handle/expand-arrow gutter, once on the title flex group) — 14px per hierarchy level
  (`BacklogPage.tsx:270, 284`).
- Expand affordance: `ChevronRight`/`ChevronDown` (lucide-react), only rendered
  `hasChildren ? <button>… : <span className="w-3.5" />` — a fixed-width invisible spacer keeps
  leaf rows aligned with parent rows that do show a chevron.
- Badges (`components/ui/badge.tsx`): `rounded px-1.5 py-0.5 text-xs font-semibold` pill, tone
  driven by a `Record<Tone, string>` lookup (`neutral`/`accent`/`success`/`warning`/`danger`).
- Story points bubble: a `size-5` (20px) filled circle, `rounded-full bg-surface-sunken`,
  centered text (`WorkItemChrome.tsx:56-66`).
- Icon library: **`lucide-react`** exclusively (`ChevronDown`, `ChevronRight`, `GripVertical`,
  `Plus`, `Search`, `X`, `Bug`, `BookOpen`, `CheckSquare`, `Crown`, etc.).
- Type icon color mapping (`WorkItemChrome.tsx:15-20`) — explicitly commented as reproducing Azure
  DevOps conventions: *"Couleurs de type reprises d'Azure DevOps : orange epic, bleu story, rouge
  bug"* — though the actual epic color used is purple (`#8764B8`), not orange (comment/implementation
  mismatch, noted as-is): `EPIC: text-[#8764B8]` (Crown icon), `STORY: text-accent-500`
  (BookOpen), `BUG: text-danger` (Bug icon), `SUBTASK: text-ink-400` (CheckSquare).
- Avatar sizing: `size-6` (24px, "sm") default, `size-8` (32px, "md") available but not used in
  backlog rows (`Avatar.tsx:16`).
- Scrollbars: custom thin webkit scrollbar, 8px, `bg-border-strong` thumb
  (`globals.css:80-91`, applied via `.scrollbar-thin` utility class used on the row list container).
- Toolbar (`FiltersBar.tsx:41-42`): `flex flex-wrap items-center gap-1.5 border-b px-4 py-1.5` —
  every control is `h-6.5` (26px) tall, `text-sm` — a genuinely dense, single-row toolbar that
  wraps on narrow viewports (`flex-wrap`) rather than scrolling.
- Responsive behavior: no dedicated mobile layout for the backlog table itself was found (no
  `md:`/`sm:` breakpoint classes inside `BacklogRow`); the app shell (`Sidebar.tsx`) does have an
  explicit mobile drawer pattern (`translate-x-0`/`-translate-x-full`, `md:static`), but the dense
  multi-column backlog row is **NOT CONFIRMED** to reflow for small screens — it would overflow
  and rely on horizontal scroll of the outer `overflow-auto` container.

---

## 18. Backlog Row Behavior

| Interaction | Result | Evidence |
|---|---|---|
| Hover row | `hover:bg-surface-muted` background tint | `BacklogPage.tsx:265` |
| Click title | Opens `WorkItemDetailPanel` for that item (`onOpen(node.id)` → `setOpenItemId`) | `BacklogPage.tsx:305-311`, `:192` |
| Click chevron | Toggles that node's id in/out of the `collapsed` Set — only affects that node's own children, client-side only, not persisted | `BacklogPage.tsx:70-76, 286-298` |
| Click status pill | **No click handler** — `StatusPill` is a plain, non-interactive `<Badge>`; status can only be changed inside the detail panel's `<select>` | `WorkItemChrome.tsx:52-54` vs. `WorkItemDetailPanel.tsx:227-241` |
| Click assignee avatar | **No click handler** on `AvatarStack` in the backlog row — read-only display; assignees are edited only via `AssigneeSelector` inside the detail panel | `AvatarStack.tsx`, `BacklogPage.tsx:338-340` |
| Click parent row (an Epic/Story with children) | Same as any row — opens its own detail panel; expand/collapse is a **separate** chevron button, not triggered by clicking the row itself | `BacklogPage.tsx:284-311` |
| Create child | Only reachable from inside the **detail panel**'s "Sous-tâches" section (title input + button, `Enter` key submits) — **not** from a backlog row's context menu; no "+" affordance directly on a backlog row | `WorkItemDetailPanel.tsx:468-492` |
| Edit ticket | Opens detail panel, edits a local `draft` state, must click "Enregistrer" — **not inline** (see below) | `WorkItemDetailPanel.tsx:110, 510-524` |
| Complete ticket | Change the "Statut" `<select>` to `Terminé` inside the detail panel, then Save | `WorkItemDetailPanel.tsx:227-241` |

**Inline editing: NO.** The detail panel loads the ticket into a local `draft` state
(`toDraft(item)`, `WorkItemDetailPanel.tsx:529-543`) that the user edits freely, and nothing is
sent to the server until the explicit "Enregistrer" button triggers `save()`
(`WorkItemDetailPanel.tsx:130-153, 519-522`). This is a **batch-save form model**, not
field-by-field autosave/inline editing like some Azure DevOps or Linear ticket views. The one
exception: **acceptance criteria and labels also live in local component state** (`criteria`,
`labelIds`) and are only persisted as part of the same single `save()` call
(`WorkItemDetailPanel.tsx:111-112, 144-145`) — so toggling a label or checking a criterion doesn't
save immediately either; it's bundled into the next "Enregistrer" click. Comments (§21) and
attachments are the only genuinely inline-persisted actions (their own dedicated mutation, no
"Save" button — `CommentsPanel.tsx:36-40`).

---

## 19. Create Ticket Workflow

**File:** `apps/web/src/features/work-items/components/CreateWorkItemDialog.tsx`,
`apps/api/src/modules/work-items/work-items.controller.ts:69-78`,
`apps/api/src/modules/work-items/work-items.service.ts:128-185`

### 19.1 Fields, defaults, validation

| Field | Default | Client validation | Server validation |
|---|---|---|---|
| `type` | `WorkItemType.STORY` (or caller-supplied `defaultType`) | — | `z.nativeEnum(WorkItemType)` |
| `title` | `''` | `trim().length >= 3` (disables Submit) | `min(3).max(255)` |
| `parentId` | `defaultParentId ?? null`; reset to `''` whenever `type` changes | Required if type is `SUBTASK` (`REQUIRES_PARENT`); `<select>` options filtered to `ALLOWED_PARENT_TYPES[type]` | `.refine()` in `createWorkItemSchema` rejects a SUBTASK without `parentId`; `assertHierarchy()` re-validates parent's actual type server-side |
| `description` | `''` | none | `max(20000)`, nullable |
| `technicalNotes` | `''` | none | `max(20000)`, nullable |
| `priority` | `Priority.MEDIUM` | — | Zod default `MEDIUM` |
| `storyPoints` | `''` (→ `null`) | `<select>` restricted to `STORY_POINT_SCALE` | `int().min(0).max(100)`, nullable |
| `assigneeIds` | `[]` | `AssigneeSelector` checklist (project members only) | `.max(20)` array of UUIDs; `ASSIGNEE_NOT_MEMBER` check |
| `sprintId` | caller-supplied `defaultSprintId`, forced `''`/`null` for Epics | Sprint `<select>` hidden entirely for `type === EPIC` | Must belong to the project (`SPRINT_NOT_FOUND` otherwise) |
| `status` | Not user-editable in the dialog; comes from `defaultStatus` prop (e.g. board passes `TODO` for the column it was opened from) | — | Defaults to `TODO` if omitted (`work-items.service.ts:137`) |
| `labelIds` | *(not present in `CreateWorkItemDialog`'s form at all — labels can only be added after creation, in the detail panel)* | — | Accepted by the schema/service if sent, but the create dialog never sends it |

### 19.2 Server-side creation sequence

`WorkItemsService.create()` (`work-items.service.ts:128-185`):
1. `assertHierarchy(projectId, type, parentId)` — validates parent existence + type compatibility.
2. `assertReferences(projectId, assigneeIds, sprintId, labelIds)` — validates assignees are
   members, sprint belongs to project, labels belong to project.
3. `ranking.initialRanks(projectId, parentId, targetStatus)` — computes both `rank` (end of
   sibling list) and `boardRank` (end of status column) **before** the transaction, from a
   read-only query.
4. `numberedTransaction()` wraps a `Serializable` transaction that calls `nextAvailableNumber()`
   then `tx.workItem.create()` with all fields, nested `labels: { create: [...] }` and
   `assignees: { create: [...] }` writes in the **same** `create()` call (Prisma nested writes,
   not separate round trips).
5. If `targetStatus === DONE` at creation time (not the normal path, but schema-legal), `closedAt`
   is set immediately.
6. Returns `this.getById(projectId, created.id)` — a **second** full read (with all relations) to
   build the response, rather than reusing the `create()` payload — guarantees the response shape
   is byte-identical to any other detail fetch.

### 19.3 What's absent

- **No automatic notification on creation.** Only comment-mention and PR events notify anyone
  (§10, §24).
- **No `ACCOUNT_CREATED`-style event for tickets** in `ActivityLog` — creation is **not** logged
  to `ActivityLog` at all (confirmed by the repo-wide grep in §24 — only comments, attachments,
  and project documents write `ActivityLog` rows). A ticket's own `createdAt` timestamp is the
  only creation record.
- **Frontend refresh:** `useCreateWorkItem`'s `onSuccess` calls the broad
  `invalidateQueries({ queryKey: ['projects', projectRef] })` (`hooks.ts:52-64`) — every query
  under that project (backlog, board, labels, etc.) is invalidated and refetched, not just the
  backlog tree.

---

## 20. Update Workflow

**File:** `apps/api/src/modules/work-items/work-items.service.ts:187-296` (`update`)

| Mutated field(s) | Endpoint | Permission | DTO field | Service behavior |
|---|---|---|---|---|
| `title`, `description`, `technicalNotes`, `priority`, `storyPoints`, `isBlocked`, `blockedReason`, `startDate`, `dueDate` | `PATCH /work-items/:id` | `workitem:update` | `UpdateWorkItemInput` | Whitelisted via `pick()`, applied directly |
| `status` | `PATCH /work-items/:id` (detail panel) **or** `POST /work-items/:id/move` (board drag) | `workitem:update` / `workitem:move` | `status` / `MoveWorkItemInput.status` | Sets/clears `closedAt` as a side effect |
| `assigneeIds` | `PATCH /work-items/:id` | `workitem:update` (not `workitem:assign` — see §25 note) | `assigneeIds` (or legacy `assigneeId`) | Full delete-then-recreate of `WorkItemAssignee` rows, `ASSIGNEE_NOT_MEMBER` re-checked |
| `labelIds` | `PATCH /work-items/:id` | `workitem:update` | `labelIds` | Full delete-then-recreate of `WorkItemLabel` rows |
| `parentId` | `PATCH /work-items/:id` | `workitem:update` | `parentId` | `assertHierarchy` + `assertNoCycle` re-run; **also re-allocates `number`** (new key!) inside a fresh `numberedTransaction` |
| `sprintId` | `PATCH /work-items/:id` **or** `POST /move` (`sprintId` neighbour-independent) | `workitem:update` / `workitem:move` | `sprintId` | Simple FK connect/disconnect |
| `rank`/backlog order | `POST /work-items/:id/reorder` | `backlog:reorder` | `beforeId`/`afterId` | `RankingService.computeRank('rank', ...)` |
| `boardRank`/board order | `POST /work-items/:id/move` | `workitem:move` | `beforeId`/`afterId` + `status` | `RankingService.computeRank('boardRank', ...)` |
| `acceptanceCriteria` | `PATCH /work-items/:id` | `workitem:update` | `acceptanceCriteria[]` | Full delete-then-recreate, `position` = array index |

**Frontend invalidation:** `useUpdateWorkItem` and `useReorderBacklog` both call the same broad
`invalidate()` on success (`hooks.ts:66-73, 154-161`) — full project-query invalidation, not
targeted cache patching, **except** `useMoveWorkItem` (board only), which optimistically patches
the board cache directly and invalidates on `onSettled` (§30).

**Concurrency note (update path):** `changesParent` triggers a **second** `numberedTransaction`
(Serializable + retry) purely to reallocate `number` in the new scope
(`work-items.service.ts:216-222, 292`); a plain field edit with no parent change uses a lighter
non-serializable `this.prisma.$transaction(updateInTransaction)` (`work-items.service.ts:293`) —
i.e. **only re-parenting pays the Serializable-isolation cost**, not every edit.

---

## 21. Delete / Archive

**File:** `apps/api/src/modules/work-items/work-items.service.ts:384-397` (`softDelete`),
`work-items.controller.ts:119-128`

- **Soft delete only** — `DELETE /projects/:id/work-items/:itemId` sets `deletedAt = new Date()`.
  There is **no** "archive" concept distinct from delete for work items (unlike `Project`, which
  has both `ProjectStatus.ARCHIVED` and its own `archivedAt` — a different model).
- **Cascades to all descendants, computed in application code, not a DB `ON DELETE`.**
  `collectDescendants(itemId)` (`work-items.service.ts:558-574`) does a breadth-first walk
  (bounded to 3 levels per the hierarchy rule) collecting every child/grandchild id, then a single
  `updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date() } })` marks the whole
  subtree deleted **in one statement**.
- **Permission:** `workitem:delete`, held only by `PROJECT_LEAD` in the default matrix
  (`permissions.ts:60-83` includes `'workitem:delete'`; `MEMBER_PERMISSIONS`,
  `permissions.ts:86-100`, does **not** include it) — a plain member cannot delete tickets.
- **Frontend confirmation:** a native `window.confirm()` dialog
  (`WorkItemDetailPanel.tsx:172-180`) — *"Supprimer {key} et ses sous-tâches ?"* — no custom modal,
  no "type the ticket key to confirm" pattern.
- **What happens to related data:**
  - **Children:** soft-deleted alongside the parent (see above).
  - **Comments, attachments, labels, assignees, acceptance criteria:** the Prisma schema declares
    `onDelete: Cascade` on all of these FKs (`Comment.workItem`, `Attachment.workItem`,
    `WorkItemLabel.workItem`, `WorkItemAssignee.workItem`, `AcceptanceCriterion.workItem` —
    `schema.prisma:303,396(children),426,442,459,596`), but **soft delete never issues a real SQL
    `DELETE`**, so those cascades never actually fire — the related rows simply become orphaned
    from a UI standpoint (their parent `WorkItem` is now filtered everywhere by `deletedAt: null`)
    while remaining physically present in the database. This is worth flagging precisely: the
    `onDelete: Cascade` annotations describe *hard*-delete behavior that the running application
    never triggers for work items.
  - **PR links (`PullRequest.workItemId`):** same situation — `onDelete: Cascade` declared
    (`schema.prisma:532`), never exercised by soft delete. A soft-deleted ticket's PRs remain in
    the database, simply no longer reachable via the (now-filtered) parent ticket in normal
    queries.
  - **History:** `ActivityLog` rows referencing the ticket (from comments) are untouched, but per
    §24 the ticket itself was never activity-logged in the first place — so "history" for a
    deleted ticket is, in practice, whatever comment-activity already existed, still queryable by
    `entityId` if one knew the id, but with no UI path left to reach it (the detail panel closes,
    `onClose()`, immediately after a successful delete — `WorkItemDetailPanel.tsx:172-180`).
- **No restore/undelete endpoint exists** anywhere in `WorkItemsController` — confirmed by the
  full endpoint list in §26; once deleted, a ticket is unreachable from the API surface (every
  read query filters `deletedAt: null`).

---

## 22. Traceability / History

**File:** `apps/api/src/modules/collaboration/collaboration.service.ts`,
`apps/api/prisma/schema.prisma:613-633` (`ActivityLog` model)

### 22.1 What genuinely exists

- `WorkItem.createdAt` / `updatedAt` — automatic Prisma timestamps, always present.
- `WorkItem.reporterId` — permanent creator reference (§9), immutable.
- `WorkItem.closedAt` — timestamp of the most recent transition into `DONE` (cleared on reopen).
- `Comment` — full thread with `authorId`, `createdAt`, one level of nested `replies` (self-relation
  `"CommentThread"`), soft-deletable (`deletedAt`).
- `ActivityLog` (generic model, `schema.prisma:613-633`) — **but only ever written to for
  comments**, from work-item-adjacent code. Confirmed exhaustively by grepping every
  `activityLog.create(` call site in `apps/api/src`:
  - `collaboration.service.ts:61` — one row per **comment created**
    (`action: 'commented', field: 'comment', newValue: <commentId>`).
  - `attachments.service.ts:80, 149` — attachment upload/delete.
  - `project-documents.service.ts:55, 99` — project document upload/delete.
  - **Nothing in `work-items.service.ts` ever writes to `ActivityLog`.**

### 22.2 What is claimed by the enum/schema but NOT implemented — verified gap

`ActivityLog.action` is a free-form `String` with a doc comment suggesting a rich taxonomy:
*"created | updated | deleted | status_changed | assigned | commented ..."*
(`schema.prisma:620`). In reality, **only `'commented'` is ever produced** by any code path
touching work items. Status changes, priority changes, assignee changes, story-point edits,
re-parenting, reordering, and ticket creation/deletion **do not create any `ActivityLog` row**.

This directly contradicts the CLAUDE.md project notes' claim of an "historique d'activité par
ticket" (per-ticket activity history) covering general edits — the *comment* history is real and
working; the *field-change* history is not implemented, despite the UI section being literally
labeled "Activité récente" and rendering whatever `GET /work-items/:id/activity` returns
(`CommentsPanel.tsx:106-117`, `GET .../activity` → `CollaborationService.listActivity()`,
`collaboration.service.ts:97-106`, which is a straight `activityLog.findMany` — it will only ever
surface comment events in practice).

### 22.3 Traceability Matrix

| Action | Actor saved? | Timestamp? | Before/After? | History visible in UI? |
|---|---|---|---|---|
| Create ticket | Yes (`reporterId`, permanent) | Yes (`createdAt`) | — | No (no `ActivityLog` row; only inferable from `createdAt`) |
| Change status | No | Only indirectly (`updatedAt` changes; `closedAt` set/cleared specifically for `DONE`) | No | No |
| Change assignee | No | Only indirectly (`updatedAt`) | No | No |
| Change priority | No | Only indirectly (`updatedAt`) | No | No |
| Change story points | No | Only indirectly (`updatedAt`) | No | No |
| Re-parent | No | Only indirectly (`updatedAt`); note `number`/key also silently changes (§5.4) | No | No |
| Reorder (backlog/board) | No | Only indirectly (`updatedAt`) | No | No |
| Move sprint | No | Only indirectly (`updatedAt`) | No | No |
| Add/delete comment | **Yes** (`authorId`/`actorId`) | **Yes** (`createdAt`) | N/A (append-only) | **Yes** (comments list + "Activité récente" feed) |
| Delete ticket (soft) | No (`deletedAt` set, but no actor column on `WorkItem` itself) | Yes (`deletedAt`) | No | No |
| Upload/delete attachment | Yes | Yes | No | Via `ActivityLog`, not surfaced in the ticket's own activity feed *for work items specifically* — attachments write to the same generic `ActivityLog` table but under `entityType: WORK_ITEM`/`entityId: itemId` per `attachments.service.ts` (not independently verified line-by-line in this audit; flagged as likely-consistent with the comment pattern but not exhaustively traced) |

**This is a real, code-confirmed weakness**, not a matter of interpretation — see §35.

---

## 23. Authorization / RBAC

**File:** `packages/shared/src/permissions.ts`, `apps/api/src/common/guards/project-permission.guard.ts`,
`apps/api/src/modules/access/project-access.service.ts`

### 23.1 The matrix

Two project roles: `PROJECT_LEAD`, `MEMBER` (`enums.ts:32-36`). Backlog-relevant permissions and
who holds them by default (`permissions.ts:60-100`):

| Permission | `PROJECT_LEAD` | `MEMBER` |
|---|---|---|
| `workitem:create` | Yes | Yes |
| `workitem:update` | Yes | Yes |
| `workitem:delete` | Yes | **No** |
| `workitem:assign` | Yes | Yes *(declared, but see note below — assignment is actually gated by `workitem:update`, not this permission)* |
| `workitem:move` (board drag) | Yes | Yes |
| `backlog:reorder` | Yes | Yes |
| `label:manage` (create/edit/delete labels) | Yes | **No** |
| `attachment:manage` | Yes | Yes |
| `comment:create` | Yes | Yes |
| `comment:delete:any` | Yes | **No** |
| `report:view` | Yes | Yes |

> **Verified inconsistency:** the permission `workitem:assign` exists in the matrix and is granted
> to both roles, but no route or service method in `work-items.controller.ts` /
> `work-items.service.ts` ever checks for it — the `PATCH /work-items/:itemId` route (which is
> the only way to change `assigneeIds`) is gated solely by `workitem:update`
> (`work-items.controller.ts:80-89`). `workitem:assign` is effectively unused dead permission,
> confirmed by its absence from any `@RequirePermission('workitem:assign')` decorator anywhere in
> the controller file.

Platform-level (`PLATFORM_PERMISSIONS`, `permissions.ts:108-115`) permissions like `user:manage`
or `project:delete` are **only** granted to `GlobalRole.ADMIN` and have no bearing on backlog
access.

### 23.2 Enforcement mechanism

1. `JwtAuthGuard` runs first — establishes `request.user` from the bearer token (identity only:
   `sub`, `email`, `jti` — **no roles inside the JWT**, per CLAUDE.md's documented security
   invariant, confirmed structurally by `AccessSubject { id, globalRole }` being re-fetched from
   the DB rather than read off the token in `ProjectAccessService.getAccessContext()`).
2. `ProjectPermissionGuard` runs second (`app.module.ts:51-52`, explicit ordering comment:
   *"l'identité doit être établie avant d'évaluer les droits"*). For any route with a `:projectId`
   param, it:
   - Resolves the short key (`VIS`) or UUID to a real project UUID via
     `ProjectAccessService.resolveProjectId()`, exposed to controllers as `@ProjectId()`
     (`project-permission.guard.ts:58-62`, `project-id.decorator.ts`).
   - Re-fetches the caller's `ProjectRole` **fresh from `ProjectMember`, every request**
     (`getProjectRole()`, `project-access.service.ts:45-51`) — a role change or membership
     removal takes effect on the very next request, no token expiry wait.
   - Rejects with `403 NOT_A_PROJECT_MEMBER` if the route has a `projectId` and the caller has no
     membership row (unless they're a platform `ADMIN`) — **project read access is implicit
     membership**, no separate "view" permission exists.
   - If the route carries `@RequirePermission(x)`, calls the **shared** `can()` function
     (`permissions.ts:125-130`) — the exact same function the React `useProjectPermissions()` hook
     calls client-side to hide/disable buttons. One source of truth, confirmed by both consuming
     the same `packages/shared/src/permissions.ts` export.
3. **No hardcoded role comparisons found** in `work-items.controller.ts` or
   `work-items.service.ts` — every gate is a `@RequirePermission('...')` decorator, consistent
   with the CLAUDE.md invariant *"Interdiction d'écrire `role === 'PRODUCT_OWNER'`"*.

### 23.3 Backlog-specific route permissions (from the controller)

```
GET  .../backlog                → (no decorator — any project member, read is implicit)
GET  .../board                  → (no decorator — any project member)
GET  .../work-items/:id         → (no decorator — any project member)
POST .../work-items             → @RequirePermission('workitem:create')
PATCH .../work-items/:id        → @RequirePermission('workitem:update')
POST .../work-items/:id/move    → @RequirePermission('workitem:move')
POST .../work-items/:id/reorder → @RequirePermission('backlog:reorder')
DELETE .../work-items/:id       → @RequirePermission('workitem:delete')
```
(`work-items.controller.ts:42-129`)

---

## 24. API Inventory (Backlog-relevant)

| Method | Endpoint | Purpose | Permission | Request | Response |
|---|---|---|---|---|---|
| GET | `/projects/:projectId/backlog` | Hierarchical tree (Epic > Story/Bug > Subtask) | Project membership only | Query: `WorkItemFilters` | `BacklogNode[]` |
| GET | `/projects/:projectId/board` | 5-column board (epics excluded by default) | Project membership only | Query: `WorkItemFilters` | `BoardColumn[]` |
| GET | `/projects/:projectId/work-items/:itemId` | Full ticket detail | Project membership only | — | `WorkItemDetail` |
| POST | `/projects/:projectId/work-items` | Create epic/story/bug/subtask | `workitem:create` | `CreateWorkItemInput` | `WorkItemDetail` |
| PATCH | `/projects/:projectId/work-items/:itemId` | Update fields, labels, assignees, criteria, parent | `workitem:update` | `UpdateWorkItemInput` | `WorkItemDetail` |
| POST | `/projects/:projectId/work-items/:itemId/move` | Board move: status + position | `workitem:move` | `MoveWorkItemInput` | `WorkItemSummary` |
| POST | `/projects/:projectId/work-items/:itemId/reorder` | Backlog reprioritization (status stripped) | `backlog:reorder` | `MoveWorkItemInput` (status ignored) | `WorkItemSummary` |
| DELETE | `/projects/:projectId/work-items/:itemId` | Soft-delete + cascade to descendants | `workitem:delete` | — | `204 No Content` |
| GET | `/projects/:projectId/labels` | List project labels | Project membership only | — | `LabelSummary[]` |
| POST | `/projects/:projectId/labels` | Create label | `label:manage` | `CreateLabelInput` | `LabelSummary` |
| PATCH | `/projects/:projectId/labels/:labelId` | Update label | `label:manage` | `UpdateLabelInput` | `LabelSummary` |
| DELETE | `/projects/:projectId/labels/:labelId` | Delete label (detaches from all tickets) | `label:manage` | — | `204` |
| GET | `/projects/:projectId/work-items/:itemId/comments` | List comments | Project membership only | — | `CommentSummary[]` |
| POST | `/projects/:projectId/work-items/:itemId/comments` | Add comment (+ mentions) | `comment:create` | `CreateCommentInput` | `CommentSummary` |
| DELETE | `/projects/:projectId/work-items/:itemId/comments/:commentId` | Soft-delete comment | (author or `comment:delete:any` — **NOT independently re-verified line-by-line for the author-self-delete branch in this audit; controller-level decorator not captured above**) | — | `204` |
| GET | `/projects/:projectId/work-items/:itemId/activity` | Activity feed (comment events only in practice, §22) | Project membership only | — | `ActivitySummary[]` (max 50) |
| GET | `/search?q=` | Global search incl. work items by title/description | Authenticated | Query: `q` | `SearchResult[]` |

---

## 25. API Response Examples (sanitized)

### 25.1 `GET /projects/VIS/backlog` (excerpt — shape only, values illustrative)

```json
[
  {
    "id": "b2c1a...",
    "key": "VIS-1",
    "number": 1,
    "projectId": "3fae...",
    "type": "EPIC",
    "title": "Gestion des Accès, Authentification & Sécurité RBAC",
    "status": "IN_PROGRESS",
    "priority": "HIGH",
    "storyPoints": null,
    "rank": "m",
    "isBlocked": false,
    "blockedReason": null,
    "parentId": null,
    "sprintId": null,
    "startDate": null,
    "dueDate": null,
    "assignee": null,
    "assignees": [],
    "reporter": { "id": "u1...", "name": "Admin VisioraAI", "email": "admin@visiora.ai", "avatarUrl": null },
    "labels": [],
    "childCount": 1,
    "doneChildCount": 0,
    "rolledUpPoints": 5,
    "createdAt": "2026-08-07T13:12:43.000Z",
    "updatedAt": "2026-08-20T10:00:00.000Z",
    "children": [
      {
        "id": "8ac0...",
        "key": "VIS-1-1",
        "number": 1,
        "type": "STORY",
        "title": "En tant qu'utilisateur, je m'authentifie avec mon email et mot de passe",
        "status": "DONE",
        "priority": "HIGH",
        "storyPoints": 5,
        "rank": "j",
        "parentId": "b2c1a...",
        "assignees": [{ "id": "u2...", "name": "Dev Backend", "email": "…", "avatarUrl": null }],
        "reporter": { "id": "u1...", "name": "Admin VisioraAI", "...": "…" },
        "labels": [{ "id": "l1...", "name": "backend", "color": "#0078D4" }],
        "childCount": 2,
        "doneChildCount": 2,
        "rolledUpPoints": 5,
        "children": []
      }
    ]
  }
]
```
Note (per §5): the child story renders as `VIS-1-1`, not `VIS-1-1-1` or similar — its `number` (1)
is the story's own sibling-scoped number under that Epic.

### 25.2 `POST /projects/VIS/work-items/:itemId/reorder` — request/response

```json
// Request
{ "beforeId": "8ac0...", "afterId": "9fd2..." }

// Response (200) — WorkItemSummary
{ "id": "...", "key": "VIS-1-2", "rank": "jm", "boardRank": "b", "...": "…" }
```

### 25.3 Error body shape (`AllExceptionsFilter`, `apps/api/src/common/filters/all-exceptions.filter.ts:35-45`)

```json
{
  "statusCode": 400,
  "code": "ASSIGNEE_NOT_MEMBER",
  "message": "Chaque personne assignée doit être membre du projet",
  "timestamp": "2026-09-17T10:00:00.000Z",
  "path": "/api/v1/projects/VIS/work-items"
}
```
Validation errors additionally carry `details: Record<string, string[]>` (per-field messages),
consumed directly by the React `ApiError.fieldErrors` getter (`api-client.ts:19-25`).

---

## 26. Backend Service Flow (traced call chains)

### 26.1 Create a ticket
```
POST /projects/:projectId/work-items
 → ProjectPermissionGuard (resolves projectId, checks 'workitem:create')
 → WorkItemsController.create()
 → ZodValidationPipe(createWorkItemSchema)   — shared Zod schema, client and server both validate against it
 → WorkItemsService.create(projectId, dto, reporterId=user.id)
    → assertHierarchy()                      — parent type check
    → assertReferences()                     — assignees/sprint/labels ownership check
    → RankingService.initialRanks()          — end-of-list rank + boardRank
    → numberedTransaction(Serializable, ≤4 retries)
       → nextAvailableNumber()               — smallest free int in (projectId, type, parentId)
       → tx.workItem.create({ ...nested labels/assignees writes })
    → getById(projectId, created.id)         — second full read, builds response
 → 201 WorkItemDetail
```

### 26.2 Drag-reorder in the backlog
```
User drags a row → BacklogPage.onDragEnd()
 → same-parent check (client-side guard, no API call if parents differ)
 → derive {beforeId, afterId} from sibling array + drag direction
 → useReorderBacklog().mutate()
 → POST /work-items/:itemId/reorder
    → ProjectPermissionGuard ('backlog:reorder')
    → WorkItemsController.reorder()          — strips any `status` from the body
    → WorkItemsService.move(projectId, itemId, { ...dto, status: undefined })
       → RankingService.computeRank('rank', {beforeId, afterId}, {projectId, parentId})
          → rankOf(beforeId), rankOf(afterId) in parallel
          → guard: before >= after → 400 INCONSISTENT_POSITION
          → rankBetween(before, after)  [fractional key]
       → prisma.workItem.update({ where: {id}, data: { rank } })   — single row write
    → 200 WorkItemSummary
 → onSuccess: invalidateQueries(['projects', projectRef])          — full refetch
```

---

## 27. Transactions / Concurrency

| Concern | Protected? | Mechanism | Evidence |
|---|---|---|---|
| Ticket number uniqueness | **Yes**, application-level | `Serializable` isolation + up to 4 retries on `P2002`/`P2034` | `work-items.service.ts:465-483` |
| Ticket number uniqueness (DB backstop) | **No** | No `@@unique` on `(projectId, type, parentId, number)` in the schema | `schema.prisma:352-416` (absent) |
| Backlog/board reorder | **Yes** | Neighbour-based fractional ranks — each move is one `UPDATE`, no shared counter to contend on; a stale-neighbour conflict surfaces as a client-visible `400`, not a silent corruption | `ranking.service.ts:24-58` |
| Parent reassignment | **Yes**, partially | Re-parenting re-runs the numbered `Serializable` transaction (new `number` allocation) but the rank computation and the parent-connect happen in the **same** transaction only when `changesParent` — verified at `work-items.service.ts:363-375` | `work-items.service.ts:347-375` |
| Sprint moves | **No dedicated protection** — a plain FK connect/disconnect inside whichever transaction the surrounding call uses; no serializable isolation, no retry | `work-items.service.ts:359-361` |
| Status changes | **No dedicated protection** beyond the ordinary transaction wrapping the update | `work-items.service.ts:225-252` |
| Assignee/label replace | **Yes, implicitly** — delete-then-recreate happens inside the same `$transaction` as the parent field update, so a crash mid-way rolls back cleanly | `work-items.service.ts:215-290` |
| Soft-delete cascade | **Partial** — `collectDescendants()` reads happen **outside** any transaction (multiple sequential `findMany` calls before the final `updateMany`), so the descendant set could theoretically change between the read and the write under heavy concurrent re-parenting; the final `updateMany` itself is atomic | `work-items.service.ts:385-397, 558-574` |

Explicitly, per §41's "do not hide weaknesses" instruction: **the descendant-collection read in
`softDelete()` is not wrapped in the same transaction as the final `updateMany`**, so a
theoretical race (someone re-parents a grandchild into the subtree being deleted, between the
`collectDescendants()` read and the `updateMany()` write) could leave that grandchild un-deleted.
Given the 3-level-deep, low-write-frequency nature of ticket hierarchies this is a low-probability
edge case, but it is a real gap, not a hypothetical one invented for this report — it follows
directly from reading the method.

---

## 28. State Management / Cache (Frontend)

**Library: TanStack Query** (`@tanstack/react-query`) exclusively — no Redux, no Zustand, no
server components (this is a Vite SPA, not Next.js). Confirmed by `query-client.ts` and every
`hooks.ts` file across `features/*`.

- **Global defaults** (`query-client.ts:4-16`): `staleTime: 30_000` (30s — a repeat visit to the
  backlog within 30s of the last fetch serves cached data with no network call), 
  `refetchOnWindowFocus: false`, and a custom `retry` that **never** retries 4xx `ApiError`s
  (permission/not-found errors) but retries other failures up to twice.
- **Query keys**: centralized factory in `workItemKeys` (`work-items/hooks.ts:12-20`) —
  `backlog(projectRef, filters)` includes the **entire filters object** in the key, so every
  distinct filter combination is its own independent cache entry (no manual cache-busting needed
  when filters change; changing any filter is simply a different key → new fetch, old entries
  garbage-collected per TanStack Query defaults).
- **Optimistic updates: board only.** `useMoveWorkItem()` (`hooks.ts:90-115`) is the sole mutation
  with an `onMutate` cache patch + `onError` rollback pattern in the entire work-items feature.
  The backlog's `useReorderBacklog()` and every field-edit mutation (`useUpdateWorkItem`,
  `useCreateWorkItem`, `useDeleteWorkItem`) use the simpler invalidate-on-success pattern —
  meaning **a backlog drag-reorder has a visible round-trip delay** before the row settles into
  its final position, while a **board** column drag feels instantaneous.
- **Invalidation granularity:** broad — `['projects', projectRef]` invalidates every query for
  that project (backlog, board, labels, sprints, members, dashboard, etc. — anything whose key
  starts with that prefix), not a narrowly-scoped `['projects', projectRef, 'backlog']`. This
  trades a few extra refetches for simplicity and guarantees consistency across views (e.g.
  creating a ticket also refreshes the dashboard's ticket count without a dedicated dashboard
  invalidation call).
- **Loading/error states:** `LoadingState`, `ErrorState`, `InlineError`, `EmptyState` — shared
  components (`components/common/StateMessage.tsx`, not read in full during this audit but
  referenced consistently across `BacklogPage.tsx`, `WorkItemDetailPanel.tsx`).

---

## 29. Performance / Scalability

- **No pagination on the backlog or board endpoints.** `workItemFiltersSchema` has no `page`/
  `pageSize` fields (contrast with the generic `paginationSchema` that *does* exist in
  `packages/shared/src/dto/common.ts:15-19` but is used elsewhere, e.g. user lists — **not** wired
  into `workItemFiltersSchema`). `getBacklog()` always does one unbounded `findMany` for the whole
  project (`work-items.service.ts:45-50`).
- **No lazy/incremental child loading.** The entire tree — every Epic, Story, Bug, Subtask in the
  project, regardless of collapse state — is fetched and transmitted on every backlog page load;
  collapsing a node is a pure client-side render optimization (`flattenVisible`), not a data
  optimization.
- **In-memory tree construction**, O(n) via a `Map`, single pass (`getBacklog()`,
  `work-items.service.ts:52-68`) — efficient for the data it has, but the data volume itself is
  unbounded.
- **Indexes exist** for the query patterns actually used: `[projectId, status]`,
  `[projectId, type, rank]`, `[projectId, parentId, type, number]`,
  `[projectId, status, boardRank]` (`schema.prisma:408-411`) — so filtering/sorting by the
  supported dimensions should use an index, but the **search** filter (`contains` on `title`/
  `description`/`technicalNotes`) has **no** matching index (no `pg_trgm` GIN index found in any
  migration file) — a substring search on those columns will force a sequential scan.
- **No debounce on the search input** (§13) — every keystroke is a new query key, though the 30s
  `staleTime` and React's own render batching soften this somewhat; still, a fast typist can fire
  several backlog re-fetches per second.

**Projected behavior by scale, based strictly on the above:**
- **~100 tickets:** No perceptible issue — single unbounded query, small payload, in-memory tree
  build is trivial.
- **~1,000 tickets:** Still likely fine on a modern connection/DB — indexed `WHERE`/`ORDER BY`
  clauses keep the query itself fast; the payload (a few hundred KB of JSON) and the client-side
  tree-flatten become the dominant, still-modest costs. The search's un-indexed `contains` starts
  to show latency under concurrent load.
  
- **~10,000 tickets:** The **lack of pagination** becomes the primary risk — every backlog page
  load ships the entire project's ticket set over the wire and rebuilds/flattens/renders it
  client-side on every filter change (a new query key = full refetch, no incremental patch). The
  un-indexed `contains` search would likely become a visible bottleneck under concurrent access.
  This is a direct, code-grounded extrapolation, not speculation about unknown behavior.

---

## 30. Tests

| Test file | Layer | What it verifies |
|---|---|---|
| `packages/shared/src/lexorank.spec.ts` | Shared/unit | Fractional rank generation, adjacency handling, `initialRanks()` monotonicity, invalid-bounds rejection |
| `packages/shared/src/dto/work-item.spec.ts` | Shared/unit | `canBeChildOf()` hierarchy rules, `REQUIRES_PARENT`, Zod schema acceptance/rejection (subtask-without-parent, title length, multi-assignee, filters, move payloads) |
| `packages/shared/src/permissions.spec.ts` | Shared/unit | RBAC matrix (`can()`) — not read in full line-by-line in this audit, but its existence and scope are confirmed by the file listing and its role as the single permission source |
| `apps/api/src/modules/work-items/work-item-numbering.spec.ts` | Backend/unit | `smallestAvailableNumber()` gap-filling logic; `workItemKey()` exact string output for epic/story/subtask/root-story/root-bug |
| `apps/api/src/modules/work-items/ranking.service.spec.ts` | Backend/unit | `computeRank()`: insert-between-neighbours, head/tail placement, empty-list fallback, inverted-neighbour rejection, board-vs-backlog field isolation, 100-iteration same-gap insertion stress test |
| `apps/api/src/modules/work-items/work-items.service.spec.ts` | Backend/unit | Multi-assignee create (dedup, legacy `assigneeId` compatibility) and update (full-replace semantics) — Prisma fully mocked, no real DB |
| `apps/web/tests/e2e/auth-navigation.spec.ts` | Frontend/E2E (Playwright) | Login flow; nav-link visibility for all project sections incl. Backlog; **backlog filters persisted in and restored from the URL** (search/type/priority/hideDone); **keyboard-focusable drag handles** on both backlog and board |

### 30.1 What is explicitly NOT tested (verified by absence)

- No backend integration/e2e test exercises a real Postgres database for `WorkItemsService`
  (`work-items.service.spec.ts` mocks Prisma entirely) — the Serializable-transaction retry logic,
  the actual concurrency behavior under real contention, and the `nextAvailableNumber` DB
  round-trip are **not** covered by an integration test in this repo.
- No test asserts the `1/4` child-ratio formula's exact direct-children-only semantics end-to-end
  (the aggregation logic itself, `computeAggregates()`, has no dedicated unit test file — it's only
  indirectly exercised via `work-items.service.spec.ts`'s two multi-assignee tests, which don't
  touch aggregation at all).
- No test covers the parent-promotion-on-filter behavior described in §14.2.
- No test covers the `status`+`hideDone` key-collision edge case in §14.1.
- No test covers soft-delete cascade to descendants (`collectDescendants`/`softDelete`).
- No E2E test drags an actual card and asserts the resulting rank ordering server-side — the one
  E2E DnD test only asserts the drag **handle is focusable**, not that a drag-and-drop completes
  correctly.
- No accessibility audit test (axe-core or similar) was found for the backlog page.

---

## 31. Professional Features Around Backlog — Integrations

- **Board** — same `WorkItem` rows, same `WorkItemsService`, different query (`getBoard()`
  restricts `type` to `{STORY, BUG, SUBTASK}` and orders by `boardRank` instead of `rank`). Ticket
  identity is fully preserved — it's the same row, same UUID, same derived key.
- **Sprints** — `WorkItem.sprintId` is a plain FK; moving a ticket in/out of a sprint doesn't touch
  `rank`/`boardRank`/`number` — identity and backlog position survive a sprint change untouched.
- **Roadmap** — not deep-audited in this backlog-focused pass, but `WorkItem.startDate`/`dueDate`
  are the fields flagged in the schema comment as roadmap-positioning columns
  (`schema.prisma:381-383`), confirming Roadmap reads the same `WorkItem` rows rather than a
  separate model.
- **Repos & PR** — `PullRequest.workItemId` is a required FK (`schema.prisma:502`, cascade on
  delete); a ticket can have many PRs (`WorkItem.pullRequests[]`). PR linkage survives every
  backlog operation (reorder, re-parent, status change) since none of them touch `PullRequest`
  rows.
- **Dashboards** — `ReportsService.dashboard()` reads the same `WorkItem` table directly (status
  distribution, points, blocked count), always excluding Epics from the raw counts
  (`type: { not: EPIC }`, `reports.service.ts:26`) — consistent with the board's "epics aren't
  real work" rule.
- **Global search** — `ReportsService.search()` independently re-implements a *subset* of the
  backlog's filter logic (title/description `contains`, insensitive; **not** technicalNotes,
  unlike the backlog's own search) scoped to projects the caller is a member of
  (`reports.service.ts:159-176`) — this is a **second, separate** query implementation, not a
  reuse of `WorkItemsService.buildWhere()`; the two search behaviors could drift independently.
- **Comments/Attachments** — both live directly on `WorkItem` via FK, both rendered inside the
  same `WorkItemDetailPanel`, both integrated with `ActivityLog` (comments confirmed, attachments
  not exhaustively re-verified in this pass — see §22 caveat) and with SSE-based real-time
  notifications for @mentions (`NotificationsService.notifyMention`,
  `notifications.service.ts:33-63`, pushed over an RxJS `Subject` per user, consumed via
  Server-Sent Events).

---

## 32. Screenshot Reconstruction

```
BACKLOG PAGE                                    File: BacklogPage.tsx
│
├── Header (border-b, px-4 py-2)
│   ├─ "Backlog" title + row count
│   └─ "+ Nouveau ticket" button           (gated: can('workitem:create'))
│
├── FiltersBar (shared component, border-b, px-4 py-1.5, flex-wrap)
│   ├─ Search input                        (title/description/technicalNotes, server-side, no debounce found)
│   ├─ Type <select>                       (all WorkItemType incl. EPIC)
│   ├─ Assignee <select>                   (project members; matches multi-assignee OR legacy field)
│   ├─ Creator <select>                    (project members; matches reporterId)
│   ├─ Priority <select>                   (4 values)
│   ├─ Label <select>                      (project labels)
│   ├─ Sort <select>                       ("Ordre manuel" = rank, or 6 explicit fields)
│   ├─ Sort direction <select>             (shown only when a sort field is chosen)
│   ├─ "Masquer les terminés" checkbox     (backlog only, not board)
│   └─ "Réinitialiser" button              (clears everything except hideDone)
│
├── Column header row (uppercase, text-xs, text-ink-500)
│   Titre │ Statut │ Priorité │ Pts │ Créé par │ Assignés
│
└── DndContext > SortableContext > BacklogRow[]   (flattened tree, depth-indented 14px/level)
     ├─ Drag handle (GripVertical, visible only if backlog:reorder + manual sort)
     ├─ Expand/collapse chevron               (only if node has children)
     ├─ TypeIcon                              (Crown/BookOpen/Bug/CheckSquare, color-coded)
     ├─ Key ("VIS-1-2")
     ├─ Title (click → opens WorkItemDetailPanel)
     ├─ LabelChips
     ├─ "bloqué" pill                         (conditional, isBlocked)
     ├─ "{doneChildCount}/{childCount}"        (conditional, direct children only — §4.1)
     ├─ StatusPill                             (5 statuses, color-coded)
     ├─ PriorityBadge                          (4 priorities, color-coded)
     ├─ StoryPoints bubble                     (own points, or rolled-up if unset — §4.2)
     ├─ Avatar + reporter name                 ("Créé par")
     └─ AvatarStack                            ("Assignés", up to 3 + "+N")

WorkItemDetailPanel (slide-over, opened by title click)
     ├─ Header: TypeIcon, key, StatusPill, parent breadcrumb, delete/close buttons
     ├─ "Créé par" strip (Avatar, name, createdAt)
     ├─ Title input
     ├─ Status / Priority / Assignees / Story points / Parent / Sprint (2-col grid)
     ├─ Description (Markdown editor, collapsible <details>, open by default)
     ├─ Technical notes (Markdown editor, collapsible <details>, closed by default)
     ├─ AcceptanceCriteriaEditor
     ├─ Label toggle buttons
     ├─ "Ticket bloqué" checkbox + reason input
     ├─ Subtasks list + inline add (Story/Bug only)
     ├─ CommentsPanel (comments + "Activité récente" feed, §22)
     ├─ AttachmentsPanel
     └─ Footer: type Badge, Close / Save buttons
```

---

## 33. What Makes This Implementation Professional

### Patterns Worth Reusing
1. **Two independent order fields (`rank` vs `boardRank`) on the same row.** Cleanly decouples
   "priority in the plan" from "position in today's workflow column" — reordering one never
   perturbs the other. (`schema.prisma:371-375`)
2. **Neighbour-based reorder payloads (`beforeId`/`afterId`), never an index.** Makes concurrent
   drag-and-drop from multiple users safe by construction, and keeps every reorder a single-row
   `UPDATE`. (`ranking.service.ts`)
3. **One permission matrix, imported by both server guard and client hook.** Eliminates an entire
   class of "the UI hid the button but the API still allowed it" bugs, and vice versa.
   (`packages/shared/src/permissions.ts`)
4. **Token carries identity only; role is re-resolved from the DB on every request.** Makes
   membership/role changes take effect immediately, with no token-expiry lag.
   (`project-access.service.ts`)
5. **A single shared Zod schema drives client-side form validation *and* server-side request
   validation.** The exact same `createWorkItemSchema`/`updateWorkItemSchema` objects are imported
   by both `react-hook-form`'s resolver conventions on the client and NestJS's `ZodValidationPipe`
   on the server (visible via the `@visiora/shared` import in both
   `work-items.controller.ts` and the frontend `CreateWorkItemDialog.tsx`).
6. **Filtering after loading a flat row set, then rebuilding the tree, with explicit
   parent-promotion for orphaned matches.** Avoids the common bug where a matching child
   "disappears" because its non-matching parent got filtered out (§14.2).
7. **A hierarchy authority table (`ALLOWED_PARENT_TYPES`) consulted by both UI and API**, rather
   than hardcoded `if (type === 'SUBTASK' && parent.type !== 'STORY')` checks scattered around.
8. **`smallestAvailableNumber()` reuse of freed numbers** combined with Serializable-transaction
   retries keeps ticket keys short and stable-looking even after heavy churn, without a
   centralized counter service.

### Patterns That Should Not Be Copied
1. **No `ActivityLog` entries for status/priority/assignee/points/parent/rank changes on work
   items** (§22) — the UI presents an "Activité récente" section that implicitly promises this
   history but only ever shows comment events. Copying this gap would ship a feature that looks
   complete but silently isn't.
2. **`NotificationType.ITEM_ASSIGNED` / `ITEM_STATUS_CHANGED` declared but never triggered** (§10,
   §22) — dead enum values create false confidence when someone greps for "is assignment
   notified?" and finds the enum without checking whether anything produces it.
3. **No database-level unique constraint backing the ticket-number allocation** (§5.2, §27) —
   correctness rests entirely on transaction isolation level and applic­ation retry logic. A future
   refactor that accidentally lowers the isolation level would silently reintroduce duplicate
   keys with no constraint to catch it.
4. **Silent filter key collision between `status` and `hideDone`** (§14.1) — two independently
   intentioned query parameters happen to write the same object key; whichever is spread later
   wins, with no validation error to signal the conflict to the caller.
5. **Soft-delete `onDelete: Cascade` schema annotations that never actually fire**, because the
   application only ever soft-deletes (§21) — the schema *reads* as if related rows get cleaned
   up, but they accumulate indefinitely as orphaned rows referencing a soft-deleted parent.
6. **No pagination on backlog/board endpoints** (§29) — fine at demo scale, a genuine scaling risk
   already visible in the code today, not a hypothetical future problem.
7. **No debounce on the search input** (§13) — small in isolation, but combined with no pagination
   and an unindexed `contains` search, this compounds at scale.
8. **Batch-save detail panel presented alongside genuinely-inline comments/attachments** (§18) —
   the mixed interaction model (some sections save instantly, most require an explicit
   "Enregistrer") is a usability inconsistency worth deciding on purposefully rather than
   inheriting incidentally.

---

## 34. Extraction — Technology-Neutral Functional Specification

This section describes **concepts**, not implementation, for use in a different stack.

- **WorkItem** — a single polymorphic ticket entity with a `type` discriminator (at minimum:
  Epic, Story, Bug, Subtask-equivalents), not separate tables per type. Carries: title, optional
  rich-text description (PO-facing) and a separate optional rich-text field for
  implementer-facing notes, status, priority, optional numeric estimate, two independent
  manual-order keys (one for a hierarchical backlog view, one for a swimlane/board view), a
  self-referencing parent link, a creator link (immutable, required), a sprint link (optional),
  block/blocked-reason fields, start/due dates, soft-delete marker.
- **WorkItemHierarchy** — a *type-constrained* self-reference: define, as data (not code), which
  types may parent which other types, and which types require a parent. Enforce it in exactly one
  place (shared between client and server if the stack allows), and re-validate cycles on every
  re-parent. Cap depth deliberately (3 levels observed here) rather than allowing infinite nesting
  — bound the recursive-descendant-collection cost.
- **Status** — a small, fixed, ordered enum (not a configurable workflow engine in this
  implementation). Exactly one status value is treated as "complete" by every consumer (filter,
  aggregate, UI dimming) — pick that value once and reuse the same predicate everywhere rather
  than re-deriving "is this done?" logic per feature.
- **Priority** — a small fixed enum; if you want priority to drive sort order, either give it an
  explicit numeric weight column or rely on (and document) enum-declaration-order sort semantics —
  don't leave it implicit and undocumented as this codebase does.
- **Assignment** — model as a proper many-to-many join table from day one (`WorkItem ↔ User`),
  not a single nullable FK; multi-assignee is a common enough requirement that migrating later
  (as this codebase did — the legacy `assigneeId` column is the scar tissue from that migration)
  costs more than starting with the join table.
- **Label** — many-to-many, scoped to the same boundary as the ticket (here: project), each label
  carrying a display color validated to a safe format.
- **Point estimation** — a nullable numeric field, ideally constrained by the UI to a recognized
  estimation scale (Fibonacci-like) even if the API layer accepts a wider numeric range; roll-up
  to a parent should be an explicit, documented aggregation rule (direct-children-only, as
  implemented here, is simpler and cheaper than full-subtree recursion and was a deliberate
  choice worth keeping).
- **Manual rank** — fractional/LexoRank-style string keys, computed from client-supplied
  neighbour identifiers (not array indices), so concurrent reorders never collide and a move is
  always a single-row write.
- **Creator traceability** — a required, immutable, non-nullable "reporter" reference set once at
  creation from the authenticated actor, never editable via any update endpoint, joined live (not
  snapshotted) for display.
- **Activity history** — if you promise a generic change-history feed in the UI, actually populate
  it for every mutating action (status, assignee, priority, points, parent, rank), not only for
  comments — this codebase's biggest gap (§22) is a cautionary example, not a pattern to imitate.
- **Filters** — combine as AND across independent dimensions; when filtering a hierarchical view,
  explicitly decide (and test) what happens to a child whose parent doesn't match, and to a parent
  whose children don't match — don't let it fall out of query-order accidentally, as the
  `status`/`hideDone` collision in this codebase did.
- **Permissions** — one shared, data-driven permission matrix consumed identically by server
  enforcement and client-side control-hiding; a route-level "requires membership" check
  independent of any specific-permission checks (implicit read access via membership, as
  implemented here) is a reasonable default worth keeping.

---

## 35. Minimum Data Model to Reproduce the Experience

```
Project
 └ WorkItem
    ├ type: enum (Epic | Story | Bug | Subtask)
    ├ title, status, priority, points?, description?, implementerNotes?
    ├ rank (backlog order, string, fractional)
    ├ boardRank (board order, string, fractional — independent of rank)
    ├ number (int, scoped uniqueness per project+type+parent — app-enforced)
    ├ parent → WorkItem?                       (self-FK, type-constrained, cycle-checked)
    ├ children[] → WorkItem[]
    ├ creator → User                            (required, immutable, live-joined)
    ├ WorkItemAssignee → User  (many-to-many)
    ├ WorkItemLabel → Label    (many-to-many, Label scoped to Project)
    ├ AcceptanceCriterion[]    (own table: id, content, isMet, position)
    ├ Comment[]                (self-threaded one level deep, mentionedUserIds[])
    ├ sprint → Sprint?
    ├ isBlocked, blockedReason?
    ├ startDate?, dueDate?
    ├ createdAt, updatedAt, closedAt?, deletedAt?  (soft delete)
    └ (recommended addition, not present here) ChangeLog[] — one row per mutated field, actor,
      old/new value, to actually fulfill an "activity history" promise (§22, §33)
```

---

## 36. Minimum Backend Capabilities

| Capability | Implemented in Agil_Project? | How |
|---|---|---|
| Hierarchical list (single fetch, tree built server- or client-side) | Yes | `getBacklog()` — one unbounded query, in-memory tree rebuild |
| Filtering (multi-dimension, combinable) | Yes | `buildWhere()` — AND-combined Prisma `where`; one collision edge case (§14.1) |
| Full-text-ish search | Partial | `contains`/insensitive on 3 columns, no index, no debounce upstream |
| Multi-assignee | Yes | Join table + legacy-compat singular column |
| Type-constrained hierarchy with cycle protection | Yes | `ALLOWED_PARENT_TYPES` + `assertNoCycle()` |
| Manual ordering safe under concurrency | Yes | LexoRank + neighbour-based API |
| Scoped, reusable, race-safe human-readable IDs | Yes (app-level only, no DB constraint) | `smallestAvailableNumber()` + Serializable retry |
| Soft delete with cascade to descendants | Yes | `collectDescendants()` + `updateMany()` (see §27 race caveat) |
| Field-level change traceability | **No** (comments only) | See §22 |
| Assignment/status-change notifications | **No** (enum declared, unused) | See §10, §22 |
| RBAC enforced server-side, shared matrix with client | Yes | `packages/shared/src/permissions.ts` + `ProjectPermissionGuard` |
| Pagination for scale | **No** | See §29 |

## 37. Minimum Frontend Capabilities

| Component | Implemented? | File |
|---|---|---|
| `BacklogPage` (container, tree flattening, DnD orchestration) | Yes | `BacklogPage.tsx` |
| `BacklogToolbar` (equivalent: `FiltersBar`, shared with board) | Yes | `FiltersBar.tsx` |
| `BacklogTable`/row list | Yes (implicit in `BacklogPage`, not a separate component) | `BacklogPage.tsx` |
| `BacklogRow` | Yes | `BacklogPage.tsx` (`BacklogRow` function) |
| `StatusBadge` (equivalent: `StatusPill`) | Yes | `WorkItemChrome.tsx` |
| `PriorityBadge` | Yes | `WorkItemChrome.tsx` |
| `AvatarStack` | Yes | `components/common/AvatarStack.tsx` |
| Filters (type/assignee/creator/priority/label/sort/hideDone) | Yes | `FiltersBar.tsx` |
| Expand/collapse (client-side, per-node, not persisted across sessions) | Yes | `BacklogPage.tsx` (`collapsed` state, `useState`, not URL/localStorage-synced) |
| URL-persisted filters | Yes | `use-url-work-item-filters.ts` |
| Create-ticket modal | Yes | `CreateWorkItemDialog.tsx` |
| Ticket detail slide-over (batch-save, not inline) | Yes | `WorkItemDetailPanel.tsx` |
| Keyboard-accessible drag handles | Yes | `@dnd-kit` `KeyboardSensor` + dedicated `<button>` handle |
| Loading/error/empty states | Yes | Shared `StateMessage` components |

---

# BACKLOG REPLICATION BLUEPRINT

*For a different coding agent, with no access to this repository, to recreate the same functional
principle in a different application/stack. Framework-neutral; no branding.*

## A. Domain entities
- **WorkItem**: polymorphic ticket (`type` ∈ {Epic, Story, Bug, Subtask} or your domain's
  equivalent), with title, status, priority, optional numeric estimate, two independent
  manual-order keys, self-referencing parent, required immutable creator reference, optional
  sprint/iteration reference, block flag + reason, optional start/due dates, soft-delete marker,
  and an application-scoped human-readable number.
- **User**: id, name, email, avatar. Referenced by creator, assignees, comment authors.
- **Label**: id, name, color, scoped to the same boundary as tickets (e.g. per-project).
- **AcceptanceCriterion**: id, content, boolean "met" flag, explicit `position` for manual order.
- **Comment**: id, body, author, optional one-level parent (threaded reply), optional mentioned
  user ids, soft-delete marker.
- **(Recommended) ChangeLogEntry**: id, entity type/id, actor, action, field, old value, new
  value, timestamp — populate this for *every* mutating action on a WorkItem, not only comments.

## B. Relationships
- `WorkItem.parent` → `WorkItem?` (self, nullable, type-constrained).
- `WorkItem.children[]` → `WorkItem[]` (inverse of parent).
- `WorkItem ↔ User` many-to-many for assignees (never a single nullable FK — start with the join
  table).
- `WorkItem ↔ Label` many-to-many.
- `WorkItem → User` required, single, for the creator.
- `WorkItem → Sprint/Iteration` optional, single.
- `WorkItem → AcceptanceCriterion[]`, one-to-many, own table (not embedded JSON) so items can be
  individually ordered/targeted.
- `WorkItem → Comment[]`, one-to-many, comments self-threaded one level deep.

## C. Workflows
1. **Create**: validate hierarchy (parent's type is in the allowed-parents set for the new item's
   type; required-parent types must supply one), validate all referenced ids belong to the same
   scope (project/workspace), allocate the scoped display number inside a concurrency-safe
   transaction, compute initial manual-order keys (end of both the hierarchical list and the
   status-column list), persist, return the full hydrated record.
2. **Update (field edit)**: whitelist-only field application (never blind-spread the request body
   into the update); array-valued relations (assignees, labels, acceptance criteria) are
   **full-replace** semantics driven by the client sending the desired end-state, not a diff.
   Re-parenting re-validates hierarchy + cycles and **re-allocates the display number** in the new
   scope (this changes the ticket's visible key — document this clearly to users/API consumers).
3. **Move/Reorder**: client sends the two neighbour ids after the intended move (never a numeric
   index). Server resolves their current rank/order keys, computes a fractional key strictly
   between them (or between a boundary and "the current end of list" if only one/no neighbour is
   given), and writes exactly one row. Reject silently-incoherent neighbour pairs (before ≥ after)
   with a client-visible, reload-suggesting error rather than silently reordering wrong.
4. **Delete**: soft-delete only; recursively soft-delete the entire descendant subtree in one
   batched write, ideally inside the same transaction as the descendant-collection read to avoid
   a re-parent race (this reference implementation does *not* do that — see Edge Cases below).
5. **Comment**: independent, immediately-persisted mutation (not part of the batch-save form),
   writes both the comment row and a change-log/activity row, and separately notifies any
   @-mentioned users who are members of the same scope.

## D. Traceability rules
- Creator: required, set once at creation from the authenticated actor, never user-editable,
  always live-joined (not a point-in-time name snapshot) for display.
- **If you promise a per-item "activity" or "history" feed in the UI, populate it for every
  mutating action** — status, priority, assignee, points, parent, and order changes, not only
  comments. This reference implementation's biggest gap is doing this for comments only while the
  UI section is generically labeled "Activité récente" — do not repeat that inconsistency.
- Timestamps: `createdAt`/`updatedAt` always; a dedicated `closedAt`-equivalent timestamp set the
  moment status transitions into the single "complete" value, cleared on reopen, is cheap and
  useful for reporting even without full field-level history.

## E. API requirements
- One endpoint returning the **full hierarchical tree** for a given scope in a single response
  (server-side tree assembly from a flat, filtered row set is simpler and often faster at small-
  to-medium scale than N+1 per-level queries) — but **add pagination or depth/row limits before
  scaling past a few thousand items**, since this reference implementation does not, and it is a
  known, documented risk (§29).
- A second endpoint for the status-board view, same underlying filter shape, different default
  type/status exclusions and different order key.
- Move/reorder as its own endpoint (or a well-scoped sub-resource), accepting neighbour ids, not
  index.
- Full-replace semantics for multi-valued relations (assignees, labels, acceptance criteria) on
  the main update endpoint — send the complete desired list, not incremental add/remove calls,
  unless you specifically need fine-grained per-item endpoints too.
- Normalize all error responses to one shape: machine-stable `code`, human `message`, optional
  per-field `details` — let the client render generic errors from `message` and attach field
  errors from `details` without per-endpoint special-casing.

## F. Frontend behaviors
- Single fetch of the whole (filtered) tree; **client-side-only** expand/collapse state (a `Set`
  of expanded/collapsed ids), not re-fetched per toggle.
- Drag-and-drop: use a library that supports both pointer and keyboard interaction out of the box;
  restrict backlog drag to same-parent reordering (reject cross-parent drops with a visible error,
  route re-parenting through an explicit form control instead) — this keeps the reorder gesture
  unambiguous and avoids inferring intent from a drop location.
- Column ranking and manual sort mode are naturally exclusive: disable drag-to-reorder while any
  explicit non-manual sort is active, to avoid a confusing "I dragged it but it's still sorted by
  priority" experience.
- Detail view: decide deliberately between full-inline-autosave and batch-save-on-explicit-button
  — don't mix the two within the same panel without a clear visual signal for which fields are
  which (this reference implementation mixes them: comments/attachments save instantly, everything
  else needs an explicit Save).

## G. Filters
- Support at minimum: free-text search (decide explicitly which fields it covers, and document
  it — do not silently expand/contract the field list later), type, assignee, creator, priority,
  label, a "hide completed" toggle, and a manual-vs-explicit sort mode.
- Combine all active filters with AND.
- For a hierarchical view: explicitly decide and test what happens when a child matches a filter
  but its parent doesn't (promote it to the visible root, as this reference implementation does,
  is a reasonable default) — and the reverse case (parent matches, children don't: don't force
  non-matching children into view).
- **Watch for filter key collisions** — if two independent filter concepts (e.g. an explicit
  status filter and a "hide completed" toggle) can both resolve to the same underlying query
  field, decide and document who wins, rather than letting object-spread order decide by accident
  (this reference implementation has this exact, undocumented collision — see §14.1).
- Persist active filters in the URL so a filtered view is shareable/bookmarkable/reload-safe.

## H. Permissions
- One shared, data-driven permission matrix (role → permission set), consumed identically by
  server-side route guards and client-side control-visibility logic — never duplicate the logic
  in two places.
- Re-resolve the caller's role from persistent storage on every request; never trust a role
  embedded in a long-lived token, so role/membership changes take effect immediately.
- Project/workspace membership itself implies read access; write actions require explicit,
  named permissions (create/update/delete/move/reorder/manage-labels as separate, independently
  grantable permissions, even if your default roles happen to bundle them identically).

## I. Ordering
- Fractional/LexoRank-style string keys, not integer positions — avoids renumbering on every
  insert.
- **Two independent order keys** if you have both a prioritized backlog view and a
  workflow/column view of the same items — moving a card in one view must never perturb its
  position in the other.
- Client sends neighbour identifiers, never a numeric index, to the reorder endpoint.

## J. Hierarchy
- Define allowed parent→child type pairs as data, consulted by both client and server, not as
  scattered `if` statements.
- Enforce a maximum depth deliberately (unbounded nesting complicates cycle detection, UI
  indentation, and descendant-aggregation cost for no clear product benefit in most agile-backlog
  use cases).
- Re-validate for cycles on every re-parent operation, not just at creation.
- Aggregate child counts/points at **one level only** (direct children), and document that choice
  clearly — it is simpler, cheaper, and (per this reference implementation) apparently sufficient
  for the "N/M children done" and "rolled-up points" UI affordances.

## K. Status/priority design
- Small, fixed status enum; exactly one value means "complete," and every consumer (filters,
  aggregates, UI styling) must use that exact same predicate — never let "complete" be redefined
  ad hoc in different places.
- No automatic status transition rules are required for a professional-feeling backlog (this
  reference implementation has none — any permitted user can set any status to any other status
  directly) — but if you *do* want guardrails, add them as an explicit, testable transition table,
  not implicit UI restrictions alone.
- Priority as a small fixed enum; if sort-by-priority matters, give it an explicit numeric weight
  column rather than relying on incidental enum-declaration-order behavior.

## L. Testing requirements
- Unit-test the ranking/order-key algorithm exhaustively, including repeated-insertion-into-the-
  same-gap stress tests (this reference implementation does this well — 100+ iteration tests for
  both the shared library and the service layer).
- Unit-test the hierarchy authority table (every legal and illegal parent/child pair) and the
  human-readable-key generator (every type/position combination) — both are easy to get subtly
  wrong and both are load-bearing for the entire feature's usability.
- Integration-test the concurrency-sensitive paths — display-number allocation under real
  concurrent writes, and the descendant-collection-then-cascade-delete path — against a real
  database, not a mocked one (this reference implementation's own unit tests mock Prisma entirely
  for these paths, which is a coverage gap worth avoiding when replicating).
- E2E-test: filter-state URL persistence and restoration after reload; keyboard accessibility of
  the drag handle; and — beyond what this reference implementation covers — an actual completed
  drag-and-drop reorder, asserting the resulting server-side order.

## M. Important edge cases (all directly observed in the reference codebase, not hypothetical)
1. Re-parenting a ticket changes its human-readable display key (its scoped `number` is
   reallocated in the new parent scope) — decide up front whether your replication should
   preserve keys across re-parenting or accept the same churn, and document the choice.
2. Deleting (soft) a ticket whose id is later reused as a joined query has no bearing here (soft
   delete never frees the underlying row), but the ticket's **display number** *is* freed for
   reuse by a new sibling — a soft-deleted item and a brand-new item can, in principle, end up
   with what looks like the "same" display key if your replication's soft-delete follows this
   pattern; make this deliberate, not accidental.
3. Two filter concepts writing to the same underlying query field (e.g. an explicit status filter
   and a "hide completed" toggle) will silently conflict if implemented as naive object-spread
   merging — resolve this explicitly (reject the combination, or define a documented precedence).
4. A child that matches a filter while its parent doesn't needs an explicit product decision
   (promote to root vs. hide) — untested, undecided behavior here is a common source of "my ticket
   disappeared" bug reports.
5. Descendant-collection-then-cascade-delete has a theoretical TOCTOU race if the collection read
   and the cascading write aren't in the same transaction — close this gap in a replication rather
   than inheriting it.
6. If your board/kanban view reuses the same generic type filter control as your backlog view,
   explicitly decide whether it's allowed to override a type-exclusion rule (e.g. "epics never
   appear on the board") — in this reference implementation, selecting the "Epic" type filter on
   the board *does* override that exclusion, which likely contradicts the intended product rule.

---

*End of report. No source files in the repository were modified, refactored, or otherwise altered
in the production of this document.*
