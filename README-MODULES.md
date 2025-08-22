# 新标签页扩展 - 模块化架构说明

## 🏗️ 架构概述

本项目已重构为模块化架构，将原本的单一 `main.js` 文件拆分为多个功能模块，提高了代码的可维护性、可测试性和可扩展性。

## 📁 文件结构

```
js/
├── modules/                    # 功能模块目录
│   ├── wallpaper-manager.js    # 壁纸管理模块
│   ├── search-manager.js       # 搜索功能模块
│   ├── quick-access-manager.js # 快捷访问管理模块
│   └── settings-manager.js     # 设置管理模块
├── components/                 # 组件目录
│   └── advanced-pagination.js  # 分页组件
│   └── sortable.min.js         # 拖拽组件
├── app.js                      # 主应用类
└── main.js                     # 入口文件（已简化）
```

## 🔧 模块说明

### 1. WallpaperManager (壁纸管理模块)
- **职责**: 管理壁纸的加载、搜索、分类
- **功能**: 
  - 加载默认壁纸
  - 搜索Pexels壁纸
  - 管理壁纸分类
  - 设置当前壁纸

### 2. SearchManager (搜索管理模块)
- **职责**: 管理搜索引擎和搜索功能
- **功能**:
  - 搜索引擎切换
  - 搜索历史管理
  - 执行搜索操作

### 3. QuickAccessManager (快捷访问管理模块)
- **职责**: 管理快捷访问项目
- **功能**:
  - 增删改查快捷访问
  - 数据持久化
  - 与分页组件集成

### 4. SettingsManager (设置管理模块)
- **职责**: 管理应用设置
- **功能**:
  - 设置加载/保存
  - 默认设置管理
  - 设置验证

### 5. NewTabApp (主应用类)
- **职责**: 整合所有模块，提供统一接口
- **功能**:
  - 模块初始化
  - 事件绑定
  - UI渲染协调

## 🚀 使用方法

### 基本使用
```javascript
// 创建应用实例
const app = new NewTabApp();

// 初始化应用
await app.init();

// 获取应用状态
const status = app.getStatus();
```

### 模块访问
```javascript
// 访问壁纸管理器
const wallpaperManager = app.wallpaperManager;
await wallpaperManager.searchWallpapers('Nature');

// 访问搜索管理器
const searchManager = app.searchManager;
searchManager.performSearch('搜索内容');

// 访问快捷访问管理器
const quickAccessManager = app.quickAccessManager;
await quickAccessManager.addSite('网站名', 'https://example.com', '图标');
```

## 🔄 迁移指南

### 从旧版本迁移
1. **保留现有功能**: 所有原有功能都已保留
2. **渐进式迁移**: 可以逐步将功能迁移到新模块
3. **向后兼容**: 旧的 `main.js` 代码仍然可以工作

### 添加新功能
1. **创建新模块**: 在 `js/modules/` 目录下创建新文件
2. **实现模块类**: 遵循现有的模块结构
3. **集成到主应用**: 在 `NewTabApp` 中初始化和使用

## 📝 开发规范

### 模块命名
- 文件名: `kebab-case` (如: `wallpaper-manager.js`)
- 类名: `PascalCase` (如: `WallpaperManager`)
- 方法名: `camelCase` (如: `searchWallpapers`)

### 模块结构
```javascript
class ModuleName {
    constructor() {
        // 初始化属性
    }

    // 公共方法
    async init() {
        // 初始化逻辑
    }

    // 私有方法（以下划线开头）
    _privateMethod() {
        // 私有逻辑
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModuleName;
} else {
    window.ModuleName = ModuleName;
}
```

### 错误处理
- 使用 `try-catch` 包装异步操作
- 提供有意义的错误信息
- 记录错误到控制台

## 🧪 测试

### 单元测试
每个模块都可以独立测试：
```javascript
// 测试壁纸管理器
const wallpaperManager = new WallpaperManager();
const result = await wallpaperManager.searchWallpapers('test');
console.assert(result.wallpapers.length >= 0);
```

### 集成测试
测试模块间的协作：
```javascript
const app = new NewTabApp();
await app.init();
const status = app.getStatus();
console.assert(status.isInitialized === true);
```

## 🔮 未来规划

### 计划中的改进
1. **TypeScript支持**: 添加类型定义
2. **单元测试框架**: 集成Jest或Mocha
3. **状态管理**: 引入更强大的状态管理
4. **插件系统**: 支持第三方插件

### 扩展性
- 新功能可以轻松添加为新模块
- 现有模块可以独立更新
- 支持模块的热插拔

## 📚 相关文档

- [Chrome扩展开发指南](https://developer.chrome.com/docs/extensions/)
- [模块化JavaScript最佳实践](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [异步编程指南](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Asynchronous)

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支
3. 遵循现有代码风格
4. 添加必要的测试
5. 提交 Pull Request

---

**注意**: 这是重构后的新架构，如果遇到问题，请检查浏览器控制台的错误信息，或回退到之前的版本。
