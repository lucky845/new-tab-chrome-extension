/**
 * 主应用类
 * 整合所有功能模块，提供统一的接口
 */
class NewTabApp {
    constructor() {
        // 初始化模块
        this.wallpaperManager = new WallpaperManager();
        this.searchManager = new SearchManager();
        this.quickAccessManager = new QuickAccessManager();
        this.settingsManager = new SettingsManager();
        this.weatherManager = new WeatherManager();

        // 状态
        this.isInitialized = false;
    }

    // 初始化应用
    async init() {
        try {
            console.log('正在初始化新标签页应用...');

            // 初始化各个模块
            await Promise.all([this.settingsManager.init(), this.quickAccessManager.init()]);

            // 设置壁纸管理器的API密钥
            const apiKey = this.settingsManager.getPexelsApiKey();
            if (apiKey) {
                this.wallpaperManager.setApiKey(apiKey);
            }

            // 天气配置均由 WeatherManager 自行 loadSettings() 处理，避免重复设置

            // 设置搜索引擎
            const searchEngine = this.settingsManager.getSearchEngine();
            this.searchManager.setCurrentSearchEngine(searchEngine);

            // 加载搜索历史
            await this.searchManager.loadHistory();

            // 初始化UI
            this.initUI();
            this.bindEvents();

            this.isInitialized = true;
            console.log('新标签页应用初始化完成');
        } catch (error) {
            console.error('应用初始化失败:', error);
        }
    }

    // 初始化UI
    initUI() {
        // 加载默认壁纸
        this.wallpaperManager.loadDefaultWallpaper();

        // 渲染快捷访问
        this.renderQuickAccess();

        // 渲染搜索界面
        this.renderSearchInterface();
    }

    // 渲染快捷访问
    renderQuickAccess() {
        const quickAccessGrid = document.getElementById('quick-access-grid');
        if (!quickAccessGrid) return;

        // 如果已有分页实例，直接更新数据
        if (this.quickAccessManager.pagination) {
            const sites = this.quickAccessManager.getSites();
            this.quickAccessManager.pagination.setItems(sites);
            return;
        }

        // 创建分页实例
        const pagination = new AdvancedPagination(quickAccessGrid, {
            itemsPerPage: 10, // 每页显示9个项目 + 1个添加按钮（两行，每行5个）
            enableCrossPageDrag: false,
            onPageChange: page => {
                console.log('页面切换:', page);
            },
            onItemMove: async newOrder => {
                try {
                    await this.quickAccessManager.saveSites();
                    console.log('快捷访问排序已保存');
                } catch (error) {
                    console.error('保存快捷访问排序失败:', error);
                }
            },
        });

        // 设置分页实例
        this.quickAccessManager.setPagination(pagination);

        // 渲染项目
        const sites = this.quickAccessManager.getSites();
        pagination.setItems(sites);
    }

    // 渲染搜索界面
    renderSearchInterface() {
        // 设置当前搜索引擎
        const currentEngine = this.searchManager.getCurrentSearchEngine();
        this.updateSearchEngineDisplay(currentEngine);

        // 渲染搜索引擎下拉菜单
        this.renderSearchEngineDropdown();
    }

    // 更新搜索引擎显示
    updateSearchEngineDisplay(engine) {
        const selectedEngine = document.getElementById('selected-engine');
        if (selectedEngine) {
            selectedEngine.innerHTML = `
                ${engine.icon}
                <div class="arrow-down"></div>
            `;
            selectedEngine.title = engine.name;
        }
    }

    // 渲染搜索引擎下拉菜单
    renderSearchEngineDropdown() {
        const searchEngineDropdown = document.getElementById('search-engine-dropdown');
        if (!searchEngineDropdown) return;

        searchEngineDropdown.innerHTML = '';

        this.searchManager.getSearchEngines().forEach(engine => {
            const item = document.createElement('div');
            item.className = 'search-engine-item';
            item.dataset.engine = engine.name;

            item.innerHTML = `
                ${engine.icon}
                <span>${engine.name}</span>
            `;

            item.addEventListener('click', () => {
                if (this.searchManager.setCurrentSearchEngine(engine.name)) {
                    this.settingsManager.setSearchEngine(engine.name);
                    this.updateSearchEngineDisplay(this.searchManager.getCurrentSearchEngine());
                    this.closeSearchEngineDropdown();
                }
            });

            searchEngineDropdown.appendChild(item);
        });
    }

    // 绑定事件
    bindEvents() {
        // 搜索事件
        this.bindSearchEvents();

        // 快捷访问事件
        this.bindQuickAccessEvents();

        // 设置事件
        this.bindSettingsEvents();

        // 壁纸事件
        this.bindWallpaperEvents();

        // 天气事件
        this.bindWeatherEvents();
    }

    // 绑定搜索相关事件
    bindSearchEvents() {
        const searchInput = document.getElementById('search-input');
        const searchSubmitBtn = document.getElementById('search-submit-btn');
        const searchEngineDropdown = document.getElementById('search-engine-dropdown');
        const searchEngineSelector = document.getElementById('search-engine-selector');
        const selectedEngine = document.getElementById('selected-engine');
        const clearSearchBtn = document.getElementById('clear-search-btn');
        const searchHistoryDropdown = document.getElementById('search-history-dropdown');
        const clearAllHistoryBtn = document.getElementById('clear-all-history-btn');

        // 搜索提交
        if (searchSubmitBtn) {
            searchSubmitBtn.addEventListener('click', () => {
                const query = searchInput.value.trim();
                if (query) {
                    this.searchManager.performSearch(query);
                }
            });
        }

        // 回车搜索
        if (searchInput) {
            searchInput.addEventListener('keypress', e => {
                if (e.key === 'Enter') {
                    const query = e.target.value.trim();
                    if (query) {
                        this.searchManager.performSearch(query);
                    }
                }
            });
        }

        // 点击输入框显示搜索历史
        if (searchInput) {
            searchInput.addEventListener('click', e => {
                e.stopPropagation();
                if (searchInput.value.trim() === '') {
                    this.showSearchHistory();
                }
            });
        }

        // 输入时隐藏搜索历史
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                if (!searchHistoryDropdown.classList.contains('u-hidden')) {
                    searchHistoryDropdown.classList.add('u-hidden');
                }

                if (searchInput.value.length > 0) {
                    clearSearchBtn.classList.add('visible');
                } else {
                    clearSearchBtn.classList.remove('visible');
                }
            });
        }

        // 输入框失去焦点时隐藏搜索历史
        if (searchInput) {
            searchInput.addEventListener('blur', e => {
                if (!searchHistoryDropdown.contains(e.relatedTarget)) {
                    searchHistoryDropdown.classList.add('u-hidden');
                }
            });
        }

        // 清空搜索按钮
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                searchInput.value = '';
                searchInput.focus();
                clearSearchBtn.classList.remove('visible');
            });
        }

        // 清空所有搜索历史
        if (clearAllHistoryBtn) {
            clearAllHistoryBtn.addEventListener('click', async e => {
                e.stopPropagation();
                if (window.confirm('您确定要清空所有搜索记录吗？此操作无法撤销。')) {
                    this.searchManager.clearHistory();
                    this.hideSearchHistory();
                }
            });
        }

        // 搜索引擎选择器点击事件
        if (searchEngineSelector && selectedEngine) {
            searchEngineSelector.addEventListener('click', () => {
                this.toggleSearchEngineDropdown();
            });
        }

        // 注意：搜索引擎下拉为自定义项，已在 renderSearchEngineDropdown 内通过 click 处理选择

        // 点击外部关闭下拉菜单
        document.addEventListener('click', e => {
            // 关闭搜索引擎下拉菜单
            if (!searchEngineSelector?.contains(e.target)) {
                this.closeSearchEngineDropdown();
            }

            // 关闭搜索历史下拉框
            if (!searchInput?.contains(e.target) && !searchHistoryDropdown?.contains(e.target)) {
                this.hideSearchHistory();
            }
        });
    }

    // 切换搜索引擎下拉菜单
    toggleSearchEngineDropdown() {
        const searchEngineDropdown = document.getElementById('search-engine-dropdown');
        const searchEngineSelector = document.getElementById('search-engine-selector');

        if (searchEngineDropdown && searchEngineSelector) {
            const isVisible = !searchEngineDropdown.classList.contains('u-hidden');
            if (isVisible) {
                this.closeSearchEngineDropdown();
            } else {
                this.openSearchEngineDropdown();
            }
        }
    }

    // 打开搜索引擎下拉菜单
    openSearchEngineDropdown() {
        const searchEngineDropdown = document.getElementById('search-engine-dropdown');
        const searchEngineSelector = document.getElementById('search-engine-selector');

        if (searchEngineDropdown && searchEngineSelector) {
            searchEngineDropdown.classList.remove('u-hidden');
            searchEngineSelector.classList.add('open');
        }
    }

    // 关闭搜索引擎下拉菜单
    closeSearchEngineDropdown() {
        const searchEngineDropdown = document.getElementById('search-engine-dropdown');
        const searchEngineSelector = document.getElementById('search-engine-selector');

        if (searchEngineDropdown && searchEngineSelector) {
            searchEngineDropdown.classList.add('u-hidden');
            searchEngineSelector.classList.remove('open');
        }
    }

    // 显示搜索历史
    showSearchHistory() {
        const searchHistoryDropdown = document.getElementById('search-history-dropdown');
        const historyItemsContainer = document.getElementById('history-items-container');

        if (searchHistoryDropdown && historyItemsContainer) {
            const history = this.searchManager.getSearchHistory();

            if (history.length === 0) {
                historyItemsContainer.innerHTML =
                    '<div class="history-item empty">暂无搜索记录</div>';
            } else {
                historyItemsContainer.innerHTML = '';
                history.forEach((term, index) => {
                    const item = document.createElement('div');
                    item.className = 'history-item';
                    item.innerHTML = `
                        <span class="history-text">${term}</span>
                        <button class="delete-history-btn" data-index="${index}">×</button>
                    `;

                    // 点击历史项进行搜索
                    item.querySelector('.history-text').addEventListener('click', () => {
                        const searchInput = document.getElementById('search-input');
                        if (searchInput) {
                            searchInput.value = term;
                            this.searchManager.performSearch(term);
                        }
                    });

                    // 删除单个历史项
                    item.querySelector('.delete-history-btn').addEventListener('click', e => {
                        e.stopPropagation();
                        this.searchManager.removeFromHistory(index);
                        this.showSearchHistory(); // 重新渲染
                    });

                    historyItemsContainer.appendChild(item);
                });
            }

            searchHistoryDropdown.classList.remove('u-hidden');
        }
    }

    // 隐藏搜索历史
    hideSearchHistory() {
        const searchHistoryDropdown = document.getElementById('search-history-dropdown');
        if (searchHistoryDropdown) {
            searchHistoryDropdown.classList.add('u-hidden');
        }
    }

    // 绑定快捷访问事件
    bindQuickAccessEvents() {
        // 注意：添加按钮的事件绑定现在在分页组件中处理
        // 这里不再需要手动绑定，避免重复绑定
    }

    // 绑定设置事件
    bindSettingsEvents() {
        const settingsBtn = document.getElementById(window.SELECTORS.settingsBtn);
        const settingsPanel = document.getElementById(window.SELECTORS.settingsPanel);
        const closeSettingsBtn = document.getElementById(window.SELECTORS.closeSettingsBtn);
        const weatherApiKeyInput = document.getElementById(window.SELECTORS.weatherApiKeyInput);
        const weatherCityInput = document.getElementById(window.SELECTORS.weatherCityInput);

        if (settingsBtn && settingsPanel) {
            settingsBtn.addEventListener('click', () => {
                settingsPanel.classList.remove('u-hidden');
                // 回显天气相关配置
                try {
                    if (this.settingsManager && this.settingsManager.getWeatherApiKey) {
                        const k = this.settingsManager.getWeatherApiKey();
                        if (typeof k === 'string' && weatherApiKeyInput)
                            weatherApiKeyInput.value = k;
                    }
                    if (this.settingsManager && this.settingsManager.getWeatherCity) {
                        const c = this.settingsManager.getWeatherCity();
                        if (typeof c === 'string' && weatherCityInput) weatherCityInput.value = c;
                    }
                } catch (e) {
                    console.warn('回显天气配置失败:', e);
                }
            });
        }

        if (closeSettingsBtn && settingsPanel) {
            closeSettingsBtn.addEventListener('click', () => {
                settingsPanel.classList.add('u-hidden');
            });
        }
    }

    // 绑定壁纸事件
    bindWallpaperEvents() {
        const changeWallpaperBtn = document.getElementById(window.SELECTORS.changeWallpaperBtn);
        if (changeWallpaperBtn) {
            changeWallpaperBtn.addEventListener('click', () => {
                this.showWallpaperPanel();
            });
        }
    }

    // 显示添加快捷访问模态框
    showAddQuickAccessModal() {
        const addQuickAccessPanel = document.getElementById('add-quick-access-panel');
        const qaPanelTitle = document.getElementById('qa-panel-title');
        const qaEditIndexInput = document.getElementById('qa-edit-index');
        const qaUrlInput = document.getElementById('qa-url-input');
        const qaNameInput = document.getElementById('qa-name-input');
        const qaIconInput = document.getElementById('qa-icon-input');
        const qaIconPreviewContainer = document.getElementById('qa-icon-preview-container');

        if (addQuickAccessPanel && qaPanelTitle && qaEditIndexInput) {
            // 设置为添加模式
            qaPanelTitle.textContent = '添加快捷方式';
            qaEditIndexInput.value = '-1';

            // 重置表单
            if (qaUrlInput) qaUrlInput.value = '';
            if (qaNameInput) qaNameInput.value = '';
            if (qaIconInput) qaIconInput.value = '';
            if (qaIconPreviewContainer) {
                qaIconPreviewContainer.classList.add('u-hidden');
                const qaIconPreview = document.getElementById('qa-icon-preview');
                if (qaIconPreview) qaIconPreview.innerHTML = '';
            }

            // 显示弹窗
            addQuickAccessPanel.classList.remove('u-hidden');
        }
    }

    // 显示壁纸面板
    showWallpaperPanel() {
        const wallpaperPanel = document.getElementById('wallpaper-panel');
        if (wallpaperPanel) {
            wallpaperPanel.classList.remove('u-hidden');
        }
    }

    // 绑定天气事件
    bindWeatherEvents() {
        const weatherSettingsBtn = document.getElementById(window.SELECTORS.weatherSettingsBtn);
        const weatherSettingsPanel = document.getElementById(window.SELECTORS.weatherSettingsPanel);
        const closeWeatherSettingsBtn = document.getElementById(
            window.SELECTORS.closeWeatherSettingsBtn
        );
        const saveWeatherSettingsBtn = document.getElementById(
            window.SELECTORS.saveWeatherSettingsBtn
        );
        const weatherCityInput = document.getElementById(window.SELECTORS.weatherCityInput);
        const weatherCityInputPanel = document.getElementById(
            window.SELECTORS.weatherCityInputPanel
        );
        const weatherUnitSelect = document.getElementById(window.SELECTORS.weatherUnitSelect);

        // 天气设置按钮
        if (weatherSettingsBtn && weatherSettingsPanel) {
            weatherSettingsBtn.addEventListener('click', () => {
                weatherSettingsPanel.classList.remove('u-hidden');
                // 加载当前设置
                if (weatherCityInputPanel) {
                    weatherCityInputPanel.value = this.weatherManager.currentCity || '';
                }
                if (weatherUnitSelect) {
                    weatherUnitSelect.value = this.weatherManager.temperatureUnit;
                }
            });
        }

        // 关闭天气设置面板
        if (closeWeatherSettingsBtn && weatherSettingsPanel) {
            closeWeatherSettingsBtn.addEventListener('click', () => {
                weatherSettingsPanel.classList.add('u-hidden');
            });
        }

        // 保存天气设置
        if (saveWeatherSettingsBtn) {
            saveWeatherSettingsBtn.addEventListener('click', async () => {
                try {
                    if (weatherCityInputPanel) {
                        const city = weatherCityInputPanel.value.trim();
                        if (city) {
                            await this.weatherManager.setCity(city);
                        } else {
                            await this.weatherManager.useCurrentLocation();
                        }
                    }

                    if (weatherUnitSelect) {
                        await this.weatherManager.setTemperatureUnit(weatherUnitSelect.value);
                    }

                    weatherSettingsPanel.classList.add('u-hidden');
                    console.log('天气设置已保存');
                } catch (error) {
                    console.error('保存天气设置失败:', error);
                }
            });
        }

        // 去除设置面板内的刷新/定位按钮逻辑，统一在保存时更新
    }

    // 获取应用状态
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            wallpaperManager: this.wallpaperManager.getCurrentState(),
            searchManager: this.searchManager.getCurrentSearchEngine(),
            quickAccessManager: this.quickAccessManager.getSites().length,
            settingsManager: this.settingsManager.getAllSettings(),
            weatherManager: this.weatherManager.getCurrentWeather(),
        };
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NewTabApp;
} else {
    window.NewTabApp = NewTabApp;
}
