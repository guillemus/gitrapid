import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import { defineConfig, globalIgnores } from 'eslint/config'
import importPlugin from 'eslint-plugin-import'

const eslintConfig = defineConfig([
    ...nextVitals,
    ...nextTs,
    // Override default ignores of eslint-config-next.
    globalIgnores([
        // Default ignores of eslint-config-next:
        '.next/**',
        'out/**',
        'build/**',
        'next-env.d.ts',
    ]),
    {
        plugins: {
            import: importPlugin,
        },
        rules: {
            'prefer-const': 'off',
            '@typescript-eslint/no-namespace': 'off',
            'import/no-cycle': 'error',
        },
    },
])

export default eslintConfig
