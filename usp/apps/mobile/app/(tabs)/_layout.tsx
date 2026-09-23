import { Tabs } from 'expo-router';
import { TabBar } from '../../src/shared/TabBar';

/** The five tabs of the prototype, on its floating glass tab bar with the search island. */
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="inbox" />
      <Tabs.Screen name="services" />
      <Tabs.Screen name="requests" />
      <Tabs.Screen name="me" />
    </Tabs>
  );
}
