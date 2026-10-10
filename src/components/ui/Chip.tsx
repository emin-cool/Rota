import { Pressable, type PressableProps, View } from 'react-native';

import { Text } from './Text';

export type ChipProps = Omit<PressableProps, 'children'> & {
  label: string;
  selected?: boolean;
  /** Etiketin solunda gösterilecek ikon; seçili durumda renk için `selected` ile uyumlu olmalı. */
  icon?: React.ReactNode;
  className?: string;
};

/** Seçilebilir hap chip (aktivite seçici: Koşu / Yürüyüş / Bisiklet). */
export function Chip({ label, selected = false, icon, className = '', ...rest }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      className={`min-h-[44px] flex-row items-center justify-center gap-space-sm rounded-full border-[1.5px] px-space-md ${
        selected ? 'border-brand bg-brand-soft' : 'border-hairline bg-surface-container-lowest'
      } ${className}`}
      {...rest}
    >
      {icon ? <View>{icon}</View> : null}
      <Text
        variant="body-md-medium"
        className={selected ? 'font-bold text-brand' : 'text-ink-secondary'}
      >
        {label}
      </Text>
    </Pressable>
  );
}
