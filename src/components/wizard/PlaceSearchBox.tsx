import { MaterialIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';

import { Text } from '@/components/ui';
import { tr } from '@/i18n/tr';
import { placeIcon, type PlaceSuggestion } from '@/lib/placeSearch';
import { colors, shadows } from '@/theme/tokens';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  /** Öneri listesi (açılır panel) görünsün mü? */
  open: boolean;
  suggestions: PlaceSuggestion[];
  loading: boolean;
  empty: boolean;
  failed: boolean;
  /** Seçim yapılırken (koordinat alınırken) true. */
  choosing: boolean;
  /** Önerilen yeri seçmede oluşan hata. */
  pickError: boolean;
  onSelect: (s: PlaceSuggestion) => void;
};

/** Haritanın üstündeki arama kutusu ve altında açılan öneri listesi. */
export function PlaceSearchBox({
  value,
  onChangeText,
  onFocus,
  onBlur,
  open,
  suggestions,
  loading,
  empty,
  failed,
  choosing,
  pickError,
  onSelect,
}: Props) {
  const copy = tr.wizard.step2.search;
  const message = failed
    ? copy.unavailable
    : pickError
      ? copy.pickFailed
      : empty
        ? copy.noResults
        : null;

  return (
    <View className="z-10">
      <View
        className="h-12 flex-row items-center gap-space-sm rounded-full border border-hairline bg-white px-space-md"
        style={shadows.level2}
      >
        <MaterialIcons name="search" size={22} color={colors.brand.DEFAULT} />
        <TextInput
          accessibilityLabel={copy.placeholder}
          placeholder={copy.placeholder}
          placeholderTextColor={colors.ink.muted}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
          autoCorrect={false}
          returnKeyType="search"
          className="h-full flex-1 font-regular text-body-lg text-ink"
        />
        {loading || choosing ? (
          <ActivityIndicator size="small" color={colors.brand.DEFAULT} />
        ) : value.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.clear}
            hitSlop={12}
            onPress={() => onChangeText('')}
            className="h-11 w-11 items-center justify-center"
          >
            <MaterialIcons name="close" size={20} color={colors.ink.muted} />
          </Pressable>
        ) : null}
      </View>

      {open && (suggestions.length > 0 || message) ? (
        <View
          className="mt-space-sm max-h-[300px] overflow-hidden rounded-lg bg-white"
          style={shadows.level2}
        >
          {suggestions.length > 0 ? (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {suggestions.map((s, i) => (
                <Pressable
                  key={s.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${s.name}${s.subtitle ? `, ${s.subtitle}` : ''}`}
                  disabled={choosing}
                  onPress={() => onSelect(s)}
                  className={`min-h-[56px] flex-row items-center gap-space-md px-space-md py-space-sm active:bg-surface-container-low ${
                    i > 0 ? 'border-t border-hairline' : ''
                  }`}
                >
                  <View className="h-9 w-9 items-center justify-center rounded-full bg-surface-container">
                    <MaterialIcons
                      name={placeIcon(s.featureType, s.maki)}
                      size={20}
                      color={colors.brand.DEFAULT}
                    />
                  </View>
                  <View className="flex-1">
                    <Text variant="body-md" className="font-bold" numberOfLines={1}>
                      {s.name}
                    </Text>
                    {s.subtitle ? (
                      <Text variant="label-sm" className="text-ink-secondary" numberOfLines={1}>
                        {s.subtitle}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <Text
              variant="body-md"
              className="p-space-md text-ink-secondary"
              accessibilityLiveRegion="polite"
            >
              {message}
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}
