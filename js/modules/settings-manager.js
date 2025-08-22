/**
 * 设置管理模块
 * 负责应用设置的管理、存储和加载
 */
class SettingsManager {
    constructor() {
        this.defaultSettings = {
            pexelsApiKey: '',
            wallpaperQuery: 'Nature',
            searchEngine: 'Baidu'
        };
        this.settings = { ...this.defaultSettings };
    }

    // 初始化设置
    async init() {
        await this.loadSettings();
    }

    // 加载设置
    async loadSettings() {
        try {
            const result = await chrome.storage.local.get(['settings']);
            this.settings = { ...this.defaultSettings, ...result.settings };
        } catch (error) {
            console.error('加载设置失败:', error);
            this.settings = { ...this.defaultSettings };
        }
    }

    // 保存设置
    async saveSettings() {
        try {
            await chrome.storage.local.set({ settings: this.settings });
        } catch (error) {
            console.error('保存设置失败:', error);
        }
    }

    // 获取设置值
    getSetting(key) {
        return this.settings[key];
    }

    // 设置值
    async setSetting(key, value) {
        this.settings[key] = value;
        await this.saveSettings();
    }

    // 获取所有设置
    getAllSettings() {
        return { ...this.settings };
    }

    // 重置为默认设置
    async resetToDefault() {
        this.settings = { ...this.defaultSettings };
        await this.saveSettings();
    }

    // 获取Pexels API密钥
    getPexelsApiKey() {
        return this.settings.pexelsApiKey;
    }

    // 设置Pexels API密钥
    async setPexelsApiKey(apiKey) {
        await this.setSetting('pexelsApiKey', apiKey);
    }

    // 获取壁纸搜索关键词
    getWallpaperQuery() {
        return this.settings.wallpaperQuery;
    }

    // 设置壁纸搜索关键词
    async setWallpaperQuery(query) {
        await this.setSetting('wallpaperQuery', query);
    }

    // 获取搜索引擎
    getSearchEngine() {
        return this.settings.searchEngine;
    }

    // 设置搜索引擎
    async setSearchEngine(engine) {
        await this.setSetting('searchEngine', engine);
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsManager;
} else {
    window.SettingsManager = SettingsManager;
}
