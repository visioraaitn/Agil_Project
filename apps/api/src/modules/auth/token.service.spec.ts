import { parseDurationSeconds } from './token.service';

describe('parseDurationSeconds', () => {
  it.each([
    ['30s', 30],
    ['15m', 900],
    ['2h', 7200],
    ['7d', 604800],
  ])('convertit %s en %i secondes', (input, expected) => {
    expect(parseDurationSeconds(input)).toBe(expected);
  });

  it('tolère les espaces', () => {
    expect(parseDurationSeconds(' 15m ')).toBe(900);
  });

  it.each(['', '15', 'm15', '15x', '-5m', '1.5h'])('rejette « %s »', (input) => {
    expect(() => parseDurationSeconds(input)).toThrow();
  });
});
