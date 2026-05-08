import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      // Apostrophes in copy are fine — AI-drafted JD/email text is full of them
      // and the React rule was triggering on every "Vaivamm's" and "we'll".
      'react/no-unescaped-entities': 'off',
    },
  },
];
