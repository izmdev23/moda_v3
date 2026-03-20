/**
 * Central theme definition for the Moda app.
 * ALL color references in screens and components MUST use this file
 * via the `useTheme()` hook from `components/ui/theme-provider.tsx`.
 *
 * Never hard-code color hex values in StyleSheet or inline styles.
 */

// ─── ThemeColors Interface ────────────────────────────────────────────────────

export interface ThemeColors {
  /** Brand primary color (used for buttons, links, accents) */
  readonly primary: string;
  /** Screen / page background */
  readonly background: string;
  /** Card / surface background */
  readonly cardBackground: string;
  /** High-contrast body text */
  readonly textPrimary: string;
  /** Lower-contrast secondary / label text */
  readonly textSecondary: string;
  /** Dividers, input borders, card outlines */
  readonly border: string;
  /** Error states and danger actions */
  readonly error: string;
  /** Success badges, confirmation indicators */
  readonly success: string;
  /** Warning / cautionary indicators */
  readonly warning: string;
  /** Informational highlights */
  readonly info: string;
  /** Pure white - overlays, text on dark backgrounds */
  readonly white: string;
  /** Pure black */
  readonly black: string;
  /** Muted grey for placeholders and icons */
  readonly gray: string;
  /** Yellow gold color for star ratings */
  readonly starColor: string;
  /** Transparent (convenience alias) */
  readonly transparent: string;
}

// ─── Light Palette ────────────────────────────────────────────────────────────

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
  starColor: '#FFCC00',
  transparent: 'transparent',
};

// ─── Dark Palette ─────────────────────────────────────────────────────────────

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
  starColor: '#FFCC00',
  transparent: 'transparent',
};

// ─── Theme Map ────────────────────────────────────────────────────────────────

export type ThemeType = 'light' | 'dark';

export const theme: Record<ThemeType, ThemeColors> = {
  light: lightPalette,
  dark: darkPalette,
};
