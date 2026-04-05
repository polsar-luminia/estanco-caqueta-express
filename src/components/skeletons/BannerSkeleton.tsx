import { Dimensions } from "react-native";
import { SkeletonBox } from "./SkeletonBox";

const { width } = Dimensions.get("window");

export function BannerSkeleton() {
  return <SkeletonBox style={{ width, height: width * 0.45 }} className="rounded-none" />;
}
