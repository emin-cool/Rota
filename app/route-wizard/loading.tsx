import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, HeadlineMd, Text } from '@/components/ui';
import { tr } from '@/i18n/tr';
import { GenerateRoutesError, generateRoutes } from '@/lib/routes';
import { buildGenerateInput, relaxSuggestions } from '@/lib/wizard';
import { useResultsStore } from '@/stores/resultsStore';
import { selectAnswers, useWizardStore } from '@/stores/wizardStore';
import { colors } from '@/theme/tokens';

const TIP_INTERVAL_MS = 3200;

type Failure = { code: string; message: string };

export default function WizardLoading() {
  const insets = useSafeAreaInsets();
  const copy = tr.wizard.loading;
  const errCopy = tr.wizard.errors;
  const patch = useWizardStore((s) => s.patch);
  const setResults = useResultsStore((s) => s.setResults);

  const [failure, setFailure] = useState<Failure | null>(null);
  const [tip, setTip] = useState(0);
  // Eski (iptal edilmiş / önceki) isteklerin sonucu ekranı bozmasın.
  const runId = useRef(0);

  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.18, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  useEffect(() => {
    if (failure) return;
    const t = setInterval(() => setTip((i) => (i + 1) % copy.tips.length), TIP_INTERVAL_MS);
    return () => clearInterval(t);
  }, [failure, copy.tips.length]);

  const run = useCallback(async () => {
    const id = ++runId.current;
    setFailure(null);
    const answers = selectAnswers(useWizardStore.getState());
    const input = buildGenerateInput(answers, null);
    if (!input) {
      setFailure({ code: 'invalid_input', message: tr.wizard.step6.needStart });
      return;
    }
    try {
      const res = await generateRoutes(input);
      if (id !== runId.current) return;
      setResults({
        input,
        startName: answers.startLabel,
        routes: res.routes,
        warnings: res.warnings,
      });
      router.replace('/route-results');
    } catch (e) {
      if (id !== runId.current) return;
      if (e instanceof GenerateRoutesError) setFailure({ code: e.code, message: e.message });
      else setFailure({ code: 'internal', message: tr.routes.errors.generic });
    }
  }, [setResults]);

  useEffect(() => {
    // Ekran açılınca isteği başlatmak (veri çekme) bilinçli bir etkidir.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void run();
    return () => {
      // Ekrandan çıkınca sürmekte olan isteğin sonucunu yok say.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      runId.current++;
    };
  }, [run]);

  if (failure) {
    const suggestions = relaxSuggestions(selectAnswers(useWizardStore.getState()));
    const noRoutes = failure.code === 'no_routes';
    return (
      <View
        className="flex-1 justify-center gap-space-md bg-canvas px-margin"
        style={{ paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }}
      >
        <View className="items-center gap-space-sm">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-accent-soft">
            <MaterialIcons
              name={noRoutes ? 'search-off' : 'error-outline'}
              size={40}
              color={colors.accent.deep}
            />
          </View>
          <HeadlineMd className="text-center">
            {noRoutes ? errCopy.noRoutesTitle : errCopy.genericTitle}
          </HeadlineMd>
          <Text variant="body-lg" className="text-center text-ink-secondary">
            {failure.message || (noRoutes ? errCopy.noRoutesBody : tr.routes.errors.generic)}
          </Text>
        </View>

        {suggestions.length > 0 ? (
          <View className="gap-space-sm">
            <Text variant="label-caps" className="text-ink-secondary">
              {errCopy.suggestionsTitle.toUpperCase()}
            </Text>
            {suggestions.map((s) => (
              <Button
                key={s.id}
                title={s.label}
                variant="secondary"
                onPress={() => {
                  patch(s.patch);
                  void run();
                }}
              />
            ))}
          </View>
        ) : null}

        <View className="gap-space-sm pt-space-sm">
          <Button title={errCopy.retry} onPress={() => void run()} />
          <Button
            title={errCopy.editAnswers}
            variant="ghost"
            onPress={() => router.replace('/route-wizard/step-6')}
          />
        </View>
      </View>
    );
  }

  return (
    <View
      className="flex-1 items-center justify-center gap-space-lg bg-canvas px-margin"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      accessibilityLabel={copy.title}
    >
      <View className="h-40 w-40 items-center justify-center">
        <Animated.View
          style={pulseStyle}
          className="absolute h-40 w-40 rounded-full bg-primary-fixed opacity-60"
        />
        <View className="h-24 w-24 items-center justify-center rounded-full bg-brand">
          <MaterialIcons name="route" size={48} color="#ffffff" />
        </View>
      </View>
      <View className="items-center gap-space-xs">
        <HeadlineMd className="text-center">{copy.title}</HeadlineMd>
        <Text variant="body-md" className="text-center text-ink-secondary">
          {copy.subtitle}
        </Text>
      </View>
      <View className="min-h-[72px] w-full justify-center rounded-lg bg-surface-container p-space-md">
        <Animated.View key={tip} entering={FadeIn.duration(350)} exiting={FadeOut.duration(200)}>
          <View className="flex-row items-start gap-space-sm">
            <MaterialIcons name="lightbulb-outline" size={20} color={colors.accent.DEFAULT} />
            <Text variant="body-md" className="flex-1">
              {copy.tips[tip]}
            </Text>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}
