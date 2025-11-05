import neostandard from 'neostandard'
import tseslint from 'typescript-eslint'
import process from 'node:process'

const ignores = ['node_modules', 'temp', 'logs', 'data', 'dist', 'lib']

export default [
  ...neostandard({
    ignores,
    ts: true,
    globals: {
      Bot: 'readonly',
      redis: 'readonly',
      plugin: 'readonly',
      segment: 'readonly',
      logger: 'readonly'
    }
  }),
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      '@typescript-eslint': tseslint.plugin
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: process.cwd()
      }
    },
    rules: {
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-floating-promises': 'warn',
      'no-void': ['error', { allowAsStatement: true }]
    }
  }
]
