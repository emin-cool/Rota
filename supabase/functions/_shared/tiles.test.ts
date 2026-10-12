import { tileId, tilesCovering } from './tiles.ts';

describe('tilesCovering', () => {
  it('alanı karolara böler, son karoyu alan sınırında keser', () => {
    const tiles = tilesCovering({ west: 28, south: 40, east: 28.12, north: 40.05 }, 0.05);
    expect(tiles).toHaveLength(3); // 3 sütun × 1 satır
    expect(tiles[0]).toEqual({ west: 28, south: 40, east: 28.05, north: 40.05 });
    expect(tiles[2]).toEqual({ west: 28.1, south: 40, east: 28.12, north: 40.05 });
  });
  it('İstanbul çekirdeği makul sayıda karo', () => {
    const tiles = tilesCovering({ west: 28.6, south: 40.85, east: 29.35, north: 41.25 }, 0.05);
    expect(tiles.length).toBe(15 * 8);
    expect(new Set(tiles.map(tileId)).size).toBe(tiles.length);
  });
});
