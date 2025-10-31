import { defineConfig } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
    {
        ignores: ['**/node_modules', '**/_generated', '**/dist', './convex/_generated/*'],
    },
    {
        files: [
            './convex/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
            './src/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
        ],
        ignores: ['./convex/_generated/*', './src/routeTree.gen.ts'],
        plugins: {
            '@typescript-eslint': tseslint.plugin,
        },
        languageOptions: {
            globals: { ...globals.browser, ...globals.node },
            parser: tseslint.parser,
            parserOptions: {
                project: true,
            },
        },
        rules: {
            '@typescript-eslint/no-unnecessary-condition': 'error',
            '@typescript-eslint/strict-boolean-expressions': [
                'error',
                {
                    allowNullableBoolean: true,
                    allowNullableString: true,
                },
            ],
        },
    },
])
