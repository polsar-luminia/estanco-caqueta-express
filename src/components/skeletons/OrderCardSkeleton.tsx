import { View } from "react-native";
import { SkeletonBox } from "./SkeletonBox";

const CARD_SHADOW = {
  shadowColor: "#1A1C1A",
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.04,
  shadowRadius: 32,
  elevation: 2,
};

export function OrderCardSkeleton() {
  return (
    <View className="bg-white rounded-2xl p-6" style={CARD_SHADOW}>
      <View className="flex-row justify-between items-start mb-3">
        <View>
          <SkeletonBox style={{ width: 130, height: 18 }} className="rounded mb-2" />
          <SkeletonBox style={{ width: 100, height: 12 }} className="rounded" />
        </View>
        <SkeletonBox style={{ width: 80, height: 28 }} className="rounded-full" />
      </View>
      <View className="border-t border-gray-100 mt-3 pt-3">
        <View className="flex-row justify-between items-center">
          <SkeletonBox style={{ width: 80, height: 10 }} className="rounded" />
          <SkeletonBox style={{ width: 100, height: 18 }} className="rounded" />
        </View>
        <SkeletonBox style={{ width: "100%", height: 40 }} className="rounded-xl mt-3" />
      </View>
    </View>
  );
}
