import { sanitizeLoggedPath } from './request-logger.middleware';

describe('requestLoggerMiddleware - sanitizeLoggedPath', () => {
  it('masque le paramètre token dans les URL pour éviter les fuites de JWT', () => {
    const raw = '/api/v1/notifications/stream?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret';
    const sanitized = sanitizeLoggedPath(raw);
    expect(sanitized).toBe('/api/v1/notifications/stream?token=%5BREDACTED%5D');
    expect(sanitized).not.toContain('eyJ');
  });

  it('masque les autres paramètres sensibles comme password, secret, code', () => {
    const raw = '/api/v1/test?password=supersecret&code=123456&search=hello';
    const sanitized = sanitizeLoggedPath(raw);
    expect(sanitized).toContain('password=%5BREDACTED%5D');
    expect(sanitized).toContain('code=%5BREDACTED%5D');
    expect(sanitized).toContain('search=hello');
  });

  it('conserve intactes les URL sans paramètres sensibles', () => {
    const raw = '/api/v1/projects/VIS/work-items?status=IN_PROGRESS&assigneeId=user-1';
    expect(sanitizeLoggedPath(raw)).toBe(raw);
  });
});
