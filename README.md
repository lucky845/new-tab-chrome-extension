# New Tab Pro - 智能新标签页管理器

![插件截图](img/preview.png)

**New Tab Pro** 是一款新标签页扩展，它将新标签页转变为一个简洁高效的个人工作台：现代化 UI、壁纸管理、多引擎搜索与快捷方式管理，并支持天气信息。

## 🚀 核心功能

### 🌟 壁纸

- 必应每日图（默认）与 Pexels 搜索
- 记忆偏好与已选壁纸缓存
- 分类与分页浏览

### 🔍 搜索

- 百度、谷歌、必应、搜狗、DuckDuckGo 一键切换
- 搜索历史（点击填充、清空历史、单项删除）

### 🎯 快捷方式

- 每页 10 个（9 项 + 1 个添加按钮），统一尺寸布局
- 支持拖拽排序（同页内），右键编辑/删除
- 分页仅单次 DOM 更新，交互更流畅

### 🌤️ 天气（高德 AMap）

- 自动定位或手动城市（城市名称会转换为 adcode）
- 缓存与限流：adcode 缓存、天气数据 TTL、最小请求间隔
- 统一请求封装：超时、重试（指数退避）、错误解析
- 中文天气现象 → 内置 SVG 图标

## ⚙️ 配置与权限

- 在设置面板中填写：
    - Pexels API Key（可选）
    - 高德（AMap）Weather Key（必填以启用天气）与城市（可留空表示自动定位）
- `manifest.json` 权限：
    - `geolocation`（定位）
    - `host_permissions`: `https://restapi.amap.com/`
- CSP：图标来自站点 favicon，已放宽 `img-src * data:` 以兼容更多来源。

## 🧱 架构与规范

- 模块化：详见 `README-MODULES.md`
    - `SettingsManager` 统一配置读写与迁移旧键
    - `WeatherManager` 使用 `utils/request.js` 与 `config/weather-config.js`
    - 选择器常量：`constants/selectors.js`（统一 `window.SELECTORS`）
    - 天气图标与可见性切换：`components/weather-icons.js`、`components/visibility-toggle.js`
- 代码质量：
    - Lint/Format：`npm run lint`、`npm run format`
    - EditorConfig：统一缩进/换行

## 📦 安装与使用

### 从商店安装（Edge）

1. 打开 Edge 插件商店
2. 搜索 “New Tab Pro” 并安装
3. 打开新标签页体验

### 本地加载

1. 克隆仓库并打开扩展管理页面
2. 开启“开发者模式”
3. 选择“加载已解压的扩展程序”，指向项目目录

## 🔧 进阶

### 壁纸缓存验证

1. 设置 Pexels API Key
2. 选择壁纸并刷新新标签页
3. 观察无闪烁加载与持久化效果

### 快捷方式

1. 点击“添加”填写信息
2. 拖拽排序（同页内）
3. 右键编辑/删除

## 开发

安装开发工具并执行检查/格式化：

```bash
npm install
npm run lint
npm run format
```

ESLint 已按浏览器扩展场景配置，内置识别 `chrome`、`Sortable` 等全局对象。

## 🤝 贡献

- 提交 Issue 与 PR 前，请先运行 `npm run lint` 确保无警告
- 遵循模块化与选择器常量化规范

## 📄 协议

- MIT License

## 🔮 计划

- [ ] 更多壁纸源
- [ ] 可选的多主题与同步
- [ ] 单元测试与类型化支持（TS）

---

New Tab Pro - 重新定义你的新标签页
