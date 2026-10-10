import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, TextInput, type TextInputProps, View } from 'react-native';

import { tr } from '@/i18n/tr';
import { colors } from '@/theme/tokens';

import { Text } from './Text';

export type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  error?: string | null;
  /** `secureTextEntry` ile birlikte göz ikonu gösterir. */
  passwordToggle?: boolean;
  /** Etiketin sağında gösterilecek aksiyon (örn. "Şifremi unuttum?"). */
  labelAction?: React.ReactNode;
};

/** 48 pt yüksekliğinde, 12 px köşeli form alanı (DESIGN.md "Input Fields"). */
export function TextField({
  label,
  icon,
  error,
  passwordToggle,
  labelAction,
  secureTextEntry,
  onFocus,
  onBlur,
  ...rest
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const isSecure = passwordToggle ? hidden : secureTextEntry;

  return (
    <View className="gap-space-sm">
      <View className="min-h-[20px] flex-row items-center justify-between">
        <Text variant="label-caps" className="text-ink-secondary">
          {label}
        </Text>
        {labelAction}
      </View>
      <View
        className={`h-12 flex-row items-center rounded-md border bg-surface-container-lowest px-space-md ${
          error ? 'border-error' : focused ? 'border-[1.5px] border-brand' : 'border-hairline'
        }`}
      >
        {icon ? (
          <MaterialIcons
            name={icon}
            size={20}
            color={colors.ink.muted}
            style={{ marginRight: 12 }}
          />
        ) : null}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.ink.muted}
          secureTextEntry={isSecure}
          autoCapitalize="none"
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          className="h-full flex-1 font-regular text-body-lg text-ink"
          {...rest}
        />
        {passwordToggle ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? tr.auth.showPassword : tr.auth.hidePassword}
            hitSlop={12}
            onPress={() => setHidden((h) => !h)}
            className="h-11 w-11 items-center justify-center"
          >
            <MaterialIcons
              name={hidden ? 'visibility' : 'visibility-off'}
              size={20}
              color={colors.ink.muted}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="label-sm" className="text-error" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
