import type { MaterialIcons } from '@expo/vector-icons';

import type { LngLat } from '@/lib/geo';

type IconName = keyof typeof MaterialIcons.glyphMap;

/** Mapbox Search Box API (öneri + koordinat alma). Public token istemcide kullanılabilir. */
const BASE = 'https://api.mapbox.com/search/searchbox/v1';
const TYPES = 'poi,address,street,neighborhood,locality,place,district';

export type PlaceSuggestion = {
  /** Koordinat almak için kullanılan Mapbox kimliği. */
  id: string;
  name: string;
  /** "Emirgan, Sarıyer, İstanbul" gibi ikinci satır. */
  subtitle: string | null;
  featureType: string;
  maki: string | null;
};

export type PlaceDetails = {
  name: string;
  point: LngLat;
  subtitle: string | null;
};

type SuggestResponse = {
  suggestions?: {
    mapbox_id?: string;
    name?: string;
    name_preferred?: string;
    feature_type?: string;
    maki?: string;
    full_address?: string;
    address?: string;
    place_formatted?: string;
  }[];
};

type RetrieveResponse = {
  features?: {
    geometry?: { coordinates?: number[] };
    properties?: {
      name?: string;
      name_preferred?: string;
      place_formatted?: string;
      full_address?: string;
      coordinates?: { longitude?: number; latitude?: number };
    };
  }[];
};

export function buildSuggestUrl(params: {
  query: string;
  sessionToken: string;
  accessToken: string;
  proximity?: LngLat | null;
  limit?: number;
}): string {
  const q = new URLSearchParams({
    q: params.query.trim(),
    access_token: params.accessToken,
    session_token: params.sessionToken,
    language: 'tr',
    country: 'tr',
    types: TYPES,
    limit: String(params.limit ?? 6),
  });
  // Sonuçlar bu noktaya yakınlığa göre sıralanır: "lng,lat".
  if (params.proximity) q.set('proximity', `${params.proximity[0]},${params.proximity[1]}`);
  return `${BASE}/suggest?${q.toString()}`;
}

export function buildRetrieveUrl(params: {
  id: string;
  sessionToken: string;
  accessToken: string;
}): string {
  const q = new URLSearchParams({
    access_token: params.accessToken,
    session_token: params.sessionToken,
    language: 'tr',
  });
  return `${BASE}/retrieve/${encodeURIComponent(params.id)}?${q.toString()}`;
}

export function parseSuggestions(json: SuggestResponse): PlaceSuggestion[] {
  const out: PlaceSuggestion[] = [];
  for (const s of json.suggestions ?? []) {
    const name = s.name_preferred ?? s.name;
    if (!s.mapbox_id || !name) continue;
    out.push({
      id: s.mapbox_id,
      name,
      // Mekanlarda "yer, ilçe" satırı; adreslerde tam adres.
      subtitle: s.place_formatted ?? s.full_address ?? s.address ?? null,
      featureType: s.feature_type ?? 'poi',
      maki: s.maki ?? null,
    });
  }
  return out;
}

export function parseRetrieve(json: RetrieveResponse): PlaceDetails | null {
  const f = json.features?.[0];
  if (!f) return null;
  const c = f.geometry?.coordinates;
  const lng = c?.[0] ?? f.properties?.coordinates?.longitude;
  const lat = c?.[1] ?? f.properties?.coordinates?.latitude;
  const name = f.properties?.name_preferred ?? f.properties?.name;
  if (lng === undefined || lat === undefined || !name) return null;
  return {
    name,
    point: [lng, lat],
    subtitle: f.properties?.place_formatted ?? f.properties?.full_address ?? null,
  };
}

const MAKI_ICON: Record<string, IconName> = {
  cafe: 'local-cafe',
  restaurant: 'restaurant',
  bar: 'local-bar',
  park: 'park',
  garden: 'park',
  bus: 'directions-bus',
  rail: 'train',
  'rail-metro': 'subway',
  ferry: 'directions-boat',
  shop: 'storefront',
  grocery: 'shopping-cart',
  'clothing-store': 'storefront',
  hospital: 'local-hospital',
  school: 'school',
  museum: 'museum',
  monument: 'account-balance',
  lodging: 'hotel',
  fuel: 'local-gas-station',
  pharmacy: 'local-pharmacy',
};

/** Öneri satırındaki ikon: türüne (adres, sokak, semt…) ya da mekan kategorisine göre. */
export function placeIcon(featureType: string, maki: string | null): IconName {
  if (featureType === 'address') return 'home';
  if (featureType === 'street') return 'route';
  if (['neighborhood', 'locality', 'place', 'district'].includes(featureType))
    return 'location-city';
  return (maki && MAKI_ICON[maki]) || 'place';
}

export class PlaceSearchError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`Yer araması hatası: HTTP ${status}`);
    this.name = 'PlaceSearchError';
    this.status = status;
  }
}

export async function suggestPlaces(
  params: Parameters<typeof buildSuggestUrl>[0],
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const res = await fetch(buildSuggestUrl(params), { signal });
  if (!res.ok) throw new PlaceSearchError(res.status);
  return parseSuggestions((await res.json()) as SuggestResponse);
}

export async function retrievePlace(
  params: Parameters<typeof buildRetrieveUrl>[0],
  signal?: AbortSignal,
): Promise<PlaceDetails | null> {
  const res = await fetch(buildRetrieveUrl(params), { signal });
  if (!res.ok) throw new PlaceSearchError(res.status);
  return parseRetrieve((await res.json()) as RetrieveResponse);
}
