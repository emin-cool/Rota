import type { LngLat } from '@/lib/geo';

type ReverseResponse = {
  features?: {
    properties?: {
      name?: string;
      name_preferred?: string;
      place_formatted?: string;
      context?: {
        neighborhood?: { name?: string };
        locality?: { name?: string };
        district?: { name?: string };
      };
    };
  }[];
};

/** Mapbox Geocoding v6 ters sorgu yanıtından kısa, okunur bir yer adı çıkarır ("Emirgan"). */
export function parseReverseGeocode(json: ReverseResponse): string | null {
  const props = json.features?.[0]?.properties;
  if (!props) return null;
  const ctx = props.context;
  return (
    ctx?.neighborhood?.name ??
    ctx?.locality?.name ??
    props.name_preferred ??
    props.name ??
    ctx?.district?.name ??
    null
  );
}

/** Koordinatın yer adını döndürür. Hata ya da anahtar yoksa null (arayüz yedek metin gösterir). */
export async function reverseGeocode(point: LngLat, signal?: AbortSignal): Promise<string | null> {
  const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  try {
    const url =
      `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${point[0]}&latitude=${point[1]}` +
      `&language=tr&limit=1&access_token=${token}`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    return parseReverseGeocode((await res.json()) as ReverseResponse);
  } catch {
    return null;
  }
}
