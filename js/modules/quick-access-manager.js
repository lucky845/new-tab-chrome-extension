/**
 * 快捷访问管理模块
 * 负责快捷访问项目的增删改查、存储管理
 */
class QuickAccessManager {
    constructor() {
        this.defaultSites = window.DEFAULT_SITES || [];
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

    // 覆写全部项目（拖拽排序等整表变更场景；setItems 前必须先改内存数据）
    setSites(newSites) {
        this.sites = Array.isArray(newSites) ? newSites : this.sites;
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

    // 验证URL格式（与设置面板 UI 同源规则，返回 {valid, message}）
    validateUrl(url) {
        if (!url || !url.trim()) {
            return { valid: false, message: '请输入有效的网址。' };
        }
        const urlPattern =
            /^(https?:\/\/)?((([a-z\d]([a-z\d-]*[a-z\d])*)\.)+[a-z]{2,}|((\d{1,3}\.){3}\d{1,3}))(:\d+)?(\/[-a-z\d%_.~+]*)*(\?.*)?(#[-a-z\d_]*)?$/i;
        return {
            valid: urlPattern.test(url.trim()),
            message: '请输入有效的网址。',
        };
    }

    // 验证名称（2-10 字符，与设置面板 UI 同源规则）
    validateName(name) {
        const len = (name || '').trim().length;
        return {
            valid: len >= 2 && len <= 10,
            message: '名称长度应在 2 到 10 个字符之间。',
        };
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuickAccessManager;
} else {
    window.QuickAccessManager = QuickAccessManager;
}
