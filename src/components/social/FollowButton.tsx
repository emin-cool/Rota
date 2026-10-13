import { Alert } from 'react-native';

import { Button } from '@/components/ui';
import { useFollowOp } from '@/hooks/useSocialQueries';
import { tr } from '@/i18n/tr';
import { followButtonFor } from '@/lib/social';
import type { FollowState } from '@/types/database';

/** Takip düğmesi: duruma göre Takip Et / Takip Ediliyor / İstek Gönderildi / Kabul Et. */
export function FollowButton({
  targetId,
  targetName,
  state,
  compact = false,
}: {
  targetId: string;
  targetName: string;
  state: FollowState;
  compact?: boolean;
}) {
  const op = useFollowOp();
  const btn = followButtonFor(state);
  if (btn.action === 'none') return null;

  const run = (o: 'follow' | 'unfollow' | 'cancel' | 'accept') =>
    op.mutate({ op: o, targetId }, { onError: () => Alert.alert(tr.follow.failed) });

  const onPress = () => {
    if (btn.action === 'unfollow') {
      Alert.alert(tr.follow.unfollowTitle, tr.follow.unfollowBody(targetName), [
        { text: tr.social.cancel, style: 'cancel' },
        { text: tr.follow.unfollowConfirm, style: 'destructive', onPress: () => run('unfollow') },
      ]);
    } else if (btn.action === 'cancel') {
      Alert.alert(tr.follow.cancelRequestTitle, undefined, [
        { text: tr.social.cancel, style: 'cancel' },
        {
          text: tr.follow.cancelRequestConfirm,
          style: 'destructive',
          onPress: () => run('cancel'),
        },
      ]);
    } else {
      run(btn.action as 'follow' | 'accept');
    }
  };

  return (
    <Button
      title={tr.follow[btn.label]}
      variant={btn.primary ? 'primary' : 'secondary'}
      loading={op.isPending}
      onPress={onPress}
      className={compact ? 'h-11 px-space-md' : ''}
    />
  );
}
