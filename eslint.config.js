const globals = require('globals');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = [
    {
        ignores: ['icons/**', 'img/**', 'node_modules/**', 'js/components/sortable.min.js'],
    },
    {
        languageOptions: {
            ecmaVersion: 12,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                // 扩展与项目内 window 全局
                chrome: 'readonly',
                Sortable: 'readonly',
                NewTabApp: 'readonly',
                AdvancedPagination: 'readonly',
                SearchManager: 'readonly',
                QuickAccessManager: 'readonly',
                WallpaperManager: 'readonly',
                SettingsManager: 'readonly',
                WeatherManager: 'readonly',
                SELECTORS: 'readonly',
                BingWallpaper: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': ['warn', { args: 'none' }],
            'no-console': 'off',
        },
    },
    eslintPluginPrettierRecommended,
];
