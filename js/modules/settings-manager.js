/**
 * 设置管理模块
 * 负责应用设置的管理、存储和加载
 */
class SettingsManager {
    constructor() {
        this.defaultSettings = {
            pexelsApiKey: '',
            weatherApiKey: '',
            weatherCity: '',
            temperatureUnit: 'celsius',
            wallpaperQuery: 'Nature',
            searchEngine: 'Bing',
            tagline: '',
            wallpaperBrightness: 1,
            wallpaperBlur: 0,
        };
        this.settings = { ...this.defaultSettings };
        this.customEngines = []; // 自定义搜索引擎 [{name, url(%s 占位)}]
    }

    // 初始化设置
    async init() {
        await this.migrateLegacySettings();
        await this.loadSettings();
    }

    // 一次性迁移与清理旧键，确保仅使用集中 settings（原 main.js 逻辑）
    async migrateLegacySettings() {
        const legacyKeys = ['pexelsApiKey', 'weatherCity', 'temperatureUnit', 'weatherApiKey'];
        const data = await chrome.storage.local.get(['settings', ...legacyKeys]);
        const settings = { ...(data.settings || {}) };
        let changed = false;
        legacyKeys.forEach(k => {
            if (typeof data[k] !== 'undefined' && data[k] !== null && data[k] !== '') {
                settings[k] = data[k];
                changed = true;
            }
        });
        if (changed) {
            await chrome.storage.local.set({ settings });
            await chrome.storage.local.remove(legacyKeys);
            console.log('已迁移并清理旧设置键:', legacyKeys);
        }
    }

    // 从设置面板一次性保存（Pexels Key 可选：清空即移除，回 Bing 免 Key 模式）
    async saveFromPanel({ pexelsApiKey, weatherApiKey, weatherCity }) {
        if (typeof pexelsApiKey === 'string') {
            this.settings.pexelsApiKey = pexelsApiKey.trim();
        }
        if (typeof weatherApiKey === 'string' && weatherApiKey.trim()) {
            this.settings.weatherApiKey = weatherApiKey.trim();
        }
        if (typeof weatherCity === 'string') {
            this.settings.weatherCity = weatherCity.trim(); // 可为空字符串，表示自动定位
        }
        await this.saveSettings();
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

    // 获取天气API密钥
    getWeatherApiKey() {
        return this.settings.weatherApiKey;
    }

    // 设置天气API密钥
    async setWeatherApiKey(apiKey) {
        await this.setSetting('weatherApiKey', apiKey);
    }

    // 获取天气城市
    getWeatherCity() {
        return this.settings.weatherCity;
    }

    // 设置天气城市
    async setWeatherCity(city) {
        await this.setSetting('weatherCity', city);
    }

    // 获取温度单位
    getTemperatureUnit() {
        return this.settings.temperatureUnit;
    }

    // 设置温度单位
    async setTemperatureUnit(unit) {
        await this.setSetting('temperatureUnit', unit);
    }

    // 获取壁纸搜索关键词
    getWallpaperQuery() {
        return this.settings.wallpaperQuery;
    }

    // 设置壁纸搜索关键词
    async setWallpaperQuery(query) {
        await this.setSetting('wallpaperQuery', query);
    }

    // ---------- v1.2.0 新增：标语 / 自定义引擎 / 壁纸调节 ----------

    // 获取首页标语（空 = 不显示）
    getTagline() {
        return this.settings.tagline || '';
    }

    // 设置首页标语
    async setTagline(tagline) {
        await this.setSetting('tagline', tagline || '');
    }

    // 壁纸亮度（0.3 ~ 1）与模糊度（0 ~ 20px）
    getWallpaperAdjustments() {
        return {
            brightness: Number(this.settings.wallpaperBrightness) || 1,
            blur: Number(this.settings.wallpaperBlur) || 0,
        };
    }

    // 保存壁纸调节（clamp 防越界）
    async setWallpaperAdjustments(brightness, blur) {
        const b = Math.min(1, Math.max(0.3, Number(brightness) || 1));
        const bl = Math.min(20, Math.max(0, Number(blur) || 0));
        this.settings.wallpaperBrightness = b;
        this.settings.wallpaperBlur = bl;
        await this.saveSettings();
        return { brightness: b, blur: bl };
    }

    // 自定义搜索引擎（chrome.storage.local 独立键，避免混入 settings 数值型默认值）
    async loadCustomEngines() {
        return new Promise(resolve => {
            chrome.storage.local.get(['customEngines'], result => {
                this.customEngines = Array.isArray(result.customEngines)
                    ? result.customEngines
                    : [];
                resolve(this.customEngines);
            });
        });
    }

    getCustomEngines() {
        return this.customEngines;
    }

    async saveCustomEngines(engines) {
        this.customEngines = Array.isArray(engines) ? engines : [];
        return new Promise(resolve => {
            chrome.storage.local.set({ customEngines: this.customEngines }, resolve);
        });
    }

    // 添加自定义引擎（name 非空、url 必须含 %s 占位；重名拒绝）
    async addCustomEngine(name, url) {
        const n = (name || '').trim();
        const u = (url || '').trim();
        if (!n || !u || !u.includes('%s')) {
            return { ok: false, message: '名称与搜索链接（含 %s 占位符）均不能为空' };
        }
        if (!/^https?:\/\//i.test(u)) {
            return { ok: false, message: '搜索链接必须以 http(s):// 开头' };
        }
        if (this.customEngines.some(e => e.name.toLowerCase() === n.toLowerCase())) {
            return { ok: false, message: `已存在同名引擎「${n}」` };
        }
        this.customEngines.push({ name: n, url: u });
        await this.saveCustomEngines(this.customEngines);
        return { ok: true };
    }

    async removeCustomEngine(name) {
        const before = this.customEngines.length;
        this.customEngines = this.customEngines.filter(e => e.name !== name);
        await this.saveCustomEngines(this.customEngines);
        return this.customEngines.length < before;
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
