import { RipplePressable } from '@/components/ui/ripple-pressable';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useTheme } from './theme-provider';

const OPEN_ANIMATION_DURATION_MS = 260;
const CLOSE_ANIMATION_DURATION_MS = 220;
const DROPDOWN_OPEN_EASING = Easing.out(Easing.cubic);
const DROPDOWN_CLOSE_EASING = Easing.in(Easing.cubic);
const DROPDOWN_TOP_OFFSET = 6;

export interface DropdownOption<TValue extends string> {
    readonly value: TValue;
    readonly label: string;
}

export interface InlineDropdownProps<TValue extends string> {
    readonly label: string;
    readonly value: TValue | '';
    readonly options: readonly DropdownOption<TValue>[];
    readonly onSelect: (value: TValue) => void;
    readonly placeholder?: string;
    readonly error?: string;
}

/**
 * Reusable inline dropdown selector that expands beneath the trigger field.
 * This component does not use a modal or bottom-sheet.
 */
export function InlineDropdown<TValue extends string>({
    label,
    value,
    options,
    onSelect,
    placeholder = 'Select option',
    error,
}: InlineDropdownProps<TValue>): React.JSX.Element {
    const { theme } = useTheme();
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [shouldRenderOptions, setShouldRenderOptions] = useState<boolean>(false);
    const [triggerLayout, setTriggerLayout] = useState<{ readonly y: number; readonly height: number }>({ y: 0, height: 48 });
    const dropdownAnimation = useRef<Animated.Value>(new Animated.Value(0)).current;

    const runDropdownAnimation = useCallback((open: boolean): void => {
        if (open) {
            setShouldRenderOptions(true);
        }

        Animated.timing(dropdownAnimation, {
            toValue: open ? 1 : 0,
            duration: open ? OPEN_ANIMATION_DURATION_MS : CLOSE_ANIMATION_DURATION_MS,
            easing: open ? DROPDOWN_OPEN_EASING : DROPDOWN_CLOSE_EASING,
            useNativeDriver: true,
        }).start(({ finished }) => {
            if (finished && !open) {
                setShouldRenderOptions(false);
            }
        });
    }, [dropdownAnimation]);

    useEffect((): (() => void) => {
        return (): void => {
            dropdownAnimation.stopAnimation();
        };
    }, [dropdownAnimation]);

    const selectedLabel = useMemo((): string => {
        if (value === '') {
            return '';
        }
        const selectedOption = options.find((option) => option.value === value);
        return selectedOption?.label ?? '';
    }, [options, value]);

    const animatedOptionsStyle = useMemo(() => ({
        opacity: dropdownAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 1],
        }),
        transform: [
            {
                translateY: dropdownAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                }),
            },
        ],
    }), [dropdownAnimation]);

    const handleToggleDropdown = useCallback((): void => {
        setIsOpen((previousOpen) => {
            const nextOpen = !previousOpen;
            runDropdownAnimation(nextOpen);
            return nextOpen;
        });
    }, [runDropdownAnimation]);

    const handleSelectOption = useCallback((selectedValue: TValue): void => {
        onSelect(selectedValue);
        setIsOpen(false);
        runDropdownAnimation(false);
    }, [onSelect, runDropdownAnimation]);

    return (
        <View style={[styles.container, shouldRenderOptions ? styles.containerElevated : null]}>
            <Text style={[styles.label, { color: theme.textPrimary }]}>{label}</Text>

            <RipplePressable
                style={[
                    styles.trigger,
                    {
                        borderColor: error ? theme.error : theme.border,
                        backgroundColor: theme.cardBackground,
                    },
                    error ? { backgroundColor: `${theme.error}10` } : null,
                ]}
                onPress={handleToggleDropdown}
                activeOpacity={0.7}
                onLayout={(event) => {
                    setTriggerLayout({
                        y: event.nativeEvent.layout.y,
                        height: event.nativeEvent.layout.height,
                    });
                }}
            >
                <Text
                    style={[
                        styles.triggerText,
                        { color: selectedLabel.length > 0 ? theme.textPrimary : theme.gray },
                    ]}
                    numberOfLines={1}
                >
                    {selectedLabel.length > 0 ? selectedLabel : placeholder}
                </Text>
                <Text style={[styles.triggerChevron, { color: theme.gray }]}>{isOpen ? '▴' : '▾'}</Text>
            </RipplePressable>

            {shouldRenderOptions ? (
                <Animated.View
                    style={[
                        styles.optionsAnimatedWrapper,
                        {
                            top: triggerLayout.y + triggerLayout.height + DROPDOWN_TOP_OFFSET,
                        },
                        animatedOptionsStyle,
                    ]}
                >
                    <View style={[styles.optionsContainer, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}>
                    {options.map((option, index) => {
                        const isSelected = option.value === value;
                        const hasBottomBorder = index < options.length - 1;

                        return (
                            <RipplePressable
                                key={option.value}
                                style={[
                                    styles.option,
                                    hasBottomBorder ? { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth } : null,
                                    isSelected ? { backgroundColor: `${theme.primary}12` } : null,
                                ]}
                                onPress={() => handleSelectOption(option.value)}
                            >
                                <Text
                                    style={[
                                        styles.optionText,
                                        { color: isSelected ? theme.primary : theme.textPrimary },
                                        isSelected ? styles.optionTextSelected : null,
                                    ]}
                                >
                                    {option.label}
                                </Text>
                                {isSelected ? <Text style={[styles.selectedMark, { color: theme.primary }]}>✓</Text> : null}
                            </RipplePressable>
                        );
                    })}
                    </View>
                </Animated.View>
            ) : null}

            {error ? <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
        position: 'relative',
        zIndex: 1,
    },
    containerElevated: {
        zIndex: 500,
        elevation: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 6,
    },
    trigger: {
        borderWidth: 1,
        borderRadius: 8,
        minHeight: 48,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    triggerText: {
        flex: 1,
        fontSize: 16,
        marginRight: 8,
    },
    triggerChevron: {
        fontSize: 14,
        fontWeight: '700',
    },
    optionsContainer: {
        borderWidth: 1,
        borderRadius: 8,
        overflow: 'hidden',
        maxHeight: 260,
    },
    optionsAnimatedWrapper: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 600,
        elevation: 10,
    },
    option: {
        minHeight: 44,
        paddingHorizontal: 14,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    optionText: {
        fontSize: 15,
    },
    optionTextSelected: {
        fontWeight: '700',
    },
    selectedMark: {
        fontSize: 15,
        fontWeight: '700',
    },
    errorText: {
        fontSize: 12,
        marginTop: 4,
    },
});