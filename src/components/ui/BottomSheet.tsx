import GorhomBottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useMemo } from 'react';

import { colors, sheetSnapPoints } from '@/theme/tokens';

export type BottomSheetRef = GorhomBottomSheet;

export type BottomSheetProps = {
  children: React.ReactNode;
  /** Tutamaç noktaları. Varsayılan: 110 pt peek, %50, %90 (DESIGN.md). */
  snapPoints?: (string | number)[];
  /** Açılış noktasının dizindeki yeri; -1 kapalı. */
  initialIndex?: number;
  /** Arkaya karartma koyup dışarı dokununca kapat (modal kullanım). Harita sheet'i için kapalı bırak. */
  modal?: boolean;
  onClose?: () => void;
};

/**
 * `@gorhom/bottom-sheet` sarmalayıcısı. Harita üstünde sürüklenebilir kart
 * ve modal sheet olarak kullanılır. Uygulama kökünde `GestureHandlerRootView` gerekir
 * (app/_layout.tsx içinde var).
 */
export const BottomSheet = forwardRef<BottomSheetRef, BottomSheetProps>(function BottomSheet(
  {
    children,
    snapPoints = [sheetSnapPoints.peek, sheetSnapPoints.half, sheetSnapPoints.full],
    initialIndex = 0,
    modal = false,
    onClose,
  },
  ref,
) {
  const points = useMemo(() => snapPoints, [snapPoints]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.35} />
    ),
    [],
  );

  return (
    <GorhomBottomSheet
      ref={ref}
      index={initialIndex}
      snapPoints={points}
      enablePanDownToClose={modal}
      backdropComponent={modal ? renderBackdrop : undefined}
      onClose={onClose}
      handleIndicatorStyle={{ backgroundColor: colors.hairline, width: 40 }}
      backgroundStyle={{ backgroundColor: colors['surface-container-lowest'], borderRadius: 24 }}
    >
      <BottomSheetView>{children}</BottomSheetView>
    </GorhomBottomSheet>
  );
});
