import {
  buildOverpassQuery,
  categoriesPerSample,
  classify,
  featureFromDb,
  featureToRow,
  fetchOsmFeatures,
  parseOverpass,
  poisNearRoute,
  type OverpassResponse,
} from './osm.ts';
import { resample } from './geo.ts';
import type { Coord3 } from './types.ts';

// Güneyden kuzeye 1 km'lik düz rota (29,00 boylamı).
const route: Coord3[] = [
  [29, 41, 0],
  [29, 41.009, 0],
];
const samples = resample(route, 100);

describe('classify', () => {
  it('etiketleri kategoriye çevirir', () => {
    expect(classify({ natural: 'coastline' })).toMatchObject({
      category: 'coast',
      areaCapable: false,
    });
    expect(classify({ natural: 'water' })).toMatchObject({ category: 'coast', areaCapable: true });
    expect(classify({ leisure: 'park' }).category).toBe('green');
    expect(classify({ landuse: 'forest' }).category).toBe('green');
    expect(classify({ natural: 'wood' }).category).toBe('green');
    expect(classify({ historic: 'castle' }).category).toBe('historic');
    expect(classify({ highway: 'primary' }).category).toBe('mainRoad');
    expect(classify({ highway: 'residential' }).category).toBeUndefined();
    expect(classify({ amenity: 'drinking_water' }).poiType).toBe('water');
    expect(classify({ amenity: 'toilets' }).poiType).toBe('toilet');
    expect(classify({ highway: 'bus_stop' }).poiType).toBe('transit');
  });
});

describe('buildOverpassQuery', () => {
  it('tek sorguda tüm etiketler ve bbox içerir', () => {
    const q = buildOverpassQuery({ south: 41, west: 29, north: 41.1, east: 29.1 });
    for (const needle of [
      'natural"="coastline',
      'leisure"="park',
      'landuse"="forest',
      'historic',
      'primary|trunk|motorway',
      'drinking_water|toilets|cafe|bench',
      'bus_stop',
      '41.00000,29.00000,41.10000,29.10000',
      'out geom',
    ]) {
      expect(q).toContain(needle);
    }
  });
});

describe('parseOverpass + analiz', () => {
  const json: OverpassResponse = {
    elements: [
      // Rotaya ~30 m doğuda, ona paralel kıyı şeridi
      {
        type: 'way' as const,
        tags: { natural: 'coastline' },
        geometry: [
          { lat: 40.999, lon: 29.0004 },
          { lat: 41.01, lon: 29.0004 },
        ],
      },
      // Çok uzakta bir park (rotadan >50 m)
      {
        type: 'way' as const,
        tags: { leisure: 'park' },
        geometry: [
          { lat: 41.0, lon: 29.01 },
          { lat: 41.0, lon: 29.02 },
          { lat: 41.01, lon: 29.02 },
          { lat: 41.0, lon: 29.01 },
        ],
      },
      // Rota üstünde çeşme ve rotadan uzakta tuvalet
      {
        type: 'node' as const,
        lat: 41.004,
        lon: 29.0002,
        tags: { amenity: 'drinking_water', name: 'Çeşme' },
      },
      { type: 'node' as const, lat: 41.004, lon: 29.01, tags: { amenity: 'toilets' } },
      // Rotayı içine alan bir göl (alan: içindeyken de yakın)
      {
        type: 'relation' as const,
        tags: { natural: 'water' },
        members: [
          {
            type: 'way',
            role: 'outer',
            geometry: [
              { lat: 41.002, lon: 28.99 },
              { lat: 41.002, lon: 29.001 },
              { lat: 41.003, lon: 29.001 },
              { lat: 41.002, lon: 28.99 },
            ],
          },
        ],
      },
    ],
  };
  const features = parseOverpass(json);

  it('nesneleri ayrıştırır', () => {
    expect(features.length).toBe(5);
    expect(features.find((f) => f.category === 'green')?.area).toBe(true);
    expect(features.find((f) => f.poiType === 'water')?.name).toBe('Çeşme');
  });

  it('50 m içindeki kategorileri örnek noktalara yazar', () => {
    const hits = categoriesPerSample(samples, features);
    expect(hits).toHaveLength(samples.length);
    expect(hits.every((h) => h.has('coast'))).toBe(true);
    expect(hits.some((h) => h.has('green'))).toBe(false);
  });

  it('yalnızca rotaya yakın mola noktalarını döndürür', () => {
    const pois = poisNearRoute(samples, features);
    expect(pois).toHaveLength(1);
    expect(pois[0]).toMatchObject({ type: 'water', name: 'Çeşme' });
  });

  it('boş yanıt hata vermez', () => {
    expect(parseOverpass({})).toEqual([]);
  });
});

describe('fetchOsmFeatures (aynalar arası geçiş)', () => {
  const bbox = { south: 41.09, west: 29.04, north: 41.12, east: 29.07 };
  const okBody = JSON.stringify({
    elements: [{ type: 'node', lat: 41.1, lon: 29.05, tags: { amenity: 'drinking_water' } }],
  });
  const reply = (status: number, body = '{}') => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  });

  it('ilk ayna 500 verirse hemen sıradakine geçer ve sonucu döndürür', async () => {
    const calls: string[] = [];
    const fakeFetch = (async (url: string) => {
      calls.push(new URL(url).host);
      return calls.length === 1 ? reply(500) : reply(200, okBody);
    }) as unknown as typeof fetch;
    const features = await fetchOsmFeatures(bbox, fakeFetch, 5000);
    expect(features).toHaveLength(1);
    expect(features[0]!.poiType).toBe('water');
    expect(calls).toHaveLength(2);
    expect(calls[0]).not.toBe(calls[1]);
  });

  it('User-Agent gönderir (Overpass UA’sız istekleri reddeder)', async () => {
    let headers: Record<string, string> = {};
    const fakeFetch = (async (_url: string, init: { headers: Record<string, string> }) => {
      headers = init.headers;
      return reply(200, okBody);
    }) as unknown as typeof fetch;
    await fetchOsmFeatures(bbox, fakeFetch, 5000);
    expect(headers['User-Agent']).toMatch(/^RotaApp\//);
  });

  it('tüm denemeler başarısızsa hata fırlatır (2 tur × 3 ayna = 6 deneme)', async () => {
    let n = 0;
    const fakeFetch = (async () => {
      n++;
      return reply(500);
    }) as unknown as typeof fetch;
    await expect(fetchOsmFeatures(bbox, fakeFetch, 5000)).rejects.toThrow('Overpass');
    expect(n).toBe(6);
  });
});

describe('tam geometri sorgusu ve veritabanı dönüşümleri', () => {
  const bbox = { south: 41.09, west: 29.04, north: 41.12, east: 29.07 };

  it('fullGeometry: kırpma yok, sunucu süresi ayarlanır', () => {
    const full = buildOverpassQuery(bbox, { fullGeometry: true, timeoutSec: 60 });
    expect(full).toContain('[timeout:60]');
    expect(full).toContain('out geom qt;');
    expect(full).not.toContain('out geom(');
    expect(buildOverpassQuery(bbox)).toContain('out geom(41.09000,29.04000,41.12000,29.07000) qt;');
  });

  it('parseOverpass kaynak kimliklerini taşır; ilişki üyeleri ayrı part alır', () => {
    const features = parseOverpass({
      elements: [
        { type: 'node', id: 7, lat: 41.1, lon: 29.05, tags: { amenity: 'toilets' } },
        {
          type: 'relation',
          id: 99,
          tags: { leisure: 'park' },
          members: [
            {
              type: 'way',
              role: 'outer',
              geometry: [
                { lat: 41, lon: 29 },
                { lat: 41.1, lon: 29 },
              ],
            },
            {
              type: 'way',
              role: 'inner',
              geometry: [
                { lat: 41, lon: 29 },
                { lat: 41.1, lon: 29 },
              ],
            },
            {
              type: 'way',
              role: 'outer',
              geometry: [
                { lat: 42, lon: 29 },
                { lat: 42.1, lon: 29 },
              ],
            },
          ],
        },
      ],
    });
    expect(features.map((f) => [f.osmType, f.osmId, f.part])).toEqual([
      ['node', 7, 0],
      ['relation', 99, 0],
      ['relation', 99, 1],
    ]);
  });

  it('featureToRow: EWKT geometri; kimliksiz nesne atlanır', () => {
    const [node, line] = parseOverpass({
      elements: [
        { type: 'node', id: 1, lat: 41.1, lon: 29.05, tags: { amenity: 'cafe', name: 'Kafe' } },
        {
          type: 'way',
          id: 2,
          tags: { natural: 'coastline' },
          geometry: [
            { lat: 41, lon: 29 },
            { lat: 41.1, lon: 29.1 },
          ],
        },
      ],
    });
    expect(featureToRow(node!)).toMatchObject({
      osm_type: 'node',
      osm_id: 1,
      poi_type: 'cafe',
      category: null,
      name: 'Kafe',
      geom: 'SRID=4326;POINT(29.05 41.1)',
    });
    expect(featureToRow(line!)).toMatchObject({
      category: 'coast',
      geom: 'SRID=4326;LINESTRING(29 41,29.1 41.1)',
    });
    expect(
      featureToRow({ coords: [[1, 2]], area: false, bounds: [0, 0, 0, 0], poiType: 'bench' }),
    ).toBeNull();
  });

  it('featureFromDb: nokta ve çizgi koordinatlarını OsmFeature’a çevirir', () => {
    const point = featureFromDb({ c: null, p: 'water', n: 'Çeşme', a: false, g: [29.05, 41.1] });
    expect(point.coords).toEqual([[29.05, 41.1]]);
    expect(point.poiType).toBe('water');
    const line = featureFromDb({
      c: 'coast',
      p: null,
      n: null,
      a: false,
      g: [
        [29, 41],
        [29.1, 41.1],
      ],
    });
    expect(line.coords).toHaveLength(2);
    expect(line.category).toBe('coast');
    expect(line.bounds[0]).toBeLessThan(29);
  });
});
