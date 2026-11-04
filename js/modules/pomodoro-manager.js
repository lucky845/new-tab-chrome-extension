/**
 * 番茄专注钟管理模块（产品级）
 * 计时域唯一业务归属：工作/休息状态机 + 可配置时长 + 长休息轮转 + 秒级计时 + 轮次统计持久化。
 * UI 渲染由 app.js 完成；声音提示与标题联动由 app.js 通过回调/方法实现。
 * 持久化：
 *   pomodoroSettings: { workMinutes, breakMinutes, longBreakMinutes, roundsBeforeLongBreak }
 *   pomodoroStats:    { date: 'YYYY-MM-DD', cycleCount, completedToday, totalAllTime }
 *   （会话计时本身不持久化，页面关闭即终止；轮转计数与统计跨会话保留）
 */
class PomodoroManager {
    constructor() {
        this.settings = {
            workMinutes: 25,
            breakMinutes: 5,
            longBreakMinutes: 15,
            roundsBeforeLongBreak: 4,
        };
        this.stats = { date: '', cycleCount: 0, completedToday: 0, totalAllTime: 0 };
        this.settingsKey = 'pomodoroSettings';
        this.statsKey = 'pomodoroStats';

        this.state = 'idle'; // idle | working | resting | paused
        this.phaseType = 'work'; // work | break | longBreak
        this.remainingSeconds = this.settings.workMinutes * 60;
        this.timerId = null;
        this.onTick = null; // (remainingSeconds, state, phaseType) => void
        this.onPhaseComplete = null; // (nextPhase: 'break'|'longBreak'|'work') => void
        this.onStatsChanged = null; // (stats) => void
    }

    async init() {
        const result = await chrome.storage.local.get([this.settingsKey, this.statsKey]);
        const savedSettings = result[this.settingsKey];
        if (savedSettings && typeof savedSettings === 'object') {
            this.settings = {
                ...this.settings,
                ...PomodoroManager.sanitizeSettings(savedSettings),
            };
        }
        const savedStats = result[this.statsKey];
        if (savedStats && typeof savedStats === 'object') {
            this.stats = {
                ...this.stats,
                ...savedStats,
            };
        }
        // 跨日重置今日轮次
        const today = PomodoroManager.todayLabel();
        if (this.stats.date !== today) {
            this.stats.date = today;
            this.stats.cycleCount = 0;
            this.stats.completedToday = 0;
            await this.saveStats();
        }
        if (this.state === 'idle') {
            this.remainingSeconds = this.settings.workMinutes * 60;
        }
        return this.getCurrentState();
    }

    static sanitizeSettings(raw) {
        const clampMinutes = v => {
            const n = Math.round(Number(v));
            return Number.isFinite(n) ? Math.min(180, Math.max(1, n)) : null;
        };
        const out = {};
        if (clampMinutes(raw.workMinutes)) out.workMinutes = clampMinutes(raw.workMinutes);
        if (clampMinutes(raw.breakMinutes)) out.breakMinutes = clampMinutes(raw.breakMinutes);
        if (clampMinutes(raw.longBreakMinutes)) {
            out.longBreakMinutes = clampMinutes(raw.longBreakMinutes);
        }
        const rounds = Math.round(Number(raw.roundsBeforeLongBreak));
        if (Number.isFinite(rounds)) {
            out.roundsBeforeLongBreak = Math.min(8, Math.max(2, rounds));
        }
        return out;
    }

    static todayLabel() {
        const d = new Date();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${d.getFullYear()}-${m}-${day}`;
    }

    async saveSettings() {
        await chrome.storage.local.set({ [this.settingsKey]: this.settings });
    }

    async saveStats() {
        await chrome.storage.local.set({ [this.statsKey]: this.stats });
    }

    // 更新设置（运行中修改：空闲阶段立即生效；进行中阶段保持当前时长，下一阶段生效）
    async setSettings(partial) {
        const next = PomodoroManager.sanitizeSettings({ ...this.settings, ...partial });
        this.settings = { ...this.settings, ...next };
        await this.saveSettings();
        if (this.state === 'idle') {
            this.phaseType = 'work';
            this.remainingSeconds = this.settings.workMinutes * 60;
            this.emitTick();
        }
        return this.settings;
    }

    getSettings() {
        return { ...this.settings };
    }

    getStats() {
        return { ...this.stats };
    }

    // 阶段总时长（秒）
    getPhaseTotalSeconds() {
        if (this.phaseType === 'break') return this.settings.breakMinutes * 60;
        if (this.phaseType === 'longBreak') return this.settings.longBreakMinutes * 60;
        return this.settings.workMinutes * 60;
    }

    // 开始 / 继续
    start() {
        if (this.state === 'working' || this.state === 'resting') return;
        if (this.state === 'paused') {
            this.state = this.pausedFrom; // 恢复到暂停前的阶段
        } else if (this.state === 'idle') {
            this.phaseType = 'work';
            this.state = 'working';
            this.remainingSeconds = this.settings.workMinutes * 60;
        }
        this.tick();
        this.timerId = setInterval(() => this.tick(), 1000);
    }

    // 暂停
    pause() {
        if (this.state !== 'working' && this.state !== 'resting') return;
        this.pausedFrom = this.state;
        this.state = 'paused';
        clearInterval(this.timerId);
        this.timerId = null;
        this.emitTick();
    }

    // 重置回初始专注阶段
    reset() {
        clearInterval(this.timerId);
        this.timerId = null;
        this.state = 'idle';
        this.phaseType = 'work';
        this.remainingSeconds = this.settings.workMinutes * 60;
        this.emitTick();
    }

    // 跳过当前阶段（不计数，直接进入下一阶段）
    skipPhase() {
        if (this.state === 'idle') return;
        clearInterval(this.timerId);
        this.timerId = null;
        if (this.phaseType === 'work') {
            this.enterBreak(false); // 跳过专注不计数，进短休
        } else {
            this.state = 'idle';
            this.phaseType = 'work';
            this.remainingSeconds = this.settings.workMinutes * 60;
            this.notifyComplete('work');
        }
        this.emitTick();
    }

    tick() {
        this.remainingSeconds -= 1;
        if (this.remainingSeconds <= 0) {
            this.completePhase();
            return;
        }
        this.emitTick();
    }

    completePhase() {
        clearInterval(this.timerId);
        this.timerId = null;
        if (this.phaseType === 'work') {
            this.stats.cycleCount = (this.stats.cycleCount || 0) + 1;
            this.stats.completedToday = (this.stats.completedToday || 0) + 1;
            this.stats.totalAllTime = (this.stats.totalAllTime || 0) + 1;
            this.saveStats();
            if (typeof this.onStatsChanged === 'function') this.onStatsChanged(this.getStats());
            this.enterBreak(true);
        } else {
            this.state = 'idle';
            this.phaseType = 'work';
            this.remainingSeconds = this.settings.workMinutes * 60;
            this.notifyComplete('work');
        }
        this.emitTick();
    }

    // 进入休息阶段（counted 表示是否为完整专注轮）
    enterBreak(counted) {
        const longDue =
            counted &&
            this.settings.roundsBeforeLongBreak > 0 &&
            this.stats.cycleCount % this.settings.roundsBeforeLongBreak === 0;
        this.phaseType = longDue ? 'longBreak' : 'break';
        this.state = 'resting';
        this.remainingSeconds =
            (longDue ? this.settings.longBreakMinutes : this.settings.breakMinutes) * 60;
        this.notifyComplete(longDue ? 'longBreak' : 'break');
    }

    notifyComplete(nextPhase) {
        if (typeof this.onPhaseComplete === 'function') {
            this.onPhaseComplete(nextPhase);
        }
    }

    emitTick() {
        if (typeof this.onTick === 'function') {
            this.onTick(this.remainingSeconds, this.state, this.phaseType);
        }
    }

    // 格式化 mm:ss
    format(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    // 阶段与进度信息（供环形进度 UI）
    getProgress() {
        const total = this.getPhaseTotalSeconds();
        const progress = total > 0 ? 1 - this.remainingSeconds / total : 0;
        return {
            remaining: this.remainingSeconds,
            total,
            progress: Math.min(1, Math.max(0, progress)),
            phaseType: this.phaseType,
        };
    }

    getStateLabel() {
        switch (this.state) {
            case 'working':
                return '专注中';
            case 'resting':
                return this.phaseType === 'longBreak' ? '长休息中' : '休息中';
            case 'paused':
                return '已暂停';
            default:
                return '专注';
        }
    }

    isRunning() {
        return this.state === 'working' || this.state === 'resting';
    }

    // 状态查询（供 UI / getStatus）
    getCurrentState() {
        return {
            state: this.state,
            phaseType: this.phaseType,
            remainingSeconds: this.remainingSeconds,
            running: this.isRunning(),
            settings: this.getSettings(),
            stats: this.getStats(),
        };
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PomodoroManager;
} else {
    window.PomodoroManager = PomodoroManager;
}
