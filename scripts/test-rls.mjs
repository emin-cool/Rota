// Supabase RLS / yetki testi: bir kullanıcının başka bir kullanıcının verisini okuyup yazamadığını doğrular.
//
// Kullanım (Windows PowerShell, proje klasöründe):   node scripts/test-rls.mjs
//
// .env içinde: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (gizli; yazdırılmaz).
// Script iki GEÇİCİ kullanıcı (rls-a-…@example.com, rls-b-…@example.com) oluşturur, testleri bu iki hesapla
// yapar ve işi bitince (hata olsa bile) kullanıcıları, rotaları, dosyaları siler. Gerçek kullanıcı verisine dokunmaz.
// Hata varsa çıkış kodu 1 olur.
import { readFileSync } from 'node:fs';

import { createClient } from '@supabase/supabase-js';

const env = {};
for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const URL = env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SERVICE) {
  console.error('✗ .env içinde EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY ve SUPABASE_SERVICE_ROLE_KEY gerekli.');
  process.exit(1);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL, SERVICE, opts);
const anon = createClient(URL, ANON, opts);

let passed = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}
/** Yazma/okuma engellendi mi: hata döndü ya da hiç satır etkilenmedi/dönmedi. */
const blocked = (res) => !!res.error || !res.data || (Array.isArray(res.data) && res.data.length === 0);
const section = (t) => console.log(`\n${t}`);
const rand = () => Math.random().toString(36).slice(2, 10);
const LINE = 'SRID=4326;LINESTRING(29.0 41.0,29.01 41.01)';
const POINT = 'SRID=4326;POINT(29.0 41.0)';

const created = { users: [], routes: [], files: [] };

async function makeUser(tag) {
  const email = `rls-${tag}-${rand()}@example.com`;
  const password = `Tmp-${rand()}${rand()}Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`kullanıcı oluşturulamadı: ${error.message}`);
  created.users.push(data.user.id);
  const client = createClient(URL, ANON, opts);
  const si = await client.auth.signInWithPassword({ email, password });
  if (si.error) throw new Error(`giriş yapılamadı: ${si.error.message}`);
  return { id: data.user.id, client };
}

async function main() {
  const A = await makeUser('a');
  const B = await makeUser('b');
  const bytes = new Uint8Array([255, 216, 255, 217]);

  // A'nın verileri
  const route = await A.client
    .from('routes')
    .insert({
      creator_id: A.id,
      title: 'RLS test özel rota',
      activity_type: 'walk',
      route_type: 'a_b',
      geom: LINE,
      start_point: POINT,
      distance_m: 1500,
      is_public: false,
    })
    .select('id')
    .single();
  if (route.error) throw new Error(`test rotası eklenemedi: ${JSON.stringify(route.error)}`);
  const privateRouteId = route.data.id;
  created.routes.push(privateRouteId);

  const mkAct = (visibility, routeId = null) =>
    A.client
      .from('activities')
      .insert({
        user_id: A.id,
        activity_type: 'walk',
        started_at: new Date().toISOString(),
        duration_sec: 600,
        distance_m: 1000,
        visibility,
        route_id: routeId,
      })
      .select('id')
      .single();
  const actPrivate = (await mkAct('private')).data;
  const actFollowers = (await mkAct('followers')).data;
  const actPublic = (await mkAct('public')).data;

  await A.client.from('saved_routes').insert({ user_id: A.id, route_id: privateRouteId });
  const setZone = await A.client.rpc('set_privacy_zone', { p_lng: 29.0, p_lat: 41.0, p_radius_m: 300 });
  if (setZone.error) throw new Error(`set_privacy_zone: ${JSON.stringify(setZone.error)}`);
  await A.client.storage.from('route-photos').upload(`${A.id}/a.jpg`, bytes, { contentType: 'image/jpeg' });
  await A.client.storage.from('avatars').upload(`${A.id}/avatar.jpg`, bytes, { contentType: 'image/jpeg' });
  created.files.push(['route-photos', `${A.id}/a.jpg`], ['avatars', `${A.id}/avatar.jpg`]);
  // A'nın bir halka açık rota için yorumu (aktivite şartı için önce o rotada aktivite)
  const pub = await admin.from('routes').select('id').eq('is_public', true).limit(1).maybeSingle();
  let reviewId = null;
  if (pub.data) {
    await mkAct('private', pub.data.id);
    const rv = await A.client
      .from('route_reviews')
      .insert({ route_id: pub.data.id, user_id: A.id, rating: 4, tags: [], comment: null })
      .select('id')
      .single();
    reviewId = rv.data?.id ?? null;
  }

  section('activities');
  const seen = await B.client.from('activities').select('id').eq('user_id', A.id);
  const seenIds = (seen.data ?? []).map((r) => r.id);
  check('B, A\'nın "private" aktivitesini göremiyor', !seenIds.includes(actPrivate.id));
  check('B, A\'nın "followers" aktivitesini göremiyor (follows tablosu gelene kadar)', !seenIds.includes(actFollowers.id));
  check('B, A\'nın "public" aktivitesini görebiliyor', seenIds.includes(actPublic.id));
  check('B, A\'nın aktivitesini güncelleyemiyor', blocked(await B.client.from('activities').update({ title: 'hack' }).eq('id', actPublic.id).select('id')));
  check('B, A\'nın aktivitesini silemiyor', blocked(await B.client.from('activities').delete().eq('id', actPublic.id).select('id')));
  const spoof = await B.client.from('activities').insert({ user_id: A.id, activity_type: 'walk', started_at: new Date().toISOString(), duration_sec: 1, distance_m: 1 });
  check('B, A adına aktivite ekleyemiyor', !!spoof.error);
  check('Giriş yapmamış kullanıcı aktivite okuyamıyor', blocked(await anon.from('activities').select('id').limit(1)));
  const own = await A.client.from('activities').select('id').eq('user_id', A.id);
  check('A kendi 3+ aktivitesini görüyor', (own.data ?? []).length >= 3);

  section('profiles / gizlilik bölgesi');
  const pz = await B.client.from('profiles').select('privacy_zone').eq('user_id', A.id);
  check('B, A\'nın privacy_zone kolonunu okuyamıyor (kolon izni yok)', !!pz.error);
  check('B, A\'nın profilini güncelleyemiyor', blocked(await B.client.from('profiles').update({ display_name: 'hack' }).eq('user_id', A.id).select('id')));
  const info = await B.client.rpc('my_privacy_zone_info');
  check('B\'nin my_privacy_zone_info sonucu A\'nın bölgesini içermiyor', !info.error && (info.data ?? []).length === 0);
  const zoneA = await A.client.rpc('my_privacy_zone_info');
  check('A kendi bölgesini okuyabiliyor', (zoneA.data ?? []).length === 1, JSON.stringify(zoneA));
  await B.client.rpc('clear_privacy_zone');
  const zoneA2 = await A.client.rpc('my_privacy_zone_info');
  check('B\'nin clear_privacy_zone çağrısı A\'nın bölgesini silmiyor', (zoneA2.data ?? []).length === 1);

  section('routes');
  check('B, A\'nın özel rotasını göremiyor', blocked(await B.client.from('routes').select('id').eq('id', privateRouteId)));
  check('B, A\'nın özel rotasını güncelleyemiyor', blocked(await B.client.from('routes').update({ title: 'hack' }).eq('id', privateRouteId).select('id')));
  check('B, A\'nın özel rotasını silemiyor', blocked(await B.client.from('routes').delete().eq('id', privateRouteId).select('id')));
  const det = await B.client.rpc('route_detail', { p_id: privateRouteId });
  check('route_detail: B, A\'nın özel rotasını alamıyor', !det.error && (det.data ?? []).length === 0);
  const pois = await B.client.rpc('route_pois', { p_id: privateRouteId });
  check('route_pois (security definer): B, A\'nın özel rotası için veri alamıyor', !pois.error && (pois.data ?? []).length === 0);
  const mine = await B.client.rpc('explore_routes', { p_scope: 'mine' });
  check('explore_routes(mine): B\'nin listesinde A\'nın rotası yok', !(mine.data ?? []).some((r) => r.id === privateRouteId));
  const pubList = await B.client.rpc('explore_routes', {});
  check('explore_routes(public): özel rota listelenmiyor', !(pubList.data ?? []).some((r) => r.id === privateRouteId));
  const forged = await A.client.from('routes').update({ avg_rating: 5, completion_count: 999, is_featured: true }).eq('id', privateRouteId).select('id');
  check('A, kendi rotasının puan/sayaç/is_featured alanlarını değiştiremiyor', !!forged.error);
  const forgedIns = await A.client.from('routes').insert({ creator_id: A.id, title: 'sahte', activity_type: 'walk', route_type: 'a_b', geom: LINE, start_point: POINT, distance_m: 100, is_featured: true, avg_rating: 5 }).select('id');
  if (forgedIns.data?.[0]) created.routes.push(forgedIns.data[0].id);
  check('A, rota eklerken is_featured/avg_rating veremiyor', !!forgedIns.error);

  section('route_reviews');
  if (pub.data) {
    const noAct = await B.client.from('route_reviews').insert({ route_id: pub.data.id, user_id: B.id, rating: 5, tags: [] });
    check('Aktivitesi olmayan B yorum yazamıyor', !!noAct.error);
    if (reviewId) {
      check('B, A\'nın yorumunu güncelleyemiyor', blocked(await B.client.from('route_reviews').update({ rating: 1 }).eq('id', reviewId).select('id')));
      check('B, A\'nın yorumunu silemiyor', blocked(await B.client.from('route_reviews').delete().eq('id', reviewId).select('id')));
      const ver = await A.client.from('route_reviews').update({ is_verified: false }).eq('id', reviewId).select('id');
      check('A, yorumunun is_verified alanını değiştiremiyor', !!ver.error);
    }
  } else {
    console.log('  – atlandı: halka açık rota yok');
  }
  const priv = await B.client.from('route_reviews').select('id').eq('route_id', privateRouteId);
  check('B, A\'nın özel rotasının yorumlarını göremiyor', blocked(priv));

  section('route_photos / saved_routes');
  const ph = await B.client.from('route_photos').insert({ route_id: privateRouteId, user_id: B.id, url: 'http://x/1' });
  check('B, görünmeyen rotaya fotoğraf ekleyemiyor', !!ph.error);
  const phSpoof = await B.client.from('route_photos').insert({ route_id: pub.data?.id ?? privateRouteId, user_id: A.id, url: 'http://x/2' });
  check('B, A adına fotoğraf ekleyemiyor', !!phSpoof.error);
  const sv = await B.client.from('saved_routes').select('id').eq('user_id', A.id);
  check('B, A\'nın kayıtlı rotalarını okuyamıyor', blocked(sv));
  const svList = await B.client.rpc('explore_routes', { p_scope: 'saved' });
  check('explore_routes(saved): B\'nin listesi A\'nın kayıtlarını içermiyor', !(svList.data ?? []).some((r) => r.id === privateRouteId));
  const stats = await B.client.rpc('my_stats');
  check('my_stats: B yalnızca kendi (0) aktivitesini görüyor', (stats.data?.[0]?.activity_count ?? -1) === 0);

  section('storage');
  for (const [bucket, name] of [['route-photos', 'a.jpg'], ['avatars', 'avatar.jpg']]) {
    const up = await B.client.storage.from(bucket).upload(`${A.id}/hack.jpg`, bytes, { contentType: 'image/jpeg' });
    if (!up.error) created.files.push([bucket, `${A.id}/hack.jpg`]);
    check(`B, A'nın ${bucket} klasörüne yükleyemiyor`, !!up.error);
    const del = await B.client.storage.from(bucket).remove([`${A.id}/${name}`]);
    const still = await admin.storage.from(bucket).list(A.id);
    check(`B, A'nın ${bucket} dosyasını silemiyor`, (still.data ?? []).some((f) => f.name === name), del.error?.message);
  }

  section('istemciye kapalı tablolar');
  const cache = await B.client.from('route_cache').select('id').limit(1);
  check('route_cache: istemci okuyamıyor', blocked(cache));
  const osm = await B.client.from('osm_features').select('osm_id').limit(1);
  check('osm_features: istemci okuyamıyor', blocked(osm));
  const log = await B.client.from('route_generation_log').select('id').limit(1);
  check('route_generation_log: istemci okuyamıyor', blocked(log));
  const anonRoutes = await anon.from('routes').select('id').limit(1);
  check('Giriş yapmamış kullanıcı rota okuyamıyor', blocked(anonRoutes));
  const anonRpc = await anon.rpc('explore_routes', {});
  check('Giriş yapmamış kullanıcı explore_routes çağıramıyor', !!anonRpc.error);
}

let fatal = null;
try {
  await main();
} catch (e) {
  fatal = e;
  console.log(`\n✗ Test yarıda kaldı: ${e instanceof Error ? e.message : String(e)}`);
} finally {
  // Temizlik: dosyalar, rotalar (kullanıcı silinince creator_id null olur, bu yüzden açıkça silinir), kullanıcılar.
  for (const [bucket, name] of created.files) await admin.storage.from(bucket).remove([name]).catch(() => {});
  if (created.routes.length) await admin.from('routes').delete().in('id', created.routes);
  for (const id of created.users) await admin.auth.admin.deleteUser(id).catch(() => {});
  console.log('\nGeçici kullanıcılar, rotalar ve dosyalar silindi.');
}

console.log(`\n${passed} kontrol geçti, ${failures.length} başarısız.`);
if (failures.length) {
  console.log('Başarısızlar:\n' + failures.map((f) => `  - ${f}`).join('\n'));
}
process.exit(failures.length || fatal ? 1 : 0);
