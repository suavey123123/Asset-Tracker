import js from '@eslint/js'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  js.configs.recommended,
  react.configs.flat.recommended,
  {
    files: ['**/*.{js,jsx,mjs}'],
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
    settings: { react: { version: '18.2' } },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },
]
