/**
 * 主应用类（组合根 + 唯一 UI 绑定归属）
 * - 业务数据层在 js/modules/*-manager.js
 * - 本类负责：模块编排、DOM 事件绑定、面板渲染
 * - main.js 仅作为 bootstrap 入口
 */
class NewTabApp {
    constructor() {
        // 初始化模块
        this.wallpaperManager = new WallpaperManager();
        this.searchManager = new SearchManager();
        this.quickAccessManager = new QuickAccessManager();
        this.settingsManager = new SettingsManager();
        this.weatherManager = new WeatherManager();
        this.todoManager = new TodoManager();
        this.notesManager = new NotesManager();
        this.pomodoroManager = new PomodoroManager();

        // 小工具（纯前端，无需 manager）
        this.quickTools = window.QUICK_TOOLS || [];
        this.activeToolId = null;

        // UI 状态（纯渲染层）
        this.activeCategoryElement = null;
        this.lastActiveCategoryQuery = 'Nature';
        this.todoImportantActive = false;
        this.clockTimerId = null;
        this.searchIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
        this.clearIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

        // 状态
        this.isInitialized = false;
    }

    // 初始化应用
    async init() {
        try {
            console.log('正在初始化新标签页应用...');

            // 初始化各个模块（settings.init 内含旧键迁移）
            await Promise.all([
                this.settingsManager.init(),
                this.quickAccessManager.init(),
                this.todoManager.init(),
                this.notesManager.init(),
                this.pomodoroManager.init(),
            ]);

            // 设置壁纸管理器的API密钥
            const apiKey = this.settingsManager.getPexelsApiKey();
            this.wallpaperManager.setApiKey(apiKey);
            this.wallpaperManager.onAuthError = () => this.openSettingsPanel();

            // 设置搜索引擎
            const searchEngine = this.settingsManager.getSearchEngine();
            this.searchManager.setCurrentSearchEngine(searchEngine);

            // 加载自定义搜索引擎并注入搜索管理器
            await this.settingsManager.loadCustomEngines();
            this.searchManager.setCustomEngines(this.settingsManager.getCustomEngines());

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
        // 加载壁纸（缓存优先 → Picsum/Pexels 随机，全链路在 manager 内）
        this.wallpaperManager.fetchAndSetWallpaper();

        // 渲染快捷访问
        this.renderQuickAccess();

        // 渲染搜索界面
        this.renderSearchInterface();

        // 渲染壁纸分类侧栏
        this.renderWallpaperCategories();

        // 时钟 / 问候 / 标语
        this.startClock();

        // 主页右侧常驻小组件（可开关）
        this.initSideWidgets();

        // 右翼小工具宫格
        this.renderToolsCard();

        // 壁纸亮度 / 模糊
        this.applyWallpaperAdjustments();

        // 密钥可见性切换
        this.initVisibilityToggle();
    }

    // 主页右侧常驻小组件：可见性 + 首次渲染
    initSideWidgets() {
        this.applySideWidgetsVisibility();
        this.renderTodoCard();
        this.renderNotesCard();
        this.renderPomodoroCard();
    }

    // 依据设置显隐主页小组件（左右两翼）
    applySideWidgetsVisibility() {
        const hidden = this.settingsManager.settings.showSideWidgets === false;
        [window.SELECTORS.sideWidgets, window.SELECTORS.sideWidgetsRight].forEach(id => {
            const aside = document.getElementById(id);
            if (aside) aside.classList.toggle('u-hidden', hidden);
        });
    }

    // 应用壁纸亮度与模糊（filter 叠加在壁纸层，不影响前景可读性之外的元素）
    applyWallpaperAdjustments() {
        const container = document.getElementById(window.SELECTORS.wallpaperContainer);
        if (!container) return;
        const { brightness, blur } = this.settingsManager.getWallpaperAdjustments();
        const filters = [];
        if (brightness !== 1) filters.push(`brightness(${brightness})`);
        if (blur > 0) filters.push(`blur(${blur}px)`);
        container.style.filter = filters.join(' ');
        // 模糊时轻微放大，避免边缘透明
        container.style.transform = blur > 0 ? 'scale(1.04)' : '';
    }

    // ---------- 搜索域 ----------

    // 渲染搜索界面
    renderSearchInterface() {
        // 设置当前搜索引擎
        const currentEngine = this.searchManager.getCurrentSearchEngine();
        this.updateSearchEngineDisplay(currentEngine);

        // 渲染搜索引擎下拉菜单
        this.renderSearchEngineDropdown();

        // 注入图标
        const searchSubmitBtn = document.getElementById(window.SELECTORS.searchSubmitBtn);
        const clearSearchBtn = document.getElementById(window.SELECTORS.clearSearchBtn);
        if (searchSubmitBtn) searchSubmitBtn.innerHTML = this.searchIcon;
        if (clearSearchBtn) clearSearchBtn.innerHTML = this.clearIcon;
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

    // 绑定搜索相关事件
    bindSearchEvents() {
        const searchInput = document.getElementById('search-input');
        const searchSubmitBtn = document.getElementById('search-submit-btn');
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

    // ---------- 壁纸域 ----------

    // 绑定壁纸事件
    bindWallpaperEvents() {
        const changeWallpaperBtn = document.getElementById(window.SELECTORS.changeWallpaperBtn);
        const wallpaperSettingsBtn = document.getElementById(window.SELECTORS.wallpaperSettingsBtn);
        const wallpaperPanel = document.getElementById(window.SELECTORS.wallpaperPanel);
        const wallpaperSearchInput = document.getElementById(window.SELECTORS.wallpaperSearchInput);
        const wallpaperSearchBtn = document.getElementById(window.SELECTORS.wallpaperSearchBtn);
        const jumpToPageInput = document.getElementById(window.SELECTORS.jumpToPageInput);
        const closeWallpaperPanelBtn = document.getElementById(
            window.SELECTORS.closeWallpaperPanelBtn
        );

        // "换一张"：manager 内部自动选源（有 Key 走 Pexels 随机；无 Key 走 Picsum 随机，免密钥）
        if (changeWallpaperBtn) {
            changeWallpaperBtn.addEventListener('click', async () => {
                await this.wallpaperManager.fetchRandomWallpaper(true);
            });
        }

        // 壁纸面板开关
        if (wallpaperSettingsBtn) {
            wallpaperSettingsBtn.addEventListener('click', () => this.openWallpaperPanel());
        }
        if (closeWallpaperPanelBtn && wallpaperPanel) {
            closeWallpaperPanelBtn.addEventListener('click', () => this.closeWallpaperPanel());
        }

        // 壁纸搜索
        if (wallpaperSearchBtn && wallpaperSearchInput) {
            wallpaperSearchBtn.addEventListener('click', () => {
                const query = wallpaperSearchInput.value.trim();
                this.searchWallpapers(query || this.lastActiveCategoryQuery, 1);
            });
        }
        if (wallpaperSearchInput) {
            wallpaperSearchInput.addEventListener('keypress', e => {
                if (e.key === 'Enter') {
                    const query = wallpaperSearchInput.value.trim();
                    this.searchWallpapers(query || this.lastActiveCategoryQuery, 1);
                }
            });
        }

        // 跳转页码
        if (jumpToPageInput) {
            jumpToPageInput.addEventListener('keypress', e => {
                if (e.key === 'Enter') {
                    const page = parseInt(jumpToPageInput.value, 10);
                    if (page >= 1 && page <= this.wallpaperManager.totalPages) {
                        this.searchWallpapers(this.wallpaperManager.currentQuery, page, {
                            skipCategoryHighlight: true,
                        });
                        jumpToPageInput.value = '';
                        jumpToPageInput.blur();
                    } else {
                        window.showToast(
                            `请输入 1 到 ${this.wallpaperManager.totalPages} 之间的页码。`
                        );
                    }
                }
            });
        }
    }

    // 打开壁纸面板
    openWallpaperPanel() {
        const wallpaperPanel = document.getElementById(window.SELECTORS.wallpaperPanel);
        const wallpaperGrid = document.getElementById(window.SELECTORS.wallpaperGrid);
        if (!wallpaperPanel) return;
        wallpaperPanel.classList.remove('u-hidden');
        if (wallpaperGrid && wallpaperGrid.childElementCount === 0) {
            this.searchWallpapers('Nature', 1);
        }
    }

    // 关闭壁纸面板
    closeWallpaperPanel() {
        const wallpaperPanel = document.getElementById(window.SELECTORS.wallpaperPanel);
        const wallpaperSearchInput = document.getElementById(window.SELECTORS.wallpaperSearchInput);
        if (wallpaperPanel) wallpaperPanel.classList.add('u-hidden');
        if (wallpaperSearchInput) wallpaperSearchInput.value = '';

        // 如果当前查询不是一个预设分类，则恢复到上次的分类
        const currentQueryIsACategory = this.wallpaperManager
            .getCategories()
            .some(c => c.query === this.wallpaperManager.currentQuery);
        if (!currentQueryIsACategory) {
            this.searchWallpapers(this.lastActiveCategoryQuery, 1);
        }
    }

    // 壁纸搜索（UI 编排：高亮分类 → loading → manager 数据层 → 渲染）
    async searchWallpapers(query, page, { skipCategoryHighlight = false } = {}) {
        const wm = this.wallpaperManager;

        // 无 Pexels Key 时 manager 自动切换 Picsum 免 Key 图库，UI 流程完全一致

        // 更新UI中的高亮分类
        if (!skipCategoryHighlight) {
            const wallpaperCategoriesSidebar = document.getElementById(
                window.SELECTORS.wallpaperCategoriesSidebar
            );
            if (this.activeCategoryElement) {
                this.activeCategoryElement.classList.remove('active');
            }
            const newActiveCategory = wallpaperCategoriesSidebar
                ? wallpaperCategoriesSidebar.querySelector(`[data-category="${query}"]`)
                : null;
            if (newActiveCategory) {
                newActiveCategory.classList.add('active');
                this.activeCategoryElement = newActiveCategory;
                this.lastActiveCategoryQuery = query;
            } else {
                this.activeCategoryElement = null;
            }
        }

        // 显示加载状态
        const wallpaperLoading = document.getElementById(window.SELECTORS.wallpaperLoading);
        const wallpaperGrid = document.getElementById(window.SELECTORS.wallpaperGrid);
        if (wallpaperLoading) wallpaperLoading.classList.remove('u-hidden');
        if (wallpaperGrid) wallpaperGrid.innerHTML = '';

        const result = await wm.searchPhotos(query, page);
        if (wallpaperLoading) wallpaperLoading.classList.add('u-hidden');

        if (result.photos === null) {
            if (wallpaperGrid) {
                wallpaperGrid.innerHTML =
                    '<div class="wallpaper-empty-hint">图库加载失败，请检查网络连接后重试。<br>若使用代理，请确认代理节点可用。</div>';
            }
            window.showToast(result.error || '壁纸加载失败，请检查网络', 'error', 4000);
            return;
        }

        this.renderWallpaperGrid(result.photos);
        this.updatePagination();
    }

    // 渲染壁纸网格
    renderWallpaperGrid(photos) {
        const wallpaperGrid = document.getElementById(window.SELECTORS.wallpaperGrid);
        if (wallpaperGrid) wallpaperGrid.innerHTML = '';
        photos.forEach(photo => {
            const img = document.createElement('img');
            img.src = photo.src.medium;
            img.alt = photo.alt;
            img.addEventListener('click', async () => {
                // manager 统一入口：设置背景 + 写缓存
                await this.wallpaperManager.applyPexelsWallpaper(photo, true);
                console.log(`已保存并缓存壁纸 (ID: ${photo.id})`);
                this.closeWallpaperPanel();
            });
            if (wallpaperGrid) wallpaperGrid.appendChild(img);
        });
    }

    // 渲染壁纸分页控件
    updatePagination() {
        const wm = this.wallpaperManager;
        const paginationButtons = document.getElementById(window.SELECTORS.paginationButtons);
        const totalResultsInfo = document.getElementById(window.SELECTORS.totalResultsInfo);
        const jumpToPageInput = document.getElementById(window.SELECTORS.jumpToPageInput);
        if (!paginationButtons) return;

        paginationButtons.innerHTML = '';

        // 辅助函数：创建按钮
        const createButton = (
            text,
            page,
            isDisabled = false,
            isActive = false,
            isEllipsis = false
        ) => {
            if (isEllipsis) {
                const span = document.createElement('span');
                span.textContent = '...';
                return span;
            }

            const button = document.createElement('button');
            button.innerHTML = text;
            button.disabled = isDisabled;
            if (isActive) {
                button.classList.add('active');
            }
            return button;
        };

        const goToPage = page => {
            this.searchWallpapers(wm.currentQuery, page, { skipCategoryHighlight: true });
        };

        // 上一页按钮
        const prevButton = createButton('上一页', wm.currentPage - 1, wm.currentPage === 1);
        if (prevButton && !prevButton.disabled) {
            prevButton.addEventListener('click', () => goToPage(wm.currentPage - 1));
        }
        paginationButtons.appendChild(prevButton);

        // 页码按钮逻辑
        const pagesToShow = this.getPaginationRange(wm.currentPage, wm.totalPages);
        pagesToShow.forEach(page => {
            if (page === '...') {
                paginationButtons.appendChild(createButton('', null, false, false, true));
            } else {
                const pageButton = createButton(page, page, false, page === wm.currentPage);
                if (pageButton && page !== '...') {
                    pageButton.addEventListener('click', () => goToPage(page));
                }
                paginationButtons.appendChild(pageButton);
            }
        });

        // 下一页按钮
        const nextButton = createButton(
            '下一页',
            wm.currentPage + 1,
            wm.currentPage >= wm.totalPages
        );
        if (nextButton && !nextButton.disabled) {
            nextButton.addEventListener('click', () => goToPage(wm.currentPage + 1));
        }
        paginationButtons.appendChild(nextButton);

        // 更新信息
        if (totalResultsInfo) {
            const maxResults = wm.totalPages * window.WallpaperManager.WALLPAPERS_PER_PAGE;
            totalResultsInfo.textContent = `共 ${wm.totalPages} 页 / ${wm.totalWallpapers > maxResults ? `~${maxResults}` : wm.totalWallpapers} 个`;
        }
        if (jumpToPageInput) {
            jumpToPageInput.max = wm.totalPages;
        }
    }

    // 分页范围计算
    getPaginationRange(current, total) {
        const delta = 2;
        const range = [];
        for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
            range.push(i);
        }

        if (current - delta > 2) {
            range.unshift('...');
        }
        if (current + delta < total - 1) {
            range.push('...');
        }

        range.unshift(1);
        if (total > 1) {
            range.push(total);
        }

        return [...new Set(range)];
    }

    // 渲染壁纸分类侧栏
    renderWallpaperCategories() {
        const wallpaperCategoriesSidebar = document.getElementById(
            window.SELECTORS.wallpaperCategoriesSidebar
        );
        const wallpaperSearchInput = document.getElementById(window.SELECTORS.wallpaperSearchInput);
        if (!wallpaperCategoriesSidebar) return;

        const title = document.createElement('h4');
        title.textContent = '推荐分类';
        const categoryList = document.createElement('ul');

        this.wallpaperManager.getCategories().forEach(category => {
            const categoryItem = document.createElement('li');
            categoryItem.textContent = category.name;
            categoryItem.dataset.category = category.query;

            categoryItem.addEventListener('click', () => {
                if (wallpaperSearchInput) wallpaperSearchInput.value = ''; // 清空搜索框
                this.searchWallpapers(category.query, 1);
            });
            categoryList.appendChild(categoryItem);
        });

        wallpaperCategoriesSidebar.innerHTML = ''; // 清空现有内容
        wallpaperCategoriesSidebar.appendChild(title);
        wallpaperCategoriesSidebar.appendChild(categoryList);
    }

    // 密钥可见性切换（动态加载通用模块）
    initVisibilityToggle() {
        const apiKeyInput = document.getElementById(window.SELECTORS.pexelsApiKeyInput);
        const toggleVisibilityBtn = document.getElementById(window.SELECTORS.pexelsToggleBtn);
        const weatherApiKeyInput = document.getElementById(window.SELECTORS.weatherApiKeyInput);

        // 相对路径以 app.js 自身目录（js/）为基准解析
        import('./components/visibility-toggle.js')
            .then(({ initVisibilityToggle }) => {
                initVisibilityToggle(apiKeyInput, toggleVisibilityBtn, {});
                const toggleWeatherBtn = document.getElementById(window.SELECTORS.weatherToggleBtn);
                if (toggleWeatherBtn && weatherApiKeyInput) {
                    initVisibilityToggle(weatherApiKeyInput, toggleWeatherBtn, {});
                }
            })
            .catch(error => {
                // 回退：不影响其他功能，但留痕便于排查
                console.warn(
                    '[app] visibility-toggle 加载失败（密钥可见性切换不可用）:',
                    error?.message || error
                );
            });
    }

    // ---------- 快捷访问域 ----------

    // 绑定快捷访问事件
    bindQuickAccessEvents() {
        const quickAccessGrid = document.getElementById(window.SELECTORS.quickAccessGrid);
        const addQuickAccessPanel = document.getElementById(window.SELECTORS.addQuickAccessPanel);
        const saveQaBtn = document.getElementById(window.SELECTORS.saveQaBtn);
        const cancelQaBtn = document.getElementById(window.SELECTORS.cancelQaBtn);
        const qaUrlInput = document.getElementById(window.SELECTORS.qaUrlInput);
        const qaNameInput = document.getElementById(window.SELECTORS.qaNameInput);
        const qaIconInput = document.getElementById(window.SELECTORS.qaIconInput);

        // 卡片点击：仅处理"添加"按钮（编辑/删除由右键菜单承担）
        if (quickAccessGrid) {
            quickAccessGrid.addEventListener('click', e => {
                if (e.target.closest('.add-quick-access-btn')) {
                    this.openAddQuickAccessModal();
                }
            });

            // 右键菜单：编辑 / 删除
            quickAccessGrid.addEventListener('contextmenu', e => {
                const item = e.target.closest('.quick-access-item');
                if (item && !item.classList.contains('add-quick-access-btn')) {
                    this.showContextMenu(e, item);
                }
            });
        }

        // 模态框关闭
        if (cancelQaBtn && addQuickAccessPanel) {
            cancelQaBtn.addEventListener('click', () => {
                addQuickAccessPanel.classList.add('u-hidden');
            });
        }
        if (addQuickAccessPanel) {
            addQuickAccessPanel.addEventListener('click', e => {
                if (e.target === addQuickAccessPanel) {
                    addQuickAccessPanel.classList.add('u-hidden');
                }
            });
        }

        // 表单校验与图标预览
        if (qaUrlInput) {
            qaUrlInput.addEventListener('input', () => this.validateQuickAccessForm());
        }
        if (qaNameInput) {
            qaNameInput.addEventListener('input', () => this.validateQuickAccessForm());
        }
        if (qaIconInput) {
            qaIconInput.addEventListener('input', () => this.renderQaIconPreview());
        }

        // 保存
        if (saveQaBtn) {
            saveQaBtn.addEventListener('click', () => this.saveQuickAccess());
        }
    }

    // 显示添加快捷访问模态框（重置表单为"添加"模式）
    openAddQuickAccessModal() {
        const addQuickAccessPanel = document.getElementById(window.SELECTORS.addQuickAccessPanel);
        const qaPanelTitle = document.getElementById(window.SELECTORS.qaPanelTitle);
        const qaEditIndexInput = document.getElementById(window.SELECTORS.qaEditIndexInput);
        const qaUrlInput = document.getElementById(window.SELECTORS.qaUrlInput);
        const qaNameInput = document.getElementById(window.SELECTORS.qaNameInput);
        const qaIconInput = document.getElementById(window.SELECTORS.qaIconInput);
        const qaUrlError = document.getElementById(window.SELECTORS.qaUrlError);
        const qaNameError = document.getElementById(window.SELECTORS.qaNameError);
        const qaIconPreviewContainer = document.getElementById(
            window.SELECTORS.qaIconPreviewContainer
        );
        const qaIconPreview = document.getElementById(window.SELECTORS.qaIconPreview);

        if (!addQuickAccessPanel || !qaPanelTitle || !qaEditIndexInput) return;

        qaPanelTitle.textContent = '添加快捷方式';
        qaEditIndexInput.value = '-1';

        // Reset form for new entry
        if (qaUrlInput) qaUrlInput.value = '';
        if (qaNameInput) qaNameInput.value = '';
        if (qaIconInput) qaIconInput.value = '';
        if (qaIconPreviewContainer) qaIconPreviewContainer.classList.add('u-hidden');
        if (qaIconPreview) qaIconPreview.innerHTML = '';
        if (qaUrlInput) qaUrlInput.classList.remove('invalid');
        if (qaNameInput) qaNameInput.classList.remove('invalid');
        if (qaUrlError) qaUrlError.classList.add('u-hidden');
        if (qaNameError) qaNameError.classList.add('u-hidden');
        this.validateQuickAccessForm();

        addQuickAccessPanel.classList.remove('u-hidden');
    }

    // 显示编辑快捷访问模态框
    async openEditQuickAccessModal(index) {
        const site = this.quickAccessManager.getSites()[index];
        if (!site) return;

        const qaPanelTitle = document.getElementById(window.SELECTORS.qaPanelTitle);
        const qaEditIndexInput = document.getElementById(window.SELECTORS.qaEditIndexInput);
        const qaUrlInput = document.getElementById(window.SELECTORS.qaUrlInput);
        const qaNameInput = document.getElementById(window.SELECTORS.qaNameInput);
        const qaIconInput = document.getElementById(window.SELECTORS.qaIconInput);
        const addQuickAccessPanel = document.getElementById(window.SELECTORS.addQuickAccessPanel);

        if (qaPanelTitle) qaPanelTitle.textContent = '编辑快捷方式';
        if (qaEditIndexInput) qaEditIndexInput.value = index;
        if (qaUrlInput) qaUrlInput.value = site.url;
        if (qaNameInput) qaNameInput.value = site.name;
        if (qaIconInput) qaIconInput.value = site.icon || '';

        if (qaIconInput) qaIconInput.dispatchEvent(new Event('input'));
        this.validateQuickAccessForm();
        if (addQuickAccessPanel) addQuickAccessPanel.classList.remove('u-hidden');
    }

    // 表单校验（UI 层）
    validateQuickAccessForm() {
        const qaUrlInput = document.getElementById(window.SELECTORS.qaUrlInput);
        const qaNameInput = document.getElementById(window.SELECTORS.qaNameInput);
        const qaUrlError = document.getElementById(window.SELECTORS.qaUrlError);
        const qaNameError = document.getElementById(window.SELECTORS.qaNameError);
        const saveQaBtn = document.getElementById(window.SELECTORS.saveQaBtn);
        if (!qaUrlInput || !qaNameInput) return;

        const url = qaUrlInput.value.trim();
        const name = qaNameInput.value.trim();
        const urlCheck = this.quickAccessManager.validateUrl(url);
        const nameCheck = this.quickAccessManager.validateName(name);

        // URL Validation
        if (url.length === 0) {
            qaUrlInput.classList.remove('invalid');
            qaUrlError.classList.add('u-hidden');
        } else if (urlCheck.valid) {
            qaUrlInput.classList.remove('invalid');
            qaUrlError.classList.add('u-hidden');
        } else {
            qaUrlInput.classList.add('invalid');
            qaUrlError.textContent = urlCheck.message;
            qaUrlError.classList.remove('u-hidden');
        }

        // Name Validation
        if (name.length === 0) {
            qaNameInput.classList.remove('invalid');
            qaNameError.classList.add('u-hidden');
        } else if (nameCheck.valid) {
            qaNameInput.classList.remove('invalid');
            qaNameError.classList.add('u-hidden');
        } else {
            qaNameInput.classList.add('invalid');
            qaNameError.textContent = nameCheck.message;
            qaNameError.classList.remove('u-hidden');
        }

        if (saveQaBtn) {
            saveQaBtn.disabled = !(urlCheck.valid && nameCheck.valid);
        }
    }

    // 图标预览
    renderQaIconPreview() {
        const qaIconInput = document.getElementById(window.SELECTORS.qaIconInput);
        const qaIconPreview = document.getElementById(window.SELECTORS.qaIconPreview);
        const qaIconPreviewContainer = document.getElementById(
            window.SELECTORS.qaIconPreviewContainer
        );
        if (!qaIconInput || !qaIconPreview || !qaIconPreviewContainer) return;

        const input = qaIconInput.value.trim();
        if (input.startsWith('<svg')) {
            qaIconPreview.innerHTML = input;
            qaIconPreviewContainer.classList.remove('u-hidden');
        } else if (input.match(/\.(jpeg|jpg|gif|png|svg)$/) || input.startsWith('http')) {
            qaIconPreview.innerHTML = `<img src="${input}" alt="Icon Preview">`;
            qaIconPreviewContainer.classList.remove('u-hidden');
        } else {
            qaIconPreviewContainer.classList.add('u-hidden');
            qaIconPreview.innerHTML = '';
        }
    }

    // 保存快捷访问（新增/编辑统一走 manager）
    async saveQuickAccess() {
        const qaUrlInput = document.getElementById(window.SELECTORS.qaUrlInput);
        const qaNameInput = document.getElementById(window.SELECTORS.qaNameInput);
        const qaIconInput = document.getElementById(window.SELECTORS.qaIconInput);
        const qaEditIndexInput = document.getElementById(window.SELECTORS.qaEditIndexInput);
        const addQuickAccessPanel = document.getElementById(window.SELECTORS.addQuickAccessPanel);
        if (!qaUrlInput || !qaNameInput || !qaEditIndexInput) return;

        let url = qaUrlInput.value.trim();
        const name = qaNameInput.value.trim();
        const icon = qaIconInput.value.trim() || null;
        const editIndex = parseInt(qaEditIndexInput.value, 10);

        if (!/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
        }

        if (editIndex > -1) {
            await this.quickAccessManager.editSite(editIndex, name, url, icon);
        } else {
            await this.quickAccessManager.addSite(name, url, icon);
        }

        // 重新渲染快捷访问列表
        this.quickAccessManager.renderQuickAccess();
        if (addQuickAccessPanel) addQuickAccessPanel.classList.add('u-hidden');
    }

    // 右键菜单（编辑 / 删除）
    showContextMenu(e, item) {
        e.preventDefault();

        // 移除现有的右键菜单
        const existingMenu = document.querySelector('.context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }

        // 创建右键菜单
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.cssText = `
            position: fixed;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            padding: 8px 0;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            min-width: 120px;
            font-size: 14px;
            color: #000000;
        `;

        const index = parseInt(item.dataset.index, 10);
        const siteName = item.querySelector('.name').textContent;

        // 编辑选项
        const editOption = document.createElement('div');
        editOption.textContent = '编辑';
        editOption.style.cssText = `
            padding: 8px 16px;
            cursor: pointer;
            transition: background-color 0.2s;
        `;
        editOption.onmouseover = () => (editOption.style.backgroundColor = 'rgba(0, 0, 0, 0.1)');
        editOption.onmouseout = () => (editOption.style.backgroundColor = 'transparent');
        editOption.onclick = () => {
            this.openEditQuickAccessModal(index);
            menu.remove();
        };

        // 删除选项
        const deleteOption = document.createElement('div');
        deleteOption.textContent = '删除';
        deleteOption.style.cssText = `
            padding: 8px 16px;
            cursor: pointer;
            transition: background-color 0.2s;
            color: #e74c3c;
        `;
        deleteOption.onmouseover = () =>
            (deleteOption.style.backgroundColor = 'rgba(231, 76, 60, 0.1)');
        deleteOption.onmouseout = () => (deleteOption.style.backgroundColor = 'transparent');
        deleteOption.onclick = () => {
            this.confirmDeleteQuickAccess(index, siteName);
            menu.remove();
        };

        // 添加选项到菜单
        menu.appendChild(editOption);
        menu.appendChild(deleteOption);

        // 设置菜单位置
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';

        // 添加到页面
        document.body.appendChild(menu);

        // 点击其他地方关闭菜单
        const closeMenu = ev => {
            if (!menu.contains(ev.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };

        // 延迟添加事件监听器，避免立即触发
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 100);
    }

    // 删除确认弹窗
    confirmDeleteQuickAccess(index, siteName) {
        const deleteModal = document.getElementById(window.SELECTORS.deleteConfirmModal);
        const deleteConfirmText = document.getElementById(window.SELECTORS.deleteConfirmText);
        const deleteConfirmDelete = document.getElementById(window.SELECTORS.deleteConfirmDelete);
        const deleteConfirmCancel = document.getElementById(window.SELECTORS.deleteConfirmCancel);

        if (!(deleteModal && deleteConfirmText && deleteConfirmDelete && deleteConfirmCancel)) {
            return;
        }

        deleteConfirmText.textContent = `您确定要删除 "${siteName}" 吗？`;
        deleteModal.classList.remove('u-hidden');

        const handleDelete = async () => {
            await this.quickAccessManager.deleteSite(index);
            this.quickAccessManager.renderQuickAccess();
            deleteModal.classList.add('u-hidden');
            deleteConfirmDelete.removeEventListener('click', handleDelete);
            deleteConfirmCancel.removeEventListener('click', handleCancel);
        };

        const handleCancel = () => {
            deleteModal.classList.add('u-hidden');
            deleteConfirmDelete.removeEventListener('click', handleDelete);
            deleteConfirmCancel.removeEventListener('click', handleCancel);
        };

        deleteConfirmDelete.addEventListener('click', handleDelete);
        deleteConfirmCancel.addEventListener('click', handleCancel);
    }

    // ---------- 设置域 ----------

    // 绑定设置事件
    bindSettingsEvents() {
        const settingsBtn = document.getElementById(window.SELECTORS.settingsBtn);
        const settingsPanel = document.getElementById(window.SELECTORS.settingsPanel);
        const closeSettingsBtn = document.getElementById(window.SELECTORS.closeSettingsBtn);
        const saveSettingsBtn = document.getElementById(window.SELECTORS.saveSettingsBtn);

        if (settingsBtn && settingsPanel) {
            settingsBtn.addEventListener('click', () => this.openSettingsPanel());
        }

        if (closeSettingsBtn && settingsPanel) {
            closeSettingsBtn.addEventListener('click', () => this.closeSettingsPanel());
        }

        // 保存设置
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        }

        // 点击遮罩关闭
        if (settingsPanel) {
            settingsPanel.addEventListener('click', e => {
                if (e.target === settingsPanel) {
                    this.closeSettingsPanel();
                }
            });
        }

        this.bindWallpaperAdjustmentEvents();
        this.bindCustomEngineEvents();
    }

    // 壁纸亮度 / 模糊滑杆（实时应用 + 防抖持久化）
    bindWallpaperAdjustmentEvents() {
        const brightnessInput = document.getElementById(window.SELECTORS.wallpaperBrightnessInput);
        const blurInput = document.getElementById(window.SELECTORS.wallpaperBlurInput);
        const brightnessValue = document.getElementById(window.SELECTORS.brightnessValue);
        const blurValue = document.getElementById(window.SELECTORS.blurValue);
        if (!brightnessInput || !blurInput) return;

        let timerId = null;
        const persist = () => {
            if (timerId) clearTimeout(timerId);
            timerId = setTimeout(async () => {
                await this.settingsManager.setWallpaperAdjustments(
                    parseFloat(brightnessInput.value),
                    parseInt(blurInput.value, 10)
                );
            }, 400);
        };

        const apply = () => {
            const brightness = parseFloat(brightnessInput.value);
            const blur = parseInt(blurInput.value, 10);
            const container = document.getElementById(window.SELECTORS.wallpaperContainer);
            if (container) {
                const filters = [];
                if (brightness !== 1) filters.push(`brightness(${brightness})`);
                if (blur > 0) filters.push(`blur(${blur}px)`);
                container.style.filter = filters.join(' ');
                container.style.transform = blur > 0 ? 'scale(1.04)' : '';
            }
            if (brightnessValue) brightnessValue.textContent = `${Math.round(brightness * 100)}%`;
            if (blurValue) blurValue.textContent = `${blur}px`;
            persist();
        };

        brightnessInput.addEventListener('input', apply);
        blurInput.addEventListener('input', apply);
    }

    // 自定义搜索引擎：添加 / 删除 / 列表渲染
    bindCustomEngineEvents() {
        const nameInput = document.getElementById(window.SELECTORS.customEngineNameInput);
        const urlInput = document.getElementById(window.SELECTORS.customEngineUrlInput);
        const addBtn = document.getElementById(window.SELECTORS.customEngineAddBtn);
        if (!addBtn || !nameInput || !urlInput) return;

        addBtn.addEventListener('click', async () => {
            const result = await this.settingsManager.addCustomEngine(
                nameInput.value,
                urlInput.value
            );
            if (!result.ok) {
                window.showToast(result.message, 'error');
                return;
            }
            nameInput.value = '';
            urlInput.value = '';
            this.refreshCustomEngines();
            window.showToast('自定义引擎已添加', 'success');
        });
    }

    // 刷新自定义引擎列表与搜索下拉
    refreshCustomEngines() {
        const list = document.getElementById(window.SELECTORS.customEngineList);
        const engines = this.settingsManager.getCustomEngines();

        this.searchManager.setCustomEngines(engines);
        this.renderSearchEngineDropdown();

        if (!list) return;
        list.innerHTML = '';
        if (engines.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'engine-host';
            empty.textContent = '暂无自定义引擎';
            list.appendChild(empty);
            return;
        }
        engines.forEach(engine => {
            const li = document.createElement('li');
            const info = document.createElement('span');
            info.textContent = engine.name;
            const host = document.createElement('span');
            host.className = 'engine-host';
            try {
                host.textContent = new URL(engine.url.replace('%s', '')).hostname;
            } catch {
                host.textContent = '';
            }
            const remove = document.createElement('button');
            remove.className = 'engine-remove';
            remove.textContent = '×';
            remove.title = '删除';
            remove.addEventListener('click', async () => {
                await this.settingsManager.removeCustomEngine(engine.name);
                this.refreshCustomEngines();
                window.showToast(`已删除引擎「${engine.name}」`, 'success');
            });

            const left = document.createElement('span');
            left.appendChild(info);
            left.appendChild(document.createTextNode(' '));
            left.appendChild(host);
            li.appendChild(left);
            li.appendChild(remove);
            list.appendChild(li);
        });
    }

    // 打开设置面板（回显当前配置）
    async openSettingsPanel() {
        const settingsPanel = document.getElementById(window.SELECTORS.settingsPanel);
        const apiKeyInput = document.getElementById(window.SELECTORS.pexelsApiKeyInput);
        const weatherApiKeyInput = document.getElementById(window.SELECTORS.weatherApiKeyInput);
        const weatherCityInput = document.getElementById(window.SELECTORS.weatherCityInput);
        if (!settingsPanel) return;

        // 回显 Pexels Key
        if (apiKeyInput) apiKeyInput.value = this.settingsManager.getPexelsApiKey() || '';

        // 回显天气相关配置
        try {
            if (weatherApiKeyInput) {
                const k = this.settingsManager.getWeatherApiKey();
                if (typeof k === 'string') weatherApiKeyInput.value = k;
            }
            if (weatherCityInput) {
                const c = this.settingsManager.getWeatherCity();
                if (typeof c === 'string') weatherCityInput.value = c;
            }
        } catch (e) {
            console.warn('回显天气配置失败:', e);
        }

        // 回显标语 / 壁纸调节 / 自定义引擎
        const taglineInput = document.getElementById(window.SELECTORS.taglineInput);
        if (taglineInput) taglineInput.value = this.settingsManager.getTagline();

        const { brightness, blur } = this.settingsManager.getWallpaperAdjustments();
        const brightnessInput = document.getElementById(window.SELECTORS.wallpaperBrightnessInput);
        const blurInput = document.getElementById(window.SELECTORS.wallpaperBlurInput);
        const brightnessValue = document.getElementById(window.SELECTORS.brightnessValue);
        const blurValue = document.getElementById(window.SELECTORS.blurValue);
        if (brightnessInput) brightnessInput.value = String(brightness);
        if (blurInput) blurInput.value = String(blur);
        if (brightnessValue) brightnessValue.textContent = `${Math.round(brightness * 100)}%`;
        if (blurValue) blurValue.textContent = `${blur}px`;

        // 回显壁纸图源
        const sourceValue = this.settingsManager.getWallpaperSource();
        document
            .querySelectorAll('input[name="wallpaper-source"]')
            .forEach(radio => (radio.checked = radio.value === sourceValue));

        this.refreshCustomEngines();

        settingsPanel.classList.remove('u-hidden');
    }

    // 关闭设置面板
    closeSettingsPanel() {
        const settingsPanel = document.getElementById(window.SELECTORS.settingsPanel);
        if (settingsPanel) settingsPanel.classList.add('u-hidden');
    }

    // 保存设置（存储统一走 settingsManager，随后联动壁纸与天气）
    async saveSettings() {
        const apiKeyInput = document.getElementById(window.SELECTORS.pexelsApiKeyInput);
        const weatherCityInput = document.getElementById(window.SELECTORS.weatherCityInput);
        const weatherApiKeyInput = document.getElementById(window.SELECTORS.weatherApiKeyInput);
        const taglineInput = document.getElementById(window.SELECTORS.taglineInput);

        const pexelsKey = apiKeyInput ? apiKeyInput.value.trim() : '';
        const weatherCity = weatherCityInput ? weatherCityInput.value.trim() : '';
        const weatherApiKey = weatherApiKeyInput ? weatherApiKeyInput.value.trim() : '';
        const tagline = taglineInput ? taglineInput.value.trim() : '';
        const checkedSource = document.querySelector('input[name="wallpaper-source"]:checked');
        const wallpaperSource = checkedSource ? checkedSource.value : 'picsum';

        try {
            // Pexels Key 为可选项：填写即保存，清空即移除（回到免密钥图源）
            await this.settingsManager.saveFromPanel({
                pexelsApiKey: pexelsKey,
                weatherApiKey,
                weatherCity,
                wallpaperSource,
            });

            // 图源切换即时同步到壁纸管理器
            this.wallpaperManager.wallpaperSource = wallpaperSource;

            // 标语：即时生效于时钟下方
            await this.settingsManager.setTagline(tagline);
            const taglineEl = document.getElementById(window.SELECTORS.tagline);
            if (taglineEl) {
                taglineEl.textContent = tagline;
                taglineEl.classList.toggle('u-hidden', !tagline);
            }

            // 联动天气管理器
            if (weatherApiKey && this.weatherManager.setApiKey) {
                this.weatherManager.setApiKey(weatherApiKey);
            }
            if (weatherCity) {
                await this.weatherManager.setCity(weatherCity);
            } else {
                await this.weatherManager.useCurrentLocation();
            }

            // 联动壁纸管理器（重新按新 Key 状态应用壁纸）
            await this.wallpaperManager.fetchAndSetWallpaper();

            this.closeSettingsPanel();
            console.log('设置已保存');
            window.showToast('设置已保存', 'success');
        } catch (error) {
            console.error('保存设置失败:', error);
            window.showToast('保存设置失败，请重试', 'error');
        }
    }

    // ---------- 天气域 ----------

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
    }

    // ---------- 小组件域（时钟 / 待办 / 便签 / 番茄钟） ----------

    // 启动时钟（每秒刷新；标签页隐藏时浏览器会自动节流，无需人工降频）
    startClock() {
        const render = () => this.renderClock();
        render();
        this.clockTimerId = setInterval(render, 1000);
    }

    // 渲染时钟 / 日期 / 问候 / 标语
    renderClock() {
        const timeEl = document.getElementById(window.SELECTORS.clockTime);
        const dateEl = document.getElementById(window.SELECTORS.clockDate);
        const greetEl = document.getElementById(window.SELECTORS.clockGreeting);
        const taglineEl = document.getElementById(window.SELECTORS.tagline);
        const now = new Date();

        if (timeEl) {
            timeEl.textContent = now.toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            });
        }
        if (dateEl) {
            dateEl.textContent = now.toLocaleDateString('zh-CN', {
                month: 'long',
                day: 'numeric',
                weekday: 'long',
            });
        }
        if (greetEl) {
            const h = now.getHours();
            let greeting = '晚上好';
            if (h < 5) greeting = '夜深了';
            else if (h < 9) greeting = '早上好';
            else if (h < 12) greeting = '上午好';
            else if (h < 14) greeting = '中午好';
            else if (h < 18) greeting = '下午好';
            greetEl.textContent = greeting;
        }
        if (taglineEl && !taglineEl.textContent) {
            // 标语仅在设置里配置后显示（openSettingsPanel/saveSettings 同步）
            const tagline = this.settingsManager.getTagline();
            if (tagline) {
                taglineEl.textContent = tagline;
                taglineEl.classList.remove('u-hidden');
            }
        }
    }

    // 绑定小组件事件
    bindWidgetEvents() {
        this.bindTodoEvents();
        this.bindNotesEvents();
        this.bindPomodoroEvents();
        this.bindToolsEvents();
        this.bindSideWidgets();
    }

    // ---------- 小工具 ----------

    renderToolsCard() {
        const grid = document.getElementById(window.SELECTORS.toolsCardGrid);
        if (!grid) return;
        const featured = window.QUICK_TOOLS_FEATURED || [];
        const tools = featured.map(id => this.quickTools.find(t => t.id === id)).filter(Boolean);
        grid.innerHTML = '';
        tools.forEach(tool => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'tool-mini-btn';
            btn.dataset.toolId = tool.id;
            btn.title = `${tool.name} · ${tool.desc}`;
            btn.innerHTML = `<span class="tool-mini-icon">${tool.icon}</span><span class="tool-mini-name">${tool.name}</span>`;
            btn.addEventListener('click', () => this.openToolsPanel(tool.id));
            grid.appendChild(btn);
        });
    }

    renderToolsGrid() {
        const grid = document.getElementById(window.SELECTORS.toolsGrid);
        if (!grid) return;
        grid.innerHTML = '';
        this.quickTools.forEach(tool => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'tool-grid-btn';
            btn.dataset.toolId = tool.id;
            btn.innerHTML = `
                <span class="tool-grid-icon">${tool.icon}</span>
                <span class="tool-grid-name">${tool.name}</span>
                <span class="tool-grid-desc">${tool.desc}</span>`;
            btn.addEventListener('click', () => this.showToolDetail(tool.id));
            grid.appendChild(btn);
        });
    }

    bindToolsEvents() {
        const S = window.SELECTORS;
        const panel = document.getElementById(S.toolsPanel);
        const expandBtn = document.getElementById(S.toolsCardExpand);
        const closeBtn = document.getElementById(S.closeToolsBtn);
        const backBtn = document.getElementById(S.toolsBackBtn);
        const runBtn = document.getElementById(S.toolRunBtn);
        const genBtn = document.getElementById(S.toolGenerateBtn);
        const copyBtn = document.getElementById(S.toolCopyBtn);
        const clearBtn = document.getElementById(S.toolClearBtn);
        const input = document.getElementById(S.toolInput);

        if (expandBtn) expandBtn.addEventListener('click', () => this.openToolsPanel());
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeToolsPanel());
        if (backBtn) backBtn.addEventListener('click', () => this.showToolsGridView());
        if (runBtn) runBtn.addEventListener('click', () => this.runActiveTool());
        if (genBtn) genBtn.addEventListener('click', () => this.runActiveTool());
        if (copyBtn) copyBtn.addEventListener('click', () => this.copyToolResult());
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (input) input.value = '';
                const out = document.getElementById(S.toolOutput);
                if (out) out.textContent = '';
            });
        }
        if (input) {
            input.addEventListener('keydown', e => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    this.runActiveTool();
                }
            });
        }
        if (panel) {
            panel.addEventListener('click', e => {
                if (e.target === panel) this.closeToolsPanel();
            });
        }
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && panel && !panel.classList.contains('u-hidden')) {
                this.closeToolsPanel();
            }
        });
    }

    openToolsPanel(toolId = null) {
        const S = window.SELECTORS;
        const panel = document.getElementById(S.toolsPanel);
        if (!panel) return;
        this.renderToolsGrid();
        panel.classList.remove('u-hidden');
        if (toolId) {
            this.showToolDetail(toolId);
        } else {
            this.showToolsGridView();
        }
    }

    closeToolsPanel() {
        const panel = document.getElementById(window.SELECTORS.toolsPanel);
        if (panel) panel.classList.add('u-hidden');
        this.activeToolId = null;
    }

    showToolsGridView() {
        const S = window.SELECTORS;
        const gridView = document.getElementById(S.toolsGridView);
        const detailView = document.getElementById(S.toolsDetailView);
        const backBtn = document.getElementById(S.toolsBackBtn);
        const title = document.getElementById(S.toolsPanelTitle);
        if (gridView) gridView.classList.remove('u-hidden');
        if (detailView) detailView.classList.add('u-hidden');
        if (backBtn) backBtn.classList.add('u-hidden');
        if (title) title.textContent = '小工具';
        this.activeToolId = null;
    }

    showToolDetail(toolId) {
        const S = window.SELECTORS;
        const tool = this.quickTools.find(t => t.id === toolId);
        if (!tool) return;
        this.activeToolId = toolId;

        const gridView = document.getElementById(S.toolsGridView);
        const detailView = document.getElementById(S.toolsDetailView);
        const backBtn = document.getElementById(S.toolsBackBtn);
        const title = document.getElementById(S.toolsPanelTitle);
        const desc = document.getElementById(S.toolDesc);
        const input = document.getElementById(S.toolInput);
        const out = document.getElementById(S.toolOutput);
        const runBtn = document.getElementById(S.toolRunBtn);
        const genBtn = document.getElementById(S.toolGenerateBtn);

        if (gridView) gridView.classList.add('u-hidden');
        if (detailView) detailView.classList.remove('u-hidden');
        if (backBtn) backBtn.classList.remove('u-hidden');
        if (title) title.textContent = tool.name;
        if (desc) desc.textContent = tool.desc;
        if (input) {
            input.value = '';
            input.placeholder = tool.placeholder || '';
        }
        if (out) out.textContent = '';

        const isGenerate = tool.kind === 'generate';
        if (runBtn) runBtn.classList.toggle('u-hidden', isGenerate);
        if (genBtn) genBtn.classList.toggle('u-hidden', !isGenerate);

        if (isGenerate) this.runActiveTool();
        else if (input) input.focus();
    }

    async runActiveTool() {
        const S = window.SELECTORS;
        const tool = this.quickTools.find(t => t.id === this.activeToolId);
        if (!tool) return;
        const input = document.getElementById(S.toolInput);
        const out = document.getElementById(S.toolOutput);
        try {
            let result;
            if (tool.kind === 'generate') {
                result = tool.action();
            } else {
                const value = input ? input.value : '';
                if (!value.trim()) {
                    if (out) out.textContent = '';
                    return;
                }
                result = await tool.run(value);
            }
            if (out) out.textContent = result;
        } catch (error) {
            if (out) out.textContent = `执行失败: ${error.message}`;
        }
    }

    async copyToolResult() {
        const out = document.getElementById(window.SELECTORS.toolOutput);
        const text = out ? out.textContent : '';
        if (!text) {
            window.showToast('没有可复制的结果', 'warning', 1800);
            return;
        }
        try {
            await navigator.clipboard.writeText(text);
            window.showToast('已复制到剪贴板', 'success', 1600);
        } catch {
            // 剪贴板 API 不可用时的兜底（扩展页面/部分环境）
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand('copy');
            ta.remove();
            if (ok) window.showToast('已复制到剪贴板', 'success', 1600);
            else window.showToast('复制失败，请手动选择复制', 'error', 2200);
        }
    }

    // 待办事项
    bindTodoEvents() {
        const todoBtn = document.getElementById(window.SELECTORS.todoBtn);
        const todoPanel = document.getElementById(window.SELECTORS.todoPanel);
        const closeTodoBtn = document.getElementById(window.SELECTORS.closeTodoBtn);
        const todoInput = document.getElementById(window.SELECTORS.todoInput);
        const todoAddBtn = document.getElementById(window.SELECTORS.todoAddBtn);
        const todoImportantBtn = document.getElementById(window.SELECTORS.todoImportantBtn);
        const todoClearDoneBtn = document.getElementById(window.SELECTORS.todoClearDoneBtn);
        const todoFilterBar = document.getElementById(window.SELECTORS.todoFilterBar);
        const todoCategorySelect = document.getElementById(window.SELECTORS.todoCategorySelect);
        const todoDueDateInput = document.getElementById(window.SELECTORS.todoDueDateInput);
        const todoList = document.getElementById(window.SELECTORS.todoList);

        this.todoFilter = 'all';

        if (todoBtn && todoPanel) {
            todoBtn.addEventListener('click', () => {
                todoPanel.classList.remove('u-hidden');
                this.renderTodoList();
                if (todoInput) todoInput.focus();
            });
        }
        if (closeTodoBtn && todoPanel) {
            closeTodoBtn.addEventListener('click', () => todoPanel.classList.add('u-hidden'));
        }
        if (todoPanel) {
            // 点击遮罩关闭
            todoPanel.addEventListener('click', e => {
                if (e.target === todoPanel) todoPanel.classList.add('u-hidden');
            });
        }

        // 分类过滤 tab（事件委托）
        if (todoFilterBar) {
            todoFilterBar.addEventListener('click', e => {
                const tab = e.target.closest('.todo-filter-tab');
                if (!tab) return;
                this.todoFilter = tab.dataset.filter || 'all';
                todoFilterBar
                    .querySelectorAll('.todo-filter-tab')
                    .forEach(t => t.classList.toggle('active', t === tab));
                this.renderTodoList();
            });
        }

        // 重要标记切换
        if (todoImportantBtn) {
            todoImportantBtn.addEventListener('click', () => {
                this.todoImportantActive = !this.todoImportantActive;
                todoImportantBtn.classList.toggle('active', this.todoImportantActive);
            });
        }

        // 添加（按钮 + 回车）
        const add = async () => {
            if (!todoInput) return;
            const content = todoInput.value.trim();
            if (!content) {
                window.showToast('请输入待办内容', 'error');
                return;
            }
            const category = todoCategorySelect ? todoCategorySelect.value : 'normal';
            const dueDate =
                todoDueDateInput && todoDueDateInput.value ? todoDueDateInput.value : null;
            await this.todoManager.addTodo(content, {
                important: this.todoImportantActive,
                category,
                dueDate,
            });
            todoInput.value = '';
            if (todoDueDateInput) todoDueDateInput.value = '';
            this.renderTodoList();
        };
        if (todoAddBtn) todoAddBtn.addEventListener('click', add);
        if (todoInput) {
            todoInput.addEventListener('keypress', e => {
                if (e.key === 'Enter') add();
            });
        }

        // 清除已完成
        if (todoClearDoneBtn) {
            todoClearDoneBtn.addEventListener('click', async () => {
                const removed = await this.todoManager.clearDone();
                if (removed > 0) window.showToast(`已清除 ${removed} 条已完成待办`, 'success');
                this.renderTodoList();
            });
        }

        // 拖拽排序（SortableJS，仅初始化一次）
        if (todoList && typeof Sortable !== 'undefined' && !this.todoSortable) {
            this.todoSortable = Sortable.create(todoList, {
                animation: 150,
                onEnd: async () => {
                    const ids = [...todoList.children]
                        .map(li => li.dataset && li.dataset.id)
                        .filter(Boolean);
                    if (ids.length) {
                        await this.todoManager.updateOrder(ids);
                        window.showToast('排序已保存', 'success', 1200);
                    }
                },
            });
        }
    }

    // 渲染待办条目到指定容器（面板与主页卡片共用）
    renderTodoInto(listEl, todos) {
        if (!listEl) return;
        listEl.innerHTML = '';
        todos.forEach(todo => {
            const li = document.createElement('li');
            li.className = `todo-item cat-${todo.category || 'normal'}${todo.done ? ' done' : ''}${
                todo.important ? ' important' : ''
            }`;
            li.dataset.id = todo.id;
            if (window.TodoManager.isOverdue(todo)) li.classList.add('overdue');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = todo.done;
            checkbox.addEventListener('change', async () => {
                await this.todoManager.toggleTodo(todo.id);
                this.renderTodoList();
            });

            const star = document.createElement('span');
            star.className = 'todo-star';
            star.textContent = todo.important ? '★' : '';
            star.title = todo.important ? '重要' : '';

            const text = document.createElement('span');
            text.className = 'todo-text';
            text.textContent = todo.content;

            const catIcon = { work: '💼', life: '🏠', normal: '📝' }[todo.category] || '📝';
            const badge = document.createElement('span');
            badge.className = 'todo-cat-badge';
            badge.textContent = catIcon;
            badge.title = { work: '工作', life: '生活', normal: '普通' }[todo.category] || '普通';

            const due = document.createElement('span');
            due.className = 'todo-due';
            if (todo.dueDate) {
                due.textContent = window.TodoManager.isOverdue(todo)
                    ? `⚠️ ${todo.dueDate} 已逾期`
                    : `📅 ${todo.dueDate}`;
            }

            const del = document.createElement('button');
            del.className = 'todo-delete-btn';
            del.textContent = '×';
            del.title = '删除';
            del.addEventListener('click', async () => {
                await this.todoManager.removeTodo(todo.id);
                this.renderTodoList();
            });

            li.appendChild(checkbox);
            li.appendChild(star);
            li.appendChild(badge);
            li.appendChild(text);
            li.appendChild(due);
            li.appendChild(del);
            listEl.appendChild(li);
        });
    }

    // 渲染面板待办列表（含过滤与统计条）
    renderTodoList() {
        const todoList = document.getElementById(window.SELECTORS.todoList);
        const todoCount = document.getElementById(window.SELECTORS.todoCount);
        if (!todoList) return;

        const filter = this.todoFilter || 'all';
        const todos = this.todoManager
            .getTodos()
            .filter(t => filter === 'all' || t.category === filter);
        this.renderTodoInto(todoList, todos);

        if (todoCount) {
            const stats = this.todoManager.getStats();
            const parts = [`${stats.active} 项待完成`, `今日完成 ${stats.doneToday}`];
            if (stats.overdue > 0) parts.push(`⚠️ ${stats.overdue} 项已逾期`);
            todoCount.textContent = parts.join(' · ');
        }

        // 同步主页卡片
        this.renderTodoCard();
    }

    // 主页右侧待办卡片
    renderTodoCard() {
        const listEl = document.getElementById(window.SELECTORS.todoCardList);
        const badge = document.getElementById(window.SELECTORS.todoCardBadge);
        if (!listEl) return;
        this.renderTodoInto(listEl, this.todoManager.getTodos());
        if (badge) {
            badge.textContent = String(this.todoManager.getStats().active);
        }
    }

    // 备忘录（多便签）
    bindNotesEvents() {
        const notesBtn = document.getElementById(window.SELECTORS.notesBtn);
        const notesPanel = document.getElementById(window.SELECTORS.notesPanel);
        const closeNotesBtn = document.getElementById(window.SELECTORS.closeNotesBtn);
        const notesSearchInput = document.getElementById(window.SELECTORS.notesSearchInput);
        const notesAddBtn = document.getElementById(window.SELECTORS.notesAddBtn);
        const notesList = document.getElementById(window.SELECTORS.notesList);
        if (!notesBtn || !notesPanel || !notesList) return;

        this.notesKeyword = '';
        this.noteSaveTimers = new Map(); // noteId -> timerId（面板与卡片共享）

        notesBtn.addEventListener('click', () => {
            notesPanel.classList.remove('u-hidden');
            this.renderNotesList();
        });
        if (closeNotesBtn) {
            closeNotesBtn.addEventListener('click', () => notesPanel.classList.add('u-hidden'));
        }
        notesPanel.addEventListener('click', e => {
            if (e.target === notesPanel) notesPanel.classList.add('u-hidden');
        });

        // 搜索（实时过滤）
        if (notesSearchInput) {
            notesSearchInput.addEventListener('input', () => {
                this.notesKeyword = notesSearchInput.value;
                this.renderNotesList();
            });
        }

        // 新建便签
        if (notesAddBtn) {
            notesAddBtn.addEventListener('click', async () => {
                const note = await this.notesManager.addNote('');
                this.renderNotesList();
                const card = notesList.querySelector(`li[data-id="${note.id}"] textarea`);
                if (card) card.focus();
            });
        }
    }

    // 渲染便签条目到指定容器（面板与主页卡片共用）
    renderNotesInto(listEl, notes, { emptyText = '还没有便签，点「＋ 新便签」开始记录' } = {}) {
        if (!listEl) return;
        listEl.innerHTML = '';
        if (notes.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'notes-empty';
            empty.textContent = emptyText;
            listEl.appendChild(empty);
            return;
        }
        notes.forEach(note => {
            const li = document.createElement('li');
            li.className = `note-card${note.pinned ? ' pinned' : ''}`;
            li.dataset.id = note.id;

            const toolbar = document.createElement('div');
            toolbar.className = 'note-toolbar';

            const pin = document.createElement('button');
            pin.className = `note-pin-btn${note.pinned ? ' active' : ''}`;
            pin.textContent = '📌';
            pin.title = note.pinned ? '取消置顶' : '置顶';
            pin.addEventListener('click', async () => {
                await this.notesManager.togglePin(note.id);
                this.renderNotesList();
            });

            const del = document.createElement('button');
            del.className = 'note-delete-btn';
            del.textContent = '🗑';
            del.title = '删除便签';
            del.addEventListener('click', async () => {
                await this.notesManager.removeNote(note.id);
                window.showToast('便签已删除', 'success', 1500);
                this.renderNotesList();
            });

            toolbar.appendChild(pin);
            toolbar.appendChild(del);

            const textarea = document.createElement('textarea');
            textarea.className = 'note-content';
            textarea.placeholder = '随手记点什么…（自动保存）';
            textarea.value = note.content || '';
            textarea.addEventListener('input', () => {
                if (this.noteSaveTimers.has(note.id)) {
                    clearTimeout(this.noteSaveTimers.get(note.id));
                }
                this.noteSaveTimers.set(
                    note.id,
                    setTimeout(async () => {
                        await this.notesManager.updateNote(note.id, textarea.value);
                        this.noteSaveTimers.delete(note.id);
                        this.renderNotesCard();
                    }, 500)
                );
            });

            const meta = document.createElement('div');
            meta.className = 'note-meta';
            meta.textContent = note.updatedAt
                ? new Date(note.updatedAt).toLocaleString('zh-CN', {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                  })
                : '新便签';

            li.appendChild(toolbar);
            li.appendChild(textarea);
            li.appendChild(meta);
            listEl.appendChild(li);
        });
    }

    // 渲染面板便签列表（含搜索与统计）
    renderNotesList() {
        const notesList = document.getElementById(window.SELECTORS.notesList);
        const notesMeta = document.getElementById(window.SELECTORS.notesMeta);
        const notes = this.notesManager.searchNotes(this.notesKeyword);
        this.renderNotesInto(notesList, notes, {
            emptyText: this.notesKeyword ? '没有匹配的便签' : '还没有便签，点「＋ 新便签」开始记录',
        });
        if (notesMeta) {
            const total = this.notesManager.getNotes().length;
            const chars = this.notesManager
                .getNotes()
                .reduce((sum, n) => sum + (n.content || '').length, 0);
            notesMeta.textContent = `共 ${total} 条便签 · ${chars} 字（自动保存）`;
        }
        // 同步主页卡片
        this.renderNotesCard();
    }

    // 主页右侧便签卡片
    renderNotesCard() {
        const listEl = document.getElementById(window.SELECTORS.notesCardList);
        const badge = document.getElementById(window.SELECTORS.notesCardBadge);
        if (!listEl) return;
        this.renderNotesInto(listEl, this.notesManager.getNotes(), {
            emptyText: '还没有便签',
        });
        if (badge) {
            badge.textContent = String(this.notesManager.getNotes().length);
        }
    }

    // 番茄钟
    bindPomodoroEvents() {
        const pomodoroBtn = document.getElementById(window.SELECTORS.pomodoroBtn);
        const pomodoroPanel = document.getElementById(window.SELECTORS.pomodoroPanel);
        const closePomodoroBtn = document.getElementById(window.SELECTORS.closePomodoroBtn);
        const ringBar = document.getElementById(window.SELECTORS.pomodoroRingProgress);
        const display = document.getElementById(window.SELECTORS.pomodoroDisplay);
        const stateEl = document.getElementById(window.SELECTORS.pomodoroState);
        const todayCountEl = document.getElementById(window.SELECTORS.pomodoroTodayCount);
        const roundsEl = document.getElementById(window.SELECTORS.pomodoroRounds);
        const startBtn = document.getElementById(window.SELECTORS.pomodoroStartBtn);
        const skipBtn = document.getElementById(window.SELECTORS.pomodoroSkipBtn);
        const resetBtn = document.getElementById(window.SELECTORS.pomodoroResetBtn);
        const settingsToggle = document.getElementById(window.SELECTORS.pomodoroSettingsToggle);
        const settingsBox = document.getElementById(window.SELECTORS.pomodoroSettingsBox);
        const workInput = document.getElementById(window.SELECTORS.pomodoroWorkInput);
        const breakInput = document.getElementById(window.SELECTORS.pomodoroBreakInput);
        const longBreakInput = document.getElementById(window.SELECTORS.pomodoroLongBreakInput);
        const roundsInput = document.getElementById(window.SELECTORS.pomodoroRoundsInput);
        if (!pomodoroBtn || !pomodoroPanel || !display || !stateEl || !startBtn || !resetBtn) {
            return;
        }

        const pm = this.pomodoroManager;
        const RING_RADIUS = 88;
        const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
        const DEFAULT_TITLE = document.title;
        if (ringBar) {
            ringBar.style.strokeDasharray = String(RING_CIRCUMFERENCE);
            ringBar.style.strokeDashoffset = '0';
        }

        // Web Audio 完成提示音（三音上行，无资源文件）
        const playChime = () => {
            try {
                const ctx =
                    this.pomodoroAudioCtx ||
                    (this.pomodoroAudioCtx = new (window.AudioContext ||
                        window.webkitAudioContext)());
                const notes = [659.25, 830.61, 987.77]; // E5 G#5 B5
                notes.forEach((freq, i) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.value = freq;
                    const t0 = ctx.currentTime + i * 0.18;
                    gain.gain.setValueAtTime(0.0001, t0);
                    gain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.03);
                    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
                    osc.connect(gain).connect(ctx.destination);
                    osc.start(t0);
                    osc.stop(t0 + 0.5);
                });
            } catch (error) {
                console.warn('[pomodoro] 提示音播放失败:', error?.message || error);
            }
        };

        const renderRounds = () => {
            if (!roundsEl) return;
            const rounds = pm.getSettings().roundsBeforeLongBreak;
            const cycleInRound = (pm.getStats().cycleCount || 0) % rounds;
            roundsEl.innerHTML = '';
            for (let i = 0; i < rounds; i++) {
                const dot = document.createElement('span');
                dot.className = `pomodoro-round-dot${i < cycleInRound ? ' filled' : ''}`;
                roundsEl.appendChild(dot);
            }
        };

        const render = () => {
            const progress = pm.getProgress();
            display.textContent = pm.format(progress.remaining);
            stateEl.textContent = pm.getStateLabel();
            startBtn.textContent = pm.isRunning()
                ? '暂停'
                : pm.state === 'paused'
                  ? '继续'
                  : '开始';
            if (ringBar) {
                ringBar.style.strokeDashoffset = String(
                    RING_CIRCUMFERENCE * (1 - progress.progress)
                );
                ringBar.classList.toggle('break', progress.phaseType !== 'work');
            }
            if (todayCountEl) {
                todayCountEl.textContent = `今日 🍅 × ${pm.getStats().completedToday || 0}`;
            }
            renderRounds();
            // 标题联动：运行中显示倒计时，否则恢复
            if (pm.isRunning()) {
                document.title = `${pm.format(progress.remaining)} · ${pm.getStateLabel()}`;
            } else if (document.title !== DEFAULT_TITLE) {
                document.title = DEFAULT_TITLE;
            }
            // 同步主页卡片
            this.renderPomodoroCard();
        };

        // 阶段完成提示：声音 + toast
        pm.onPhaseComplete = nextPhase => {
            playChime();
            const msg = {
                break: '🍅 专注完成！休息一下',
                longBreak: '🎉 完成一整轮！进入长休息',
                work: '⏰ 休息结束，开始新一轮专注',
            }[nextPhase];
            window.showToast(msg, 'success', 4000);
        };
        pm.onStatsChanged = () => render();
        pm.onTick = render;

        pomodoroBtn.addEventListener('click', () => {
            pomodoroPanel.classList.remove('u-hidden');
            render();
        });
        if (closePomodoroBtn) {
            closePomodoroBtn.addEventListener('click', () =>
                pomodoroPanel.classList.add('u-hidden')
            );
        }
        pomodoroPanel.addEventListener('click', e => {
            if (e.target === pomodoroPanel) pomodoroPanel.classList.add('u-hidden');
        });

        // 开始/暂停/继续（单按钮状态机）
        startBtn.addEventListener('click', () => {
            if (pm.isRunning()) {
                pm.pause();
            } else {
                pm.start();
            }
            render();
        });

        // 跳过当前阶段
        if (skipBtn) {
            skipBtn.addEventListener('click', () => {
                pm.skipPhase();
                render();
            });
        }

        resetBtn.addEventListener('click', () => {
            pm.reset();
            render();
        });

        // 时长设置折叠区
        const fillSettings = () => {
            const s = pm.getSettings();
            if (workInput) workInput.value = s.workMinutes;
            if (breakInput) breakInput.value = s.breakMinutes;
            if (longBreakInput) longBreakInput.value = s.longBreakMinutes;
            if (roundsInput) roundsInput.value = s.roundsBeforeLongBreak;
        };
        if (settingsToggle && settingsBox) {
            settingsToggle.addEventListener('click', () => {
                const hidden = settingsBox.classList.toggle('u-hidden');
                settingsToggle.textContent = hidden ? '⚙ 时长设置' : '⚙ 收起设置';
                if (!hidden) fillSettings();
            });
        }
        const applySettings = async () => {
            await pm.setSettings({
                workMinutes: workInput ? workInput.value : undefined,
                breakMinutes: breakInput ? breakInput.value : undefined,
                longBreakMinutes: longBreakInput ? longBreakInput.value : undefined,
                roundsBeforeLongBreak: roundsInput ? roundsInput.value : undefined,
            });
            fillSettings();
            render();
            window.showToast('番茄钟设置已保存', 'success', 1500);
        };
        [workInput, breakInput, longBreakInput, roundsInput].forEach(input => {
            if (input) input.addEventListener('change', applySettings);
        });
    }

    // 主页右侧番茄钟卡片（面板 render/onTick 已同步调用）
    renderPomodoroCard() {
        const timeEl = document.getElementById(window.SELECTORS.pomodoroCardTime);
        if (!timeEl) return;
        const stateEl = document.getElementById(window.SELECTORS.pomodoroCardState);
        const todayEl = document.getElementById(window.SELECTORS.pomodoroCardToday);
        const ringEl = document.getElementById(window.SELECTORS.pomodoroCardRing);
        const startEl = document.getElementById(window.SELECTORS.pomodoroCardStart);
        const pm = this.pomodoroManager;
        const progress = pm.getProgress();

        timeEl.textContent = pm.format(progress.remaining);
        if (stateEl) stateEl.textContent = pm.getStateLabel();
        if (todayEl) todayEl.textContent = `今日 🍅 × ${pm.getStats().completedToday || 0}`;
        if (startEl) {
            startEl.textContent = pm.isRunning() ? '暂停' : pm.state === 'paused' ? '继续' : '开始';
        }
        if (ringEl) {
            const CIRC = 2 * Math.PI * 34;
            if (!this.pomoCardRingReady) {
                ringEl.style.strokeDasharray = String(CIRC);
                this.pomoCardRingReady = true;
            }
            ringEl.style.strokeDashoffset = String(CIRC * (1 - progress.progress));
            ringEl.classList.toggle('break', progress.phaseType !== 'work');
        }
    }

    // 主页右侧常驻小组件：卡片交互 + 面板直达 + 设置开关
    bindSideWidgets() {
        const SELECT = window.SELECTORS;

        // 待办卡：快速添加
        const todoInput = document.getElementById(SELECT.todoCardInput);
        if (todoInput) {
            todoInput.addEventListener('keypress', async e => {
                if (e.key !== 'Enter') return;
                const content = todoInput.value.trim();
                if (!content) {
                    window.showToast('请输入待办内容', 'error');
                    return;
                }
                await this.todoManager.addTodo(content, { category: 'normal' });
                todoInput.value = '';
                this.renderTodoList();
            });
        }

        // 面板直达（复用顶右按钮的打开逻辑）
        const expandMap = [
            [SELECT.todoCardExpand, SELECT.todoBtn],
            [SELECT.notesCardExpand, SELECT.notesBtn],
            [SELECT.pomodoroCardExpand, SELECT.pomodoroBtn],
        ];
        expandMap.forEach(([cardBtnId, panelBtnId]) => {
            const cardBtn = document.getElementById(cardBtnId);
            if (!cardBtn) return;
            cardBtn.addEventListener('click', () => {
                const panelBtn = document.getElementById(panelBtnId);
                if (panelBtn) panelBtn.click();
            });
        });

        // 番茄钟卡：开始/暂停 + 跳过
        const startBtn = document.getElementById(SELECT.pomodoroCardStart);
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                const pm = this.pomodoroManager;
                if (pm.isRunning()) {
                    pm.pause();
                } else {
                    pm.start();
                }
                this.renderPomodoroCard();
            });
        }
        const skipBtn = document.getElementById(SELECT.pomodoroCardSkip);
        if (skipBtn) {
            skipBtn.addEventListener('click', () => {
                this.pomodoroManager.skipPhase();
                this.renderPomodoroCard();
            });
        }

        // 设置开关：主页显示小组件
        const toggle = document.getElementById(SELECT.showSideWidgetsToggle);
        if (toggle) {
            toggle.checked = this.settingsManager.settings.showSideWidgets !== false;
            toggle.addEventListener('change', async () => {
                this.settingsManager.settings.showSideWidgets = toggle.checked;
                await this.settingsManager.saveSettings();
                this.applySideWidgetsVisibility();
                window.showToast(
                    toggle.checked ? '主页小组件已显示' : '主页小组件已隐藏',
                    'success',
                    1500
                );
            });
        }
    }

    // ---------- 总入口 ----------

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

        // 小组件事件
        this.bindWidgetEvents();
    }

    // 渲染快捷访问
    renderQuickAccess() {
        const quickAccessGrid = document.getElementById(window.SELECTORS.quickAccessGrid);
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
                    // 同步拖拽后的新顺序回 manager 再持久化
                    this.quickAccessManager.setSites(newOrder);
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
