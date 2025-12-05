import importPlugin from 'eslint-plugin-import'
import tseslint from 'typescript-eslint'

export default tseslint.config(
    {
        ignores: ['.vercel/**', '.tanstack/**'],
    },
    ...tseslint.configs.recommended,
    {
        files: ['src/**/*.ts', 'src/**/*.tsx'],
        plugins: {
            import: importPlugin,
        },
        rules: {
            'prefer-const': 'off',
            '@typescript-eslint/no-namespace': 'off',
            'import/no-cycle': 'error',
        },
    },
)
