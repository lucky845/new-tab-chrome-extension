/**
 * 入口引导（bootstrap）
 *
 * 职责边界（v1.2.0 双轨合并后）：
 *   - 组合根 + 全部 UI 绑定：js/app.js（NewTabApp）
 *   - 业务数据层：js/modules/*-manager.js
 *   - 本文件仅负责启动时机
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const app = new NewTabApp();
        await app.init();
        // 全局引用（控制台调试：window.app.getStatus()）
        window.app = app;
    } catch (error) {
        console.error('应用初始化失败:', error);
    }
});
