/**
 * Re-exports the canonical theme from `constants/theme.ts`.
 *
 * All imports from `utils/theme` continue to work unchanged while
 * making `constants/theme.ts` the single source of truth.
 */
export { darkPalette, lightPalette, theme, ThemeColors, ThemeType } from '../constants/theme';

