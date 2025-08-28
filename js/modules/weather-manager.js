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

            // 绑定天气组件点击事件
            this.bindWeatherWidgetEvents();

            // 获取天气信息
            await this.updateWeather();

            // 设置定时更新
            const updateInterval = window.WEATHER_CONFIG?.UPDATE_INTERVAL || 30 * 60 * 1000;
            setInterval(() => {
                this.updateWeather();
            }, updateInterval);
        } catch (error) {
            console.error('天气管理器初始化失败:', error);
            this.showError('天气服务初始化失败');
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
     * 显示刷新提示
     */
    showRefreshHint() {
        const weatherWidget = document.getElementById('weather-widget');
        if (!weatherWidget) return;

        // 移除现有提示
        const existingHint = weatherWidget.querySelector('.refresh-hint');
        if (existingHint) {
            existingHint.remove();
        }

        // 创建刷新提示
        const hint = document.createElement('div');
        hint.className = 'refresh-hint';
        hint.innerHTML = `
            <div class="hint-content">
                <span class="hint-icon">🔄</span>
                <span class="hint-text">正在刷新天气...</span>
            </div>
        `;

        weatherWidget.appendChild(hint);

        // 2秒后自动隐藏
        setTimeout(() => {
            if (hint.parentElement) {
                hint.remove();
            }
        }, 2000);
    }

    /**
     * 加载天气设置
     */
    async loadSettings() {
        try {
            const result = await chrome.storage.local.get(['settings']);
            const s = (result && result.settings) || {};
            this.currentCity = s.weatherCity || '';
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
     */
    async updateWeather() {
        if (this.isLoading) return;
        // 限流：避免过于频繁
        const now = Date.now();
        const minInterval = window.WEATHER_CONFIG?.MIN_REQUEST_INTERVAL || 10000;
        if (this._lastRequestAt && now - this._lastRequestAt < minInterval) {
            return;
        }
        this._lastRequestAt = now;

        this.isLoading = true;
        this.showLoading();

        try {
            if (!this.apiKey) {
                this.showError('未配置天气API密钥');
                this.isLoading = false;
                return;
            }
            let weatherData;

            if (this.currentCity) {
                // 使用指定城市 => 先换为adcode（带缓存）
                const adcode = await this.getAdcodeByCity(this.currentCity);
                weatherData = await this.getWeatherByAdcode(adcode);
            } else {
                // 使用当前位置，带重试机制
                weatherData = await this.getWeatherByLocationWithRetry();
            }

            if (weatherData) {
                this.weatherData = weatherData;
                this.displayWeather(weatherData);
            }
        } catch (error) {
            console.error('获取天气信息失败:', error);
            this.showError('获取天气信息失败');
        } finally {
            this.isLoading = false;
        }
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
            retries: 2,
            retryDelay: 600,
            backoff: 2,
        });
        if (data.status !== '1' || !data.geocodes || data.geocodes.length === 0) {
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
            return cached[cacheKey].data;
        }
        const url = `${this.baseUrl}/weather/weatherInfo?key=${this.apiKey}&city=${adcode}&extensions=base`;
        const { fetchJSON } = await import('../utils/request.js');
        const data = await fetchJSON(url, {
            timeout: window.WEATHER_CONFIG?.GEOLOCATION_TIMEOUT || 10000,
            retries: 2,
            retryDelay: 600,
            backoff: 2,
        });
        if (data.status !== '1' || !data.lives || data.lives.length === 0) {
            throw new Error('高德天气返回空数据');
        }
        const formatted = this.formatAmapWeatherData(data.lives[0]);
        await chrome.storage.local.set({ [cacheKey]: { data: formatted, ts: Date.now() } });
        return formatted;
    }

    /**
     * 带重试机制的位置天气获取
     */
    async getWeatherByLocationWithRetry(maxRetries = 2) {
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
                retries: 2,
                retryDelay: 600,
                backoff: 2,
            });
            const adcode = regeoData?.regeocode?.addressComponent?.adcode;
            const cityCode = adcode || regeoData?.regeocode?.addressComponent?.citycode;
            if (!adcode && !cityCode) {
                throw new Error('逆地理失败，未获取到adcode');
            }

            // 缓存城市信息
            const cacheKey = `amap_adcode_${adcode}`;
            await chrome.storage.local.set({ [cacheKey]: { adcode: regeoData?.regeocode?.addressComponent?.city || undefined, ts: Date.now() } });

            // 天气
            return await this.getWeatherByAdcode(adcode || cityCode);
        } catch (error) {
            console.warn('基于浏览器定位失败，尝试使用IP定位作为回退...', error?.message || error);
            // 回退：使用IP定位获取adcode
            try {
                const adcode = await this.getAdcodeByIP();
                return await this.getWeatherByAdcode(adcode);
            } catch (ipErr) {
                console.error('IP 定位回退也失败:', ipErr);
                throw error; // 抛出原始错误，便于上层判断权限/超时
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
        const ipAdcode = data?.adcode || data?.citycode;
        if (!ipAdcode) throw new Error('IP定位未返回adcode');

        // 缓存城市信息
        const cacheKey = `amap_adcode_${ipAdcode}`;
        await chrome.storage.local.set({ [cacheKey]: { adcode: data?.city || undefined, ts: Date.now() } });

        return ipAdcode;
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

            const mapGeoError = (error) => {
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

        // 显示位置
        locationEl.textContent = `${weatherData.city}, ${weatherData.country}`;

        // 选择合适的图标（适配高德天气描述）
        const iconType = this.getIconTypeForAmap(weatherData.description);
        this.updateWeatherIcon(weatherSvgEl, iconType);

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
        if (weatherDescEl) weatherDescEl.textContent = message;
        if (locationEl) locationEl.textContent = '获取失败';

        // 根据错误类型显示不同提示
        if (message.includes('权限') || message.includes('Permission')) {
            this.showPermissionHint();
        } else if (message.includes('超时') || message.includes('timeout')) {
            this.showTimeoutHint();
        }

        this.hideLoading();
    }

    /**
     * 显示权限提示
     */
    showPermissionHint() {
        const weatherWidget = document.getElementById('weather-widget');
        if (!weatherWidget) return;

        // 移除现有的权限提示
        const existingHint = weatherWidget.querySelector('.permission-hint');
        if (existingHint) {
            existingHint.remove();
        }

        // 创建权限提示
        const hint = document.createElement('div');
        hint.className = 'permission-hint';
        hint.innerHTML = `
            <div class="hint-content">
                <span class="hint-icon">🔒</span>
                <span class="hint-text">需要位置权限</span>
                <button class="hint-action" title="重试授权" onclick="window.app && window.app.weatherManager && window.app.weatherManager.requestLocationPrompt && window.app.weatherManager.requestLocationPrompt()">🔄</button>
                <button class="hint-action" title="打开定位设置" onclick="window.open('chrome://settings/content/location','_blank')">⚙️</button>
                <button class="hint-action" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;

        weatherWidget.appendChild(hint);

        // 3秒后自动隐藏
        setTimeout(() => {
            if (hint.parentElement) {
                hint.remove();
            }
        }, 3000);
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
        const weatherWidget = document.getElementById('weather-widget');
        if (!weatherWidget) return;

        // 移除现有的提示
        const existingHint = weatherWidget.querySelector('.timeout-hint');
        if (existingHint) {
            existingHint.remove();
        }

        // 创建超时提示
        const hint = document.createElement('div');
        hint.className = 'timeout-hint';
        hint.innerHTML = `
            <div class="hint-content">
                <span class="hint-icon">⏱️</span>
                <span class="hint-text">位置获取超时，点击重试</span>
                <button class="hint-action" onclick="window.app.weatherManager.refresh()">🔄</button>
                <button class="hint-action" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;

        weatherWidget.appendChild(hint);

        // 5秒后自动隐藏
        setTimeout(() => {
            if (hint.parentElement) {
                hint.remove();
            }
        }, 5000);
    }

    /**
     * 设置城市
     */
    async setCity(cityName) {
        this.currentCity = cityName;
        await this.saveSettings();
        await this.updateWeather();
    }

    /**
     * 使用当前位置
     */
    async useCurrentLocation() {
        this.currentCity = '';
        await this.saveSettings();
        await this.updateWeather();
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
        await this.updateWeather();
    }
}

// 导出类
window.WeatherManager = WeatherManager;
