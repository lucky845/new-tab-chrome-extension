// 天气图标与中文现象映射模块

export function getIconTypeForAmap(desc) {
    const text = (desc || '').trim();
    if (!text) return 'unknown';
    if (text.includes('晴间多云') || text.includes('少云')) return 'cloudy-sunny';
    if (text.includes('晴')) return 'sunny';
    if (text.includes('多云') || text.includes('阴')) return 'cloudy';
    if (text.includes('特大暴雨') || text.includes('极端降雨')) return 'heavy-rain';
    if (text.includes('大暴雨') || text.includes('暴雨-大暴雨')) return 'heavy-rain';
    if (text.includes('暴雨') || text.includes('大雨-暴雨')) return 'heavy-rain';
    if (text.includes('大雨')) return 'heavy-rain';
    if (text.includes('中雨-大雨')) return 'rain';
    if (text.includes('小雨-中雨')) return 'rain';
    if (text.includes('中雨')) return 'rain';
    if (text.includes('毛毛雨') || text.includes('细雨') || text.includes('小雨')) return 'rain';
    if (text.includes('冻雨') || text.includes('雨夹雪') || text.includes('阵雨夹雪'))
        return 'snow';
    if (text.includes('阵雨')) return 'rain';
    if (text.includes('雷阵雨并伴有冰雹')) return 'thunderstorm';
    if (text.includes('强雷阵雨') || text.includes('雷阵雨')) return 'thunderstorm';
    if (text.includes('雷')) return 'thunderstorm';
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
    if (text.includes('风') || text.includes('飓风') || text.includes('热带风暴')) return 'cloudy';
    return 'unknown';
}

export function getWeatherIconSvg(iconType) {
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
