import React, { useCallback, useRef } from 'react';
import { AccessibilityRole } from 'react-native';

import { RipplePressable, RipplePressableProps } from '@/components/ui/ripple-pressable';

export interface AccessibleTouchableProps extends Omit<RipplePressableProps, 'onPress'> {
    readonly accessibilityRole?: AccessibilityRole;
    readonly accessibilityLabel: string;
    readonly accessibilityHint?: string;
    readonly onPress: () => void;
    readonly debounceTimeMs?: number;
}

/**
 * Custom touchable wrapper with debouncing and mandatory accessibility labels.
 * Designed to avoid double-tap issues and enforce accessiblity standards
 * @param props {AccessibleTouchableProps}
 */
export const AccessibleTouchable: React.FC<AccessibleTouchableProps> = ({
    onPress,
    accessibilityLabel,
    accessibilityHint,
    accessibilityRole = 'button',
    debounceTimeMs = 300,
    style,
    children,
    activeOpacity = 0.7,
    ...rest
}) => {
    const lastTap = useRef<number>(0);

    const debouncedOnPress = useCallback(() => {
        const now = Date.now();
        if (now - lastTap.current > debounceTimeMs) {
            lastTap.current = now;
            onPress();
        }
    }, [onPress, debounceTimeMs]);

    return (
        <RipplePressable
            onPress={debouncedOnPress}
            activeOpacity={activeOpacity}
            style={style}
            accessible={true}
            accessibilityLabel={accessibilityLabel}
            accessibilityHint={accessibilityHint}
            accessibilityRole={accessibilityRole}
            {...rest}
        >
            {children}
        </RipplePressable>
    );
};
