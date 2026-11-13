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
        // 每一步都兜住：任何一次 storage 失败都不能让快捷访问整体停摆。
        // 之前这里是一条裸的 await 链 —— loadSites() 抛错就整个 init 中断，
        // initUI() 永远跑不到，页面停在骨架屏上（用户看到的就是"一大块灰"）。
        // 现在即使全部失败，也至少能拿默认站点渲染出来。
        try {
            await this.loadSites();
        } catch (error) {
            console.error('[快捷访问] 读取失败，回退默认站点:', error?.message || error);
            this.sites = [];
        }

        const isFirstRun = this.sites.length === 0;
        if (isFirstRun) {
            // 首次运行 / 读取失败：都视为空，用默认站点兜底
            try {
                this.sites = JSON.parse(JSON.stringify(this.defaultSites));
                await this.saveSites();
            } catch (error) {
                console.warn('[快捷访问] 默认站点保存失败（仍会显示）:', error?.message || error);
            }
        }

        // 下面两步都是"锦上添花"：失败不影响面板出内容
        try {
            await this.seedDemoFolder();
        } catch (error) {
            console.warn('[快捷访问] 演示文件夹插入失败:', error?.message || error);
        }
        if (!isFirstRun) {
            try {
                await this.normalizeFolders();
            } catch (error) {
                console.warn('[快捷访问] 文件夹归一化失败:', error?.message || error);
            }
        }
        // 最后再兜一道：保证至少有一个可渲染的条目列表
        if (!Array.isArray(this.sites)) this.sites = [];
    }

    /**
     * 首次升级时，在主面板第一位插入一个「演示文件夹」，用于展示文件夹能力。
     * 绝不改动用户已有的任何快捷访问数据：只 unshift 一个新节点。
     * 通过 storage 标记 demoFolderSeeded 保证只执行一次。
     */
    async seedDemoFolder() {
        // 统一用 await promise 风格（与库内其他模块一致，避免回调不触发导致挂死）
        const flagData = await chrome.storage.local.get(['demoFolderSeeded']);
        if (flagData.demoFolderSeeded) return false;

        const markSeeded = () => chrome.storage.local.set({ demoFolderSeeded: true });

        if (this.sites.some(node => node && node.isFolder)) {
            // 用户已有文件夹：不插入演示数据，只记标记
            await markSeeded();
            return false;
        }

        const demo = this.buildDemoFolder();
        this.sites.unshift(demo);
        await this.saveSites();
        await markSeeded();
        return true;
    }

    // 用默认站点素材构造一个演示文件夹（不引用、不移动用户数据）
    buildDemoFolder() {
        const pool = window.DEFAULT_SITES || [];
        const pick = names =>
            names
                .map(name => {
                    const found = this.findDefaultSite(name, pool);
                    return found
                        ? { name: found.name, url: found.url, icon: found.icon || null }
                        : null;
                })
                .filter(Boolean);

        const items = pick(['GitHub', 'V2EX']);
        return {
            name: '演示',
            isFolder: true,
            items:
                items.length > 0
                    ? items
                    : [{ name: '示例', url: 'https://github.com', icon: null }],
        };
    }

    // 在默认站点池中查找（兼容平铺 / 分组两种结构）
    findDefaultSite(name, pool) {
        for (const node of pool) {
            if (!node) continue;
            if (node.isFolder) {
                const hit = (node.items || []).find(item => item.name === name);
                if (hit) return hit;
            } else if (node.name === name) {
                return node;
            }
        }
        return null;
    }

    // 归一化：只有 1 个成员的文件夹自动解散为单个图标
    // 空文件夹（0 项）保持原样：用户刚新建、还没往里放东西，静默删除等于吞数据
    async normalizeFolders() {
        let changed = false;
        for (let i = this.sites.length - 1; i >= 0; i -= 1) {
            const node = this.sites[i];
            if (!node || !node.isFolder) continue;
            const items = Array.isArray(node.items) ? node.items : [];
            if (items.length === 1) {
                this.sites.splice(i, 1, { ...items[0] });
                changed = true;
            }
        }
        if (changed) await this.saveSites();
        return changed;
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

    /**
     * 拖动合并：把 draggedIndex 的节点并入 targetIndex
     * - 目标是文件夹：追加成员
     * - 目标是站点：新建文件夹（名称自动生成），两者一起放入
     * - 目标是虚拟「新建文件夹」占位（targetIndex === -1）：新建只含 dragged 的文件夹
     * 返回 { folder, name } 或 null
     */
    async mergeIntoFolder(draggedIndex, targetIndex, folderName) {
        const dragged = this.getNodeByIndex(draggedIndex);
        if (!dragged) return null;

        if (targetIndex === -1) {
            const name = folderName || this.suggestFolderName([dragged]);
            const folder = { name, isFolder: true, items: this.toFolderItems([dragged]) };
            this.sites.splice(draggedIndex, 1);
            this.sites.push(folder);
            await this.saveSites();
            return { folder, name };
        }

        const target = this.getNodeByIndex(targetIndex);
        if (!target || targetIndex === draggedIndex) return null;

        if (target.isFolder) {
            target.items = [...(target.items || []), ...this.toFolderItems([dragged])];
            this.sites.splice(draggedIndex, 1);
            await this.saveSites();
            return { folder: target, name: target.name };
        }

        // 站点 + 站点 → 新建文件夹，位置落在被拖入方
        const name = folderName || this.suggestFolderName([target, dragged]);
        const insertAt = Math.min(draggedIndex, targetIndex);
        const members = this.toFolderItems([target, dragged]);
        const folder = { name, isFolder: true, items: members };
        const kept = this.sites.filter((_, i) => i !== draggedIndex && i !== targetIndex);
        const folderPos = Math.min(insertAt, kept.length);
        kept.splice(folderPos, 0, folder);
        this.sites = kept;
        await this.saveSites();
        return { folder, name };
    }

    // 索引取节点（不存在的索引返回 null）
    getNodeByIndex(index) {
        if (!Number.isInteger(index) || index < 0 || index >= this.sites.length) return null;
        return this.sites[index];
    }

    // 节点 → 文件夹成员数组（文件夹会被展开）
    toFolderItems(nodes) {
        const out = [];
        nodes.filter(Boolean).forEach(node => {
            if (node.isFolder) {
                out.push(...(node.items || []).map(item => ({ ...item })));
            } else {
                out.push({ name: node.name, url: node.url, icon: node.icon || null });
            }
        });
        return out;
    }

    // 依据站点域名给出建议文件夹名
    suggestFolderName(nodes) {
        const hosts = this.toFolderItems(nodes)
            .map(item => {
                try {
                    return new URL(item.url).hostname.replace(/^www\./, '');
                } catch {
                    return '';
                }
            })
            .filter(Boolean);
        // 逐段从末尾比较，取公共后缀（a.github.com + b.github.com → github.com）
        const commonSuffix = (left, right) => {
            const a = left.split('.').reverse();
            const b = right.split('.').reverse();
            const out = [];
            for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
                if (a[i] !== b[i]) break;
                out.push(a[i]);
            }
            return out.reverse().join('.');
        };

        let common = hosts[0] || '';
        for (let i = 1; i < hosts.length; i += 1) {
            common = commonSuffix(common, hosts[i]);
            if (!common.includes('.')) break;
        }

        if (common && common.includes('.')) {
            // 去掉顶级域，取主体名（github.com → github）
            const label = common.split('.')[0];
            if (label && !['www', 'com', 'cn'].includes(label.toLowerCase())) {
                return label.slice(0, 10);
            }
        }
        return '文件夹';
    }

    // 把文件夹内某一项移回根列表（不删除数据）；成员不足 2 个时文件夹自动解散
    async moveFromFolderToRoot(folderIndex, itemIndex) {
        const folder = this.sites[folderIndex];
        if (!folder || !folder.isFolder) return null;
        const [item] = folder.items.splice(itemIndex, 1);
        if (!item) return null;
        const stillHasMembers = (folder.items || []).length >= 2;
        if (stillHasMembers) {
            this.sites.push(item);
        } else {
            // 文件夹将解散：把剩余成员与本项一起放回根列表
            const rest = folder.items || [];
            this.sites.splice(folderIndex, 1, ...[...rest, item].map(x => ({ ...x })));
        }
        await this.saveSites();
        await this.normalizeFolders();
        return item;
    }

    // 文件夹内排序（拖拽重排后回写）
    async reorderFolderItems(folderIndex, orderedNames) {
        const folder = this.sites[folderIndex];
        if (!folder || !folder.isFolder) return false;
        const map = new Map((folder.items || []).map(item => [item.name, item]));
        const next = [];
        (orderedNames || []).forEach(name => {
            const item = map.get(name);
            if (item) {
                next.push(item);
                map.delete(name);
            }
        });
        map.forEach(item => next.push(item));
        folder.items = next;
        await this.saveSites();
        return true;
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
        // 兜底：正常路径下 sites 一定已被 init() 填好；但 storage 卡死/超时时
        // init 可能没能完成赋值，这里返回默认站点而不是空数组 ——
        // 空数组会让首屏停在骨架屏上，而"有内容但可能不是用户自己的"至少可用。
        if (!Array.isArray(this.sites) || this.sites.length === 0) {
            if (!this._fallbackSites) {
                this._fallbackSites = JSON.parse(JSON.stringify(this.defaultSites || []));
            }
            return this._fallbackSites;
        }
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
