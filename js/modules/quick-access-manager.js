/**
 * 快捷访问管理模块
 * 负责快捷访问项目的增删改查、存储管理
 */
class QuickAccessManager {
    constructor() {
        this.defaultSites = [
            { name: 'Google', url: 'https://www.google.com', icon: 'G' },
            { name: 'YouTube', url: 'https://www.youtube.com', icon: 'Y' },
            { name: 'GitHub', url: 'https://www.github.com', icon: 'G' },
            { name: 'Bilibili', url: 'https://www.bilibili.com', icon: 'B' },
            { name: '知乎', url: 'https://www.zhihu.com', icon: '知' },
            { name: 'Wikipedia', url: 'https://www.wikipedia.org', icon: 'W' },
            { name: 'Reddit', url: 'https://www.reddit.com', icon: 'R' },
            { name: 'V2EX', url: 'https://www.v2ex.com', icon: 'V' }
        ];
        this.sites = [];
        this.pagination = null;
    }

    // 初始化
    async init() {
        await this.loadSites();
        if (this.sites.length === 0) {
            this.sites = [...this.defaultSites];
            await this.saveSites();
        }
    }

    // 加载快捷访问项目
    async loadSites() {
        try {
            const result = await chrome.storage.local.get(['quickAccessSites']);
            this.sites = result.quickAccessSites || [];
        } catch (error) {
            console.error('加载快捷访问失败:', error);
            this.sites = [];
        }
    }

    // 保存快捷访问项目
    async saveSites() {
        try {
            await chrome.storage.local.set({ quickAccessSites: this.sites });
        } catch (error) {
            console.error('保存快捷访问失败:', error);
        }
    }

    // 添加新的快捷访问项目
    async addSite(name, url, icon) {
        const newSite = { name, url, icon };
        this.sites.push(newSite);
        await this.saveSites();
        return newSite;
    }

    // 编辑快捷访问项目
    async editSite(index, name, url, icon) {
        if (index >= 0 && index < this.sites.length) {
            this.sites[index] = { name, url, icon };
            await this.saveSites();
            return this.sites[index];
        }
        return null;
    }

    // 删除快捷访问项目
    async deleteSite(index) {
        if (index >= 0 && index < this.sites.length) {
            const deletedSite = this.sites.splice(index, 1)[0];
            await this.saveSites();
            return deletedSite;
        }
        return null;
    }

    // 获取所有快捷访问项目
    getSites() {
        return this.sites;
    }

    // 设置分页实例
    setPagination(pagination) {
        this.pagination = pagination;
    }

    // 渲染快捷访问
    renderQuickAccess() {
        if (this.pagination) {
            this.pagination.setItems(this.sites);
        }
    }

    // 验证URL格式
    validateUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    // 验证名称
    validateName(name) {
        return name.trim().length > 0 && name.trim().length <= 20;
    }

    // 验证图标
    validateIcon(icon) {
        return icon.trim().length > 0 && icon.trim().length <= 10;
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuickAccessManager;
} else {
    window.QuickAccessManager = QuickAccessManager;
}
