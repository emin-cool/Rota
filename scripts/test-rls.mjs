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
  console.error(
    '✗ .env içinde EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY ve SUPABASE_SERVICE_ROLE_KEY gerekli.',
  );
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
const blocked = (res) =>
  !!res.error || !res.data || (Array.isArray(res.data) && res.data.length === 0);
const section = (t) => console.log(`\n${t}`);
const rand = () => Math.random().toString(36).slice(2, 10);
const LINE = 'SRID=4326;LINESTRING(29.0 41.0,29.01 41.01)';
const POINT = 'SRID=4326;POINT(29.0 41.0)';

const created = { users: [], routes: [], files: [] };

async function makeUser(tag) {
  const email = `rls-${tag}-${rand()}@example.com`;
  const password = `Tmp-${rand()}${rand()}Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
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
  const setZone = await A.client.rpc('set_privacy_zone', {
    p_lng: 29.0,
    p_lat: 41.0,
    p_radius_m: 300,
  });
  if (setZone.error) throw new Error(`set_privacy_zone: ${JSON.stringify(setZone.error)}`);
  await A.client.storage
    .from('route-photos')
    .upload(`${A.id}/a.jpg`, bytes, { contentType: 'image/jpeg' });
  await A.client.storage
    .from('avatars')
    .upload(`${A.id}/avatar.jpg`, bytes, { contentType: 'image/jpeg' });
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
  check(
    'B, A\'nın "followers" aktivitesini göremiyor (follows tablosu gelene kadar)',
    !seenIds.includes(actFollowers.id),
  );
  check('B, A\'nın "public" aktivitesini görebiliyor', seenIds.includes(actPublic.id));
  check(
    "B, A'nın aktivitesini güncelleyemiyor",
    blocked(
      await B.client
        .from('activities')
        .update({ title: 'hack' })
        .eq('id', actPublic.id)
        .select('id'),
    ),
  );
  check(
    "B, A'nın aktivitesini silemiyor",
    blocked(await B.client.from('activities').delete().eq('id', actPublic.id).select('id')),
  );
  const spoof = await B.client
    .from('activities')
    .insert({
      user_id: A.id,
      activity_type: 'walk',
      started_at: new Date().toISOString(),
      duration_sec: 1,
      distance_m: 1,
    });
  check('B, A adına aktivite ekleyemiyor', !!spoof.error);
  check(
    'Giriş yapmamış kullanıcı aktivite okuyamıyor',
    blocked(await anon.from('activities').select('id').limit(1)),
  );
  const own = await A.client.from('activities').select('id').eq('user_id', A.id);
  check('A kendi 3+ aktivitesini görüyor', (own.data ?? []).length >= 3);

  section('profiles / gizlilik bölgesi');
  const pz = await B.client.from('profiles').select('privacy_zone').eq('user_id', A.id);
  check("B, A'nın privacy_zone kolonunu okuyamıyor (kolon izni yok)", !!pz.error);
  check(
    "B, A'nın profilini güncelleyemiyor",
    blocked(
      await B.client
        .from('profiles')
        .update({ display_name: 'hack' })
        .eq('user_id', A.id)
        .select('id'),
    ),
  );
  const info = await B.client.rpc('my_privacy_zone_info');
  check(
    "B'nin my_privacy_zone_info sonucu A'nın bölgesini içermiyor",
    !info.error && (info.data ?? []).length === 0,
  );
  const zoneA = await A.client.rpc('my_privacy_zone_info');
  check('A kendi bölgesini okuyabiliyor', (zoneA.data ?? []).length === 1, JSON.stringify(zoneA));
  await B.client.rpc('clear_privacy_zone');
  const zoneA2 = await A.client.rpc('my_privacy_zone_info');
  check(
    "B'nin clear_privacy_zone çağrısı A'nın bölgesini silmiyor",
    (zoneA2.data ?? []).length === 1,
  );

  section('routes');
  check(
    "B, A'nın özel rotasını göremiyor",
    blocked(await B.client.from('routes').select('id').eq('id', privateRouteId)),
  );
  check(
    "B, A'nın özel rotasını güncelleyemiyor",
    blocked(
      await B.client.from('routes').update({ title: 'hack' }).eq('id', privateRouteId).select('id'),
    ),
  );
  check(
    "B, A'nın özel rotasını silemiyor",
    blocked(await B.client.from('routes').delete().eq('id', privateRouteId).select('id')),
  );
  const det = await B.client.rpc('route_detail', { p_id: privateRouteId });
  check(
    "route_detail: B, A'nın özel rotasını alamıyor",
    !det.error && (det.data ?? []).length === 0,
  );
  const pois = await B.client.rpc('route_pois', { p_id: privateRouteId });
  check(
    "route_pois (security definer): B, A'nın özel rotası için veri alamıyor",
    !pois.error && (pois.data ?? []).length === 0,
  );
  const mine = await B.client.rpc('explore_routes', { p_scope: 'mine' });
  check(
    "explore_routes(mine): B'nin listesinde A'nın rotası yok",
    !(mine.data ?? []).some((r) => r.id === privateRouteId),
  );
  const pubList = await B.client.rpc('explore_routes', {});
  check(
    'explore_routes(public): özel rota listelenmiyor',
    !(pubList.data ?? []).some((r) => r.id === privateRouteId),
  );
  const forged = await A.client
    .from('routes')
    .update({ avg_rating: 5, completion_count: 999, is_featured: true })
    .eq('id', privateRouteId)
    .select('id');
  check('A, kendi rotasının puan/sayaç/is_featured alanlarını değiştiremiyor', !!forged.error);
  const forgedIns = await A.client
    .from('routes')
    .insert({
      creator_id: A.id,
      title: 'sahte',
      activity_type: 'walk',
      route_type: 'a_b',
      geom: LINE,
      start_point: POINT,
      distance_m: 100,
      is_featured: true,
      avg_rating: 5,
    })
    .select('id');
  if (forgedIns.data?.[0]) created.routes.push(forgedIns.data[0].id);
  check('A, rota eklerken is_featured/avg_rating veremiyor', !!forgedIns.error);

  section('route_reviews');
  if (pub.data) {
    const noAct = await B.client
      .from('route_reviews')
      .insert({ route_id: pub.data.id, user_id: B.id, rating: 5, tags: [] });
    check('Aktivitesi olmayan B yorum yazamıyor', !!noAct.error);
    if (reviewId) {
      check(
        "B, A'nın yorumunu güncelleyemiyor",
        blocked(
          await B.client
            .from('route_reviews')
            .update({ rating: 1 })
            .eq('id', reviewId)
            .select('id'),
        ),
      );
      check(
        "B, A'nın yorumunu silemiyor",
        blocked(await B.client.from('route_reviews').delete().eq('id', reviewId).select('id')),
      );
      const ver = await A.client
        .from('route_reviews')
        .update({ is_verified: false })
        .eq('id', reviewId)
        .select('id');
      check('A, yorumunun is_verified alanını değiştiremiyor', !!ver.error);
    }
  } else {
    console.log('  – atlandı: halka açık rota yok');
  }
  const priv = await B.client.from('route_reviews').select('id').eq('route_id', privateRouteId);
  check("B, A'nın özel rotasının yorumlarını göremiyor", blocked(priv));

  section('route_photos / saved_routes');
  const ph = await B.client
    .from('route_photos')
    .insert({ route_id: privateRouteId, user_id: B.id, url: 'http://x/1' });
  check('B, görünmeyen rotaya fotoğraf ekleyemiyor', !!ph.error);
  const phSpoof = await B.client
    .from('route_photos')
    .insert({ route_id: pub.data?.id ?? privateRouteId, user_id: A.id, url: 'http://x/2' });
  check('B, A adına fotoğraf ekleyemiyor', !!phSpoof.error);
  const sv = await B.client.from('saved_routes').select('id').eq('user_id', A.id);
  check("B, A'nın kayıtlı rotalarını okuyamıyor", blocked(sv));
  const svList = await B.client.rpc('explore_routes', { p_scope: 'saved' });
  check(
    "explore_routes(saved): B'nin listesi A'nın kayıtlarını içermiyor",
    !(svList.data ?? []).some((r) => r.id === privateRouteId),
  );
  const stats = await B.client.rpc('my_stats');
  check(
    'my_stats: B yalnızca kendi (0) aktivitesini görüyor',
    (stats.data?.[0]?.activity_count ?? -1) === 0,
  );

  section('storage');
  for (const [bucket, name] of [
    ['route-photos', 'a.jpg'],
    ['avatars', 'avatar.jpg'],
  ]) {
    const up = await B.client.storage
      .from(bucket)
      .upload(`${A.id}/hack.jpg`, bytes, { contentType: 'image/jpeg' });
    if (!up.error) created.files.push([bucket, `${A.id}/hack.jpg`]);
    check(`B, A'nın ${bucket} klasörüne yükleyemiyor`, !!up.error);
    const del = await B.client.storage.from(bucket).remove([`${A.id}/${name}`]);
    const still = await admin.storage.from(bucket).list(A.id);
    check(
      `B, A'nın ${bucket} dosyasını silemiyor`,
      (still.data ?? []).some((f) => f.name === name),
      del.error?.message,
    );
  }

  // ------------------------------------------------------------------ sosyal (P2.1a)
  section('sosyal: takip, görünürlük, alkış, yorum');
  const C = await makeUser('c');
  const idsOf = (res) => (res.data ?? []).map((r) => r.id);
  const seesAct = async (u, id) =>
    (await u.client.from('activities').select('id').eq('id', id)).data?.length === 1;
  const feedIds = async (u) =>
    idsOf(await u.client.rpc('feed_activities', { p_scope: 'following', p_limit: 30 }));

  // 1) Takip etmeden önce
  check(
    'B takipten önce A\'nın "followers" aktivitesini göremiyor',
    !(await seesAct(B, actFollowers.id)),
  );
  // 2) Durumu istemci seçemez
  const forged2 = await B.client
    .from('follows')
    .insert({ follower_id: B.id, following_id: A.id, status: 'accepted' });
  check('B, takip kaydına kendi status değerini yazamıyor (kolon izni yok)', !!forged2.error);
  const spoofFollow = await B.client
    .from('follows')
    .insert({ follower_id: A.id, following_id: C.id });
  check('B, başkası adına takip kaydı ekleyemiyor', !!spoofFollow.error);
  // 3) Herkese açık hesap: takip hemen kabul edilir
  const f1 = await B.client.from('follows').insert({ follower_id: B.id, following_id: A.id });
  check("B, herkese açık A'yı takip edebiliyor", !f1.error, f1.error?.message);
  const fs = await B.client.from('follows').select('status').eq('following_id', A.id).single();
  check('Herkese açık hesapta takip "accepted" doğuyor', fs.data?.status === 'accepted');
  check(
    'B takipten sonra A\'nın "followers" aktivitesini görüyor',
    await seesAct(B, actFollowers.id),
  );
  check(
    'B takipten sonra bile A\'nın "private" aktivitesini göremiyor',
    !(await seesAct(B, actPrivate.id)),
  );
  const feedB = await feedIds(B);
  check(
    "Akış (B): A'nın followers ve public aktiviteleri var, private yok",
    feedB.includes(actFollowers.id) &&
      feedB.includes(actPublic.id) &&
      !feedB.includes(actPrivate.id),
  );
  const feedC0 = await feedIds(C);
  check("Akış (C, takip etmiyor): A'nın aktiviteleri yok", !feedC0.includes(actPublic.id));

  // 4) Alkış
  const k1 = await B.client.from('kudos').insert({ activity_id: actFollowers.id, user_id: B.id });
  check('B (takipçi) "followers" aktiviteyi alkışlayabiliyor', !k1.error, k1.error?.message);
  check(
    'B, A adına alkış atamıyor',
    !!(await B.client.from('kudos').insert({ activity_id: actPublic.id, user_id: A.id })).error,
  );
  const kC = await C.client.from('kudos').insert({ activity_id: actFollowers.id, user_id: C.id });
  check('C (takipçi değil) görmediği aktiviteyi alkışlayamıyor', !!kC.error);
  check(
    "A, B'nin alkışını silemiyor",
    blocked(
      await A.client
        .from('kudos')
        .delete()
        .eq('activity_id', actFollowers.id)
        .eq('user_id', B.id)
        .select('user_id'),
    ),
  );

  // 5) Yorum
  const cm = await B.client
    .from('comments')
    .insert({ activity_id: actFollowers.id, user_id: B.id, body: 'merhaba' })
    .select('id')
    .single();
  check('B (takipçi) yorum yazabiliyor', !cm.error, cm.error?.message);
  check(
    'B, boş yorum yazamıyor',
    !!(
      await B.client
        .from('comments')
        .insert({ activity_id: actFollowers.id, user_id: B.id, body: '   ' })
    ).error,
  );
  check(
    'B, 500 karakterden uzun yorum yazamıyor',
    !!(
      await B.client
        .from('comments')
        .insert({ activity_id: actFollowers.id, user_id: B.id, body: 'x'.repeat(501) })
    ).error,
  );
  check(
    'C (takipçi değil) yorum yazamıyor',
    !!(
      await C.client
        .from('comments')
        .insert({ activity_id: actFollowers.id, user_id: C.id, body: 'x' })
    ).error,
  );
  check(
    "C, B'nin yorumunu silemiyor",
    blocked(await C.client.from('comments').delete().eq('id', cm.data.id).select('id')),
  );
  const list = await B.client.rpc('activity_comments', { p_id: actFollowers.id });
  check(
    'activity_comments: yorum, yazan adı ve can_delete dönüyor',
    (list.data ?? []).length === 1 &&
      list.data[0].mine === true &&
      list.data[0].can_delete === true,
  );
  const listA = await A.client.rpc('activity_comments', { p_id: actFollowers.id });
  check(
    "Aktivite sahibi A, B'nin yorumunu silebilir görünüyor (can_delete)",
    listA.data?.[0]?.can_delete === true && listA.data?.[0]?.mine === false,
  );
  const feedRow = (await B.client.rpc('feed_activities', { p_scope: 'one', p_id: actFollowers.id }))
    .data?.[0];
  check(
    'feed_activities: alkış/yorum sayısı, alkışladım ve son yorum doğru',
    feedRow?.kudos_count === 1 &&
      feedRow?.comment_count === 1 &&
      feedRow?.kudosed === true &&
      feedRow?.last_comment_body === 'merhaba',
    JSON.stringify(feedRow),
  );
  check(
    "A, B'nin yorumunu silebiliyor (aktivite sahibi)",
    !blocked(await A.client.from('comments').delete().eq('id', cm.data.id).select('id')),
  );

  // 6) Takibi bırak → erişim kapanır
  await B.client.from('follows').delete().eq('follower_id', B.id).eq('following_id', A.id);
  check(
    'B takibi bırakınca A\'nın "followers" aktivitesini yeniden göremiyor',
    !(await seesAct(B, actFollowers.id)),
  );

  // 7) Gizli hesap + istek
  await A.client.from('profiles').update({ is_private: true }).eq('user_id', A.id);
  check(
    'Gizli hesap: C (yabancı) A\'nın "public" aktivitesini göremiyor',
    !(await seesAct(C, actPublic.id)),
  );
  const cardPriv = (await C.client.rpc('profile_card', { p_user: A.id })).data?.[0];
  check(
    'profile_card: gizli hesapta temel bilgi var ama içerik kapalı (can_view=false, sayaç 0)',
    cardPriv?.is_private === true && cardPriv?.can_view === false && cardPriv?.activity_count === 0,
    JSON.stringify(cardPriv),
  );
  const fl0 = await C.client.rpc('follow_list', { p_user: A.id, p_kind: 'followers' });
  check('follow_list: gizli hesabın listesi yabancıya kapalı', (fl0.data ?? []).length === 0);
  const f2 = await C.client.from('follows').insert({ follower_id: C.id, following_id: A.id });
  check("C, gizli A'ya istek gönderebiliyor", !f2.error, f2.error?.message);
  const f2s = await C.client.from('follows').select('status').eq('following_id', A.id).single();
  check('Gizli hesapta takip "pending" doğuyor', f2s.data?.status === 'pending');
  check('İstek bekleyen C hâlâ göremiyor', !(await seesAct(C, actPublic.id)));
  const reqs = await A.client.rpc('follow_requests');
  check(
    "follow_requests: A, C'nin isteğini görüyor",
    (reqs.data ?? []).some((r) => r.user_id === C.id),
  );
  check(
    "B (üçüncü kişi) C'nin isteğini kabul edemiyor",
    blocked(
      await B.client
        .from('follows')
        .update({ status: 'accepted' })
        .eq('follower_id', C.id)
        .eq('following_id', A.id)
        .select('status'),
    ),
  );
  check(
    'C, kendi isteğini kendisi kabul edemiyor',
    blocked(
      await C.client
        .from('follows')
        .update({ status: 'accepted' })
        .eq('follower_id', C.id)
        .eq('following_id', A.id)
        .select('status'),
    ),
  );
  const acc = await A.client
    .from('follows')
    .update({ status: 'accepted' })
    .eq('follower_id', C.id)
    .eq('following_id', A.id)
    .select('status');
  check("A, C'nin isteğini kabul edebiliyor", !acc.error && acc.data?.length === 1);
  check('Kabulden sonra C, A\'nın "public" aktivitesini görüyor', await seesAct(C, actPublic.id));
  check('Kabul edilen C, "private" aktiviteyi yine göremiyor', !(await seesAct(C, actPrivate.id)));
  const fl1 = await C.client.rpc('follow_list', { p_user: A.id, p_kind: 'followers' });
  check(
    'follow_list: onaylı takipçi gizli hesabın listesini görüyor',
    (fl1.data ?? []).some((r) => r.user_id === C.id),
  );
  const cnt = (await A.client.rpc('my_social_counts')).data?.[0];
  check(
    "my_social_counts: A'nın 1 takipçisi var",
    cnt?.followers_count === 1 && cnt?.pending_requests === 0,
    JSON.stringify(cnt),
  );

  // 8) Hesap açılınca bekleyen istekler otomatik kabul
  await C.client.from('follows').delete().eq('follower_id', C.id).eq('following_id', A.id);
  await C.client.from('follows').insert({ follower_id: C.id, following_id: A.id });
  check(
    'Yeniden istek "pending"',
    (await C.client.from('follows').select('status').eq('following_id', A.id).single()).data
      ?.status === 'pending',
  );
  await A.client.from('profiles').update({ is_private: false }).eq('user_id', A.id);
  check(
    'Hesap herkese açılınca bekleyen istek otomatik kabul oluyor',
    (await C.client.from('follows').select('status').eq('following_id', A.id).single()).data
      ?.status === 'accepted',
  );

  // 9) Arama ve oturumsuz erişim
  const found = await B.client.rpc('search_profiles', { p_query: 'rlsa' });
  check(
    'search_profiles: A bulunuyor, takip durumu doğru',
    (found.data ?? []).some((r) => r.user_id === A.id && r.follow_state === 'none'),
    JSON.stringify(found.data),
  );
  const self = await B.client.rpc('search_profiles', { p_query: 'rlsb' });
  check(
    'search_profiles: kullanıcı kendini listede görmüyor',
    !(self.data ?? []).some((r) => r.user_id === B.id),
  );
  check(
    'search_profiles: 1 karakterlik aramada sonuç yok',
    ((await B.client.rpc('search_profiles', { p_query: 'r' })).data ?? []).length === 0,
  );
  check(
    'Giriş yapmamış kullanıcı feed_activities çağıramıyor',
    !!(await anon.rpc('feed_activities', {})).error,
  );
  check(
    'Giriş yapmamış kullanıcı follows okuyamıyor',
    blocked(await anon.from('follows').select('follower_id').limit(1)),
  );

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
  for (const [bucket, name] of created.files)
    await admin.storage
      .from(bucket)
      .remove([name])
      .catch(() => {});
  if (created.routes.length) await admin.from('routes').delete().in('id', created.routes);
  for (const id of created.users) await admin.auth.admin.deleteUser(id).catch(() => {});
  console.log('\nGeçici kullanıcılar, rotalar ve dosyalar silindi.');
}

console.log(`\n${passed} kontrol geçti, ${failures.length} başarısız.`);
if (failures.length) {
  console.log('Başarısızlar:\n' + failures.map((f) => `  - ${f}`).join('\n'));
}
process.exit(failures.length || fatal ? 1 : 0);
