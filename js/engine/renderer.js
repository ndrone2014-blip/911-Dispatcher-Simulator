// WebGL2 forward renderer with scalable quality.
//
//  Low     – single pass straight to the canvas: Blinn-Phong, hemisphere ambient,
//            point lights, fog, ACES tone mapping. (The original look, cleaned up.)
//  Medium  – + baked overhead shadow map (rendered once per rebuild, zero per-frame
//            cost), environment reflections with Fresnel, FXAA + vignette post pass.
//  High    – + 4x MSAA render target, soft 5-tap shadows, half-cost bloom.
//  Ultra   – + 12 lights, 9-tap shadows, dynamic shadows (NPCs) refreshed every few frames.
//
// Every expensive feature degrades gracefully: if a framebuffer or extension is
// missing the renderer silently drops that feature instead of failing.
import { mat4, perspective, multiply, viewFromYawPitch, lookAt, ortho } from './math.js';

export const MAX_LIGHTS = 12;

const VS = `#version 300 es
precision highp float;
in vec3 aPos; in vec3 aNormal; in vec2 aUV; in vec3 aColor;
uniform mat4 uModel; uniform mat4 uViewProj;
out vec3 vWorld; out vec3 vNormal; out vec2 vUV; out vec3 vColor;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vWorld = w.xyz; vNormal = mat3(uModel) * aNormal; vUV = aUV; vColor = aColor;
  gl_Position = uViewProj * w;
}`;

const fs = (defs) => `#version 300 es
precision highp float;
precision highp sampler2DShadow;
${defs}
#define MAXL ${MAX_LIGHTS}
in vec3 vWorld; in vec3 vNormal; in vec2 vUV; in vec3 vColor;
uniform vec3 uColor; uniform sampler2D uMap; uniform int uHasMap;
uniform vec3 uEmissive; uniform sampler2D uEmMap; uniform int uHasEm;
uniform float uSpec; uniform float uShine; uniform float uOpacity; uniform int uUnlit; uniform float uRefl;
uniform vec3 uSky; uniform vec3 uGround; uniform vec3 uDirDir; uniform vec3 uDirColor;
uniform int uNumPoints; uniform vec3 uPointPos[MAXL]; uniform vec3 uPointColor[MAXL]; uniform float uPointRange[MAXL];
uniform vec3 uCamPos; uniform vec3 uFogColor; uniform vec2 uFog; uniform float uExposure; uniform float uFlash;
#ifdef SHADOWS
uniform sampler2DShadow uShadow; uniform mat4 uLightVP; uniform float uShadowTexel; uniform int uRecv;
#endif
#ifdef ENVMAP
uniform sampler2D uEnv; uniform float uEnvStrength;
#endif
out vec4 fragColor;
vec3 toLinear(vec3 c) { return c * c; }

#ifdef SHADOWS
float shadowAt(vec3 N) {
  vec4 lp = uLightVP * vec4(vWorld + N * 0.025, 1.0);
  vec3 p = lp.xyz / lp.w * 0.5 + 0.5;
  if (p.x <= 0.0 || p.x >= 1.0 || p.y <= 0.0 || p.y >= 1.0 || p.z >= 1.0) return 1.0;
  float z = p.z - 0.0015;
  #if SHADOW_TAPS == 1
    return texture(uShadow, vec3(p.xy, z));
  #elif SHADOW_TAPS == 5
    float r = uShadowTexel * 1.6; float s = texture(uShadow, vec3(p.xy, z)) * 2.0;
    s += texture(uShadow, vec3(p.xy + vec2( r,  r * 0.4), z));
    s += texture(uShadow, vec3(p.xy + vec2(-r, -r * 0.4), z));
    s += texture(uShadow, vec3(p.xy + vec2(-r * 0.4,  r), z));
    s += texture(uShadow, vec3(p.xy + vec2( r * 0.4, -r), z));
    return s / 6.0;
  #else
    float r = uShadowTexel * 1.4; float s = 0.0;
    for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) s += texture(uShadow, vec3(p.xy + vec2(float(x), float(y)) * r, z));
    return s / 9.0;
  #endif
}
#endif

void main() {
  vec3 base = uColor * vColor;
  float alpha = uOpacity;
  if (uHasMap == 1) { vec4 t = texture(uMap, vUV); base *= toLinear(t.rgb); alpha *= t.a; }
  vec3 col;
  if (uUnlit == 1) {
    col = base;
  } else {
    vec3 N = normalize(vNormal); if (!gl_FrontFacing) N = -N;
    vec3 V = normalize(uCamPos - vWorld);
    float sh = 1.0;
    #ifdef SHADOWS
      if (uRecv == 1) sh = shadowAt(N);
    #endif
    float occl = mix(0.42, 1.0, sh);
    vec3 lit = mix(uGround, uSky, N.y * 0.5 + 0.5) * occl;
    lit += uDirColor * max(dot(N, -uDirDir), 0.0);
    vec3 spec = vec3(0.0);
    float pointOcc = mix(0.3, 1.0, sh);
    for (int i = 0; i < MAXL; i++) {
      if (i >= uNumPoints) break;
      vec3 L = uPointPos[i] - vWorld; float d = length(L); L /= max(d, 0.0001);
      float att = clamp(1.0 - d / uPointRange[i], 0.0, 1.0); att *= att;
      float nl = max(dot(N, L), 0.0);
      lit += uPointColor[i] * nl * att * pointOcc;
      vec3 H = normalize(L + V);
      spec += uPointColor[i] * pow(max(dot(N, H), 0.0), uShine) * att * uSpec * pointOcc * (nl > 0.0 ? 1.0 : 0.0);
    }
    lit += vec3(uFlash);
    col = base * lit + spec;
    #ifdef ENVMAP
      if (uRefl > 0.0) {
        vec3 R = reflect(-V, N);
        vec2 euv = vec2(atan(R.z, R.x) * 0.15915 + 0.5, acos(clamp(R.y, -1.0, 1.0)) * 0.31831);
        float rough = clamp(1.0 - log2(max(uShine, 2.0)) / 7.0, 0.0, 1.0);
        vec3 env = toLinear(textureLod(uEnv, euv, rough * 6.0).rgb);
        float f = uRefl + (1.0 - uRefl) * pow(1.0 - max(dot(N, V), 0.0), 5.0) * (1.0 - rough * 0.85);
        col = mix(col, env * uEnvStrength * occl, clamp(f * uRefl * 2.0, 0.0, 0.9));
        alpha = max(alpha, f * 0.6);
      }
    #endif
  }
  if (uHasEm == 1) col += uEmissive * toLinear(texture(uEmMap, vUV).rgb);
  else col += uEmissive;
  float fg = clamp((length(uCamPos - vWorld) - uFog.x) / max(0.001, uFog.y - uFog.x), 0.0, 1.0);
  col = mix(col, uFogColor, fg);
  col *= uExposure;
  col = clamp((col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14), 0.0, 1.0);
  fragColor = vec4(sqrt(col), alpha);
}`;

const DEPTH_VS = `#version 300 es
in vec3 aPos; uniform mat4 uModel; uniform mat4 uViewProj;
void main() { gl_Position = uViewProj * uModel * vec4(aPos, 1.0); }`;
const DEPTH_FS = `#version 300 es
precision mediump float; out vec4 o; void main() { o = vec4(1.0); }`;

const QUAD_VS = `#version 300 es
out vec2 vUV;
void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); vUV = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

const BRIGHT_FS = `#version 300 es
precision mediump float; in vec2 vUV; uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uThreshold; out vec4 o;
void main() {
  vec3 c = vec3(0.0);
  c += texture(uSrc, vUV + uTexel * vec2(-1.0, -1.0)).rgb; c += texture(uSrc, vUV + uTexel * vec2(1.0, -1.0)).rgb;
  c += texture(uSrc, vUV + uTexel * vec2(-1.0, 1.0)).rgb; c += texture(uSrc, vUV + uTexel * vec2(1.0, 1.0)).rgb;
  c *= 0.25; float l = max(c.r, max(c.g, c.b));
  o = vec4(c * smoothstep(uThreshold, 1.0, l), 1.0);
}`;

const BLUR_FS = `#version 300 es
precision mediump float; in vec2 vUV; uniform sampler2D uSrc; uniform vec2 uDir; out vec4 o;
void main() {
  vec3 c = texture(uSrc, vUV).rgb * 0.227;
  c += (texture(uSrc, vUV + uDir * 1.385).rgb + texture(uSrc, vUV - uDir * 1.385).rgb) * 0.316;
  c += (texture(uSrc, vUV + uDir * 3.231).rgb + texture(uSrc, vUV - uDir * 3.231).rgb) * 0.070;
  o = vec4(c, 1.0);
}`;

// FXAA (compact "console" variant) + bloom + vignette + mild grade.
const FINAL_FS = `#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uSrc; uniform sampler2D uBloom; uniform vec2 uTexel;
uniform int uFxaa; uniform int uHasBloom; uniform float uBloomAmt; uniform float uVignette; out vec4 o;
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 fxaa(vec2 uv) {
  vec3 rgbM = texture(uSrc, uv).rgb;
  vec3 rgbNW = texture(uSrc, uv + vec2(-1.0, -1.0) * uTexel).rgb, rgbNE = texture(uSrc, uv + vec2(1.0, -1.0) * uTexel).rgb;
  vec3 rgbSW = texture(uSrc, uv + vec2(-1.0, 1.0) * uTexel).rgb, rgbSE = texture(uSrc, uv + vec2(1.0, 1.0) * uTexel).rgb;
  float lM = luma(rgbM), lNW = luma(rgbNW), lNE = luma(rgbNE), lSW = luma(rgbSW), lSE = luma(rgbSE);
  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE))), lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  if (lMax - lMin < max(0.0312, lMax * 0.125)) return rgbM;
  vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
  float red = max((lNW + lNE + lSW + lSE) * 0.03125, 0.0078125);
  float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + red);
  dir = clamp(dir * rcp, vec2(-8.0), vec2(8.0)) * uTexel;
  vec3 a = 0.5 * (texture(uSrc, uv + dir * (1.0 / 3.0 - 0.5)).rgb + texture(uSrc, uv + dir * (2.0 / 3.0 - 0.5)).rgb);
  vec3 b = a * 0.5 + 0.25 * (texture(uSrc, uv - dir * 0.5).rgb + texture(uSrc, uv + dir * 0.5).rgb);
  float lB = luma(b);
  return (lB < lMin || lB > lMax) ? a : b;
}
void main() {
  vec3 c = uFxaa == 1 ? fxaa(vUV) : texture(uSrc, vUV).rgb;
  if (uHasBloom == 1) c += texture(uBloom, vUV).rgb * uBloomAmt;
  c = mix(vec3(luma(c)), c, 1.06);
  c = (c - 0.5) * 1.04 + 0.5;
  vec2 q = vUV - 0.5; c *= 1.0 - dot(q, q) * uVignette;
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

export const QUALITY = {
  low: { shadows: 0, shadowTaps: 1, envmap: false, post: false, msaa: 0, fxaa: false, bloom: false, dynamicShadows: false, aniso: 2 },
  medium: { shadows: 1024, shadowTaps: 1, envmap: true, post: true, msaa: 0, fxaa: true, bloom: false, dynamicShadows: false, aniso: 4 },
  high: { shadows: 2048, shadowTaps: 5, envmap: true, post: true, msaa: 4, fxaa: false, bloom: true, dynamicShadows: false, aniso: 8 },
  ultra: { shadows: 2048, shadowTaps: 9, envmap: true, post: true, msaa: 4, fxaa: false, bloom: true, dynamicShadows: true, aniso: 16 },
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    // Context-level MSAA is off: anti-aliasing is done in our own render targets so it can change with the quality preset at runtime.
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL2 is not available');
    this.gl = gl;
    this.anisoExt = gl.getExtension('EXT_texture_filter_anisotropic');
    this.maxSamples = gl.getParameter(gl.MAX_SAMPLES) || 0;
    this.white = this.createTexture(null);
    this.view = mat4(); this.proj = mat4(); this.viewProj = mat4();
    this.lightView = mat4(); this.lightProj = mat4(); this.lightVP = mat4();
    this.maxLights = 8; this.pixelRatio = 1; this.renderScale = 1; this.stats = { draws: 0, tris: 0, width: 0, height: 0 };
    this.programs = {}; this.targets = null; this.shadow = null; this.shadowDirty = true; this.frame = 0;
    this.envTex = null; this.envStrength = 1;
    this.depthProg = this.link(DEPTH_VS, DEPTH_FS, ['uModel', 'uViewProj']);
    this.post = {
      bright: this.link(QUAD_VS, BRIGHT_FS, ['uSrc', 'uTexel', 'uThreshold']),
      blur: this.link(QUAD_VS, BLUR_FS, ['uSrc', 'uDir']),
      final: this.link(QUAD_VS, FINAL_FS, ['uSrc', 'uBloom', 'uTexel', 'uFxaa', 'uHasBloom', 'uBloomAmt', 'uVignette']),
    };
    this.emptyVAO = gl.createVertexArray();
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    this.setQuality('medium');
  }

  // ------------------------------------------------------------ programs
  compile(type, src) {
    const gl = this.gl; const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) { const log = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error(log); }
    return s;
  }

  link(vs, fsrc, uniforms) {
    const gl = this.gl; const p = gl.createProgram();
    const a = this.compile(gl.VERTEX_SHADER, vs), b = this.compile(gl.FRAGMENT_SHADER, fsrc);
    gl.attachShader(p, a); gl.attachShader(p, b);
    gl.bindAttribLocation(p, 0, 'aPos'); gl.bindAttribLocation(p, 1, 'aNormal'); gl.bindAttribLocation(p, 2, 'aUV'); gl.bindAttribLocation(p, 3, 'aColor');
    gl.linkProgram(p); gl.deleteShader(a); gl.deleteShader(b);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(gl.getProgramInfoLog(p));
    const loc = {}; for (const n of uniforms) loc[n] = gl.getUniformLocation(p, n);
    return { p, loc };
  }

  sceneProgram(q) {
    const key = `${q.shadows ? `s${q.shadowTaps}` : 'n'}${q.envmap ? 'e' : ''}`;
    if (this.programs[key]) return this.programs[key];
    const defs = [q.shadows ? `#define SHADOWS\n#define SHADOW_TAPS ${q.shadowTaps}` : '', q.envmap ? '#define ENVMAP' : ''].join('\n');
    const names = ['uModel', 'uViewProj', 'uColor', 'uMap', 'uHasMap', 'uEmissive', 'uEmMap', 'uHasEm', 'uSpec', 'uShine', 'uOpacity', 'uUnlit', 'uRefl', 'uSky', 'uGround', 'uDirDir', 'uDirColor',
      'uNumPoints', 'uPointPos', 'uPointColor', 'uPointRange', 'uCamPos', 'uFogColor', 'uFog', 'uExposure', 'uFlash', 'uShadow', 'uLightVP', 'uShadowTexel', 'uRecv', 'uEnv', 'uEnvStrength'];
    const prog = this.link(VS, fs(defs), names);
    const gl = this.gl; gl.useProgram(prog.p);
    gl.uniform1i(prog.loc.uMap, 0); gl.uniform1i(prog.loc.uEmMap, 1);
    if (prog.loc.uShadow) gl.uniform1i(prog.loc.uShadow, 2);
    if (prog.loc.uEnv) gl.uniform1i(prog.loc.uEnv, 3);
    this.programs[key] = prog;
    return prog;
  }

  /** Switch quality tier. Safe to call at any time. */
  setQuality(name, overrides = {}) {
    const q = { ...(QUALITY[name] || QUALITY.medium), ...overrides };
    if (q.msaa && this.maxSamples < 2) { q.msaa = 0; q.fxaa = true; }
    q.msaa = Math.min(q.msaa, this.maxSamples);
    try { this.prog = this.sceneProgram(q); }
    catch (e) { console.warn('Shader tier failed, falling back:', e.message); Object.assign(q, { shadows: 0, envmap: false }); this.prog = this.sceneProgram(q); }
    this.q = q; this.qualityName = name;
    this.disposeTargets();
    if (this.shadow && this.shadow.size !== q.shadows) this.disposeShadow();
    this.shadowDirty = true;
  }

  // ------------------------------------------------------------ resources
  resize(pixelRatio = this.pixelRatio) {
    this.pixelRatio = pixelRatio;
    const r = pixelRatio * this.renderScale;
    const w = Math.max(1, Math.round(this.canvas.clientWidth * r)), h = Math.max(1, Math.round(this.canvas.clientHeight * r));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.stats.width = w; this.stats.height = h;
  }

  createTexture(source, { repeat = true, mipmap = true, nearest = false, aniso } = {}) {
    const gl = this.gl; const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (source) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    const pot = source && (source.width & (source.width - 1)) === 0 && (source.height & (source.height - 1)) === 0;
    const wrap = repeat && pot ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    if (mipmap && pot) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
    else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, nearest ? gl.NEAREST : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, nearest ? gl.NEAREST : gl.LINEAR);
    const an = aniso ?? this.q?.aniso ?? 4;
    if (this.anisoExt && mipmap && pot && an > 1) gl.texParameterf(gl.TEXTURE_2D, this.anisoExt.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(an, gl.getParameter(this.anisoExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    return { tex, mipmap: mipmap && pot };
  }

  updateTexture(t, source) {
    const gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    if (t.mipmap) gl.generateMipmap(gl.TEXTURE_2D);
  }

  deleteTexture(t) { if (t?.tex && t !== this.white) this.gl.deleteTexture(t.tex); }

  setEnvironment(canvas, strength = 1) {
    if (this.envTex) this.deleteTexture(this.envTex);
    this.envTex = canvas ? this.createTexture(canvas, { repeat: true, mipmap: true, aniso: 1 }) : null;
    this.envStrength = strength;
  }

  createMesh(g) {
    const gl = this.gl; const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const bufs = [];
    const buf = (data, loc, size) => {
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); bufs.push(b);
    };
    buf(g.positions, 0, 3); buf(g.normals, 1, 3); buf(g.uvs, 2, 2); buf(g.colors, 3, 3);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); bufs.push(ib);
    const big = g.positions.length / 3 > 65535;
    const idx = big ? new Uint32Array(g.indices) : new Uint16Array(g.indices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, bufs, count: idx.length, type: big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT };
  }

  deleteMesh(m) { if (!m) return; const gl = this.gl; for (const b of m.bufs || []) gl.deleteBuffer(b); gl.deleteVertexArray(m.vao); m.count = 0; }

  // ------------------------------------------------------------ render targets
  disposeTargets() {
    const t = this.targets; if (!t) return; const gl = this.gl;
    for (const f of [t.msFbo, t.fbo, t.bA, t.bB]) if (f) gl.deleteFramebuffer(f);
    for (const r of [t.msColor, t.msDepth, t.depth]) if (r) gl.deleteRenderbuffer(r);
    for (const x of [t.color, t.texA, t.texB]) if (x) gl.deleteTexture(x);
    this.targets = null;
  }

  makeColorTex(w, h) {
    const gl = this.gl; const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  ensureTargets(w, h) {
    const q = this.q; if (!q.post) return null;
    if (this.targets && this.targets.w === w && this.targets.h === h) return this.targets;
    this.disposeTargets();
    const gl = this.gl; const t = { w, h };
    try {
      t.color = this.makeColorTex(w, h);
      t.fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.color, 0);
      if (!q.msaa) {
        t.depth = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, t.depth);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, t.depth);
      }
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('scene FBO incomplete');
      if (q.msaa) {
        t.msFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, t.msFbo);
        t.msColor = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, t.msColor);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, q.msaa, gl.RGBA8, w, h);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, t.msColor);
        t.msDepth = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, t.msDepth);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, q.msaa, gl.DEPTH_COMPONENT24, w, h);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, t.msDepth);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('MSAA FBO incomplete');
      }
      if (q.bloom) {
        t.bw = Math.max(1, w >> 2); t.bh = Math.max(1, h >> 2);
        t.texA = this.makeColorTex(t.bw, t.bh); t.texB = this.makeColorTex(t.bw, t.bh);
        t.bA = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, t.bA); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.texA, 0);
        t.bB = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, t.bB); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.texB, 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('bloom FBO incomplete');
      }
    } catch (e) {
      console.warn('Post-processing disabled:', e.message);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); this.targets = t; this.disposeTargets();
      this.q = { ...this.q, post: false, msaa: 0, bloom: false, fxaa: false };
      return null;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.targets = t; return t;
  }

  // ------------------------------------------------------------ shadows
  disposeShadow() { const s = this.shadow; if (!s) return; this.gl.deleteFramebuffer(s.fbo); this.gl.deleteTexture(s.tex); this.shadow = null; }

  ensureShadow() {
    const size = this.q.shadows; if (!size) return null;
    if (this.shadow && this.shadow.size === size) return this.shadow;
    this.disposeShadow();
    const gl = this.gl;
    try {
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, size, size, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
      const fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0);
      gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('shadow FBO incomplete');
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.shadow = { tex, fbo, size };
    } catch (e) {
      console.warn('Shadows disabled:', e.message); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.q = { ...this.q, shadows: 0 }; this.prog = this.sceneProgram(this.q); return null;
    }
    return this.shadow;
  }

  /** Overhead "ceiling light" shadow volume covering the building. */
  configureShadow(bounds, dir = [0.16, -1, 0.11]) {
    this.shadowBounds = bounds; this.shadowDir = dir; this.shadowDirty = true;
  }

  renderShadow(items) {
    const s = this.ensureShadow(); if (!s || !this.shadowBounds) return;
    const gl = this.gl; const b = this.shadowBounds; const d = this.shadowDir;
    const cx = (b[0] + b[3]) / 2, cy = (b[1] + b[4]) / 2, cz = (b[2] + b[5]) / 2;
    const l = Math.hypot(...d); const dir = d.map((v) => v / l);
    lookAt(this.lightView, [cx - dir[0] * 20, cy - dir[1] * 20, cz - dir[2] * 20], [cx, cy, cz], [0, 0, -1]);
    const hx = (b[3] - b[0]) / 2 + 1.2, hz = (b[5] - b[2]) / 2 + 1.2;
    ortho(this.lightProj, -hx, hx, -hz, hz, 1, 40);
    multiply(this.lightVP, this.lightProj, this.lightView);
    gl.bindFramebuffer(gl.FRAMEBUFFER, s.fbo); gl.viewport(0, 0, s.size, s.size);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    const P = this.depthProg; gl.useProgram(P.p); gl.uniformMatrix4fv(P.loc.uViewProj, false, this.lightVP);
    gl.disable(gl.CULL_FACE); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2, 4);
    for (const it of items) {
      const m = it.mat; if (it.visible === false || m.noCast || m.unlit || m.opacity < 1 || m.transparent) continue;
      gl.uniformMatrix4fv(P.loc.uModel, false, it.model || IDENTITY);
      gl.bindVertexArray(it.mesh.vao); gl.drawElements(gl.TRIANGLES, it.mesh.count, it.mesh.type, 0);
    }
    gl.disable(gl.POLYGON_OFFSET_FILL); gl.enable(gl.CULL_FACE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.shadowDirty = false;
  }

  // ------------------------------------------------------------ frame
  setCamera(cam, aspect) {
    perspective(this.proj, (cam.fov * Math.PI) / 180, aspect, cam.near || 0.05, cam.far || 120);
    viewFromYawPitch(this.view, cam.pos, cam.yaw, cam.pitch);
    multiply(this.viewProj, this.proj, this.view);
  }

  /** scene: { items:[{mesh, mat, model?, visible?, order?}], env, points:[{pos,color,range}] } */
  render(scene, cam) {
    const gl = this.gl; if (gl.isContextLost()) return;
    const env = scene.env; const q = this.q; this.frame++;
    this.resize();
    const W = this.canvas.width, H = this.canvas.height;
    // shadows: static scene is baked once; Ultra refreshes every 3rd frame to include people
    if (q.shadows && (this.shadowDirty || (q.dynamicShadows && this.frame % 3 === 0))) this.renderShadow(scene.items);
    const tg = q.post ? this.ensureTargets(W, H) : null;
    gl.bindFramebuffer(gl.FRAMEBUFFER, tg ? (tg.msFbo || tg.fbo) : null);
    gl.viewport(0, 0, W, H);
    gl.clearColor(env.fogColor[0] ** 0.5, env.fogColor[1] ** 0.5, env.fogColor[2] ** 0.5, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const P = this.prog; const L = P.loc; gl.useProgram(P.p);
    this.setCamera(cam, W / H);
    gl.uniformMatrix4fv(L.uViewProj, false, this.viewProj);
    gl.uniform3fv(L.uCamPos, cam.pos); gl.uniform3fv(L.uSky, env.sky); gl.uniform3fv(L.uGround, env.ground);
    gl.uniform3fv(L.uDirDir, env.dirDir); gl.uniform3fv(L.uDirColor, env.dirColor); gl.uniform3fv(L.uFogColor, env.fogColor);
    gl.uniform2f(L.uFog, env.fogNear, env.fogFar); gl.uniform1f(L.uExposure, env.exposure ?? 1); gl.uniform1f(L.uFlash, env.flash || 0);
    if (L.uShadow && this.shadow) {
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.shadow.tex);
      gl.uniformMatrix4fv(L.uLightVP, false, this.lightVP); gl.uniform1f(L.uShadowTexel, 1 / this.shadow.size);
    }
    if (L.uEnv) { gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, (this.envTex || this.white).tex); gl.uniform1f(L.uEnvStrength, this.envTex ? this.envStrength : 0); }
    this.hasShadow = !!(L.uShadow && this.shadow);
    // nearest point lights to the camera
    const pts = scene.points.map((p) => ({ p, d: (p.pos[0] - cam.pos[0]) ** 2 + (p.pos[1] - cam.pos[1]) ** 2 + (p.pos[2] - cam.pos[2]) ** 2 - p.range * p.range * 0.3 }))
      .sort((a, b) => a.d - b.d).slice(0, Math.min(this.maxLights, MAX_LIGHTS)).map((x) => x.p);
    const pp = new Float32Array(MAX_LIGHTS * 3), pc = new Float32Array(MAX_LIGHTS * 3), pr = new Float32Array(MAX_LIGHTS);
    pts.forEach((p, i) => { pp.set(p.pos, i * 3); pc.set(p.color, i * 3); pr[i] = p.range; });
    gl.uniform1i(L.uNumPoints, pts.length); gl.uniform3fv(L.uPointPos, pp); gl.uniform3fv(L.uPointColor, pc); gl.uniform1fv(L.uPointRange, pr);
    this.stats.draws = 0; this.stats.tris = 0;
    const opaque = [], transparent = [];
    for (const it of scene.items) { if (it.visible === false || !it.mesh?.count) continue; (it.mat.opacity < 1 || it.mat.transparent ? transparent : opaque).push(it); }
    transparent.sort((a, b) => (a.order || 0) - (b.order || 0));
    gl.disable(gl.BLEND); gl.depthMask(true);
    for (const it of opaque) this.drawItem(it);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    for (const it of transparent) this.drawItem(it);
    gl.depthMask(true); gl.disable(gl.BLEND);
    if (tg) this.postProcess(tg, W, H);
    gl.bindVertexArray(null);
  }

  postProcess(t, W, H) {
    const gl = this.gl; const q = this.q;
    if (t.msFbo) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, t.msFbo); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, t.fbo);
      gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    }
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.bindVertexArray(this.emptyVAO);
    const bindTex = (unit, tex) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); };
    if (q.bloom && t.bA) {
      gl.viewport(0, 0, t.bw, t.bh);
      let P = this.post.bright; gl.useProgram(P.p); gl.bindFramebuffer(gl.FRAMEBUFFER, t.bA);
      bindTex(0, t.color); gl.uniform1i(P.loc.uSrc, 0); gl.uniform2f(P.loc.uTexel, 1.5 / W, 1.5 / H); gl.uniform1f(P.loc.uThreshold, 0.62);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      P = this.post.blur; gl.useProgram(P.p); gl.uniform1i(P.loc.uSrc, 0);
      for (let i = 0; i < 2; i++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, t.bB); bindTex(0, t.texA); gl.uniform2f(P.loc.uDir, (1 + i) / t.bw, 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindFramebuffer(gl.FRAMEBUFFER, t.bA); bindTex(0, t.texB); gl.uniform2f(P.loc.uDir, 0, (1 + i) / t.bh); gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
    const P = this.post.final; gl.useProgram(P.p);
    bindTex(0, t.color); gl.uniform1i(P.loc.uSrc, 0);
    bindTex(1, t.texA || this.white.tex); gl.uniform1i(P.loc.uBloom, 1);
    gl.uniform2f(P.loc.uTexel, 1 / W, 1 / H); gl.uniform1i(P.loc.uFxaa, q.fxaa ? 1 : 0);
    gl.uniform1i(P.loc.uHasBloom, q.bloom && t.texA ? 1 : 0); gl.uniform1f(P.loc.uBloomAmt, 0.55); gl.uniform1f(P.loc.uVignette, 0.55);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
  }

  drawItem(it) {
    const gl = this.gl; const L = this.prog.loc; const m = it.mat;
    gl.uniformMatrix4fv(L.uModel, false, it.model || IDENTITY);
    gl.uniform3fv(L.uColor, m.color || ONE);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, (m.map || this.white).tex); gl.uniform1i(L.uHasMap, m.map ? 1 : 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, (m.emissiveMap || this.white).tex); gl.uniform1i(L.uHasEm, m.emissiveMap ? 1 : 0);
    gl.uniform3fv(L.uEmissive, m.emissive || ZERO);
    gl.uniform1f(L.uSpec, m.specular ?? 0.15); gl.uniform1f(L.uShine, m.shininess ?? 24); gl.uniform1f(L.uOpacity, m.opacity ?? 1); gl.uniform1i(L.uUnlit, m.unlit ? 1 : 0);
    gl.uniform1f(L.uRefl, m.reflect || 0);
    if (L.uRecv) gl.uniform1i(L.uRecv, this.hasShadow && m.receive !== false ? 1 : 0);
    if (m.doubleSided) gl.disable(gl.CULL_FACE); else gl.enable(gl.CULL_FACE);
    gl.bindVertexArray(it.mesh.vao); gl.drawElements(gl.TRIANGLES, it.mesh.count, it.mesh.type, 0);
    this.stats.draws++; this.stats.tris += it.mesh.count / 3;
  }
}

const IDENTITY = mat4(); const ONE = new Float32Array([1, 1, 1]); const ZERO = new Float32Array([0, 0, 0]);
