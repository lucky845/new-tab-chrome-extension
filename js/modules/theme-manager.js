/**
 * 主题管理模块
 *
 * 四种模式：
 *   auto   —— 跟随系统 prefers-color-scheme（默认）
 *   light  —— 固定浅色
 *   dark   —— 固定深色
 *   sun    —— 日出日落：白天浅色、夜晚深色，按当天日出/日落时刻切换
 *
 * 设计约束：
 *   1. 首屏零闪烁：applyStoredSync() 必须在 <head> 内联脚本里同步调用，
 *      不能等 app.init()（那时首帧已绘制，会看到白闪再变深）。
 *      由于 chrome.storage 是异步的，同步阶段只能读 localStorage 镜像；
 *      storage 里的真值由 syncFromStorage() 在 init 时校正。
 *   2. 日出日落时刻来源：Open-Meteo daily=sunrise,sunset（复用天气已取的坐标与缓存）。
 *      拿不到就用本地近似（6:00 / 18:00）兜底，并在 UI 标注为「近似」。
 *   3. 跨天与定时：setInterval 每 60s 复查一次，夜间跨到白天、白天跨到夜间都能切；
 *      同时监听 matchMedia('prefers-color-scheme') 供 auto 模式即时响应系统切换。
 *   4. 主题只改 <html data-theme>，所有配色走 CSS token，不在 JS 里写颜色。
 */
(function () {
    if (window.ThemeManager) return;

    const STORAGE_KEY = 'themeSettings';
    const LS_MIRROR = 'ntce-theme'; // 同步读取用镜像，仅供首屏，不是真值
    const CHECK_INTERVAL = 60 * 1000;

    const DEFAULTS = {
        mode: 'auto', // auto | light | dark | sun
        lightStart: '07:00', // sun 模式兜底：无日出数据时用
        darkStart: '18:00',
    };

    // 本地时间 "HH:MM" -> 当日分钟数
    function toMinutes(hhmm) {
        const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
        if (!m) return null;
        const h = Number(m[1]);
        const min = Number(m[2]);
        if (h < 0 || h > 23 || min < 0 || min > 59) return null;
        return h * 60 + min;
    }

    class ThemeManager {
        constructor() {
            this.settings = { ...DEFAULTS };
            this.sunTimes = null; // { sunrise: 'HH:MM', sunset: 'HH:MM', approximate: bool }
            this.currentResolved = null; // 'light' | 'dark'
            this.timerId = null;
            this.mediaQuery = null;
            this.onChange = null; // (resolved, mode) => void
        }

        /* ---------- 首屏同步应用（<head> 内联调用） ---------- */

        /**
         * 只用 localStorage 镜像做同步判断，避免首帧闪烁。
         * 返回值可直接丢掉——它的唯一职责是设置 <html data-theme>。
         */
        static applyStoredSync() {
            let mirror = null;
            try {
                mirror = JSON.parse(localStorage.getItem(LS_MIRROR) || 'null');
            } catch {
                mirror = null;
            }
            const mode = (mirror && mirror.mode) || 'auto';
            let resolved;
            if (mode === 'light' || mode === 'dark') {
                resolved = mode;
            } else if (mode === 'sun') {
                // 同步阶段拿不到日出数据，先用兜底时间，异步阶段会校正
                resolved = ThemeManager.resolveSunSync(
                    mirror.lightStart || DEFAULTS.lightStart,
                    mirror.darkStart || DEFAULTS.darkStart
                );
            } else {
                resolved = ThemeManager.systemPrefers();
            }
            document.documentElement.setAttribute('data-theme', resolved);
            document.documentElement.setAttribute('data-theme-mode', mode);
            return resolved;
        }

        static systemPrefers() {
            try {
                return window.matchMedia('(prefers-color-scheme: light)').matches
                    ? 'light'
                    : 'dark';
            } catch {
                return 'dark';
            }
        }

        static resolveSunSync(lightStart, darkStart) {
            const now = new Date();
            const cur = now.getHours() * 60 + now.getMinutes();
            const ls = toMinutes(lightStart);
            const ds = toMinutes(darkStart);
            if (ls === null || ds === null) return 'dark';
            // 白日区间 [ls, ds)；跨零点时区间翻转
            if (ls <= ds) return cur >= ls && cur < ds ? 'light' : 'dark';
            return cur >= ls || cur < ds ? 'light' : 'dark';
        }

        /* ---------- 初始化 ---------- */

        async init() {
            await this.load();
            this.apply();
            this.startWatching();
            await this.refreshSunTimes();
            return this.settings;
        }

        async load() {
            try {
                const r = await chrome.storage.local.get([STORAGE_KEY]);
                const saved = r[STORAGE_KEY];
                if (saved && typeof saved === 'object') {
                    this.settings = { ...DEFAULTS, ...ThemeManager.sanitize(saved) };
                }
            } catch (e) {
                console.warn('读取主题设置失败，使用默认值:', e);
            }
            this.writeMirror();
            return this.settings;
        }

        static sanitize(input) {
            const out = {};
            if (['auto', 'light', 'dark', 'sun'].includes(input.mode)) out.mode = input.mode;
            if (toMinutes(input.lightStart) !== null) out.lightStart = input.lightStart;
            if (toMinutes(input.darkStart) !== null) out.darkStart = input.darkStart;
            return out;
        }

        writeMirror() {
            try {
                localStorage.setItem(LS_MIRROR, JSON.stringify(this.settings));
            } catch {
                // localStorage 不可用（隐私模式等）时忽略：异步路径仍会正确应用
            }
        }

        /* ---------- 解析与套用 ---------- */

        /**
         * 依据当前模式与日出日落数据解析出实际主题
         * @returns {'light'|'dark'}
         */
        resolve() {
            const mode = this.settings.mode;
            if (mode === 'light' || mode === 'dark') return mode;
            if (mode === 'auto') return ThemeManager.systemPrefers();

            // sun：优先用真实日出日落，缺失则用用户自定义兜底时间
            const sun = this.sunTimes;
            const startMin = toMinutes(sun && sun.sunrise) ?? toMinutes(this.settings.lightStart);
            const endMin = toMinutes(sun && sun.sunset) ?? toMinutes(this.settings.darkStart);
            const now = new Date();
            const cur = now.getHours() * 60 + now.getMinutes();
            if (startMin === null || endMin === null) return 'dark';
            const isLight =
                startMin <= endMin
                    ? cur >= startMin && cur < endMin
                    : cur >= startMin || cur < endMin;
            return isLight ? 'light' : 'dark';
        }

        apply() {
            const resolved = this.resolve();
            const changed = resolved !== this.currentResolved;
            this.currentResolved = resolved;
            document.documentElement.setAttribute('data-theme', resolved);
            document.documentElement.setAttribute('data-theme-mode', this.settings.mode);
            // 让浏览器原生控件（滚动条、表单）也跟随
            document.documentElement.style.colorScheme = resolved;
            if (changed && typeof this.onChange === 'function') {
                try {
                    this.onChange(resolved, this.settings.mode);
                } catch (e) {
                    console.warn('主题变更回调异常:', e);
                }
            }
            return resolved;
        }

        /* ---------- 设置写入 ---------- */

        async setMode(mode) {
            const next = { ...this.settings, mode };
            return this.save(next);
        }

        async setSunWindow(lightStart, darkStart) {
            const next = { ...this.settings };
            if (toMinutes(lightStart) !== null) next.lightStart = lightStart;
            if (toMinutes(darkStart) !== null) next.darkStart = darkStart;
            return this.save(next);
        }

        async save(nextSettings) {
            this.settings = { ...DEFAULTS, ...ThemeManager.sanitize(nextSettings) };
            this.writeMirror();
            try {
                await chrome.storage.local.set({ [STORAGE_KEY]: this.settings });
            } catch (e) {
                console.warn('保存主题设置失败:', e);
            }
            if (this.settings.mode === 'sun') await this.refreshSunTimes();
            this.apply();
            return this.settings;
        }

        /* ---------- 日出日落 ---------- */

        /**
         * 从天气模块已缓存的坐标取日出日落；没有坐标就直接跳过（不额外发起定位）。
         * 拿到后写成 "HH:MM" 并触发一次 apply，让 sun 模式用真实时刻。
         */
        async refreshSunTimes() {
            if (this.settings.mode !== 'sun') return null;
            try {
                const coord = await this.getCachedCoords();
                if (!coord) {
                    this.sunTimes = null;
                    return null;
                }
                const today = new Date();
                const ymd =
                    today.getFullYear() +
                    '-' +
                    String(today.getMonth() + 1).padStart(2, '0') +
                    '-' +
                    String(today.getDate()).padStart(2, '0');
                const key =
                    'ntce-sun-' +
                    ymd +
                    '-' +
                    coord.latitude.toFixed(2) +
                    '-' +
                    coord.longitude.toFixed(2);
                const cached = await chrome.storage.local.get([key]);
                if (cached[key]) {
                    this.sunTimes = cached[key];
                    this.apply();
                    return this.sunTimes;
                }
                const url =
                    'https://api.open-meteo.com/v1/forecast?latitude=' +
                    coord.latitude +
                    '&longitude=' +
                    coord.longitude +
                    '&daily=sunrise,sunset&timezone=auto&forecast_days=1';
                const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const data = await res.json();
                const sr = data && data.daily && data.daily.sunrise && data.daily.sunrise[0];
                const ss = data && data.daily && data.daily.sunset && data.daily.sunset[0];
                if (!sr || !ss) throw new Error('无日出日落数据');
                // Open-Meteo 返回 "2026-11-12T06:48" 形式，取时间部分
                const pick = s => {
                    const m = /T(\d{2}:\d{2})/.exec(String(s));
                    return m ? m[1] : null;
                };
                const result = {
                    sunrise: pick(sr),
                    sunset: pick(ss),
                    approximate: false,
                    ts: Date.now(),
                };
                if (!result.sunrise || !result.sunset) throw new Error('时间解析失败');
                await chrome.storage.local.set({ [key]: result });
                this.sunTimes = result;
                this.apply();
                return result;
            } catch (e) {
                // 取不到就用自定义兜底时间，绝不因此卡住主题
                console.warn('获取日出日落失败，改用自定义时段:', e.message);
                this.sunTimes = null;
                return null;
            }
        }

        async getCachedCoords() {
            try {
                const keys = ['om_last_location'];
                const r = await chrome.storage.local.get(keys);
                const loc = r && r.om_last_location;
                if (loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
                    return { latitude: loc.latitude, longitude: loc.longitude };
                }
            } catch {
                // 忽略：无坐标就用自定义时段
            }
            return null;
        }

        /* ---------- 监听 ---------- */

        startWatching() {
            this.stopWatching();
            // 跨天 / 到点切换：每分钟复查。用 60s 而非精确定时，
            // 因为日出日落本身只精确到分钟，且标签页可能长时间后台挂起。
            this.timerId = setInterval(() => this.apply(), CHECK_INTERVAL);

            try {
                this.mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
                const handler = () => {
                    if (this.settings.mode === 'auto') this.apply();
                };
                if (this.mediaQuery.addEventListener) {
                    this.mediaQuery.addEventListener('change', handler);
                } else if (this.mediaQuery.addListener) {
                    this.mediaQuery.addListener(handler);
                }
                this._mqHandler = handler;
            } catch {
                // matchMedia 不可用：auto 模式退化为首次解析结果
            }
        }

        stopWatching() {
            if (this.timerId) {
                clearInterval(this.timerId);
                this.timerId = null;
            }
            if (this.mediaQuery && this._mqHandler) {
                if (this.mediaQuery.removeEventListener) {
                    this.mediaQuery.removeEventListener('change', this._mqHandler);
                } else if (this.mediaQuery.removeListener) {
                    this.mediaQuery.removeListener(this._mqHandler);
                }
            }
        }

        /* ---------- 只读状态（供 UI 渲染） ---------- */

        getState() {
            return {
                mode: this.settings.mode,
                lightStart: this.settings.lightStart,
                darkStart: this.settings.darkStart,
                resolved: this.currentResolved,
                sunTimes: this.sunTimes,
                sunApproximate: !this.sunTimes,
            };
        }
    }

    window.ThemeManager = ThemeManager;
    window.ThemeManager.DEFAULTS = DEFAULTS;
    window.ThemeManager.STORAGE_KEY = STORAGE_KEY;
    window.ThemeManager.LS_MIRROR = LS_MIRROR;
})();
