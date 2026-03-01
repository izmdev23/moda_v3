import Animated from 'react-native-reanimated';
import { Animation } from '../utils/animation';

export function HelloWave() {
  return (
    <Animated.Text
      style={{
        fontSize: 28,
        lineHeight: 32,
        marginTop: -6,
        animationName: {
          '50%': { transform: [{ rotate: '25deg' }] },
        },
        animationIterationCount: 4,
        animationDuration: `${Animation.DefaultAnimationSpeed}ms`,
      }}>
      👋
    </Animated.Text>
  );
}
