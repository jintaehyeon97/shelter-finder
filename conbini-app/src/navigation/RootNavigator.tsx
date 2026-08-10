import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import MapScreen from '@/screens/MapScreen';
import RecommendScreen from '@/screens/RecommendScreen';
import SearchScreen from '@/screens/SearchScreen';
import { ConvenienceStore } from '@/types/store';
import { Shelter } from '@/types/shelter';
import { Colors } from '@/theme/colors';

export type RootTabParamList = {
  Map:
    | {
        focusStore?: ConvenienceStore;
        focusShelter?: Shelter;
        navKey?: number; // 같은 대상을 다시 눌러도 포커스가 재실행되도록 매번 다른 값
      }
    | undefined;
  Recommend: undefined;
  Search: undefined;
};

type IconName = keyof typeof Ionicons.glyphMap;

const TAB_ICONS: Record<keyof RootTabParamList, { active: IconName; inactive: IconName }> = {
  Map: { active: 'map', inactive: 'map-outline' },
  Recommend: { active: 'sparkles', inactive: 'sparkles-outline' },
  Search: { active: 'search', inactive: 'search-outline' },
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function RootNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle: { backgroundColor: Colors.background, elevation: 0, shadowOpacity: 0 },
        headerTitleStyle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
        headerTintColor: Colors.textPrimary,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.neutral,
        tabBarStyle: {
          backgroundColor: Colors.background,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          height: 62,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name as keyof RootTabParamList];
          return (
            <Ionicons
              name={focused ? icons.active : icons.inactive}
              size={size ?? 22}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen name="Map" component={MapScreen} options={{ title: '지도' }} />
      <Tab.Screen name="Recommend" component={RecommendScreen} options={{ title: '추천' }} />
      <Tab.Screen name="Search" component={SearchScreen} options={{ title: '검색' }} />
    </Tab.Navigator>
  );
}
