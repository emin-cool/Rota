import { ActivityIndicator, Linking, Switch, View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { useNotificationSettings, usePushPermission } from '@/hooks/useNotificationSettings';
import { tr } from '@/i18n/tr';
import { colors } from '@/theme/tokens';

type Key = 'follows' | 'kudos' | 'comments';

const ROWS: { key: Key; label: string; hint: string }[] = [
  {
    key: 'follows',
    label: tr.push.settings.follows,
    hint: tr.push.settings.followsHint,
  },
  { key: 'kudos', label: tr.push.settings.kudos, hint: tr.push.settings.kudosHint },
  {
    key: 'comments',
    label: tr.push.settings.comments,
    hint: tr.push.settings.commentsHint,
  },
];

/** Ayarlar → Bildirimler: sistem izni durumu ve tür bazında aç/kapa anahtarları. */
export function NotificationSettingsSection() {
  const { permission, request } = usePushPermission();
  const { query, mutation } = useNotificationSettings();
  const s = tr.push.settings;

  return (
    <View className="gap-space-md">
      <Text variant="label-caps" className="px-space-xs text-ink-secondary">
        {s.section}
      </Text>

      {permission === null ? (
        <View className="items-center py-space-md">
          <ActivityIndicator color={colors.brand.DEFAULT} />
        </View>
      ) : permission === 'unavailable' ? (
        <Text variant="label-sm" className="px-space-xs text-ink-secondary">
          {s.unavailable}
        </Text>
      ) : permission !== 'granted' ? (
        <Card className="gap-space-sm p-space-md">
          <Text variant="body-lg" className="font-bold">
            {permission === 'denied' ? s.permissionDenied : s.permissionOff}
          </Text>
          <Text variant="label-sm" className="text-ink-secondary">
            {permission === 'denied' ? s.permissionDeniedHint : s.permissionOffHint}
          </Text>
          <Button
            title={permission === 'denied' ? s.openSettings : s.allow}
            variant="secondary"
            onPress={() => (permission === 'denied' ? void Linking.openSettings() : void request())}
          />
        </Card>
      ) : query.isError ? (
        <Text variant="label-sm" className="px-space-xs text-error">
          {s.loadError}
        </Text>
      ) : (
        <>
          {ROWS.map((row) => (
            <Card key={row.key} className="flex-row items-center gap-space-md p-space-md">
              <View className="flex-1">
                <Text variant="body-lg" className="font-bold">
                  {row.label}
                </Text>
                <Text variant="label-sm" className="text-ink-secondary">
                  {row.hint}
                </Text>
              </View>
              <Switch
                value={query.data?.[row.key] ?? true}
                disabled={query.isLoading}
                onValueChange={(on) => mutation.mutate({ [row.key]: on })}
                trackColor={{ true: colors.brand.DEFAULT, false: colors.hairline }}
                accessibilityLabel={row.label}
              />
            </Card>
          ))}
          {mutation.isError ? (
            <Text variant="label-sm" className="px-space-xs text-error">
              {s.saveError}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}
