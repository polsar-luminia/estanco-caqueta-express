// Minimal mock — solo lo que los stores/api usan
export const Platform = {
  OS: "ios" as "ios" | "android" | "web",
  select: (obj: any) => obj[Platform.OS] ?? obj.default,
};
