import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { View } from 'react-native';

import { RouteSuggestionCard, SegmentChoice, SelectCard } from '@/components/wizard/controls';
import { WizardScaffold } from '@/components/wizard/WizardScaffold';
import { HeadlineMd, Text } from '@/components/ui';
import { WeatherWarningCard } from '@/components/weather/WeatherWarningCard';
import { useLocalWeather } from '@/hooks/useWeather';
import { useWizardNearby } from '@/hooks/useWizardNearby';
import { tr } from '@/i18n/tr';
import { formatRating } from '@/lib/geo';
import { routeMeta, todaysPick } from '@/lib/wizard';
import { useWizardStore } from '@/stores/wizardStore';
import { suggestionGradients } from '@/theme/gradients';
import type { ActivityType, RouteType } from '@/types/routes';

const ACTIVITIES: { key: ActivityType; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { key: 'walk', icon: 'directions-walk' },
  { key: 'run', icon: 'directions-run' },
  { key: 'bike', icon: 'directions-bike' },
];

const ROUTE_TYPES: { value: RouteType; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { value: 'loop', icon: 'sync' },
  { value: 'a_b', icon: 'arrow-right-alt' },
  { value: 'out_back', icon: 'compare-arrows' },
];

export default function WizardStep1() {
  const activityType = useWizardStore((s) => s.activityType);
  const routeType = useWizardStore((s) => s.routeType);
  const setActivity = useWizardStore((s) => s.setActivity);
  const patch = useWizardStore((s) => s.patch);
  const { routes } = useWizardNearby();
  const weather = useLocalWeather();
  const today = todaysPick(routes);
  const copy = tr.wizard.step1;

  return (
    <WizardScaffold
      step={1}
      badge={copy.badge}
      heading={copy.title}
      subtitle={copy.subtitle}
      onNext={() => router.push('/route-wizard/step-2')}
    >
      <View className="gap-space-md">
        <WeatherWarningCard weather={weather.data?.weather} activity={activityType} />
        {ACTIVITIES.map(({ key, icon }) => (
          <SelectCard
            key={key}
            icon={icon}
            title={copy.activities[key].title}
            subtitle={copy.activities[key].subtitle}
            tag={copy.activities[key].tag || undefined}
            selected={activityType === key}
            onPress={() => setActivity(key)}
          />
        ))}
      </View>

      {today ? (
        <RouteSuggestionCard
          icon="wb-sunny"
          gradient={[...suggestionGradients.today]}
          tag={copy.todayTag}
          title={today.title}
          meta={`${routeMeta(today)} • ${formatRating(today.avg_rating)} ★`}
          onPress={() => router.push({ pathname: '/route/[id]', params: { id: today.id } })}
        />
      ) : null}

      <View className="gap-space-md">
        <View className="gap-1">
          <HeadlineMd className="text-headline-sm">{copy.routeTypeTitle}</HeadlineMd>
          <Text variant="body-md" className="text-ink-secondary">
            {copy.routeTypeSubtitle}
          </Text>
        </View>
        <SegmentChoice
          value={routeType}
          onChange={(v) => patch({ routeType: v })}
          options={ROUTE_TYPES.map((o) => ({
            value: o.value,
            icon: o.icon,
            title: copy.routeTypes[o.value].title,
            subtitle: copy.routeTypes[o.value].subtitle,
          }))}
        />
      </View>
    </WizardScaffold>
  );
}
