import { describe, it, expect } from 'vitest';
import { getAnimeName } from './animeGrouping';

describe('getAnimeName', () => {
  it('prefers explicit franchise when provided', () => {
    expect(getAnimeName('Some Season', 'My Franchise')).toBe('My Franchise');
  });

  it('matches known pattern (Shingeki no Kyojin)', () => {
    expect(getAnimeName('Shingeki no Kyojin Season 2')).toBe('Shingeki no Kyojin');
    expect(getAnimeName('Shingeki no Kyojin: The Final Season')).toBe('Shingeki no Kyojin');
  });

  it('strips Season/Part suffixes', () => {
    expect(getAnimeName('Some Anime Season 3')).toBe('Some Anime');
    expect(getAnimeName('Some Anime 2nd Season')).toBe('Some Anime');
    expect(getAnimeName('Some Anime Part 2')).toBe('Some Anime');
  });

  it('falls back to the original name when nothing matches', () => {
    expect(getAnimeName('Totally Unique Title')).toBe('Totally Unique Title');
  });

  it('normalizes english Attack on Titan to Shingeki no Kyojin', () => {
    expect(getAnimeName('Attack on Titan')).toBe('Shingeki no Kyojin');
  });
});
