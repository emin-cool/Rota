import { BUFFER_M, type Category } from './scoring.ts';
import { distPointToPolylineM, pointInRing, type BBox, type Sample } from './geo.ts';
import type { LngLat, PoiType, RoutePoi } from './types.ts';

/** Haritadaki bir OSM nesnesi (nokta ya da çizgi/çokgen), rota analizi için sadeleştirilmiş. */
export type OsmFeature = {
  category?: Category;
  poiType?: PoiType;
  name?: string;
  coords: LngLat[];
  /** Kapalı çokgen (park, göl…): içindeyken de "yakın" sayılır. */
  area: boolean;
  /** [west, south, east, north], tampon dahil. Hızlı eleme için. */
  bounds: [number, number, number, number];
  /** Kaynak OSM nesnesi (veritabanına aktarımda benzersiz anahtar için). */
  osmType?: 'node' | 'way' | 'relation';
  osmId?: number;
  /** İlişkilerde üyenin sırası; düğüm ve yollarda 0. */
  part?: number;
};

type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id?: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
  members?: { type: string; role?: string; geometry?: { lat: number; lon: number }[] }[];
};

export type OverpassResponse = { elements?: OverpassElement[] };

/**
 * Tek sorguda tüm gerekli etiketler (docs/03 adım 5). `out geom(bbox)` her nesnenin koordinatını verir,
 * geometriyi kutuya kırpar.
 *
 * Dikkat (denenerek bulundu): sorgu metnine `//` yorum satırı koyma ve `way["historic"]` kullanma;
 * overpass.private.coffee ve kumi aynaları bunlarda HTTP 500 veriyor. Tarihî yerler yalnızca nokta
 * (`node["historic"]`) olarak alınır.
 */
export type OverpassQueryOptions = {
  /** true: nesnelerin tüm geometrisi (toplu aktarım). false: geometri kutuya kırpılır (canlı sorgu). */
  fullGeometry?: boolean;
  /** Sunucu tarafı zaman aşımı (sn). */
  timeoutSec?: number;
};

export function buildOverpassQuery(b: BBox, opts: OverpassQueryOptions = {}): string {
  const box = `${b.south.toFixed(5)},${b.west.toFixed(5)},${b.north.toFixed(5)},${b.east.toFixed(5)}`;
  return `[out:json][timeout:${opts.timeoutSec ?? 15}];
(
  way["natural"="coastline"](${box});
  way["natural"="water"](${box});
  relation["natural"="water"](${box});
  way["leisure"="park"](${box});
  relation["leisure"="park"](${box});
  way["landuse"="forest"](${box});
  relation["landuse"="forest"](${box});
  way["natural"="wood"](${box});
  relation["natural"="wood"](${box});
  node["historic"](${box});
  way["highway"~"^(primary|trunk|motorway)$"](${box});
  node["amenity"~"^(drinking_water|toilets|cafe|bench)$"](${box});
  node["highway"="bus_stop"](${box});
  node["railway"~"^(station|tram_stop|halt)$"](${box});
  node["public_transport"~"^(platform|station)$"](${box});
);
${opts.fullGeometry ? 'out geom qt;' : `out geom(${box}) qt;`}`;
}

type Classified = { category?: Category; poiType?: PoiType; areaCapable: boolean };

/** OSM etiketlerini bizim kategorilerimize çevirir. */
export function classify(tags: Record<string, string> = {}): Classified {
  const out: Classified = { areaCapable: false };

  if (tags.natural === 'coastline') {
    out.category = 'coast';
  } else if (tags.natural === 'water') {
    out.category = 'coast';
    out.areaCapable = true;
  } else if (tags.leisure === 'park' || tags.landuse === 'forest' || tags.natural === 'wood') {
    out.category = 'green';
    out.areaCapable = true;
  } else if (tags.historic) {
    out.category = 'historic';
  } else if (tags.highway && /^(primary|trunk|motorway)$/.test(tags.highway)) {
    out.category = 'mainRoad';
  }

  if (tags.amenity === 'drinking_water') out.poiType = 'water';
  else if (tags.amenity === 'toilets') out.poiType = 'toilet';
  else if (tags.amenity === 'cafe') out.poiType = 'cafe';
  else if (tags.amenity === 'bench') out.poiType = 'bench';
  else if (
    tags.highway === 'bus_stop' ||
    /^(station|tram_stop|halt)$/.test(tags.railway ?? '') ||
    /^(platform|station)$/.test(tags.public_transport ?? '')
  ) {
    out.poiType = 'transit';
  }
  return out;
}

const M_PER_DEG = 111_195;

function makeBounds(coords: LngLat[]): OsmFeature['bounds'] {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const [lng, lat] of coords) {
    w = Math.min(w, lng);
    e = Math.max(e, lng);
    s = Math.min(s, lat);
    n = Math.max(n, lat);
  }
  const dLat = BUFFER_M / M_PER_DEG;
  const dLng = BUFFER_M / (M_PER_DEG * Math.cos(((s + n) / 2) * (Math.PI / 180)));
  return [w - dLng, s - dLat, e + dLng, n + dLat];
}

function toLngLats(geometry: { lat: number; lon: number }[]): LngLat[] {
  return geometry.map((g) => [g.lon, g.lat]);
}

function isClosed(coords: LngLat[]): boolean {
  if (coords.length < 4) return false;
  const a = coords[0]!;
  const b = coords[coords.length - 1]!;
  return a[0] === b[0] && a[1] === b[1];
}

/** Overpass JSON → OsmFeature[]. Çoklu çokgen ilişkilerinde yalnızca dış (outer) üyeler kullanılır. */
export function parseOverpass(json: OverpassResponse): OsmFeature[] {
  const features: OsmFeature[] = [];

  const push = (
    c: Classified,
    coords: LngLat[],
    name: string | undefined,
    ref: Pick<OsmFeature, 'osmType' | 'osmId' | 'part'>,
  ) => {
    if (coords.length === 0 || (!c.category && !c.poiType)) return;
    features.push({
      ...ref,
      category: c.category,
      poiType: c.poiType,
      name,
      coords,
      area: c.areaCapable && isClosed(coords),
      bounds: makeBounds(coords),
    });
  };

  for (const el of json.elements ?? []) {
    const c = classify(el.tags);
    const name = el.tags?.name;
    if (el.type === 'node' && el.lat !== undefined && el.lon !== undefined) {
      push(c, [[el.lon, el.lat]], name, { osmType: 'node', osmId: el.id, part: 0 });
    } else if (el.type === 'way' && el.geometry) {
      push(c, toLngLats(el.geometry), name, { osmType: 'way', osmId: el.id, part: 0 });
    } else if (el.type === 'relation' && el.members) {
      let part = 0;
      for (const m of el.members) {
        if (m.type === 'way' && m.geometry && (m.role === 'outer' || m.role === undefined)) {
          push(c, toLngLats(m.geometry), name, { osmType: 'relation', osmId: el.id, part: part++ });
        }
      }
    }
  }
  return features;
}

function inBounds(p: LngLat, b: OsmFeature['bounds']): boolean {
  return p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3];
}

/** Nokta, nesneye `BUFFER_M` içinde mi (çokgense içinde de sayılır)? */
export function isNear(p: LngLat, f: OsmFeature, bufferM = BUFFER_M): boolean {
  if (!inBounds(p, f.bounds)) return false;
  if (f.coords.length === 1)
    return distPointToPolylineM(p, [f.coords[0]!, f.coords[0]!]) <= bufferM;
  if (f.area && pointInRing(p, f.coords)) return true;
  return distPointToPolylineM(p, f.coords) <= bufferM;
}

/** Her örnek nokta için çevresindeki kategoriler. */
export function categoriesPerSample(
  samples: readonly Sample[],
  features: readonly OsmFeature[],
): Set<Category>[] {
  const withCategory = features.filter((f) => f.category);
  return samples.map((s) => {
    const hits = new Set<Category>();
    for (const f of withCategory) {
      if (hits.has(f.category!)) continue;
      if (isNear(s.point, f)) hits.add(f.category!);
    }
    return hits;
  });
}

/** Rotaya 50 m içindeki mola noktaları (aynı konum ve türde tekrarlar elenir). */
export function poisNearRoute(
  samples: readonly Sample[],
  features: readonly OsmFeature[],
): RoutePoi[] {
  const result: RoutePoi[] = [];
  const seen = new Set<string>();
  for (const f of features) {
    if (!f.poiType || f.coords.length !== 1) continue;
    const poi = f.coords[0]!;
    // Örnekler 100 m arayla olduğundan, iki örnek arasında kalan POI'lerde mesafe ~15 m fazla ölçülebilir.
    if (!samples.some((s) => isNear(s.point, f))) continue;
    const key = `${f.poiType}:${poi[0].toFixed(5)}:${poi[1].toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ type: f.poiType, coord: poi, ...(f.name ? { name: f.name } : {}) });
  }
  return result;
}

/** Herkese açık Overpass aynaları. Ücretsizdirler ve zaman zaman rastgele HTTP 500/429/504 verirler. */
const ENDPOINTS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
/** Overpass sunucuları User-Agent'sız istekleri reddeder (HTTP 406) ya da hız sınırına takar. */
const USER_AGENT = 'RotaApp/0.1 (+https://github.com/emin-cool/Rota)';
/** Bir ayna hata verince hemen sıradakine geçilir; yavaş kalırsa bu kadar ms sonra sıradaki de paralel başlar. */
const HEDGE_DELAY_MS = 3000;
/** Aynalar arasında en çok 2 tur (toplam 6 deneme). */
const MAX_PASSES = 2;
/** Tüm Overpass aşaması için üst süre sınırı. */
const DEFAULT_OVERALL_TIMEOUT_MS = 10_000;

/**
 * Overpass'tan nesneleri çeker. Aynaları sırayla dener: hata alınca hemen sıradakine geçer, yanıt
 * gecikirse (HEDGE_DELAY_MS) sıradakini paralel başlatır. İlk başarılı yanıt kazanır, kalanlar iptal edilir.
 */
export function fetchOsmFeatures(
  bbox: BBox,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 10_000,
  log?: (message: string) => void,
  opts: OverpassQueryOptions & { overallTimeoutMs?: number } = {},
): Promise<OsmFeature[]> {
  const query = buildOverpassQuery(bbox, opts);
  const order = Array.from({ length: MAX_PASSES }, () => ENDPOINTS).flat();

  return new Promise<OsmFeature[]>((resolve, reject) => {
    const controllers: AbortController[] = [];
    let started = 0;
    let failed = 0;
    let settled = false;
    let hedgeTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(hedgeTimer);
      clearTimeout(overall);
      controllers.forEach((c) => c.abort());
      action();
    };
    const overall = setTimeout(
      () => finish(() => reject(new Error('Overpass zaman aşımı'))),
      opts.overallTimeoutMs ?? DEFAULT_OVERALL_TIMEOUT_MS,
    );

    const startNext = () => {
      if (settled || started >= order.length) return;
      const url = order[started++]!;
      const controller = new AbortController();
      controllers.push(controller);
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const began = Date.now();
      const host = new URL(url).host;

      // Yavaş kalırsa sıradaki ayna da paralel denensin.
      clearTimeout(hedgeTimer);
      hedgeTimer = setTimeout(startNext, HEDGE_DELAY_MS);

      fetchImpl(url, {
        method: 'POST',
        headers: { 'User-Agent': USER_AGENT, Accept: '*/*' },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const text = await res.text();
          const features = parseOverpass(JSON.parse(text) as OverpassResponse);
          if (!settled) {
            log?.(
              `Overpass ${host}: ${features.length} nesne, ${Math.round(text.length / 1024)} KB, ${Date.now() - began} ms`,
            );
          }
          finish(() => resolve(features));
        })
        .catch((e: unknown) => {
          if (settled) return;
          log?.(
            `Overpass ${host} HATA (${Date.now() - began} ms): ${e instanceof Error ? e.message : String(e)}`,
          );
          failed++;
          if (failed >= order.length) finish(() => reject(new Error('Overpass erişilemedi')));
          else startNext();
        })
        .finally(() => clearTimeout(timer));
    };
    startNext();
  });
}

/** Veritabanı satırı (osm_features) ↔ OsmFeature dönüşümleri. */
export type OsmRow = {
  osm_type: 'node' | 'way' | 'relation';
  osm_id: number;
  part: number;
  category: Category | null;
  poi_type: PoiType | null;
  name: string | null;
  area: boolean;
  /** EWKT: SRID=4326;POINT(lng lat) | SRID=4326;LINESTRING(...) */
  geom: string;
};

/** OsmFeature → osm_features satırı. Geometrisi geçersiz olanlar (tek noktalı çizgi vb.) null döner. */
export function featureToRow(f: OsmFeature): OsmRow | null {
  if (!f.osmType || f.osmId === undefined) return null;
  const pair = (c: LngLat) => `${c[0]} ${c[1]}`;
  let geom: string;
  if (f.coords.length === 1) geom = `SRID=4326;POINT(${pair(f.coords[0]!)})`;
  else if (f.coords.length >= 2) geom = `SRID=4326;LINESTRING(${f.coords.map(pair).join(',')})`;
  else return null;
  return {
    osm_type: f.osmType,
    osm_id: f.osmId,
    part: f.part ?? 0,
    category: f.category ?? null,
    poi_type: f.poiType ?? null,
    name: f.name ?? null,
    area: f.area,
    geom,
  };
}

/** `osm_features_in_bbox` SQL fonksiyonunun döndürdüğü kayıt. */
export type OsmDbFeature = {
  c: Category | null;
  p: PoiType | null;
  n: string | null;
  a: boolean;
  /** Nokta için [lng, lat]; çizgi için [[lng, lat], …] (GeoJSON koordinatları). */
  g: number[] | number[][];
};

export function featureFromDb(row: OsmDbFeature): OsmFeature {
  const coords = (typeof row.g[0] === 'number' ? [row.g] : row.g) as LngLat[];
  return {
    category: row.c ?? undefined,
    poiType: row.p ?? undefined,
    name: row.n ?? undefined,
    coords,
    area: row.a,
    bounds: makeBounds(coords),
  };
}
