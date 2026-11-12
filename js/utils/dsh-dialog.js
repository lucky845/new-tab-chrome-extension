/**
 * 统一确认 / 输入对话框（替代 window.confirm / window.prompt）
 *
 * 为什么要有它：原生 confirm/prompt 是浏览器阻塞式弹窗，无法样式化，
 * 与整页玻璃拟态体系割裂，且在部分环境下会被拦截或表现为页面级对话框。
 * 本项目已有自建的删除确认弹窗，但只有删除一处用了；本组件把这套交互
 * 收口成可复用的 Promise API，供清空历史 / 新建文件夹 / 重命名复用。
 *
 * 设计：
 *   - Promise 化：resolve(true/false) 或 resolve(string|null)，取消一律 null/false
 *   - 键盘可达：Enter 确认、Esc 取消、打开时自动聚焦（输入框则选中原文）
 *   - 焦点回归：关闭后把焦点还给打开前的元素，避免键盘流断裂
 *   - 同一时刻只允许一个对话框；重复打开会先关掉上一个（resolve null）
 *   - 不使用 innerHTML 拼接用户内容，全部走 textContent / value
 */
(function () {
    if (window.dshDialog) return;

    let activeDialog = null;

    function createOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'dsh-dialog';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.innerHTML =
            '<div class="dsh-dialog__panel">' +
            '<h3 class="dsh-dialog__title"></h3>' +
            '<p class="dsh-dialog__message"></p>' +
            '<input class="dsh-dialog__input" type="text" />' +
            '<p class="dsh-dialog__error" aria-live="polite"></p>' +
            '<div class="dsh-dialog__actions">' +
            '<button type="button" class="settings-btn secondary dsh-dialog__cancel">取消</button>' +
            '<button type="button" class="settings-btn primary dsh-dialog__confirm">确定</button>' +
            '</div>' +
            '</div>';
        document.body.appendChild(overlay);
        return overlay;
    }

    /**
     * @param {Object} opt
     * @param {string} opt.title 标题
     * @param {string} [opt.message] 正文
     * @param {'confirm'|'prompt'} [opt.type='confirm']
     * @param {string} [opt.defaultValue] prompt 默认值
     * @param {string} [opt.confirmText='确定']
     * @param {string} [opt.cancelText='取消']
     * @param {(value:string)=>(string|null)} [opt.validate] 返回错误文案则阻止提交
     * @param {boolean} [opt.danger] 危险操作（确认按钮红色）
     * @returns {Promise<boolean|string|null>}
     */
    function open(opt) {
        const options = opt || {};
        const type = options.type === 'prompt' ? 'prompt' : 'confirm';

        // 互斥：上一个对话框直接按取消处理，避免叠层
        if (activeDialog) activeDialog.cancel();

        return new Promise(resolve => {
            const previousFocus = document.activeElement;
            const overlay = createOverlay();
            const titleEl = overlay.querySelector('.dsh-dialog__title');
            const messageEl = overlay.querySelector('.dsh-dialog__message');
            const inputEl = overlay.querySelector('.dsh-dialog__input');
            const errorEl = overlay.querySelector('.dsh-dialog__error');
            const cancelBtn = overlay.querySelector('.dsh-dialog__cancel');
            const confirmBtn = overlay.querySelector('.dsh-dialog__confirm');

            titleEl.textContent = options.title || '请确认';
            if (options.message) {
                messageEl.textContent = options.message;
            } else {
                messageEl.classList.add('u-hidden');
            }

            if (type === 'prompt') {
                inputEl.value =
                    typeof options.defaultValue === 'string' ? options.defaultValue : '';
            } else {
                inputEl.classList.add('u-hidden');
            }

            cancelBtn.textContent = options.cancelText || '取消';
            confirmBtn.textContent = options.confirmText || '确定';
            if (options.danger) confirmBtn.classList.add('is-danger');

            let settled = false;

            const cleanup = () => {
                document.removeEventListener('keydown', onKeydown, true);
                overlay.removeEventListener('click', onOverlayClick);
                overlay.remove();
                activeDialog = null;
                if (previousFocus && typeof previousFocus.focus === 'function') {
                    previousFocus.focus();
                }
            };

            const finish = value => {
                if (settled) return;
                settled = true;
                cleanup();
                resolve(value);
            };

            const cancel = () => finish(type === 'prompt' ? null : false);

            const submit = () => {
                if (type !== 'prompt') return finish(true);
                const raw = inputEl.value;
                const trimmed = raw.trim();
                if (typeof options.validate === 'function') {
                    const message = options.validate(trimmed);
                    if (message) {
                        errorEl.textContent = message;
                        inputEl.focus();
                        return;
                    }
                }
                finish(trimmed);
            };

            // 点遮罩取消；点面板内部不冒泡取消
            const onOverlayClick = e => {
                if (e.target === overlay) cancel();
            };

            const onKeydown = e => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    cancel();
                    return;
                }
                if (e.key === 'Enter') {
                    // textarea 不在此组件里；Enter 直接确认，符合原生 prompt 习惯
                    e.preventDefault();
                    e.stopPropagation();
                    submit();
                    return;
                }
                if (e.key === 'Tab') {
                    // 焦点囚禁：只在面板内循环，避免 Tab 跑到底层页面
                    const focusables = [inputEl, cancelBtn, confirmBtn].filter(
                        el => el && !el.classList.contains('u-hidden')
                    );
                    if (!focusables.length) return;
                    const first = focusables[0];
                    const last = focusables[focusables.length - 1];
                    if (e.shiftKey && document.activeElement === first) {
                        e.preventDefault();
                        last.focus();
                    } else if (!e.shiftKey && document.activeElement === last) {
                        e.preventDefault();
                        first.focus();
                    }
                }
            };

            cancelBtn.addEventListener('click', cancel);
            confirmBtn.addEventListener('click', submit);
            overlay.addEventListener('click', onOverlayClick);
            document.addEventListener('keydown', onKeydown, true);

            activeDialog = { cancel: cancel };

            // 入场后再聚焦，确保过渡动画不会打断焦点
            requestAnimationFrame(() => {
                if (type === 'prompt') {
                    inputEl.focus();
                    inputEl.select();
                } else {
                    confirmBtn.focus();
                }
            });
        });
    }

    // 便捷方法
    function confirmDialog(title, message, opt) {
        return open(
            Object.assign({}, opt || {}, { type: 'confirm', title: title, message: message })
        );
    }

    function promptDialog(title, defaultValue, opt) {
        return open(
            Object.assign({}, opt || {}, {
                type: 'prompt',
                title: title,
                defaultValue: defaultValue,
            })
        );
    }

    window.dshDialog = {
        open: open,
        confirm: confirmDialog,
        prompt: promptDialog,
        version: '1.0.0',
    };
})();
