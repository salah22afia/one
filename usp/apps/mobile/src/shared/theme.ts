import { useColorScheme } from 'react-native';

/** The prototype's design tokens (tokens.css v0.2 "identity"), light and dark, for React Native. Keep in step with @usp/ui-web. */
const light = {
  bg: '#fbf9f3', bgElev: '#ffffff', bgInset: '#f3efe4', bgInset2: '#e9e3d3',
  fg: '#16201b', fg2: '#5b6660', fg3: '#8a948e', fg4: '#b1b9b4',
  hair: 'rgba(22, 32, 27, 0.10)', hair2: 'rgba(22, 32, 27, 0.06)', rail: '#d8d1bd',
  tint: '#0b4a2f', tintFg: '#ffffff', tintSoft: 'rgba(11, 74, 47, 0.09)', tintSoft2: 'rgba(11, 74, 47, 0.16)',
  gold: '#b5944d', goldSoft: 'rgba(181, 148, 77, 0.16)',
  ok: '#2e7d4f', okSoft: 'rgba(46, 125, 79, 0.12)', warn: '#9a6a12', warnSoft: 'rgba(154, 106, 18, 0.14)',
  danger: '#b3352c', dangerSoft: 'rgba(179, 53, 44, 0.12)', info: '#25598f', infoSoft: 'rgba(37, 89, 143, 0.12)',
  glass: 'rgba(255, 255, 255, 0.72)', glassEdge: 'rgba(255, 255, 255, 0.75)', scrim: 'rgba(6, 20, 12, 0.42)',
  dark: false,
};
export type Theme = typeof light;
const dark: Theme = {
  bg: '#0f1411', bgElev: '#181e1a', bgInset: '#212925', bgInset2: '#2b3530',
  fg: '#eef1ec', fg2: '#aab3ad', fg3: '#7f8983', fg4: '#5c6660',
  hair: 'rgba(238, 241, 236, 0.10)', hair2: 'rgba(238, 241, 236, 0.06)', rail: '#2f3a34',
  tint: '#7cc5a2', tintFg: '#0b1d14', tintSoft: 'rgba(124, 197, 162, 0.13)', tintSoft2: 'rgba(124, 197, 162, 0.22)',
  gold: '#d4b978', goldSoft: 'rgba(212, 185, 120, 0.16)',
  ok: '#6fcf97', okSoft: 'rgba(111, 207, 151, 0.16)', warn: '#e0b25b', warnSoft: 'rgba(224, 178, 91, 0.16)',
  danger: '#f08a80', dangerSoft: 'rgba(240, 138, 128, 0.16)', info: '#7fb0e6', infoSoft: 'rgba(127, 176, 230, 0.16)',
  glass: 'rgba(20, 26, 22, 0.72)', glassEdge: 'rgba(255, 255, 255, 0.08)', scrim: 'rgba(0, 0, 0, 0.6)',
  dark: true,
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

/** Type scale (rem × 16) and radii of the prototype. */
export const type = { display: 44, large: 34, title1: 25.6, title2: 20.8, headline: 17, body: 17, callout: 16, sub: 14.4, foot: 13, cap: 12 };
export const radius = { ctl: 14, card: 22, sheet: 28, pill: 999 };
export const gutter = 20;

/** Cairo in its weights; the app loads them before first paint (see app/_layout.tsx). */
export const font = { regular: 'Cairo_400Regular', semibold: 'Cairo_600SemiBold', bold: 'Cairo_700Bold', heavy: 'Cairo_800ExtraBold' };
