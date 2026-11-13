/**
 * 天气管理模块
 * 负责获取和显示天气信息，支持自动定位和手动设置城市
 */
class WeatherManager {
    constructor() {
        // 优先使用设置里的API Key，其次使用配置文件中的默认值
        this.apiKey = '';
        this.baseUrl = window.WEATHER_CONFIG?.BASE_URL || 'https://restapi.amap.com/v3';
        this.weatherData = null;
        this.currentCity = '';
        this.temperatureUnit = window.WEATHER_CONFIG?.DEFAULT_UNIT || 'celsius';
        this.isLoading = false;
        // 刷新 loading 提示的生命周期句柄（见 showRefreshHint / settleRefreshTip）
        this._refreshTip = null;
        this._refreshSafetyTimer = null;

        // 天气图标映射
        this.weatherIcons = window.WEATHER_CONFIG?.ICON_MAPPING || {
            '01d': 'sunny', // 晴天
            '01n': 'clear-night', // 晴夜
            '02d': 'partly-cloudy-day', // 多云
            '02n': 'partly-cloudy-night', // 多云夜
            '03d': 'cloudy', // 阴天
            '03n': 'cloudy',
            '04d': 'cloudy', // 阴天
            '04n': 'cloudy',
            '09d': 'rain', // 小雨
            '09n': 'rain',
            '10d': 'rain', // 中雨
            '10n': 'rain',
            '11d': 'thunderstorm', // 雷雨
            '11n': 'thunderstorm',
            '13d': 'snow', // 雪
            '13n': 'snow',
            '50d': 'fog', // 雾
            '50n': 'fog',
        };

        this.init();
    }

    /**
     * 设置API密钥（供外部在保存设置后调用）
     */
    setApiKey(apiKey) {
        if (apiKey) {
            this.apiKey = apiKey;
        }
    }

    /**
     * 初始化天气管理器
     */
    async init() {
        try {
            // 从存储中加载设置
            await this.loadSettings();
            // 读取天气API Key
            const settings = await chrome.storage.local.get(['settings']);
            this.apiKey =
                settings && settings.settings && settings.settings.weatherApiKey
                    ? settings.settings.weatherApiKey
                    : window.WEATHER_CONFIG?.API_KEY || '';
            // 历史占位符视为未配置（走 Open-Meteo 免密钥路径）
            if (this.apiKey === 'your_amap_api_key_here') {
                this.apiKey = '';
            }

            // 绑定天气组件点击事件
            this.bindWeatherWidgetEvents();

            // 启动优先走缓存渲染，避免刷新即请求
            const usedCache = await this.displayCachedWeatherIfFresh();
            if (!usedCache) {
                // 缓存过期/缺失：先把旧数据贴上（带「· 缓存」标记），再后台更新，
                // 网络慢或接口超时也不会让卡片先空成「--°C」
                const cached = await this.readCachedData().catch(() => null);
                if (cached && cached.data) {
                    this.weatherData = cached.data;
                    this.displayWeather(cached.data);
                }
                await this.updateWeather();
            }

            // 设置定时更新：保存句柄，重复 init 时先清掉旧定时器，避免叠加请求
            const updateInterval = window.WEATHER_CONFIG?.UPDATE_INTERVAL || 30 * 60 * 1000;
            if (this.updateTimer) clearInterval(this.updateTimer);
            this.updateTimer = setInterval(() => {
                this.updateWeather();
            }, updateInterval);
        } catch (error) {
            console.error('天气管理器初始化失败:', error);
            this.showError('天气服务初始化失败');
        }
    }

    /**
     * 当前城市对应的 adcode 缓存（24h）。
     * 「当前位置」是定位路径的占位文案，不是城市名，不能拿来当 key 查。
     */
    async readAmapAdcodeCache() {
        const city = this.currentCity;
        if (!city || city === '当前位置') return null;
        const adcodeKey = `amap_adcode_${city}`;
        const stored = await chrome.storage.local.get([adcodeKey]);
        const entry = stored && stored[adcodeKey];
        if (!entry || !entry.adcode) return null;
        const ttl = window.WEATHER_CONFIG?.ADCODE_CACHE_TTL || 24 * 60 * 60 * 1000;
        if (Date.now() - (entry.ts || 0) >= ttl) return null;
        return entry;
    }

    /**
     * 若缓存仍在有效期内，则直接渲染缓存并跳过请求
     */
    async displayCachedWeatherIfFresh() {
        try {
            const ttl = this.getCacheTtl();
            const adcoded = await this.readAmapAdcodeCache();
            // 1) 高德城市缓存（city -> adcode -> weather）
            if (adcoded) {
                const wKey = `amap_weather_${adcoded.adcode}`;
                const cachedW = await this.readWeatherCache(wKey);
                if (cachedW && cachedW.fresh) {
                    this.weatherData = cachedW.data;
                    this.displayWeather(this.weatherData);
                    this.lastResolvedCacheKey = wKey;
                    return true;
                }
            }

            // 2) Open-Meteo 按城市：上次 geocoding 的坐标 + 该坐标的天气缓存
            if (this.currentCity) {
                const place = await this.readWeatherCache(`om_geo_${this.currentCity}`);
                if (place && place.fresh && place.data.latitude !== undefined) {
                    const key = `om_weather_${place.data.latitude.toFixed(
                        2
                    )}_${place.data.longitude.toFixed(2)}`;
                    const cachedW = await this.readWeatherCache(key);
                    if (cachedW && cachedW.fresh) {
                        this.weatherData = cachedW.data;
                        this.displayWeather(this.weatherData);
                        this.lastResolvedCacheKey = key;
                        return true;
                    }
                }
            }

            // 3) 兜底：上次成功的整体快照（无论走的是哪条链路）
            const lastOk = await this.readLastOk();
            if (lastOk && lastOk.data && Date.now() - (lastOk.ts || 0) < ttl) {
                this.weatherData = lastOk.data;
                this.displayWeather(this.weatherData);
                return true; // key 未知：成功回写只更新 weather_last_ok
            }

            // 都过期了，返回 false 走正常流程（上层会先贴旧值再后台更新）
            return false;
        } catch (e) {
            console.warn('读取缓存天气失败，将走网络请求:', e?.message || e);
            return false;
        }
    }

    /**
     * 绑定天气组件事件
     */
    bindWeatherWidgetEvents() {
        const weatherWidget = document.getElementById('weather-widget');
        if (weatherWidget) {
            // 点击天气组件刷新天气
            weatherWidget.addEventListener('click', e => {
                // 如果点击的是设置按钮，不触发刷新
                if (e.target.closest('.weather-settings-btn')) {
                    return;
                }

                // 显示刷新提示
                this.showRefreshHint();

                // 延迟刷新，避免频繁点击
                setTimeout(() => {
                    this.refresh();
                }, 500);
            });

            // 添加鼠标悬停提示
            weatherWidget.title = '点击刷新天气信息';
        }
    }

    /**
     * 统一天气提示入口：委托 dsh-tip 组件完成定位、翻转、视口钳制与同锚点去重。
     *
     * 旧实现把提示条 absolute 挂在天气组件内部，向上弹会越过视口顶边被裁；
     * 且按钮用内联 onclick，在 MV3 的 CSP（script-src 'self'）下不会执行。
     * 现在两类问题都由组件层一次性解决。
     * @param {Object} opts dshTip.attach 的选项（type/message/duration/actions...）
     */
    showWeatherTip(opts) {
        const anchor = document.getElementById('weather-widget');
        if (!anchor || !window.dshTip) return null;
        // key 固定为 'weather'：刷新/权限/超时三种提示互斥，新的覆盖旧的，不叠罗汉
        return window.dshTip.attach(
            anchor,
            Object.assign({ key: 'weather', placement: 'auto' }, opts)
        );
    }

    /**
     * 显示刷新提示
     *
     * 不再用固定 2000ms 定时器：它与真实请求无关，请求慢时提示早消失，
     * 鼠标停在提示上时又会因 hover 暂停而常驻（「图标自己一直在转」）。
     * 改为 duration: 0 + 由 refresh() 在请求结束时收敛。
     */
    showRefreshHint() {
        this.clearRefreshTipSafety();
        this._refreshTip = this.showWeatherTip({
            type: 'loading',
            message: '正在刷新天气...',
            duration: 0,
        });
        // 兜底：定位授权卡住 / 请求永远不返回时，finally 也不会执行，
        // 旋转图标会永久自转。12s 上限保证任何情况下都能收敛。
        this._refreshSafetyTimer = setTimeout(() => this.settleRefreshTip(), 12000);
        return this._refreshTip;
    }

    clearRefreshTipSafety() {
        if (this._refreshSafetyTimer) {
            clearTimeout(this._refreshSafetyTimer);
            this._refreshSafetyTimer = null;
        }
    }

    /**
     * 收敛本次刷新的 loading 提示。
     * 若期间被错误/权限提示替换（同 key 去重会 close 旧实例），这里跳过，不误关新提示。
     */
    settleRefreshTip() {
        this.clearRefreshTipSafety();
        const tip = this._refreshTip;
        this._refreshTip = null;
        if (tip && !tip.closed && typeof tip.close === 'function') tip.close();
    }

    /**
     * 加载天气设置
     */
    async loadSettings() {
        try {
            const result = await chrome.storage.local.get(['settings']);
            const s = (result && result.settings) || {};
            this.currentCity = s.weatherCity || '';
            // 清洗历史污染数据：早期版本把定位占位文案「当前位置」误存为城市名，
            // 会导致 geocoding 查询「当前位置」永远失败且不再尝试定位
            if (this.currentCity === '当前位置') {
                this.currentCity = '';
                this.saveSettings(); // 写回清洗结果（fire-and-forget，失败不影响启动）
            }
            this.temperatureUnit = s.temperatureUnit || 'celsius';
        } catch (error) {
            console.error('加载天气设置失败:', error);
        }
    }

    /**
     * 保存天气设置
     */
    async saveSettings() {
        try {
            const result = await chrome.storage.local.get(['settings']);
            const merged = {
                ...(result.settings || {}),
                weatherCity: this.currentCity,
                temperatureUnit: this.temperatureUnit,
            };
            await chrome.storage.local.set({ settings: merged });
        } catch (error) {
            console.error('保存天气设置失败:', error);
        }
    }

    /**
     * 更新天气信息
     * @param {{force?: boolean}} [options] force=true 跳过节流与冷却（用户手动刷新/换城市）
     */
    async updateWeather({ force = false } = {}) {
        if (this.isLoading) return;
        // 限流：避免过于频繁
        const now = Date.now();
        const minInterval = window.WEATHER_CONFIG?.MIN_REQUEST_INTERVAL || 10000;
        if (!force && this._lastRequestAt && now - this._lastRequestAt < minInterval) {
            return;
        }
        // 上一次失败的冷却期（配额类失败冷却 30 分钟，避免继续烧配额）
        if (!force && (await this.inCooldown())) {
            console.info('[weather] 处于失败冷却期，跳过本次请求');
            // 冷却期内至少把上次成功的数据显示出来，别让卡片停在「--°C」
            const cached = await this.readCachedData().catch(() => null);
            if (cached && cached.data && !this.weatherData) {
                this.weatherData = cached.data;
                this.displayWeather(cached.data);
                this.markStale(Math.max(1, Math.round((Date.now() - (cached.ts || 0)) / 60000)));
            }
            return;
        }
        this._lastRequestAt = now;

        // 缓存先行：已有数据时不再进 loading 态（避免每 30 分钟图标脉冲闪一下），
        // 只有空白卡片才需要 loading 提示
        const preCached = this.weatherData ? null : await this.readCachedData().catch(() => null);
        if (preCached && preCached.data) {
            this.weatherData = preCached.data;
            this.displayWeather(preCached.data);
        } else {
            this.isLoading = true;
            this.showLoading();
        }

        try {
            let weatherData;
            this.lastResolvedCacheKey = null;

            if (!this.apiKey) {
                // 未配置高德Key：使用 Open-Meteo 免费天气接口（无需任何密钥）
                weatherData = await this.getOpenMeteoWeather();
            } else if (this.currentCity) {
                // 使用指定城市 => 先换为adcode（带缓存）
                const adcode = await this.getAdcodeByCity(this.currentCity);
                weatherData = await this.getWeatherByAdcode(adcode);
            } else {
                // 使用当前位置，带重试机制
                weatherData = await this.getWeatherByLocationWithRetry();
            }

            if (weatherData && Number.isFinite(weatherData.temperature)) {
                // 命中缓存返回的旧数据不能把「· 缓存」标记抹掉（时间戳还是旧的）
                if (!weatherData.__fromCache) {
                    this.clearStale();
                    // 成功即清零连续失败计数：下次再失败重新从基础冷却开始
                    this.clearFailCount().catch(() => {});
                }
                this.weatherData = weatherData;
                this.displayWeather(weatherData);
                // 统一落缓存：weather_last_ok（失败回退用）+ 本次链路自己的 key
                this.writeWeatherCache(this.lastResolvedCacheKey, weatherData).catch(() => {});
                // 若当前未指定城市且成功从定位/IP 获取到城市名，持久化保存，避免频繁请求
                // 注意：「当前位置」是定位路径的显示占位文案，不是真实城市名，
                // 持久化它会让下次启动误走城市查询（geocoding 查不到）→ 永远失败
                if (!this.currentCity && weatherData.city && weatherData.city !== '当前位置') {
                    try {
                        await this.persistDetectedCity(weatherData.city);
                    } catch (e) {
                        console.warn('自动保存定位城市失败:', e?.message || e);
                    }
                }
            }
        } catch (error) {
            const msg = error?.message || '获取天气信息失败';
            // 定位不可用/被拒绝是常见预期态（用户未授权），降级为 info，避免每次开标签页刷错误
            const expectedGeoIssue =
                /权限被拒绝|位置信息不可用|获取位置超时|不支持地理位置|未找到可用/.test(msg);
            if (expectedGeoIssue) {
                console.info('[weather] 定位不可用，已跳过自动定位：', msg);
            } else {
                console.error('获取天气信息失败:', error);
            }
            // 冷却：配额/Key 异常、以及「要用户改设置才会变」的定位权限问题都冷却 30 分钟；
            // 其余（网络抖动、空数据）3 分钟，给一次快速恢复的机会。
            const needsUserAction =
                error?.fatal ||
                /权限被拒绝|不支持地理位置|请在浏览器\/系统设置中允许位置访问/.test(msg);
            const cooldownMs = needsUserAction ? 30 * 60 * 1000 : 3 * 60 * 1000;
            this.setCooldown(cooldownMs, msg).catch(() => {});

            // 有上次成功的数据就继续显示（并在提示里说明是缓存），不要把卡片打成错误态；
            // 但超过 WEATHER_CACHE_MAX_AGE 的陈旧数据不再顶替错误态，否则用户永远看不到「该修了」
            const lastOk = await this.readLastOk().catch(() => null);
            if (lastOk && lastOk.data && this.isCacheUsable(lastOk.ts)) {
                const ageMin = Math.max(1, Math.round((Date.now() - (lastOk.ts || 0)) / 60000));
                this.weatherData = lastOk.data;
                // displayWeather 内部会按数据年龄挂上「· 缓存」
                this.displayWeather(lastOk.data);
                this.showWeatherTip({
                    type: 'warning',
                    message: `天气更新失败（${error?.fatal ? '接口配额或 Key 异常' : msg}），当前显示 ${ageMin} 分钟前的数据`,
                    duration: 5000,
                    closable: true,
                });
            } else {
                this.showError(msg);
            }
        } finally {
            this.isLoading = false;
            // 加载态必须收敛：weatherData 为空等边界下 displayWeather 不会被调用，
            // .weather-widget.loading 的 pulse 会一直残留成「自己动」的指示。
            this.hideLoading();
        }
    }

    /**
     * 高德的失败分两类：
     *   配额/Key/服务不可用 —— 重试与刷新都没有意义，冷却越久越好；
     *   其它（网络抖动、空数据）—— 短冷却，让用户过几分钟再试。
     */
    static isAmapFatal(info) {
        return /CUQPS|QUERY_OVER_LIMIT|OVER_LIMIT|INVALID_USER_KEY|USERKEY_PLAT_NOMATCH|INVALID_USER_SCODE|SERVICE_NOT_AVAILABLE/i.test(
            String(info || '')
        );
    }

    // 高德返回 HTTP 200 但 status !== '1' 同样算失败；把 info 抬到错误对象上，便于上层分类
    assertAmapOk(data, label) {
        if (!data || data.status === '1') return;
        const info = data.info || data.infocode || '未知错误';
        const error = new Error(`${label}接口返回失败：${info}`);
        error.amapInfo = info;
        error.fatal = WeatherManager.isAmapFatal(info);
        throw error;
    }

    // 失败冷却：写一个截止时间戳，冷却期内不再打接口（用户手动刷新除外）
    async inCooldown() {
        const key = 'weather_cooldown_until';
        const result = await chrome.storage.local.get([key]);
        return (result[key] || 0) > Date.now();
    }

    /**
     * 记一次失败冷却，并按连续失败次数指数退避。
     *
     * 为什么不是固定时长：底层失败绝大多数是「本机到该域名不通」（open-meteo
     * 在国内长期不稳），固定 3 分钟冷却意味着用户每 3 分钟就被动再打一轮
     * 注定失败的网络请求，DevTools 里就是永不停歇的飘红。连续失败第 1 次
     * 冷却 3 分钟，之后每失败一次翻倍，封顶 30 分钟 —— 网络恢复后最多
     * 半小时就会被重新探测到，而网络一直不通时不再骚扰。
     *
     * @param {number} ms 基础冷却时长（首次失败用）
     * @param {string} reason 失败原因，展示用
     */
    async setCooldown(ms, reason) {
        const key = 'weather_fail_count';
        const stored = await chrome.storage.local.get([key]).catch(() => ({}));
        const fails = ((stored && stored[key]) || 0) + 1;
        // 首次用传入的基础时长，之后按 2^(n-1) 翻倍
        const backoff = ms * Math.pow(2, Math.min(fails - 1, 4));
        await chrome.storage.local.set({
            [key]: fails,
            weather_cooldown_until: Date.now() + backoff,
            weather_cooldown_reason: reason || '',
        });
        if (fails > 1) {
            console.info(
                `[weather] 连续失败 ${fails} 次，冷却 ${Math.round(backoff / 60000)} 分钟`
            );
        }
    }

    /** 请求成功时清零失败计数，让下次失败重新从基础冷却开始。 */
    async clearFailCount() {
        const stored = await chrome.storage.local.get(['weather_fail_count']).catch(() => ({}));
        if (stored && stored.weather_fail_count) {
            await chrome.storage.local.remove(['weather_fail_count']).catch(() => {});
        }
    }

    /* ==================== 缓存 ==================== */

    getCacheTtl() {
        return window.WEATHER_CONFIG?.WEATHER_CACHE_TTL || 20 * 60 * 1000;
    }

    // 过期缓存的兜底上限：超过这个年龄就不再拿来显示（宁可显示错误提示）
    getMaxCacheAge() {
        return window.WEATHER_CONFIG?.WEATHER_CACHE_MAX_AGE || 24 * 60 * 60 * 1000;
    }

    isCacheUsable(ts) {
        return !!ts && Date.now() - ts <= this.getMaxCacheAge();
    }

    // 数据年龄（分钟）；数据里带 timestamp，缺失则视为未知
    getDataAgeMinutes(data) {
        if (!data) return null;
        const ts = Number(data.timestamp);
        if (!Number.isFinite(ts) || ts <= 0) return null;
        const age = Date.now() - ts;
        if (age < 0) return null;
        return age / 60000;
    }

    /**
     * 带缓存读取天气：命中即返回，不回源。
     * @returns {Promise<{data: object, ts: number|null, fresh: boolean}|null>}
     */
    async readWeatherCache(key) {
        if (!key) return null;
        try {
            const stored = await chrome.storage.local.get([key]);
            const entry = stored && stored[key];
            if (!entry || !entry.data) return null;
            return {
                data: entry.data,
                ts: entry.ts || null,
                fresh: Date.now() - (entry.ts || 0) < this.getCacheTtl(),
            };
        } catch (e) {
            console.warn('[weather] 读取天气缓存失败:', e?.message || e);
            return null;
        }
    }

    /**
     * 写天气缓存（同时留一份上次成功，供失败回退）
     */
    async writeWeatherCache(key, data) {
        const entry = { data, ts: Date.now() };
        const payload = { weather_last_ok: entry };
        if (key) payload[key] = entry;
        try {
            await chrome.storage.local.set(payload);
        } catch (e) {
            console.warn('[weather] 写入天气缓存失败:', e?.message || e);
        }
    }

    /**
     * 缓存先行：内存里的 weatherData / 持久化的 weather_last_ok 中取一份立即可显示的数据。
     * 过期数据也返回（由调用方决定是否回源），这样卡片一开就有内容，网络慢也不会先闪「--°C」。
     * @returns {Promise<{data: object, ts: number|null, fresh: boolean}|null>}
     */
    async readCachedData() {
        if (this.weatherData) {
            const ts = this.weatherData.timestamp || null;
            return {
                data: this.weatherData,
                ts,
                fresh: ts ? Date.now() - ts < this.getCacheTtl() : false,
            };
        }
        const lastOk = await this.readLastOk();
        if (!lastOk || !lastOk.data) return null;
        // 太久以前的缓存（默认 24h 上限）不再显示，否则「缓存」会变成错误数据的保护伞
        if (!this.isCacheUsable(lastOk.ts)) return null;
        return {
            data: lastOk.data,
            ts: lastOk.ts,
            fresh: Date.now() - lastOk.ts < this.getCacheTtl(),
        };
    }

    // 上一次成功的数据：刷新失败时继续显示，而不是把卡片打成错误态
    async readLastOk() {
        const result = await chrome.storage.local.get(['weather_last_ok']);
        return result.weather_last_ok || null;
    }

    /**
     * 标记「当前显示的是缓存数据」。
     * 失败提示几秒后就消失，此后用户没有别的线索判断数据是否新鲜，
     * 所以在卡片上留一个常驻的「· 缓存」小标记（CSS 渲染，不改 DOM 结构）。
     */
    markStale(ageMin) {
        const widget = document.getElementById('weather-widget');
        if (!widget) return;
        widget.classList.add('is-stale');
        widget.title = ageMin
            ? `当前显示 ${ageMin} 分钟前的缓存数据（下次自动更新在冷却结束后）`
            : '当前显示缓存数据';
    }

    clearStale() {
        const widget = document.getElementById('weather-widget');
        if (!widget) return;
        widget.classList.remove('is-stale');
        widget.removeAttribute('title');
    }

    /**
     * 持久化保存自动识别到的城市（仅当用户未手动设置城市时）
     */
    async persistDetectedCity(cityName) {
        if (!cityName) return;
        // 若用户已经设置了城市，则不覆盖
        if (this.currentCity) return;
        this.currentCity = cityName;
        await this.saveSettings();
    }
    /**
     * 根据城市名获取adcode（带缓存）
     */
    async getAdcodeByCity(cityName) {
        const cacheKey = `amap_adcode_${cityName}`;
        const cached = await chrome.storage.local.get([cacheKey]);
        const ttl = window.WEATHER_CONFIG?.ADCODE_CACHE_TTL || 24 * 60 * 60 * 1000;
        if (cached && cached[cacheKey] && Date.now() - cached[cacheKey].ts < ttl) {
            return cached[cacheKey].adcode;
        }
        const url = `${this.baseUrl}/geocode/geo?key=${this.apiKey}&address=${encodeURIComponent(cityName)}`;
        const { fetchJSON } = await import('../utils/request.js');
        const data = await fetchJSON(url, {
            timeout: window.WEATHER_CONFIG?.GEOLOCATION_TIMEOUT || 10000,
            // retries: 1 —— 每次重试都是一次配额消耗，配额类/Key 类错误重试也没用
            retries: 1,
            retryDelay: 600,
            backoff: 2,
        });
        this.assertAmapOk(data, '城市编码');
        if (!data.geocodes || data.geocodes.length === 0) {
            throw new Error('未查询到城市adcode');
        }
        const adcode = data.geocodes[0].adcode || data.geocodes[0].citycode;
        if (!adcode) throw new Error('未查询到城市adcode');
        await chrome.storage.local.set({ [cacheKey]: { adcode, ts: Date.now() } });
        return adcode;
    }

    /**
     * 通过adcode获取天气（带缓存）
     */
    async getWeatherByAdcode(adcode) {
        const cacheKey = `amap_weather_${adcode}`;
        const cached = await chrome.storage.local.get([cacheKey]);
        const ttl = window.WEATHER_CONFIG?.WEATHER_CACHE_TTL || 20 * 60 * 1000;
        if (cached && cached[cacheKey] && Date.now() - cached[cacheKey].ts < ttl) {
            this.lastResolvedCacheKey = cacheKey;
            return { ...cached[cacheKey].data, __fromCache: true };
        }
        const url = `${this.baseUrl}/weather/weatherInfo?key=${this.apiKey}&city=${adcode}&extensions=base`;
        const { fetchJSON } = await import('../utils/request.js');
        const data = await fetchJSON(url, {
            timeout: window.WEATHER_CONFIG?.GEOLOCATION_TIMEOUT || 10000,
            retries: 1,
            retryDelay: 600,
            backoff: 2,
        });
        this.assertAmapOk(data, '天气');
        if (!data.lives || data.lives.length === 0) {
            throw new Error('高德天气返回空数据');
        }
        const formatted = this.formatAmapWeatherData(data.lives[0]);
        this.lastResolvedCacheKey = cacheKey;
        delete formatted.__fromCache;
        await chrome.storage.local.set({ [cacheKey]: { data: formatted, ts: Date.now() } });
        return formatted;
    }

    /**
     * 带重试机制的位置天气获取
     *
     * maxRetries 默认 1 = 不重试。内层 fetchOpenMeteoCurrent / getAdcodeByCity
     * 各自已经有降级兜底，外层再叠 2 次重试就是乘法：2 × 2 = 4 轮完整链路，
     * 每轮 5 秒超时时用户要干等 20 秒以上，DevTools 里一串飘红的 forecast。
     * 真要重试交给 30 分钟定时器和用户手动刷新。
     */
    async getWeatherByLocationWithRetry(maxRetries = 1) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`尝试获取位置天气 (第${attempt}次)...`);
                return await this.getWeatherByLocation();
            } catch (error) {
                console.log(`第${attempt}次尝试失败:`, error.message);

                if (attempt === maxRetries) {
                    // 最后一次尝试失败，抛出错误
                    throw error;
                }

                // 等待一段时间后重试
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }

    /**
     * 根据位置获取天气（先逆地理到adcode，再取天气）
     */
    async getWeatherByLocation() {
        try {
            const position = await this.getCurrentPosition();
            const lng = position.coords.longitude;
            const lat = position.coords.latitude;
            // 逆地理，获取adcode
            const regeoUrl = `${this.baseUrl}/geocode/regeo?key=${this.apiKey}&location=${lng},${lat}`;
            const { fetchJSON } = await import('../utils/request.js');
            const regeoData = await fetchJSON(regeoUrl, {
                timeout: window.WEATHER_CONFIG?.GEOLOCATION_TIMEOUT || 10000,
                retries: 1,
                retryDelay: 600,
                backoff: 2,
            });
            this.assertAmapOk(regeoData, '逆地理');
            const adcode = regeoData?.regeocode?.addressComponent?.adcode;
            const cityCode = adcode || regeoData?.regeocode?.addressComponent?.citycode;
            const detectedCityName =
                regeoData?.regeocode?.addressComponent?.city ||
                regeoData?.regeocode?.addressComponent?.province;
            if (!adcode && !cityCode) {
                throw new Error('逆地理失败，未获取到adcode');
            }
            // 顺手把「城市 → adcode」也写进缓存：下次启动若 currentCity 已被持久化成这个城市，
            // getAdcodeByCity 就能直接命中，省掉一次 geocode 请求
            if (detectedCityName && (adcode || cityCode)) {
                chrome.storage.local
                    .set({
                        ['amap_adcode_' + detectedCityName]: {
                            adcode: adcode || cityCode,
                            ts: Date.now(),
                        },
                    })
                    .catch(() => {});
            }
            // 天气
            const data = await this.getWeatherByAdcode(adcode || cityCode);
            // 持久化保存自动识别到的城市
            if (!this.currentCity && detectedCityName) {
                try {
                    await this.persistDetectedCity(detectedCityName);
                } catch (e) {
                    console.warn('保存定位城市失败:', e?.message || e);
                }
            }
            return data;
        } catch (error) {
            console.warn('基于浏览器定位失败，尝试使用IP定位作为回退...', error?.message || error);
            // 回退：使用IP定位获取adcode
            try {
                const { adcode, cityName } = await this.getAdcodeByIP();
                const data = await this.getWeatherByAdcode(adcode);
                if (!this.currentCity && cityName) {
                    try {
                        await this.persistDetectedCity(cityName);
                    } catch (e) {
                        console.warn('保存IP城市失败:', e?.message || e);
                    }
                }
                return data;
            } catch (ipErr) {
                console.error('IP 定位回退也失败:', ipErr);
                // 配额/Key 问题必须以 IP 路径的错误为准，否则上层会当成普通定位失败、只冷却 3 分钟
                if (ipErr?.fatal) throw ipErr;
                throw error; // 其余情况抛原始错误，便于上层判断权限/超时
            }
        }
    }

    /**
     * 通过IP定位获取 adcode（回退方案）
     */
    async getAdcodeByIP() {
        const { fetchJSON } = await import('../utils/request.js');
        // 直接使用高德 IP 定位，无需额外第三方服务/host 权限
        const url = `${this.baseUrl}/ip?key=${this.apiKey}`;
        const data = await fetchJSON(url, {
            timeout: (window.WEATHER_CONFIG?.GEOLOCATION_TIMEOUT || 10000) - 1000,
            retries: 1,
            retryDelay: 500,
            backoff: 2,
        });
        this.assertAmapOk(data, 'IP 定位');
        const ipAdcode = data?.adcode || data?.citycode;
        if (!ipAdcode) throw new Error('IP定位未返回adcode');
        const cityName = data?.city || data?.province;
        return { adcode: ipAdcode, cityName };
    }

    /**
     * 获取当前位置
     */
    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!('geolocation' in navigator)) {
                reject(new Error('浏览器不支持地理位置'));
                return;
            }

            const geoOptions = {
                enableHighAccuracy: true,
                timeout: window.WEATHER_CONFIG?.GEOLOCATION_TIMEOUT || 10000,
                maximumAge: window.WEATHER_CONFIG?.GEOLOCATION_MAX_AGE || 5 * 60 * 1000,
            };

            const mapGeoError = error => {
                if (!error) return '获取位置失败（未知原因）';
                // 标准 PositionError(code) 与现代 DOMException(name)
                const code = typeof error.code === 'number' ? error.code : undefined;
                const name = error.name || '';
                const msg = error.message || '';

                // 先按 code 分类
                if (code === 1 /* PERMISSION_DENIED */) {
                    return '地理位置权限被拒绝，请在浏览器/系统设置中允许位置访问';
                }
                if (code === 2 /* POSITION_UNAVAILABLE */) {
                    return '位置信息不可用';
                }
                if (code === 3 /* TIMEOUT */) {
                    return '获取位置超时，请检查网络/定位设置';
                }

                // 再按 name/消息特征
                if (name === 'NotAllowedError' || /denied|blocked/i.test(msg)) {
                    return '地理位置权限被拒绝，请在浏览器/系统设置中允许位置访问';
                }
                if (name === 'NotFoundError') {
                    return '未找到可用的定位源，请检查系统定位是否开启';
                }
                if (name === 'SecurityError') {
                    return '定位被安全策略阻止，请检查浏览器定位设置';
                }
                if (/timeout/i.test(msg)) {
                    return '获取位置超时，请检查网络/定位设置';
                }
                return '获取位置时发生未知错误';
            };

            const requestLocation = () => {
                let settled = false;

                // 先尝试高精度，失败或超时则自动回退到低精度，延长超时
                const tryHighAccuracy = () => {
                    const opts = {
                        enableHighAccuracy: true,
                        timeout: Math.min(geoOptions.timeout, 8000),
                        maximumAge: geoOptions.maximumAge,
                    };
                    const timerA = setTimeout(() => {
                        if (settled) return;
                        tryLowAccuracy();
                    }, opts.timeout + 200);

                    navigator.geolocation.getCurrentPosition(
                        pos => {
                            if (settled) return;
                            settled = true;
                            clearTimeout(timerA);
                            resolve(pos);
                        },
                        () => {
                            if (settled) return;
                            clearTimeout(timerA);
                            tryLowAccuracy();
                        },
                        opts
                    );
                };

                const tryLowAccuracy = () => {
                    const opts = {
                        enableHighAccuracy: false,
                        timeout: Math.max(geoOptions.timeout, 12000),
                        maximumAge: geoOptions.maximumAge,
                    };
                    const timerB = setTimeout(() => {
                        if (settled) return;
                        settled = true;
                        reject(new Error('获取位置超时，请检查网络/定位设置'));
                    }, opts.timeout + 200);

                    navigator.geolocation.getCurrentPosition(
                        pos => {
                            if (settled) return;
                            settled = true;
                            clearTimeout(timerB);
                            resolve(pos);
                        },
                        err => {
                            if (settled) return;
                            settled = true;
                            clearTimeout(timerB);
                            reject(new Error(mapGeoError(err)));
                        },
                        opts
                    );
                };

                tryHighAccuracy();
            };

            if (navigator.permissions && navigator.permissions.query) {
                navigator.permissions
                    .query({ name: 'geolocation' })
                    .then(status => {
                        if (status.state === 'denied') {
                            reject(
                                new Error('地理位置权限被拒绝，请在浏览器/系统设置中允许位置访问')
                            );
                            return;
                        }
                        requestLocation();
                    })
                    .catch(() => {
                        requestLocation();
                    });
            } else {
                requestLocation();
            }
        });
    }

    /* ==================== Open-Meteo 免密钥天气（无高德Key时的默认路径） ==================== */

    /**
     * 通过 Open-Meteo 获取天气（免费、无需API Key）
     * 优先使用设置的城市名（走 geocoding），否则使用浏览器定位坐标
     */
    async getOpenMeteoWeather() {
        this.lastResolvedCacheKey = null;
        if (this.currentCity) {
            return this.getOpenMeteoByCity(this.currentCity);
        }
        return this.getOpenMeteoByLocation();
    }

    /**
     * 按城市名获取 Open-Meteo 天气（geocoding 结果与天气均带缓存）
     */
    async getOpenMeteoByCity(cityName) {
        const { fetchJSON } = await import('../utils/request.js');
        // 1. 城市名 -> 坐标（带 24h 缓存）
        const geoKey = `om_geo_${cityName}`;
        const geoCached = await chrome.storage.local.get([geoKey]);
        const geoTtl = window.WEATHER_CONFIG?.ADCODE_CACHE_TTL || 24 * 60 * 60 * 1000;
        let place = geoCached && geoCached[geoKey];
        if (!place || Date.now() - place.ts >= geoTtl) {
            const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
                cityName
            )}&count=1&language=zh&format=json`;
            const data = await fetchJSON(url, {
                timeout: window.WEATHER_CONFIG?.GEOLOCATION_TIMEOUT || 10000,
                retries: 2,
                retryDelay: 600,
                backoff: 2,
            });
            if (!data.results || data.results.length === 0) {
                throw new Error('未查询到该城市，请检查城市名称');
            }
            const r = data.results[0];
            place = {
                name: r.name,
                admin1: r.admin1 || '',
                country: r.country || '',
                latitude: r.latitude,
                longitude: r.longitude,
                ts: Date.now(),
            };
            await chrome.storage.local.set({ [geoKey]: place });
        }
        // 2. 坐标 -> 天气
        return this.fetchOpenMeteoCurrent(
            place.latitude,
            place.longitude,
            place.admin1 ? `${place.name}·${place.admin1}` : place.name,
            place.country
        );
    }

    /**
     * 按浏览器定位获取 Open-Meteo 天气（定位失败回退上次成功坐标）
     * 定位不可用/被拒绝属常见情况（用户未授权、系统关闭定位），不应每次开标签页都刷错误日志，
     * 因此这里静默降级：能回退就用缓存坐标，回退不了才把原始错误抛给上层展示提示。
     */
    async getOpenMeteoByLocation() {
        const locKey = 'om_last_location';
        try {
            const position = await this.getCurrentPosition();
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;
            const data = await this.fetchOpenMeteoCurrent(latitude, longitude, '当前位置', '');
            await chrome.storage.local.set({
                [locKey]: { latitude, longitude, ts: Date.now() },
            });
            return data;
        } catch (geoErr) {
            // 静默回退：优先用上次成功坐标
            const last = await chrome.storage.local.get([locKey]);
            const saved = last && last[locKey];
            if (saved) {
                return this.fetchOpenMeteoCurrent(saved.latitude, saved.longitude, '当前位置', '');
            }
            // 无缓存可选：交由上层统一展示友好文案（不在这里打 warn，避免噪音）
            throw geoErr;
        }
    }

    /**
     * 调用 Open-Meteo forecast 接口并格式化（带缓存）
     */
    async fetchOpenMeteoCurrent(latitude, longitude, cityName, country) {
        const { fetchJSON } = await import('../utils/request.js');
        const cacheKey = `om_weather_${latitude.toFixed(2)}_${longitude.toFixed(2)}`;
        const cached = await chrome.storage.local.get([cacheKey]);
        const ttl = window.WEATHER_CONFIG?.WEATHER_CACHE_TTL || 20 * 60 * 1000;
        if (cached && cached[cacheKey] && Date.now() - cached[cacheKey].ts < ttl) {
            this.lastResolvedCacheKey = cacheKey;
            return { ...cached[cacheKey].data, __fromCache: true };
        }
        const base = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}`;
        const timeout = window.WEATHER_CONFIG?.GEOLOCATION_TIMEOUT || 10000;
        // retries: 0 —— 这里刻意不重试。
        //
        // 以前是 retries: 1，加上下面的 legacy 兜底接口（各 1 次重试）和
        // getWeatherByLocationWithRetry 外层的 2 次重试，最坏情况是
        // 2 × (2 + 2) = 8 次 5 秒超时 = 40 秒 —— 用户打开新标签页能看见
        // 满屏飘红的 forecast 请求，就是这个乘法爆炸造成的。
        //
        // 这些失败绝大多数是「本机到 api.open-meteo.com 不通」（国内网络对这域名
        // 长期不稳定），不是接口抖动。对不可达的下游重试没有任何收益，只会
        // 把等待时间叠成 N 倍并把 DevTools 刷满。失败就交给上层冷却。
        const opts = { timeout, retries: 0 };

        let current;
        try {
            const data = await fetchJSON(
                `${base}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,` +
                    'weather_code,wind_speed_10m,wind_direction_10m,pressure_msl&timezone=auto',
                opts
            );
            if (!data || !data.current) throw new Error('Open-Meteo 返回空数据');
            current = data.current;
        } catch (primaryErr) {
            // 降级：旧版 current_weather 接口字段少（无湿度/气压），但可用性更高，
            // 实测新接口偶发整段超时（HTTP 000）而它照常返回，所以留作兜底。
            console.warn(
                '[weather] Open-Meteo current 接口失败，改用 current_weather 兜底:',
                primaryErr?.message || primaryErr
            );
            const legacy = await fetchJSON(`${base}&current_weather=true&timezone=auto`, opts);
            if (!legacy || !legacy.current_weather) throw primaryErr;
            const cw = legacy.current_weather;
            current = {
                temperature_2m: cw.temperature,
                apparent_temperature: cw.temperature,
                is_day: cw.is_day,
                weather_code: cw.weathercode,
                wind_speed_10m: cw.windspeed,
                wind_direction_10m: cw.winddirection,
            };
        }

        const formatted = this.formatOpenMeteoData(current, cityName, country);
        this.lastResolvedCacheKey = cacheKey;
        await chrome.storage.local.set({ [cacheKey]: { data: formatted, ts: Date.now() } });
        return formatted;
    }

    /**
     * 将 Open-Meteo current 结构格式化为内部结构（对齐高德 formatter 字段）
     */
    formatOpenMeteoData(current, cityName, country) {
        const code = current.weather_code;
        const isNight = current.is_day === 0;
        const [description, iconBase] = this.getWmoMapping(code);
        // 夜间图标适配
        let icon = iconBase;
        if (isNight) {
            if (iconBase === 'sunny') icon = 'clear-night';
            else if (iconBase === 'cloudy-sunny') icon = 'partly-cloudy-night';
        }
        return {
            temperature: Math.round(current.temperature_2m),
            feelsLike: Math.round(current.apparent_temperature),
            humidity:
                current.relative_humidity_2m !== undefined
                    ? Math.round(current.relative_humidity_2m)
                    : undefined,
            pressure:
                current.pressure_msl !== undefined ? Math.round(current.pressure_msl) : undefined,
            description,
            icon,
            city: cityName || '当前位置',
            country: country || '',
            windSpeed:
                current.wind_speed_10m !== undefined
                    ? Math.round(current.wind_speed_10m)
                    : undefined,
            windDeg:
                current.wind_direction_10m !== undefined
                    ? Math.round(current.wind_direction_10m)
                    : undefined,
            sunrise: undefined,
            sunset: undefined,
            timestamp: Date.now(),
        };
    }

    /**
     * WMO weathercode -> [中文描述, 图标类别]
     */
    getWmoMapping(code) {
        const map = {
            0: ['晴', 'sunny'],
            1: ['晴', 'sunny'],
            2: ['多云', 'cloudy-sunny'],
            3: ['阴', 'cloudy'],
            45: ['雾', 'fog'],
            48: ['雾凇', 'fog'],
            51: ['毛毛雨', 'rain'],
            53: ['毛毛雨', 'rain'],
            55: ['毛毛雨', 'rain'],
            56: ['冻雨', 'snow'],
            57: ['冻雨', 'snow'],
            61: ['小雨', 'rain'],
            63: ['中雨', 'rain'],
            65: ['大雨', 'heavy-rain'],
            66: ['冻雨', 'snow'],
            67: ['冻雨', 'snow'],
            71: ['小雪', 'snow'],
            73: ['中雪', 'snow'],
            75: ['大雪', 'snow'],
            77: ['雪', 'snow'],
            80: ['阵雨', 'rain'],
            81: ['阵雨', 'rain'],
            82: ['强阵雨', 'heavy-rain'],
            85: ['阵雪', 'snow'],
            86: ['阵雪', 'snow'],
            95: ['雷阵雨', 'thunderstorm'],
            96: ['雷阵雨伴冰雹', 'thunderstorm'],
            99: ['雷阵雨伴冰雹', 'thunderstorm'],
        };
        return map[code] || ['未知', 'unknown'];
    }

    /**
     * 将高德实况天气lives[0]格式化为内部结构
     */
    formatAmapWeatherData(live) {
        return {
            temperature: parseInt(live.temperature, 10),
            feelsLike: parseInt(live.temperature, 10),
            humidity: parseInt(live.humidity, 10),
            pressure: undefined,
            description: live.weather,
            icon: undefined,
            city: live.city || live.province,
            country: 'CN',
            windSpeed: live.windpower ? parseInt(live.windpower, 10) : undefined,
            windDeg: undefined,
            sunrise: undefined,
            sunset: undefined,
            timestamp: Date.now(),
        };
    }

    /**
     * 显示天气信息
     */
    displayWeather(weatherData) {
        const temperatureEl = document.getElementById('temperature');
        const weatherDescEl = document.getElementById('weather-desc');
        const locationEl = document.getElementById('location');
        const weatherSvgEl = document.getElementById('weather-svg');

        if (!temperatureEl || !weatherDescEl || !locationEl || !weatherSvgEl) {
            console.error('天气显示元素未找到');
            return;
        }

        // 显示温度
        const temp =
            this.temperatureUnit === 'fahrenheit'
                ? Math.round((weatherData.temperature * 9) / 5 + 32)
                : weatherData.temperature;
        const unit = this.temperatureUnit === 'fahrenheit' ? '°F' : '°C';
        temperatureEl.textContent = `${temp}${unit}`;

        // 显示天气描述
        weatherDescEl.textContent = weatherData.description;

        // 显示位置（country 可能为空，如 Open-Meteo 定位路径）
        locationEl.textContent = [weatherData.city, weatherData.country].filter(Boolean).join(', ');

        // 选择合适的图标（适配高德天气描述）
        const iconType = this.getIconTypeForAmap(weatherData.description);
        this.updateWeatherIcon(weatherSvgEl, iconType);

        // 缓存态由数据年龄决定：过期数据无论来自 cache-first 还是失败回退，
        // 都统一挂上「· 缓存」标记，避免「看着是实时数据其实是旧值」
        const ageMin = this.getDataAgeMinutes(weatherData);
        if (ageMin !== null && ageMin * 60000 > this.getCacheTtl()) {
            this.markStale(ageMin);
        } else {
            this.clearStale();
        }

        // 移除加载状态
        this.hideLoading();
    }

    /**
     * 更新天气图标
     */
    updateWeatherIcon(svgElement, iconCode) {
        const type = this.weatherIcons[iconCode] || iconCode || 'unknown';
        svgElement.innerHTML = this.getWeatherIconSvg(type);
    }

    /**
     * 获取天气图标SVG
     */
    getWeatherIconSvg(iconType) {
        const icons = {
            'cloudy-sunny': `
                <path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 0 0 4 14.5" fill="none" stroke="currentColor" stroke-width="2"/>
                <circle cx="7" cy="9" r="3" fill="none" stroke="currentColor" stroke-width="2"/>
            `,
            sunny: `
                <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2"/>
                <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" stroke-width="2"/>
                <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" stroke-width="2"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" stroke-width="2"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" stroke-width="2"/>
                <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" stroke-width="2"/>
                <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" stroke-width="2"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" stroke-width="2"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" stroke-width="2"/>
            `,
            'clear-night': `
                <path d="M12 3a6 6 0 0 0 6 6 6 6 0 0 0 6-6" fill="none" stroke="currentColor" stroke-width="2"/>
                <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/>
                <path d="M12 1v3m0 16v3" fill="none" stroke="currentColor" stroke-width="2"/>
                <path d="M4.22 4.22l2.12 2.12m11.32 11.32l2.12 2.12" fill="none" stroke="currentColor" stroke-width="2"/>
                <path d="M1 12h3m16 0h3" fill="none" stroke="currentColor" stroke-width="2"/>
                <path d="M4.22 19.78l2.12-2.12m11.32-11.32l2.12-2.12" fill="none" stroke="currentColor" stroke-width="2"/>
            `,
            'partly-cloudy-day': `
                <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2"/>
                <path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 0 0 4 14.5" fill="none" stroke="currentColor" stroke-width="2"/>
            `,
            'partly-cloudy-night': `
                <path d="M12 3a6 6 0 0 0 6 6 6 6 0 0 0 6-6" fill="none" stroke="currentColor" stroke-width="2"/>
                <path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 0 0 4 14.5" fill="none" stroke="currentColor" stroke-width="2"/>
            `,
            cloudy: `
                <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="none" stroke="currentColor" stroke-width="2"/>
            `,
            rain: `
                <path d="M16 4a4 4 0 0 0-4 4 4 4 0 0 0-4 4" fill="none" stroke="currentColor" stroke-width="2"/>
                <path d="M8 20v-6" fill="none" stroke="currentColor" stroke-width="2"/>
                <path d="M12 20v-6" fill="none" stroke="currentColor" stroke-width="2"/>
                <path d="M16 20v-6" fill="none" stroke="currentColor" stroke-width="2"/>
            `,
            'heavy-rain': `
                <path d="M16 4a4 4 0 0 0-4 4 4 4 0 0 0-4 4" fill="none" stroke="currentColor" stroke-width="2"/>
                <path d="M7 22v-7" stroke="currentColor" stroke-width="2"/>
                <path d="M11 22v-7" stroke="currentColor" stroke-width="2"/>
                <path d="M15 22v-7" stroke="currentColor" stroke-width="2"/>
                <path d="M19 22v-7" stroke="currentColor" stroke-width="2"/>
            `,
            thunderstorm: `
                <path d="M16 4a4 4 0 0 0-4 4 4 4 0 0 0-4 4" fill="none" stroke="currentColor" stroke-width="2"/>
                <path d="M8 20v-6" fill="none" stroke="currentColor" stroke-width="2"/>
                <path d="M12 20v-6" fill="none" stroke="currentColor" stroke-width="2"/>
                <path d="M16 20v-6" fill="none" stroke="currentColor" stroke-width="2"/>
                <path d="M10 14l-2 2 2 2" fill="none" stroke="currentColor" stroke-width="2"/>
                <path d="M14 14l-2 2 2 2" fill="none" stroke="currentColor" stroke-width="2"/>
            `,
            snow: `
                <path d="M16 4a4 4 0 0 0-4 4 4 4 0 0 0-4 4 4 4 0 0 0-4 4" fill="none" stroke="currentColor" stroke-width="2"/>
                <path d="M8 20v-6" fill="none" stroke="currentColor" stroke-width="2"/>
                <path d="M12 20v-6" fill="none" stroke="currentColor" stroke-width="2"/>
                <path d="M16 20v-6" fill="none" stroke="currentColor" stroke-width="2"/>
                <circle cx="8" cy="18" r="1" fill="currentColor"/>
                <circle cx="12" cy="18" r="1" fill="currentColor"/>
                <circle cx="16" cy="18" r="1" fill="currentColor"/>
            `,
            fog: `
                <path d="M16 4a4 4 0 0 0-4 4 4 4 0 0 0-4 4 4 4 0 0 0-4 4" fill="none" stroke="currentColor" stroke-width="2"/>
                <line x1="4" y1="18" x2="20" y2="18" stroke="currentColor" stroke-width="2"/>
                <line x1="4" y1="22" x2="20" y2="22" stroke="currentColor" stroke-width="2"/>
            `,
            unknown: `
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
                <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2"/>
                <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" stroke-width="2"/>
            `,
        };

        return icons[iconType] || icons['unknown'];
    }

    /**
     * 将高德天气现象描述映射为图标类别
     */
    getIconTypeForAmap(desc) {
        // 高德天气现象表为中文，这里做精细匹配
        const text = (desc || '').trim();
        if (!text) return 'unknown';

        // 晴系
        if (text.includes('晴间多云') || text.includes('少云')) return 'cloudy-sunny';
        if (text.includes('晴')) return 'sunny';

        // 多云/阴
        if (text.includes('多云') || text.includes('阴')) return 'cloudy';

        // 雨系（由强到弱优先判定）
        if (text.includes('特大暴雨') || text.includes('极端降雨')) return 'heavy-rain';
        if (text.includes('大暴雨') || text.includes('暴雨-大暴雨')) return 'heavy-rain';
        if (text.includes('暴雨') || text.includes('大雨-暴雨')) return 'heavy-rain';
        if (text.includes('大雨')) return 'heavy-rain';
        if (text.includes('中雨-大雨')) return 'rain';
        if (text.includes('小雨-中雨')) return 'rain';
        if (text.includes('中雨')) return 'rain';
        if (text.includes('毛毛雨') || text.includes('细雨') || text.includes('小雨'))
            return 'rain';
        if (text.includes('冻雨') || text.includes('雨夹雪') || text.includes('阵雨夹雪'))
            return 'snow';
        if (text.includes('阵雨')) return 'rain';

        // 雷雨/冰雹
        if (text.includes('雷阵雨并伴有冰雹')) return 'thunderstorm';
        if (text.includes('强雷阵雨') || text.includes('雷阵雨')) return 'thunderstorm';
        if (text.includes('雷')) return 'thunderstorm';

        // 雪系
        if (text.includes('大雪-暴雪') || text.includes('暴雪')) return 'snow';
        if (text.includes('中雪-大雪')) return 'snow';
        if (text.includes('小雪-中雪')) return 'snow';
        if (
            text.includes('大雪') ||
            text.includes('中雪') ||
            text.includes('小雪') ||
            text.includes('阵雪') ||
            text.includes('雪')
        )
            return 'snow';

        // 低能见度/沙尘
        if (
            text.includes('强浓雾') ||
            text.includes('特强浓雾') ||
            text.includes('浓雾') ||
            text.includes('大雾') ||
            text.includes('轻雾') ||
            text.includes('雾')
        )
            return 'fog';
        if (
            text.includes('严重霾') ||
            text.includes('重度霾') ||
            text.includes('中度霾') ||
            text.includes('霾')
        )
            return 'fog';
        if (
            text.includes('沙尘暴') ||
            text.includes('强沙尘暴') ||
            text.includes('扬沙') ||
            text.includes('浮尘') ||
            text.includes('沙尘')
        )
            return 'fog';

        // 风类（无独立图标，归为cloudy）
        if (text.includes('风') || text.includes('飓风') || text.includes('热带风暴'))
            return 'cloudy';

        return 'unknown';
    }

    /**
     * 显示加载状态
     */
    showLoading() {
        const weatherWidget = document.getElementById('weather-widget');
        if (weatherWidget) {
            weatherWidget.classList.add('loading');
        }
    }

    /**
     * 隐藏加载状态
     */
    hideLoading() {
        const weatherWidget = document.getElementById('weather-widget');
        if (weatherWidget) {
            weatherWidget.classList.remove('loading');
        }
    }

    /**
     * 显示错误信息
     */
    showError(message) {
        const temperatureEl = document.getElementById('temperature');
        const weatherDescEl = document.getElementById('weather-desc');
        const locationEl = document.getElementById('location');

        if (temperatureEl) temperatureEl.textContent = '--°C';
        if (weatherDescEl) {
            // 卡面只放一句短语：整句错误在 360px 的卡片里只能靠省略号截断，读起来是半句话。
            // 完整原因已经由下方 toast 给出，卡面保留可扫读的状态词即可。
            const short = /权限被拒绝|NotAllowed|Permission/.test(message)
                ? '定位未授权'
                : /超时|timeout/.test(message)
                  ? '定位超时'
                  : /位置信息不可用|未找到可用/.test(message)
                    ? '无法定位'
                    : /城市/.test(message)
                      ? '城市无效'
                      : '天气获取失败';
            weatherDescEl.textContent = short;
            weatherDescEl.title = message;
        }
        if (locationEl) {
            // 给可执行的下一步，而不是笼统的「获取失败」
            if (/城市/.test(message)) {
                locationEl.textContent = '打开右上角 ⚙️ 设置可修改天气城市';
            } else if (/权限被拒绝|NotAllowed/.test(message)) {
                locationEl.textContent = '点 ⚙️ 设置天气城市即可显示';
            } else if (/位置信息不可用|未找到可用/.test(message)) {
                locationEl.textContent = '点 ⚙️ 设置天气城市即可显示';
            } else if (/超时/.test(message)) {
                locationEl.textContent = '定位超时，点 ⚙️ 可手动设城市';
            } else {
                locationEl.textContent = '获取失败';
            }
        }

        // 根据错误类型显示不同提示
        if (message.includes('权限') || message.includes('Permission')) {
            this.showPermissionHint();
        } else if (message.includes('超时') || message.includes('timeout')) {
            this.showTimeoutHint();
        }

        this.hideLoading();
    }

    /**
     * 显示权限提示（常驻直到用户处理；按钮走 addEventListener 以符合 MV3 CSP）
     */
    showPermissionHint() {
        this.showWeatherTip({
            type: 'warning',
            message: '需要位置权限',
            duration: 0,
            closable: true,
            actions: [
                {
                    label: '重试授权',
                    title: '重新触发定位授权',
                    onClick: () => this.requestLocationPrompt(),
                },
                {
                    label: '定位设置',
                    title: '打开浏览器定位设置',
                    keepOpen: true,
                    onClick: () => this.openLocationSettings(),
                },
            ],
        });
    }

    /**
     * 打开浏览器的定位权限设置。
     * 扩展页面无法用 window.open 打开 chrome:// 地址（会被直接拒绝且无任何反馈），
     * 改用 chrome.tabs.create，并读取 lastError；连这个都被拦时给出文字指引，别留一个点了没反应的按钮。
     */
    openLocationSettings() {
        const url = 'chrome://settings/content/location';
        const fallback = () => {
            this.showWeatherTip({
                type: 'info',
                message: '请在地址栏打开 ' + url + ' ，允许本站使用位置信息后点「重试授权」',
                duration: 0,
                closable: true,
            });
        };
        try {
            if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
                chrome.tabs.create({ url: url }, () => {
                    // 读一次 lastError：不读会被标记为未处理错误，且这里正是判断成功与否的依据
                    if (chrome.runtime && chrome.runtime.lastError) fallback();
                });
                return;
            }
        } catch (error) {
            console.warn('打开定位设置失败:', error && error.message);
        }
        fallback();
    }

    /**
     * 主动触发一次定位授权提示（用于用户未看到系统弹窗时）
     */
    async requestLocationPrompt() {
        try {
            // 再次检查权限状态
            if (navigator.permissions && navigator.permissions.query) {
                try {
                    const status = await navigator.permissions.query({ name: 'geolocation' });
                    if (status.state === 'denied') {
                        this.showError('地理位置权限被拒绝，请在浏览器/系统设置中允许位置访问');
                        return;
                    }
                } catch {}
            }
            // 直接尝试获取一次，促使浏览器弹出授权条
            await this.getCurrentPosition();
            // 成功后刷新天气
            await this.refresh();
        } catch (e) {
            // 失败则维持提示
            this.showError(e?.message || '获取位置失败');
        }
    }

    /**
     * 显示超时提示
     */
    showTimeoutHint() {
        this.showWeatherTip({
            type: 'warning',
            message: '位置获取超时，点击重试',
            duration: 5000,
            closable: true,
            action: {
                label: '重试',
                onClick: () => this.refresh(),
            },
        });
    }

    /**
     * 设置城市
     */
    async setCity(cityName) {
        this.currentCity = cityName;
        await this.saveSettings();
        // 换城市是明确意图，跳过冷却与节流
        await this.updateWeather({ force: true });
    }

    /**
     * 使用当前位置
     */
    async useCurrentLocation() {
        this.currentCity = '';
        await this.saveSettings();
        await this.updateWeather({ force: true });
    }

    /**
     * 设置温度单位
     */
    async setTemperatureUnit(unit) {
        this.temperatureUnit = unit;
        await this.saveSettings();

        // 如果已有天气数据，重新显示
        if (this.weatherData) {
            this.displayWeather(this.weatherData);
        }
    }

    /**
     * 获取当前天气数据
     */
    getCurrentWeather() {
        return this.weatherData;
    }

    /**
     * 刷新天气信息
     */
    async refresh() {
        try {
            // 用户手动点刷新 = 明确的「现在就再试一次」，绕过冷却
            await this.updateWeather({ force: true });
        } finally {
            // updateWeather 内部限流会提前 return；无论成功/失败/被限流都要收掉 loading
            this.settleRefreshTip();
        }
    }
}

// 导出类
window.WeatherManager = WeatherManager;
