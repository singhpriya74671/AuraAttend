import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import HomeScreen from "./src/screens/HomeScreen";
import CheckInScreen from "./src/screens/CheckInScreen";

const Stack = createStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: "#4f46e5" },
            headerTintColor: "#fff",
            headerTitleStyle: { fontWeight: "700" },
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: "AuraAttend" }} />
          <Stack.Screen name="CheckIn" component={CheckInScreen} options={{ title: "Mark Attendance" }} />
        </Stack.Navigator>
      </NavigationContainer>
      <Toast />
    </SafeAreaProvider>
  );
}
