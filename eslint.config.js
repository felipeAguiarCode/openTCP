import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

const pureLayers = ['src/domain/**/*.ts', 'src/application/**/*.ts'];

export default tseslint.config(
  { ignores: ['dist/**', 'card-campaign/**', 'node_modules/**', 'public/vendor/**', '.specs/**', '.venv/**', 'src/content/generated/**', '.claude/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-restricted-globals': ['error', { name: 'eval', message: 'Cartas e efeitos são dados; eval é proibido.' }],
      'no-new-func': 'error',
    },
  },
  {
    // Domínio e aplicação: funções puras, sem classes, sem DOM, Three.js, SQLite ou apresentação.
    files: pureLayers,
    rules: {
      'no-restricted-syntax': ['error',
        { selector: 'ClassDeclaration', message: 'Código de domínio usa funções e dados, sem classes.' },
        { selector: 'ClassExpression', message: 'Código de domínio usa funções e dados, sem classes.' },
        { selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']", message: 'Use os streams de RNG do domínio.' },
      ],
      'no-restricted-imports': ['error', { patterns: [
        { group: ['three', 'three/*'], message: 'Domínio/aplicação não importam Three.js.' },
        { group: ['@sqlite.org/*'], message: 'Domínio/aplicação não importam SQLite.' },
        { group: ['preact', 'preact/*', '@preact/*'], message: 'Domínio/aplicação não importam UI.' },
        { group: ['**/presentation/**', '**/infrastructure/**'], message: 'Dependência proibida de camada externa.' },
      ] }],
    },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', 'window', 'document', 'navigator', 'localStorage', 'indexedDB', 'eval'],
    },
  },
);
