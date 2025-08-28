// 通用：为输入框绑定可见性切换按钮
export function initVisibilityToggle(inputEl, btnEl, { initialHidden = true, icons } = {}) {
    if (!inputEl || !btnEl) return;
    const eye = icons?.eye || '👁️';
    const eyeOff = icons?.eyeOff || '🙈';
    inputEl.type = initialHidden ? 'password' : 'text';
    btnEl.innerHTML = initialHidden ? eyeOff : eye;
    btnEl.addEventListener('click', () => {
        const hidden = inputEl.type === 'password';
        inputEl.type = hidden ? 'text' : 'password';
        btnEl.innerHTML = hidden ? eye : eyeOff;
    });
}
