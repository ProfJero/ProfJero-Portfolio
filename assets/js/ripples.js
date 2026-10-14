// Water ripple effect for an element's CSS background image (WebGL).
// Dependency-free port of jQuery Ripples v0.6.2 by Pim Schreurs (sirxemic), MIT licence:
// https://github.com/sirxemic/jquery.ripples — rewritten without jQuery, with
// pause-when-hidden, high-DPI rendering and optional ambient drops.

const VERTEX = `attribute vec2 vertex;
varying vec2 coord;
void main() { coord = vertex * 0.5 + 0.5; gl_Position = vec4(vertex, 0.0, 1.0); }`;

const DROP = `precision highp float;
const float PI = 3.141592653589793;
uniform sampler2D texture; uniform vec2 center; uniform float radius; uniform float strength;
varying vec2 coord;
void main() {
  vec4 info = texture2D(texture, coord);
  float drop = max(0.0, 1.0 - length(center * 0.5 + 0.5 - coord) / radius);
  drop = 0.5 - cos(drop * PI) * 0.5;
  info.r += drop * strength;
  gl_FragColor = info;
}`;

const UPDATE = `precision highp float;
uniform sampler2D texture; uniform vec2 delta;
varying vec2 coord;
void main() {
  vec4 info = texture2D(texture, coord);
  vec2 dx = vec2(delta.x, 0.0); vec2 dy = vec2(0.0, delta.y);
  float average = (texture2D(texture, coord - dx).r + texture2D(texture, coord - dy).r +
                   texture2D(texture, coord + dx).r + texture2D(texture, coord + dy).r) * 0.25;
  info.g += (average - info.r) * 2.0;
  info.g *= 0.995;
  info.r += info.g;
  gl_FragColor = info;
}`;

const RENDER_V = `precision highp float;
attribute vec2 vertex;
uniform vec2 topLeft; uniform vec2 bottomRight; uniform vec2 containerRatio;
varying vec2 ripplesCoord; varying vec2 backgroundCoord;
void main() {
  backgroundCoord = mix(topLeft, bottomRight, vertex * 0.5 + 0.5);
  backgroundCoord.y = 1.0 - backgroundCoord.y;
  ripplesCoord = vec2(vertex.x, -vertex.y) * containerRatio * 0.5 + 0.5;
  gl_Position = vec4(vertex.x, -vertex.y, 0.0, 1.0);
}`;

const RENDER_F = `precision highp float;
uniform sampler2D samplerBackground; uniform sampler2D samplerRipples;
uniform vec2 delta; uniform float perturbance;
varying vec2 ripplesCoord; varying vec2 backgroundCoord;
void main() {
  float height = texture2D(samplerRipples, ripplesCoord).r;
  float heightX = texture2D(samplerRipples, vec2(ripplesCoord.x + delta.x, ripplesCoord.y)).r;
  float heightY = texture2D(samplerRipples, vec2(ripplesCoord.x, ripplesCoord.y + delta.y)).r;
  vec3 dx = vec3(delta.x, heightX - height, 0.0);
  vec3 dy = vec3(0.0, heightY - height, delta.y);
  vec2 offset = -normalize(cross(dy, dx)).xz;
  float specular = pow(max(0.0, dot(offset, normalize(vec2(-0.6, 1.0)))), 4.0);
  gl_FragColor = texture2D(samplerBackground, backgroundCoord + offset * perturbance) + specular;
}`;

let support; // cached capability probe
function detectSupport() {
  if (support !== undefined) return support;
  support = null;
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  if (!gl) return support;
  const ext = {};
  ["OES_texture_float", "OES_texture_half_float", "OES_texture_float_linear", "OES_texture_half_float_linear"].forEach(n => { const e = gl.getExtension(n); if (e) ext[n] = e; });
  if (!ext.OES_texture_float) return support;
  const make = (name, type, arrayType) => {
    const base = "OES_texture_" + name, linear = base + "_linear";
    return { type, arrayType, linearSupport: linear in ext, extensions: linear in ext ? [base, linear] : [base] };
  };
  const configs = [make("float", gl.FLOAT, Float32Array)];
  if (ext.OES_texture_half_float) configs.push(make("half_float", ext.OES_texture_half_float.HALF_FLOAT_OES, null));
  const tex = gl.createTexture(), fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.NEAREST);
  for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE);
  for (const c of configs) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 32, 32, 0, gl.RGBA, c.type, null);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) { support = c; break; }
  }
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  return support;
}

export const ripplesSupported = () => !!detectSupport();

const isPercent = v => v[v.length - 1] === "%";
function parseBgPosition(v) {
  const parts = v.split(" ");
  if (parts.length !== 1) return parts.map(p => ({ center: "50%", top: "0", left: "0", right: "100%", bottom: "100%" }[p] ?? p));
  return { center: ["50%", "50%"], top: ["50%", "0"], bottom: ["50%", "100%"], left: ["0", "50%"], right: ["100%", "50%"] }[v] || [v, "50%"];
}
const urlOf = css => (/url\(["']?([^"']*)["']?\)/.exec(css || "") || [])[1] || null;

export class Ripples {
  constructor(el, opts = {}) {
    const cfg = detectSupport();
    if (!cfg) throw new Error("WebGL ripples not supported");
    this.cfg = cfg;
    this.el = el;
    this.resolution = opts.resolution ?? 256;
    this.dropRadius = opts.dropRadius ?? 20;
    this.perturbance = opts.perturbance ?? 0.03;
    this.interactive = opts.interactive ?? true;
    this.crossOrigin = opts.crossOrigin ?? "anonymous";
    this.imageUrl = opts.imageUrl || null;
    this.ambient = opts.ambient ?? true;
    this.textureDelta = new Float32Array([1 / this.resolution, 1 / this.resolution]);
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const canvas = (this.canvas = document.createElement("canvas"));
    Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", zIndex: "-1", pointerEvents: "none" });
    canvas.setAttribute("aria-hidden", "true");
    el.classList.add("has-ripples");
    el.append(canvas);
    const gl = (this.gl = canvas.getContext("webgl", { premultipliedAlpha: true }) || canvas.getContext("experimental-webgl"));
    cfg.extensions.forEach(n => gl.getExtension(n));
    this.updateSize();

    this.textures = []; this.framebuffers = [];
    this.writeIndex = 0; this.readIndex = 1;
    const data = cfg.arrayType ? new cfg.arrayType(this.resolution * this.resolution * 4) : null;
    for (let i = 0; i < 2; i++) {
      const t = gl.createTexture(), f = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.bindTexture(gl.TEXTURE_2D, t);
      const filter = cfg.linearSupport ? gl.LINEAR : gl.NEAREST;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.resolution, this.resolution, 0, gl.RGBA, cfg.type, data);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      this.textures.push(t); this.framebuffers.push(f);
    }
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);

    this.initShaders();
    this.backgroundTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.backgroundTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    this.setTransparentTexture();
    this.loadImage();
    gl.clearColor(0, 0, 0, 0);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    this.visible = true; this.running = true; this.destroyed = false; this.onScreen = true;
    this.lastInteraction = 0;
    this.bind();
    const loop = () => { if (this.destroyed) return; this.step(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }

  program(vs, fs) {
    const gl = this.gl;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error("compile error: " + gl.getShaderInfoLog(s));
      return s;
    };
    const p = { id: gl.createProgram(), uniforms: {}, locations: {} };
    gl.attachShader(p.id, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(p.id, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p.id);
    if (!gl.getProgramParameter(p.id, gl.LINK_STATUS)) throw new Error("link error: " + gl.getProgramInfoLog(p.id));
    gl.useProgram(p.id);
    gl.enableVertexAttribArray(0);
    const re = /uniform (\w+) (\w+)/g; let m;
    const src = vs + fs;
    while ((m = re.exec(src))) p.locations[m[2]] = gl.getUniformLocation(p.id, m[2]);
    return p;
  }

  initShaders() {
    const gl = this.gl;
    this.dropProgram = this.program(VERTEX, DROP);
    this.updateProgram = this.program(VERTEX, UPDATE);
    gl.uniform2fv(this.updateProgram.locations.delta, this.textureDelta);
    this.renderProgram = this.program(RENDER_V, RENDER_F);
    gl.uniform2fv(this.renderProgram.locations.delta, this.textureDelta);
  }

  bind() {
    const el = this.el;
    const canDrop = () => this.visible && this.running && this.interactive;
    const at = (e, big) => {
      if (!canDrop()) return;
      this.lastInteraction = performance.now();
      this.dropAtPointer(e, this.dropRadius * (big ? 1.5 : 1), big ? 0.14 : 0.01);
    };
    this.handlers = {
      mousemove: e => at(e),
      mousedown: e => at(e, true),
      touchmove: e => { for (const t of e.changedTouches) at(t); },
      touchstart: e => { for (const t of e.changedTouches) at(t); }
    };
    for (const [ev, fn] of Object.entries(this.handlers)) el.addEventListener(ev, fn, { passive: true });
    this.onResize = () => this.updateSize();
    addEventListener("resize", this.onResize);
    if ("IntersectionObserver" in window) {
      this.io = new IntersectionObserver(([en]) => { this.onScreen = en.isIntersecting; });
      this.io.observe(el);
    }
    if (this.ambient) {
      this.ambientTimer = setInterval(() => {
        if (document.hidden || !this.onScreen || performance.now() - this.lastInteraction < 4000) return;
        const r = el.getBoundingClientRect();
        this.drop(Math.random() * r.width, Math.random() * r.height, this.dropRadius * 1.6, 0.06);
      }, 2200);
    }
  }

  loadImage() {
    const src = this.imageUrl || urlOf(this.originalCssBackground) || urlOf(getComputedStyle(this.el).backgroundImage);
    if (src === this.imageSource) return;
    this.imageSource = src;
    if (!src) return this.setTransparentTexture();
    const img = new Image();
    img.onload = () => {
      const gl = this.gl;
      const pow2 = n => (n & (n - 1)) === 0;
      const wrap = pow2(img.width) && pow2(img.height) ? gl.REPEAT : gl.CLAMP_TO_EDGE;
      gl.bindTexture(gl.TEXTURE_2D, this.backgroundTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      this.backgroundWidth = img.width; this.backgroundHeight = img.height;
      this.hideCssBackground();
      this.el.classList.add("ripples-ready");
    };
    img.onerror = () => this.setTransparentTexture();
    if (!src.startsWith("data:")) img.crossOrigin = this.crossOrigin;
    img.src = src;
  }

  setTransparentTexture() {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.backgroundTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  }

  hideCssBackground() {
    if (this.cssHidden) return;
    this.originalInline = this.el.style.backgroundImage;
    this.originalCssBackground = getComputedStyle(this.el).backgroundImage;
    this.el.style.backgroundImage = "none";
    this.cssHidden = true;
  }
  restoreCssBackground() {
    this.el.style.backgroundImage = this.originalInline || "";
    this.cssHidden = false;
  }

  step() {
    if (!this.visible || !this.onScreen || document.hidden || !this.backgroundWidth) return;
    this.computeTextureBoundaries();
    if (this.running) this.update();
    this.render();
  }

  drawQuad() {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
  }

  bindTex(t, unit = 0) { const gl = this.gl; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); }

  render() {
    const gl = this.gl, p = this.renderProgram;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.enable(gl.BLEND);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(p.id);
    this.bindTex(this.backgroundTexture, 0);
    this.bindTex(this.textures[0], 1);
    gl.uniform1f(p.locations.perturbance, this.perturbance);
    gl.uniform2fv(p.locations.topLeft, p.uniforms.topLeft);
    gl.uniform2fv(p.locations.bottomRight, p.uniforms.bottomRight);
    gl.uniform2fv(p.locations.containerRatio, p.uniforms.containerRatio);
    gl.uniform1i(p.locations.samplerBackground, 0);
    gl.uniform1i(p.locations.samplerRipples, 1);
    this.drawQuad();
    gl.disable(gl.BLEND);
  }

  update() {
    const gl = this.gl;
    gl.viewport(0, 0, this.resolution, this.resolution);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[this.writeIndex]);
    this.bindTex(this.textures[this.readIndex]);
    gl.useProgram(this.updateProgram.id);
    this.drawQuad();
    this.swap();
  }

  swap() { this.writeIndex = 1 - this.writeIndex; this.readIndex = 1 - this.readIndex; }

  computeTextureBoundaries() {
    const cs = getComputedStyle(this.el);
    const rect = this.el.getBoundingClientRect();
    const fixed = cs.backgroundAttachment === "fixed";
    const box = fixed ? { left: 0, top: 0, width: innerWidth, height: innerHeight } : { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    let size = cs.backgroundSize, w, h;
    if (size === "cover" || size === "contain") {
      const s = (size === "cover" ? Math.max : Math.min)(box.width / this.backgroundWidth, box.height / this.backgroundHeight);
      w = this.backgroundWidth * s; h = this.backgroundHeight * s;
    } else {
      const parts = size.split(" ");
      w = parts[0] || ""; h = parts[1] || w;
      w = isPercent(w) ? box.width * parseFloat(w) / 100 : w !== "auto" ? parseFloat(w) : w;
      h = isPercent(h) ? box.height * parseFloat(h) / 100 : h !== "auto" ? parseFloat(h) : h;
      if (w === "auto" && h === "auto") { w = this.backgroundWidth; h = this.backgroundHeight; }
      else if (w === "auto") w = this.backgroundWidth * (h / this.backgroundHeight);
      else if (h === "auto") h = this.backgroundHeight * (w / this.backgroundWidth);
    }
    let [x, y] = parseBgPosition(cs.backgroundPosition.split(",")[0].trim());
    x = isPercent(x) ? box.left + (box.width - w) * parseFloat(x) / 100 : box.left + parseFloat(x);
    y = isPercent(y) ? box.top + (box.height - h) * parseFloat(y) / 100 : box.top + parseFloat(y);
    const u = this.renderProgram.uniforms;
    u.topLeft = new Float32Array([(rect.left - x) / w, (rect.top - y) / h]);
    u.bottomRight = new Float32Array([u.topLeft[0] + rect.width / w, u.topLeft[1] + rect.height / h]);
    const max = Math.max(this.canvas.width, this.canvas.height);
    u.containerRatio = new Float32Array([this.canvas.width / max, this.canvas.height / max]);
  }

  dropAtPointer(e, radius, strength) {
    const r = this.el.getBoundingClientRect();
    const cs = getComputedStyle(this.el);
    this.drop(e.clientX - r.left - (parseInt(cs.borderLeftWidth) || 0), e.clientY - r.top - (parseInt(cs.borderTopWidth) || 0), radius, strength);
  }

  drop(x, y, radius, strength) {
    const gl = this.gl;
    const w = this.el.clientWidth, h = this.el.clientHeight, longest = Math.max(w, h);
    radius /= longest;
    const center = new Float32Array([(2 * x - w) / longest, (h - 2 * y) / longest]);
    gl.viewport(0, 0, this.resolution, this.resolution);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[this.writeIndex]);
    this.bindTex(this.textures[this.readIndex]);
    gl.useProgram(this.dropProgram.id);
    gl.uniform2fv(this.dropProgram.locations.center, center);
    gl.uniform1f(this.dropProgram.locations.radius, radius);
    gl.uniform1f(this.dropProgram.locations.strength, strength);
    this.drawQuad();
    this.swap();
  }

  updateSize() {
    const w = Math.round(this.el.clientWidth * this.dpr), h = Math.round(this.el.clientHeight * this.dpr);
    if (w !== this.canvas.width || h !== this.canvas.height) { this.canvas.width = w; this.canvas.height = h; }
  }

  setImage(url) { this.imageUrl = url; this.restoreCssBackground(); this.loadImage(); }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    clearInterval(this.ambientTimer);
    this.io?.disconnect();
    removeEventListener("resize", this.onResize);
    for (const [ev, fn] of Object.entries(this.handlers || {})) this.el.removeEventListener(ev, fn);
    this.canvas.remove();
    this.restoreCssBackground();
    this.el.classList.remove("has-ripples", "ripples-ready");
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
