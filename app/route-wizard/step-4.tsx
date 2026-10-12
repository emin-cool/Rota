import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { View } from 'react-native';

import { HeadlineMd, Text } from '@/components/ui';
import { SceneryCard, SelectRow } from '@/components/wizard/controls';
import { WizardScaffold } from '@/components/wizard/WizardScaffold';
import { useWizardNearby } from '@/hooks/useWizardNearby';
import { tr } from '@/i18n/tr';
import { matchNearby, toggleScenery } from '@/lib/wizard';
import { useWizardStore } from '@/stores/wizardStore';
import { sceneryGradients } from '@/theme/gradients';
import { colors } from '@/theme/tokens';
import type { Scenery, Slope } from '@/types/routes';

type IconName = keyof typeof MaterialIcons.glyphMap;

const SCENERY: { key: Scenery; icon: IconName }[] = [
  { key: 'coast', icon: 'waves' },
  { key: 'green', icon: 'park' },
  { key: 'historic', icon: 'account-balance' },
  { key: 'any', icon: 'casino' },
];

const SLOPES: { key: Slope; icon: IconName }[] = [
  { key: 'flat', icon: 'trending-flat' },
  { key: 'some', icon: 'show-chart' },
  { key: 'hilly', icon: 'terrain' },
];

export default function WizardStep4() {
  const scenery = useWizardStore((s) => s.scenery);
  const slope = useWizardStore((s) => s.slope);
  const patch = useWizardStore((s) => s.patch);
  const { routes, answers } = useWizardNearby();
  const matches = matchNearby(routes, answers);
  const copy = tr.wizard.step4;

  return (
    <WizardScaffold
      step={4}
      badge={copy.badge}
      heading={copy.title}
      subtitle={copy.subtitle}
      badgeRight={copy.multi}
      onNext={() => router.push('/route-wizard/step-5')}
    >
      <View className="gap-space-md">
        {[SCENERY.slice(0, 2), SCENERY.slice(2)].map((row, i) => (
          <View key={i} className="flex-row gap-space-md">
            {row.map(({ key, icon }) => (
              <SceneryCard
                key={key}
                icon={icon}
                title={copy.scenery[key].title}
                subtitle={copy.scenery[key].subtitle}
                gradient={[...sceneryGradients[key]]}
                selected={scenery.includes(key)}
                onPress={() => patch({ scenery: toggleScenery(scenery, key) })}
              />
            ))}
          </View>
        ))}
      </View>

      <View className="gap-space-md">
        <View className="gap-1">
          <HeadlineMd className="text-headline-sm">{copy.slopeTitle}</HeadlineMd>
          <Text variant="body-md" className="text-ink-secondary">
            {copy.slopeSubtitle}
          </Text>
        </View>
        <View accessibilityRole="radiogroup" className="gap-space-sm">
          {SLOPES.map(({ key, icon }) => (
            <SelectRow
              key={key}
              icon={icon}
              title={copy.slopes[key].title}
              subtitle={copy.slopes[key].subtitle}
              tag={copy.slopes[key].tag || undefined}
              selected={slope === key}
              onPress={() => patch({ slope: key })}
            />
          ))}
        </View>
      </View>

      {/* Gerçek verilerden: seçimlere uyan kayıtlı rotalar */}
      <View className="flex-row items-center gap-space-md rounded-lg bg-primary-fixed/40 p-space-md">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-brand">
          <MaterialIcons name="explore" size={24} color="#ffffff" />
        </View>
        <View className="flex-1">
          <Text variant="label-caps" className="text-on-primary-fixed-variant">
            {copy.matchTitle}
          </Text>
          <Text variant="body-md" className="font-bold" numberOfLines={2}>
            {matches[0]?.title ?? copy.matchNone}
          </Text>
        </View>
        {matches.length > 0 ? (
          <Text variant="headline-md" style={{ color: colors.brand.DEFAULT }}>
            {matches.length}
          </Text>
        ) : null}
      </View>
    </WizardScaffold>
  );
}
