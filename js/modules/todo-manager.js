/**
 * 待办事项管理模块
 * 待办域唯一业务归属：CRUD + 重要标记 + 本地持久化（chrome.storage.local）。
 * UI 渲染由 app.js 完成。
 */
class TodoManager {
    constructor() {
        this.todos = [];
        this.storageKey = 'todos';
    }

    async init() {
        await this.load();
    }

    // 读取
    async load() {
        return new Promise(resolve => {
            chrome.storage.local.get([this.storageKey], result => {
                this.todos = Array.isArray(result[this.storageKey]) ? result[this.storageKey] : [];
                resolve(this.todos);
            });
        });
    }

    // 持久化
    async save() {
        return new Promise(resolve => {
            chrome.storage.local.set({ [this.storageKey]: this.todos }, resolve);
        });
    }

    getTodos() {
        return this.todos;
    }

    getActiveCount() {
        return this.todos.filter(t => !t.done).length;
    }

    // 添加（content 非空校验由 UI 层完成；important 为重要标记）
    async addTodo(content, important = false) {
        const text = (content || '').trim();
        if (!text) return null;
        const todo = {
            id: `todo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            content: text,
            important: !!important,
            done: false,
            createdAt: Date.now(),
        };
        this.todos.unshift(todo);
        await this.save();
        return todo;
    }

    // 切换完成状态
    async toggleTodo(id) {
        const todo = this.todos.find(t => t.id === id);
        if (!todo) return null;
        todo.done = !todo.done;
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
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TodoManager;
} else {
    window.TodoManager = TodoManager;
}
