/**
 * 备忘录管理模块
 * 备忘录域唯一业务归属：单便签内容 + 自动保存（防抖）+ 本地持久化。
 * UI 渲染由 app.js 完成。
 */
class NotesManager {
    constructor() {
        this.content = '';
        this.updatedAt = null;
        this.storageKey = 'note';
    }

    async init() {
        return new Promise(resolve => {
            chrome.storage.local.get([this.storageKey], result => {
                const saved = result[this.storageKey];
                if (saved && typeof saved === 'object') {
                    this.content = typeof saved.content === 'string' ? saved.content : '';
                    this.updatedAt = typeof saved.updatedAt === 'number' ? saved.updatedAt : null;
                }
                resolve({ content: this.content, updatedAt: this.updatedAt });
            });
        });
    }

    getContent() {
        return this.content;
    }

    getUpdatedAt() {
        return this.updatedAt;
    }

    // 保存（UI 层做防抖调用；内容为空视为清空并删除记录）
    async save(content) {
        this.content = content || '';
        this.updatedAt = this.content ? Date.now() : null;
        return new Promise(resolve => {
            if (this.content) {
                chrome.storage.local.set(
                    { [this.storageKey]: { content: this.content, updatedAt: this.updatedAt } },
                    resolve
                );
            } else {
                chrome.storage.local.remove(this.storageKey, resolve);
            }
        });
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotesManager;
} else {
    window.NotesManager = NotesManager;
}
