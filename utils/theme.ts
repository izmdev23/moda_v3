export interface ThemeColors {
    primary: string;
    background: string;
    cardBackground: string;
    textPrimary: string;
    textSecondary: string;
    border: string;
    error: string;
    success: string;
    warning: string;
    info: string;
    white: string;
    black: string;
    gray: string;
    transparent: string;
}

export const lightPalette: ThemeColors = {
    primary: '#F44336',
    background: '#FAFAFA',
    cardBackground: '#FFFFFF',
    textPrimary: '#32325D',
    textSecondary: '#525F7F',
    border: '#E9ECEF',
    error: '#F5365C',
    success: '#2DCE89',
    warning: '#FB6340',
    info: '#11CDEF',
    white: '#FFFFFF',
    black: '#000000',
    gray: '#ADB5BD',
    transparent: 'transparent',
};

export const darkPalette: ThemeColors = {
    primary: '#F44336',
    background: '#202020',
    cardBackground: '#24262D',
    textPrimary: '#FFFFFF',
    textSecondary: '#ADB5BD',
    border: '#4A5568',
    error: '#F5365C',
    success: '#2DCE89',
    warning: '#FB6340',
    info: '#11CDEF',
    white: '#FFFFFF',
    black: '#000000',
    gray: '#ADB5BD',
    transparent: 'transparent',
};

export type ThemeType = 'light' | 'dark';

export const theme = {
    light: lightPalette,
    dark: darkPalette,
};
