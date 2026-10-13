import { MaterialIcons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Button, Chip, HeadlineMd, Text, TextField } from '@/components/ui';
import { tr } from '@/i18n/tr';
import { uploadAvatar } from '@/lib/profileApi';
import { isValidDisplayName, isValidUsername, normalizeUsername } from '@/lib/profileStats';
import { useSessionStore } from '@/stores/sessionStore';
import { colors } from '@/theme/tokens';
import type { Level } from '@/types/database';

const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced'];
const PG_UNIQUE_VIOLATION = '23505';

export default function ProfileEditScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const profile = useSessionStore((s) => s.profile);
  const userId = useSessionStore((s) => s.session?.user.id);
  const patchProfile = useSessionStore((s) => s.patchProfile);

  const [name, setName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [level, setLevel] = useState<Level | null>(profile?.level ?? null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameOk = isValidDisplayName(name);
  const usernameOk = isValidUsername(username);
  const showNameError = name.length > 0 && !nameOk;
  const showUsernameError = username.length > 0 && !usernameOk;

  const pickPhoto = async () => {
    setPhotoError(null);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        selectionLimit: 1,
      });
      if (res.canceled || !res.assets[0]) return;
      // 400 px kare + JPEG: avatar küçük kalsın; yeniden kodlama EXIF konumunu da siler.
      const m = await ImageManipulator.manipulateAsync(
        res.assets[0].uri,
        [{ resize: { width: 400, height: 400 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
      );
      setPhotoUri(m.uri);
    } catch {
      setPhotoError(tr.profileEdit.photoError);
    }
  };

  const save = async () => {
    if (!userId || !nameOk || !usernameOk || saving) return;
    setSaving(true);
    setError(null);
    try {
      const avatarUrl = photoUri ? await uploadAvatar(userId, photoUri) : undefined;
      await patchProfile({
        display_name: name.trim(),
        username: normalizeUsername(username),
        level,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      });
      await qc.invalidateQueries({ queryKey: ['route-reviews'] });
      Alert.alert(tr.profileEdit.saved);
      router.back();
    } catch (e) {
      const code = (e as { code?: string } | null)?.code;
      setError(
        code === PG_UNIQUE_VIOLATION ? tr.profileEdit.usernameTaken : tr.profileEdit.saveError,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-canvas"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        className="flex-row items-center justify-between px-space-sm pb-space-sm"
        style={{ paddingTop: insets.top + 4 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr.common.back}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          hitSlop={8}
          className="h-11 w-11 items-center justify-center"
        >
          <MaterialIcons name="arrow-back-ios-new" size={20} color={colors.ink.DEFAULT} />
        </Pressable>
        <HeadlineMd>{tr.profileEdit.title}</HeadlineMd>
        <View className="h-11 w-11" />
      </View>

      <ScrollView
        contentContainerClassName="gap-space-lg px-margin pb-space-lg"
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center gap-space-sm">
          <Avatar
            name={name || profile?.username || null}
            uri={photoUri ?? profile?.avatar_url}
            size={96}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr.profileEdit.changePhoto}
            onPress={() => void pickPhoto()}
            className="min-h-[44px] flex-row items-center gap-space-sm rounded-full bg-brand-soft px-space-md"
          >
            <MaterialIcons name="photo-camera" size={18} color={colors.brand.DEFAULT} />
            <Text variant="body-md-medium" className="font-bold text-brand">
              {tr.profileEdit.changePhoto}
            </Text>
          </Pressable>
          {photoError ? (
            <Text variant="label-sm" className="text-error">
              {photoError}
            </Text>
          ) : null}
        </View>

        <TextField
          label={tr.profileEdit.nameLabel}
          value={name}
          onChangeText={setName}
          placeholder={tr.profileEdit.namePlaceholder}
          maxLength={40}
          error={showNameError ? tr.profileEdit.nameError : null}
        />
        <View className="gap-space-xs">
          <TextField
            label={tr.profileEdit.usernameLabel}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={31}
            error={showUsernameError ? tr.profileEdit.usernameError : null}
          />
          <Text variant="label-sm" className="text-ink-secondary">
            {tr.profileEdit.usernameHint}
          </Text>
        </View>

        <View className="gap-space-sm">
          <Text variant="label-caps" className="text-ink-secondary">
            {tr.profileEdit.levelLabel}
          </Text>
          <View className="flex-row flex-wrap gap-space-sm">
            {LEVELS.map((l) => (
              <Chip
                key={l}
                label={tr.profile.level[l]}
                selected={level === l}
                onPress={() => setLevel(l)}
              />
            ))}
          </View>
        </View>

        {error ? (
          <Text variant="body-md" className="text-center text-error">
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View
        className="border-t border-hairline bg-canvas px-margin pt-space-md"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <Button
          title={saving ? tr.profileEdit.saving : tr.profileEdit.save}
          loading={saving}
          disabled={!nameOk || !usernameOk}
          onPress={() => void save()}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
