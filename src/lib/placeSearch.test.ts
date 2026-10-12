import {
  buildRetrieveUrl,
  buildSuggestUrl,
  parseRetrieve,
  parseSuggestions,
  placeIcon,
} from './placeSearch';

describe('buildSuggestUrl', () => {
  const url = new URL(
    buildSuggestUrl({
      query: '  Beşiktaş Çarşı ',
      sessionToken: 'sess-1',
      accessToken: 'pk.test',
      proximity: [29.05, 41.1],
    }),
  );

  it('uç nokta ve zorunlu parametreler', () => {
    expect(url.origin + url.pathname).toBe('https://api.mapbox.com/search/searchbox/v1/suggest');
    expect(url.searchParams.get('q')).toBe('Beşiktaş Çarşı'); // kırpılmış, Türkçe karakter korunur
    expect(url.searchParams.get('access_token')).toBe('pk.test');
    expect(url.searchParams.get('session_token')).toBe('sess-1');
    expect(url.searchParams.get('language')).toBe('tr');
    expect(url.searchParams.get('country')).toBe('tr');
    expect(url.searchParams.get('limit')).toBe('6');
  });
  it('mekan, adres ve sokak türlerini ister; konuma yakınlık "lng,lat"', () => {
    const types = (url.searchParams.get('types') ?? '').split(',');
    expect(types).toEqual(expect.arrayContaining(['poi', 'address', 'street', 'neighborhood']));
    expect(url.searchParams.get('proximity')).toBe('29.05,41.1');
  });
  it('konum yoksa proximity gönderilmez', () => {
    const u = new URL(buildSuggestUrl({ query: 'x', sessionToken: 's', accessToken: 't' }));
    expect(u.searchParams.has('proximity')).toBe(false);
  });
});

describe('buildRetrieveUrl', () => {
  it('kimliği kaçışlar ve oturum belirtecini ekler', () => {
    const u = new URL(
      buildRetrieveUrl({ id: 'dXJu:abc/def', sessionToken: 's', accessToken: 't' }),
    );
    expect(u.pathname).toBe('/search/searchbox/v1/retrieve/dXJu%3Aabc%2Fdef');
    expect(u.searchParams.get('session_token')).toBe('s');
  });
});

describe('parseSuggestions', () => {
  it('önerileri sadeleştirir, kimliksiz/adsız kayıtları atar', () => {
    const out = parseSuggestions({
      suggestions: [
        {
          mapbox_id: 'a1',
          name: 'Starbucks',
          feature_type: 'poi',
          maki: 'cafe',
          place_formatted: 'Emirgan, Sarıyer, İstanbul',
        },
        {
          mapbox_id: 'a2',
          name: 'Emirgan Caddesi',
          name_preferred: 'Emirgan Cd.',
          feature_type: 'street',
        },
        { name: 'Kimliksiz' },
        { mapbox_id: 'a3' },
      ],
    });
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      id: 'a1',
      name: 'Starbucks',
      subtitle: 'Emirgan, Sarıyer, İstanbul',
      featureType: 'poi',
      maki: 'cafe',
    });
    expect(out[1]!.name).toBe('Emirgan Cd.');
    expect(parseSuggestions({})).toEqual([]);
  });
});

describe('parseRetrieve', () => {
  it('geometriden, yoksa özelliklerden koordinat alır', () => {
    expect(
      parseRetrieve({
        features: [
          {
            geometry: { coordinates: [29.05, 41.1] },
            properties: { name: 'Emirgan Korusu', place_formatted: 'Sarıyer, İstanbul' },
          },
        ],
      }),
    ).toEqual({ name: 'Emirgan Korusu', point: [29.05, 41.1], subtitle: 'Sarıyer, İstanbul' });
    expect(
      parseRetrieve({
        features: [{ properties: { name: 'X', coordinates: { longitude: 1, latitude: 2 } } }],
      })!.point,
    ).toEqual([1, 2]);
  });
  it('koordinat ya da ad yoksa null', () => {
    expect(parseRetrieve({})).toBeNull();
    expect(parseRetrieve({ features: [{ properties: { name: 'X' } }] })).toBeNull();
    expect(parseRetrieve({ features: [{ geometry: { coordinates: [1, 2] } }] })).toBeNull();
  });
});

describe('placeIcon', () => {
  it('tür ve kategoriye göre ikon', () => {
    expect(placeIcon('address', null)).toBe('home');
    expect(placeIcon('street', null)).toBe('route');
    expect(placeIcon('neighborhood', null)).toBe('location-city');
    expect(placeIcon('poi', 'cafe')).toBe('local-cafe');
    expect(placeIcon('poi', 'bilinmeyen')).toBe('place');
    expect(placeIcon('poi', null)).toBe('place');
  });
});
