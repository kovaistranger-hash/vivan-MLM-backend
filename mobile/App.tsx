import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import DashboardScreen from './src/screens/Dashboard';
import TeamScreen from './src/screens/Team';
import IncomeScreen from './src/screens/Income';
import BinaryCalculatorScreen from './src/screens/BinaryCalculatorScreen';
import { registerForPushNotificationsAsync } from './src/services/pushNotifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

export type RootStackParamList = {
  Dashboard: undefined;
  Team: undefined;
  Income: undefined;
  BinaryCalculator: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[notification]', notification.request.content);
    });
    void registerForPushNotificationsAsync();
    return () => sub.remove();
  }, []);

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator
        initialRouteName="Dashboard"
        screenOptions={{
          headerStyle: { backgroundColor: '#1e1b4b' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '600' }
        }}
      >
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Overview' }} />
        <Stack.Screen name="Team" component={TeamScreen} options={{ title: 'Team' }} />
        <Stack.Screen name="Income" component={IncomeScreen} options={{ title: 'Income' }} />
        <Stack.Screen
          name="BinaryCalculator"
          component={BinaryCalculatorScreen}
          options={{ title: 'Binary calculator' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
