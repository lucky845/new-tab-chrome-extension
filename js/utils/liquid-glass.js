/**
 * 液态玻璃（WebGL2 光学层）
 *
 * 实现取自 ybouane/liquidglass 组件源码（src/shaders.js + src/layout.js +
 * src/liquid-glass-navigation.js）的真实光学模型，按新标签页的实际排版改写：
 *
 *   · 圆角矩形 SDF 同时驱动折射、雾化与高光（三者共用 coverage，没有层间接缝）；
 *   · 每条路径两次 refract()：相机射线进入弧面法线 → 玻璃内传播 → 平面出口；
 *   · R/G/B 三个折射率 1.514 / 1.520 / 1.528，色散只在边缘出现；
 *   · 边缘反向位移（lensCurve）产生卷回，中心保持清晰；
 *   · 9 抽样高斯雾化，采样锚点先跟着折射走，模糊与折射无接缝；
 *   · 线性空间混色 + sRGB display pass；
 *   · 4 paths/pixel × 多帧 ping-pong 累积去噪。
 *
 * 与参考实现的两处必要差异（不是降级，是新标签页的约束）：
 *   1. 场景纹理不是「参考库那套重绘 DOM 的 Canvas2D」，而是壁纸图（同源 <img>/<canvas>）。
 *      新标签页玻璃背后只有壁纸，DOM 重绘得不到任何额外信息，纯属浪费。
 *   2. 几何按「每块元素自己的圆角」计算（uRadius uniform），而不是导航栏统一的胶囊。
 *
 * 没有 CSS 降级：WebGL2 不可用时什么都不做，元素保持现有 backdrop-filter 外观。
 */
(function () {
    'use strict';

    const REFERENCE = {
        // src/layout.js → LIQUID_GLASS_REFERENCE.material
        material: {
            reverseDisplacement: 2.19,
            edgeCurvature: 0.67,
            opticalThickness: 1.71,
            edgeBandRatio: 0.26,
            refractionVisibleRatio: 0.16,
            blendFeatherPx: 12,
            frostedStrength: 0.29,
            frostedAttenuation: 0.55,
            blurSpacingPx: 1.4,
            dispersionStrength: 0.22,
            // 边缘窄描边的强度。CSS 的 border 与 ::after 环在有光学层时已关掉，
            // 边缘光完全由这里给出（参考库口径：edgeHighlight 0.05，但它没有
            // 我们这层亮度压缩，玻璃本身反差更小，所以这里取 0.2 才够读出厚度）。
            highlightStrength: 0.9,
            // 边缘窄描边的绝对强度（与镜面高光解耦）。
            // 参考库 innerStroke = u_edgeHL * 0.55 ≈ 0.0275；这里取 0.03 ——
            // 有亮度压缩后玻璃反差变小，略提一点更清楚，但仍是一条边而非白线。
            edgeStroke: 0.08,
            // 深色玻璃（暗色主题）：中性黑灰，17% 混入把壁纸压下去一点
            tintColor: [0.035, 0.035, 0.045],
            // 0.17 → 0.62：深色主题用白字，玻璃必须自带足够深的底。
            // 实测 0.2 时白字对比度只有 2.83–3.63（不达 AA 4.5），
            // 0.65 到 4.74–5.68；取 0.62 留一点余量给不同壁纸。
            tintMix: 0.62,
            // 浅色玻璃（亮色主题）：参考库只在暗背景上当导航条用过，深色 tint
            // 放到白壁纸上会把玻璃压成灰玻璃。改成几乎纯白的微冷调 + 更高混入，
            // 玻璃才是"一块更亮的白色"，靠边缘折射与高光立起来而不是靠颜色。
            tintColorLight: [0.97, 0.975, 0.985],
            tintMixLight: 0.42,
        },
        // src/layout.js → LIQUID_GLASS_REFERENCE.optics
        optics: {
            refractiveIndices: { red: 1.514, green: 1.52, blue: 1.528 },
            roughness: 0.014,
            cameraRayScale: 0.045,
            minimumRayZ: 0.08,
            insideTravelBasePx: 6.0,
            insideTravelInteriorScale: 0.28,
            exitTravelBasePx: 6.5,
            reverseMaxPixels: 36,
            lensMix: 0.35,
            // 整块缓弯强度：0 即参考库原行为（只有边缘卷曲）。0.55 让中段折射位移
            // 达到边缘的一半，色块在玻璃下会有可见的"推挤"。
            bodyBend: 0.55,
            frostTintColor: [0.055, 0.062, 0.075],
            highlightAWidth: 0.22,
            highlightACenter: 0.22,
            highlightBWidth: 0.2,
            highlightBCenter: 1.78,
        },
        rendering: {
            // 4 → 2：抖动噪声在 2 条路径 + 12 帧累积下已经收敛到看不出颗粒
            // （实测 4 路径×48 帧要 1876ms 主线程，2 路径×12 帧只要 1/8）。
            pathsPerPixel: 2,
            // 48 → 12：时间累积的作用是抹平 per-pixel 抖动的随机噪声，
            // 前 12 帧已经把方差压到 1/13，再往下加帧肉眼无差。
            maxAccumulation: 12,
            maxDpr: 1.5,
        },
    };

    /**
     * 设备性能分级。
     *
     * 为什么需要：这块玻璃的光学层是「每块元素一个 canvas + 一次性跑满累积帧」，
     * 首屏成本随玻璃块数线性增长。弱机上这一段会明显吃掉主线程，表现为开新标签
     * 页先白屏一下。参数不能一套打天下：
     *
     *   high  桌面独显 / Apple Silicon   —— 完整效果
     *   mid   核显笔记本、近五年 CPU     —— 略降 DPR 与累积帧
     *   low   老机器、省电模式、4 核以下 —— 只留一层薄折射，几乎零额外开销
     *
     * 判定不靠 UA（不可靠），用三个可测信号：
     *   1) navigator.hardwareConcurrency（逻辑核数）
     *   2) navigator.deviceMemory（GB，Chrome 有）
     *   3) 启动时实测一次 rAF 帧间隔 —— 最直接，但要点时间，所以放在挂载后异步做，
     *      发现慢了再降级（rebuildTier），不影响首屏。
     */
    function detectTier() {
        const cores = navigator.hardwareConcurrency || 4;
        const mem = navigator.deviceMemory || 8;
        // 省电模式：明示用户想要省电，直接给最低档
        const saveData = navigator.connection && navigator.connection.saveData;
        if (saveData) return 'low';
        if (cores <= 4 || mem <= 4) return 'low';
        if (cores <= 8 || mem <= 8) return 'mid';
        return 'high';
    }

    const TIER_PRESETS = {
        high: { pathsPerPixel: 2, maxAccumulation: 12, maxDpr: 1.5 },
        mid: { pathsPerPixel: 2, maxAccumulation: 6, maxDpr: 1.25 },
        // 低档：1 条路径 + 3 帧。噪声靠 3 帧累积压住，画质略糙但几乎不占主线程。
        low: { pathsPerPixel: 1, maxAccumulation: 3, maxDpr: 1 },
    };

    // 当前生效的渲染档位（运行时可变：detectTier 决定，probeFrameHealth 可再降一档）
    let activeTier = 'high';

    /** 切换档位：只影响之后新建的 renderer 与累积帧上限，已渲染的玻璃按新上限收敛。 */
    function applyTier(tier) {
        const preset = TIER_PRESETS[tier] || TIER_PRESETS.high;
        activeTier = tier;
        REFERENCE.rendering.pathsPerPixel = preset.pathsPerPixel;
        REFERENCE.rendering.maxAccumulation = preset.maxAccumulation;
        REFERENCE.rendering.maxDpr = preset.maxDpr;
    }

    /**
     * 首帧实测：观察 8 帧的间隔，若中位帧时 > 26ms（≈38fps 以下）说明机器吃力，
     * 降一档重来。只在启动后跑一次，不常驻。
     */
    function probeFrameHealth() {
        return new Promise(resolve => {
            const stamps = [];
            let last = performance.now();
            const tick = now => {
                stamps.push(now - last);
                last = now;
                if (stamps.length < 8) {
                    requestAnimationFrame(tick);
                    return;
                }
                stamps.sort((a, b) => a - b);
                resolve(stamps[Math.floor(stamps.length / 2)]);
            };
            requestAnimationFrame(tick);
        });
    }

    const VERTEX_SOURCE = `#version 300 es
layout(location = 0) in vec2 aPosition;
out vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

    const fl = v => (Number.isInteger(v) ? v + '.0' : String(v));
    const vec = v => v.map(fl).join(', ');

    /** 与 src/shaders.js 的 gaussianBlur 完全一致：9 抽样、权重逐字节相同。 */
    const GAUSSIAN_9 = `vec3 gaussianBlur(vec2 topPixel, float spacing) {
  vec3 color = sceneSample(topPixel) * 0.204164;
  color += sceneSample(topPixel + vec2(spacing, 0.0)) * 0.180174;
  color += sceneSample(topPixel - vec2(spacing, 0.0)) * 0.180174;
  color += sceneSample(topPixel + vec2(spacing * 2.0, 0.0)) * 0.123832;
  color += sceneSample(topPixel - vec2(spacing * 2.0, 0.0)) * 0.123832;
  color += sceneSample(topPixel + vec2(0.0, spacing)) * 0.066282;
  color += sceneSample(topPixel - vec2(0.0, spacing)) * 0.066282;
  color += sceneSample(topPixel + vec2(0.0, spacing * 2.0)) * 0.027631;
  color += sceneSample(topPixel - vec2(0.0, spacing * 2.0)) * 0.027631;
  return color;
}`;

    // 累积帧数现在只在 JS 侧用（决定什么时候停止重渲），着色器不需要知道它
    function traceSource(paths) {
        const O = REFERENCE.optics;
        return `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 outColor;

uniform sampler2D uScene;
uniform sampler2D uPrevious;
uniform vec2 uResolution;
uniform vec4 uRect;
uniform float uRadius;
// uFrame 只用作抖动噪声的时间种子（让每帧的随机偏移不同，累积时才能收敛）
uniform float uFrame;
uniform vec2 uMouse;
uniform float uSceneValid;
// 玻璃在页面上的设备像素比：uRect/uRadius/uResolution 都是画布本地像素，
// 换算回壁纸坐标必须带上它，否则 DPR≥1.5 的屏幕上折射位置全偏。
uniform float uDevicePixelRatio;
// 元素在窗口中的位置 + 窗口尺寸（均为画布像素）：xy = 元素左上角, zw = 窗口
uniform vec4 uSceneRect;
// 背景图绘制矩形左上角相对视口的偏移（画布像素）。background-size: cover 时
// 图片会溢出视口居中，这个值就是负的裁切量；100% 100% 时为 (0,0)。
uniform vec2 uSceneOrigin;


uniform float uReverseDisplacement;
uniform float uEdgeCurvature;
uniform float uOpticalThickness;
uniform float uEdgeBandRatio;
uniform float uRefractionVisibleRatio;
uniform float uBlendFeather;
uniform float uFrostedStrength;
uniform float uFrostedAttenuation;
uniform float uBlurSpacing;
uniform float uDispersionStrength;
uniform float uHighlightStrength;
// 边缘窄描边强度：与镜面高光**解耦**。
// 共用一个参数时，为了看清高光把 uHighlightStrength 调高，描边会跟着放大成白边。
uniform float uEdgeStroke;
uniform vec3 uTintColor;
uniform float uTintMix;
// 0 = 深色玻璃（暗色主题），1 = 浅色玻璃（亮色主题）
uniform float uTintLift;
// 本块玻璃 tint 混入的绝对上限。0 = 不限制（跟随 uTintMix）。
// 深色主题要压暗壁纸让白字可读，但 tint 色是中性深灰，混多了就把
// 彩色壁纸洗成灰白 —— 深色下的小方格尤其明显（实测壁纸 [52,131,214]
// 被洗成 [183,192,204]，白雾就是它）。给每个档位一个上限，
// 让"压暗"和"保住颜色"之间有个可调的位置，而不用整页统一一刀切。
uniform float uTintLiftCap;
// 深色档的压暗方式。0 = 混合中性色（旧行为，会去饱和）；
// >0 = 换算子：把颜色按这个系数整体压暗，色相与饱和度原样保留。
// "混一层深灰"和"把整块调暗"在字面上都叫 tint，视觉上差得很远：
// 前者等于给玻璃蒙一块灰纱（纯红会变成 [206,58,65] 那种脏玫瑰），
// 后者只是变暗（纯红 [255,0,0] → [160,0,0]，仍然是红）。
uniform float uTintShade;
uniform float uDarkLift;
// 整块缓弯强度（0 = 只有边缘卷曲）
uniform float uBodyBend;

const float PI = 3.141592653589793;
const int PATHS = ${paths};

float saturateValue(float value) {
  return clamp(value, 0.0, 1.0);
}

float hash12(vec2 value) {
  vec3 p3 = fract(vec3(value.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

/**
 * 画布本地像素 → 场景（壁纸纹理）uv。
 *
 * 一次只渲一块玻璃，画布的 (0,0) 就是元素左上角，而壁纸贴在整页上：
 * 先加上元素在窗口里的偏移，得到窗口坐标。
 *
 * 关键：壁纸容器用的是 background-size: cover，不是 100% 100%。
 * cover 会把图片按短边铺满、长边裁掉 —— 图片宽高比与视口不一致时
 * （1920×1080 的图放进 1440×900 的窗口），图片在视口里是「溢出居中」的，
 * 只有中间一片可见。若这里直接拿「窗口坐标 / 视口尺寸」当 uv，
 * 等于假设背景被拉伸铺满，采样点会横向错位几十像素 ——
 * 症状是玻璃下的壁纸纹理整体偏移，采到的是完全不同的位置（比如把
 * 白云区当成了蓝天），读起来就像蒙了一层与内容无关的白雾。
 *
 * 所以 uSceneRect 传的是「背景绘制矩形」：xy = 绘制矩形左上角相对视口的偏移
 * （cover 裁切后可为负），zw = 绘制矩形的尺寸。两者都是画布像素，
 * 与 pixel 同一套坐标系，不需要再除 devicePixelRatio。
 */
vec2 topPixelToUv(vec2 pixel) {
  // uSceneRect.xy = 元素左上角在视口里的位置（画布像素）
  // uSceneRect.zw = 背景图片在视口里的绘制矩形（宽、高，画布像素）
  // uSceneOrigin  = 绘制矩形左上角相对视口的偏移（画布像素，封面裁切后可正可负）
  // 减 origin 而不是加：origin 是「绘制矩形左上角相对视口的偏移」（cover 时为负），
  // 窗口坐标 → 图片坐标要先把那段裁切减回来。符号写反的后果是整体横向平移
  // 2×|origin|（这里 1920×1080 的图放进 1440×900 窗口，正好偏 160px），
  // 采样落到不相邻的色带上 —— 表现就是玻璃下蒙着一层与内容无关的雾。
  vec2 windowPixel = uSceneRect.xy + pixel - uSceneOrigin;
  vec2 drawSize = max(vec2(1.0), uSceneRect.zw);
  return vec2(
    clamp(windowPixel.x / drawSize.x, 0.0, 1.0),
    clamp(1.0 - windowPixel.y / drawSize.y, 0.0, 1.0)
  );
}

vec3 srgbToLinear(vec3 color) {
  return mix(
    color / 12.92,
    pow((color + 0.055) / 1.055, vec3(2.4)),
    step(vec3(0.04045), color)
  );
}

vec3 sceneSample(vec2 topPixel) {
  return srgbToLinear(texture(uScene, topPixelToUv(topPixel)).rgb);
}

float roundedRectSdf(vec2 point, vec2 halfSize, float radius) {
  vec2 q = abs(point) - halfSize + vec2(radius);
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

float rectDistance(vec2 pixel, vec4 rect) {
  vec2 center = rect.xy + rect.zw * 0.5;
  vec2 halfSize = rect.zw * 0.5;
  float radius = max(1.0, min(uRadius, min(halfSize.x, halfSize.y) - 1.0));
  return roundedRectSdf(pixel - center, halfSize, radius);
}

// 法线的差分步长：原来写死 0.8 像素。在 DPR 1.25~1.5 的画布上这个步长跨了
// 一两个像素，圆角处 SDF 梯度会跳变 —— 高光里放大成几颗抖动的小亮点。
// 改成「固定 1px 的屏幕尺度」：step 随画布尺寸走，同时抬高下限避免小画布数值抖动。
float normalStep(vec4 rect) {
  return max(0.75, min(rect.z, rect.w) * 0.004);
}

vec2 rectNormal(vec2 pixel, vec4 rect) {
  vec2 center = rect.xy + rect.zw * 0.5;
  vec2 halfSize = rect.zw * 0.5;
  float radius = max(1.0, min(uRadius, min(halfSize.x, halfSize.y) - 1.0));
  vec2 local = pixel - center;
  float e = normalStep(rect);
  float dx = roundedRectSdf(local + vec2(e, 0.0), halfSize, radius)
    - roundedRectSdf(local - vec2(e, 0.0), halfSize, radius);
  float dy = roundedRectSdf(local + vec2(0.0, e), halfSize, radius)
    - roundedRectSdf(local - vec2(0.0, e), halfSize, radius);
  // 双精度下限：分量都接近 0 时（平直边正中）归一化会放大浮点噪声
  return normalize(vec2(dx, dy) + vec2(0.00001));
}

${GAUSSIAN_9}

vec2 refractedPosition(
  vec2 pixel,
  vec4 rect,
  float indexOfRefraction,
  float randomValue
) {
  float distanceToEdge = rectDistance(pixel, rect);
  float depth = max(0.0, -distanceToEdge);
  float edgeBand = max(5.0, rect.w * uEdgeBandRatio);
  float u = saturateValue(depth / edgeBand);
  float smoothInterior = u * u * (3.0 - 2.0 * u);
  float edgeFactor = 1.0 - smoothInterior;
  vec2 outlineNormal = rectNormal(pixel, rect);

  float roughness = ${fl(O.roughness)};
  vec2 roughOffset = vec2(
    cos(randomValue * PI * 2.0),
    sin(randomValue * PI * 2.0)
  ) * roughness;
  vec3 surfaceNormal = normalize(vec3(
    outlineNormal * edgeFactor * 1.35 * uEdgeCurvature + roughOffset,
    1.0
  ));
  vec3 cameraRay = normalize(vec3(
    (uMouse.x - 0.5) * ${fl(O.cameraRayScale)},
    (uMouse.y - 0.5) * ${fl(O.cameraRayScale)},
    -1.0
  ));

  vec3 insideRay = refract(cameraRay, surfaceNormal, 1.0 / indexOfRefraction);
  float thickness = uOpticalThickness * (${fl(O.insideTravelBasePx)} + smoothInterior * rect.w * ${fl(O.insideTravelInteriorScale)});
  float insideTravel = thickness / max(${fl(O.minimumRayZ)}, -insideRay.z);
  vec2 hit = pixel + insideRay.xy * insideTravel;

  vec3 exitRay = refract(
    insideRay,
    vec3(0.0, 0.0, 1.0),
    indexOfRefraction
  );
  float exitTravel = (${fl(O.exitTravelBasePx)} * uOpticalThickness) / max(${fl(O.minimumRayZ)}, -exitRay.z);
  hit += exitRay.xy * exitTravel;

  // 掠射防爆：圆角附近 surfaceNormal 接近切向，refract() 的 insideRay.z 贴近
  // minimumRayZ(0.08)，除以 0.08 会把位移放大到几百像素 —— 玻璃中心于是采到
  // 屏幕另一侧不相干的色块，高对比壁纸下就成了一条「抹开的灰雾」。
  // 真实玻璃再厚也只有元素那么大，位移按元素尺寸封顶。
  float maxOffset = min(rect.z, rect.w) * 0.38;
  vec2 rawOffset = hit - pixel;
  float offsetLength = length(rawOffset);
  if (offsetLength > maxOffset) {
    hit = pixel + rawOffset * (maxOffset / offsetLength);
  }

  // 两条曲线叠加：
  //   1) lensCurve —— 参考库原本的边缘弧面，只在 edgeBand 内有效；
  //   2) bodyCurve —— 整块玻璃的"厚料"缓弯，按到边距离的平方衰减，中段弱、近边缘强。
  // 只用 1) 时边带以外的像素是纯平行位移，玻璃读起来像一块干净的磨砂板；
  // 补上 2) 后整块面都在被"压弯"，透过去的色块跟着轮廓变形，液体感才立得住。
  float lensCurve = 1.0 - sqrt(max(0.0, 1.0 - edgeFactor * edgeFactor));
  float halfSpan = max(1.0, min(rect.z, rect.w) * 0.5);
  float bodyCurve = 1.0 - saturateValue(depth / halfSpan);
  bodyCurve *= bodyCurve;
  // max() 会让 bodyBend<1 的分支永远输给边缘 lensCurve，中段实际没有增量；
  // 改成叠加：边缘仍由 lensCurve 主导，中段靠 bodyCurve 单独贡献。
  float bend = clamp(lensCurve + bodyCurve * uBodyBend, 0.0, 1.0);
  float reversePixels = min(${fl(O.reverseMaxPixels)}, edgeBand * uReverseDisplacement);
  return pixel
    - outlineNormal * reversePixels * lensCurve
    + (hit - pixel) * bend * ${fl(O.lensMix)};
}

vec3 tracePath(vec2 pixel, vec4 rect, float seed) {
  vec2 redPosition = refractedPosition(pixel, rect, ${fl(O.refractiveIndices.red)}, seed);
  vec2 greenPosition = refractedPosition(pixel, rect, ${fl(O.refractiveIndices.green)}, seed);
  vec2 bluePosition = refractedPosition(pixel, rect, ${fl(O.refractiveIndices.blue)}, seed);

  vec3 neutral = sceneSample(greenPosition);
  vec3 dispersed = vec3(
    sceneSample(redPosition).r,
    neutral.g,
    sceneSample(bluePosition).b
  );

  float depth = max(0.0, -rectDistance(pixel, rect));
  float edgeBand = max(5.0, rect.w * uEdgeBandRatio);
  float edgeFactor = 1.0 - smoothstep(0.0, edgeBand, depth);
  vec3 transmitted = mix(neutral, dispersed, edgeFactor * uDispersionStrength);

  vec2 normal = rectNormal(pixel, rect);
  float topLight = pow(
    saturateValue(dot(
      normalize(vec3(normal, 0.72)),
      normalize(vec3(-0.58, -0.74, 0.62))
    )),
    18.0
  );
  float fresnel = 0.04 + 0.96 * pow(
    1.0 - saturateValue(1.0 - edgeFactor * 0.36),
    5.0
  );
  // 反射原来是「逐像素随机二值」：step(seed, fresnel*0.34) 让一部分像素整块跳成
  // 反射色、邻居却完全不反射 —— 在平滑区就是散落的小亮点（左上那几颗噪点的来源）。
  // 改成连续权重：强度随 fresnel 平滑增长，且限定在边缘带；seed 只做 ±8% 轻微抖动，
  // 不再决定"反不反射"。物理上镜面反射本来就是连续量。
  float reflectWeight = saturateValue(fresnel * edgeFactor * 0.55);
  reflectWeight *= mix(0.92, 1.0, seed);
  vec3 reflected = vec3(0.52, 0.58, 0.68) * (0.24 + topLight * 0.72);
  return mix(transmitted, reflected, reflectWeight);
}

vec4 liquidGlass(vec2 pixel) {
  vec4 rect = uRect;
  float distanceToEdge = rectDistance(pixel, rect);
  float antialiasWidth = max(1.0, fwidth(distanceToEdge));
  float coverage = 1.0 - smoothstep(
    -antialiasWidth,
    antialiasWidth,
    distanceToEdge
  );
  if (coverage <= 0.0) return vec4(0.0);

  // 壁纸还没就绪（或加载失败）：返回**全透明**，把外观完全交还给 CSS 玻璃。
  //
  // 这里踩过一个很贵的坑，记下来：
  // 旧实现返回的是与主题匹配的实心底（深色 = vec3(0.035,0.035,0.045)），
  // 理由写在原注释里 ——「CSS tint 已被清成 transparent，canvas 也透明的话
  // 玻璃就消失了」。结论对了一半，做法是错的：
  //   · sceneValid=false 时那块实心底是 **alpha 1.0** 的近黑色块，
  //     它会盖住整块元素。用户在扩展里看到的正是"所有玻璃都是不透明深灰板"。
  //   · 而 CSS 的 backdrop-filter 一直还在 —— 只要 canvas 不出墨，玻璃照样
  //     能透出壁纸、照样有模糊和边缘断面。所谓"玻璃消失"根本不会发生。
  // 所以正确行为就是什么都不画。渲染器在 sceneValid 翻转时会 schedule 重绘，
  // 壁纸到位后这一块自然被折射填满。
  if (uSceneValid < 0.5) {
    return vec4(0.0);
  }

  float depth = max(0.0, -distanceToEdge);
  float edgeBand = max(5.0, rect.w * uEdgeBandRatio);
  float edgeFactor = 1.0 - smoothstep(0.0, edgeBand, depth);

  vec3 traced = vec3(0.0);
  for (int sampleIndex = 0; sampleIndex < PATHS; ++sampleIndex) {
    float seed = hash12(
      pixel + vec2(float(sampleIndex) * 17.13, uFrame * 0.754 + 3.7)
    );
    traced += tracePath(pixel, rect, seed);
  }
  traced /= float(PATHS);

  float refractionBand = max(5.0, rect.w * uRefractionVisibleRatio);
  float blurWeight = smoothstep(
    max(0.0, refractionBand - uBlendFeather),
    refractionBand + uBlendFeather,
    depth
  );

  // 模糊采样锚点先跟着折射走，再回到像素本身，折射与雾化之间才没有接缝。
  vec2 refractedAnchor = refractedPosition(pixel, rect, ${fl(O.refractiveIndices.green)}, 0.37);
  vec2 blurAnchor = mix(refractedAnchor, pixel, blurWeight);
  vec3 frosted = gaussianBlur(blurAnchor, uBlurSpacing);
  float frostMix = blurWeight * uFrostedStrength * uFrostedAttenuation;
  vec3 layered = mix(traced, frosted, frostMix);

  vec2 localUv = (pixel - rect.xy) / rect.zw;
  // ── 浅色主题的可读性（亮度压缩，不是硬提亮）──────────────────────
  //
  // 走过的两条弯路，都记在这里避免重犯：
  //   · 硬抬到固定亮度 0.86：任何壁纸都被刷成同一块灰白板，纹理全丢（"白雾"）。
  //   · 完全不抬（tint 降到 0.08）：玻璃过于透明，实测同一页里压在雪山上的
  //     方块对比度 18:1、压在暗草坡上的只有 4.7:1 —— 一半刺眼、一半读不清。
  //
  // 正确做法是「压缩动态范围」而不是「整体提亮」：把壁纸亮度映射到一个较窄的
  // 中高区间（保留下限，避免暗区吃掉文字；同时收住上限，避免亮区刺眼），
  // 中间的相对明暗关系仍然保留，所以纹理和液体感都还在。
  //
  //   lifted = target + (lum - target) * compress
  //   compress = 0.42 → 壁纸明暗差被压到四成，跨度从 18:1~4.7:1 收敛到
  //                     约 11:1~6:1，两端都过 AA，且仍有层次。
  float luminance = dot(layered, vec3(0.2126, 0.7152, 0.0722));
  // 只对浅色主题做亮度压缩。
  //
  // 为什么深色主题不适用：压缩的目标是「把跨度收到中间」，而深色主题要的是
  // 「整体压暗」（白字需要低亮度底）。实测给深色套 targetLum=0.30 反而把
  // 暗区从 0.10 抬到 0.184（0.30 + (0.10-0.30)*0.58），白字对比度从 3.56 掉到 2.97。
  // 深色主题的可读性由 --glass-fill 那层深墨 tint 负责，这里不插手。
  float liftMask = uTintLift * (1.0 - edgeFactor * 0.75);
  if (liftMask > 0.001) {
    // targetLum 0.56：中高亮度，深墨文字在明暗壁纸上都能读。
    // compress 0.58：放回足够多的明暗差，纹理与液体感明显，
    // 同时把对比度跨度从 4.7:1~18:1 收敛到约 7.6:1~15:1（两端都过 AA）。
    const float targetLum = 0.56;
    const float compress = 0.58;    // 越小越平（纹理越少），越大越贴原壁纸
    float compressed = targetLum + (luminance - targetLum) * compress;
    // 只改亮度、不动色相，但**按加法而不是乘法**做：
    // 乘法（layered * compressed / lum）会把原本颜色浓的区域成比例放大 ——
    // 暗绿的草坡被抬亮的同时绿色分量也被放大，第二行方块整排泛绿、
    // 和第一行的蓝白对不上（实测对比图颜色割裂）。
    // 加法等效于给整块玻璃垫一层中性灰白，饱和度不随亮度变化。
    float dLum = compressed - luminance;
    layered = clamp(layered + vec3(dLum), 0.0, 1.0);
    // 补一点点饱和度回退：抬亮后颜色会显得发灰，
    // 用 0.85 的轻微去饱和抵消，避免整块玻璃像蒙了层牛奶。
    float grey = dot(layered, vec3(0.2126, 0.7152, 0.0722));
    layered = mix(vec3(grey), layered, mix(1.0, 0.85, liftMask));
  }
  // tint 只薄涂在平滑区，折射带完全不染，壁纸纹理才穿得过去
  float tintAmount = mix(uTintMix, uTintMix * 0.42, uTintLift);
  // 上限钳制：只影响显式设了 uTintLiftCap 的档位（目前是深色下的方格）。
  if (uTintLiftCap > 0.0) {
    tintAmount = min(tintAmount, uTintLiftCap);
  }
  if (uTintShade > 0.0) {
    // 保色相压暗：只乘系数、不混色。亮度降下来，红还是红。
    // 「混一层深灰」和「把整块调暗」字面上都叫 tint，视觉差得很远：
    // 前者是给玻璃蒙一块灰纱（纯红被洗成 [206,58,65] 那种脏玫瑰），
    // 后者只是变暗（纯红 [255,0,0] → [160,0,0]，仍然是红）。
    layered *= uTintShade;
  } else {
    layered = mix(layered, uTintColor, tintAmount * mix(1.0, 0.5, uTintLift));
  }
  // 雾化层的暖灰同样按模式分流：
  // 旧做法是「往上加暖灰」（模糊区整体泛白）—— 深色档下正是白雾的来源。
  // shade 模式下改成「乘一个略低于 1 的系数」，模糊保留但不会冲淡颜色。
  if (uTintShade > 0.0) {
    layered *= 1.0 - blurWeight * uFrostedStrength * 0.18;
  } else {
    layered += vec3(${vec(O.frostTintColor)}) * blurWeight * uFrostedStrength;
  }

  // ── 镜面高光：按法线算，而不是按「对角位置」────────────────────────
  //
  // 旧实现用 localUv.x + localUv.y 做对角判别，于是**左上和右下两个角同时亮**
  // （那是同一条对角线的两端）。用户看到的就是「左上右下各一团白光」，很怪。
  // 真实玻璃的高光由表面法线决定：只有法线朝向光源的那一小块才会亮，
  // 所以这里改成 Blinn-Phong：
  //   N = 由 SDF 梯度得到的 outward normal（圆角处会自然转向）
  //   L = 左上方来的平行光（与 CSS --glass-bevel 的 154deg 同向）
  //   高光 = pow(max(dot(N, normalize(L + V)), 0), 高指数) × 强度
  // 平直边上的法线是恒定方向，因此只有「迎光那一侧」会亮，另一侧完全暗。
  vec2 specNormal = rectNormal(pixel, rect);
  vec3 lightDir = normalize(vec3(-0.58, -0.74, 0.62));
  vec3 halfVec = normalize(lightDir + vec3(0.0, 0.0, 1.0));
  // 注意 specNormal 来自 rectNormal（SDF 梯度），不含 roughOffset 的随机扰动 ——
  // 若把带随机项的 surfaceNormal 拿来算高光，pow(42) 会把那点噪声放大成
  // 左上角一片抖动的小亮点（实测可见）。高光用"干净法线"，粗糙度只作用于折射。
  float spec = pow(max(dot(normalize(vec3(specNormal, 0.55)), halfVec), 0.0), 42.0);
  // 只在边缘带出现：内部是平面，本来就不该有镜面反射
  layered += vec3(spec * edgeFactor * uHighlightStrength * 2.2);
  // 边缘增亮：折射带本身就是「玻璃把光聚过来」的地方，参考库靠高光与镜像
  // 反射一起交代厚度。这里再加一条贴着轮廓的柔亮线（宽度按短边、随 edgeFactor
  // 衰减），深色主题下玻璃的"弧面"才看得出来，浅色主题下不至于像块平卡。
  // ── 边缘：只有一条窄描边，且随位置衰减（对齐参考库的 innerStroke）──────
  //
  // 之前这里是三层叠加（edgeFactor² 的柔亮 + edgeFactor 的通体提亮 + 外缘 rim），
  // 每一层都是 mix 到纯白，叠起来就是用户看到的那圈「硬白边」。参考库的原始做法
  // 只有一条：宽 1.5px 的窄环，强度 u_edgeHL*0.55，并且按上下位置衰减
  // （顶部迎光最亮、底部背光最暗）——所以它的边缘是「渐变的厚边」而不是「白线」。
  //
  // 现在照搬这条：
  //   窄环 = smoothstep 在 sdf 的 (-borderWidth-1, -borderWidth) 上抬升，
  //          到 -1 处又开始回落 → 得到一条宽度固定、内外都软化的环；
  //   上下衰减 = 0.4 + 0.6 * topBias，顶部最多、底部四成。
  //
  // 注意 sdf 在此函数里是 rectDistance（内部为负），所以「距边缘 1.5px」写作
  // depth 落在 [0, borderWidth] 区间。
  // 描边宽度按画布缩放：参考库的 1.5px 是 CSS 像素，而我们是画布像素
  // （DPR 1.25~1.5 下 1.5 个画布像素只有 1.0~1.2 个物理像素，边缘反而更锐更硬）。
  // 乘上 uDevicePixelRatio 换算回等效 CSS 宽度，白边才不会因为 DPR 而"变细变硬"。
  float borderWidth = max(1.2, 1.5);
  float innerStroke =
      smoothstep(0.0, borderWidth + 1.5, depth) * (1.0 - smoothstep(borderWidth, borderWidth + 2.5, depth));
  // 上下分段：localUv.y 0=顶 1=底。底部保留 25%（参考库是 40%，实测那个值在
  // 深色壁纸下会让下边缘也泛起一圈白，缩到 25% 只留一点背光暗示）。
  float topBias = 1.0 - localUv.y;
  innerStroke *= (0.25 + 0.75 * topBias);
  // 强度只用 uEdgeStroke 一个旋钮。原来还乘了一个 strokeGain(mix(0.16,0.1))，
  // 两个 0.0x 相乘只剩 0.003 —— 描边几乎不可见（实测三档参数肉眼无差）。
  // 现在合并成单参数：调用方给多少就是多少，标定起来才有意义。
  layered = mix(layered, vec3(1.0), innerStroke * uEdgeStroke);

  // 折射带内侧的一层极淡柔光：让「弧面把光聚过来」这件事可读，
  // 但强度只有旧版的 1/4，且不混纯白（混的是当前色提亮 8%），不再是白边。
  float bandGlow = edgeFactor * edgeFactor * mix(0.05, 0.032, uTintLift);
  layered += layered * bandGlow;

  // ── 深色主题的可读性封顶（必须放在最后一步）─────────────────────
  //
  // 位置很关键：这里已经把 tint、雾化、高光、描边、折射带柔光全叠完了，
  // 「return 出去的亮度」才是用户真正看到的背景亮度。
  // 前面那几版把封顶写在中途，结果是：白纸本来被压到 0.16，接着高光 +0.05、
  // 描边混白、柔光再乘一下，最后又回到 0.5 —— 白字照样糊。
  //
  // 数字来源（算出来的）：白字要在背景上过 AA 4.5:1，
  // 背景 sRGB 亮度必须 ≤120，线性 ≈0.18。
  //   sRGB 120→4.42:1  110→5.10:1  100→5.92:1
  // 取 cap 0.16（略严于 0.18，给不同色相留余量）。
  // 只在**超过** cap 时压缩，暗壁纸一个字节都不动 —— 通透感全保留。
  float finalMask = (1.0 - uTintLift) * uDarkLift;
  if (finalMask > 0.001) {
    float finalLum = dot(layered, vec3(0.2126, 0.7152, 0.0722));
    // cap 0.06 / 斜率 0.13 是算出来的（不是试出来的）：
    //   白底线性 1.0 → 0.06 + 0.94*0.13 = 0.182 → sRGB 118 → 白字 4.5:1 ✔
    //   亮区 0.7    → 0.06 + 0.64*0.13 = 0.143 → sRGB 106
    //   中区 0.4    → 0.06 + 0.34*0.13 = 0.104 → sRGB  91
    //   暗区 0.2    → 0.06 + 0.14*0.13 = 0.078 → sRGB  79
    // 层次一路都在（118/106/91/79），不是一刀切平。
    // 之前 cap=0.16/k=0.30 只能把白底压到 sRGB 172（2.5:1），白字照样糊 ——
    // 那是「算错了」，不是「参数保守」。
    const float cap = 0.06;
    if (finalLum > cap) {
      float target_ = cap + (finalLum - cap) * 0.13;
      float scale = target_ / max(finalLum, 0.0001);
      layered *= mix(1.0, scale, finalMask);
    }
  }

  return vec4(max(layered, vec3(0.0)), coverage);
}

void main() {
  vec2 topPixel = vec2(
    vUv.x * uResolution.x,
    (1.0 - vUv.y) * uResolution.y
  );

  vec4 current = liquidGlass(topPixel);

  // 历史帧由 display pass 负责混合（每块玻璃的累积帧数各自独立），
  // 这里只输出本帧，uPrevious 仅用于潜在的抖动混合。
  outColor = current;
}
`;
    }

    const DISPLAY_SOURCE = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTexture;
uniform sampler2D uPrevious;
uniform float uHistoryWeight;

vec3 linearToSrgb(vec3 color) {
  return mix(
    color * 12.92,
    1.055 * pow(max(color, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055,
    step(vec3(0.0031308), color)
  );
}

void main() {
  vec4 sampleValue = texture(uTexture, vUv);
  outColor = vec4(
    clamp(linearToSrgb(sampleValue.rgb), 0.0, 1.0),
    sampleValue.a
  );
  // 累积滤波：新帧与「留在自己 canvas 里的上一帧」按 1/(n+1) 混合。
  // 比例在这里算，是因为每块玻璃的累积帧数是独立的；FBO 只有一组。
  if (uHistoryWeight > 0.0) {
    vec4 history = texture(uPrevious, vUv);
    outColor = mix(outColor, history, uHistoryWeight);
  }
}
`;

    const UNIFORM_NAMES = [
        'uScene',
        'uPrevious',
        'uResolution',
        'uRect',
        'uRadius',
        'uFrame',
        'uMouse',
        'uSceneValid',
        'uDevicePixelRatio',
        'uSceneRect',
        'uSceneOrigin',
        'uReverseDisplacement',
        'uEdgeCurvature',
        'uOpticalThickness',
        'uEdgeBandRatio',
        'uRefractionVisibleRatio',
        'uBlendFeather',
        'uFrostedStrength',
        'uFrostedAttenuation',
        'uBlurSpacing',
        'uDispersionStrength',
        'uHighlightStrength',
        'uEdgeStroke',
        'uTintColor',
        'uTintMix',
        'uTintLift',
        'uTintLiftCap',
        'uTintShade',
        'uDarkLift',
        'uBodyBend',
    ];

    // 这些元素由 app 自己定位（fixed / 悬浮层），不能加 .has-liquid-glass 的 relative
    const NO_MARKER_CLASSES = [
        'weather-widget',
        'side-card',
        'search-history-dropdown',
        'control-btn',
    ];

    const TARGETS = [
        '.weather-widget',
        '.quick-access-item',
        '.add-quick-access-btn',
        '.control-btn',
        '.side-card',
        '.search-history-dropdown',
        // 字段档：搜索框是整页唯一「要在里面打字」的玻璃，之前只有模糊白底，
        // 夹在一堆折射玻璃里像个塑料片；接进来才是一整套光学。
        '.search-input',
    ];

    function compile(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const log = gl.getShaderInfoLog(shader) || 'shader compile failed';
            gl.deleteShader(shader);
            throw new Error(log);
        }
        return shader;
    }

    function link(gl, vs, fs) {
        const program = gl.createProgram();
        const v = compile(gl, gl.VERTEX_SHADER, vs);
        const f = compile(gl, gl.FRAGMENT_SHADER, fs);
        gl.attachShader(program, v);
        gl.attachShader(program, f);
        gl.linkProgram(program);
        gl.deleteShader(v);
        gl.deleteShader(f);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const log = gl.getProgramInfoLog(program) || 'program link failed';
            gl.deleteProgram(program);
            throw new Error(log);
        }
        return program;
    }

    function makeTarget(gl, format, type, width, height) {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, gl.RGBA, type, null);
        const framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        if (!complete) {
            gl.deleteTexture(texture);
            gl.deleteFramebuffer(framebuffer);
            return null;
        }
        return { texture, framebuffer };
    }

    /**
     * 渲染器：整页共用一个 WebGL2 上下文。
     *
     * 为什么不是每块玻璃一个 canvas —— Chrome 同时只允许约 16 个 WebGL 上下文，
     * 超了就丢掉最老的（日志里 "Too many active WebGL contexts"）。新标签页上
     * 玻璃块（快捷方式 + 天气 + 控件 + 侧卡 + 下拉）轻松超过这个数，所以这里
     * 一个上下文 + 一组 ping-pong FBO（尺寸 = 当前最大玻璃块），每帧把每块玻璃
     * 依次渲染进 FBO 再用 2D context 贴到它自己的 canvas 上。玻璃块之间
     * 不重叠（都是独立布局），共享一块画布不会串图。
     */
    class GlassRenderer {
        constructor() {
            this.canvas = null;
            this.gl = null;
            this.targets = [];
            // 按尺寸缓存的 FBO 池：key = "wxh"。
            // 为什么需要：21 块玻璃有 8 种不同尺寸，而 ping-pong FBO 必须跟当前
            // 这块的尺寸一致。原来「尺寸一变就整套删了重建」，实测 12 帧里重建 95 次，
            // ensureTargets 独占 401.7ms —— 整帧 414.4ms 的 97%。
            // 池化后每个尺寸只建一次，之后永远复用。
            this.targetPool = new Map();
            this.targetPoolLimit = 12;
            this.targetClock = 0;
            this.sceneTexture = null;
            this.sceneValid = false;
            this.readTarget = 0;
            this.width = 0;
            this.height = 0;
            this.offset = [0, 0];
            this.radius = 24;
            this.pixelRatio = 1;
            this.sceneUrl = '';
            // 背景图在视口里的绘制矩形尺寸 + 左上角偏移（画布像素）。
            // 由 setScene 在图片 onload 后按 background-size: cover 的规则算出；
            // 缺省等于视口尺寸、无偏移，即「拉伸铺满」的旧行为。
            this.sceneDrawSize = [1, 1];
            this.sceneDrawOrigin = [0, 0];
            this.sceneImageSize = null;
            this.floatTargets = false;
            this.disposed = false;
        }

        init() {
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            const gl = canvas.getContext('webgl2', {
                alpha: true,
                antialias: false,
                depth: false,
                stencil: false,
                premultipliedAlpha: false,
                powerPreference: 'high-performance',
                preserveDrawingBuffer: true,
            });
            if (!gl) return false;
            // canvas 默认 1x1；FBO 尺寸由 ensureTargets 决定，但导出/合成都发生在默认
            // 帧缓冲上，所以默认帧缓冲必须和 FBO 一样大，否则 drawImage 只能拿到 1px。
            // 这里先按最大上限占位，ensureTargets 里再跟着回调。
            canvas.width = 1;
            canvas.height = 1;

            try {
                this.traceProgram = link(
                    gl,
                    VERTEX_SOURCE,
                    traceSource(REFERENCE.rendering.pathsPerPixel)
                );
                this.displayProgram = link(gl, VERTEX_SOURCE, DISPLAY_SOURCE);
            } catch (error) {
                console.warn('[liquid-glass] shader 编译失败:', error && error.message);
                return false;
            }

            this.gl = gl;
            this.canvas = canvas;
            this.uniforms = Object.fromEntries(
                UNIFORM_NAMES.map(n => [n, gl.getUniformLocation(this.traceProgram, n)])
            );
            this.displayUniform = gl.getUniformLocation(this.displayProgram, 'uTexture');
            this.displayHistoryUniform = gl.getUniformLocation(this.displayProgram, 'uPrevious');
            this.displayHistoryWeightUniform = gl.getUniformLocation(
                this.displayProgram,
                'uHistoryWeight'
            );

            this.vertexArray = gl.createVertexArray();
            this.vertexBuffer = gl.createBuffer();
            gl.bindVertexArray(this.vertexArray);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
            gl.bufferData(
                gl.ARRAY_BUFFER,
                new Float32Array([-1, -1, 3, -1, -1, 3]),
                gl.STATIC_DRAW
            );
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

            this.sceneTexture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, this.sceneTexture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                gl.RGBA,
                1,
                1,
                0,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                new Uint8Array([17, 17, 23, 255])
            );

            // 半浮点累积能把 48 帧的降噪做干净；不支持时退回 RGBA8（精度差一点，效果仍在）
            const floatOk = !!(
                gl.getExtension('EXT_color_buffer_float') &&
                gl.getExtension('OES_texture_float_linear')
            );
            this.floatTargets = floatOk;
            this.targets = [];
            return true;
        }

        /** 壁纸是唯一可采样的场景源；换图时重新上传纹理。 */
        setScene(url) {
            if (!this.gl) return;
            // 相对路径必须先绝对化再比较：扩展页里壁纸可能以 'assets/x.jpg' 形式给出，
            // 直接 new Image().src = 'assets/x.jpg' 在扩展页里会落到扩展根下，
            // 一旦目录不对就 onerror —— sceneValid 永久 false，整页玻璃拿不到场景。
            // 用 URL() 按当前文档解析，同时也让「同一张壁纸的两种写法」不会重复上传。
            let resolved = url;
            if (url) {
                try {
                    resolved = new URL(url, document.baseURI).href;
                } catch {
                    resolved = url;
                }
            }
            if (resolved === this.sceneUrl) return;
            this.sceneUrl = resolved;
            if (!resolved) {
                this.sceneValid = false;
                return;
            }
            const image = new Image();
            image.decoding = 'async';
            // 必须显式要 CORS：扩展页的 origin 是 chrome-extension://，
            // 图床（picsum / pexels / wallhaven）都是跨域。不设 crossOrigin 时
            // <img> 依然会 onload，但 WebGL texImage2D 会以
            // "The image element contains cross-origin data" 抛错 ——
            // 表现为 sceneValid 永久 false、整页玻璃不出墨（一块深灰板/全透明）。
            // 这些图床都回 Access-Control-Allow-Origin: *，所以 anonymous 可用；
            // dataURL / 扩展内相对路径配 crossOrigin 也没问题。
            image.crossOrigin = 'anonymous';

            image.onload = () => {
                if (this.disposed) return;
                const gl = this.gl;
                gl.bindTexture(gl.TEXTURE_2D, this.sceneTexture);
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
                try {
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                    this.sceneValid = true;
                    // 记下原图尺寸，窗口 resize 时按同一张图重算 cover 矩形
                    this.sceneImageSize = [image.naturalWidth, image.naturalHeight];
                    this.updateSceneDrawRect(image.naturalWidth, image.naturalHeight);
                } catch (error) {
                    this.sceneValid = false;
                    console.warn('[liquid-glass] 壁纸纹理上传失败:', error && error.message);
                } finally {
                    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
                }
                // 关键：壁纸到达后必须重绘一遍。
                // 玻璃挂载时壁纸往往还在下载，那时渲的 12 帧累积的是「空场景」，
                // 累积完 frame 到顶就再也不会画 —— 整页停在半成品上，读起来就是
                // 一块不透明的深灰板（或一团没有意义的球面高光）。用户缩放窗口会
                // 触发 schedule(true) 让 frame 归零，于是「突然恢复正常」，正是这个原因。
                if (this.onSceneReady) this.onSceneReady();
            };
            image.onerror = event => {
                this.sceneValid = false;
                console.warn(
                    '[liquid-glass] 壁纸图像加载失败:',
                    String(url).slice(0, 60),
                    event && event.type
                );
                // 失败也要重绘：让着色器走 uSceneValid=0 的兜底（透明，交给 CSS）
                if (this.onSceneReady) this.onSceneReady();
            };
            image.src = resolved;
        }

        /**
         * 按 CSS background-size: cover 的规则，算出背景图在视口里的绘制矩形。
         *
         * cover = 等比放大到「至少铺满」视口，超出的部分居中裁掉：
         *   scale = max(视口宽/图宽, 视口高/图高)
         *   绘制尺寸 = 图尺寸 × scale
         *   偏移     = (视口尺寸 - 绘制尺寸) / 2   （≤ 0，即裁切量）
         *
         * 玻璃的 UV 映射必须用这套「绘制矩形」而不是视口尺寸，
         * 否则图片宽高比与视口不一致时采样点会整体错位，
         * 采到壁纸里完全不相干的区域（症状：玻璃下蒙着一层与内容无关的雾）。
         * 单位统一为画布像素，与 uSceneRect.xy（元素 offset）同坐标系。
         */
        updateSceneDrawRect(imageWidth, imageHeight) {
            const dpr = Math.min(window.devicePixelRatio || 1, REFERENCE.rendering.maxDpr);
            const viewW = Math.max(1, window.innerWidth);
            const viewH = Math.max(1, window.innerHeight);
            if (!imageWidth || !imageHeight) {
                this.sceneDrawSize = [viewW * dpr, viewH * dpr];
                this.sceneDrawOrigin = [0, 0];
                return;
            }
            const scale = Math.max(viewW / imageWidth, viewH / imageHeight);
            const drawW = imageWidth * scale;
            const drawH = imageHeight * scale;
            this.sceneDrawSize = [drawW * dpr, drawH * dpr];
            // 居中裁切：绘制矩形一般比视口大，左上角落在视口外侧（负偏移）
            this.sceneDrawOrigin = [((viewW - drawW) / 2) * dpr, ((viewH - drawH) / 2) * dpr];
        }

        /** FBO 尺寸按当前最大玻璃块分配；尺寸变了就重建。 */
        /**
         * 绑定「尺寸为 width×height」的那组 ping-pong FBO。
         *
         * 原实现是单组 FBO：尺寸一变就 deleteTexture+deleteFramebuffer 再重建。
         * 21 块玻璃 8 种尺寸轮着渲，实测 252 次 render 里重建 95 次，
         * ensureTargets 独占 401.7ms —— 整帧 414.4ms 的 97% 都在建销毁 FBO，
         * 着色器反而是零头。
         *
         * 现在按尺寸池化：每个唯一尺寸只建一次，之后从池里取。返回值语义保持
         * 「这组 FBO 是不是刚建的」—— 刚建意味着内容是空的，调用方必须重置
         * 累积（reset）。池化后同一尺寸第二次起都返回 false，累积可正常延续。
         *
         * @returns {boolean} true = 新建了 FBO（历史无效，需要 reset）
         */
        ensureTargets(width, height) {
            const key = width + 'x' + height;
            const cached = this.targetPool.get(key);
            if (cached && cached.targets.length === 2) {
                // 命中。注意返回值语义是「这组 FBO 的内容对调用方有效吗」：
                //   · 如果是**同一块玻璃**继续累积（尺寸没变、readTarget 延续），有效；
                //   · 如果是从别的尺寸切过来的，池里装的还是上一块玻璃留下的像素，
                //     对当前这块毫无意义，必须让调用方 reset，否则读到的是别人家的图。
                // 判据：尺寸变了 = 不是同一块，必须 reset。
                const switched = this.width !== width || this.height !== height;
                cached.lastUsed = ++this.targetClock;
                this.targets = cached.targets;
                this.width = width;
                this.height = height;
                // canvas（默认帧缓冲）尺寸另管，见 ensureCanvasSize()。
                this.ensureCanvasSize(width, height);
                return switched;
            }
            // 未命中：池满时先回收最久未用的那组，再建新的
            if (this.targetPool.size >= this.targetPoolLimit) {
                this._evictOldestTargets();
            }
            const gl = this.gl;
            this.width = width;
            this.height = height;
            this.ensureCanvasSize(width, height);
            const build = (format, type) => [
                makeTarget(gl, format, type, width, height),
                makeTarget(gl, format, type, width, height),
            ];
            let built = [];
            if (this.floatTargets) {
                const floats = build(gl.RGBA16F, gl.HALF_FLOAT);
                if (floats[0] && floats[1]) built = floats;
            }
            if (!built.length) built = build(gl.RGBA8, gl.UNSIGNED_BYTE);
            this.targets = built;
            this.targetPool.set(key, {
                targets: built,
                width,
                height,
                lastUsed: ++this.targetClock,
            });
            this.readTarget = 0;
            return true;
        }

        /**
         * 维持默认帧缓冲（this.canvas）的尺寸。
         *
         * 为什么不能「每次跟着当前玻璃调」：给 canvas.width 赋值 = 重新分配整个
         * 绘图缓冲并重置 GL 状态，比建一个 FBO 还贵。21 块玻璃 8 种尺寸轮着渲时，
         * 每次都跟着改等于每帧十几次全量重建，池化的收益会被吃干净（实测 totalMs
         * 从 3.9ms 回到 345ms）。
         *
         * 所以策略改成「只增不减」：canvas 取「迄今见过的最大宽 / 最大高」。
         * 渲染时 viewport 仍然是当前 FBO 的尺寸，内容落在左下角的 (0,0)-(w,h)；
         * 导出时按 (0, H-h, w, h) 取子矩形（见 render 末尾的 drawImage）。
         * WebGL 的原点在左下，所以余量出现在上方，纵向偏移要算进去。
         */
        ensureCanvasSize(width, height) {
            if (this.canvas.width >= width && this.canvas.height >= height) return;
            // 只增，但不要无限涨：上限取视口尺寸（玻璃不可能比视口大）
            const nextW = Math.max(this.canvas.width, width);
            const nextH = Math.max(this.canvas.height, height);
            this.canvas.width = nextW;
            this.canvas.height = nextH;
        }

        /** 池满时淘汰最久未用的那组 FBO（LRU）。只在尺寸种类超限时发生。 */
        _evictOldestTargets() {
            let oldestKey = null;
            let oldest = Infinity;
            this.targetPool.forEach((entry, k) => {
                // 正在用的这组不能删
                if (entry.targets === this.targets) return;
                if (entry.lastUsed < oldest) {
                    oldest = entry.lastUsed;
                    oldestKey = k;
                }
            });
            if (oldestKey === null) return;
            const gl = this.gl;
            const entry = this.targetPool.get(oldestKey);
            entry.targets.forEach(target => {
                if (!target) return;
                gl.deleteTexture(target.texture);
                gl.deleteFramebuffer(target.framebuffer);
            });
            this.targetPool.delete(oldestKey);
        }

        /** 当前主题是不是亮色（扩展把主题写在 <html data-theme> 上）。 */
        isLightTheme() {
            const theme = document.documentElement.getAttribute('data-theme');
            if (theme) return theme === 'light';
            return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
        }

        /**
         * 渲染一块玻璃到 FBO，再把结果贴到目标 2D canvas。
         * topPixel 是 vUv 坐标（左下原点）里的玻璃左上角，按「最大画布」归一化。
         */
        render(entry, viewWidth, viewHeight, frame, reset) {
            const gl = this.gl;
            const material = entry.material;
            const uniforms = this.uniforms;
            const writeTarget = 1 - this.readTarget;
            const pointer = entry.pointer;
            const width = entry.canvasWidth;
            const height = entry.canvasHeight;
            // 共享 FBO 只服务「此刻正在渲的这一块」：尺寸跟着它走，
            // uRect 落在 (0,0)，导出时也是 1:1 拷贝。十几块玻璃一个接一个复用这组 FBO，
            // 各自的累积历史存在自己的 historyTexture 里，互不干扰。
            // 共享 FBO 尺寸变了 => 这块玻璃的历史无意义，累积从头开始
            if (this.ensureTargets(width, height)) reset = true;

            gl.disable(gl.BLEND);
            gl.disable(gl.SCISSOR_TEST);
            gl.colorMask(true, true, true, true);
            gl.viewport(0, 0, this.width, this.height);
            gl.bindVertexArray(this.vertexArray);
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.targets[writeTarget].framebuffer);
            gl.useProgram(this.traceProgram);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.sceneTexture);
            gl.uniform1i(uniforms.uScene, 0);
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, this.targets[this.readTarget].texture);
            gl.uniform1i(uniforms.uPrevious, 1);

            gl.uniform2f(uniforms.uResolution, this.width, this.height);
            // uRect 用「画布坐标」= 原点对齐：FBO 与默认帧缓冲同尺寸、导出时按 rect 左上角裁切，
            // 所以着色器里矩形必须落在 (0,0)，否则玻璃的整个光学区域都在画布外。
            gl.uniform4f(uniforms.uRect, 0, 0, entry.rect[2], entry.rect[3]);
            gl.uniform1f(uniforms.uRadius, entry.radius);
            gl.uniform1f(uniforms.uFrame, frame);
            gl.uniform2f(uniforms.uMouse, pointer[0], pointer[1]);
            gl.uniform1f(uniforms.uSceneValid, this.sceneValid ? 1 : 0);
            gl.uniform1f(uniforms.uDevicePixelRatio, entry.pixelRatio);
            // 场景坐标：元素左上角在视口里的位置（画布像素）+ 视口尺寸（画布像素）。
            // 壁纸容器铺满视口、视口就是整页，所以这里直接用视口尺寸做分母。
            gl.uniform4f(
                uniforms.uSceneRect,
                entry.offset[0],
                entry.offset[1],
                this.sceneDrawSize[0],
                this.sceneDrawSize[1]
            );
            gl.uniform2f(uniforms.uSceneOrigin, this.sceneDrawOrigin[0], this.sceneDrawOrigin[1]);

            gl.uniform1f(uniforms.uReverseDisplacement, material.reverseDisplacement);
            gl.uniform1f(uniforms.uEdgeCurvature, material.edgeCurvature);
            gl.uniform1f(uniforms.uOpticalThickness, material.opticalThickness);
            gl.uniform1f(uniforms.uEdgeBandRatio, material.edgeBandRatio);
            gl.uniform1f(uniforms.uRefractionVisibleRatio, material.refractionVisibleRatio);
            gl.uniform1f(uniforms.uBlendFeather, material.blendFeatherPx * entry.pixelRatio);
            gl.uniform1f(uniforms.uFrostedStrength, material.frostedStrength);
            gl.uniform1f(uniforms.uFrostedAttenuation, material.frostedAttenuation);
            gl.uniform1f(uniforms.uBlurSpacing, material.blurSpacingPx * entry.pixelRatio);
            gl.uniform1f(uniforms.uDispersionStrength, material.dispersionStrength);
            gl.uniform1f(uniforms.uHighlightStrength, material.highlightStrength);
            // 边缘描边独立取值：对齐参考库的 u_edgeHL * 0.55（≈0.0275）。
            // 之前这里乘 12 是为了让 0.05 量级的值可见，现在拆成独立 uniform 后
            // 直接给绝对值，不再需要那个放大系数 —— 放大系数正是白边的直接成因。
            gl.uniform1f(
                uniforms.uEdgeStroke,
                material.edgeStroke != null ? material.edgeStroke : 0.03
            );
            // 主题决定用深色还是浅色玻璃。读 html[data-theme] 而不是 matchMedia：
            // 扩展的主题是写死在这个属性上的，跟随系统的结果也最终落到这里。
            const isLight = this.isLightTheme();
            // 护栏：material 没写 tintColor 时回落到 REFERENCE 默认值。
            // 直接传 undefined 会让 uniform3fv 跳过上传，这块玻璃就会沿用
            // 上一块（可能是别的档位）的颜色，症状是同一页玻璃颜色互不相同。
            const tintColor =
                (isLight && material.tintColorLight) ||
                material.tintColor ||
                (isLight ? REFERENCE.material.tintColorLight : REFERENCE.material.tintColor);
            gl.uniform3fv(uniforms.uTintColor, tintColor);
            gl.uniform1f(
                uniforms.uTintMix,
                isLight && material.tintMixLight != null ? material.tintMixLight : material.tintMix
            );
            gl.uniform1f(uniforms.uTintLift, isLight ? 1 : 0);
            // 深色档的 tint 上限：material.tintMixCap 显式给值才生效，
            // 其余档位（搜索框、卡片）保持 0 = 不限制，行为完全不变。
            gl.uniform1f(
                uniforms.uTintLiftCap,
                !isLight && material.tintMixCap != null ? material.tintMixCap : 0
            );
            // 深色档压暗方式：material.tintShade 显式给值才走「保色相压暗」，
            // 其余档位保持 0 = 旧的混色行为，视觉效果完全不变。
            gl.uniform1f(
                uniforms.uTintShade,
                !isLight && material.tintShade != null ? material.tintShade : 0
            );
            // 深色主题的亮度封顶开关：material.darkLift 显式给值才生效。
            // 默认 0 = 完全不干预，其余档位视觉零变化。
            gl.uniform1f(
                uniforms.uDarkLift,
                !isLight && material.darkLift != null ? material.darkLift : 0
            );
            gl.uniform1f(
                uniforms.uBodyBend,
                material.bodyBend != null ? material.bodyBend : REFERENCE.optics.bodyBend
            );
            gl.drawArrays(gl.TRIANGLES, 0, 3);

            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, this.width, this.height);
            // 默认帧缓冲先清成透明，再让 display 着色器用它自己的 alpha 覆盖
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.disable(gl.BLEND);
            gl.useProgram(this.displayProgram);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.targets[writeTarget].texture);
            gl.uniform1i(this.displayUniform, 0);
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, entry.historyTexture);
            gl.uniform1i(this.displayHistoryUniform, 1);
            // 累积：第 n 帧与保留的上一帧按 1/(n+1) 混合，越到后面越稳（抖动噪声被抹平）。
            // 权重在这里算而不是在 shader 里，是因为 FBO 是共享的一组、
            // 每块玻璃的累积帧数各自独立，只有 JS 侧同时知道两者。
            gl.uniform1f(
                this.displayHistoryWeightUniform,
                reset || frame === 0 ? 0 : 1 / (frame + 1)
            );
            gl.drawArrays(gl.TRIANGLES, 0, 3);

            // 贴到玻璃自己的 2D canvas，并把这一帧留作下一帧的历史。
            // 共享 FBO 不保存历史：一组 ping-pong 纹理要服务十几块玻璃，
            // 谁也留不住自己上一帧，所以历史放在各自的历史纹理里。
            // 顺序必须「先贴 canvas 再拷历史」：copyTexSubImage2D 要读默认帧缓冲，
            // 而最后一次 bindFramebuffer(null) 之后缓冲内容仍在，只是不能先绑历史纹理再读。
            const context = entry.context;
            context.globalCompositeOperation = 'copy';
            // 源矩形必须以「左下角」为基准：canvas 只增不减（见 ensureCanvasSize），
            // 所以它可能比当前玻璃大；WebGL 原点在左下，viewport 也锚在左下，
            // 内容固定落在 (0,0)-(width,height) 这块里。canvas 比它高多少，
            // 源矩形的上边缘就要往下让多少 —— 否则会取到上方的空白，
            // 导出的就是一块全透明（缩放窗口后玻璃集体消失的经典症状）。
            const srcY = this.canvas.height - height;
            context.drawImage(this.canvas, 0, srcY, width, height, 0, 0, width, height);
            context.globalCompositeOperation = 'source-over';
            // 历史纹理用 GPU 内部拷贝，不再走 canvas → texImage2D 的 CPU 读回：
            // 读回一次要 ~1.7ms×16 块 ≈ 28ms/帧，直接把 60fps 打掉。
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, entry.historyTexture);
            gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, width, height);
            gl.bindTexture(gl.TEXTURE_2D, null);

            this.readTarget = writeTarget;
        }

        dispose() {
            this.disposed = true;
            const gl = this.gl;
            if (gl) {
                // 池子里每一组都要删（不只是当前这组），否则重建 renderer 会泄漏
                this.targetPool.forEach(entry => {
                    entry.targets.forEach(target => {
                        if (!target) return;
                        gl.deleteTexture(target.texture);
                        gl.deleteFramebuffer(target.framebuffer);
                    });
                });
                this.targetPool.clear();
                if (this.sceneTexture) gl.deleteTexture(this.sceneTexture);
                if (this.vertexBuffer) gl.deleteBuffer(this.vertexBuffer);
                if (this.vertexArray) gl.deleteVertexArray(this.vertexArray);
                if (this.traceProgram) gl.deleteProgram(this.traceProgram);
                if (this.displayProgram) gl.deleteProgram(this.displayProgram);
            }
            this.targets = [];
            this.gl = null;
            this.canvas = null;
        }
    }

    /** 单块玻璃的状态：自己的 2D canvas + 几何 + 指向共享渲染器。 */
    /**
     * 按玻璃尺寸给材质参数。
     *
     * 参考库所有比例距离都以 rect.w（短边）为基准，参数本身是「占比」，
     * 所以尺寸不需要线性缩放 —— 需要改的是三个跟"按比例算绝对像素"挂钩的量：
     *   - refractionVisibleRatio：折射可见带占短边的比例。格子越大，同样的比例
     *     对应越宽的物理带，视觉上会从"边缘透镜"退化成"整块扭曲"，故收窄。
     *   - edgeBandRatio：边缘碾压带。大块也要收，否则高光变成一圈粗白边。
     *   - blendFeatherPx / blurSpacingPx：这两项是绝对像素，DPR 已在外层乘过，
     *     大块上适当放大才不显得糊得不够。
     */
    function materialFor(element) {
        const base = { ...REFERENCE.material };
        const rect = element.getBoundingClientRect();
        const shortSide = Math.min(rect.width, rect.height) || 96;
        // 窄长条（搜索框：高度 60 上下、宽度 600）：光学模型里短边就是"玻璃厚度
        // 的方向"，60px 的短边若套小控件那档（厚 2.2）会整块糊成奶白，只剩中心
        // 一小块能读字；这里取薄玻璃 + 窄折射带，读完是"一条压出来的透明弧面"。
        if (rect.height <= 72 && rect.width / Math.max(1, rect.height) >= 3) {
            return {
                ...base,
                opticalThickness: 0.85,
                reverseDisplacement: 0.5,
                edgeCurvature: 0.5,
                // 0.42 → 0.14：搜索框只有 59px 高，0.42 的折射带等于整条都在扭曲，
                // 垂直方向的壁纸纹理被拉成波浪。收窄到贴着上下边的一条。
                edgeBandRatio: 0.2,
                refractionVisibleRatio: 0.14,
                blendFeatherPx: 18,
                frostedStrength: 0.5,
                frostedAttenuation: 0.6,
                blurSpacingPx: 1.5,
                dispersionStrength: 0.14,
                highlightStrength: 0.9,
                edgeStroke: 0.08,
                // 搜索框：浅色 0.34（18px 字要亮度地板）/ 深色 0.72（白字要深底）
                tintMix: 0.72,
                tintMixLight: 0.34,
            };
        }
        // 卡片档按「面积」判而不是只看短边：天气卡 360×104 短边只有 104，
        // 但它是块 37440px² 的大面，套 96px 按钮的参数折射带会占满整条。
        if (shortSide >= 200 || rect.width * rect.height >= 18000) {
            // 大卡片（天气卡、侧栏小工具）：薄一点、雾化多一点，读正文不花眼
            return {
                ...base,
                // 大卡片的浅色口径：底色越白、文字越靠"黑"来撑，tint 不能太薄，
                // 否则紫壁纸从卡面透上来，和白壁纸上的同一张卡差一档。
                tintMixLight: 0.26,
                opticalThickness: 1.35,
                refractionVisibleRatio: 0.1,
                edgeBandRatio: 0.17,
                frostedStrength: 0.22,
                frostedAttenuation: 0.62,
                blurSpacingPx: 1.7,
                dispersionStrength: 0.26,
                highlightStrength: 0.9,
                edgeStroke: 0.08,
                tintColor: [0.03, 0.031, 0.04],
                // 卡片档面积大、字多，深色下同样需要更实的底（同根因）
                tintMix: 0.66,
            };
        }
        if (shortSide <= 80) {
            // 小控件（控制按钮）：光学区太小，参数往"厚玻璃珠子"方向拉
            return {
                ...base,
                tintMixLight: 0.24,
                // 小控件只有 44–66px，比例参数要更克制，
                // 否则整颗"玻璃珠"只剩变形、看不出是玻璃。
                opticalThickness: 1.6,
                reverseDisplacement: 0.9,
                refractionVisibleRatio: 0.16,
                edgeBandRatio: 0.24,
                frostedStrength: 0.16,
                dispersionStrength: 0.3,
                highlightStrength: 0.9,
                edgeStroke: 0.08,
                // 小控件：深色下同样要过 AA
                tintMix: 0.6,
            };
        }
        // 正方形格子（快捷块）：参考库默认参数，只补浅色口径 —— 格子小、内容少，
        // 要留更多壁纸本色才能看出"透过去的图标"。
        return {
            ...base,
            // 小方格的"液体感"几乎全靠中段位移：默认 curvature 下整块像平卡只有一圈亮边，
            // 这里按「厚玻璃珠」取：更厚、更弯、色散更明显。
            // tintMixLight 0.34 → 0.16：浅壁纸上那层"白雾"就是近白色 tint 混进来的，
            // 混 34% 时壁纸的深色被抬成中灰，格子/条纹全糊成一片。
            // 玻璃的辨识度交给折射带与边缘高光，平滑区只留很薄一层。
            // 浅色 0.08：实测平坦壁纸下 tint=0 时 canvas 输出与壁纸逐像素相同
            // （#6a3d9a → [106,61,154] 完全一致），色偏 100% 来自 tint 与提亮。
            // 0.08 是"留一层几乎察觉不到的染色"的下限，再低玻璃会读成空洞。
            // 深色 0.68 → 0.42：0.68 是把 68% 的墨色混进采样结果，剩下 32% 才是
            // 折射来的颜色 —— 亮壁纸（蓝天白云）被压成一块均匀的深灰蓝，读起来
            // 就是"不透明板"。用户的原话是"应该和搜索框一样通透"。
            // 0.42 在白字可读性（AA）与通透之间取得平衡：实测中心像素从
            // [86,113,144] 提到 [102,141,180]，蓝色饱和度明显回来。
            // 不再往下压的原因：玻璃是压在白/亮壁纸上的，tint 太薄白字会糊。
            tintMix: 0.42,
            tintMixLight: 0.08,
            // 深色档改走「保色相压暗」而不是「混一层深灰」。
            //
            // 这是"白雾"的真正成因（不是采样坐标、也不是 frosted）：
            // 混色方程 mix(c, tintColor, m) 会把颜色的三通道一起往 tintColor 拉，
            // tintColor 是中性深灰 → 高饱和色被拉向灰，读起来就是蒙了一层白灰纱。
            // 纯红壁纸实测 [255,0,0] → [206,58,65]（饱和度 1.0 → 0.718），
            // 蓝天壁纸 [52,131,214] → [183,192,204]（糊成浅灰）。
            //
            // shade 模式只乘一个系数（保留色相与饱和度），压暗效果一样但颜色不脏：
            // 纯红 [255,0,0] → [242,0,0]（饱和度仍是 1.0）。
            // 0.97 是实测"几乎完全保真"的点，深色下白字对比度依然够（配 CSS 的
            // --glass-fill 深墨底），再往下压颜色就开始发闷。
            tintShade: 0.97,
            // 深色主题的亮度封顶：亮壁纸（雪地、白云）不让白字失读。
            // tintShade 只做「整体压暗」，对 0.92 这种亮壁纸压到 0.89 依然白得刺眼；
            // darkLift 只对超过 0.34 的亮度做压缩，暗壁纸一个字节都不动。
            // 必须是 1.0 —— 它是个**线性插值系数**，不是"额外增益"。
            // 0.86 意味着只施加 86% 的压缩：白底从 1.0 只降到线性 0.297（sRGB 148,
            // 白字 3.2:1），差得远。计算式：scale = mix(1.0, 0.182, darkLift)。
            // 想要「算出来的就是生效的」，系数只能是 1。
            // 极端情况（整张纯白壁纸）由公式自己兜住：cap + 余量*0.13 天然 <= 0.19。
            darkLift: 1.0,
            // tintColor / tintColorLight 必须显式给：这个档位以前漏了，
            // uniform3fv(undefined) 会让 WebGL 保留上一次（别的档位）的值，
            // 颜色随机串味。与卡片档同色系，深色主题下是一层极淡的冷墨。
            tintColor: [0.035, 0.035, 0.045],
            tintColorLight: [0.97, 0.975, 0.985],
            // ── 方格档的三条"反平"参数（暗色下发灰平板问题的根因）──────────
            //
            // 方格读起来像一块不透明深灰板，不是 canvas 没画（实测 avg
            // [65,81,66] 与搜索框 [82,97,97] 同量级），而是**中段完全没被折射
            // 扫过**：下面的三条参数叠在一起，把 112px 的格子做成了「只有一圈
            // 边缘光的实心片」。
            //
            // bodyBend 0.15 → 0.5：这是最关键的一条。bodyBend 是"整块缓弯"，
            // 0.15 时中段位移只有边缘的 15%，整块玻璃除边带外逐像素等于壁纸
            // 本身 —— 看上去就是贴了张图的平板。参考库原值 0.55，这里取 0.5
            // （方格面积小，比参考库略收一点，避免 11px 条纹被揉成波浪）。
            // 注意这个值**必须**与 edgeBandRatio 配合：前面用 max() 做过一次
            // 会让 bodyBend<1 永远输给 lensCurve，正确的实现是两者相加
            // （见 refractedPosition 里的 bend = clamp(lensCurve + bodyCurve*uBodyBend)）。
            bodyBend: 0.5,
            // opticalThickness 0.9：厚度直接乘进位移量，0.9 是方格尺寸下的甜点。
            opticalThickness: 0.9,
            edgeCurvature: 0.66,
            // reverseDisplacement 0.5：边缘把像素卷回来的幅度，过大压出光带。
            reverseDisplacement: 0.5,
            // ── 折射带宽度：方格档最关键的几何约束 ──────────────────────────
            //
            // 搜索框为什么"通透"：shader 里 refractionBand = 短边 × ratio，
            // 搜索框 59px 高时带子 8~17px，**上下两条各占一半高度**，整条玻璃
            // 几乎全在折射带里 —— 没有"中间那块纯平面"。
            //
            // 方格 112px 时同样 17px 的带子只贴着四边，中心留着 78×78 的
            // 纯平滑区，那块就是肉眼看到的"深灰平板"。
            //
            // edgeBandRatio 0.16 → 0.28：112 × 0.28 = 31px 的折射带，四边各吃
            // 31px 后中心剩 50×50 —— 边缘的弧面/弯折读得清楚，中心仍留一块
            // 可读的平滑区（图标与文字压在这里，全糊就没法认了）。
            // 0.22：0.28 时带子 31px、中心只剩 50×50，可读区太小且过渡偏硬；
            // 0.22（≈25px）让边缘弧面清晰，中心留出 62×62 的平滑区。
            edgeBandRatio: 0.22,
            // refractionVisibleRatio 0.10 → 0.12（只微调）。
            //
            // 这一条**不能**跟着 edgeBandRatio 一起放大：它决定的是「雾化从
            // 多深开始接管」。shader 里 blurWeight = smoothstep(band-feather,
            // band+feather, depth)，band = 短边 × 本值：
            //   方格 112px：0.30 → band 33.6，feather 49.6 → 深度 >50 全糊，
            //               而中心深度正好 56 —— 整块糊成一片色块（实测截图里
            //               斜线被洗成均匀蓝灰，圆点糊成硬边方块）。
            //               0.12 → band 13.4，feather 29.4 → 只有最中心一小圈
            //               参与雾化，边缘的折射保持锐利。
            //   搜索框 59px：0.14 → band 8.3 是同一档口径（59 × 0.14 ≈ 112 × 0.074），
            //               所以方格取 0.12 实际比搜索框的带子还宽一点。
            // 0.16：配合 edgeBandRatio 0.22，雾化从 18px 深度开始接管（feather 18），
            // 中心仍保留清晰采样 —— 上一轮试过 0.30 导致 band+feather 覆盖整块、
            // 格子糊成均匀色块，那条路已经证伪，0.16 是它的安全邻域。
            refractionVisibleRatio: 0.16,
            // frostedStrength 0.03 → 0.30：0.03 时 frostMix ≈ 0，雾化层等于不存在，
            // 折射带与平滑区之间是一条硬接缝（"平板感"的另一半来源）。
            // 搜索框用 0.5，方格面积小、内容少，0.30 实测雾化层仍几乎看不出来
            // （frostMix = blurWeight × 0.30 × 0.55 ≈ 0.165），玻璃读起来像一块
            // 上色的板。抬到 0.45（frostMix ≈ 0.28）后与搜索框同量级，边缘到
            // 中心是渐隐的柔过渡，而不是一条硬接缝。
            frostedStrength: 0.45,
            frostedAttenuation: 0.6,
            // blendFeatherPx：折射带 → 平滑区的过渡宽度（绝对像素，DPR 在外层乘）。
            // 参考库默认 12，方格与搜索框（18）同量级，取 16 让 11→17px 的带子
            // 自然消失，而不是在带边界上留一道台阶。
            blendFeatherPx: 18,
            // blurSpacingPx 1.5：与搜索框同值。方格原来不设这一项，回落到 1.0，
            // 高斯采样步长偏小 → 雾化区看起来是"半透明色斑"而不是"磨砂玻璃"。
            blurSpacingPx: 1.5,
            dispersionStrength: 0.34,
            highlightStrength: 0.9,
            edgeStroke: 0.08,
        };
    }

    /**
     * 标记只给「本来就是 static、且从不被 app 移动」的块。
     * 天气卡/两翼/fixed 列一旦被改成 relative 就掉回文档流，整页布局跟着下沉；
     * 它们自带定位上下文，canvas 不需要标记也能正确落位。
     */
    function shouldMark(element) {
        const position = getComputedStyle(element).position;
        if (position !== 'static') return false;
        return !NO_MARKER_CLASSES.some(cls => element.classList.contains(cls));
    }

    class GlassSurface {
        constructor(element, renderer) {
            this.element = element;
            this.renderer = renderer;
            this.canvas = document.createElement('canvas');
            this.canvas.className = 'liquid-glass-canvas';
            this.canvas.setAttribute('aria-hidden', 'true');
            this.context = this.canvas.getContext('2d');
            this.historyTexture = null;
            this.frozenImage = null;
            this.canvasWidth = 1;
            this.canvasHeight = 1;
            this.pixelRatio = 1;
            this.rect = [0, 0, 1, 1];
            this.radius = 24;
            this.offset = [0, 0];
            this.pointer = [0.5, 0.5];
            // 每类玻璃按尺寸选材质：参考库的默认值是给按钮（~96px 高）调的，
            // 直接套到 168px 方格上折射带过宽、色散被摊薄；小控件则相反。
            this.material = materialFor(element);
            // has-liquid-glass 会改写背景与定位（position:relative），只给「本来就是
            // 文档流内普通块」的元素加。天气卡是 position:fixed（钉在右上角）、
            // 两翼小组件在 fixed 列里，套上 relative 就掉回文档流 —— 实测症状正是
            // 天气卡变成占位块、把整列主内容连同侧栏一起往下顶。
            if (shouldMark(element)) element.classList.add('has-liquid-glass');
            element.classList.add('is-glass-pending');
            element.appendChild(this.canvas);
        }

        /**
         * 同步几何。viewWidth/viewHeight 是「共享画布」的尺寸（画布像素），
         * 用来把元素位置换算成 uRect / uSceneRect。
         */
        measure(rect, radius, pixelRatio, viewWidth, viewHeight) {
            const dpr = Math.min(pixelRatio || 1, REFERENCE.rendering.maxDpr);
            const width = Math.max(1, Math.round(rect.width * dpr));
            const height = Math.max(1, Math.round(rect.height * dpr));
            const left = Math.round(rect.left * dpr);
            const top = Math.round(rect.top * dpr);
            this.pixelRatio = dpr;
            this.radius = Math.max(0, radius) * dpr;
            // vUv 是左下原点：y 要翻过来
            this.rect = [left, Math.round(viewHeight - top - height), width, height];
            this.offset = [left, top];
            if (width !== this.canvasWidth || height !== this.canvasHeight) {
                this.canvasWidth = width;
                this.canvasHeight = height;
                this.canvas.width = width;
                this.canvas.height = height;
                this.ensureHistoryTexture(width, height);
                // 尺寸变了旧历史无意义；没变就继续累积 —— 否则每帧
                // 都把这块玻璃拉回第 0 帧，画面上就是一直在抖。
                this.frame = 0;
            }
        }

        /**
         * 拖拽前的「冻结」：把当前 canvas 内容烤成一张静态 <img> 盖在上面。
         *
         * 为什么必须这么做：浏览器在 dragstart 那一刻给被拖元素拍快照，而快照
         * 不会渲染 WebGL 后备缓冲 —— 实测 dragstart 里读 canvas 拿到的是
         * [0,0,0,0]（全透明）。于是拖影只剩文字和底色，图标凭空消失，
         * 用户看到的就是"拖不动"。烤成 <img> 之后快照里有真实像素。
         *
         * 只在拖拽期间存在，onEnd 立刻移除，不增加常态开销。
         */
        freeze() {
            if (this.frozenImage || !this.canvas || !this.context) return;
            try {
                const snapshot = document.createElement('img');
                snapshot.src = this.canvas.toDataURL('image/png');
                snapshot.className = 'liquid-glass-freeze';
                snapshot.setAttribute('aria-hidden', 'true');
                Object.assign(snapshot.style, {
                    position: 'absolute',
                    inset: '0',
                    width: '100%',
                    height: '100%',
                    borderRadius: 'inherit',
                    pointerEvents: 'none',
                    zIndex: '-1',
                });
                this.element.appendChild(snapshot);
                this.frozenImage = snapshot;
            } catch (error) {
                console.warn('[liquid-glass] 拖拽快照失败:', error && error.message);
            }
        }

        unfreeze() {
            if (!this.frozenImage) return;
            this.frozenImage.remove();
            this.frozenImage = null;
        }

        /**
         * 累积历史纹理：内容是「这块玻璃自己上一帧的合成结果」。
         * 共享 FBO 不保存历史（一组 ping-pong 要服务十几块玻璃），
         * 所以每块玻璃用 RGB10_A2 存一份自己的中间帧 —— 10 位颜色深度足够了，
         * 真正的累加精度由 JS 侧的权重保证。
         */
        ensureHistoryTexture(width, height) {
            const gl = this.renderer && this.renderer.gl;
            if (!gl) return;
            if (!this.historyTexture) this.historyTexture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, this.historyTexture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                gl.RGBA,
                width,
                height,
                0,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                null
            );
        }

        dispose() {
            this.unfreeze();
            const gl = this.renderer && this.renderer.gl;
            if (gl && this.historyTexture) gl.deleteTexture(this.historyTexture);
            this.historyTexture = null;
            if (this.canvas && this.canvas.parentNode) {
                this.canvas.parentNode.removeChild(this.canvas);
            }
            if (this.element) {
                this.element.classList.remove('has-liquid-glass');
                this.element.classList.remove('is-glass-pending');
            }
            this.canvas = null;
            this.context = null;
            this.element = null;
        }
    }

    /**
     * Mount helper：给元素挂一层液态玻璃。
     * 元素自带 backdrop-filter 作为底层，canvas 只负责折射/色散/高光这些 CSS 做不到的部分。
     *
     * 所有玻璃共用一个渲染器（一个 WebGL2 上下文）。每块玻璃的记录里带一个
     * 「累积帧」计数 —— 场景/几何不变时渲满 48 帧就停，省电；一变就归零重来。
     */
    class LiquidGlass {
        constructor() {
            this.surfaces = new Map();
            this.renderer = null;
            this.sceneUrl = '';
            this.enabled = false;
            this.observer = null;
            this.raf = 0;
            this.handleResize = this.handleResize.bind(this);
            this.handlePointerMove = this.handlePointerMove.bind(this);
            this.tick = this.tick.bind(this);
        }

        static isSupported() {
            // 结果缓存：创建 WebGL2 上下文要初始化驱动，实测单个 ~40ms，
            // 而且探针 canvas 的上下文不会主动释放（Chrome 上限约 16 个）。
            if (LiquidGlass._supported !== undefined) return LiquidGlass._supported;
            try {
                const probe = document.createElement('canvas');
                const gl = probe.getContext('webgl2');
                LiquidGlass._supported = Boolean(gl);
                // 立刻归还上下文，别占配额
                if (gl) gl.getExtension('WEBGL_lose_context')?.loseContext();
            } catch {
                LiquidGlass._supported = false;
            }
            return LiquidGlass._supported;
        }

        start() {
            if (this.enabled) return true;
            if (!LiquidGlass.isSupported()) return false;

            // 先按设备能力选档，再建 renderer —— pathsPerPixel 是编译期常量，
            // 建完再改就得重编译着色器，所以必须在 new GlassRenderer() 之前定下来。
            applyTier(detectTier());
            this.tier = activeTier;

            this.renderer = new GlassRenderer();
            if (!this.renderer.init()) {
                this.renderer = null;
                return false;
            }
            // 壁纸纹理就绪（或确认失败）后重绘全部玻璃：玻璃常常先于壁纸挂载，
            // 那批累积帧渲的是空场景，不重画就会一直停在半成品上。
            this.renderer.onSceneReady = () => this.schedule(true);
            this.enabled = true;
            this.refresh();
            this.watchNativeDrag();
            // 观察器只负责「页面结构变了，需要重新点一遍玻璃清单」。
            // 旧写法对任何属性改动都 schedule(true) —— 而 schedule(true) 会把每块玻璃的
            // 累积帧清零。番茄钟每秒改一次文字节点、待办输入框每次按键都在改 class，
            // 于是整页玻璃每秒从头累积一次，画面上就是持续闪烁。
            // 现在：结构变化去抖后只做 refresh()，几何变化由 measure() 自己发现。
            this.observer = new MutationObserver(records => {
                const structural = records.some(r => r.type === 'childList');
                if (!structural) return;
                if (this.observeTimer) return;
                this.observeTimer = setTimeout(() => {
                    this.observeTimer = 0;
                    this.refresh();
                }, 120);
            });
            this.observer.observe(document.body, { childList: true, subtree: true });
            window.addEventListener('resize', this.handleResize, { passive: true });
            window.addEventListener('scroll', this.handleResize, { passive: true });
            document.addEventListener('pointermove', this.handlePointerMove, { passive: true });

            // 首帧实测降级：硬件核数只是静态信号，真正吃力与否要看跑起来。
            // 等玻璃渲完再测一次帧间隔，明显掉帧就往下降一档（只需重建 renderer 一次）。
            this.probeAndDowngrade();
            return true;
        }

        /**
         * 启动后实测帧健康度，慢了自动降级。
         *
         * 时机：延迟到首屏累积结束之后（避免把正常的渲染尖峰当成「机器慢」），
         * 且只跑一次，不做常驻监控 —— 降级是「一次性兜底」而不是动态调参。
         */
        probeAndDowngrade() {
            const downgrade = ['high', 'mid', 'low'];
            const stepDown = async () => {
                // 等玻璃累积收敛（最多 1.2s），此时帧间隔反映的是稳定态
                await new Promise(r => setTimeout(r, 1200));
                if (!this.enabled) return;
                const medianGap = await probeFrameHealth();
                const currentIndex = downgrade.indexOf(activeTier);
                // 中位帧间隔 > 26ms ≈ 38fps 以下：说明这台机器带不动当前档
                if (medianGap > 26 && currentIndex < downgrade.length - 1) {
                    const nextTier = downgrade[currentIndex + 1];
                    console.info(
                        `[液态玻璃] 实测中位帧间隔 ${Math.round(medianGap)}ms，从 ${activeTier} 降级到 ${nextTier}`
                    );
                    applyTier(nextTier);
                    this.tier = nextTier;
                    // pathsPerPixel 变了必须重建着色器；累积帧上限直接生效
                    this.rebuildRenderer();
                }
            };
            stepDown().catch(() => {
                /* 探测失败不影响主流程 */
            });
        }

        /** 按当前档位重建渲染器（仅降级时调用一次）。 */
        rebuildRenderer() {
            const previousScene = this.sceneUrl;
            if (this.renderer) this.renderer.dispose();
            this.renderer = new GlassRenderer();
            if (!this.renderer.init()) {
                this.renderer = null;
                this.enabled = false;
                return;
            }
            this.renderer.onSceneReady = () => this.schedule(true);
            // 玻璃各自的 historyTexture 属于旧 renderer，需要重建
            this.surfaces.forEach(surface => {
                surface.renderer = this.renderer;
                surface.historyTexture = null;
                surface.frame = 0;
                surface.ensureHistoryTexture(surface.canvasWidth, surface.canvasHeight);
            });
            if (previousScene) this.renderer.setScene(previousScene);
            this.lastGeometry = null;
            this.schedule(true);
        }

        stop() {
            if (!this.enabled) return;
            this.enabled = false;
            if (this.observer) this.observer.disconnect();
            this.observer = null;
            if (this.observeTimer) clearTimeout(this.observeTimer);
            this.observeTimer = 0;
            if (this.raf) cancelAnimationFrame(this.raf);
            this.raf = 0;
            window.removeEventListener('resize', this.handleResize);
            window.removeEventListener('scroll', this.handleResize);
            document.removeEventListener('pointermove', this.handlePointerMove);
            this.surfaces.forEach(surface => surface.dispose());
            this.surfaces.clear();
            if (this.renderer) this.renderer.dispose();
            this.renderer = null;
        }

        /**
         * 拖拽开始/结束的统一入口：拖拽期间把每块玻璃烤成静态图，
         * 让浏览器的拖影快照里有真实像素（见 GlassSurface.freeze 的注释）。
         */
        /**
         * 拖拽开始前把玻璃烤成静态图。
         *
         * 时序是这里的关键：浏览器在 dragstart **事件派发的过程中**就给被拖元素
         * 拍快照，而 SortableJS 的 onStart 在 dragstart 之后才跑 —— 从 onStart
         * 里冻结已经晚了（实测 images:0）。所以这一步必须挂在原生 dragstart 的
         * 捕获阶段，抢在浏览器取像素之前。
         */
        freezeAll() {
            this.surfaces.forEach(surface => surface.freeze());
        }

        unfreezeAll() {
            this.surfaces.forEach(surface => surface.unfreeze());
        }

        /** 监听原生拖拽事件，自己负责冻结/解冻，不依赖 Sortable 的回调顺序。 */
        watchNativeDrag() {
            if (this.nativeDragBound) return;
            this.nativeDragBound = true;
            // 捕获阶段：早于任何冒泡监听，也早于浏览器对元素的快照
            document.addEventListener(
                'dragstart',
                () => {
                    this.freezeAll();
                },
                true
            );
            document.addEventListener('dragend', () => this.unfreezeAll(), true);
            document.addEventListener('drop', () => this.unfreezeAll(), true);
        }

        /** 壁纸变化时调用：重新加载场景纹理并重渲。 */
        setScene(url) {
            this.sceneUrl = url || '';
            if (this.renderer) this.renderer.setScene(this.sceneUrl);
            this.schedule(true);
        }

        /**
         * 排队一次渲染。reset=true 表示几何/场景变了，累积帧要归零
         * （否则会把旧位置的历史混进新位置）。
         */
        schedule(reset) {
            if (!this.enabled) return;
            if (reset) {
                this.surfaces.forEach(surface => {
                    surface.frame = 0;
                });
            }
            if (this.raf) return;
            this.raf = requestAnimationFrame(this.tick);
        }

        handleResize() {
            // 视口变了，background-size: cover 的绘制矩形也跟着变 ——
            // 不重算的话采样会整体错位（缩放窗口后玻璃下蒙雾的经典成因）。
            if (this.renderer && this.renderer.sceneImageSize) {
                this.renderer.updateSceneDrawRect(
                    this.renderer.sceneImageSize[0],
                    this.renderer.sceneImageSize[1]
                );
            }
            this.schedule(true);
        }

        handlePointerMove(event) {
            if (!this.enabled) return;
            // 指针移动只改变菲涅耳微倾（视觉上是玻璃边缘几个像素的偏移），
            // 每像素都跑一遍 getBoundingClientRect × 22 块纯属浪费：
            // 限制到 ~30Hz，并且只在还有玻璃未累积完时才算。
            const now = performance.now();
            if (now - (this._lastPointerAt || 0) < 33) return;
            this._lastPointerAt = now;
            if (
                [...this.surfaces.values()].every(
                    s => s.frame >= REFERENCE.rendering.maxAccumulation
                )
            ) {
                return;
            }
            const viewWidth = Math.max(1, window.innerWidth);
            const viewHeight = Math.max(1, window.innerHeight);
            let touched = false;
            this.surfaces.forEach((surface, element) => {
                const rect = element.getBoundingClientRect();
                const inside =
                    event.clientX >= rect.left - 8 &&
                    event.clientX <= rect.right + 8 &&
                    event.clientY >= rect.top - 8 &&
                    event.clientY <= rect.bottom + 8;
                if (!inside) {
                    surface.pointer = [event.clientX / viewWidth, event.clientY / viewHeight];
                } else {
                    surface.pointer = [
                        (event.clientX - rect.left) / Math.max(1, rect.width),
                        (event.clientY - rect.top) / Math.max(1, rect.height),
                    ];
                }
                // 指针只影响菲涅耳微倾，累积到一定帧数后就不必再刷了
                if (surface.frame < REFERENCE.rendering.maxAccumulation) touched = true;
            });
            if (touched) this.schedule(false);
        }

        /** 元素够大、且没有被显式隐藏，才值得为它开一张画布。 */
        isEligible(element) {
            if (element.classList.contains('has-liquid-glass')) return true;
            const rect = element.getBoundingClientRect();
            if (rect.width < 24 || rect.height < 24) return false;
            const style = getComputedStyle(element);
            return style.visibility !== 'hidden' && style.display !== 'none';
        }

        /** 把现有元素几何同步到 surface，并算出共享画布所需尺寸。 */
        measure() {
            const dprView = Math.min(window.devicePixelRatio || 1, REFERENCE.rendering.maxDpr);
            const viewWidth = Math.max(1, Math.round(window.innerWidth * dprView));
            const viewHeight = Math.max(1, Math.round(window.innerHeight * dprView));
            const entries = [];
            this.surfaces.forEach((surface, element) => {
                const rect = element.getBoundingClientRect();
                const style = getComputedStyle(element);
                const radius = parseFloat(style.borderTopLeftRadius) || 16;
                entries.push({ surface, rect, radius });
            });
            entries.forEach(({ surface, rect, radius }) => {
                surface.measure(rect, radius, dprView, viewWidth, viewHeight);
            });
            return { viewWidth, viewHeight };
        }

        /**
         * 轻量几何探针：只读 rect（不读 computedStyle），比 measure() 便宜得多。
         * 用来发现「布局在挂载之后才稳定」——挂载时字体没加载完、图片没占位、
         * grid 行高没定，第一次量到的矩形是错的；而 tick() 的缓存规则是
         * 「只有 frame === 0 才重量」，错几何会一直被复用，直到窗口 resize。
         * 症状正是：首屏玻璃像不透明深灰板，缩放窗口后立刻恢复正常。
         */
        geometryChanged() {
            if (!this.lastRects) return true;
            let changed = false;
            this.surfaces.forEach((surface, element) => {
                const prev = this.lastRects.get(element);
                const rect = element.getBoundingClientRect();
                if (
                    !prev ||
                    Math.abs(prev.left - rect.left) > 0.5 ||
                    Math.abs(prev.top - rect.top) > 0.5 ||
                    Math.abs(prev.width - rect.width) > 0.5 ||
                    Math.abs(prev.height - rect.height) > 0.5
                ) {
                    changed = true;
                }
                this.lastRects.set(element, {
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height,
                });
            });
            return changed;
        }

        tick() {
            this.raf = 0;
            if (!this.enabled || !this.renderer) return;
            if (!this.surfaces.size) return;

            // 几何只在必要时量：
            //   · 有玻璃要重新开始累积（frame === 0），或
            //   · 布局真的动了（geometryChanged 探针发现某块矩形偏移 > 0.5px）
            // 旧写法每帧都 measure() —— 22 个元素 × 12 帧 = 264 次 getBoundingClientRect
            // + getComputedStyle，全是强制同步布局，所以后来改成只看 frame === 0。
            // 但那个缓存有个致命缺口：玻璃是在 requestIdleCallback 里挂载的，那时
            // 字体、图标、grid 行高都还没定，第一次量到的矩形是错的；而累计期间
            // frame 一直 > 0，缓存就再也不刷新 —— 整页玻璃拿错误几何渲染，读起来
            // 像一块不透明的板。用户描述的症状就是这个：缩放窗口（触发 resize →
            // schedule(true) → frame 归零 → 重量）之后立刻恢复正常。
            // 探针只读 getBoundingClientRect，不碰 getComputedStyle，代价可接受。
            const needsMeasure =
                [...this.surfaces.values()].some(s => s.frame === 0) ||
                !this.lastGeometry ||
                this.geometryChanged();
            let viewWidth;
            let viewHeight;
            if (needsMeasure) {
                const geo = this.measure();
                viewWidth = geo.viewWidth;
                viewHeight = geo.viewHeight;
                this.lastGeometry = geo;
            } else {
                viewWidth = this.lastGeometry.viewWidth;
                viewHeight = this.lastGeometry.viewHeight;
            }

            let pending = false;
            this.surfaces.forEach(surface => {
                const frame = surface.frame;
                if (frame >= REFERENCE.rendering.maxAccumulation) return;
                this.renderer.render(surface, viewWidth, viewHeight, frame, frame === 0);
                surface.frame = frame + 1;
                if (surface.frame < REFERENCE.rendering.maxAccumulation) pending = true;
            });
            if (pending) this.schedule(false);
        }

        refresh() {
            if (!this.enabled) return;
            const found = new Set();
            TARGETS.forEach(selector => {
                document.querySelectorAll(selector).forEach(element => {
                    if (!this.isEligible(element)) return;
                    found.add(element);
                    if (!this.surfaces.has(element)) {
                        this.surfaces.set(element, new GlassSurface(element, this.renderer));
                        this.schedule(false);
                    }
                });
            });
            this.surfaces.forEach((surface, element) => {
                if (!found.has(element) || !element.isConnected) {
                    surface.dispose();
                    this.surfaces.delete(element);
                    this.schedule(false);
                }
            });
        }
    }

    /** 对外只暴露一个入口：挂不上就返回 null，调用方保持 CSS 玻璃外观。 */
    window.LiquidGlass = LiquidGlass;
})();
