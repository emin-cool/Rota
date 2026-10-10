import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/TabBar';
import { tr } from '@/i18n/tr';

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="map" options={{ title: tr.tabs.map }} />
      <Tabs.Screen name="explore" options={{ title: tr.tabs.explore }} />
      <Tabs.Screen name="record" options={{ title: tr.tabs.record }} />
      <Tabs.Screen name="feed" options={{ title: tr.tabs.feed }} />
      <Tabs.Screen name="profile" options={{ title: tr.tabs.profile }} />
    </Tabs>
  );
}
