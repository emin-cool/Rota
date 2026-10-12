import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, shadows } from '@/theme/tokens';

type IconName = keyof typeof MaterialIcons.glyphMap;

/** Büyük seçim kartı (aktivite): solda yuvarlak ikon, başlık, açıklama, sağda onay. */
export function SelectCard({
  icon,
  title,
  subtitle,
  tag,
  selected,
  onPress,
  role = 'radio',
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  tag?: string;
  selected: boolean;
  onPress: () => void;
  role?: 'radio' | 'checkbox';
}) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={title}
      accessibilityState={role === 'radio' ? { selected } : { checked: selected }}
      onPress={onPress}
      className={`min-h-[84px] flex-row items-center gap-space-md rounded-lg border-2 p-space-md ${
        selected ? 'border-brand bg-white' : 'border-transparent bg-white'
      }`}
      style={shadows.level1}
    >
      <View
        className={`h-14 w-14 items-center justify-center rounded-full ${
          selected ? 'bg-brand' : 'bg-surface-container'
        }`}
      >
        <MaterialIcons
          name={icon}
          size={28}
          color={selected ? '#ffffff' : colors['on-surface-variant']}
        />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-space-sm">
          <Text variant="headline-sm">{title}</Text>
          {tag ? (
            <View className="rounded-full bg-primary-fixed px-2 py-0.5">
              <Text variant="label-caps" className="text-on-primary-fixed-variant">
                {tag}
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="body-md" className="text-ink-secondary" numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      {selected ? (
        <View className="h-8 w-8 items-center justify-center rounded-full bg-brand">
          <MaterialIcons name="check" size={20} color="#ffffff" />
        </View>
      ) : (
        <View className="h-8 w-8" />
      )}
    </Pressable>
  );
}

/** Yan yana segment (rota tipi / zemin): ikon + başlık + alt başlık. */
export function SegmentChoice<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; icon: IconName; title: string; subtitle: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      className="flex-row gap-space-sm rounded-lg bg-surface-container p-1"
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={o.title}
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            className={`min-h-[84px] flex-1 items-center justify-center gap-0.5 rounded-md px-1 ${
              selected ? 'bg-white' : ''
            }`}
            style={selected ? shadows.level1 : undefined}
          >
            <MaterialIcons
              name={o.icon}
              size={22}
              color={selected ? colors.brand.DEFAULT : colors.ink.secondary}
            />
            <Text variant="body-md-medium" className={selected ? 'font-bold text-ink' : 'text-ink'}>
              {o.title}
            </Text>
            <Text variant="label-sm" className="text-ink-secondary">
              {o.subtitle}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Zemin türü gibi koyu seçili hap kartları (seçili: dolu yeşil). */
export function FilledChoice<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; icon: IconName; title: string; subtitle: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View accessibilityRole="radiogroup" className="flex-row gap-space-sm">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={o.title}
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            className={`min-h-[92px] flex-1 items-center justify-center gap-0.5 rounded-lg px-1 ${
              selected ? 'bg-brand' : 'bg-surface-container-low'
            }`}
          >
            <MaterialIcons
              name={o.icon}
              size={24}
              color={selected ? '#ffffff' : colors['on-surface-variant']}
            />
            <Text
              variant="body-md-medium"
              className={selected ? 'font-bold text-white' : 'text-ink'}
            >
              {o.title}
            </Text>
            <Text variant="label-sm" className={selected ? 'text-white/85' : 'text-ink-secondary'}>
              {o.subtitle}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Eğim gibi tek seçimli satır (ikon dairesi + başlık + açıklama + onay). */
export function SelectRow({
  icon,
  title,
  subtitle,
  tag,
  selected,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  tag?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={title}
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`min-h-[72px] flex-row items-center gap-space-md rounded-lg p-space-md ${
        selected ? 'bg-surface-container' : 'bg-surface-container-low'
      }`}
    >
      <View
        className={`h-12 w-12 items-center justify-center rounded-full ${
          selected ? 'bg-primary-fixed' : 'bg-surface-container-high'
        }`}
      >
        <MaterialIcons
          name={icon}
          size={24}
          color={selected ? colors.primary : colors['on-surface-variant']}
        />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-space-sm">
          <Text variant="headline-sm">{title}</Text>
          {tag ? (
            <View className="rounded-full bg-accent-soft px-2 py-0.5">
              <Text variant="label-caps" className="text-accent-deep">
                {tag}
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="body-md" className="text-ink-secondary">
          {subtitle}
        </Text>
      </View>
      {selected ? (
        <View className="h-7 w-7 items-center justify-center rounded-full bg-brand">
          <MaterialIcons name="check" size={18} color="#ffffff" />
        </View>
      ) : null}
    </Pressable>
  );
}

/** Aç/kapa satırı (ekstra tercihler). */
export function ToggleRow({
  icon,
  title,
  subtitle,
  value,
  onChange,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View className="min-h-[72px] flex-row items-center gap-space-md rounded-lg bg-surface-container-low p-space-md">
      <View className="h-12 w-12 items-center justify-center rounded-md bg-surface-container">
        <MaterialIcons name={icon} size={24} color={colors.brand.DEFAULT} />
      </View>
      <View className="flex-1">
        <Text variant="headline-sm" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="body-md" className="text-ink-secondary" numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors['surface-container-high'], true: colors.brand.DEFAULT }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

/** Fotoğraf yerine gradyanlı manzara kartı (Sahil / Park / Tarihi / Fark etmez). */
export function SceneryCard({
  icon,
  title,
  subtitle,
  gradient,
  selected,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  gradient: [string, string];
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={title}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      className="h-[172px] flex-1 overflow-hidden rounded-lg"
      style={shadows.level2}
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      >
        <View className="flex-1 justify-between p-space-md">
          <View className="flex-row items-start justify-between">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-white/90">
              <MaterialIcons name={icon} size={20} color={colors.brand.DEFAULT} />
            </View>
            {selected ? (
              <View className="h-7 w-7 items-center justify-center rounded-full bg-brand">
                <MaterialIcons name="check" size={18} color="#ffffff" />
              </View>
            ) : (
              <View className="h-7 w-7 rounded-full border-2 border-white/70" />
            )}
          </View>
          <View>
            <Text variant="headline-sm" className="text-white">
              {title}
            </Text>
            <Text variant="label-sm" className="text-white/90">
              {subtitle}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

/** Gradyan bloklu öneri kartı (gerçek rotalardan: fotoğraf gelene kadar). */
export function RouteSuggestionCard({
  gradient,
  tag,
  title,
  meta,
  onPress,
  icon,
  children,
}: {
  gradient: [string, string];
  tag: string;
  title: string;
  meta?: string;
  onPress: () => void;
  icon: IconName;
  children?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${tag}: ${title}`}
      onPress={onPress}
      className="h-[132px] flex-1 overflow-hidden rounded-lg"
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      >
        <View className="flex-1 justify-between p-space-md">
          <MaterialIcons name={icon} size={26} color="rgba(255,255,255,0.9)" />
          <View>
            <Text variant="label-caps" className="text-primary-fixed">
              {tag}
            </Text>
            <Text variant="headline-sm" className="text-white" numberOfLines={2}>
              {title}
            </Text>
            {meta ? (
              <Text variant="label-sm" className="text-white/85">
                {meta}
              </Text>
            ) : null}
            {children}
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}
