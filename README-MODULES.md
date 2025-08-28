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
│   ├── settings-manager.js     # 设置管理模块
│   └── weather-manager.js      # 天气管理模块（高德）
├── components/                 # 组件目录
│   ├── advanced-pagination.js  # 高级分页组件（单次 DOM 更新）
│   ├── visibility-toggle.js    # 通用密钥可见性切换
│   ├── weather-icons.js        # 天气图标映射与 SVG 生成
│   └── sortable.min.js         # 拖拽组件
├── config/
│   └── weather-config.js       # 天气相关常量（BASE_URL、TTL、限流等）
├── constants/
│   └── selectors.js            # 全局选择器与 ID 常量（window.SELECTORS）
├── utils/
│   └── request.js              # 统一请求封装（超时/重试/退避/错误解析）
├── app.js                      # 主应用类
└── main.js                     # 入口文件（已简化）
```

## 🔧 模块说明

### 1. WallpaperManager (壁纸管理模块)

- 职责: 管理壁纸的加载、搜索、分类
- 功能:
    - 加载默认壁纸
    - 搜索 Pexels 壁纸
    - 管理壁纸分类
    - 设置当前壁纸

### 2. SearchManager (搜索管理模块)

- 职责: 管理搜索引擎和搜索功能
- 功能:
    - 搜索引擎切换
    - 搜索历史管理（新增单项删除）
    - 执行搜索操作

### 3. QuickAccessManager (快捷访问管理模块)

- 职责: 管理快捷访问项目
- 功能:
    - 增删改查快捷访问
    - 数据持久化
    - 与高级分页组件集成（添加按钮始终为最后一个，禁拖拽）

### 4. SettingsManager (设置管理模块)

- 职责: 管理应用设置（统一的配置读写入口）
- 功能:
    - 设置加载/保存与默认值
    - Pexels/Gaode API Key、天气城市/单位 等配置

### 5. WeatherManager (天气管理模块)

- 职责: 集成高德（AMap）天气，展示与缓存天气
- 功能:
    - 城市名 -> adcode 转换（缓存 TTL）
    - 位置逆地理 -> adcode（含权限提示与超时提示）
    - 天气获取与格式化展示（中文现象映射）
    - 统一请求封装（`utils/request.js`），含超时、重试（指数退避）、错误解析、频率限制（`weather-config.js`）

### 6. AdvancedPagination (高级分页组件)

- 变化:
    - 固定每页 10 位：9 项 + 1 个“添加”按钮
    - 渲染合并：`setItems()` 仅触发一次 DOM 更新
    - 跨页拖拽旧逻辑移除，拖拽限制在当页

### 7. 其他组件/常量

- `components/visibility-toggle.js`: 通用“显示/隐藏密钥”组件，适配 Pexels/Gaode 输入框
- `components/weather-icons.js`: 将中文天气现象映射到内置 SVG
- `constants/selectors.js`: 中央化所有 dom id/选择器，统一经 `window.SELECTORS` 访问，减少魔法字符串
- `utils/request.js`: 统一 `fetchJSON(url, { timeout, retries, retryDelay, backoff })`
- `config/weather-config.js`: 天气 API BASE_URL、缓存 TTL、最小请求间隔等

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
const { wallpaperManager } = app;

// 访问搜索管理器
const { searchManager } = app;

// 访问快捷访问管理器
const { quickAccessManager } = app;

// 访问天气管理器
const { weatherManager } = app;
```

### 统一请求工具

```javascript
import { fetchJSON } from './js/utils/request.js';

const data = await fetchJSON('https://example.com/api', {
    timeout: 10000,
    retries: 2,
    retryDelay: 600,
    backoff: 2,
});
```

## 🔄 迁移指南

### 从旧版本迁移

1. 保留现有功能：原有功能已保留并模块化
2. 渐进式迁移：将散落在 `main.js` 的逻辑迁入对应模块
3. 选择器与配置：
    - DOM id/选择器统一使用 `window.SELECTORS`
    - 配置统一通过 `SettingsManager` 读写
    - 旧键已在启动时一次性迁移与清理

### 添加新功能

1. 创建新模块：在 `js/modules/` 目录下创建新文件
2. 实现模块类：遵循现有的模块结构
3. 集成到主应用：在 `NewTabApp` 中初始化和使用

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

## 🧪 质量与风格

- Lint/Format：项目内置 ESLint + Prettier 与 EditorConfig；执行 `npm run lint`、`npm run format`
- 请求规范：统一通过 `utils/request.js` 发起请求
- 选择器规范：统一通过 `window.SELECTORS` 访问 DOM

## 🔮 未来规划

- TypeScript 支持（类型定义与工具链）
- 单元测试框架（Jest 或 Mocha）
- 更完善的状态管理
- 插件式扩展能力

## 📚 相关文档

- [Chrome 扩展开发指南](https://developer.chrome.com/docs/extensions/)
- [MDN: ES Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [MDN: 异步编程](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Asynchronous)

---

如遇问题，请先检查浏览器控制台错误信息与 `manifest.json` 权限/主机权限配置，并确认已正确填写 API Key。
