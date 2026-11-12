// 通用：为输入框绑定可见性切换按钮
/* 用内联 SVG 而不是 emoji：🙈/👁️ 是彩色字形，对比度不可控（实测浅色面板上 3.1:1，
   连"这是个按钮"都看不出来），也不跟随 currentColor。SVG 走 stroke: currentColor，
   和 text-primary 一起受主题控制。 */
const EYE = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M1.8 12S5.6 5.5 12 5.5 22.2 12 22.2 12 18.4 18.5 12 18.5 1.8 12 1.8 12Z"/><circle cx="12" cy="12" r="3.2"/></svg>`;
const EYE_OFF = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 3l18 18"/><path d="M10.6 6.2A9.9 9.9 0 0 1 12 6.1c6.4 0 10.2 5.9 10.2 5.9a17.4 17.4 0 0 1-3.6 4.1"/><path d="M6.3 7.5A17.6 17.6 0 0 0 1.8 12s3.8 5.9 10.2 5.9c1.5 0 2.9-.3 4.2-.9"/><path d="M9.9 14.1a3.2 3.2 0 0 0 4.2-4.2"/></svg>`;

export function initVisibilityToggle(inputEl, btnEl, { initialHidden = true, icons } = {}) {
    if (!inputEl || !btnEl) return;
    const eye = icons?.eye || EYE;
    const eyeOff = icons?.eyeOff || EYE_OFF;
    const sync = () => {
        const hidden = inputEl.type === 'password';
        btnEl.innerHTML = hidden ? eyeOff : eye;
        const label = hidden ? '显示密钥' : '隐藏密钥';
        btnEl.setAttribute('aria-label', label);
        btnEl.setAttribute('title', label);
        btnEl.setAttribute('aria-pressed', String(!hidden));
        btnEl.type = 'button';
    };
    inputEl.type = initialHidden ? 'password' : 'text';
    sync();
    btnEl.addEventListener('click', () => {
        const hidden = inputEl.type === 'password';
        inputEl.type = hidden ? 'text' : 'password';
        sync();
    });
}
