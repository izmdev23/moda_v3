import React from 'react';
import {
    Platform,
    Pressable,
    PressableProps,
    PressableStateCallbackType,
    StyleProp,
    ViewStyle,
} from 'react-native';

const DEFAULT_ACTIVE_OPACITY = 0.82;
const DEFAULT_RIPPLE_COLOR = 'rgba(0, 0, 0, 0.12)';

export interface RipplePressableProps extends Omit<PressableProps, 'style' | 'android_ripple'> {
    readonly style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
    readonly activeOpacity?: number;
    readonly rippleColor?: string;
    readonly disableRipple?: boolean;
}

/**
 * Native Pressable wrapper with Android ripple and iOS/Android pressed opacity.
 * Keeps the same ergonomics as TouchableOpacity while using native ripple feedback.
 */
export const RipplePressable: React.FC<RipplePressableProps> = ({
    style,
    activeOpacity = DEFAULT_ACTIVE_OPACITY,
    rippleColor = DEFAULT_RIPPLE_COLOR,
    disableRipple = false,
    children,
    disabled = false,
    ...rest
}) => {
    const resolvedStyle = ({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> => {
        const baseStyle = typeof style === 'function' ? style({ pressed }) : style;

        if (!pressed || disabled || activeOpacity >= 1) {
            return baseStyle;
        }

        return [baseStyle, { opacity: activeOpacity }];
    };

    return (
        <Pressable
            {...rest}
            disabled={disabled}
            style={resolvedStyle}
            android_ripple={
                Platform.OS === 'android' && !disableRipple
                    ? {
                        color: rippleColor,
                        foreground: true,
                    }
                    : undefined
            }
        >
            {children}
        </Pressable>
    );
};
