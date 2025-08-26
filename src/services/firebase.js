import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, AndroidStyle } from '@notifee/react-native';
import { PermissionsAndroid, Platform } from 'react-native';
import { navigate } from '../navigation/NavigationService';  // ✅ global navigation

// ✅ Request notification permission
export async function requestUserPermission() {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
    if (granted === PermissionsAndroid.RESULTS.GRANTED) {
      console.log('✅ Notification permission granted (Android 13+).');
    } else {
      console.log('❌ Notification permission denied (Android 13+).');
    }
  } else {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    if (enabled) console.log('✅ Notification permission granted.');
  }
}

// ✅ Get FCM Token
export async function getFcmToken() {
  try {
    const token = await messaging().getToken();
    if (token) {
      console.log('📱 FCM Token:', token);
      return token;
    } else {
      console.log('❌ Failed to get FCM token');
    }
  } catch (error) {
    console.log('❌ Error getting FCM token:', error);
  }
}

// ✅ Listen for notifications
export function notificationListener() {
  // Create notification channel for Android
  notifee.createChannel({
    id: 'default',
    name: 'Default Channel',
    sound: 'default',
    importance: AndroidImportance.HIGH,
  });

  // Foreground messages (show notification, don't navigate instantly)
  const unsubscribeOnMessage = messaging().onMessage(async remoteMessage => {
    console.log('📩 Foreground message:', remoteMessage);

    const imageUrl =
      remoteMessage.data?.image || remoteMessage.notification?.android?.imageUrl;

    await notifee.displayNotification({
      title: remoteMessage.notification?.title,
      body: remoteMessage.notification?.body,
      android: {
        channelId: 'default',
        sound: 'default',
        importance: AndroidImportance.HIGH,
        style: imageUrl
          ? {
              type: AndroidStyle.BIGPICTURE,
              picture: imageUrl,
            }
          : undefined,
      },
      ios: {
        sound: 'default',
        attachments: imageUrl ? [{ url: imageUrl }] : [],
      },
    });
  });

  // When notification is opened from background
  messaging().onNotificationOpenedApp(remoteMessage => {
    console.log('📩 Notification opened from background:', remoteMessage);
    handleNotificationNavigation(remoteMessage);
  });

  // When notification is opened from quit state
  messaging()
    .getInitialNotification()
    .then(remoteMessage => {
      if (remoteMessage) {
        console.log('📩 Notification opened from quit state:', remoteMessage);
        handleNotificationNavigation(remoteMessage);
      }
    });

  // Silent background messages
  messaging().setBackgroundMessageHandler(async remoteMessage => {
    console.log('📩 Background message (silent):', remoteMessage);
  });

  return unsubscribeOnMessage;
}

// ✅ Navigation handler
function handleNotificationNavigation(remoteMessage) {
  const { article_id, url } = remoteMessage.data || {};
  // Example: navigate to article details or discover screen
  navigate('Home', {
    screen: 'Discover',
    articleId: article_id || null,
    url: url || null,
  });
}
