// Lightweight WebGL2 forward renderer: textured Blinn-Phong with hemisphere
// ambient, one directional light, up to 8 point lights (nearest chosen per
// frame), emissive maps (live screens), fog, ACES tone mapping, transparency.
import { mat4, perspective, multiply, viewFromYawPitch } from './math.js';

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

const FS = `#version 300 es
precision highp float;
in vec3 vWorld; in vec3 vNormal; in vec2 vUV; in vec3 vColor;
uniform vec3 uColor; uniform sampler2D uMap; uniform int uHasMap;
uniform vec3 uEmissive; uniform sampler2D uEmMap; uniform int uHasEm;
uniform float uSpec; uniform float uShine; uniform float uOpacity; uniform int uUnlit;
uniform vec3 uSky; uniform vec3 uGround; uniform vec3 uDirDir; uniform vec3 uDirColor;
uniform int uNumPoints; uniform vec3 uPointPos[8]; uniform vec3 uPointColor[8]; uniform float uPointRange[8];
uniform vec3 uCamPos; uniform vec3 uFogColor; uniform vec2 uFog; uniform float uExposure; uniform float uFlash;
out vec4 fragColor;
vec3 toLinear(vec3 c) { return c * c; }
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
    vec3 lit = mix(uGround, uSky, N.y * 0.5 + 0.5);
    lit += uDirColor * max(dot(N, -uDirDir), 0.0);
    vec3 spec = vec3(0.0);
    for (int i = 0; i < 8; i++) {
      if (i >= uNumPoints) break;
      vec3 L = uPointPos[i] - vWorld; float d = length(L); L /= max(d, 0.0001);
      float att = clamp(1.0 - d / uPointRange[i], 0.0, 1.0); att *= att;
      lit += uPointColor[i] * max(dot(N, L), 0.0) * att;
      vec3 H = normalize(L + V);
      spec += uPointColor[i] * pow(max(dot(N, H), 0.0), uShine) * att * uSpec;
    }
    lit += vec3(uFlash);
    col = base * lit + spec;
  }
  if (uHasEm == 1) col += uEmissive * toLinear(texture(uEmMap, vUV).rgb);
  else col += uEmissive;
  float f = clamp((length(uCamPos - vWorld) - uFog.x) / max(0.001, uFog.y - uFog.x), 0.0, 1.0);
  col = mix(col, uFogColor, f);
  col *= uExposure;
  col = clamp((col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14), 0.0, 1.0);
  fragColor = vec4(sqrt(col), alpha);
}`;

export class Renderer {
  constructor(canvas, { antialias = true } = {}) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL2 is not available');
    this.gl = gl;
    this.program = this.makeProgram(VS, FS);
    gl.useProgram(this.program);
    this.loc = {};
    for (const n of ['uModel', 'uViewProj', 'uColor', 'uMap', 'uHasMap', 'uEmissive', 'uEmMap', 'uHasEm', 'uSpec', 'uShine', 'uOpacity', 'uUnlit', 'uSky', 'uGround', 'uDirDir', 'uDirColor', 'uNumPoints', 'uPointPos', 'uPointColor', 'uPointRange', 'uCamPos', 'uFogColor', 'uFog', 'uExposure', 'uFlash']) this.loc[n] = gl.getUniformLocation(this.program, n);
    this.attr = { aPos: gl.getAttribLocation(this.program, 'aPos'), aNormal: gl.getAttribLocation(this.program, 'aNormal'), aUV: gl.getAttribLocation(this.program, 'aUV'), aColor: gl.getAttribLocation(this.program, 'aColor') };
    gl.uniform1i(this.loc.uMap, 0); gl.uniform1i(this.loc.uEmMap, 1);
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    this.white = this.createTexture(null);
    this.view = mat4(); this.proj = mat4(); this.viewProj = mat4();
    this.maxLights = 8; this.pixelRatio = 1; this.stats = { draws: 0 };
    this.anisoExt = gl.getExtension('EXT_texture_filter_anisotropic');
  }

  makeProgram(vs, fs) {
    const gl = this.gl;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  resize(pixelRatio = this.pixelRatio) {
    this.pixelRatio = pixelRatio;
    const w = Math.max(1, Math.round(this.canvas.clientWidth * pixelRatio)), h = Math.max(1, Math.round(this.canvas.clientHeight * pixelRatio));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.gl.viewport(0, 0, w, h);
  }

  createTexture(source, { repeat = true, mipmap = true, nearest = false } = {}) {
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
    if (this.anisoExt && mipmap && pot) gl.texParameterf(gl.TEXTURE_2D, this.anisoExt.TEXTURE_MAX_ANISOTROPY_EXT, 4);
    return { tex, mipmap: mipmap && pot };
  }

  updateTexture(t, source) {
    const gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    if (t.mipmap) gl.generateMipmap(gl.TEXTURE_2D);
  }

  createMesh(g) {
    const gl = this.gl; const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const buf = (data, loc, size) => {
      if (loc < 0) return null;
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); return b;
    };
    buf(g.positions, this.attr.aPos, 3); buf(g.normals, this.attr.aNormal, 3); buf(g.uvs, this.attr.aUV, 2); buf(g.colors, this.attr.aColor, 3);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    const big = g.positions.length / 3 > 65535;
    const idx = big ? new Uint32Array(g.indices) : new Uint16Array(g.indices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, count: idx.length, type: big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT };
  }

  setCamera(cam, aspect) {
    perspective(this.proj, (cam.fov * Math.PI) / 180, aspect, cam.near || 0.05, cam.far || 120);
    viewFromYawPitch(this.view, cam.pos, cam.yaw, cam.pitch);
    multiply(this.viewProj, this.proj, this.view);
  }

  /** scene: { items:[{mesh, mat, model?, visible?}], env, points:[{pos,color,range}] } */
  render(scene, cam) {
    const gl = this.gl; const L = this.loc; const env = scene.env;
    this.resize();
    gl.clearColor(env.fogColor[0] ** 0.5, env.fogColor[1] ** 0.5, env.fogColor[2] ** 0.5, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);
    this.setCamera(cam, this.canvas.width / this.canvas.height);
    gl.uniformMatrix4fv(L.uViewProj, false, this.viewProj);
    gl.uniform3fv(L.uCamPos, cam.pos); gl.uniform3fv(L.uSky, env.sky); gl.uniform3fv(L.uGround, env.ground);
    gl.uniform3fv(L.uDirDir, env.dirDir); gl.uniform3fv(L.uDirColor, env.dirColor); gl.uniform3fv(L.uFogColor, env.fogColor);
    gl.uniform2f(L.uFog, env.fogNear, env.fogFar); gl.uniform1f(L.uExposure, env.exposure ?? 1); gl.uniform1f(L.uFlash, env.flash || 0);
    // choose nearest point lights to the camera
    const pts = scene.points.map((p) => ({ p, d: (p.pos[0] - cam.pos[0]) ** 2 + (p.pos[1] - cam.pos[1]) ** 2 + (p.pos[2] - cam.pos[2]) ** 2 - p.range * p.range * 0.3 }))
      .sort((a, b) => a.d - b.d).slice(0, this.maxLights).map((x) => x.p);
    const pp = new Float32Array(24), pc = new Float32Array(24), pr = new Float32Array(8);
    pts.forEach((p, i) => { pp.set(p.pos, i * 3); pc.set(p.color, i * 3); pr[i] = p.range; });
    gl.uniform1i(L.uNumPoints, pts.length); gl.uniform3fv(L.uPointPos, pp); gl.uniform3fv(L.uPointColor, pc); gl.uniform1fv(L.uPointRange, pr);
    this.stats.draws = 0;
    const opaque = [], transparent = [];
    for (const it of scene.items) { if (it.visible === false) continue; (it.mat.opacity < 1 || it.mat.transparent ? transparent : opaque).push(it); }
    gl.disable(gl.BLEND); gl.depthMask(true);
    for (const it of opaque) this.drawItem(it);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    for (const it of transparent) this.drawItem(it);
    gl.depthMask(true); gl.disable(gl.BLEND);
  }

  drawItem(it) {
    const gl = this.gl; const L = this.loc; const m = it.mat;
    gl.uniformMatrix4fv(L.uModel, false, it.model || IDENTITY);
    gl.uniform3fv(L.uColor, m.color || ONE);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, (m.map || this.white).tex); gl.uniform1i(L.uHasMap, m.map ? 1 : 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, (m.emissiveMap || this.white).tex); gl.uniform1i(L.uHasEm, m.emissiveMap ? 1 : 0);
    gl.uniform3fv(L.uEmissive, m.emissive || ZERO);
    gl.uniform1f(L.uSpec, m.specular ?? 0.15); gl.uniform1f(L.uShine, m.shininess ?? 24); gl.uniform1f(L.uOpacity, m.opacity ?? 1); gl.uniform1i(L.uUnlit, m.unlit ? 1 : 0);
    if (m.doubleSided) gl.disable(gl.CULL_FACE); else gl.enable(gl.CULL_FACE);
    gl.bindVertexArray(it.mesh.vao); gl.drawElements(gl.TRIANGLES, it.mesh.count, it.mesh.type, 0);
    this.stats.draws++;
  }
}

const IDENTITY = mat4(); const ONE = new Float32Array([1, 1, 1]); const ZERO = new Float32Array([0, 0, 0]);
