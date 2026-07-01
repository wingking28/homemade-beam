import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '../../src/constants/theme';
import { TabNavigationContext } from '../../src/context/TabNavigationContext';

import HomeScreen from './index';
import FriendsScreen from './friends';
import GroupsScreen from './groups';
import ActivityScreen from './activity';
import ProfileScreen from './profile';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; icon: IoniconsName; Screen: React.ComponentType }[] = [
  { name: 'Home',     icon: 'home',    Screen: HomeScreen },
  { name: 'Friends',  icon: 'people',  Screen: FriendsScreen },
  { name: 'Groups',   icon: 'albums',  Screen: GroupsScreen },
  { name: 'Activity', icon: 'receipt', Screen: ActivityScreen },
  { name: 'Profile',  icon: 'person',  Screen: ProfileScreen },
];

const SPRING_CONFIG = { damping: 20, stiffness: 200, mass: 0.8 };

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);

  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);

  const goToTab = useCallback(
    (index: number) => {
      setActiveIndex(index);
      translateX.value = withSpring(-index * width, SPRING_CONFIG);
    },
    [width],
  );

  const panGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onBegin(() => {
      startX.value = translateX.value;
    })
    .onUpdate(({ translationX }) => {
      const next = startX.value + translationX;
      const minX = -(TABS.length - 1) * width;
      translateX.value = Math.max(minX, Math.min(0, next));
    })
    .onEnd(({ velocityX }) => {
      const closestPage = Math.round(-translateX.value / width);
      let target = Math.max(0, Math.min(TABS.length - 1, closestPage));

      if (velocityX < -500 && target < TABS.length - 1) target += 1;
      else if (velocityX > 500 && target > 0) target -= 1;

      translateX.value = withSpring(-target * width, SPRING_CONFIG);
      runOnJS(setActiveIndex)(target);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <TabNavigationContext.Provider value={{ goToTab }}>
      <View style={styles.container}>
        <GestureDetector gesture={panGesture}>
          <View style={styles.pager}>
            <Animated.View style={[{ flexDirection: 'row', flex: 1, width: width * TABS.length }, animatedStyle]}>
              {TABS.map(({ Screen }, i) => (
                <View key={i} style={{ width, flex: 1 }}>
                  <Screen />
                </View>
              ))}
            </Animated.View>
          </View>
        </GestureDetector>

        <View style={[styles.tabBar, { paddingBottom: insets.bottom + 4, height: 60 + insets.bottom }]}>
          {TABS.map(({ name, icon }, i) => {
            const active = i === activeIndex;
            const color = active ? Colors.primary : Colors.textMuted;
            return (
              <TouchableOpacity key={i} style={styles.tabItem} onPress={() => goToTab(i)}>
                <Ionicons name={icon} size={24} color={color} />
                <Text style={[styles.tabLabel, { color }]}>{name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </TabNavigationContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  pager: { flex: 1, overflow: 'hidden' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    paddingTop: 8,
  },
  tabLabel: { fontSize: 11, fontWeight: '600' },
});
