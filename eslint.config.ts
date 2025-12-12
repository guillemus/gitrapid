import importPlugin from 'eslint-plugin-import'
import tseslint from 'typescript-eslint'

export default tseslint.config(
    {
        ignores: ['**/*', '!src/**'],
    },
    ...tseslint.configs.strictTypeChecked,
    {
        files: ['src/**/*.ts', 'src/**/*.tsx'],
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        plugins: {
            import: importPlugin,
        },
        rules: {
            'prefer-const': 'off',
            'import/no-cycle': 'error',
            '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
            '@typescript-eslint/no-misused-promises': 'off',
            '@typescript-eslint/no-confusing-void-expression': 'off',
        },
    },
)
