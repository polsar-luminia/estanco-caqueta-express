import { View } from "react-native";
import { SkeletonBox } from "./SkeletonBox";

export function ProductCardSkeleton() {
  return (
    <View className="flex-1 bg-white rounded-xl overflow-hidden border border-gray-100 p-3">
      <SkeletonBox style={{ width: "100%", height: 120 }} className="rounded-lg mb-3" />
      <SkeletonBox style={{ width: "40%", height: 10 }} className="rounded mb-2" />
      <SkeletonBox style={{ width: "80%", height: 12 }} className="rounded mb-3" />
      <View className="flex-row justify-between items-center">
        <SkeletonBox style={{ width: "35%", height: 14 }} className="rounded" />
        <SkeletonBox style={{ width: 32, height: 28 }} className="rounded-lg" />
      </View>
    </View>
  );
}
