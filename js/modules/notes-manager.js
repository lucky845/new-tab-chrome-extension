/**
 * 备忘录管理模块（多便签版）
 * 备忘录域唯一业务归属：多便签 CRUD + 置顶 + 搜索 + 自动保存 + 本地持久化。
 * UI 渲染由 app.js 完成。
 * 数据结构：notes: [{ id, content, pinned, createdAt, updatedAt }]
 * 兼容迁移：旧版单条 key 'note'（{content, updatedAt}）自动迁移为第一条便签。
 */
class NotesManager {
    constructor() {
        this.notes = [];
        this.storageKey = 'notes';
        this.legacyKey = 'note';
        this.migrated = false;
    }

    async init() {
        const keys = [this.storageKey, this.legacyKey];
        const result = await chrome.storage.local.get(keys);
        const saved = result[this.storageKey];
        if (Array.isArray(saved) && saved.length > 0) {
            this.notes = saved.filter(item => item && typeof item === 'object');
        } else {
            this.notes = [];
        }

        // 旧单条便签迁移
        const legacy = result[this.legacyKey];
        if (
            (!saved || saved.length === 0) &&
            legacy &&
            typeof legacy === 'object' &&
            legacy.content
        ) {
            const createdAt = typeof legacy.updatedAt === 'number' ? legacy.updatedAt : Date.now();
            this.notes = [
                {
                    id: `note_${Date.now()}_migrated`,
                    content: legacy.content,
                    pinned: false,
                    createdAt,
                    updatedAt: createdAt,
                },
            ];
            await this.save();
            await chrome.storage.local.remove(this.legacyKey);
        }
        this.migrated = true;
        return this.getNotes();
    }

    // 持久化
    async save() {
        await chrome.storage.local.set({ [this.storageKey]: this.notes });
    }

    // 读取：置顶优先，同组按更新时间倒序
    getNotes() {
        const sorted = [...this.notes].sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            return (b.updatedAt || 0) - (a.updatedAt || 0);
        });
        return sorted;
    }

    // 搜索（内容子串，大小写不敏感；空关键词返回全部）
    searchNotes(keyword) {
        const kw = (keyword || '').trim().toLowerCase();
        if (!kw) return this.getNotes();
        return this.getNotes().filter(note => (note.content || '').toLowerCase().includes(kw));
    }

    // 新增便签（content 允许空，UI 先建后输入）
    async addNote(content = '') {
        const now = Date.now();
        const note = {
            id: `note_${now}_${Math.random().toString(36).slice(2, 8)}`,
            content: String(content || ''),
            pinned: false,
            createdAt: now,
            updatedAt: now,
        };
        this.notes.unshift(note);
        await this.save();
        return note;
    }

    // 更新内容（UI 层防抖调用；空内容不删除便签，由用户显式删除）
    async updateNote(id, content) {
        const note = this.notes.find(n => n.id === id);
        if (!note) return null;
        note.content = String(content ?? '');
        note.updatedAt = Date.now();
        await this.save();
        return note;
    }

    // 置顶切换
    async togglePin(id) {
        const note = this.notes.find(n => n.id === id);
        if (!note) return null;
        note.pinned = !note.pinned;
        note.updatedAt = Date.now();
        await this.save();
        return note;
    }

    // 删除
    async removeNote(id) {
        const index = this.notes.findIndex(n => n.id === id);
        if (index === -1) return false;
        this.notes.splice(index, 1);
        await this.save();
        return true;
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotesManager;
} else {
    window.NotesManager = NotesManager;
}
