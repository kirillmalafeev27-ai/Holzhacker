export const PERFORMANCE_PROFILES = Object.freeze({
  normal: Object.freeze({
    id: "normal",
    label: "Обычный",
    pixelRatio: 1.8,
    antialias: true,
    shadows: true,
    shadowMapSize: 2048,
    fogNear: 40,
    fogFar: 112,
    cameraFar: 165,
    skyWidthSegments: 32,
    skyHeightSegments: 18,
    particleScale: 1,
    environmentStride: 1,
    decorationKeepRatio: 1,
  }),
  low: Object.freeze({
    id: "low",
    label: "Слабый ПК",
    pixelRatio: 1,
    antialias: false,
    shadows: false,
    shadowMapSize: 512,
    fogNear: 28,
    fogFar: 78,
    cameraFar: 106,
    skyWidthSegments: 20,
    skyHeightSegments: 12,
    particleScale: .42,
    environmentStride: 3,
    decorationKeepRatio: .38,
  }),
});

function browserEnvironment() {
  const navigatorObject = globalThis.navigator || {};
  const screenObject = globalThis.screen || {};
  return {
    search: typeof globalThis.location?.search === "string" ? globalThis.location.search : "",
    deviceMemory: Number(navigatorObject.deviceMemory) || 0,
    hardwareConcurrency: Number(navigatorObject.hardwareConcurrency) || 0,
    mobile: /Android|iPhone|iPad|iPod/i.test(navigatorObject.userAgent || ""),
    reducedMotion: Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches),
    screenPixels: (Number(screenObject.width) || 0) * (Number(screenObject.height) || 0),
    devicePixelRatio: Number(globalThis.devicePixelRatio) || 1,
  };
}

export function detectHardwareProfile(environment = browserEnvironment()) {
  const params = new URLSearchParams(environment.search || "");
  const manual = params.get("performance");
  if (manual === "low" || manual === "normal") {
    return { id: manual, manual: true, reason: `manual-${manual}`, score: 0 };
  }

  let score = 0;
  const memory = Number(environment.deviceMemory) || 0;
  const cores = Number(environment.hardwareConcurrency) || 0;
  if (memory && memory <= 2) score += 4;
  else if (memory && memory <= 4) score += 2;
  if (cores && cores <= 2) score += 4;
  else if (cores && cores <= 4) score += 2;
  if (environment.mobile) score += 1;
  if (environment.reducedMotion) score += 1;
  const renderedPixels = (Number(environment.screenPixels) || 0) * Math.pow(Number(environment.devicePixelRatio) || 1, 2);
  if (renderedPixels > 4_000_000 && (!memory || memory <= 8)) score += 1;
  return {
    id: score >= 3 ? "low" : "normal",
    manual: false,
    reason: score >= 3 ? "hardware" : "hardware-ok",
    score,
  };
}

export function stableFraction(name) {
  let hash = 2166136261;
  for (let index = 0; index < name.length; index += 1) {
    hash ^= name.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

export function shouldKeepDecoration(name, ratio) {
  return ratio >= 1 || stableFraction(name) <= ratio;
}

export class PerformanceDetector {
  constructor(environment) {
    const detection = detectHardwareProfile(environment || browserEnvironment());
    this.profile = PERFORMANCE_PROFILES[detection.id];
    this.manual = detection.manual;
    this.reason = detection.reason;
    this.hardwareScore = detection.score;
    this.gpu = "unknown";
    this.warmupSeconds = 0;
    this.sampleSeconds = 0;
    this.sampleFrames = 0;
    this.measuredFps = 0;
  }

  refineWithRenderer(renderer) {
    if (this.manual || this.profile.id === "low") return false;
    const gl = renderer.getContext();
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    const rendererName = String(debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    this.gpu = rendererName;
    let score = 0;
    if (/swiftshader|llvmpipe|software|microsoft basic render/i.test(rendererName)) score += 6;
    if (/intel\(r\)? hd graphics|intel hd graphics|intel\(r\)? uhd graphics 6\d{2}|mali-[tg][0-6]|adreno \(tm\) [3-5]/i.test(rendererName)) score += 3;
    const maxTextureSize = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 0;
    if (maxTextureSize && maxTextureSize <= 4096) score += 2;
    const isWebGL2 = typeof globalThis.WebGL2RenderingContext !== "undefined" && gl instanceof globalThis.WebGL2RenderingContext;
    if (!isWebGL2) score += 1;
    if (score < 3) return false;
    this.profile = PERFORMANCE_PROFILES.low;
    this.reason = "gpu";
    return true;
  }

  observeFrame(dt, active = true) {
    if (!active || this.manual || this.profile.id === "low" || !Number.isFinite(dt) || dt <= 0) return false;
    this.warmupSeconds += dt;
    if (this.warmupSeconds < 3) return false;
    this.sampleSeconds += dt;
    this.sampleFrames += 1;
    if (this.sampleSeconds < 4) return false;
    this.measuredFps = this.sampleFrames / this.sampleSeconds;
    this.sampleSeconds = 0;
    this.sampleFrames = 0;
    if (this.measuredFps >= 43) return false;
    this.profile = PERFORMANCE_PROFILES.low;
    this.reason = "low-fps";
    return true;
  }

  description() {
    if (this.profile.id === "low") {
      return this.reason === "low-fps" ? "низкий FPS · оптимизация включена" : "определён слабый ПК · оптимизация включена";
    }
    return this.manual ? "выбран вручную · обычная графика" : "автоопределение · обычная графика";
  }
}
