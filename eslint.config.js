// @ts-check

import js from '@eslint/js'
import pluginReact from 'eslint-plugin-react'
import reacthooks from 'eslint-plugin-react-hooks'
import { defineConfig } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
    {
        ignores: ['convex/_generated/**'],
    },
    {
        files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        plugins: { js },
        extends: ['js/recommended'],
    },
    {
        files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        languageOptions: { globals: globals.browser },
    },
    tseslint.configs.recommended,
    pluginReact.configs.flat.recommended,

    reacthooks.configs['recommended-latest'],
    {
        files: ['**/*.{ts,mts,cts,tsx}'],
        languageOptions: {
            parserOptions: {
                project: './tsconfig.json',
                tsconfigRootDir: import.meta.dirname,
            },
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
        rules: {
            '@typescript-eslint/restrict-template-expressions': 'error',
            'react/react-in-jsx-scope': 'off',
            'prefer-const': 'off',
            // Prevent discarding promise return values
            '@typescript-eslint/no-floating-promises': 'error',
            // Prevent discarding function return values (works without type info)
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    ignoreRestSiblings: true,
                },
            ],
        },
    },
])
