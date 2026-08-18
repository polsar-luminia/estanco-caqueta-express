import { useEffect } from "react";
import { type ViewProps } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

/**
 * El parpadeo se anima aqui a mano en vez de usar `animate-pulse` de nativewind.
 *
 * No es cosmetica: la clase `animate-pulse` hace que el interop de nativewind
 * escriba el shared value de Reanimated DURANTE el render, y el modo estricto de
 * Reanimated lo grita en cada frame de cada esqueleto. En el inicio hay ~14
 * SkeletonBox a la vez, asi que la consola queda inservible mientras carga
 * justo la pantalla que estamos afinando. No rompe nada; solo tapa todo lo demas.
 *
 * Aqui el valor se escribe dentro de un efecto, que es donde debe escribirse.
 */
export function SkeletonBox({ className = "", style, ...props }: ViewProps & { className?: string }) {
  const opacidad = useSharedValue(1);

  useEffect(() => {
    opacidad.value = withRepeat(
      withTiming(0.4, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacidad]);

  const animado = useAnimatedStyle(() => ({ opacity: opacidad.value }));

  return (
    <Animated.View
      className={`bg-gray-200 rounded-lg ${className}`}
      style={[animado, style]}
      {...props}
    />
  );
}
