import { expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({ api: {}, apiFetch: vi.fn() }));
import { apiFetch } from '@/lib/api-client';
import { authApi } from './api';

it('partage la restauration concurrente et permet une nouvelle tentative après échec', async () => {
  const fetch = vi.mocked(apiFetch);
  fetch.mockRejectedValueOnce(new Error('Session expirée'));
  const first = authApi.restore();
  const second = authApi.restore();
  expect(first).toBe(second);
  await expect(first).rejects.toThrow('Session expirée');
  expect(fetch).toHaveBeenCalledTimes(1);
  fetch.mockResolvedValueOnce({ accessToken: 'test-token' });
  await expect(authApi.restore()).resolves.toEqual({ accessToken: 'test-token' });
  expect(fetch).toHaveBeenCalledTimes(2);
});
