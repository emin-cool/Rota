import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { useBlockOp } from '@/hooks/useSocialQueries';
import { tr } from '@/i18n/tr';
import { REPORT_REASONS, reportErrorKey } from '@/lib/moderation';
import { reportContent } from '@/lib/socialApi';
import { useModerationStore } from '@/stores/moderationStore';
import { colors } from '@/theme/tokens';
import type { ReportReason } from '@/types/database';

type Step = 'menu' | 'reason';

/**
 * Bildir / engelle menüsü. Kökte bir kez çizilir; ekranlar `useModerationStore.getState().open(...)` ile açar.
 * Akış: menü (Bildir | Engelle) → bildir seçilirse sebep listesi (+ isteğe bağlı açıklama) → gönder.
 */
export function ModerationSheet() {
  const insets = useSafeAreaInsets();
  const target = useModerationStore((s) => s.target);
  const close = useModerationStore((s) => s.close);
  const blockOp = useBlockOp();

  const [step, setStep] = useState<Step>('menu');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep('menu');
    setReason(null);
    setDetails('');
    setError(null);
    setSending(false);
  };
  const dismiss = () => {
    close();
    reset();
  };

  if (!target) return null;

  const confirmBlock = () =>
    Alert.alert(tr.moderation.blockTitle(target.ownerName), tr.moderation.blockBody, [
      { text: tr.moderation.cancel, style: 'cancel' },
      {
        text: tr.moderation.blockConfirm,
        style: 'destructive',
        onPress: () =>
          blockOp.mutate(
            { op: 'block', targetId: target.ownerId },
            {
              onSuccess: () => {
                Alert.alert(tr.moderation.blocked(target.ownerName));
                dismiss();
              },
              onError: () => Alert.alert(tr.moderation.blockError),
            },
          ),
      },
    ]);

  const send = async () => {
    if (!reason) return;
    setSending(true);
    setError(null);
    try {
      await reportContent(target.type, target.targetId, reason, details);
      const name = target.ownerName;
      dismiss();
      Alert.alert(tr.moderation.sentTitle, tr.moderation.sentBody, [
        { text: tr.common.close, style: 'cancel' },
        {
          text: tr.moderation.block(name),
          style: 'destructive',
          onPress: () =>
            blockOp.mutate(
              { op: 'block', targetId: target.ownerId },
              { onError: () => Alert.alert(tr.moderation.blockError) },
            ),
        },
      ]);
    } catch (e) {
      setError(tr.moderation.errors[reportErrorKey((e as { message?: string } | null)?.message)]);
      setSending(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={dismiss} statusBarTranslucent>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr.moderation.cancel}
        onPress={dismiss}
        className="flex-1 bg-black/40"
      />
      <View
        className="rounded-t-xl bg-surface-container-lowest px-margin pt-space-md"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <View className="mb-space-md h-1 w-10 self-center rounded-full bg-hairline" />

        {step === 'menu' ? (
          <View className="gap-space-sm">
            <Text variant="headline-sm" className="pb-space-xs" numberOfLines={1}>
              {tr.moderation.menuTitle(target.ownerName)}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tr.moderation.report}
              onPress={() => setStep('reason')}
              className="min-h-[52px] flex-row items-center gap-space-md rounded-lg bg-surface-container px-space-md"
            >
              <MaterialIcons name="flag" size={22} color={colors.ink.DEFAULT} />
              <Text variant="body-lg" className="font-bold">
                {tr.moderation.report}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tr.moderation.block(target.ownerName)}
              onPress={confirmBlock}
              className="min-h-[52px] flex-row items-center gap-space-md rounded-lg bg-surface-container px-space-md"
            >
              <MaterialIcons name="block" size={22} color={colors.error} />
              <Text variant="body-lg" className="font-bold text-error" numberOfLines={1}>
                {tr.moderation.block(target.ownerName)}
              </Text>
            </Pressable>
            <Button title={tr.moderation.cancel} variant="ghost" onPress={dismiss} />
          </View>
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled" className="max-h-[520px]">
            <View className="gap-space-sm pb-space-md">
              <Text variant="headline-sm">{tr.moderation.reportTitle}</Text>
              <Text variant="body-md" className="text-ink-secondary">
                {tr.moderation.reportHint}
              </Text>
              {REPORT_REASONS.map((r) => {
                const on = reason === r;
                return (
                  <Pressable
                    key={r}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    onPress={() => setReason(r)}
                    className={`min-h-[48px] flex-row items-center gap-space-md rounded-lg px-space-md ${
                      on ? 'bg-primary-fixed' : 'bg-surface-container'
                    }`}
                  >
                    <MaterialIcons
                      name={on ? 'radio-button-checked' : 'radio-button-unchecked'}
                      size={22}
                      color={on ? colors.brand.DEFAULT : colors.ink.secondary}
                    />
                    <Text
                      variant="body-md"
                      className={on ? 'flex-1 font-bold text-brand' : 'flex-1'}
                    >
                      {tr.moderation.reasons[r]}
                    </Text>
                  </Pressable>
                );
              })}
              <TextInput
                value={details}
                onChangeText={setDetails}
                placeholder={tr.moderation.detailsPlaceholder}
                placeholderTextColor={colors.ink.muted}
                accessibilityLabel={tr.moderation.detailsPlaceholder}
                maxLength={500}
                multiline
                textAlignVertical="top"
                className="min-h-[72px] rounded-lg border border-hairline bg-surface-container-lowest p-space-md font-regular text-body-md text-ink"
              />
              {error ? (
                <Text variant="body-md" className="text-error">
                  {error}
                </Text>
              ) : null}
              <Button
                title={sending ? tr.moderation.sending : tr.moderation.send}
                loading={sending}
                disabled={!reason}
                onPress={() => void send()}
              />
              <Button title={tr.moderation.cancel} variant="ghost" onPress={dismiss} />
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

/** "⋯" düğmesi: bildir / engelle menüsünü açar. */
export function MoreButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      className="h-11 w-11 items-center justify-center rounded-full"
    >
      <MaterialIcons name="more-horiz" size={24} color={colors.ink.secondary} />
    </Pressable>
  );
}
