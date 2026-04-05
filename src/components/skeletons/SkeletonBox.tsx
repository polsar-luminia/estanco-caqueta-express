import { View, type ViewProps } from "react-native";

export function SkeletonBox({ className = "", ...props }: ViewProps & { className?: string }) {
  return <View className={`bg-gray-200 animate-pulse rounded-lg ${className}`} {...props} />;
}
