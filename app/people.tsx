import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PersonRowItem } from '@/components/social/PersonRow';
import { Button, Card, HeadlineMd, Text } from '@/components/ui';
import { useSearchPeople, useSocialCounts } from '@/hooks/useSocialQueries';
import { tr } from '@/i18n/tr';
import { colors } from '@/theme/tokens';

export default function PeopleScreen() {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const search = useSearchPeople(text);
  const counts = useSocialCounts();
  const searching = text.trim().length >= 2;
  const pending = counts.data?.pending_requests ?? 0;

  return (
    <View className="flex-1 bg-canvas">
      <View
        className="flex-row items-center justify-between px-space-sm pb-space-sm"
        style={{ paddingTop: insets.top + 4 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr.common.back}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          hitSlop={8}
          className="h-11 w-11 items-center justify-center"
        >
          <MaterialIcons name="arrow-back-ios-new" size={20} color={colors.ink.DEFAULT} />
        </Pressable>
        <HeadlineMd>{tr.people.title}</HeadlineMd>
        <View className="h-11 w-11" />
      </View>

      <View className="gap-space-md px-margin pb-space-sm">
        <View className="h-12 flex-row items-center rounded-full border border-hairline bg-surface-container-lowest pl-space-md pr-space-md">
          <MaterialIcons name="search" size={22} color={colors.brand.DEFAULT} />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={tr.people.searchPlaceholder}
            placeholderTextColor={colors.ink.muted}
            accessibilityLabel={tr.people.searchPlaceholder}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            autoFocus
            className="ml-space-sm h-12 flex-1 font-regular text-body-md text-ink"
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr.people.requests}
          onPress={() => router.push('/follow-requests')}
        >
          <Card className="min-h-[56px] flex-row items-center gap-space-md px-space-md">
            <MaterialIcons name="person-add" size={22} color={colors.brand.DEFAULT} />
            <Text variant="body-lg" className="flex-1 font-bold">
              {tr.people.requests}
            </Text>
            {pending > 0 ? (
              <View className="min-w-[24px] items-center rounded-full bg-accent-deep px-2 py-0.5">
                <Text variant="label-sm" className="font-bold text-white">
                  {pending}
                </Text>
              </View>
            ) : null}
            <MaterialIcons name="chevron-right" size={22} color={colors.ink.muted} />
          </Card>
        </Pressable>
      </View>

      <FlatList
        data={searching ? (search.data ?? []) : []}
        keyExtractor={(p) => p.user_id}
        contentContainerClassName="px-margin pb-space-xl"
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <PersonRowItem person={item} />}
        ListEmptyComponent={
          !searching ? (
            <Text variant="body-md" className="py-space-md text-center text-ink-secondary">
              {tr.people.hint}
            </Text>
          ) : search.isFetching ? (
            <ActivityIndicator className="py-space-lg" color={colors.brand.DEFAULT} />
          ) : search.isError ? (
            <View className="items-center gap-space-md py-space-lg">
              <Text variant="body-md" className="text-ink-secondary">
                {tr.people.errorLoad}
              </Text>
              <Button
                title={tr.common.retry}
                variant="secondary"
                onPress={() => void search.refetch()}
              />
            </View>
          ) : (
            <Text variant="body-md" className="py-space-md text-center text-ink-secondary">
              {tr.people.noResults}
            </Text>
          )
        }
      />
    </View>
  );
}
