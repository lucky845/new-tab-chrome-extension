/**
 * 统一提示组件 dsh-tip（原生 JS，无依赖，无构建步骤）
 * --------------------------------------------------------------------
 * 两种形态，同一套外观/动画/语义：
 *   1) attach(anchor, opts)  附着式：贴着锚点弹出，视口边界感知（翻转 / 钳制 / 箭头跟随）
 *   2) toast(message, type, duration)  浮层式：视口底部居中堆叠，用于全局操作反馈
 *
 * 安全：文本一律 textContent；图标只用内置白名单 SVG；不接受 HTML 输入。
 */
(function () {
    'use strict';

    if (window.dshTip) return; // 防重复注入

    const GAP = 8; // tip 与锚点间距
    const MARGIN = 8; // tip 与视口边缘最小留白
    const ARROW = 6; // 箭头（12px 方块旋转 45°）

    /* 图标构建：禁止 innerHTML。全部为内置常量，用 DOM API 显式构建。 */
    const ICONS = { success: 1, error: 1, warning: 1, info: 1, loading: 1 };

    function buildIcon(name) {
        const NS = 'http://www.w3.org/2000/svg';
        const make = (tag, attrs) => {
            const el = document.createElementNS(NS, tag);
            for (const k in attrs) {
                if (Object.prototype.hasOwnProperty.call(attrs, k)) el.setAttribute(k, attrs[k]);
            }
            return el;
        };
        const svg = make('svg', {
            viewBox: '0 0 16 16',
            width: '14',
            height: '14',
            'aria-hidden': 'true',
        });
        if (name === 'success') {
            svg.appendChild(
                make('path', {
                    d: 'M3 8.5l3.2 3.2L13 5',
                    fill: 'none',
                    stroke: 'currentColor',
                    'stroke-width': '2',
                    'stroke-linecap': 'round',
                    'stroke-linejoin': 'round',
                })
            );
        } else if (name === 'error') {
            svg.appendChild(
                make('path', {
                    d: 'M4.5 4.5l7 7M11.5 4.5l-7 7',
                    fill: 'none',
                    stroke: 'currentColor',
                    'stroke-width': '2',
                    'stroke-linecap': 'round',
                })
            );
        } else if (name === 'warning') {
            svg.appendChild(
                make('path', {
                    d: 'M8 2.6l6 10.8H2z',
                    fill: 'none',
                    stroke: 'currentColor',
                    'stroke-width': '1.6',
                    'stroke-linejoin': 'round',
                })
            );
            svg.appendChild(
                make('path', {
                    d: 'M8 6.4v3.1',
                    stroke: 'currentColor',
                    'stroke-width': '1.6',
                    'stroke-linecap': 'round',
                })
            );
            svg.appendChild(make('circle', { cx: '8', cy: '11.6', r: '.9', fill: 'currentColor' }));
        } else if (name === 'loading') {
            // 静态弧线 + 三个进度点：表达「进行中」但不做无限自转。
            // 用户反馈旋转加载图标「自己也在旋转」，且常驻时非常刺眼；
            // 刷新结果由 weather-manager 的 refresh() 生命周期收敛提示本身。
            svg.appendChild(
                make('path', {
                    d: 'M2.2 11.6A6 6 0 1 1 13.8 11.6',
                    fill: 'none',
                    stroke: 'currentColor',
                    'stroke-width': '1.8',
                    'stroke-linecap': 'round',
                })
            );
            [
                [4.2, 12.4],
                [8, 13.2],
                [11.8, 12.4],
            ].forEach(([cx, cy]) => {
                svg.appendChild(
                    make('circle', {
                        cx: String(cx),
                        cy: String(cy),
                        r: '.85',
                        fill: 'currentColor',
                    })
                );
            });
        } else {
            svg.appendChild(
                make('circle', {
                    cx: '8',
                    cy: '8',
                    r: '6.2',
                    fill: 'none',
                    stroke: 'currentColor',
                    'stroke-width': '1.6',
                })
            );
            svg.appendChild(
                make('path', {
                    d: 'M8 7.2v4',
                    stroke: 'currentColor',
                    'stroke-width': '1.6',
                    'stroke-linecap': 'round',
                })
            );
            svg.appendChild(make('circle', { cx: '8', cy: '4.9', r: '.9', fill: 'currentColor' }));
        }
        return svg;
    }

    const DURATION = { success: 1800, info: 2200, warning: 3200, error: 4000, loading: 0 };

    /* ---------------- 样式：一次性注入 ---------------- */
    const STYLE_ID = 'dsh-tip-style';
    const CSS = [
        '.dsh-tip{position:fixed;left:0;top:0;z-index:6100;display:flex;align-items:center;gap:8px;',
        'width:max-content;max-width:min(320px,calc(100vw - 16px));box-sizing:border-box;',
        'padding:8px 10px 8px 12px;border-radius:var(--radius-control,8px);border:1px solid var(--dsh-tip-border,rgba(255,255,255,.16));',
        'background:rgba(18,24,30,.88);-webkit-backdrop-filter:blur(var(--blur-soft,5px));backdrop-filter:blur(var(--blur-soft,5px));',
        'box-shadow:0 8px 24px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.08);color:var(--text-primary,#fff);',
        'font-size:13px;line-height:1.45;font-weight:500;text-align:left;',
        'opacity:0;transition:opacity .18s cubic-bezier(.2,.8,.2,1);will-change:transform,opacity}',
        '.dsh-tip--visible{opacity:1}',
        '.dsh-tip__icon{display:inline-flex;flex:0 0 auto;width:14px;height:14px;color:var(--tip-accent,var(--text-tertiary,#999))}',
        '.dsh-tip__icon svg{display:block}',
        '.dsh-tip__text{flex:1 1 auto;min-width:0;word-break:break-word}',
        '.dsh-tip__action{flex:0 0 auto;height:22px;padding:0 8px;border:1px solid rgba(255,255,255,.2);border-radius:var(--radius-xs,6px);',
        'background:rgba(255,255,255,.12);color:inherit;font:inherit;font-size:12px;cursor:pointer;transition:background-color .2s ease}',
        '.dsh-tip__action:hover{background:rgba(255,255,255,.22)}',
        '.dsh-tip__action:focus-visible{outline:2px solid var(--tip-accent,currentColor);outline-offset:1px}',
        '.dsh-tip__close{flex:0 0 auto;display:grid;place-items:center;width:18px;height:18px;margin-right:-4px;padding:0;',
        'border:0;border-radius:50%;background:transparent;color:rgba(255,255,255,.6);font-size:14px;line-height:1;cursor:pointer}',
        '.dsh-tip__close:hover{background:rgba(255,255,255,.14);color:#fff}',
        // 主色统一读 style.css :root 的 --color-*（单一真源）；fallback 让组件脱离本页样式仍可独立运行
        '.dsh-tip--success{--tip-accent:var(--color-success,#3ddc97);--dsh-tip-border:rgba(61,220,151,.45)}',
        '.dsh-tip--warning{--tip-accent:var(--color-warning,#ffd166);--dsh-tip-border:rgba(255,209,102,.45)}',
        '.dsh-tip--error{--tip-accent:var(--color-error,#ff8a8f);--dsh-tip-border:rgba(255,138,143,.50)}',
        '.dsh-tip--info{--tip-accent:var(--color-info,#a5d8ff);--dsh-tip-border:rgba(165,216,255,.42)}',
        '.dsh-tip--loading{--tip-accent:var(--color-loading,#4ec2c6);--dsh-tip-border:rgba(78,194,198,.45)}',
        '.dsh-tip__arrow{position:absolute;width:12px;height:12px;background:#12181e;border:1px solid rgba(255,255,255,.16);',
        'transform:rotate(45deg);pointer-events:none;z-index:-1}',
        '@media (prefers-reduced-motion:reduce){.dsh-tip{transition:opacity .05s linear}}',
        '.dsh-tip-toasts{position:fixed;left:50%;bottom:32px;width:max-content;max-width:calc(100vw - 24px);',
        'transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;z-index:99999;pointer-events:none}',
        '.dsh-tip-toasts .dsh-tip{position:static;pointer-events:auto;padding:9px 14px;font-size:13px;line-height:20px}',
    ].join('');

    function ensureStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = CSS;
        (document.head || document.documentElement).appendChild(style);
    }

    /* ---------------- 定位计算：纯 JS，CSS 只管外观 ---------------- */
    /**
     * @param {DOMRect} anchorRect 锚点矩形（viewport 坐标）
     * @param {number} tipW tip 宽度
     * @param {number} tipH tip 高度
     * @param {'auto'|'above'|'below'} preferred 首选方向
     */
    function computePosition(anchorRect, tipW, tipH, preferred) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const spaceAbove = anchorRect.top - MARGIN;
        const spaceBelow = vh - anchorRect.bottom - MARGIN;
        const fitsAbove = spaceAbove >= tipH + GAP;
        const fitsBelow = spaceBelow >= tipH + GAP;

        let placement;
        if (fitsAbove || fitsBelow) {
            // 首选项能放下就用首选项；否则用放得下的那一侧
            if (preferred === 'above' && fitsAbove) placement = 'above';
            else if (preferred === 'below' && fitsBelow) placement = 'below';
            else if (preferred === 'auto') placement = fitsAbove ? 'above' : 'below';
            else placement = fitsAbove ? 'above' : 'below';
        } else {
            // 两侧都放不下：选空间更大的一侧，随后钳制进视口
            placement = spaceBelow > spaceAbove ? 'below' : 'above';
        }

        // 水平：锚点居中 → 钳制到视口
        const anchorCenter = anchorRect.left + anchorRect.width / 2;
        const left = Math.max(MARGIN, Math.min(anchorCenter - tipW / 2, vw - tipW - MARGIN));

        // 垂直：贴锚点另一侧 → 钳制到视口（钳制后仍不与锚点重叠）
        let top = placement === 'above' ? anchorRect.top - GAP - tipH : anchorRect.bottom + GAP;
        if (placement === 'above')
            top = Math.max(MARGIN, Math.min(top, anchorRect.top - GAP - tipH));
        else top = Math.min(vh - tipH - MARGIN, Math.max(top, anchorRect.bottom + GAP));

        // 箭头：跟随锚点中心，且不出圆角安全区
        const arrowX = Math.max(14, Math.min(anchorCenter - left - ARROW, tipW - 14 - ARROW * 2));
        const arrowY = placement === 'above' ? tipH - ARROW - 1 : -ARROW + 1;

        return {
            top: Math.round(top),
            left: Math.round(left),
            placement,
            arrowX: Math.round(arrowX),
            arrowY: Math.round(arrowY),
        };
    }

    /* ---------------- Tip 实例 ---------------- */
    const registry = new Map(); // 同一锚点+key 只保留一条

    class Tip {
        constructor(options) {
            const opt = Object.assign(
                {
                    type: 'info',
                    message: '',
                    duration: null, // null = 按类型默认；0 = 常驻
                    placement: 'auto', // 'auto' | 'above' | 'below'
                    arrow: true,
                    closable: false,
                    action: null, // 单按钮（兼容）：{ label, onClick(tip), keepOpen }
                    actions: null, // 多按钮：[{ label, title, onClick(tip), keepOpen }]
                    anchor: null,
                    key: 'default',
                },
                options || {}
            );

            this.anchor = opt.anchor;
            this.key = opt.key || 'default';
            this.placement = opt.placement;
            this.arrowEnabled = opt.arrow;
            this.type = opt.type;
            this.timer = null;
            this.closed = false;
            this.rafId = 0;
            this.onScrollOrResize = null;
            this.ro = null;

            ensureStyle();

            const el = document.createElement('div');
            el.className = 'dsh-tip dsh-tip--' + opt.type;
            el.setAttribute('role', opt.type === 'error' ? 'alert' : 'status');

            const icon = document.createElement('span');
            icon.className = 'dsh-tip__icon';
            icon.appendChild(buildIcon(ICONS[opt.type] ? opt.type : 'info'));

            const text = document.createElement('span');
            text.className = 'dsh-tip__text';
            text.textContent = String(opt.message == null ? '' : opt.message);

            el.append(icon, text);

            // 归一化：actions 数组优先，单 action 降级为长度 1 的数组
            const actionList = Array.isArray(opt.actions)
                ? opt.actions.filter(a => a && a.label)
                : opt.action && opt.action.label
                  ? [opt.action]
                  : [];
            actionList.forEach(spec => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'dsh-tip__action';
                btn.textContent = spec.label;
                if (spec.title) btn.title = spec.title;
                btn.addEventListener('click', () => {
                    try {
                        spec.onClick && spec.onClick(this);
                    } finally {
                        if (!spec.keepOpen) this.close();
                    }
                });
                el.appendChild(btn);
            });

            if (opt.closable) {
                const close = document.createElement('button');
                close.type = 'button';
                close.className = 'dsh-tip__close';
                close.setAttribute('aria-label', '关闭提示');
                close.textContent = '×';
                close.addEventListener('click', () => this.close());
                el.appendChild(close);
            }

            if (this.anchor) {
                this.arrowEl = document.createElement('span');
                this.arrowEl.className = 'dsh-tip__arrow';
                this.arrowEl.hidden = !this.arrowEnabled;
                el.appendChild(this.arrowEl);
            }

            this.el = el;
            this.textEl = text;
            this.iconEl = icon;

            if (this.anchor) {
                // 挂到 body：避免被锚点的父级 overflow/transform 裁剪
                const rk = this.registryKey();
                el.dataset.dshTipKey = rk;
                el.__dshTip = this;
                // 同 key 去重：除了 registry 里的活实例，还要清掉「已 close 但仍在淡出、
                // DOM 尚未移除」的残留节点，否则连续 attach 会短暂叠出两条提示。
                document.querySelectorAll('.dsh-tip[data-dsh-tip-key]').forEach(node => {
                    if (node === el || node.dataset.dshTipKey !== rk) return;
                    const inst = node.__dshTip;
                    if (inst && !inst.closed) inst.close(true);
                    else node.remove();
                });
                const prev = registry.get(rk);
                if (prev && prev !== this) prev.close(true);
                registry.set(rk, this);
                document.body.appendChild(el);
                this.bind();
                this.reposition();
            } else {
                let host = document.querySelector('.dsh-tip-toasts');
                if (!host) {
                    host = document.createElement('div');
                    host.className = 'dsh-tip-toasts';
                    host.setAttribute('aria-live', 'polite');
                    document.body.appendChild(host);
                }
                host.appendChild(el);
            }

            requestAnimationFrame(() => el.classList.add('dsh-tip--visible'));

            this.lastDuration =
                opt.duration == null ? DURATION[opt.type] || DURATION.info : opt.duration;
            if (this.lastDuration > 0) this.setTimer(this.lastDuration);

            // 只有「可操作」提示（带按钮 / 可关闭）才在 hover 时暂停倒计时：
            // 纯状态提示（loading/info…）若也暂停，鼠标恰好停在提示上就会永远不消失，
            // 变成用户看到的「加载图标自己一直在转」。
            this.hoverPausable = actionList.length > 0 || !!opt.closable;
            if (this.hoverPausable) {
                el.addEventListener('mouseenter', () => this.clearTimer());
                el.addEventListener('mouseleave', () => {
                    if (this.lastDuration > 0) this.setTimer(this.lastDuration);
                });
            }
        }

        registryKey() {
            if (!this.anchor) return null;
            if (!this.anchor.__dshTipId) {
                this.anchor.__dshTipId = 't' + Math.random().toString(36).slice(2, 9);
            }
            return this.anchor.__dshTipId + ':' + this.key;
        }

        bind() {
            this.onScrollOrResize = () => this.scheduleReposition();
            window.addEventListener('scroll', this.onScrollOrResize, true);
            window.addEventListener('resize', this.onScrollOrResize);
            if (window.ResizeObserver && this.anchor) {
                this.ro = new ResizeObserver(() => this.scheduleReposition());
                this.ro.observe(this.anchor);
            }
        }

        scheduleReposition() {
            if (this.rafId) return;
            this.rafId = requestAnimationFrame(() => {
                this.rafId = 0;
                this.reposition();
            });
        }

        reposition() {
            if (this.closed) return;
            if (!this.anchor || !this.anchor.isConnected) {
                this.close();
                return;
            }
            const rect = this.anchor.getBoundingClientRect();
            const pos = computePosition(
                rect,
                this.el.offsetWidth,
                this.el.offsetHeight,
                this.placement
            );
            this.el.style.transform = 'translate3d(' + pos.left + 'px,' + pos.top + 'px,0)';
            this.el.classList.toggle('dsh-tip--above', pos.placement === 'above');
            this.el.classList.toggle('dsh-tip--below', pos.placement === 'below');
            if (this.arrowEl) {
                this.arrowEl.style.left = pos.arrowX + 'px';
                this.arrowEl.style.top = pos.arrowY + 'px';
            }
        }

        /** 原地更新：loading → success/error，或改文案/时长 */
        update(patch) {
            if (this.closed || !patch) return this;
            if (patch.type && patch.type !== this.type) {
                this.type = patch.type;
                this.el.classList.remove(
                    'dsh-tip--success',
                    'dsh-tip--warning',
                    'dsh-tip--error',
                    'dsh-tip--info',
                    'dsh-tip--loading'
                );
                this.el.classList.add('dsh-tip--' + patch.type);
                this.el.setAttribute('role', patch.type === 'error' ? 'alert' : 'status');
                this.iconEl.replaceChildren(buildIcon(ICONS[patch.type] ? patch.type : 'info'));
            }
            if (patch.message != null) this.textEl.textContent = String(patch.message);
            if (patch.duration != null) {
                this.lastDuration = patch.duration;
                if (patch.duration > 0) this.setTimer(patch.duration);
                else this.clearTimer();
            }
            this.scheduleReposition();
            return this;
        }

        setTimer(ms) {
            this.clearTimer();
            this.timer = setTimeout(() => this.close(), ms);
        }

        clearTimer() {
            if (this.timer) {
                clearTimeout(this.timer);
                this.timer = null;
            }
        }

        close(immediate) {
            if (this.closed) return;
            this.closed = true;
            this.clearTimer();
            if (this.rafId) cancelAnimationFrame(this.rafId);
            if (this.onScrollOrResize) {
                window.removeEventListener('scroll', this.onScrollOrResize, true);
                window.removeEventListener('resize', this.onScrollOrResize);
            }
            if (this.ro) this.ro.disconnect();
            const rk = this.registryKey();
            if (rk && registry.get(rk) === this) registry.delete(rk);

            const remove = () => this.el.remove();
            if (immediate) return remove();
            this.el.classList.remove('dsh-tip--visible');
            this.el.addEventListener('transitionend', remove, { once: true });
            setTimeout(remove, 300);
        }
    }

    /**
     * 附着式提示
     * @param {HTMLElement} anchor 锚点元素（如 #weather-widget、输入框、按钮）
     * @param {{type?:string,message:string,duration?:number,placement?:'auto'|'above'|'below',
     *          arrow?:boolean,closable?:boolean,key?:string,
     *          action?:{label:string,onClick?:Function,keepOpen?:boolean},
     *          actions?:Array<{label:string,title?:string,onClick?:Function,keepOpen?:boolean}>}} options
     * @returns {Tip}
     */
    function attach(anchor, options) {
        if (!anchor) return null;
        return new Tip(Object.assign({}, options || {}, { anchor: anchor }));
    }

    /**
     * 浮层提示（底部居中）
     * @param {string} message
     * @param {'success'|'warning'|'error'|'info'|'loading'} [type='info']
     * @param {number} [duration] 毫秒；省略按类型默认
     * @returns {Tip}
     */
    function toast(message, type, duration) {
        return new Tip({ type: type || 'info', message: message, duration: duration });
    }

    window.dshTip = {
        attach: attach,
        toast: toast,
        Tip: Tip,
        _computePosition: computePosition,
        version: '1.0.0',
    };
})();
