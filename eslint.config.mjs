import js from '@eslint/js';

export default [
    js.configs.recommended,
    {
        languageOptions: {
            globals: {
                window: 'readonly',
                document: 'readonly',
                console: 'readonly',
                fetch: 'readonly',
                localStorage: 'readonly',
                sessionStorage: 'readonly',
                setTimeout: 'readonly',
                alert: 'readonly',
                confirm: 'readonly',
                btoa: 'readonly',
                atob: 'readonly',
                Math: 'readonly',
                Date: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': 'warn',
            'no-undef': 'error',
        },
    },
];
