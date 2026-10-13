import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Avatar, Text } from '@/components/ui';
import type { PersonRow as Person } from '@/types/database';

import { FollowButton } from './FollowButton';

/** Kişi satırı (arama, takipçi listeleri): avatar + ad + @kullanıcıadı + takip düğmesi. */
export function PersonRowItem({
  person,
  trailing,
}: {
  person: Person;
  trailing?: React.ReactNode;
}) {
  return (
    <View className="min-h-[64px] flex-row items-center gap-space-md">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={person.display_name}
        onPress={() => router.push({ pathname: '/user/[id]', params: { id: person.user_id } })}
        className="min-h-[56px] flex-1 flex-row items-center gap-space-md"
      >
        <Avatar name={person.display_name} uri={person.avatar_url} size={48} />
        <View className="flex-1">
          <Text variant="body-lg" className="font-bold" numberOfLines={1}>
            {person.display_name}
          </Text>
          <Text variant="label-sm" className="text-ink-secondary" numberOfLines={1}>
            @{person.username}
          </Text>
        </View>
      </Pressable>
      {trailing ?? (
        <FollowButton
          targetId={person.user_id}
          targetName={person.display_name}
          state={person.follow_state}
          compact
        />
      )}
    </View>
  );
}
