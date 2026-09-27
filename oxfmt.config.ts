// oxfmt.config.ts (在项目根目录)
import { defineConfig } from 'oxfmt';

export default defineConfig({
  semi: true,
  printWidth: 100,
  tabWidth: 2,
  singleQuote: true,
  trailingComma: 'es5',
  endOfLine: 'lf',
  arrowParens: 'avoid',
  bracketSpacing: true,
  bracketSameLine: false,
  singleAttributePerLine: false,
  sortPackageJson: false,
  ignorePatterns: [
    'yarn.lock',
    'pnpm-lock.yaml',
    '**/map.js',
    '**/*.hbs',
    '**/*.md',
    '**/*.mdx',
    '**/*.map.js',
    '**/*.min.js',
    '**/node_modules/',
    '**/build/',
    '**/assets/',
    '**/dist/',
    '**/bin/',
    '**/lib/',
    'data/',
    '.data/',
    'logs/',
  ],
  sortImports: {
    groups: [
      ['builtin', 'external'],
      ['internal', 'subpath'],
      ['parent', 'sibling', 'index'],
      'unknown',
    ],
    ignoreCase: false,
  },
});
