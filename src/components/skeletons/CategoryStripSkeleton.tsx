import { View, ScrollView } from "react-native";
import { SkeletonBox } from "./SkeletonBox";

export function CategoryStripSkeleton() {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View className="flex-row" style={{ gap: 8 }}>
        {Array.from({ length: 5 }, (_, i) => (
          <SkeletonBox key={i} style={{ width: 90, height: 40 }} className="rounded-full" />
        ))}
      </View>
    </ScrollView>
  );
}
