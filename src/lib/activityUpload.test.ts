import {
  parsePhotos,
  parseReview,
  processUploadQueue,
  saveReview,
  uploadSession,
} from './activityUpload';
import type { SessionRow } from './trackingDb';

// --- Sahte Supabase istemcisi: çağrıları kaydeder, sonuçlar testten ayarlanır ---------------------
const mockCalls: string[] = [];
const mockResults: Record<string, { error: { code?: string; message?: string } | null }> = {};
const mockUpdateArgs: unknown[] = [];
const mockFailActivityIds = new Set<string>();
const mockRpc = jest.fn(
  async (..._args: unknown[]): Promise<{ error: { message: string } | null }> => ({
    error: null,
  }),
);

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (table: string) => ({
      insert: async (row: unknown) => {
        mockCalls.push(`${table}.insert`);
        mockUpdateArgs.push(row);
        if (table === 'activities' && mockFailActivityIds.has((row as { id: string }).id)) {
          return { error: { code: '08006', message: 'ağ' } };
        }
        return mockResults[`${table}.insert`] ?? { error: null };
      },
      update: (patch: unknown) => {
        mockCalls.push(`${table}.update`);
        mockUpdateArgs.push(patch);
        return {
          eq: () => ({
            eq: async () => mockResults[`${table}.update`] ?? { error: null },
          }),
        };
      },
    }),
    storage: {
      from: () => ({
        upload: async () => {
          mockCalls.push('storage.upload');
          return mockResults['storage.upload'] ?? { error: null };
        },
        getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/p.jpg' } }),
      }),
    },
  },
}));

const mockUpdateSession = jest.fn(async (..._args: unknown[]) => undefined);
const mockListQueued = jest.fn(async (): Promise<SessionRow[]> => []);
jest.mock('@/lib/trackingDb', () => ({
  loadPoints: async () => [],
  updateSession: (...args: unknown[]) => mockUpdateSession(...args),
  listQueuedUploads: () => mockListQueued(),
}));

const row = (over: Partial<SessionRow> = {}): SessionRow => ({
  id: 'sess-1',
  status: 'finished',
  activity_type: 'walk',
  started_at: 1_700_000_000_000,
  ended_at: 1_700_000_600_000,
  paused_ms: 0,
  pause_started_at: null,
  segment: 0,
  route_json: null,
  route_title: null,
  uploaded: 0,
  route_id: 'route-1',
  title: 'Sabah yürüyüşü',
  visibility: 'followers',
  queued: 1,
  review_json: null,
  photos_json: null,
  description: null,
  share_route: 0,
  course_day_id: null,
  workout_json: null,
  ...over,
});

beforeEach(() => {
  mockCalls.length = 0;
  mockUpdateArgs.length = 0;
  mockFailActivityIds.clear();
  for (const k of Object.keys(mockResults)) delete mockResults[k];
  mockUpdateSession.mockClear();
  mockRpc.mockClear();
  mockRpc.mockResolvedValue({ error: null });
  mockListQueued.mockReset();
  mockListQueued.mockResolvedValue([]);
  globalThis.fetch = jest.fn(async () => ({
    arrayBuffer: async () => new ArrayBuffer(4),
  })) as unknown as typeof fetch;
});

describe('parseReview / parsePhotos', () => {
  it('geçerli yorumu okur, geçersizi (puan aralığı, bozuk JSON, null) reddeder', () => {
    expect(parseReview(JSON.stringify({ rating: 4, tags: [], comment: 'x' }))).toEqual({
      rating: 4,
      tags: [],
      comment: 'x',
    });
    expect(parseReview(JSON.stringify({ rating: 0, tags: [], comment: '' }))).toBeNull();
    expect(parseReview(JSON.stringify({ rating: 6, tags: [], comment: '' }))).toBeNull();
    expect(parseReview('{bozuk')).toBeNull();
    expect(parseReview(null)).toBeNull();
  });
  it("bozuk fotoğraf JSON'unda boş liste döner", () => {
    expect(parsePhotos('{bozuk')).toEqual([]);
    expect(parsePhotos(null)).toEqual([]);
    expect(parsePhotos(JSON.stringify([{ uri: 'file://a.jpg', done: false }]))).toHaveLength(1);
  });
});

describe('saveReview', () => {
  it('yeni yorum: yalnızca insert çalışır; boş yorum null olur', async () => {
    await saveReview('u1', 'r1', { rating: 5, tags: ['a'], comment: '   ' });
    expect(mockCalls).toEqual(['route_reviews.insert']);
    expect(mockUpdateArgs[0]).toMatchObject({
      route_id: 'r1',
      user_id: 'u1',
      rating: 5,
      comment: null,
    });
  });
  it('zaten yorum varsa (23505) güncellemeye düşer', async () => {
    mockResults['route_reviews.insert'] = { error: { code: '23505' } };
    await saveReview('u1', 'r1', { rating: 3, tags: [], comment: ' iyi ' });
    expect(mockCalls).toEqual(['route_reviews.insert', 'route_reviews.update']);
    expect(mockUpdateArgs[1]).toEqual({ rating: 3, comment: 'iyi', tags: [] });
  });
  it('başka hata fırlatılır', async () => {
    mockResults['route_reviews.insert'] = { error: { code: '42501', message: 'rls' } };
    await expect(saveReview('u1', 'r1', { rating: 3, tags: [], comment: '' })).rejects.toBeTruthy();
    expect(mockCalls).toEqual(['route_reviews.insert']);
  });
});

describe('uploadSession', () => {
  it('sırayla: aktivite → fotoğraf → yorum, sonunda yüklendi işaretlenir', async () => {
    await uploadSession(
      row({
        photos_json: JSON.stringify([{ uri: 'file://1.jpg', done: false }]),
        review_json: JSON.stringify({ rating: 5, tags: [], comment: '' }),
      }),
      'u1',
    );
    expect(mockCalls).toEqual([
      'activities.insert',
      'storage.upload',
      'route_photos.insert',
      'route_reviews.insert',
    ]);
    expect(mockUpdateSession).toHaveBeenLastCalledWith('sess-1', { uploaded: 1, queued: 0 });
  });

  it('kurs antrenmanından geldiyse aktiviteye bağlanır ve gün tamamlanır', async () => {
    await uploadSession(row({ course_day_id: 'day-1' }), 'u1');
    expect(mockUpdateArgs[0]).toMatchObject({ id: 'sess-1', course_day_id: 'day-1' });
    expect(mockRpc).toHaveBeenCalledWith('complete_course_day', { p_activity_id: 'sess-1' });
    expect(mockUpdateSession).toHaveBeenLastCalledWith('sess-1', { uploaded: 1, queued: 0 });
  });

  it('kurs günü işaretlenemezse kayıt yüklendi sayılmaz (kuyrukta kalır)', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'ağ' } });
    await expect(uploadSession(row({ course_day_id: 'day-1' }), 'u1')).rejects.toBeDefined();
    expect(mockUpdateSession).not.toHaveBeenCalledWith('sess-1', { uploaded: 1, queued: 0 });
  });

  it('kurs antrenmanı olmayan kayıtta RPC çağrılmaz', async () => {
    await uploadSession(row(), 'u1');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("aktivite id'si yerel oturum kimliğidir (yeniden denemede çift kayıt olmasın)", async () => {
    await uploadSession(row(), 'u1');
    expect(mockUpdateArgs[0]).toMatchObject({ id: 'sess-1', user_id: 'u1', route_id: 'route-1' });
  });

  it('aktivite zaten yüklüyse (23505) hata sayılmaz, devam eder', async () => {
    mockResults['activities.insert'] = { error: { code: '23505' } };
    await uploadSession(row(), 'u1');
    expect(mockUpdateSession).toHaveBeenLastCalledWith('sess-1', { uploaded: 1, queued: 0 });
  });

  it('aktivite eklenemezse hata fırlatır ve yüklendi işaretlenmez', async () => {
    mockResults['activities.insert'] = { error: { code: '08006', message: 'ağ' } };
    await expect(uploadSession(row(), 'u1')).rejects.toBeTruthy();
    expect(mockUpdateSession).not.toHaveBeenCalledWith('sess-1', { uploaded: 1, queued: 0 });
  });

  it('aktivite notu (description) yüklenir; boşsa null gider', async () => {
    await uploadSession(row({ description: '  güzel bir sabah  ' }), 'u1');
    expect(mockUpdateArgs[0]).toMatchObject({ description: 'güzel bir sabah' });
    mockUpdateArgs.length = 0;
    await uploadSession(row({ description: '   ' }), 'u1');
    expect(mockUpdateArgs[0]).toMatchObject({ description: null });
  });

  it('"rotayı paylaş" seçiliyse aktiviteden sonra rota herkese açılır', async () => {
    await uploadSession(row({ share_route: 1 }), 'u1');
    expect(mockCalls).toEqual(['activities.insert', 'routes.update']);
    expect(mockUpdateArgs[1]).toEqual({ is_public: true });
  });

  it('seçili değilse ya da rotasız aktivitede rota açılmaz', async () => {
    await uploadSession(row({ share_route: 0 }), 'u1');
    await uploadSession(row({ share_route: 1, route_id: null }), 'u1');
    expect(mockCalls).not.toContain('routes.update');
  });

  it('fotoğraf satırı aktiviteye bağlanır (activity_id)', async () => {
    await uploadSession(
      row({ photos_json: JSON.stringify([{ uri: 'file://1.jpg', done: false }]) }),
      'u1',
    );
    expect(mockUpdateArgs).toContainEqual(
      expect.objectContaining({ route_id: 'route-1', activity_id: 'sess-1' }),
    );
  });

  it('rotasız aktivitede fotoğraf ve yorum atlanır', async () => {
    await uploadSession(
      row({
        route_id: null,
        photos_json: JSON.stringify([{ uri: 'file://1.jpg', done: false }]),
        review_json: JSON.stringify({ rating: 5, tags: [], comment: '' }),
      }),
      'u1',
    );
    expect(mockCalls).toEqual(['activities.insert']);
  });

  it('yerel fotoğraf dosyası silinmişse o fotoğraf atlanır, kuyruk tıkanmaz', async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new Error('dosya yok');
    }) as unknown as typeof fetch;
    await uploadSession(
      row({ photos_json: JSON.stringify([{ uri: 'file://yok.jpg', done: false }]) }),
      'u1',
    );
    expect(mockCalls).toEqual(['activities.insert']);
    expect(mockUpdateSession).toHaveBeenLastCalledWith('sess-1', { uploaded: 1, queued: 0 });
  });

  it('daha önce yüklenmiş fotoğraflar tekrar yüklenmez', async () => {
    await uploadSession(
      row({ photos_json: JSON.stringify([{ uri: 'file://1.jpg', done: true }]) }),
      'u1',
    );
    expect(mockCalls).toEqual(['activities.insert']);
  });
});

describe('processUploadQueue', () => {
  it('kuyruktakileri yükler ve sayısını döner', async () => {
    mockListQueued.mockResolvedValue([row({ id: 'a' }), row({ id: 'b' })]);
    expect(await processUploadQueue('u1')).toBe(2);
    expect(mockUpdateSession).toHaveBeenCalledWith('a', { uploaded: 1, queued: 0 });
    expect(mockUpdateSession).toHaveBeenCalledWith('b', { uploaded: 1, queued: 0 });
  });

  it('biri başarısız olsa da sıradakine geçer; başarısız olan kuyrukta kalır', async () => {
    mockListQueued.mockResolvedValue([row({ id: 'bozuk' }), row({ id: 'iyi' })]);
    mockFailActivityIds.add('bozuk');
    expect(await processUploadQueue('u1')).toBe(1);
    expect(mockUpdateSession).toHaveBeenCalledWith('iyi', { uploaded: 1, queued: 0 });
    expect(mockUpdateSession).not.toHaveBeenCalledWith('bozuk', { uploaded: 1, queued: 0 });
  });

  it('eşzamanlı ikinci çağrı hiçbir şey yapmaz (tek çalışma)', async () => {
    mockListQueued.mockResolvedValue([row({ id: 'a' })]);
    const first = processUploadQueue('u1');
    const second = await processUploadQueue('u1');
    expect(second).toBe(0);
    expect(await first).toBe(1);
  });
});
