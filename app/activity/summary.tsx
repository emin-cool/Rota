import { MaterialIcons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { ActivityTrackMap } from '@/components/activity/ActivityTrackMap';
import { SHARE_CARD_H, SHARE_CARD_W, ShareCard } from '@/components/activity/ShareCard';
import { Button, Card, Chip, HeadlineMd, Text, TextField } from '@/components/ui';
import { tr } from '@/i18n/tr';
import { goalPercent, summarize, type ActivitySummary } from '@/lib/activitySummary';
import {
  MAX_PHOTOS,
  processUploadQueue,
  type PhotoDraft,
  type ReviewDraft,
} from '@/lib/activityUpload';
import { formatKmClock, formatPaceClock, formatElapsed } from '@/lib/tracking';
import { lineLengthM, type LngLat } from '@/lib/geo';
import { REVIEW_TAGS } from '@/lib/reviewTags';
import { deleteSession, getSession, loadPoints, updateSession } from '@/lib/trackingDb';
import type { SessionRow } from '@/lib/trackingDb';
import { useSessionStore } from '@/stores/sessionStore';
import { colors } from '@/theme/tokens';

type Visibility = 'public' | 'followers' | 'private';
const VISIBILITIES: Visibility[] = ['public', 'followers', 'private'];
const ACTIVITY_NAME = { walk: 'yürüyüşü', run: 'koşusu', bike: 'bisiklet turu' } as const;

/** "Sabah yürüyüşü" gibi varsayılan başlık. */
function defaultTitle(session: SessionRow): string {
  const h = new Date(session.started_at).getHours();
  const part =
    h < 5 ? 'Gece' : h < 12 ? 'Sabah' : h < 17 ? 'Öğleden sonra' : h < 21 ? 'Akşam' : 'Gece';
  const name = ACTIVITY_NAME[session.activity_type];
  return `${part} ${name}`;
}

function dateText(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  const day =
    d.toDateString() === today.toDateString()
      ? 'Bugün'
      : d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
  return `${day}, ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
}

function StatTile({
  label,
  value,
  unit,
  icon,
}: {
  label: string;
  value: string;
  unit: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}) {
  return (
    <View className="min-h-[88px] flex-1 flex-row items-center justify-between rounded-lg bg-surface-container-low p-space-md">
      <View className="shrink gap-space-xs">
        <Text variant="label-sm" className="text-ink-secondary">
          {label}
        </Text>
        <Text variant="headline-md">
          {value}{' '}
          <Text variant="body-md" className="text-ink-secondary">
            {unit}
          </Text>
        </Text>
      </View>
      <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-soft">
        <MaterialIcons name={icon} size={22} color={colors.brand.DEFAULT} />
      </View>
    </View>
  );
}

export default function ActivitySummaryScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useSessionStore((s) => s.session?.user.id);

  const [session, setSession] = useState<SessionRow | null>(null);
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');

  const [title, setTitle] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('followers');
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const cardRef = useRef<View>(null);
  const finished = useRef(false);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const row = id ? await getSession(id) : null;
        if (!row) {
          if (active) setLoadState('error');
          return;
        }
        const points = await loadPoints(row.id);
        if (!active) return;
        setSession(row);
        setSummary(summarize(row, points));
        setTitle(row.title ?? row.route_title ?? defaultTitle(row));
        setVisibility(row.visibility ?? 'followers');
        setLoadState('ready');
      } catch {
        if (active) setLoadState('error');
      }
    })();
    return () => {
      active = false;
    };
  }, [id, reloadKey]);

  const hasRoute = !!session?.route_id;
  const plannedM = session?.route_json
    ? lineLengthM(JSON.parse(session.route_json) as LngLat[])
    : null;
  const goal = summary ? goalPercent(summary.distanceM, plannedM) : null;

  // --- Fotoğraf -------------------------------------------------------------
  const addPhotos = async () => {
    setPhotoError(null);
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      setPhotoError(tr.summary.photosFull);
      return;
    }
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: room,
      });
      if (res.canceled) return;
      // 1600 px genişlik + JPEG 0,7: yükleme küçük kalsın; yeniden kodlama EXIF (konum) bilgisini de siler.
      const out: PhotoDraft[] = [];
      for (const asset of res.assets.slice(0, room)) {
        const m = await ImageManipulator.manipulateAsync(
          asset.uri,
          asset.width > 1600 ? [{ resize: { width: 1600 } }] : [],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
        );
        out.push({ uri: m.uri, done: false });
      }
      setPhotos((p) => [...p, ...out]);
    } catch {
      setPhotoError(tr.summary.photosError);
    }
  };

  // --- Paylaş ---------------------------------------------------------------
  const share = async () => {
    if (!cardRef.current || sharing) return;
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        width: SHARE_CARD_W * 3,
        height: SHARE_CARD_H * 3,
      });
      await Sharing.shareAsync(uri, { mimeType: 'image/png' });
    } catch {
      Alert.alert(tr.summary.shareError);
    } finally {
      setSharing(false);
    }
  };

  // --- Kaydet ---------------------------------------------------------------
  const save = useCallback(async (): Promise<boolean> => {
    if (!session || saving) return false;
    setSaving(true);
    setSaveError(null);
    try {
      const review: ReviewDraft | null =
        hasRoute && rating > 0 ? { rating, tags, comment: comment.trim() } : null;
      await updateSession(session.id, {
        title: title.trim() || defaultTitle(session),
        visibility,
        review_json: review ? JSON.stringify(review) : null,
        photos_json: hasRoute && photos.length > 0 ? JSON.stringify(photos) : null,
        queued: 1,
      });
      if (userId) await processUploadQueue(userId);
      const after = await getSession(session.id);
      finished.current = true;
      Alert.alert(after?.uploaded ? tr.summary.savedOnline : tr.summary.savedOffline);
      router.replace('/');
      return true;
    } catch {
      setSaveError(tr.summary.saveError);
      return false;
    } finally {
      setSaving(false);
    }
  }, [session, saving, hasRoute, rating, tags, comment, title, visibility, photos, userId]);

  // --- Kaydetmeden çıkış ------------------------------------------------------
  const leave = useCallback(() => {
    if (finished.current || !session) {
      router.replace('/');
      return;
    }
    Alert.alert(tr.summary.leaveTitle, tr.summary.leaveBody, [
      { text: tr.summary.leaveStay, style: 'cancel' },
      {
        text: tr.summary.leaveDiscard,
        style: 'destructive',
        onPress: () => {
          void deleteSession(session.id).finally(() => router.replace('/'));
        },
      },
      { text: tr.summary.leaveSave, onPress: () => void save() },
    ]);
  }, [session, save]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      leave();
      return true;
    });
    return () => sub.remove();
  }, [leave]);

  // --- Durumlar -------------------------------------------------------------
  if (loadState !== 'ready' || !session || !summary) {
    return (
      <View
        className="flex-1 items-center justify-center gap-space-md bg-canvas px-margin"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        {loadState === 'loading' ? (
          <ActivityIndicator color={colors.brand.DEFAULT} />
        ) : (
          <>
            <Text variant="body-lg" className="text-center">
              {tr.summary.loadError}
            </Text>
            <Button
              title={tr.common.retry}
              variant="secondary"
              onPress={() => {
                setLoadState('loading');
                setReloadKey((k) => k + 1);
              }}
            />
            <Button title={tr.summary.home} variant="ghost" onPress={() => router.replace('/')} />
          </>
        )}
      </View>
    );
  }

  const km = formatKmClock(summary.distanceM);
  const shareStats = [
    { label: tr.summary.distance, value: `${km} km` },
    { label: tr.summary.duration, value: formatElapsed(summary.durationSec) },
    { label: tr.summary.avgPace, value: `${formatPaceClock(summary.avgPaceSecPerKm)} /km` },
  ];
  const hasTrack = summary.track.length >= 2;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-canvas"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Üst çubuk */}
      <View
        className="flex-row items-center justify-between bg-canvas px-space-sm pb-space-sm"
        style={{ paddingTop: insets.top + 4 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr.common.back}
          onPress={leave}
          hitSlop={8}
          className="h-11 w-11 items-center justify-center"
        >
          <MaterialIcons name="arrow-back-ios-new" size={20} color={colors.ink.DEFAULT} />
        </Pressable>
        <HeadlineMd>{tr.summary.title}</HeadlineMd>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr.summary.share}
          onPress={() => void share()}
          disabled={sharing || !hasTrack}
          hitSlop={8}
          className={`h-11 w-11 items-center justify-center ${!hasTrack ? 'opacity-40' : ''}`}
        >
          {sharing ? (
            <ActivityIndicator color={colors.brand.DEFAULT} />
          ) : (
            <MaterialIcons name="ios-share" size={22} color={colors.ink.DEFAULT} />
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerClassName="gap-space-md px-margin pb-space-lg"
        keyboardShouldPersistTaps="handled"
      >
        {/* Kutlama kartı */}
        <Card className="flex-row items-center gap-space-md bg-brand-soft p-space-md">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-brand">
            <MaterialIcons name="workspace-premium" size={28} color="#fff" />
          </View>
          <View className="shrink gap-space-xs">
            <Text variant="headline-md">{tr.summary.greatJob}</Text>
            <Text variant="body-md" className="text-ink-secondary">
              {session.route_title
                ? tr.summary.completedRoute(session.route_title)
                : tr.summary.completedFree}
            </Text>
            <Text variant="label-sm" className="text-ink-secondary">
              {dateText(session.started_at)}
            </Text>
          </View>
        </Card>

        {/* Harita */}
        <View className="h-[240px] overflow-hidden rounded-lg border border-hairline">
          {hasTrack ? (
            <ActivityTrackMap track={summary.track} />
          ) : (
            <View className="flex-1 items-center justify-center bg-surface-container-low">
              <Text variant="body-md" className="text-ink-secondary">
                {tr.summary.noTrack}
              </Text>
            </View>
          )}
          <View className="absolute left-3 top-3 rounded-full bg-white px-3 py-1.5">
            <Text variant="label-sm" className="font-bold">
              {tr.summary.totalDone(km)}
            </Text>
          </View>
        </View>

        {/* İstatistikler */}
        <View className="flex-row gap-space-md">
          <StatTile label={tr.summary.distance} value={km} unit="km" icon="straighten" />
          <StatTile
            label={tr.summary.duration}
            value={formatElapsed(summary.durationSec).replace(/^00:/, '')}
            unit="dk"
            icon="timer"
          />
        </View>
        <View className="flex-row gap-space-md">
          <StatTile
            label={tr.summary.avgPace}
            value={formatPaceClock(summary.avgPaceSecPerKm)}
            unit="/km"
            icon="speed"
          />
          <StatTile
            label={tr.summary.ascent}
            value={`+${summary.ascentM}`}
            unit="m"
            icon="terrain"
          />
        </View>
        <View className="min-h-[72px] flex-row items-center gap-space-md rounded-lg bg-accent-soft p-space-md">
          <View className="h-11 w-11 items-center justify-center rounded-full bg-white">
            <MaterialIcons name="local-fire-department" size={24} color={colors.accent.DEFAULT} />
          </View>
          <View className="flex-1">
            <Text variant="label-sm" className="text-ink-secondary">
              {tr.summary.calories}
            </Text>
            <Text variant="headline-md">
              {summary.kcal}{' '}
              <Text variant="body-md" className="text-ink-secondary">
                kcal
              </Text>
            </Text>
            <Text variant="label-sm" className="text-ink-muted">
              {tr.summary.caloriesNote}
            </Text>
          </View>
          {goal !== null ? (
            <View className="rounded-full bg-white px-3 py-1">
              <Text variant="label-sm" className="font-bold text-accent-deep">
                {tr.summary.goal(goal)}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Başlık ve görünürlük */}
        <Card className="gap-space-md p-space-md">
          <TextField
            label={tr.summary.titleLabel}
            value={title}
            onChangeText={setTitle}
            placeholder={tr.summary.titlePlaceholder}
            maxLength={80}
          />
          <View className="gap-space-sm">
            <Text variant="label-caps" className="text-ink-secondary">
              {tr.summary.visibilityLabel}
            </Text>
            <View className="flex-row flex-wrap gap-space-sm">
              {VISIBILITIES.map((v) => (
                <Chip
                  key={v}
                  label={tr.summary.visibility[v]}
                  selected={visibility === v}
                  onPress={() => setVisibility(v)}
                />
              ))}
            </View>
          </View>
        </Card>

        {/* Fotoğraf (yalnızca rotayla yapılan aktivitede) */}
        {hasRoute ? (
          <Card className="gap-space-md p-space-md">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tr.summary.photosTitle}
              onPress={() => void addPhotos()}
              className="min-h-[56px] flex-row items-center gap-space-md"
            >
              <View className="h-12 w-12 items-center justify-center rounded-md bg-brand-soft">
                <MaterialIcons name="add-a-photo" size={24} color={colors.brand.DEFAULT} />
              </View>
              <View className="flex-1">
                <Text variant="body-lg" className="font-bold">
                  {tr.summary.photosTitle}
                </Text>
                <Text variant="body-md" className="text-ink-secondary" numberOfLines={1}>
                  {tr.summary.photosHint}
                </Text>
              </View>
              <Text variant="label-sm" className="text-ink-secondary">
                {tr.summary.photosCount(photos.length, MAX_PHOTOS)}
              </Text>
            </Pressable>
            {photoError ? (
              <Text variant="label-sm" className="text-error">
                {photoError}
              </Text>
            ) : null}
            {photos.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-space-sm">
                  {photos.map((p, i) => (
                    <View key={p.uri} className="h-24 w-24">
                      <Image source={{ uri: p.uri }} className="h-24 w-24 rounded-md" />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={tr.summary.photosRemove}
                        onPress={() => setPhotos((all) => all.filter((_, j) => j !== i))}
                        hitSlop={8}
                        className="absolute right-1 top-1 h-7 w-7 items-center justify-center rounded-full bg-black/60"
                      >
                        <MaterialIcons name="close" size={16} color="#fff" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : null}
          </Card>
        ) : null}

        {/* Puanlama (yalnızca rotayla yapılan aktivitede) */}
        {hasRoute ? (
          <Card className="gap-space-md p-space-md">
            <View className="flex-row items-center justify-between">
              <HeadlineMd>{tr.summary.rateTitle}</HeadlineMd>
              {rating > 0 ? (
                <Text variant="body-md" className="font-bold text-brand">
                  {tr.summary.rateLabels[rating - 1]}
                </Text>
              ) : null}
            </View>
            <View className="flex-row justify-center gap-space-xs">
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable
                  key={n}
                  accessibilityRole="button"
                  accessibilityLabel={tr.summary.rateStar(n)}
                  accessibilityState={{ selected: rating === n }}
                  onPress={() => setRating(n)}
                  className="h-12 w-12 items-center justify-center"
                >
                  <MaterialIcons
                    name={n <= rating ? 'star' : 'star-border'}
                    size={36}
                    color={n <= rating ? '#F59E0B' : colors.ink.muted}
                  />
                </Pressable>
              ))}
            </View>
            {rating > 0 ? (
              <>
                <Text variant="label-caps" className="text-ink-secondary">
                  {tr.summary.tagsTitle}
                </Text>
                <View className="flex-row flex-wrap gap-space-sm">
                  {REVIEW_TAGS.map(({ label: t }) => (
                    <Chip
                      key={t}
                      label={t}
                      selected={tags.includes(t)}
                      onPress={() =>
                        setTags((all) =>
                          all.includes(t) ? all.filter((x) => x !== t) : [...all, t],
                        )
                      }
                    />
                  ))}
                </View>
                <TextField
                  label={tr.summary.commentPlaceholder}
                  value={comment}
                  onChangeText={setComment}
                  maxLength={500}
                />
              </>
            ) : null}
          </Card>
        ) : null}

        {saveError ? (
          <Text variant="body-md" className="text-center text-error">
            {saveError}
          </Text>
        ) : null}
      </ScrollView>

      {/* Alt çubuk */}
      <View
        className="flex-row gap-space-md border-t border-hairline bg-canvas px-margin pt-space-md"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <Button
          title={tr.summary.share}
          variant="secondary"
          onPress={() => void share()}
          disabled={!hasTrack}
          loading={sharing}
          leading={<MaterialIcons name="ios-share" size={20} color={colors.brand.DEFAULT} />}
          className="flex-1"
        />
        <Button
          title={saving ? tr.summary.saving : tr.summary.save}
          onPress={() => void save()}
          loading={saving}
          leading={<MaterialIcons name="check-circle" size={20} color="#fff" />}
          className="flex-[1.6]"
        />
      </View>

      {/* Paylaşım kartı: ekran dışında çizilir, view-shot ile PNG'ye çevrilir. */}
      {hasTrack ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: -10000, top: 0 }}>
          <ShareCard
            ref={cardRef}
            title={title.trim() || session.route_title || defaultTitle(session)}
            dateText={dateText(session.started_at)}
            track={summary.track}
            stats={shareStats}
          />
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
