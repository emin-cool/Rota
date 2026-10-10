import { MaterialIcons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { tr } from '@/i18n/tr';
import { colors, shadows } from '@/theme/tokens';

type TabKey = keyof typeof tr.tabs;

const icons: Record<TabKey, keyof typeof MaterialIcons.glyphMap> = {
  map: 'map',
  explore: 'explore',
  record: 'add',
  feed: 'forum',
  profile: 'person',
};

/** Route adı → i18n anahtarı. Dosya adları app/(tabs)/ altındaki ekranlarla aynı. */
const routeToKey: Record<string, TabKey> = {
  map: 'map',
  explore: 'explore',
  record: 'record',
  feed: 'feed',
  profile: 'profile',
};

/** Ortada yükseltilmiş turuncu Kaydet butonu olan alt menü (Stitch `nav` yapısı). */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="bg-surface"
      style={[{ paddingBottom: Math.max(insets.bottom, 16) }, shadows.level2]}
    >
      <View className="mx-auto h-16 w-full max-w-md flex-row items-center justify-around px-space-xs">
        {state.routes.map((route, index) => {
          const key = routeToKey[route.name];
          if (!key) return null;
          const focused = state.index === index;
          const label = tr.tabs[key];

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          if (key === 'record') {
            return (
              <View key={route.key} className="-top-5 items-center justify-center">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: focused }}
                  onPress={onPress}
                  className="h-14 w-14 items-center justify-center rounded-full bg-secondary-container active:scale-95 active:bg-secondary"
                  style={shadows.record}
                >
                  <MaterialIcons name={icons.record} size={30} color={colors['on-secondary']} />
                </Pressable>
                <Text variant="label-caps" className="mt-1 font-bold text-secondary">
                  {label}
                </Text>
              </View>
            );
          }

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: focused }}
              onPress={onPress}
              className="h-12 min-w-[56px] items-center justify-center gap-0.5"
            >
              <MaterialIcons
                name={icons[key]}
                size={24}
                color={focused ? colors.primary : colors['on-surface-variant']}
              />
              <Text
                variant="label-caps"
                className={focused ? 'text-primary' : 'text-on-surface-variant'}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
