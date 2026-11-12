/**
 * 数据备份与恢复模块
 *
 * 设计目标：**新增功能时备份格式自动兼容**，而不是每次加功能都要回来改白名单。
 *
 * 四层兼容机制：
 *   1) 键注册表（registry）：功能通过 register() 声明自己的键与类型。
 *      未登记的键**也不会丢**——导出走「全量减缓存」，新键自动被带走。
 *   2) 全量减缓存：chrome.storage.local.get(null) 取全部键，只剔除显式声明的
 *      缓存键（带 TTL、可随时重建）。这样即使某个功能忘了登记，用户数据仍在备份里。
 *   3) 迁移链（migrations）：schemaVersion 从 N 升到 M 时，按序执行 from→to 迁移，
 *      旧备份文件能被新版本正确解读。
 *   4) 未知键保留 + 向前兼容：遇到比当前版本更新的备份，不整体拒绝——
 *      已认识的键按类型校验后导入，不认识的键原样保留写入，
 *      既不丢弃未来功能的数据，也不让用户卡死。
 *
 * 边界：不碰 DOM（下载/选择文件由 app.js 触发），不渲染任何 UI。
 */

class BackupManager {
    constructor() {
        this.APP_ID = 'new-tab-pro';
        this.SCHEMA_VERSION = 2;
        this.MAX_IMPORT_BYTES = 8 * 1024 * 1024;
        // 未知键的安全约束：只接受常规标识符，避免把奇怪名字写进 storage
        this.SAFE_KEY_RE = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

        /**
         * 键注册表
         * type   期望的 JSON 类型
         * label  人类可读名（用于状态提示）
         * since  该键出现的 schemaVersion
         * cache  true = TTL 缓存，不导出
         */
        this.registry = {
            settings: { type: 'object', label: '设置', since: 1 },
            customEngines: { type: 'array', label: '自定义搜索引擎', since: 1 },
            quickAccessSites: { type: 'array', label: '快捷方式', since: 1 },
            todos: { type: 'array', label: '待办', since: 1 },
            notes: { type: 'array', label: '便签', since: 1 },
            pomodoroSettings: { type: 'object', label: '番茄钟设置', since: 1 },
            pomodoroStats: { type: 'object', label: '番茄钟统计', since: 1 },
            searchHistory: { type: 'array', label: '搜索历史', since: 1 },
            savedWallpaperId: { type: 'string', label: '壁纸 ID', since: 1 },
            savedWallpaperUrl: { type: 'string', label: '壁纸地址', since: 1 },
            savedWallpaperData: { type: 'object', label: '壁纸元数据', since: 1 },
            demoFolderSeeded: { type: 'boolean', label: '演示文件夹标记', since: 2 },
        };

        /**
         * 缓存键前缀：带 TTL、可随时重建，导出只会撑大文件且恢复后立刻过期。
         * 只列出确切前缀——不用过于宽泛的模式（如 /cache/i），
         * 否则将来某个用户数据键会被误当缓存静默丢弃，这正是本模块要避免的坑。
         */
        this.cachePrefixes = [
            'amap_adcode_',
            'amap_weather_',
            'om_geo_',
            'om_weather_',
            'om_last_location',
        ];

        /**
         * 迁移链：按 from 升序排列，导入时依次执行到当前 SCHEMA_VERSION。
         * 新增版本时在末尾追加 { from: N, to: N+1, migrate(data) }。
         */
        this.migrations = [
            {
                from: 1,
                to: 2,
                // v1 是白名单导出，理论上不含缓存键；这里做防御性剔除，
                // 防止手工编辑过的旧文件把缓存灌进来。
                migrate: data => {
                    const cleaned = {};
                    for (const key of Object.keys(data)) {
                        if (!this.isCacheKey(key)) cleaned[key] = data[key];
                    }
                    return cleaned;
                },
            },
        ];
    }

    /**
     * 供后续功能登记自己的 storage 键（可选）。
     * 不登记也能被导出——登记的价值是拿到类型校验与可读名。
     * @param {string} key
     * @param {{type?:string,label?:string,since?:number,cache?:boolean}} meta
     */
    register(key, meta) {
        if (!key) return;
        this.registry[key] = {
            type: (meta && meta.type) || 'object',
            label: (meta && meta.label) || key,
            since: (meta && meta.since) || this.SCHEMA_VERSION,
            cache: !!(meta && meta.cache),
        };
    }

    // 是否为缓存键（要么注册时标了 cache，要么命中缓存前缀）
    isCacheKey(key) {
        if (!key) return false;
        const meta = this.registry[key];
        if (meta && meta.cache) return true;
        return this.cachePrefixes.some(prefix => key.startsWith(prefix));
    }

    // 该键的期望类型（未登记返回 null，表示「不校验，按原样保留」）
    expectedType(key) {
        const meta = this.registry[key];
        return meta ? meta.type : null;
    }

    // 运行时取值的 JSON 类型
    static typeOf(value) {
        if (Array.isArray(value)) return 'array';
        if (value === null) return 'null';
        return typeof value;
    }

    /**
     * 组装备份载荷（不落盘）
     * @returns {Promise<{payload: Object, stats: Object}>}
     */
    async buildPayload() {
        // get(null) = 取全部键；这样新功能的数据自动进入备份，无需改这里
        const stored = (await chrome.storage.local.get(null)) || {};

        const data = {};
        const skippedCache = [];
        for (const key of Object.keys(stored)) {
            if (this.isCacheKey(key)) {
                skippedCache.push(key);
                continue;
            }
            data[key] = stored[key];
        }

        // 每个键带上自身元数据：未来版本即使不认识这个键，也知道它的类型与来历
        const keyMeta = {};
        const extras = [];
        for (const key of Object.keys(data)) {
            const meta = this.registry[key];
            if (meta) {
                keyMeta[key] = { type: meta.type, label: meta.label, since: meta.since };
            } else {
                // 未登记：仍然导出，类型由实际值推断
                keyMeta[key] = { type: BackupManager.typeOf(data[key]), label: key, since: null };
                extras.push(key);
            }
        }

        const payload = {
            app: this.APP_ID,
            schemaVersion: this.SCHEMA_VERSION,
            exportedAt: new Date().toISOString(),
            extensionVersion:
                chrome.runtime && chrome.runtime.getManifest
                    ? chrome.runtime.getManifest().version
                    : 'unknown',
            keys: keyMeta,
            extras: extras,
            skippedCache: skippedCache,
            data: data,
        };

        return { payload: payload, stats: this.summarize(payload) };
    }

    // 统计各键体量，供 UI 展示「这次备份了什么」
    summarize(payload) {
        const data = (payload && payload.data) || {};
        const items = [];
        let total = 0;
        for (const key of Object.keys(data)) {
            const value = data[key];
            let count = null;
            if (Array.isArray(value)) count = value.length;
            else if (value && typeof value === 'object') count = Object.keys(value).length;
            const bytes = JSON.stringify(value).length;
            total += bytes;
            items.push({
                key: key,
                type: BackupManager.typeOf(value),
                count: count,
                bytes: bytes,
            });
        }
        return { keys: items.length, bytes: total, items: items };
    }

    // 文件名：newtab-pro-backup-20261111-201530.json
    buildFileName(date) {
        const d = date || new Date();
        const p = n => String(n).padStart(2, '0');
        const stamp =
            d.getFullYear() +
            p(d.getMonth() + 1) +
            p(d.getDate()) +
            '-' +
            p(d.getHours()) +
            p(d.getMinutes()) +
            p(d.getSeconds());
        return 'newtab-pro-backup-' + stamp + '.json';
    }

    /**
     * 导出并触发下载
     * @returns {Promise<{fileName: string, bytes: number, stats: Object}>}
     */
    async exportToFile() {
        const built = await this.buildPayload();
        const text = JSON.stringify(built.payload, null, 2);
        const fileName = this.buildFileName();

        const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        // 立刻 revoke 会让部分浏览器取消下载，延后释放
        setTimeout(() => URL.revokeObjectURL(url), 10000);

        return { fileName: fileName, bytes: text.length, stats: built.stats };
    }

    /**
     * 把任意版本的备份数据迁移到当前 schemaVersion
     * @param {Object} data
     * @param {number} fromVersion
     * @returns {{data: Object, steps: number[]}}
     */
    migrate(data, fromVersion) {
        let current = data;
        const steps = [];
        let version = Number.isInteger(fromVersion) ? fromVersion : this.SCHEMA_VERSION;
        if (version >= this.SCHEMA_VERSION) return { data: current, steps: steps };

        // 迁移链按 from 升序逐级推进
        const chain = this.migrations.slice().sort((a, b) => a.from - b.from);
        for (const step of chain) {
            if (version === step.from) {
                current = step.migrate(current) || current;
                steps.push(step.to);
                version = step.to;
            }
        }
        return { data: current, steps: steps };
    }

    /**
     * 校验并归一化备份载荷。
     * 只对「结构性错误」抛异常；未知键 / 更高版本一律降级处理，不整体拒绝。
     * @param {*} raw JSON.parse 的结果
     */
    validate(raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            throw new Error('备份文件格式不正确：顶层必须是对象');
        }

        // 兼容两种形态：本扩展标准格式 / 裸数据对象
        const isStandard = typeof raw.app === 'string';
        let data;
        let declaredVersion = this.SCHEMA_VERSION;
        let exportedAt = null;

        if (isStandard) {
            if (raw.app !== this.APP_ID) {
                throw new Error('这不是 New Tab Pro 的备份文件（app 标识不匹配）');
            }
            if (typeof raw.schemaVersion === 'number' && Number.isInteger(raw.schemaVersion)) {
                declaredVersion = raw.schemaVersion;
            }
            exportedAt = typeof raw.exportedAt === 'string' ? raw.exportedAt : null;
            data = raw.data;
        } else {
            // 裸数据：当作最早的格式
            data = raw;
            declaredVersion = 1;
        }

        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('备份文件里没有可导入的数据');
        }

        // 先迁移到当前版本，再校验（旧格式可能缺字段、多缓存键）
        const migrated = this.migrate(data, declaredVersion);
        const source = migrated.data;

        const accepted = {};
        const unknown = [];
        const skippedCache = [];

        for (const key of Object.keys(source)) {
            // 缓存键不导入：恢复后会自动重建，写进去只会让旧缓存覆盖新缓存
            if (this.isCacheKey(key)) {
                skippedCache.push(key);
                continue;
            }

            if (!this.SAFE_KEY_RE.test(key)) {
                throw new Error('字段名 "' + key + '" 不合法');
            }

            const value = source[key];
            const expected = this.expectedType(key);

            if (expected) {
                const actual = BackupManager.typeOf(value);
                if (actual !== expected) {
                    throw new Error(
                        '字段 "' + key + '" 类型不正确：期望 ' + expected + '，实际 ' + actual
                    );
                }
            } else {
                // 未登记键：向前兼容，原样保留（不可能为 undefined，JSON 里不存在）
                unknown.push(key);
            }

            accepted[key] = value;
        }

        // 链接字段的安全清洗：备份文件是外部输入，里面的 URL 协议不可信。
        // 渲染端（advanced-pagination 的 <a href>、app.js 的 window.open、壁纸 background-image）
        // 虽然也做了兜底，但数据边界先拦一刀成本最低，也能把「剔除了几条」如实告诉用户。
        const droppedLinks = this.sanitizeLinks(accepted);
        // 字段级清洗：顶层类型对得上不代表内容能用（settings 里塞字符串会让滑杆算出 NaN，
        // todos/notes 里塞数字会让渲染端取 .content 直接崩）。这里按各自的真实结构逐字段收敛。
        const droppedItems = this.sanitizeValues(accepted);

        if (Object.keys(accepted).length === 0) {
            throw new Error('备份文件里没有可导入的数据（未找到已知字段）');
        }

        return {
            data: accepted,
            schemaVersion: declaredVersion,
            currentVersion: this.SCHEMA_VERSION,
            forwardCompat: declaredVersion > this.SCHEMA_VERSION,
            migratedTo: migrated.steps.length ? migrated.steps[migrated.steps.length - 1] : null,
            upgradeSteps: migrated.steps,
            unknown: unknown,
            skippedCache: skippedCache,
            exportedAt: exportedAt,
            isStandard: isStandard,
            droppedLinks: droppedLinks,
            droppedItems: droppedItems,
        };
    }

    /**
     * 清洗备份数据里的链接字段（就地修改）。
     * 只处理「会被当成地址去打开」的字段：快捷方式、文件夹内条目、自定义搜索引擎、壁纸地址。
     * 判定标准与 js/utils/url-safe.js 一致（本模块也要能在没有 window 的环境下跑，故带正则兜底）。
     * @param {Object} accepted 已通过类型校验的数据
     * @returns {number} 被剔除的条目数
     */
    sanitizeLinks(accepted) {
        const isHttp =
            typeof window !== 'undefined' && window.UrlSafe
                ? url => window.UrlSafe.isHttp(url)
                : url => /^https?:\/\//i.test(String(url == null ? '' : url).trim());
        let dropped = 0;

        if (Array.isArray(accepted.quickAccessSites)) {
            const sites = [];
            for (const node of accepted.quickAccessSites) {
                if (!node || typeof node !== 'object') {
                    dropped++;
                    continue;
                }
                if (node.isFolder) {
                    const items = Array.isArray(node.items) ? node.items : [];
                    const keptItems = items.filter(item => {
                        const ok = !!item && typeof item === 'object' && isHttp(item.url);
                        if (!ok) dropped++;
                        return ok;
                    });
                    node.items = keptItems;
                    // 空文件夹保留：用户可能就是要占位，静默删掉等于吞数据
                    sites.push(node);
                    continue;
                }
                if (!isHttp(node.url)) {
                    dropped++;
                    continue;
                }
                sites.push(node);
            }
            accepted.quickAccessSites = sites;
        }

        if (Array.isArray(accepted.customEngines)) {
            accepted.customEngines = accepted.customEngines.filter(engine => {
                const ok = !!engine && typeof engine === 'object' && isHttp(engine.url);
                if (!ok) dropped++;
                return ok;
            });
        }

        // 壁纸地址会进 background-image：非图片地址留着只会变成远程探测
        const isImageOk =
            typeof window !== 'undefined' && window.UrlSafe
                ? url => window.UrlSafe.isImageSource(url)
                : url => /^(https?:\/\/|data:image\/)/i.test(String(url == null ? '' : url).trim());
        if ('savedWallpaperUrl' in accepted && !isImageOk(accepted.savedWallpaperUrl)) {
            delete accepted.savedWallpaperUrl;
            dropped++;
        }

        return dropped;
    }

    /**
     * 字段级清洗（就地修改）。顶层类型校验管不到字段内部：
     *   settings.wallpaperBrightness = "abc" → 滑杆/透明度算出 NaN，整页背景直接失效
     *   todos[0].content 不是字符串 → 渲染端 (content || '').toLowerCase() 抛异常
     * 处理原则与链接清洗一致：能确认类型的留下，确认不了的逐个丢弃并计数，
     * 让各模块回落到自己的默认值，而不是带着坏值去渲染。
     * @param {Object} accepted
     * @returns {number} 被剔除的字段/条目数
     */
    sanitizeValues(accepted) {
        const isPlainObject = v => !!v && typeof v === 'object' && !Array.isArray(v);
        const asNumber = (v, min, max) => {
            if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
            return Math.min(max, Math.max(min, v));
        };
        const asString = v => (typeof v === 'string' ? v : undefined);
        let dropped = 0;

        // ---- settings：按真实默认值的类型收敛；未登记字段原样保留（向前兼容）----
        if (isPlainObject(accepted.settings)) {
            const rules = {
                pexelsApiKey: asString,
                weatherApiKey: asString,
                weatherCity: asString,
                temperatureUnit: v => (v === 'celsius' || v === 'fahrenheit' ? v : undefined),
                wallpaperQuery: asString,
                searchEngine: asString,
                tagline: asString,
                // 与设置面板滑杆的 min/max 对齐（newtab.html:614 起）
                wallpaperBrightness: v => asNumber(v, 0.3, 1),
                wallpaperBlur: v => asNumber(v, 0, 20),
                showSideWidgets: v => (typeof v === 'boolean' ? v : undefined),
                wallpaperSource: v => (v === 'picsum' || v === 'wallhaven' ? v : undefined),
            };
            const cleanSettings = {};
            for (const key of Object.keys(accepted.settings)) {
                const rule = rules[key];
                if (!rule) {
                    cleanSettings[key] = accepted.settings[key];
                    continue;
                }
                const ok = rule(accepted.settings[key]);
                if (ok === undefined) {
                    dropped++;
                    continue;
                }
                cleanSettings[key] = ok;
            }
            accepted.settings = cleanSettings;
        }

        // ---- todos：结构见 js/modules/todo-manager.js:6 ----
        if (Array.isArray(accepted.todos)) {
            const kept = [];
            for (const todo of accepted.todos) {
                if (!isPlainObject(todo) || typeof todo.content !== 'string') {
                    dropped++;
                    continue;
                }
                const item = Object.assign({}, todo);
                item.important = todo.important === true;
                item.done = todo.done === true;
                item.category =
                    ['work', 'life', 'normal'].indexOf(todo.category) !== -1
                        ? todo.category
                        : 'normal';
                if (typeof todo.createdAt !== 'number' || !Number.isFinite(todo.createdAt)) {
                    delete item.createdAt;
                }
                if (typeof todo.completedAt !== 'number' || !Number.isFinite(todo.completedAt)) {
                    item.completedAt = null;
                }
                item.dueDate = typeof todo.dueDate === 'string' ? todo.dueDate : null;
                kept.push(item);
            }
            accepted.todos = kept;
        }

        // ---- notes：结构见 js/modules/notes-manager.js:5 ----
        if (Array.isArray(accepted.notes)) {
            accepted.notes = accepted.notes
                .filter(note => {
                    const ok = isPlainObject(note) && typeof note.content === 'string';
                    if (!ok) dropped++;
                    return ok;
                })
                .map(note => {
                    const item = Object.assign({}, note);
                    item.pinned = note.pinned === true;
                    return item;
                });
        }

        // ---- searchHistory：字符串数组，去重并限制长度 ----
        if (Array.isArray(accepted.searchHistory)) {
            const seen = Object.create(null);
            const kept = [];
            for (const word of accepted.searchHistory) {
                if (typeof word !== 'string' || !word) {
                    dropped++;
                    continue;
                }
                if (seen[word]) {
                    dropped++;
                    continue;
                }
                seen[word] = true;
                kept.push(word);
            }
            accepted.searchHistory = kept.slice(0, 20);
        }

        return dropped;
    }

    /**
     * 从文本导入（先校验，后写入；任一致命错误整体不写）
     * @param {string} text 文件内容
     */
    async importFromText(text) {
        if (typeof text !== 'string' || !text.trim()) {
            throw new Error('文件内容为空');
        }
        // 用字节数而不是字符数：中文一个字占 3 字节，按 length 判会放进来三倍大的文件
        const bytes =
            typeof TextEncoder !== 'undefined'
                ? new TextEncoder().encode(text).length
                : text.length;
        if (bytes > this.MAX_IMPORT_BYTES) {
            const mb = (this.MAX_IMPORT_BYTES / 1024 / 1024).toFixed(0);
            throw new Error('备份文件过大（超过 ' + mb + ' MB），已拒绝导入');
        }

        let raw;
        try {
            raw = JSON.parse(text);
        } catch (e) {
            throw new Error('无法解析 JSON：' + e.message);
        }

        const checked = this.validate(raw);

        // 校验全部通过后才写入，避免「导入一半」
        await chrome.storage.local.set(checked.data);

        return {
            keys: Object.keys(checked.data),
            unknown: checked.unknown,
            skippedCache: checked.skippedCache,
            schemaVersion: checked.schemaVersion,
            forwardCompat: checked.forwardCompat,
            migratedTo: checked.migratedTo,
            exportedAt: checked.exportedAt,
            droppedLinks: checked.droppedLinks,
            droppedItems: checked.droppedItems,
        };
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BackupManager;
}
