import { ActivityIndicator, Pressable, type PressableProps, View } from 'react-native';

import { colors, shadows } from '@/theme/tokens';

import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export type ButtonProps = Omit<PressableProps, 'children'> & {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  /** Başa eklenecek ikon vb. */
  leading?: React.ReactNode;
  className?: string;
};

const containerClass: Record<ButtonVariant, string> = {
  primary: 'bg-brand active:bg-brand-deep',
  secondary: 'bg-brand-soft active:bg-primary-fixed',
  ghost: 'bg-transparent active:bg-brand-soft',
};

const labelClass: Record<ButtonVariant, string> = {
  primary: 'text-on-primary',
  secondary: 'text-brand',
  ghost: 'text-brand',
};

/** Hap şeklinde, 52 pt yüksekliğinde buton (DESIGN.md "Buttons"). */
export function Button({
  title,
  variant = 'primary',
  loading = false,
  disabled,
  leading,
  className = '',
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      className={`h-[52px] flex-row items-center justify-center gap-space-sm rounded-full px-space-lg ${containerClass[variant]} ${isDisabled ? 'opacity-50' : ''} ${className}`}
      style={variant === 'primary' ? shadows.level2 : undefined}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors['on-primary'] : colors.brand.DEFAULT}
        />
      ) : (
        <>
          {leading ? <View>{leading}</View> : null}
          <Text variant="body-lg" className={`font-bold ${labelClass[variant]}`}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}
