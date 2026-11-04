/**
 * 小工具定义（纯前端、零依赖、零网络）
 * kind: 'transform' 输入 → 输出；'generate' 一键生成
 * run(input) 返回 string（transform 可为 async）
 * 由 app.js 渲染为工具宫格与工具面板，不持有 DOM。
 */
(function () {
    // ---------- 工具函数 ----------

    const pad = n => String(n).padStart(2, '0');

    const formatDate = (date, withMs) => {
        const base =
            `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
            `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
        return withMs ? `${base}.${String(date.getMilliseconds()).padStart(3, '0')}` : base;
    };

    const toCamel = s =>
        s
            .trim()
            .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
            .replace(/^(.)/, c => c.toLowerCase());

    const toSnake = s =>
        s
            .trim()
            .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
            .replace(/[-\s]+/g, '_')
            .toLowerCase();

    const hex2rgb = hex => {
        const v = hex.replace('#', '');
        const full =
            v.length === 3
                ? v
                      .split('')
                      .map(c => c + c)
                      .join('')
                : v;
        if (!/^[0-9a-f]{6}$/i.test(full)) return null;
        return {
            r: parseInt(full.slice(0, 2), 16),
            g: parseInt(full.slice(2, 4), 16),
            b: parseInt(full.slice(4, 6), 16),
        };
    };

    const rgb2hsl = ({ r, g, b }) => {
        const rr = r / 255,
            gg = g / 255,
            bb = b / 255;
        const max = Math.max(rr, gg, bb),
            min = Math.min(rr, gg, bb);
        let h = 0,
            s = 0;
        const l = (max + min) / 2;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6;
            else if (max === gg) h = ((bb - rr) / d + 2) / 6;
            else h = ((rr - gg) / d + 4) / 6;
        }
        return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
    };

    const uuid = () =>
        typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                  const r = crypto.getRandomValues(new Uint8Array(1))[0] % 16 | 0;
                  const v = c === 'x' ? r : (r & 0x3) | 0x8;
                  return v.toString(16);
              });

    const randomPassword = () => {
        const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*-_=+?';
        const bytes = crypto.getRandomValues(new Uint8Array(20));
        return [...bytes].map(b => chars[b % chars.length]).join('');
    };

    const sha256 = async text => {
        const data = new TextEncoder().encode(text);
        const buf = await crypto.subtle.digest('SHA-256', data);
        return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    };

    // ---------- 工具定义 ----------

    window.QUICK_TOOLS = [
        {
            id: 'timestamp',
            name: '时间戳',
            icon: '⏱',
            desc: '时间戳 ⇄ 日期时间',
            placeholder: '输入 Unix 时间戳（秒/毫秒）或 2026-01-01 12:00:00',
            kind: 'transform',
            run(input) {
                const t = input.trim();
                if (!t) return '';
                if (/^\d{10,13}$/.test(t)) {
                    const ms = t.length === 13 ? Number(t) : Number(t) * 1000;
                    const d = new Date(ms);
                    return `${formatDate(d, true)}\n本地: ${d.toString()}\nISO: ${d.toISOString()}`;
                }
                const d = new Date(t.replace(/-/g, '/'));
                if (isNaN(d.getTime())) return '无法识别的时间格式';
                return `秒: ${Math.floor(d.getTime() / 1000)}\n毫秒: ${d.getTime()}\nISO: ${d.toISOString()}`;
            },
        },
        {
            id: 'json',
            name: 'JSON',
            icon: '{}',
            desc: '格式化 / 压缩 / 校验',
            placeholder: '{"a":1,"b":[2,3]}',
            kind: 'transform',
            run(input) {
                const t = input.trim();
                if (!t) return '';
                try {
                    const obj = JSON.parse(t);
                    return JSON.stringify(obj, null, 2);
                } catch (e) {
                    return `JSON 解析失败: ${e.message}`;
                }
            },
        },
        {
            id: 'base64',
            name: 'Base64',
            icon: '🔐',
            desc: '编码 / 解码',
            placeholder: '文本或 Base64 字符串',
            kind: 'transform',
            run(input) {
                if (!input) return '';
                try {
                    // 能按 UTF-8 解码出可打印内容 → 视为 Base64 串进行解码
                    const bin = atob(input.trim());
                    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
                    const decoded = new TextDecoder().decode(bytes);
                    if (/[\u0000-\u0008\u000e-\u001f]/.test(decoded)) throw new Error('binary');
                    return decoded;
                } catch {
                    const bytes = new TextEncoder().encode(input);
                    let bin = '';
                    bytes.forEach(b => (bin += String.fromCharCode(b)));
                    return btoa(bin);
                }
            },
        },
        {
            id: 'url',
            name: 'URL',
            icon: '🔗',
            desc: '编码 / 解码',
            placeholder: '带空格或 %E4%BD%A0 的链接/文本',
            kind: 'transform',
            run(input) {
                if (!input) return '';
                try {
                    if (/%[0-9a-f]{2}/i.test(input)) return decodeURIComponent(input);
                } catch {
                    /* 非法编码序列则走编码分支 */
                }
                return encodeURIComponent(input);
            },
        },
        {
            id: 'hash',
            name: 'SHA-256',
            icon: '#',
            desc: '文本哈希摘要',
            placeholder: '输入任意文本',
            kind: 'transform',
            run: sha256,
        },
        {
            id: 'radix',
            name: '进制',
            icon: '🔢',
            desc: '二进制 / 八进制 / 十进制 / 十六进制',
            placeholder: '42、0x2A、0b101010、0o52',
            kind: 'transform',
            run(input) {
                const t = input.trim().toLowerCase().replace(/_/g, '');
                if (!t) return '';
                let n = NaN;
                if (/^0x[0-9a-f]+$/.test(t)) n = parseInt(t.slice(2), 16);
                else if (/^0b[01]+$/.test(t)) n = parseInt(t.slice(2), 2);
                else if (/^0o[0-7]+$/.test(t)) n = parseInt(t.slice(2), 8);
                else if (/^-?\d+$/.test(t)) n = parseInt(t, 10);
                if (isNaN(n)) return '无法识别的数字格式';
                return `十进制: ${n}\n十六进制: 0x${n.toString(16).toUpperCase()}\n八进制: 0o${n.toString(8)}\n二进制: 0b${n.toString(2)}`;
            },
        },
        {
            id: 'case',
            name: '大小写',
            icon: 'Aa',
            desc: '大小写 / 驼峰 / 下划线',
            placeholder: 'hello world / user_name / userName',
            kind: 'transform',
            run(input) {
                const t = input.trim();
                if (!t) return '';
                return [
                    `大写: ${t.toUpperCase()}`,
                    `小写: ${t.toLowerCase()}`,
                    `首字母大写: ${t.replace(/\b\w/g, c => c.toUpperCase())}`,
                    `驼峰: ${toCamel(t)}`,
                    `下划线: ${toSnake(t)}`,
                ].join('\n');
            },
        },
        {
            id: 'dedupe',
            name: '去重',
            icon: '🧹',
            desc: '按行去重并保留顺序',
            placeholder: '每行一条内容',
            kind: 'transform',
            run(input) {
                if (!input) return '';
                const lines = input.split('\n');
                const seen = new Set();
                const out = lines.filter(line => {
                    const key = line.trim();
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
                return `去重后 ${out.length} / ${lines.length} 行\n\n${out.join('\n')}`;
            },
        },
        {
            id: 'wordcount',
            name: '字数',
            icon: '🔤',
            desc: '字符 / 词 / 行统计',
            placeholder: '粘贴文本',
            kind: 'transform',
            run(input) {
                if (!input) return '字符: 0';
                const chars = [...input].length;
                const noSpace = [...input.replace(/\s/g, '')].length;
                const words = (input.match(/[A-Za-z0-9]+|[\u4e00-\u9fa5]/g) || []).length;
                const lines = input.split('\n').length;
                return `字符: ${chars}\n不含空白: ${noSpace}\n词/汉字: ${words}\n行数: ${lines}`;
            },
        },
        {
            id: 'color',
            name: '颜色',
            icon: '🎨',
            desc: 'HEX ⇄ RGB ⇄ HSL',
            placeholder: '#4EC2C6 或 rgb(78,194,198)',
            kind: 'transform',
            run(input) {
                const t = input.trim();
                if (!t) return '';
                let rgb = null;
                if (t.startsWith('#')) rgb = hex2rgb(t);
                else {
                    const m = t.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
                    if (m) rgb = { r: +m[1], g: +m[2], b: +m[3] };
                }
                if (!rgb) return '支持 #4EC2C6 或 rgb(78,194,198)';
                const hex =
                    '#' +
                    [rgb.r, rgb.g, rgb.b]
                        .map(v => v.toString(16).padStart(2, '0'))
                        .join('')
                        .toUpperCase();
                const hsl = rgb2hsl(rgb);
                return `HEX: ${hex}\nRGB: rgb(${rgb.r}, ${rgb.g}, ${rgb.b})\nHSL: hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
            },
        },
        {
            id: 'password',
            name: '密码',
            icon: '🔑',
            desc: '生成 20 位强密码',
            placeholder: '点「生成」得到随机强密码',
            kind: 'generate',
            action: randomPassword,
        },
        {
            id: 'uuid',
            name: 'UUID',
            icon: '🆔',
            desc: '生成 UUID v4',
            placeholder: '点「生成」得到 UUID',
            kind: 'generate',
            action: uuid,
        },
    ];

    // 主页右翼卡片展示的常用工具（按顺序取前 6 个）
    window.QUICK_TOOLS_FEATURED = ['timestamp', 'json', 'base64', 'url', 'hash', 'color'];
})();
