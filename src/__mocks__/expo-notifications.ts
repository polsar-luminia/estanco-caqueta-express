import { vi } from "vitest";

export const dismissAllNotificationsAsync = vi.fn().mockResolvedValue(undefined);
export const setBadgeCountAsync = vi.fn().mockResolvedValue(undefined);
export const setNotificationHandler = vi.fn();
export const getPermissionsAsync = vi.fn().mockResolvedValue({ status: "granted" });
export const requestPermissionsAsync = vi.fn().mockResolvedValue({ status: "granted" });
export const setNotificationChannelAsync = vi.fn().mockResolvedValue(undefined);
export const getExpoPushTokenAsync = vi.fn().mockResolvedValue({ data: "ExponentPushToken[test]" });
export const addNotificationResponseReceivedListener = vi.fn(() => ({ remove: vi.fn() }));
export const addNotificationReceivedListener = vi.fn(() => ({ remove: vi.fn() }));
export const AndroidImportance = { HIGH: 4 };
