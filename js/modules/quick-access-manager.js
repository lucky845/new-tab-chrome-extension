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

    // ---------- 文件夹 ----------

    // 新建文件夹
    async addFolder(name) {
        const folder = { name: name.trim(), isFolder: true, items: [] };
        this.sites.push(folder);
        await this.saveSites();
        return folder;
    }

    // 重命名文件夹
    async renameFolder(index, name) {
        const folder = this.sites[index];
        if (!folder || !folder.isFolder) return null;
        folder.name = name.trim();
        await this.saveSites();
        return folder;
    }

    // 向文件夹内添加快捷方式
    async addSiteToFolder(folderIndex, name, url, icon) {
        const folder = this.sites[folderIndex];
        if (!folder || !folder.isFolder) return null;
        const item = { name, url, icon: icon || null };
        folder.items.push(item);
        await this.saveSites();
        return item;
    }

    // 从文件夹中移除某一项（返回被移除的站点，便于外部决定后续）
    async removeFromFolder(folderIndex, itemIndex) {
        const folder = this.sites[folderIndex];
        if (!folder || !folder.isFolder) return null;
        const [removed] = folder.items.splice(itemIndex, 1);
        await this.saveSites();
        return removed || null;
    }

    // 把文件夹内某一项移回根列表（不删除数据）
    async moveFromFolderToRoot(folderIndex, itemIndex) {
        const folder = this.sites[folderIndex];
        if (!folder || !folder.isFolder) return null;
        const [item] = folder.items.splice(itemIndex, 1);
        if (!item) return null;
        this.sites.push(item);
        await this.saveSites();
        return item;
    }

    // 解散文件夹：内部站点按序回填到根列表，随后删除该文件夹
    async dissolveFolder(index) {
        const folder = this.sites[index];
        if (!folder || !folder.isFolder) return null;
        const items = folder.items.map(item => ({ ...item }));
        this.sites.splice(index, 1, ...items);
        await this.saveSites();
        return items;
    }

    // 把根列表中的站点移入文件夹
    async moveSiteToFolder(siteIndex, folderIndex) {
        const site = this.sites[siteIndex];
        const folder = this.sites[folderIndex];
        if (!site || site.isFolder || !folder || !folder.isFolder) return null;
        folder.items.push({ name: site.name, url: site.url, icon: site.icon || null });
        this.sites.splice(siteIndex, 1);
        await this.saveSites();
        return true;
    }

    // 获取所有文件夹（附带原索引，便于定位）
    getFolders() {
        return this.sites.map((site, index) => ({ ...site, index })).filter(site => site.isFolder);
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
