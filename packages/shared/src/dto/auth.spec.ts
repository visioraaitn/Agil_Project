import { describe, expect, it } from 'vitest';
import { loginSchema } from './auth';

describe('loginSchema', () => {
  it('accepte le champ honeypot vide', () => {
    expect(
      loginSchema.safeParse({
        email: 'user@example.com',
        password: 'secret',
        contactWebsite: '',
      }).success,
    ).toBe(true);
  });

  it('rejette un bot qui remplit le champ honeypot', () => {
    expect(
      loginSchema.safeParse({
        email: 'bot@example.com',
        password: 'secret',
        contactWebsite: 'https://spam.example',
      }).success,
    ).toBe(false);
  });
});
