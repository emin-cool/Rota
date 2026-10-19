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
  // Hazırlık eklemesi başarısız olursa nedenini göster (aksi halde "null.id" gibi anlamsız bir hata çıkar).
  const mustAct = async (visibility) => {
    const res = await mkAct(visibility);
    if (res.error || !res.data) {
      throw new Error(
        `hazırlık aktivitesi (${visibility}) eklenemedi: ${JSON.stringify(res.error)}`,
      );
    }
    return res.data;
  };
  const actPrivate = await mustAct('private');
  const actFollowers = await mustAct('followers');
  const actPublic = await mustAct('public');

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
  const spoof = await B.client.from('activities').insert({
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

  // ------------------------------------------------------------------ moderasyon (P2.1c)
  section('moderasyon: engelle ve bildir');
  // Hazırlık: C, A'nın herkese açık aktivitesine yorum yazıyor (C, A'yı takip ediyor)
  const cc = await C.client
    .from('comments')
    .insert({ activity_id: actPublic.id, user_id: C.id, body: 'engel öncesi yorum' })
    .select('id')
    .single();
  check('Hazırlık: C yorum yazabiliyor', !cc.error, cc.error?.message);
  const commentOfC = cc.data?.id;

  // 1) A, C'yi engelliyor
  check(
    "C, A adına engel ekleyemiyor (A'nın blocker_id'siyle)",
    !!(await C.client.from('blocks').insert({ blocker_id: A.id, blocked_id: B.id })).error,
  );
  check(
    'A, kendini engelleyemiyor',
    !!(await A.client.from('blocks').insert({ blocker_id: A.id, blocked_id: A.id })).error,
  );
  const blk = await A.client.from('blocks').insert({ blocker_id: A.id, blocked_id: C.id });
  check("A, C'yi engelleyebiliyor", !blk.error, blk.error?.message);
  check(
    "Engellenen C, A'nın herkese açık aktivitesini artık göremiyor",
    !(await seesAct(C, actPublic.id)),
  );
  check(
    'Engelleme takip ilişkisini koparıyor (C → A)',
    (await C.client.from('follows').select('status').eq('following_id', A.id)).data?.length === 0,
  );
  check(
    "Engellenen C, A'yı takip edemiyor",
    !!(await C.client.from('follows').insert({ follower_id: C.id, following_id: A.id })).error,
  );
  check(
    "Engellenen C, A'nın aktivitesine alkış atamıyor",
    !!(await C.client.from('kudos').insert({ activity_id: actPublic.id, user_id: C.id })).error,
  );
  check(
    "Engellenen C, A'nın aktivitesine yorum yazamıyor",
    !!(
      await C.client
        .from('comments')
        .insert({ activity_id: actPublic.id, user_id: C.id, body: 'x' })
    ).error,
  );
  const aList = await A.client.rpc('activity_comments', { p_id: actPublic.id });
  check(
    "A'nın yorum listesinde engellediği C'nin yorumu yok",
    !(aList.data ?? []).some((c) => c.id === commentOfC),
  );
  const bList = await B.client.rpc('activity_comments', { p_id: actPublic.id });
  check(
    "Üçüncü kişi B, C'nin yorumunu hâlâ görüyor (engel yalnızca A ile C arasında)",
    (bList.data ?? []).some((c) => c.id === commentOfC),
  );
  check(
    "profile_card: A'yı engelleyen taraf için C'nin kartı yok, C'yi engelleyen A için blocked_by_me=true",
    ((await C.client.rpc('profile_card', { p_user: A.id })).data ?? []).length === 0 &&
      (await A.client.rpc('profile_card', { p_user: C.id })).data?.[0]?.blocked_by_me === true,
  );
  check(
    'search_profiles: iki yönde de birbirini bulamıyorlar',
    !((await A.client.rpc('search_profiles', { p_query: 'rlsc' })).data ?? []).some(
      (r) => r.user_id === C.id,
    ) &&
      !((await C.client.rpc('search_profiles', { p_query: 'rlsa' })).data ?? []).some(
        (r) => r.user_id === A.id,
      ),
  );
  const mineBlocked = await A.client.rpc('blocked_users');
  check(
    "blocked_users: A engellediği C'yi görüyor",
    (mineBlocked.data ?? []).some((u) => u.user_id === C.id),
  );
  check(
    'Engellenen C, engellendiğini blocks tablosundan göremiyor',
    blocked(await C.client.from('blocks').select('blocker_id').eq('blocked_id', C.id)),
  );
  check(
    "C, A'nın engelini kaldıramıyor",
    blocked(
      await C.client
        .from('blocks')
        .delete()
        .eq('blocker_id', A.id)
        .eq('blocked_id', C.id)
        .select('blocker_id'),
    ),
  );
  const feedA = await A.client.rpc('feed_activities', { p_scope: 'one', p_id: actPublic.id });
  check(
    "A'nın aktivitesinde engelli C'nin yorumu sayıya katılmıyor",
    feedA.data?.[0]?.comment_count === 0,
    JSON.stringify(feedA.data?.[0]?.comment_count),
  );

  // 2) Engeli kaldır
  await A.client.from('blocks').delete().eq('blocker_id', A.id).eq('blocked_id', C.id);
  check(
    "Engel kalkınca C, A'nın herkese açık aktivitesini yine görüyor",
    await seesAct(C, actPublic.id),
  );
  check(
    'blocked_users: engel kalkınca liste boş',
    ((await A.client.rpc('blocked_users')).data ?? []).length === 0,
  );

  // 3) Rota yorumları engelli yazardan gizlenir
  if (pub.data && reviewId) {
    await B.client.from('blocks').insert({ blocker_id: B.id, blocked_id: A.id });
    const rl = await B.client.rpc('route_reviews_list', { p_id: pub.data.id });
    check(
      "route_reviews_list: B, engellediği A'nın yorumunu görmüyor",
      !(rl.data ?? []).some((r) => r.user_id === A.id),
    );
    await B.client.from('blocks').delete().eq('blocker_id', B.id).eq('blocked_id', A.id);
    const rl2 = await B.client.rpc('route_reviews_list', { p_id: pub.data.id });
    check(
      'route_reviews_list: engel kalkınca yorum geri geliyor',
      (rl2.data ?? []).some((r) => r.user_id === A.id),
    );
  }

  // 4) Bildirme
  const rep = (u, type, id, reason = 'spam', details = null) =>
    u.client.rpc('report_content', {
      p_type: type,
      p_target: id,
      p_reason: reason,
      p_details: details,
    });
  check(
    "B, A'nın aktivitesini bildirebiliyor",
    !(await rep(B, 'activity', actPublic.id, 'inappropriate', 'deneme')).error,
  );
  check(
    "B, C'nin yorumunu bildirebiliyor",
    !(await rep(B, 'comment', commentOfC, 'harassment')).error,
  );
  check("B, A'nın profilini bildirebiliyor", !(await rep(B, 'profile', A.id, 'other')).error);
  if (pub.data && reviewId) {
    check(
      "B, A'nın rota yorumunu bildirebiliyor",
      !(await rep(B, 'review', reviewId, 'spam')).error,
    );
  }
  check(
    'B, görmediği ("private") aktiviteyi bildiremiyor',
    !!(await rep(B, 'activity', actPrivate.id)).error,
  );
  check('A, kendi aktivitesini bildiremiyor', !!(await rep(A, 'activity', actPublic.id)).error);
  check('Geçersiz sebep reddediliyor', !!(await rep(B, 'activity', actPublic.id, 'uydurma')).error);
  check('Geçersiz tür reddediliyor', !!(await rep(B, 'bilinmeyen', actPublic.id)).error);
  check(
    'İstemci reports tablosuna doğrudan yazamıyor',
    !!(
      await B.client.from('reports').insert({
        reporter_id: B.id,
        target_type: 'activity',
        target_id: actPublic.id,
        reason: 'spam',
      })
    ).error,
  );
  check(
    'İstemci reports tablosunu okuyamıyor',
    blocked(await B.client.from('reports').select('id').limit(1)),
  );
  check(
    'Giriş yapmamış kullanıcı bildiremiyor',
    !!(
      await anon.rpc('report_content', {
        p_type: 'activity',
        p_target: actPublic.id,
        p_reason: 'spam',
      })
    ).error,
  );
  const stored = await admin
    .from('reports')
    .select('reported_user_id, reporter_id, details')
    .eq('reporter_id', B.id);
  check(
    'Bildirimler sunucuda doğru sahibiyle kayıtlı (sahibi istemciden gelmiyor)',
    (stored.data ?? []).some((r) => r.reported_user_id === A.id && r.details === 'deneme') &&
      (stored.data ?? []).some((r) => r.reported_user_id === C.id),
    JSON.stringify(stored.data),
  );

  // ------------------------------------------------------------------ push bildirimleri (P2.1b)
  section('push bildirimleri: tetikleyiciler, token ve tercihler');
  const P = await makeUser('p');
  const Q = await makeUser('q');
  const notifs = async (recipient, actor, type) =>
    (
      await admin
        .from('notifications')
        .select('id, activity_id')
        .eq('recipient_id', recipient)
        .eq('actor_id', actor)
        .eq('type', type)
    ).data ?? [];

  // Hazırlık: A herkese açık hesap; P, A'yı takip etmiyor.
  await admin.from('profiles').update({ is_private: false }).eq('user_id', A.id);
  await admin.from('follows').delete().eq('follower_id', P.id).eq('following_id', A.id);

  // 1) Alkış → aktivite sahibine bildirim
  const kP = await P.client.from('kudos').insert({ activity_id: actPublic.id, user_id: P.id });
  check('Hazırlık: P herkese açık aktiviteyi alkışlayabiliyor', !kP.error, kP.error?.message);
  const nk = await notifs(A.id, P.id, 'kudos');
  check(
    'Alkış, aktivite sahibi A için bildirim üretiyor (aktivite kimliğiyle)',
    nk.length === 1 && nk[0].activity_id === actPublic.id,
    JSON.stringify(nk),
  );
  await P.client.from('kudos').delete().eq('activity_id', actPublic.id).eq('user_id', P.id);
  await P.client.from('kudos').insert({ activity_id: actPublic.id, user_id: P.id });
  check(
    'Alkışı geri alıp tekrar atmak ikinci bildirim üretmiyor (spam yok)',
    (await notifs(A.id, P.id, 'kudos')).length === 1,
  );

  // 2) Yorum → her yorum yeni bildirim
  await P.client
    .from('comments')
    .insert({ activity_id: actPublic.id, user_id: P.id, body: 'bildirim testi 1' });
  await P.client
    .from('comments')
    .insert({ activity_id: actPublic.id, user_id: P.id, body: 'bildirim testi 2' });
  check(
    'Her yorum A için ayrı bildirim üretiyor',
    (await notifs(A.id, P.id, 'comment')).length === 2,
  );

  // 3) Kendi aktivitene alkış/yorum → bildirim yok
  await A.client.from('kudos').insert({ activity_id: actPublic.id, user_id: A.id });
  await A.client
    .from('comments')
    .insert({ activity_id: actPublic.id, user_id: A.id, body: 'kendi yorumum' });
  check(
    'Kendi aktivitene alkış/yorum bildirim üretmiyor',
    (await notifs(A.id, A.id, 'kudos')).length === 0 &&
      (await notifs(A.id, A.id, 'comment')).length === 0,
  );

  // 4) Takip (açık hesap) → 'follow'; bırak-takip et dedupe
  const fP = await P.client.from('follows').insert({ follower_id: P.id, following_id: A.id });
  check("Hazırlık: P, A'yı takip edebiliyor", !fP.error, fP.error?.message);
  check(
    "Takip, A için 'follow' bildirimi üretiyor",
    (await notifs(A.id, P.id, 'follow')).length === 1,
  );
  await P.client.from('follows').delete().eq('follower_id', P.id).eq('following_id', A.id);
  await P.client.from('follows').insert({ follower_id: P.id, following_id: A.id });
  check(
    'Takibi bırakıp tekrar takip etmek ikinci bildirim üretmiyor',
    (await notifs(A.id, P.id, 'follow')).length === 1,
  );

  // 5) Gizli hesap: istek bildirimi, sonra kabul bildirimi
  await admin.from('profiles').update({ is_private: true }).eq('user_id', A.id);
  const fQ = await Q.client.from('follows').insert({ follower_id: Q.id, following_id: A.id });
  check('Hazırlık: Q gizli hesaba istek gönderebiliyor', !fQ.error, fQ.error?.message);
  check(
    "Gizli hesaba takip, 'follow_request' bildirimi üretiyor",
    (await notifs(A.id, Q.id, 'follow_request')).length === 1 &&
      (await notifs(A.id, Q.id, 'follow')).length === 0,
  );
  const acceptReq = await A.client
    .from('follows')
    .update({ status: 'accepted' })
    .eq('follower_id', Q.id)
    .eq('following_id', A.id)
    .select('status');
  check(
    'A isteği kabul edebiliyor',
    !acceptReq.error && acceptReq.data?.length === 1,
    acceptReq.error?.message,
  );
  check(
    "İstek kabul edilince Q için 'follow_accepted' bildirimi üretiyor",
    (await notifs(Q.id, A.id, 'follow_accepted')).length === 1,
  );
  await admin.from('profiles').update({ is_private: false }).eq('user_id', A.id);

  // 6) notifications: yalnızca alıcı okur, istemci yazamaz
  check(
    'A kendi bildirimlerini okuyabiliyor',
    ((await A.client.from('notifications').select('id').eq('recipient_id', A.id)).data ?? [])
      .length >= 4,
  );
  check(
    "P, A'nın bildirimlerini okuyamıyor",
    blocked(await P.client.from('notifications').select('id').eq('recipient_id', A.id)),
  );
  check(
    'İstemci notifications tablosuna yazamıyor',
    !!(
      await P.client
        .from('notifications')
        .insert({ recipient_id: A.id, actor_id: P.id, type: 'follow' })
    ).error,
  );
  const aNotif = (await notifs(A.id, P.id, 'follow'))[0];
  check(
    'İstemci notifications satırını güncelleyemiyor/silemiyor',
    blocked(
      await A.client
        .from('notifications')
        .update({ pushed_at: new Date().toISOString() })
        .eq('id', aNotif.id)
        .select('id'),
    ) && blocked(await A.client.from('notifications').delete().eq('id', aNotif.id).select('id')),
  );
  check(
    'İstemci enqueue_notification fonksiyonunu çağıramıyor',
    !!(
      await P.client.rpc('enqueue_notification', {
        p_recipient: A.id,
        p_actor: P.id,
        p_type: 'follow',
      })
    ).error,
  );

  // 7) push_tokens
  const TOKEN = `ExponentPushToken[rls-${rand()}${rand()}]`;
  check(
    'P token kaydedebiliyor',
    !(await P.client.rpc('register_push_token', { p_token: TOKEN, p_platform: 'ios' })).error,
  );
  check(
    "P kendi token'ını okuyabiliyor",
    ((await P.client.from('push_tokens').select('token')).data ?? []).some(
      (t) => t.token === TOKEN,
    ),
  );
  check(
    "A, P'nin token'ını okuyamıyor",
    !((await A.client.from('push_tokens').select('token')).data ?? []).some(
      (t) => t.token === TOKEN,
    ),
  );
  check(
    'İstemci push_tokens tablosuna doğrudan yazamıyor',
    !!(
      await P.client
        .from('push_tokens')
        .insert({ token: `ExponentPushToken[x-${rand()}]`, user_id: P.id, platform: 'ios' })
    ).error,
  );
  check(
    'Geçersiz platform reddediliyor',
    !!(await P.client.rpc('register_push_token', { p_token: TOKEN, p_platform: 'web' })).error,
  );
  check(
    'Çok kısa token reddediliyor',
    !!(await P.client.rpc('register_push_token', { p_token: 'kisa', p_platform: 'ios' })).error,
  );
  check(
    'Giriş yapmamış kullanıcı token kaydedemiyor',
    !!(await anon.rpc('register_push_token', { p_token: TOKEN, p_platform: 'ios' })).error,
  );
  // Aynı cihazda hesap değişti: token yeni kullanıcıya geçer, eskisi artık bildirim almaz.
  check(
    'Aynı cihazda hesap değişince token yeni kullanıcıya geçiyor',
    !(await A.client.rpc('register_push_token', { p_token: TOKEN, p_platform: 'android' })).error &&
      ((await admin.from('push_tokens').select('user_id').eq('token', TOKEN)).data ?? [])[0]
        ?.user_id === A.id,
  );
  check(
    "P artık o token'ı görmüyor",
    !((await P.client.from('push_tokens').select('token')).data ?? []).some(
      (t) => t.token === TOKEN,
    ),
  );
  check(
    "P, A'nın token'ını silemiyor",
    blocked(await P.client.from('push_tokens').delete().eq('token', TOKEN).select('token')),
  );
  check(
    "A kendi token'ını silebiliyor",
    !(await A.client.from('push_tokens').delete().eq('token', TOKEN).select('token')).error &&
      ((await admin.from('push_tokens').select('token').eq('token', TOKEN)).data ?? []).length ===
        0,
  );
  // Kullanıcı başına en fazla 5 token: eskiler temizlenir.
  for (let i = 0; i < 7; i++) {
    await P.client.rpc('register_push_token', {
      p_token: `ExponentPushToken[bulk-${i}-${rand()}${rand()}]`,
      p_platform: 'ios',
    });
  }
  check(
    'Kullanıcı başına en fazla 5 token tutuluyor',
    ((await admin.from('push_tokens').select('token').eq('user_id', P.id)).data ?? []).length <= 5,
  );

  // 8) notification_settings
  check(
    'P kendi bildirim tercihini kaydedebiliyor (upsert)',
    !(
      await P.client
        .from('notification_settings')
        .upsert({ user_id: P.id, kudos: false }, { onConflict: 'user_id' })
    ).error,
  );
  const ps = await P.client
    .from('notification_settings')
    .select('follows, kudos, comments')
    .eq('user_id', P.id)
    .single();
  check(
    'Tercih saklandı, diğerleri varsayılan açık',
    ps.data?.kudos === false && ps.data?.follows === true && ps.data?.comments === true,
    JSON.stringify(ps.data),
  );
  check(
    'P, A adına tercih yazamıyor',
    !!(
      await P.client
        .from('notification_settings')
        .upsert({ user_id: A.id, kudos: false }, { onConflict: 'user_id' })
    ).error,
  );
  check(
    "A, P'nin tercihini okuyamıyor",
    blocked(await A.client.from('notification_settings').select('user_id').eq('user_id', P.id)),
  );
  check(
    'Giriş yapmamış kullanıcı tercih okuyamıyor',
    blocked(await anon.from('notification_settings').select('user_id').limit(1)),
  );

  // ------------------------------------------------------------------ öne çıkan rota otomasyonu (P2.1b)
  section('öne çıkan rota otomasyonu (refresh_featured_routes)');
  const mkFeat = async (title, patch) => {
    const r = await admin
      .from('routes')
      .insert({
        creator_id: A.id,
        title: `RLS featured ${title}`,
        activity_type: 'walk',
        route_type: 'a_b',
        geom: LINE,
        start_point: POINT,
        distance_m: 1500,
        is_public: true,
        ...patch,
      })
      .select('id')
      .single();
    if (r.error) throw new Error(`featured test rotası eklenemedi: ${JSON.stringify(r.error)}`);
    created.routes.push(r.data.id);
    return r.data.id;
  };
  const featOk = await mkFeat('ok', { avg_rating: 4.6, completion_count: 25 });
  const featEdge = await mkFeat('sinir', { avg_rating: 4.3, completion_count: 20 });
  const featLowRating = await mkFeat('dusuk puan', { avg_rating: 4.2, completion_count: 50 });
  const featLowDone = await mkFeat('az tamamlanma', { avg_rating: 4.9, completion_count: 19 });
  const featPrivate = await mkFeat('ozel', {
    avg_rating: 5.0,
    completion_count: 99,
    is_public: false,
  });
  const featManual = await mkFeat('elle', {
    is_featured: true,
    avg_rating: 0,
    completion_count: 0,
  });

  const run = await admin.rpc('refresh_featured_routes');
  check('refresh_featured_routes service role ile çalışıyor', !run.error, run.error?.message);
  check(
    'En az 2 rota öne çıkarıldı (ölçütü karşılayan ikisi)',
    typeof run.data === 'number' && run.data >= 2,
    JSON.stringify(run.data),
  );
  const featOf = async (id) =>
    (await admin.from('routes').select('is_featured').eq('id', id).single()).data?.is_featured;
  check('Puan 4,6 ve 25 tamamlanma: öne çıktı', (await featOf(featOk)) === true);
  check('Tam sınırda (4,3 ve 20): öne çıktı', (await featOf(featEdge)) === true);
  check('Puan 4,2: öne çıkmadı', (await featOf(featLowRating)) === false);
  check('19 tamamlanma: öne çıkmadı', (await featOf(featLowDone)) === false);
  check('Özel rota yüksek sayaçla bile öne çıkmadı', (await featOf(featPrivate)) === false);
  check('Elle öne çıkarılmış (puansız) rota kaldırılmadı', (await featOf(featManual)) === true);
  const run2 = await admin.rpc('refresh_featured_routes');
  check(
    'İkinci çalıştırma yeni rota eklemiyor (tekrar güvenli)',
    !run2.error && run2.data === 0,
    JSON.stringify(run2.data ?? run2.error),
  );
  check(
    'İstemci refresh_featured_routes çağıramıyor',
    !!(await A.client.rpc('refresh_featured_routes')).error &&
      !!(await anon.rpc('refresh_featured_routes')).error,
  );

  section('kurslar');
  const cat = await A.client.from('courses').select('id, title');
  check('Katalog okunabiliyor (4 başlangıç kursu)', (cat.data ?? []).length >= 4);
  const anonCourses = await anon.from('courses').select('id').limit(1);
  check('Giriş yapmamış kullanıcı kurs okuyamıyor', blocked(anonCourses));
  check(
    'Kurs eklenemiyor (istemci yazamaz)',
    !!(
      await A.client.from('courses').insert({
        title: 'hack',
        level: 'beginner',
        activity_type: 'run',
        weeks: 1,
        sessions_per_week: 1,
      })
    ).error,
  );
  const course1 = (cat.data ?? [])[0];
  const days1 = course1
    ? await A.client.from('course_days').select('id').eq('course_id', course1.id)
    : { data: [] };
  check('Kurs günleri okunabiliyor', (days1.data ?? []).length > 0);
  check(
    'Kurs günü güncellenemiyor',
    blocked(
      await A.client
        .from('course_days')
        .update({ title: 'hack' })
        .eq('id', days1.data?.[0]?.id ?? '')
        .select('id'),
    ),
  );

  if (course1 && days1.data?.length) {
    const dayId = days1.data[0].id;
    check(
      'A programa katılabiliyor',
      !(await A.client.from('course_enrollments').insert({ user_id: A.id, course_id: course1.id }))
        .error,
    );
    check(
      'Aynı programa ikinci kayıt reddediliyor (unique)',
      !!(await A.client.from('course_enrollments').insert({ user_id: A.id, course_id: course1.id }))
        .error,
    );
    check(
      'B, A adına programa katılamıyor',
      !!(await B.client.from('course_enrollments').insert({ user_id: A.id, course_id: course1.id }))
        .error,
    );
    const seenByB = await B.client.from('course_enrollments').select('id').eq('user_id', A.id);
    check("B, A'nın kaydını göremiyor", (seenByB.data ?? []).length === 0);
    check(
      'A, completed_days alanını doğrudan yazamıyor',
      blocked(
        await A.client
          .from('course_enrollments')
          .update({ completed_days: [dayId] })
          .eq('user_id', A.id)
          .select('id'),
      ),
    );

    const courseAct = await A.client
      .from('activities')
      .insert({
        user_id: A.id,
        activity_type: 'run',
        started_at: new Date().toISOString(),
        duration_sec: 600,
        distance_m: 1000,
        visibility: 'private',
        course_day_id: dayId,
      })
      .select('id')
      .single();
    check('Antrenman günüyle aktivite kaydedilebiliyor', !!courseAct.data && !courseAct.error);
    const myEnroll = () =>
      A.client
        .from('course_enrollments')
        .select('completed_days, completed_at')
        .eq('course_id', course1.id)
        .single();

    check(
      "B, A'nın aktivitesiyle günü işaretleyemiyor (A'nın ilerlemesi değişmiyor)",
      await (async () => {
        await B.client.rpc('complete_course_day', { p_activity_id: courseAct.data.id });
        return ((await myEnroll()).data?.completed_days ?? []).length === 0;
      })(),
    );
    check(
      'Giriş yapmamış kullanıcı complete_course_day çağıramıyor',
      !!(await anon.rpc('complete_course_day', { p_activity_id: courseAct.data.id })).error,
    );
    const done1 = await A.client.rpc('complete_course_day', { p_activity_id: courseAct.data.id });
    check('A kendi aktivitesiyle günü tamamlıyor', !done1.error);
    check(
      'Gün completed_days içine eklendi',
      ((await myEnroll()).data?.completed_days ?? []).includes(dayId),
    );
    await A.client.rpc('complete_course_day', { p_activity_id: courseAct.data.id });
    check(
      'RPC tekrar çağrılınca tekrar eklemiyor (idempotent)',
      ((await myEnroll()).data?.completed_days ?? []).length === 1,
    );
    check('Kurs bitmedi: completed_at boş', (await myEnroll()).data?.completed_at === null);
    check(
      'A programdan ayrılabiliyor',
      !(await A.client.from('course_enrollments').delete().eq('course_id', course1.id)).error &&
        ((await myEnroll()).data ?? null) === null,
    );
  }

  // Tek günlük geçici kurs: son gün tamamlanınca completed_at dolar.
  const tmpCourse = await admin
    .from('courses')
    .insert({
      title: `RLS test kursu ${rand()}`,
      level: 'beginner',
      activity_type: 'walk',
      weeks: 1,
      sessions_per_week: 1,
    })
    .select('id')
    .single();
  if (tmpCourse.data) {
    const tmpDay = await admin
      .from('course_days')
      .insert({
        course_id: tmpCourse.data.id,
        week_no: 1,
        day_no: 1,
        title: 'tek gün',
        workout_json: [{ type: 'walk', duration_sec: 600 }],
        target_duration_min: 10,
      })
      .select('id')
      .single();
    await A.client
      .from('course_enrollments')
      .insert({ user_id: A.id, course_id: tmpCourse.data.id });
    const tmpAct = await A.client
      .from('activities')
      .insert({
        user_id: A.id,
        activity_type: 'walk',
        started_at: new Date().toISOString(),
        duration_sec: 600,
        distance_m: 800,
        visibility: 'private',
        course_day_id: tmpDay.data?.id,
      })
      .select('id')
      .single();
    const tmpBadge = await admin
      .from('badges')
      .insert({
        code: `rls-test-${rand()}`,
        title: 'RLS test rozeti',
        course_id: tmpCourse.data.id,
      })
      .select('id')
      .single();
    const myBadges = (client) =>
      client
        .from('user_badges')
        .select('badge_id')
        .eq('badge_id', tmpBadge.data?.id ?? '');
    check('Kurs bitmeden rozet yok', ((await myBadges(A.client)).data ?? []).length === 0);
    const finishCall = await A.client.rpc('complete_course_day', {
      p_activity_id: tmpAct.data?.id,
    });
    check('Kurs bu çağrıyla bitince RPC true dönüyor', finishCall.data === true);
    check("Bitirme rozeti A'ya verildi", ((await myBadges(A.client)).data ?? []).length === 1);
    check("B, A'nın rozetini göremiyor", ((await myBadges(B.client)).data ?? []).length === 0);
    const again = await A.client.rpc('complete_course_day', { p_activity_id: tmpAct.data?.id });
    check(
      'Tekrar çağrı false döner ve rozeti çoğaltmaz',
      again.data === false && ((await myBadges(A.client)).data ?? []).length === 1,
    );
    check(
      'Rozet kataloğu okunabiliyor',
      (
        (
          await A.client
            .from('badges')
            .select('id')
            .eq('id', tmpBadge.data?.id ?? '')
        ).data ?? []
      ).length === 1,
    );
    check(
      'A kendine rozet ekleyemiyor',
      !!(await A.client.from('user_badges').insert({ user_id: A.id, badge_id: tmpBadge.data?.id }))
        .error,
    );
    check(
      'Rozet kataloğuna yazılamıyor',
      !!(await A.client.from('badges').insert({ code: 'hack', title: 'hack' })).error,
    );
    check(
      'Giriş yapmamış kullanıcı rozet okuyamıyor',
      blocked(await anon.from('badges').select('id').limit(1)),
    );
    const fin = await A.client
      .from('course_enrollments')
      .select('completed_at')
      .eq('course_id', tmpCourse.data.id)
      .single();
    check('Son gün bitince kurs completed_at doluyor', !!fin.data?.completed_at);
    await admin.from('courses').delete().eq('id', tmpCourse.data.id);
  } else {
    check('Geçici kurs oluşturulamadı', false, tmpCourse.error?.message);
  }

  section('istemciye kapalı tablolar');
  const cache = await B.client.from('route_cache').select('id').limit(1);
  check('route_cache: istemci okuyamıyor', blocked(cache));
  const osm = await B.client.from('osm_features').select('osm_id').limit(1);
  check('osm_features: istemci okuyamıyor', blocked(osm));
  const wcache = await B.client.from('weather_cache').select('cell_key').limit(1);
  check('weather_cache: istemci okuyamıyor', blocked(wcache));
  check(
    'weather_cache: istemci yazamıyor',
    !!(
      await B.client
        .from('weather_cache')
        .insert({ cell_key: '0.00:0.00', provider: 'x', payload: {} })
    ).error,
  );
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
