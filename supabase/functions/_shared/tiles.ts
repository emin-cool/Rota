import type { BBox } from './geo.ts';

/** Bir alanı `stepDeg` büyüklüğünde karolara böler (toplu OSM aktarımı için). */
export function tilesCovering(area: BBox, stepDeg: number): BBox[] {
  const tiles: BBox[] = [];
  const round = (n: number) => Math.round(n * 1e6) / 1e6;
  for (let south = area.south; south < area.north - 1e-9; south += stepDeg) {
    for (let west = area.west; west < area.east - 1e-9; west += stepDeg) {
      tiles.push({
        south: round(south),
        west: round(west),
        north: round(Math.min(south + stepDeg, area.north)),
        east: round(Math.min(west + stepDeg, area.east)),
      });
    }
  }
  return tiles;
}

/** Karo için kararlı kimlik (ilerleme dosyasında kullanılır). */
export function tileId(t: BBox): string {
  return `${t.west}_${t.south}_${t.east}_${t.north}`;
}
