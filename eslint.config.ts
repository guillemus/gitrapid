import importPlugin from 'eslint-plugin-import'
import tseslint from 'typescript-eslint'

export default tseslint.config(
    {
        ignores: ['.vercel/**', '.tanstack/**', './dist'],
    },
    ...tseslint.configs.recommended,
    {
        files: ['src/**/*.ts', 'src/**/*.tsx'],
        plugins: {
            import: importPlugin,
        },
        rules: {
            'prefer-const': 'off',
            'import/no-cycle': 'error',
        },
    },
)
