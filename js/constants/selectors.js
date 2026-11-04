// 关键选择器常量，挂到全局以便非模块脚本使用
export const SELECTORS = {
    // 设置面板
    settingsBtn: 'settings-btn',
    settingsPanel: 'settings-panel',
    closeSettingsBtn: 'close-settings-btn',
    saveSettingsBtn: 'save-settings-btn',

    // 壁纸密钥
    pexelsApiKeyInput: 'api-key-input',
    pexelsToggleBtn: 'toggle-api-key-visibility',

    // 天气密钥与城市
    weatherApiKeyInput: 'weather-api-key-input',
    weatherToggleBtn: 'toggle-weather-key-visibility',
    weatherCityInput: 'weather-city-input',

    // 天气设置面板
    weatherSettingsBtn: 'weather-settings-btn',
    weatherSettingsPanel: 'weather-settings-panel',
    closeWeatherSettingsBtn: 'close-weather-settings-btn',
    saveWeatherSettingsBtn: 'save-weather-settings-btn',
    weatherCityInputPanel: 'weather-city-input-panel',
    weatherUnitSelect: 'weather-unit-select',

    // 壁纸
    wallpaperContainer: 'wallpaper',
    changeWallpaperBtn: 'change-wallpaper-btn',
    wallpaperSettingsBtn: 'wallpaper-settings-btn',
    wallpaperPanel: 'wallpaper-panel',
    wallpaperSearchInput: 'wallpaper-search-input',
    wallpaperSearchBtn: 'wallpaper-search-btn',
    wallpaperGrid: 'wallpaper-grid',
    wallpaperLoading: 'wallpaper-loading',
    paginationButtons: 'pagination-buttons',
    totalResultsInfo: 'total-results-info',
    jumpToPageInput: 'jump-to-page-input',
    closeWallpaperPanelBtn: 'close-wallpaper-panel-btn',
    wallpaperCategoriesSidebar: 'wallpaper-categories-sidebar',

    // 搜索
    searchInput: 'search-input',
    searchEngineSelector: 'search-engine-selector',
    selectedEngine: 'selected-engine',
    searchEngineDropdown: 'search-engine-dropdown',
    searchSubmitBtn: 'search-submit-btn',
    clearSearchBtn: 'clear-search-btn',
    searchHistoryDropdown: 'search-history-dropdown',
    historyItemsContainer: 'history-items-container',
    clearHistoryContainer: 'clear-history-container',
    clearAllHistoryBtn: 'clear-all-history-btn',

    // 快捷访问（QA）
    quickAccessGrid: 'quick-access-grid',
    addQuickAccessPanel: 'add-quick-access-panel',
    qaUrlInput: 'qa-url-input',
    qaNameInput: 'qa-name-input',
    qaIconInput: 'qa-icon-input',
    saveQaBtn: 'save-qa-btn',
    cancelQaBtn: 'cancel-qa-btn',
    qaUrlError: 'qa-url-error',
    qaNameError: 'qa-name-error',
    qaIconPreviewContainer: 'qa-icon-preview-container',
    qaIconPreview: 'qa-icon-preview',
    qaPanelTitle: 'qa-panel-title',
    qaEditIndexInput: 'qa-edit-index',

    // 删除确认弹窗
    deleteConfirmModal: 'delete-confirm-modal',
    deleteConfirmText: 'delete-confirm-text',
    deleteConfirmDelete: 'delete-confirm-delete',
    deleteConfirmCancel: 'delete-confirm-cancel',

    // 时钟 / 问候 / 标语
    clockTime: 'clock-time',
    clockDate: 'clock-date',
    clockGreeting: 'clock-greeting',
    tagline: 'tagline',

    // 工具栏：待办 / 便签 / 番茄钟
    todoBtn: 'todo-btn',
    todoPanel: 'todo-panel',
    closeTodoBtn: 'close-todo-btn',
    todoFilterBar: 'todo-filter-bar',
    todoInput: 'todo-input',
    todoAddBtn: 'todo-add-btn',
    todoImportantBtn: 'todo-important-btn',
    todoCategorySelect: 'todo-category-select',
    todoDueDateInput: 'todo-due-date',
    todoList: 'todo-list',
    todoCount: 'todo-count',
    todoClearDoneBtn: 'todo-clear-done-btn',

    notesBtn: 'notes-btn',
    notesPanel: 'notes-panel',
    closeNotesBtn: 'close-notes-btn',
    notesSearchInput: 'notes-search-input',
    notesAddBtn: 'notes-add-btn',
    notesList: 'notes-list',
    notesMeta: 'notes-meta',

    pomodoroBtn: 'pomodoro-btn',
    pomodoroPanel: 'pomodoro-panel',
    closePomodoroBtn: 'close-pomodoro-btn',
    pomodoroRingProgress: 'pomodoro-ring-progress',
    pomodoroDisplay: 'pomodoro-display',
    pomodoroState: 'pomodoro-state',
    pomodoroTodayCount: 'pomodoro-today-count',
    pomodoroRounds: 'pomodoro-rounds',
    pomodoroStartBtn: 'pomodoro-start-btn',
    pomodoroSkipBtn: 'pomodoro-skip-btn',
    pomodoroResetBtn: 'pomodoro-reset-btn',
    pomodoroSettingsToggle: 'pomodoro-settings-toggle',
    pomodoroSettingsBox: 'pomodoro-settings-box',
    pomodoroWorkInput: 'pomodoro-work-input',
    pomodoroBreakInput: 'pomodoro-break-input',
    pomodoroLongBreakInput: 'pomodoro-long-break-input',
    pomodoroRoundsInput: 'pomodoro-rounds-input',

    // 主页常驻小组件（左右两翼）
    sideWidgets: 'side-widgets',
    sideWidgetsRight: 'side-widgets-right',
    showSideWidgetsToggle: 'show-side-widgets-toggle',
    wallpaperSourceOptions: 'wallpaper-source-options',
    todoCardBadge: 'todo-card-badge',
    todoCardInput: 'todo-card-input',
    todoCardList: 'todo-card-list',
    todoCardExpand: 'todo-card-expand',
    notesCardBadge: 'notes-card-badge',
    notesCardList: 'notes-card-list',
    notesCardExpand: 'notes-card-expand',
    pomodoroCardRing: 'pomodoro-card-ring',
    pomodoroCardTime: 'pomodoro-card-time',
    pomodoroCardState: 'pomodoro-card-state',
    pomodoroCardToday: 'pomodoro-card-today',
    pomodoroCardStart: 'pomodoro-card-start',
    pomodoroCardSkip: 'pomodoro-card-skip',
    pomodoroCardExpand: 'pomodoro-card-expand',

    // 设置面板：自定义搜索引擎 / 壁纸调节 / 标语
    customEngineNameInput: 'custom-engine-name-input',
    customEngineUrlInput: 'custom-engine-url-input',
    customEngineAddBtn: 'custom-engine-add-btn',
    customEngineList: 'custom-engine-list',
    wallpaperBrightnessInput: 'wallpaper-brightness-input',
    wallpaperBlurInput: 'wallpaper-blur-input',
    brightnessValue: 'brightness-value',
    blurValue: 'blur-value',
    taglineInput: 'tagline-input',
};

// 供非模块脚本访问

window.SELECTORS = SELECTORS;
