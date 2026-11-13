/**
 * 天气配置文件
 * 请替换为您的高德地图(AMap) Web服务 API Key
 */

const WEATHER_CONFIG = {
    // 高德地图 Web服务 API Key - 前往 https://lbs.amap.com/ 申请（可选：留空则使用 Open-Meteo 免费天气，无需密钥）
    API_KEY: '',

    // API基础URL
    BASE_URL: 'https://restapi.amap.com/v3',

    // 默认设置
    DEFAULT_UNIT: 'celsius', // 仍保留前端显示单位切换
    DEFAULT_LANG: 'zh_cn', // 暂无作用，兼容保留

    // 更新间隔（毫秒）
    UPDATE_INTERVAL: 30 * 60 * 1000, // 30分钟

    // 地理位置超时设置
    GEOLOCATION_TIMEOUT: 5000, // 5秒（增加超时时间）
    GEOLOCATION_MAX_AGE: 5 * 60 * 1000, // 5分钟缓存

    // 本地缓存与限流
    WEATHER_CACHE_TTL: 20 * 60 * 1000, // 天气缓存有效期20分钟（有效期内直接复用，不发请求）
    WEATHER_CACHE_MAX_AGE: 24 * 60 * 60 * 1000, // 过期缓存最多还能顶多久（超过则不再显示、改为报错）
    ADCODE_CACHE_TTL: 24 * 60 * 60 * 1000, // 行政区编码缓存1天
    MIN_REQUEST_INTERVAL: 10 * 1000, // 最短请求间隔，防抖

    // 天气图标映射
    ICON_MAPPING: {
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
    },
};

// 导出配置
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WEATHER_CONFIG;
} else {
    window.WEATHER_CONFIG = WEATHER_CONFIG;
}
