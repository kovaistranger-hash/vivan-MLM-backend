import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { api } from './api';
import { useAuthStore } from '../store/authStore';

/**
 * Requests notification permission, resolves the Expo push token, and registers it with the API when logged in.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT
    });
  }

  const projectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

  let token: string;
  try {
    const tokenResult = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId: String(projectId) } : undefined
    );
    token = tokenResult.data;
  } catch {
    return null;
  }

  const accessToken = useAuthStore.getState().accessToken;
  if (accessToken) {
    try {
      await api.post('/auth/push-token', { expoPushToken: token });
    } catch {
      /* Retry after login or when API is reachable */
    }
  }

  return token;
}
