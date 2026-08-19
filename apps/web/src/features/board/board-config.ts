import { WorkItemStatus, LABELS_FR } from '@visiora/shared';

export interface ColumnDefinition {
  id: string;
  status: WorkItemStatus;
  name: string;
  wipLimit?: number | null;
  visible: boolean;
  isCustom?: boolean;
}

export interface BoardConfig {
  columns: ColumnDefinition[];
}

export function getDefaultBoardConfig(): BoardConfig {
  return {
    columns: [
      { id: 'col-todo', status: WorkItemStatus.TODO, name: LABELS_FR.workItemStatus[WorkItemStatus.TODO], visible: true },
      { id: 'col-in-progress', status: WorkItemStatus.IN_PROGRESS, name: LABELS_FR.workItemStatus[WorkItemStatus.IN_PROGRESS], visible: true },
      { id: 'col-in-test', status: WorkItemStatus.IN_TEST, name: LABELS_FR.workItemStatus[WorkItemStatus.IN_TEST], visible: true },
      { id: 'col-ready-for-approval', status: WorkItemStatus.READY_FOR_APPROVAL, name: LABELS_FR.workItemStatus[WorkItemStatus.READY_FOR_APPROVAL], visible: true },
      { id: 'col-done', status: WorkItemStatus.DONE, name: LABELS_FR.workItemStatus[WorkItemStatus.DONE], visible: true },
    ],
  };
}

export function loadBoardConfig(projectKey: string): BoardConfig {
  try {
    const raw = localStorage.getItem(`visiora:board-config:${projectKey}`);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<BoardConfig>;
      if (Array.isArray(parsed.columns) && parsed.columns.length > 0) {
        return { columns: parsed.columns };
      }
    }
  } catch {
    // fallback
  }
  return getDefaultBoardConfig();
}

export function saveBoardConfig(projectKey: string, config: BoardConfig): void {
  try {
    localStorage.setItem(`visiora:board-config:${projectKey}`, JSON.stringify(config));
  } catch {
    // ignore
  }
}
