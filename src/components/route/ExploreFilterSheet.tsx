import { forwardRef, useState } from 'react';
import { View } from 'react-native';

import { BottomSheet, type BottomSheetRef, Button, Chip, HeadlineMd, Text } from '@/components/ui';
import { tr } from '@/i18n/tr';
import { EMPTY_FILTERS, type DurationBucket, type ExploreFilters } from '@/lib/explore';
import type { ActivityType, Difficulty } from '@/types/database';

type Props = {
  filters: ExploreFilters;
  districts: string[];
  onApply: (next: ExploreFilters) => void;
};

const ACTIVITIES: ActivityType[] = ['walk', 'run', 'bike'];
const DURATIONS: DurationBucket[] = ['short', 'medium', 'long'];
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-space-sm">
      <Text variant="label-caps" className="text-ink-secondary">
        {title}
      </Text>
      <View className="flex-row flex-wrap gap-space-sm">{children}</View>
    </View>
  );
}

/** Filtre sheet'i (dışarıdan filtre değişince `key` ile yeniden kurulur): aktivite, süre, zorluk, ilçe, 4+★. Uygula'ya basınca değişiklik listeye yansır. */
export const ExploreFilterSheet = forwardRef<BottomSheetRef, Props>(function ExploreFilterSheet(
  { filters, districts, onApply },
  ref,
) {
  const [draft, setDraft] = useState(filters);

  const close = () => (ref as React.RefObject<BottomSheetRef | null>).current?.close();
  const patch = (p: Partial<ExploreFilters>) => setDraft((d) => ({ ...d, ...p }));

  return (
    <BottomSheet ref={ref} modal initialIndex={-1} snapPoints={['78%']}>
      <View className="gap-space-lg px-margin pb-space-xl pt-space-sm">
        <HeadlineMd>{tr.explore.sheetTitle}</HeadlineMd>

        <Section title={tr.explore.activity}>
          <Chip
            label={tr.explore.any}
            selected={draft.activity === null}
            onPress={() => patch({ activity: null })}
          />
          {ACTIVITIES.map((a) => (
            <Chip
              key={a}
              label={tr.map.activity[a]}
              selected={draft.activity === a}
              onPress={() => patch({ activity: draft.activity === a ? null : a })}
            />
          ))}
        </Section>

        <Section title={tr.explore.duration}>
          {DURATIONS.map((d) => (
            <Chip
              key={d}
              label={tr.explore.durationBuckets[d]}
              selected={draft.duration === d}
              onPress={() => patch({ duration: draft.duration === d ? null : d })}
            />
          ))}
        </Section>

        <Section title={tr.explore.difficulty}>
          {DIFFICULTIES.map((d) => (
            <Chip
              key={d}
              label={tr.detail.difficulty[d]}
              selected={draft.difficulty === d}
              onPress={() => patch({ difficulty: draft.difficulty === d ? null : d })}
            />
          ))}
        </Section>

        {districts.length > 0 ? (
          <Section title={tr.explore.district}>
            {districts.map((d) => (
              <Chip
                key={d}
                label={d}
                selected={draft.district === d}
                onPress={() => patch({ district: draft.district === d ? null : d })}
              />
            ))}
          </Section>
        ) : null}

        <Section title={tr.explore.topRated}>
          <Chip
            label={tr.explore.topRated}
            selected={draft.topRated}
            onPress={() => patch({ topRated: !draft.topRated })}
          />
        </Section>

        <View className="flex-row gap-space-md">
          <Button
            title={tr.explore.reset}
            variant="secondary"
            className="flex-1"
            onPress={() => setDraft({ ...EMPTY_FILTERS, query: filters.query })}
          />
          <Button
            title={tr.explore.apply}
            className="flex-[1.6]"
            onPress={() => {
              onApply(draft);
              close();
            }}
          />
        </View>
      </View>
    </BottomSheet>
  );
});
