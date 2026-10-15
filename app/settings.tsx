import { MaterialIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, HeadlineMd, Text } from '@/components/ui';
import { CourseReminderSection } from '@/components/settings/CourseReminderSection';
import { NotificationSettingsSection } from '@/components/settings/NotificationSettingsSection';
import { usePrivacyZone } from '@/hooks/useProfileQueries';
import { tr } from '@/i18n/tr';
import { signOut } from '@/lib/auth';
import { openLegalUrl, openSupportMail, PRIVACY_URL, SUPPORT_EMAIL, TERMS_URL } from '@/lib/legal';
import { DEFAULT_RUN_PACE_SEC, formatPace, PACE_MAX_SEC, PACE_MIN_SEC } from '@/lib/pace';
import { isMonitoringEnabled, reportError } from '@/lib/monitoring';
import { deleteMyAccount } from '@/lib/profileApi';
import { getSetting, SETTING_VOICE } from '@/lib/trackingDb';
import { trackingEngine } from '@/lib/trackingEngine';
import { useSessionStore } from '@/stores/sessionStore';
import { colors } from '@/theme/tokens';

function SectionTitle({ children }: { children: string }) {
  return (
    <Text variant="label-caps" className="px-space-xs text-ink-secondary">
      {children}
    </Text>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const profile = useSessionStore((s) => s.profile);
  const email = useSessionStore((s) => s.session?.user.email);
  const patchProfile = useSessionStore((s) => s.patchProfile);
  const zone = usePrivacyZone();

  const [pace, setPace] = useState(profile?.default_pace_sec_per_km ?? DEFAULT_RUN_PACE_SEC);
  const [paceError, setPaceError] = useState(false);
  const [voice, setVoice] = useState(true);
  const [isPrivate, setIsPrivate] = useState(profile?.is_private ?? false);
  const [privateError, setPrivateError] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  useEffect(() => {
    let active = true;
    void getSetting(SETTING_VOICE).then((v) => {
      if (active) setVoice(v !== '0');
    });
    return () => {
      active = false;
    };
  }, []);

  const savePace = async (value: number) => {
    setPaceError(false);
    try {
      await patchProfile({ default_pace_sec_per_km: Math.round(value) });
    } catch {
      setPaceError(true);
    }
  };

  const togglePrivate = async (on: boolean) => {
    setIsPrivate(on);
    setPrivateError(false);
    try {
      await patchProfile({ is_private: on });
    } catch {
      setIsPrivate(!on);
      setPrivateError(true);
    }
  };

  const toggleVoice = (on: boolean) => {
    setVoice(on);
    void trackingEngine.setVoiceEnabled(on);
  };

  const confirmSignOut = () =>
    Alert.alert(tr.settings.signOutConfirmTitle, tr.settings.signOutConfirmBody, [
      { text: tr.settings.cancel, style: 'cancel' },
      { text: tr.settings.signOut, onPress: () => void signOut() },
    ]);

  const runDelete = async () => {
    setDeleting(true);
    setDeleteError(false);
    try {
      await deleteMyAccount();
      // Sunucudaki kullanıcı silindi; yerel oturumu da kapat (ağ hatası olsa bile yerel oturum temizlenir).
      await signOut().catch(() => undefined);
    } catch {
      setDeleteError(true);
      setDeleting(false);
    }
  };

  // İki aşamalı onay: geri alınamayan bir işlem.
  const confirmDelete = () =>
    Alert.alert(tr.settings.deleteTitle, tr.settings.deleteBody, [
      { text: tr.settings.cancel, style: 'cancel' },
      {
        text: tr.settings.deleteAccount,
        style: 'destructive',
        onPress: () =>
          Alert.alert(tr.settings.deleteConfirmTitle, tr.settings.deleteConfirmBody, [
            { text: tr.settings.cancel, style: 'cancel' },
            {
              text: tr.settings.deleteConfirm,
              style: 'destructive',
              onPress: () => void runDelete(),
            },
          ]),
      },
    ]);

  return (
    <View className="flex-1 bg-canvas">
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
        {/* Başlığa uzun basmak Sentry'ye test hatası gönderir (yalnızca hata izleme açık derlemelerde). */}
        <Pressable
          onLongPress={() => {
            if (isMonitoringEnabled()) reportError(new Error('Sentry testi'), 'manual-test');
            Alert.alert(
              isMonitoringEnabled() ? tr.settings.monitoringTest : tr.settings.monitoringOff,
            );
          }}
          delayLongPress={1500}
          accessible={false}
        >
          <HeadlineMd>{tr.settings.title}</HeadlineMd>
        </Pressable>
        <View className="h-11 w-11" />
      </View>

      <ScrollView contentContainerClassName="gap-space-md px-margin pb-space-xl">
        <SectionTitle>{tr.settings.sectionTraining}</SectionTitle>
        <Card className="gap-space-sm p-space-md">
          <View className="flex-row items-center justify-between">
            <Text variant="body-lg" className="font-bold">
              {tr.settings.pace}
            </Text>
            <Text variant="headline-sm" className="text-brand">
              {formatPace(pace)} {tr.settings.paceUnit}
            </Text>
          </View>
          <Slider
            minimumValue={PACE_MIN_SEC}
            maximumValue={PACE_MAX_SEC}
            step={5}
            value={pace}
            onValueChange={setPace}
            onSlidingComplete={(v) => void savePace(v)}
            minimumTrackTintColor={colors.brand.DEFAULT}
            maximumTrackTintColor={colors.hairline}
            thumbTintColor={colors.brand.DEFAULT}
            accessibilityLabel={tr.settings.pace}
          />
          <Text variant="label-sm" className="text-ink-secondary">
            {paceError ? tr.settings.paceSaveError : tr.settings.paceHint}
          </Text>
        </Card>
        <Card className="flex-row items-center gap-space-md p-space-md">
          <View className="flex-1">
            <Text variant="body-lg" className="font-bold">
              {tr.settings.voice}
            </Text>
            <Text variant="label-sm" className="text-ink-secondary">
              {tr.settings.voiceHint}
            </Text>
          </View>
          <Switch
            value={voice}
            onValueChange={toggleVoice}
            trackColor={{ true: colors.brand.DEFAULT, false: colors.hairline }}
            accessibilityLabel={tr.settings.voice}
          />
        </Card>

        <NotificationSettingsSection />

        <CourseReminderSection />

        <SectionTitle>{tr.settings.sectionPrivacy}</SectionTitle>
        <Card className="flex-row items-center gap-space-md p-space-md">
          <View className="flex-1">
            <Text variant="body-lg" className="font-bold">
              {tr.userProfile.privateAccount}
            </Text>
            <Text variant="label-sm" className="text-ink-secondary">
              {privateError
                ? tr.userProfile.privateAccountError
                : tr.userProfile.privateAccountHint}
            </Text>
          </View>
          <Switch
            value={isPrivate}
            onValueChange={(on) => void togglePrivate(on)}
            trackColor={{ true: colors.brand.DEFAULT, false: colors.hairline }}
            accessibilityLabel={tr.userProfile.privateAccount}
          />
        </Card>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr.settings.privacyZone}
          onPress={() => router.push('/privacy-zone')}
        >
          <Card className="flex-row items-center gap-space-md p-space-md">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-brand-soft">
              <MaterialIcons name="shield" size={22} color={colors.brand.DEFAULT} />
            </View>
            <View className="flex-1">
              <Text variant="body-lg" className="font-bold">
                {tr.settings.privacyZone}
              </Text>
              <Text variant="label-sm" className="text-ink-secondary">
                {zone.isPending
                  ? tr.common.loading
                  : zone.data
                    ? tr.settings.privacyZoneOn(zone.data.radius_m)
                    : tr.settings.privacyZoneOff}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={colors.ink.muted} />
          </Card>
        </Pressable>
        <Text variant="label-sm" className="px-space-xs text-ink-secondary">
          {tr.settings.privacyZoneHint}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr.blockedUsers.settingsRow}
          onPress={() => router.push('/blocked-users')}
        >
          <Card className="flex-row items-center gap-space-md p-space-md">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-surface-container">
              <MaterialIcons name="block" size={22} color={colors.ink.secondary} />
            </View>
            <View className="flex-1">
              <Text variant="body-lg" className="font-bold">
                {tr.blockedUsers.settingsRow}
              </Text>
              <Text variant="label-sm" className="text-ink-secondary">
                {tr.blockedUsers.settingsHint}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={colors.ink.muted} />
          </Card>
        </Pressable>

        <SectionTitle>{tr.settings.sectionAbout}</SectionTitle>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={tr.settings.terms}
          onPress={() => openLegalUrl(TERMS_URL)}
          className="min-h-[48px] justify-center px-space-xs"
        >
          <Text variant="body-lg" className="font-bold text-brand">
            {tr.settings.terms}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={tr.settings.privacyPolicy}
          onPress={() => openLegalUrl(PRIVACY_URL)}
          className="min-h-[48px] justify-center px-space-xs"
        >
          <Text variant="body-lg" className="font-bold text-brand">
            {tr.settings.privacyPolicy}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={tr.settings.support}
          onPress={openSupportMail}
          className="min-h-[48px] justify-center px-space-xs"
        >
          <Text variant="body-lg" className="font-bold text-brand">
            {tr.settings.support}
          </Text>
          <Text variant="label-sm" className="text-ink-secondary">
            {SUPPORT_EMAIL}
          </Text>
        </Pressable>

        <SectionTitle>{tr.settings.sectionAccount}</SectionTitle>
        {email ? (
          <Text variant="body-md" className="px-space-xs text-ink-secondary">
            {email}
          </Text>
        ) : null}
        <Button
          title={tr.settings.signOut}
          variant="secondary"
          leading={<MaterialIcons name="logout" size={20} color={colors.brand.DEFAULT} />}
          onPress={confirmSignOut}
          disabled={deleting}
        />

        <View className="mt-space-md gap-space-sm rounded-lg border border-error-container bg-error-container/30 p-space-md">
          <Text variant="body-lg" className="font-bold text-error">
            {tr.settings.deleteAccount}
          </Text>
          <Text variant="label-sm" className="text-ink-secondary">
            {tr.settings.deleteHint}
          </Text>
          {deleteError ? (
            <Text variant="label-sm" className="font-bold text-error">
              {tr.settings.deleteError}
            </Text>
          ) : null}
          {deleting ? (
            <View className="flex-row items-center gap-space-sm py-space-sm">
              <ActivityIndicator color={colors.error} />
              <Text variant="body-md" className="text-error">
                {tr.settings.deleting}
              </Text>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tr.settings.deleteAccount}
              onPress={confirmDelete}
              className="min-h-[48px] items-center justify-center rounded-full border border-error bg-white"
            >
              <Text variant="body-lg" className="font-bold text-error">
                {tr.settings.deleteAccount}
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
