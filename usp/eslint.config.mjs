// Module boundaries on the frontend (MOD-08, §5.3): features import only from shared/platform code and
// other modules' public manifest (modules/<key>/index.ts); never from another module's features.
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', 'backend/**', 'apps/mobile/.expo/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['apps/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'import/resolver': { node: { extensions: ['.ts', '.tsx', '.js', '.jsx'] } },
      // Folder patterns from the repo root (partialMatch: false). First match wins, so features come before modules.
      'boundaries/elements': [
        { type: 'app', pattern: 'apps/*/src/app', partialMatch: false },
        { type: 'platform', pattern: 'apps/*/src/platform', partialMatch: false },
        { type: 'shared', pattern: 'apps/*/src/shared', partialMatch: false },
        { type: 'feature', pattern: 'apps/*/src/modules/*/features/*', capture: ['app', 'module', 'feature'], partialMatch: false },
        { type: 'module', pattern: 'apps/*/src/modules/*', capture: ['app', 'module'], partialMatch: false },
        { type: 'routes', pattern: 'apps/mobile/app', partialMatch: false },
      ],
    },
    rules: {
      'boundaries/dependencies': ['error', {
        default: 'allow',
        policies: [
          // A feature never imports another module's features, nor the app shell or platform features.
          { from: { element: { type: 'feature' } }, disallow: { to: { element: { type: 'feature', captured: { module: '!{{ from.captured.module }}' } } } } },
          { from: { element: { type: 'feature' } }, disallow: { to: { element: { types: { anyOf: ['app', 'platform', 'routes'] } } } } },
          { from: { element: { type: 'module' } }, disallow: { to: { element: { type: 'feature', captured: { module: '!{{ from.captured.module }}' } } } } },
          { from: { element: { type: 'platform' } }, disallow: { to: { element: { type: 'feature' } } } },
          { from: { element: { type: 'shared' } }, disallow: { to: { element: { types: { anyOf: ['feature', 'module', 'platform', 'app'] } } } } },
        ],
      }],
    },
  },
);
