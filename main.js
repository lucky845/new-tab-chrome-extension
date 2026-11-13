/**
 * 入口引导（bootstrap）
 *
 * 职责边界（v1.2.0 双轨合并后）：
 *   - 组合根 + 全部 UI 绑定：js/app.js（NewTabApp）
 *   - 业务数据层：js/modules/*-manager.js
 *   - 本文件仅负责启动时机
 *
 * 启动时机（重要）：
 *   本脚本写在 newtab.html 的 body 中段，此时后面的设置面板等 DOM 还没解析完。
 *   旧写法把「创建 app + 读 storage + 渲染」整个塞进 DOMContentLoaded 回调：
 *   浏览器先画完一屏空白，再花一个 storage 往返读数据，才轮到渲染 ——
 *   实测 DCL 70ms 时页面上还是 0 个快捷方式、时钟显示 --:--，到 215ms 才补齐，
 *   中间那 145ms 就是用户看到的「白屏卡顿」。
 *
 *   现在把「读数据」和「渲染」拆开：
 *     · 脚本一解析就 await 数据层初始化（storage 读取、默认站点落地、文件夹归一化），
 *       这些只碰 chrome.storage，不碰 DOM，可以和后面的 HTML 解析并行；
 *     · DOM 就绪后只剩 initUI()，那是纯同步渲染，几十毫秒内出画面。
 */
(function bootstrap() {
    const bootStartedAt = performance.now();

    const app = new NewTabApp();

    // 数据层：不等 DOM。storage 往返与 HTML 解析重叠，省掉一个 RTT。
    // init() 内部第一步是 themeManager.init()（只读 storage + 设置 html 属性），
    // 不依赖 body 里的任何节点，所以在解析期跑是安全的。
    const dataReady = app.init().catch(error => {
        console.error('应用初始化失败:', error);
        return null;
    });

    const mount = async () => {
        const instance = await dataReady;
        if (!instance) return;
        // 数据已就绪，DOM 也已解析：只剩纯同步渲染
        instance.uiInit();
        // 全局引用（控制台调试：window.app.getStatus()）
        window.app = instance;
        console.debug(
            '[boot] 数据层就绪 → 首屏挂载耗时',
            Math.round(performance.now() - bootStartedAt) + 'ms'
        );
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount, { once: true });
    } else {
        mount();
    }
})();
