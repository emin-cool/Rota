import { MaterialIcons } from '@expo/vector-icons';
import { View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { tr } from '@/i18n/tr';
import { colors } from '@/theme/tokens';

/** Konum izni kapalıyken gösterilen kart. */
export function LocationNotice({
  onAllow,
  canAskAgain,
}: {
  onAllow: () => void;
  canAskAgain: boolean;
}) {
  return (
    <View className="mx-margin gap-space-sm rounded-lg bg-accent-soft p-space-md">
      <View className="flex-row items-center gap-space-sm">
        <MaterialIcons name="location-off" size={20} color={colors.accent.deep} />
        <Text variant="headline-sm" className="flex-1 text-accent-deep">
          {tr.map.permissionTitle}
        </Text>
      </View>
      <Text variant="body-md" className="text-ink-secondary">
        {tr.map.permissionBody}
      </Text>
      <Button
        title={canAskAgain ? tr.map.permissionAllow : tr.map.permissionSettings}
        variant="secondary"
        onPress={onAllow}
      />
    </View>
  );
}
