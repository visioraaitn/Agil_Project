import { describe, expect, it } from 'vitest';
import { createPullRequestSchema, createRepositorySchema } from './repository';

describe('validation des URL externes', () => {
  it('accepte HTTPS pour un dépôt', () => {
    expect(
      createRepositorySchema.parse({ name: 'API', url: 'https://github.com/visiora/api' }).url,
    ).toBe('https://github.com/visiora/api');
  });

  it.each(['javascript:alert(1)', 'data:text/html,test', 'file:///etc/passwd', 'ftp://host/repo'])(
    'refuse le protocole dangereux %s',
    (url) => {
      expect(() => createRepositorySchema.parse({ name: 'API', url })).toThrow();
    },
  );

  it('refuse un lien externe de Pull Request non HTTP', () => {
    expect(() =>
      createPullRequestSchema.parse({
        workItemId: '11111111-1111-4111-8111-111111111111',
        repositoryId: '22222222-2222-4222-8222-222222222222',
        title: 'Pull Request sécurisée',
        externalUrl: 'javascript:alert(1)',
        sourceBranchId: '33333333-3333-4333-8333-333333333333',
      }),
    ).toThrow();
  });
});
