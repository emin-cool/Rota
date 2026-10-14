import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { tr } from '@/i18n/tr';
import { colors, shadows } from '@/theme/tokens';

type Props = {
  /** Harita yönü (derece). 0 = kuzey yukarıda. */
  heading: number;
  locateDisabled?: boolean;
  onLocate: () => void;
  onResetNorth: () => void;
  /** Verilirse kurslar kısayol düğmesi gösterilir. */
  onCourses?: () => void;
};

function RoundButton({
  icon,
  label,
  onPress,
  disabled,
  rotate = 0,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  rotate?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`h-11 w-11 items-center justify-center rounded-full border border-hairline bg-white/90 active:bg-surface-container ${
        disabled ? 'opacity-50' : ''
      }`}
      style={shadows.level2}
    >
      <MaterialIcons
        name={icon}
        size={22}
        color={colors.brand.DEFAULT}
        style={{ transform: [{ rotate: `${rotate}deg` }] }}
      />
    </Pressable>
  );
}

/** Haritanın sağındaki yuvarlak kontroller: pusula ve "konumuma git". */
export function MapControls({ heading, locateDisabled, onLocate, onResetNorth, onCourses }: Props) {
  return (
    <View className="gap-space-sm">
      <RoundButton
        icon="explore"
        label={tr.map.resetNorth}
        onPress={onResetNorth}
        rotate={-heading}
      />
      <RoundButton
        icon="my-location"
        label={tr.map.locate}
        onPress={onLocate}
        disabled={locateDisabled}
      />
      {onCourses ? (
        <RoundButton icon="fitness-center" label={tr.courses.mapShortcut} onPress={onCourses} />
      ) : null}
    </View>
  );
}
