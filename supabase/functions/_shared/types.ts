/**
 * Rota üretim servisinin ortak tipleri (docs/03-teknik-mimari.md "Girdi/Çıktı şeması").
 * Saf TypeScript: hem Edge Function (Deno) hem Jest hem de uygulama (src/types/routes.ts) kullanır.
 */

export type ActivityType = 'walk' | 'run' | 'bike';
export type RouteType = 'loop' | 'a_b' | 'out_back';
export type Scenery = 'coast' | 'green' | 'historic' | 'any';
export type Slope = 'flat' | 'some' | 'hilly';
export type SurfacePref = 'paved' | 'unpaved' | 'any';

/** [boylam, enlem] */
export type LngLat = [lng: number, lat: number];
/** [boylam, enlem, rakım(m)] */
export type Coord3 = [lng: number, lat: number, z: number];

export type Extras = {
  avoidTraffic?: boolean;
  litStreets?: boolean;
  amenities?: boolean;
  transitEnd?: boolean;
  dog?: boolean;
  stroller?: boolean;
  surface?: SurfacePref;
  bikeLanes?: boolean;
};

/** İstemcinin gönderdiği girdi (scenery/slope/extras opsiyonel; sunucu varsayılan uygular). */
export type GenerateRoutesInput = {
  activityType: ActivityType;
  routeType: RouteType;
  start: LngLat;
  end?: LngLat;
  durationMin?: number;
  distanceM?: number;
  /** Koşu için sn/km. */
  paceSecPerKm?: number;
  scenery?: Scenery[];
  slope?: Slope;
  extras?: Extras;
  /** Tanı çıktısı iste (geliştirme). */
  debug?: boolean;
};

export type PoiType = 'water' | 'toilet' | 'cafe' | 'pharmacy' | 'market' | 'hospital' | 'transit';

export type RoutePoi = { type: PoiType; coord: LngLat; name?: string };

export type RouteLabel = 'En manzaralı' | 'En düz' | 'En kısa' | string;

export type RouteOption = {
  label: RouteLabel;
  geojson: { type: 'LineString'; coordinates: LngLat[] };
  distanceM: number;
  estDurationMin: number;
  elevationGainM: number;
  /** d: başlangıçtan metre, z: rakım (m) */
  elevationProfile: { d: number; z: number }[];
  /** 0–100 */
  scenicScore: number;
  pois: RoutePoi[];
};

export type GenerateRoutesResponse = {
  routes: RouteOption[];
  cached: boolean;
  /** Örn. 'scenery_unavailable': manzara verisi alınamadı, skor nötr. */
  warnings?: string[];
  /** Yalnızca istekte `debug: true` ise: aşama aşama tanı satırları. */
  debug?: string[];
};

export type ErrorCode =
  | 'unauthorized'
  | 'invalid_input'
  | 'rate_limited'
  | 'start_not_routable'
  | 'upstream_busy'
  | 'upstream_unavailable'
  | 'no_routes'
  | 'internal';

export type ErrorBody = { error: { code: ErrorCode; message: string } };
