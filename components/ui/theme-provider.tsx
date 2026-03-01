import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import { theme as appTheme, ThemeColors, ThemeType } from '../../utils/theme';

interface ThemeContextProps {
    theme: ThemeColors;
    isDark: boolean;
    themeType: ThemeType;
    toggleTheme: () => void;
    setThemePref: (type: ThemeType | 'system') => void;
}

const THEME_STORAGE_KEY = '@moda_theme_pref';

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [themePref, setThemePrefState] = useState<ThemeType | 'system'>('system');
    const [systemTheme, setSystemTheme] = useState<ColorSchemeName>(Appearance.getColorScheme());

    useEffect(() => {
        const loadTheme = async () => {
            const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
            if (stored === 'light' || stored === 'dark' || stored === 'system') {
                setThemePrefState(stored as ThemeType | 'system');
            }
        };
        loadTheme();

        const subscription = Appearance.addChangeListener(({ colorScheme }) => {
            setSystemTheme(colorScheme);
        });

        return () => subscription.remove();
    }, []);

    const setThemePref = async (pref: ThemeType | 'system') => {
        setThemePrefState(pref);
        await AsyncStorage.setItem(THEME_STORAGE_KEY, pref);
    };

    const toggleTheme = async () => {
        const activeTheme = isDark ? 'light' : 'dark';
        await setThemePref(activeTheme);
    };

    const isDark = themePref === 'system' ? systemTheme === 'dark' : themePref === 'dark';
    const currentThemeMode: ThemeType = isDark ? 'dark' : 'light';
    const themeColors = appTheme[currentThemeMode];

    return (
        <ThemeContext.Provider value={{
            theme: themeColors,
            isDark,
            themeType: currentThemeMode,
            toggleTheme,
            setThemePref
        }}>
            {children}
        </ThemeContext.Provider>
    );
};
