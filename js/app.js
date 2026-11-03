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

        // UI 状态（纯渲染层）
        this.activeCategoryElement = null;
        this.lastActiveCategoryQuery = 'Nature';
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
            await Promise.all([this.settingsManager.init(), this.quickAccessManager.init()]);

            // 设置壁纸管理器的API密钥
            const apiKey = this.settingsManager.getPexelsApiKey();
            this.wallpaperManager.setApiKey(apiKey);
            this.wallpaperManager.onAuthError = () => this.openSettingsPanel();

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
        // 加载壁纸（缓存优先 / Bing 免 Key / Pexels 随机，全链路在 manager 内）
        this.wallpaperManager.fetchAndSetWallpaper();

        // 渲染快捷访问
        this.renderQuickAccess();

        // 渲染搜索界面
        this.renderSearchInterface();

        // 渲染壁纸分类侧栏
        this.renderWallpaperCategories();

        // 密钥可见性切换
        this.initVisibilityToggle();
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

        // "换一张"：有 Key 走 Pexels 随机；无 Key 走 Bing 随机（免密钥）
        if (changeWallpaperBtn) {
            changeWallpaperBtn.addEventListener('click', async () => {
                if (this.wallpaperManager.pexelsApiKey) {
                    await this.wallpaperManager.fetchRandomWallpaper(true);
                } else {
                    await this.wallpaperManager.fetchBingWallpaper(true);
                }
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

        if (!wm.pexelsApiKey) {
            // 未配置 Pexels Key：显示引导信息（Pexels 搜索为可选增强功能，壁纸仍由 Bing 提供）
            this.openWallpaperPanel();
            const wallpaperLoading = document.getElementById(window.SELECTORS.wallpaperLoading);
            if (wallpaperLoading) wallpaperLoading.classList.add('u-hidden');
            const wallpaperGrid = document.getElementById(window.SELECTORS.wallpaperGrid);
            if (wallpaperGrid) {
                wallpaperGrid.innerHTML =
                    '<div class="wallpaper-empty-hint">壁纸搜索需要 Pexels API 密钥（可选功能）。<br>当前新标签页已默认使用 Bing 每日壁纸，无需任何密钥。<br>如需解锁搜索与分类功能，请在设置中填写免费的 Pexels API 密钥。</div>';
            }
            return;
        }

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
                wallpaperGrid.innerHTML = '加载失败，请检查API密钥或网络。';
            }
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

        import('./js/components/visibility-toggle.js')
            .then(({ initVisibilityToggle }) => {
                initVisibilityToggle(apiKeyInput, toggleVisibilityBtn, {});
                const toggleWeatherBtn = document.getElementById(window.SELECTORS.weatherToggleBtn);
                if (toggleWeatherBtn && weatherApiKeyInput) {
                    initVisibilityToggle(weatherApiKeyInput, toggleWeatherBtn, {});
                }
            })
            .catch(() => {
                // 回退：不影响其他功能
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

        const pexelsKey = apiKeyInput ? apiKeyInput.value.trim() : '';
        const weatherCity = weatherCityInput ? weatherCityInput.value.trim() : '';
        const weatherApiKey = weatherApiKeyInput ? weatherApiKeyInput.value.trim() : '';

        try {
            // Pexels Key 为可选项：填写即保存，清空即移除（回到 Bing 免密钥模式）
            await this.settingsManager.saveFromPanel({
                pexelsApiKey: pexelsKey,
                weatherApiKey,
                weatherCity,
            });

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
