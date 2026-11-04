/**
 * 待办事项管理模块
 * 待办域唯一业务归属：CRUD + 重要标记 + 分类 + 截止日期 + 排序回写 + 统计 + 本地持久化。
 * UI 渲染由 app.js 完成。
 * 数据结构（向后兼容：旧数据缺 category/dueDate/completedAt 时迁移补齐）：
 *   { id, content, important, done, createdAt, category: 'work'|'life'|'normal', dueDate: 'YYYY-MM-DD'|null, completedAt: number|null }
 */
class TodoManager {
    constructor() {
        this.todos = [];
        this.storageKey = 'todos';
    }

    async init() {
        await this.load();
    }

    // 读取（promise 风格，与库内其他模块统一）
    async load() {
        const result = await chrome.storage.local.get([this.storageKey]);
        this.todos = Array.isArray(result[this.storageKey]) ? result[this.storageKey] : [];
        let migrated = false;
        for (const todo of this.todos) {
            if (!todo.category) {
                todo.category = 'normal';
                migrated = true;
            }
            if (todo.dueDate === undefined) {
                todo.dueDate = null;
                migrated = true;
            }
            if (todo.done && !todo.completedAt) {
                todo.completedAt = Date.now();
                migrated = true;
            }
        }
        if (migrated) await this.save();
        return this.todos;
    }

    // 持久化
    async save() {
        await chrome.storage.local.set({ [this.storageKey]: this.todos });
    }

    getTodos() {
        return this.todos;
    }

    getActiveCount() {
        return this.todos.filter(t => !t.done).length;
    }

    // 统计（未完成 / 今日完成 / 总数 / 已逾期）
    getStats() {
        const today = TodoManager.todayStart();
        return {
            total: this.todos.length,
            active: this.todos.filter(t => !t.done).length,
            doneToday: this.todos.filter(t => t.done && t.completedAt && t.completedAt >= today)
                .length,
            overdue: this.todos.filter(t => !t.done && TodoManager.isOverdue(t)).length,
        };
    }

    static todayStart() {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    }

    // 是否已逾期（未完成且有截止日期，截止日当天 23:59:59 前不算逾期）
    static isOverdue(todo) {
        if (todo.done || !todo.dueDate) return false;
        const end = new Date(`${todo.dueDate}T23:59:59`).getTime();
        return Number.isFinite(end) && end < Date.now();
    }

    // 添加（content 非空校验由 UI 层完成）
    async addTodo(content, { important = false, category = 'normal', dueDate = null } = {}) {
        const text = (content || '').trim();
        if (!text) return null;
        const todo = {
            id: `todo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            content: text,
            important: !!important,
            done: false,
            createdAt: Date.now(),
            category: TodoManager.normalizeCategory(category),
            dueDate: dueDate || null,
            completedAt: null,
        };
        this.todos.unshift(todo);
        await this.save();
        return todo;
    }

    static normalizeCategory(category) {
        return ['work', 'life', 'normal'].includes(category) ? category : 'normal';
    }

    // 切换完成状态（完成时记录 completedAt；取消完成清空）
    async toggleTodo(id) {
        const todo = this.todos.find(t => t.id === id);
        if (!todo) return null;
        todo.done = !todo.done;
        todo.completedAt = todo.done ? Date.now() : null;
        await this.save();
        return todo;
    }

    // 删除
    async removeTodo(id) {
        const index = this.todos.findIndex(t => t.id === id);
        if (index === -1) return false;
        this.todos.splice(index, 1);
        await this.save();
        return true;
    }

    // 清除已完成
    async clearDone() {
        const before = this.todos.length;
        this.todos = this.todos.filter(t => !t.done);
        await this.save();
        return before - this.todos.length;
    }

    // 拖拽排序回写（UI 层传渲染后的 id 顺序）
    async updateOrder(orderedIds) {
        if (!Array.isArray(orderedIds) || orderedIds.length === 0) return false;
        const map = new Map(this.todos.map(t => [t.id, t]));
        const next = [];
        for (const id of orderedIds) {
            const todo = map.get(id);
            if (todo) {
                next.push(todo);
                map.delete(id);
            }
        }
        // 兜底：未出现在顺序里的项追加尾部，避免丢数据
        for (const todo of map.values()) next.push(todo);
        this.todos = next;
        await this.save();
        return true;
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TodoManager;
} else {
    window.TodoManager = TodoManager;
}
