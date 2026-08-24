import { WorkItemType } from '@visiora/shared';
import { workItemKey } from './work-item.mapper';
import { smallestAvailableNumber } from './work-items.service';

describe('work item numbering', () => {
  it('reuses the first available positive number', () => {
    expect(smallestAvailableNumber([])).toBe(1);
    expect(smallestAvailableNumber([1, 2])).toBe(3);
    expect(smallestAvailableNumber([1, 3, 4])).toBe(2);
    expect(smallestAvailableNumber([3, 1, 1])).toBe(2);
  });

  it('builds hierarchical epic and story references', () => {
    const epic = { number: 1, type: WorkItemType.EPIC };
    const story = { number: 2, type: WorkItemType.STORY, parent: epic };
    const subtask = { number: 1, type: WorkItemType.SUBTASK, parent: story };

    expect(workItemKey('VIS', epic)).toBe('VIS-1');
    expect(workItemKey('VIS', story)).toBe('VIS-1-2');
    expect(workItemKey('VIS', subtask)).toBe('VIS-1-2-T1');
  });

  it('keeps root stories and bugs unambiguous', () => {
    expect(workItemKey('VIS', { number: 1, type: WorkItemType.STORY })).toBe('VIS-US-1');
    expect(workItemKey('VIS', { number: 1, type: WorkItemType.BUG })).toBe('VIS-B1');
  });
});
