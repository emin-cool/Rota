import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { FilledChoice, ToggleRow } from '@/components/wizard/controls';
import { WizardScaffold } from '@/components/wizard/WizardScaffold';
import { tr } from '@/i18n/tr';
import { activeExtraCount, visibleExtraKeys, type ExtraToggleKey } from '@/lib/wizard';
import { selectAnswers, useWizardStore } from '@/stores/wizardStore';
import type { SurfacePref } from '@/types/routes';

type IconName = keyof typeof MaterialIcons.glyphMap;

const ICONS: Record<ExtraToggleKey, IconName> = {
  avoidTraffic: 'directions-car',
  litStreets: 'lightbulb',
  amenities: 'local-cafe',
  transitEnd: 'directions-transit',
  dog: 'pets',
  stroller: 'child-friendly',
  bikeLanes: 'pedal-bike',
};

const SURFACES: { value: SurfacePref; icon: IconName }[] = [
  { value: 'paved', icon: 'directions-walk' },
  { value: 'unpaved', icon: 'forest' },
  { value: 'any', icon: 'shuffle' },
];

export default function WizardStep5() {
  const a = useWizardStore(selectAnswers);
  const patch = useWizardStore((s) => s.patch);
  const copy = tr.wizard.step5;
  const keys = visibleExtraKeys(a.activityType, a.routeType);

  return (
    <WizardScaffold
      step={5}
      badge={copy.badge}
      heading={copy.title}
      subtitle={copy.subtitle}
      onNext={() => router.push('/route-wizard/step-6')}
    >
      <View className="gap-space-sm">
        <View className="flex-row items-center justify-between">
          <Text variant="label-caps" className="text-ink-secondary">
            {copy.sectionComfort}
          </Text>
          <Text variant="label-sm" className="font-bold text-brand">
            {copy.active(activeExtraCount(a))}
          </Text>
        </View>
        {keys.map((key) => (
          <ToggleRow
            key={key}
            icon={ICONS[key]}
            title={copy.toggles[key].title}
            subtitle={copy.toggles[key].subtitle}
            value={a.extras[key]}
            onChange={(v) => patch({ extras: { ...a.extras, [key]: v } })}
          />
        ))}
      </View>

      <View className="gap-space-sm">
        <View className="flex-row items-center justify-between">
          <Text variant="label-caps" className="text-ink-secondary">
            {copy.surfaceTitle}
          </Text>
          <Text variant="label-sm" className="text-ink-secondary">
            {copy.surfaceHint}
          </Text>
        </View>
        <FilledChoice
          value={a.extras.surface}
          onChange={(surface) => patch({ extras: { ...a.extras, surface } })}
          options={SURFACES.map((o) => ({
            value: o.value,
            icon: o.icon,
            title: copy.surface[o.value].title,
            subtitle: copy.surface[o.value].subtitle,
          }))}
        />
      </View>
    </WizardScaffold>
  );
}
