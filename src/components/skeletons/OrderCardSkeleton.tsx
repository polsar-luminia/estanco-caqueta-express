import { View } from "react-native";
import { SkeletonBox } from "./SkeletonBox";

export function OrderCardSkeleton() {
  return (
    <View className="bg-white rounded-xl p-4 border border-gray-100">
      <View className="flex-row justify-between items-center mb-3">
        <SkeletonBox style={{ width: "35%", height: 14 }} className="rounded" />
        <SkeletonBox style={{ width: 70, height: 24 }} className="rounded-lg" />
      </View>
      <SkeletonBox style={{ width: "50%", height: 10 }} className="rounded mb-2" />
      <SkeletonBox style={{ width: "30%", height: 14 }} className="rounded" />
    </View>
  );
}
