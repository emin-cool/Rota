import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, HeadlineLg, Text } from '@/components/ui';
import { tr } from '@/i18n/tr';
import { colors } from '@/theme/tokens';

export const WIZARD_STEPS = 6;

type Props = {
  step: number;
  /** Rozetteki kısa bölüm adı (örn. "BAŞLANGIÇ"). */
  badge: string;
  heading: string;
  subtitle?: string;
  /** Rozetin sağındaki küçük ipucu ("Çoklu Seçim" gibi). */
  badgeRight?: string;
  children: ReactNode;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  /** İkincil buton yerine özel alt içerik (örn. turuncu "Rotaları Oluştur"). */
  footerTop?: ReactNode;
  /** false: içerik kaydırılmaz, ekranın tamamını kaplar (harita adımı). */
  scroll?: boolean;
  /** true: "Devam Et" butonu gösterilmez (son adımda özel buton `footerTop` ile verilir). */
  hideNext?: boolean;
};

/** Sihirbaz adımlarının ortak çerçevesi: üst bar, ilerleme çubuğu, başlık, alt butonlar. */
export function WizardScaffold({
  step,
  badge,
  heading,
  subtitle,
  badgeRight,
  children,
  onNext,
  nextLabel = tr.wizard.next,
  nextDisabled,
  footerTop,
  scroll = true,
  hideNext = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const progress = step / WIZARD_STEPS;

  const header = (
    <View className="gap-space-md px-margin pb-space-sm pt-space-sm">
      <View className="flex-row items-center gap-space-sm">
        <View className="rounded-full bg-primary-fixed px-3 py-1">
          <Text variant="label-caps" className="text-on-primary-fixed-variant">
            {tr.wizard.stepBadge(step, WIZARD_STEPS)} • {badge}
          </Text>
        </View>
        <View className="flex-1" />
        {badgeRight ? (
          <Text variant="label-sm" className="font-bold text-brand">
            {badgeRight}
          </Text>
        ) : null}
      </View>
      <View className="gap-space-xs">
        <HeadlineLg>{heading}</HeadlineLg>
        {subtitle ? (
          <Text variant="body-lg" className="text-ink-secondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      {/* Üst bar */}
      <View className="h-14 flex-row items-center px-space-sm">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr.wizard.back}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          className="h-11 w-11 items-center justify-center rounded-full"
        >
          <MaterialIcons name="arrow-back-ios-new" size={20} color={colors.ink.DEFAULT} />
        </Pressable>
        <Text variant="headline-sm" className="flex-1 text-center" accessibilityRole="header">
          {tr.wizard.stepTitles[step - 1]}
        </Text>
        <View className="h-11 w-11" />
      </View>

      {/* İlerleme çubuğu */}
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: WIZARD_STEPS, now: step }}
        className="mx-margin h-1.5 overflow-hidden rounded-full bg-surface-container-high"
      >
        <View className="h-full rounded-full bg-brand" style={{ width: `${progress * 100}%` }} />
      </View>

      {scroll ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {header}
          <View className="gap-space-lg px-margin pt-space-sm">{children}</View>
        </ScrollView>
      ) : (
        <View className="flex-1">
          {header}
          <View className="flex-1">{children}</View>
        </View>
      )}

      {/* Alt bar */}
      <View
        className="gap-space-sm border-t border-hairline bg-canvas px-margin pt-space-md"
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        {footerTop}
        <View className="flex-row items-center gap-space-md">
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/')}
            className={`h-12 min-w-[72px] items-center justify-center ${hideNext ? 'flex-1' : ''}`}
          >
            <Text variant="body-md-medium" className="font-bold text-brand">
              {tr.wizard.cancel}
            </Text>
          </Pressable>
          {hideNext ? null : (
            <Button
              title={nextLabel}
              className="flex-1"
              disabled={nextDisabled}
              leading={
                <MaterialIcons name="arrow-forward" size={20} color={colors['on-primary']} />
              }
              onPress={onNext}
            />
          )}
        </View>
      </View>
    </View>
  );
}
