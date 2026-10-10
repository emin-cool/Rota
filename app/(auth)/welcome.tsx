import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, DisplayHero, Text } from '@/components/ui';
import { tr } from '@/i18n/tr';
import { colors } from '@/theme/tokens';

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 justify-between overflow-hidden bg-brand-deep px-margin"
      style={{ paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 16) + 16 }}
    >
      <StatusBar style="light" />
      {/* Fotoğraf yerine geçici dekor: yarı saydam daireler. Gerçek görsel eklenince değişecek. */}
      <View className="absolute -right-24 top-24 h-72 w-72 rounded-full bg-brand opacity-60" />
      <View className="absolute -left-20 top-72 h-56 w-56 rounded-full bg-brand-mid opacity-30" />

      <View className="flex-row items-center gap-space-sm self-start rounded-full bg-white/15 py-2 pl-2 pr-4">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-brand">
          <MaterialIcons name="explore" size={22} color="#ffffff" />
        </View>
        <Text variant="headline-sm" className="text-white">
          ROTA
        </Text>
      </View>

      <View className="gap-space-md">
        <View className="flex-row items-center gap-1 self-start rounded-full bg-accent px-3 py-1.5">
          <MaterialIcons name="bolt" size={16} color={colors['on-secondary-fixed']} />
          <Text variant="label-caps" className="text-on-secondary-fixed">
            {tr.welcome.badge}
          </Text>
        </View>
        <DisplayHero className="text-white">{tr.welcome.title}</DisplayHero>
        <Text variant="body-lg" className="text-white/85">
          {tr.welcome.subtitle}
        </Text>

        <View className="mt-space-md gap-space-sm">
          <Button
            title={tr.welcome.start}
            leading={<MaterialIcons name="arrow-forward" size={20} color="#ffffff" />}
            onPress={() => router.push({ pathname: '/login', params: { mode: 'signup' } })}
          />
          <Button
            title={tr.welcome.haveAccount}
            variant="ghost"
            className="bg-white/15 active:bg-white/25"
            labelClassName="text-white"
            onPress={() => router.push({ pathname: '/login', params: { mode: 'login' } })}
          />
        </View>
      </View>
    </View>
  );
}
