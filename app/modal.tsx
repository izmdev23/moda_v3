import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { SafeScreen } from '@/components/ui/safe-screen';
import Animated from 'react-native-reanimated';
import { Animation } from '../utils/animation';

export default function ModalScreen() {
  return (
    <SafeScreen style={styles.container}>
      <Animated.View
        entering={Animation.Presets.FadeInDown}
        exiting={Animation.Presets.FadeOutUp}
        style={styles.content}
      >
        <ThemedText type="title">This is a modal</ThemedText>
        <Link href="/" dismissTo style={styles.link}>
          <ThemedText type="link">Go to home screen</ThemedText>
        </Link>
      </Animated.View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
