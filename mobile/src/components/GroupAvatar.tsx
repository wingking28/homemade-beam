import { View, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';

interface GroupAvatarProps {
  uri?: string;
  size?: number;
}

export function GroupAvatar({ uri, size = 40 }: GroupAvatarProps) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Ionicons name="people" size={size * 0.55} color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
  },
});
