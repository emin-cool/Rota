import { View, type ViewProps } from 'react-native';

import { shadows } from '@/theme/tokens';

export type CardProps = ViewProps & {
  /** `flat`: Level 1 (kenarlık), `raised`: Level 2 (yumuşak gölge — rota kartları). */
  elevation?: 'flat' | 'raised';
  className?: string;
};

/** 16 px köşeli, beyaz, 1 px ince kenarlıklı kart (DESIGN.md "Route Cards"). */
export function Card({ elevation = 'flat', className = '', style, ...rest }: CardProps) {
  return (
    <View
      className={`rounded-lg border border-hairline bg-surface-container-lowest ${className}`}
      style={[elevation === 'raised' ? shadows.level2 : shadows.level1, style]}
      {...rest}
    />
  );
}
