import { MaterialIcons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, HeadlineMd, Skeleton, Text } from '@/components/ui';
import { useRouteDetail } from '@/hooks/useRouteQueries';
import { tr } from '@/i18n/tr';
import { MAX_PHOTOS, saveReview, uploadRoutePhoto } from '@/lib/activityUpload';
import { fetchMyLatestActivity, fetchMyPhotoCount, fetchMyReview } from '@/lib/exploreApi';
import { formatDistance } from '@/lib/geo';
import { MAX_COMMENT, REVIEW_TAGS } from '@/lib/reviewTags';
import { useSessionStore } from '@/stores/sessionStore';
import { colors } from '@/theme/tokens';

function whenText(iso: string): string {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString()
    ? 'Bugün'
    : d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
}

type FormProps = {
  routeId: string;
  userId: string;
  initial: { rating: number; comment: string; tags: string[] } | null;
  existingPhotos: number;
};

function ReviewForm({ routeId, userId, initial, existingPhotos }: FormProps) {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [comment, setComment] = useState(initial?.comment ?? '');
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const room = MAX_PHOTOS - existingPhotos - photos.length;

  const addPhotos = async () => {
    setPhotoError(null);
    if (room <= 0) return;
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: room,
      });
      if (res.canceled) return;
      // Yeniden kodlama EXIF (konum) bilgisini siler ve yüklemeyi küçültür.
      const out: string[] = [];
      for (const a of res.assets.slice(0, room)) {
        const m = await ImageManipulator.manipulateAsync(
          a.uri,
          a.width > 1600 ? [{ resize: { width: 1600 } }] : [],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
        );
        out.push(m.uri);
      }
      setPhotos((p) => [...p, ...out]);
    } catch {
      setPhotoError(tr.review.photosError);
    }
  };

  const submit = async () => {
    if (rating < 1) {
      setError(tr.review.needRating);
      return;
    }
    setSending(true);
    setError(null);
    try {
      await saveReview(userId, routeId, { rating, tags, comment });
      for (let i = 0; i < photos.length; i++) {
        const body = await (await fetch(photos[i]!)).arrayBuffer();
        await uploadRoutePhoto(userId, routeId, `review-${Date.now()}-${i}.jpg`, body);
      }
      await Promise.all(
        [
          ['route-reviews', routeId],
          ['route-rating', routeId],
          ['route-detail', routeId],
          ['explore'],
          ['featured'],
        ].map((queryKey) => qc.invalidateQueries({ queryKey })),
      );
      Alert.alert(tr.review.sent);
      router.back();
    } catch {
      setError(tr.review.sendError);
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerClassName="gap-space-lg px-margin pb-space-lg"
        keyboardShouldPersistTaps="handled"
      >
        {/* Puan */}
        <View className="items-center gap-space-md rounded-lg border border-hairline bg-surface-container-lowest p-space-lg">
          <HeadlineMd className="text-center">{tr.review.question}</HeadlineMd>
          <Text variant="body-md" className="text-center text-ink-secondary">
            {tr.review.questionHint}
          </Text>
          <View className="flex-row gap-space-xs">
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
                  size={38}
                  color={n <= rating ? '#F59E0B' : colors.ink.muted}
                />
              </Pressable>
            ))}
          </View>
          {rating > 0 ? (
            <View className="rounded-full bg-accent-soft px-4 py-1.5">
              <Text variant="body-md" className="font-bold text-accent-deep">
                {tr.review.ratingWord[rating - 1]}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Etiketler */}
        <View className="gap-space-sm">
          <View className="flex-row items-center justify-between">
            <HeadlineMd>{tr.review.tagsTitle}</HeadlineMd>
            <Text variant="label-sm" className="text-ink-secondary">
              {tr.review.tagsMulti}
            </Text>
          </View>
          <Text variant="body-md" className="text-ink-secondary">
            {tr.review.tagsHint}
          </Text>
          <View className="flex-row flex-wrap gap-space-sm">
            {REVIEW_TAGS.map((t) => {
              const on = tags.includes(t.label);
              return (
                <Pressable
                  key={t.label}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  onPress={() =>
                    setTags((all) => (on ? all.filter((x) => x !== t.label) : [...all, t.label]))
                  }
                  className={`min-h-[48px] w-[48%] flex-row items-center gap-space-sm rounded-md px-space-md ${
                    on ? 'bg-primary-fixed' : 'bg-surface-container'
                  }`}
                >
                  <MaterialIcons
                    name={t.icon}
                    size={20}
                    color={on ? colors.brand.DEFAULT : colors.ink.secondary}
                  />
                  <Text
                    variant="body-md-medium"
                    className={`flex-1 ${on ? 'font-bold text-brand' : 'text-ink'}`}
                    numberOfLines={2}
                  >
                    {t.label}
                  </Text>
                  {on ? (
                    <MaterialIcons name="check" size={18} color={colors.brand.DEFAULT} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Metin */}
        <View className="gap-space-sm">
          <View className="flex-row items-center justify-between">
            <HeadlineMd>{tr.review.storyTitle}</HeadlineMd>
            <Text variant="label-sm" className="text-ink-secondary">
              {comment.length} / {MAX_COMMENT}
            </Text>
          </View>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder={tr.review.storyPlaceholder}
            placeholderTextColor={colors.ink.muted}
            accessibilityLabel={tr.review.storyTitle}
            multiline
            maxLength={MAX_COMMENT}
            textAlignVertical="top"
            className="min-h-[120px] rounded-lg border border-hairline bg-surface-container-lowest p-space-md font-regular text-body-md text-ink"
          />
        </View>

        {/* Fotoğraf */}
        <View className="gap-space-sm">
          <View className="flex-row items-center justify-between">
            <HeadlineMd>{tr.review.photosTitle}</HeadlineMd>
            <Text variant="label-sm" className="text-ink-secondary">
              {tr.review.photosCount(existingPhotos + photos.length, MAX_PHOTOS)}
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-space-sm">
              {room > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={tr.review.photosTitle}
                  onPress={() => void addPhotos()}
                  className="h-28 w-28 items-center justify-center gap-1 rounded-lg bg-brand-soft"
                >
                  <MaterialIcons name="add-a-photo" size={26} color={colors.brand.DEFAULT} />
                  <Text variant="label-sm" className="text-center font-bold text-ink-secondary">
                    {tr.review.photosAdd}
                  </Text>
                </Pressable>
              ) : null}
              {photos.map((uri, i) => (
                <View key={uri} className="h-28 w-28">
                  <Image source={{ uri }} className="h-28 w-28 rounded-lg" />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={tr.review.photosRemove}
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
          {photoError ? (
            <Text variant="label-sm" className="text-error">
              {photoError}
            </Text>
          ) : null}
        </View>

        {error ? (
          <Text variant="body-md" className="text-center text-error">
            {error}
          </Text>
        ) : null}
        <Text variant="label-sm" className="text-center text-ink-secondary">
          {tr.review.guidelines}
        </Text>
      </ScrollView>

      <View
        className="border-t border-hairline bg-canvas px-margin pt-space-md"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <Button
          title={sending ? tr.review.submitting : initial ? tr.review.update : tr.review.submit}
          loading={sending}
          leading={<MaterialIcons name="send" size={20} color="#fff" />}
          onPress={() => void submit()}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

export default function RouteReviewScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useSessionStore((s) => s.session?.user.id);
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const detail = useRouteDetail(id);
  const activity = useQuery({
    queryKey: ['my-activity', id, userId],
    enabled: !!id && !!userId,
    queryFn: () => fetchMyLatestActivity(userId!, id!),
  });
  const mine = useQuery({
    queryKey: ['my-review', id, userId],
    enabled: !!id && !!userId,
    // Yorum yazıldıktan sonra tekrar açılırsa güncel kayıt görünsün.
    gcTime: 0,
    queryFn: async () => ({
      review: await fetchMyReview(userId!, id!),
      photos: await fetchMyPhotoCount(userId!, id!),
    }),
  });

  const loading = detail.isPending || activity.isPending || mine.isPending;
  const failed = detail.isError || activity.isError || mine.isError;
  const route = detail.data;

  const header = (
    <View
      className="flex-row items-center justify-between px-space-sm pb-space-sm"
      style={{ paddingTop: insets.top + 4 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr.common.back}
        onPress={goBack}
        hitSlop={8}
        className="h-11 w-11 items-center justify-center"
      >
        <MaterialIcons name="arrow-back-ios-new" size={20} color={colors.ink.DEFAULT} />
      </Pressable>
      <HeadlineMd>{tr.review.title}</HeadlineMd>
      <View className="h-11 w-11" />
    </View>
  );

  if (loading) {
    return (
      <View className="flex-1 bg-canvas">
        {header}
        <View className="gap-space-md px-margin">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
        </View>
      </View>
    );
  }

  if (failed || !route || !userId) {
    return (
      <View className="flex-1 bg-canvas">
        {header}
        <View className="items-center gap-space-md px-margin py-space-xl">
          <MaterialIcons name="cloud-off" size={40} color={colors.ink.muted} />
          <Text variant="body-lg" className="text-center">
            {tr.review.loadError}
          </Text>
          <Button
            title={tr.common.retry}
            variant="secondary"
            onPress={() => {
              void detail.refetch();
              void activity.refetch();
              void mine.refetch();
            }}
          />
        </View>
      </View>
    );
  }

  // Rotayı tamamlamamış kullanıcı yorum yazamaz (veritabanı politikası da bunu zorlar).
  if (!activity.data) {
    return (
      <View className="flex-1 bg-canvas">
        {header}
        <View className="items-center gap-space-md px-margin py-space-xl">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-brand-soft">
            <MaterialIcons name="lock-outline" size={30} color={colors.brand.DEFAULT} />
          </View>
          <HeadlineMd className="text-center">{tr.review.lockedTitle}</HeadlineMd>
          <Text variant="body-md" className="text-center text-ink-secondary">
            {tr.review.lockedBody}
          </Text>
          <Button title={tr.review.startRoute} onPress={goBack} />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-canvas">
      {header}
      {/* Tamamlanan rota kartı */}
      <View className="mx-margin mb-space-md flex-row items-center gap-space-md rounded-lg bg-surface-container-low p-space-md">
        <View className="h-14 w-14 items-center justify-center rounded-md bg-brand-soft">
          <MaterialIcons name="directions-walk" size={26} color={colors.brand.DEFAULT} />
        </View>
        <View className="flex-1">
          <Text variant="label-caps" className="text-accent-deep">
            {tr.review.completedRoute}
          </Text>
          <Text variant="headline-sm" numberOfLines={1}>
            {route.title}
          </Text>
          <Text variant="label-sm" className="text-ink-secondary">
            {tr.review.completedOn(whenText(activity.data.started_at))} ·{' '}
            {formatDistance(route.distance_m)}
          </Text>
        </View>
      </View>
      <ReviewForm
        routeId={route.id}
        userId={userId}
        initial={
          mine.data.review
            ? {
                rating: mine.data.review.rating,
                comment: mine.data.review.comment ?? '',
                tags: mine.data.review.tags,
              }
            : null
        }
        existingPhotos={mine.data.photos}
      />
    </View>
  );
}
