import { View } from "react-native";
import { ProductCardSkeleton } from "./ProductCardSkeleton";

interface Props {
  count?: number;
}

export function ProductGridSkeleton({ count = 6 }: Props) {
  const rows = Math.ceil(count / 2);
  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} className="flex-row" style={{ gap: 12 }}>
          <ProductCardSkeleton />
          {i * 2 + 1 < count && <ProductCardSkeleton />}
        </View>
      ))}
    </View>
  );
}
