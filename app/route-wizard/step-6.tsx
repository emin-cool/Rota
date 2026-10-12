import { MaterialIcons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { WizardScaffold } from '@/components/wizard/WizardScaffold';
import { tr } from '@/i18n/tr';
import { buildGenerateInput, formatClock, formatKmValue, visibleExtraKeys } from '@/lib/wizard';
import { useWizardAnswers, useWizardStore } from '@/stores/wizardStore';
import { colors } from '@/theme/tokens';

type Row = { label: string; value: string; step: number };

export default function WizardStep6() {
  const a = useWizardAnswers();
  const copy = tr.wizard.step6;
  const input = buildGenerateInput(a, null);

  const goalText =
    a.routeType === 'a_b'
      ? tr.wizard.step1.routeTypes.a_b.subtitle
      : a.goal === 'duration'
        ? formatClock(a.durationMin)
        : `${formatKmValue(a.distanceKm)} km`;

  const sceneryText = a.scenery.map((s) => tr.wizard.step4.scenery[s].title).join(', ');
  const activeExtras = visibleExtraKeys(a.activityType, a.routeType)
    .filter((k) => a.extras[k])
    .map((k) => tr.wizard.step5.toggles[k].title);
  const startText = a.startIsCurrent
    ? `${copy.currentLocation}${a.startLabel ? ` • ${a.startLabel}` : ''}`
    : (a.startLabel ?? copy.selectedPoint);

  const rows: Row[] = [
    { label: copy.rows.activity, value: tr.wizard.step1.activities[a.activityType].title, step: 1 },
    { label: copy.rows.routeType, value: tr.wizard.step1.routeTypes[a.routeType].title, step: 1 },
    { label: copy.rows.start, value: startText, step: 2 },
    ...(a.routeType === 'a_b'
      ? [{ label: copy.rows.end, value: a.endLabel ?? copy.selectedPoint, step: 2 }]
      : []),
    { label: copy.rows.goal, value: goalText, step: 3 },
    { label: copy.rows.scenery, value: sceneryText, step: 4 },
    { label: copy.rows.slope, value: tr.wizard.step4.slopes[a.slope].title, step: 4 },
    {
      label: copy.rows.extras,
      value: activeExtras.length > 0 ? activeExtras.join(', ') : copy.none,
      step: 5,
    },
    { label: copy.rows.surface, value: tr.wizard.step5.surface[a.extras.surface].title, step: 5 },
  ];

  return (
    <WizardScaffold
      step={6}
      badge={copy.badge}
      heading={copy.title}
      subtitle={copy.subtitle}
      onNext={() => router.push('/route-wizard/loading')}
      nextDisabled={!input}
      hideNext
      footerTop={
        <View className="gap-space-sm">
          <Button
            title={copy.create}
            variant="accent"
            disabled={!input}
            leading={<MaterialIcons name="auto-awesome" size={20} color="#ffffff" />}
            onPress={() => router.push('/route-wizard/loading')}
          />
          <Text variant="label-sm" className="text-center text-ink-secondary">
            {input ? copy.createHint : copy.needStart}
          </Text>
        </View>
      }
    >
      <Card className="overflow-hidden">
        {rows.map((r, i) => (
          <Pressable
            key={r.label}
            accessibilityRole="button"
            accessibilityLabel={`${r.label}: ${r.value}`}
            onPress={() => router.push(`/route-wizard/step-${r.step}` as Href)}
            className={`min-h-[56px] flex-row items-center gap-space-md px-space-md py-space-sm ${
              i > 0 ? 'border-t border-hairline' : ''
            }`}
          >
            <Text variant="label-caps" className="w-24 text-ink-secondary">
              {r.label.toUpperCase()}
            </Text>
            <Text variant="body-md" className="flex-1 font-bold" numberOfLines={2}>
              {r.value}
            </Text>
            <MaterialIcons name="chevron-right" size={22} color={colors.ink.muted} />
          </Pressable>
        ))}
      </Card>
    </WizardScaffold>
  );
}
