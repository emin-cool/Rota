import { MaterialIcons } from '@expo/vector-icons';
import { ScrollView } from 'react-native';

import { Chip } from '@/components/ui';
import { tr } from '@/i18n/tr';
import { colors } from '@/theme/tokens';
import type { ActivityType } from '@/types/database';

export type ActivityFilter = ActivityType | null;

const OPTIONS: {
  value: ActivityFilter;
  label: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
}[] = [
  { value: null, label: tr.map.filterAll },
  { value: 'walk', label: tr.map.activity.walk, icon: 'directions-walk' },
  { value: 'run', label: tr.map.activity.run, icon: 'directions-run' },
  { value: 'bike', label: tr.map.activity.bike, icon: 'directions-bike' },
];

type Props = {
  value: ActivityFilter;
  onChange: (value: ActivityFilter) => void;
};

/** Haritanın üstündeki Tümü / Yürüyüş / Koşu / Bisiklet filtresi (tek seçim). */
export function ActivityFilterChips({ value, onChange }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-space-sm px-margin"
    >
      {OPTIONS.map((o) => {
        const selected = value === o.value;
        return (
          <Chip
            key={o.label}
            label={o.label}
            selected={selected}
            onPress={() => onChange(o.value)}
            className={selected ? '' : 'bg-white/90'}
            icon={
              o.icon ? (
                <MaterialIcons
                  name={o.icon}
                  size={18}
                  color={selected ? colors.brand.DEFAULT : colors.ink.muted}
                />
              ) : undefined
            }
          />
        );
      })}
    </ScrollView>
  );
}
