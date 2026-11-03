/**
 * 番茄专注钟管理模块
 * 计时域唯一业务归属：工作/休息状态机 + 秒级计时 + 阶段完成回调。
 * UI 渲染由 app.js 完成；页面关闭计时自然终止（会话级，不持久化）。
 */
class PomodoroManager {
    constructor() {
        this.WORK_MINUTES = 25;
        this.BREAK_MINUTES = 5;
        this.state = 'idle'; // idle | working | resting | paused
        this.remainingSeconds = this.WORK_MINUTES * 60;
        this.timerId = null;
        this.onTick = null; // (remainingSeconds) => void
        this.onPhaseComplete = null; // (nextPhase: 'work'|'break') => void
    }

    // 阶段总时长（秒）
    getPhaseTotalSeconds() {
        return (this.state === 'resting' ? this.BREAK_MINUTES : this.WORK_MINUTES) * 60;
    }

    // 开始 / 继续
    start() {
        if (this.state === 'working' || this.state === 'resting') return;
        if (this.state === 'paused') {
            this.state = this.pausedFrom; // 恢复到暂停前的阶段
        } else if (this.state === 'idle') {
            this.state = 'working';
            this.remainingSeconds = this.WORK_MINUTES * 60;
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
        this.remainingSeconds = this.WORK_MINUTES * 60;
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
        const finished = this.state; // working | resting
        if (finished === 'working') {
            this.state = 'resting';
            this.remainingSeconds = this.BREAK_MINUTES * 60;
        } else {
            this.state = 'idle';
            this.remainingSeconds = this.WORK_MINUTES * 60;
        }
        this.emitTick();
        if (typeof this.onPhaseComplete === 'function') {
            this.onPhaseComplete(finished === 'working' ? 'break' : 'work');
        }
    }

    emitTick() {
        if (typeof this.onTick === 'function') {
            this.onTick(this.remainingSeconds, this.state);
        }
    }

    // 格式化 mm:ss
    format(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    getStateLabel() {
        switch (this.state) {
            case 'working':
                return '专注中';
            case 'resting':
                return '休息中';
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
            remainingSeconds: this.remainingSeconds,
            running: this.isRunning(),
        };
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PomodoroManager;
} else {
    window.PomodoroManager = PomodoroManager;
}
