import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import google from 'eslint-config-google';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    ...google,
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2019,
        sourceType: 'module',
      },
    },
    rules: {
      'require-jsdoc': 'off',
      'valid-jsdoc': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_'}],
    },
  },
);
