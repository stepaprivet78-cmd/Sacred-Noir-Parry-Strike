// =========================================================================
// SACRED NOIR 3D — BLOOM + CINEMATIC CAMERA
// =========================================================================
'use strict';

const FX = { bloom: null, cine: null };

function initBloom() {
  const r = R3.renderer;
  const mkRT = (w, h) => new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadScene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
  quadScene.add(quad);
  const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const bright = new THREE.ShaderMaterial({
    uniforms: { tex: { value: null }, thr: { value: 0.55 } }, vertexShader: vs,
    fragmentShader: 'uniform sampler2D tex; uniform float thr; varying vec2 vUv; void main(){ vec3 c = texture2D(tex, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(thr, thr + 0.35, l), 1.0); }'
  });
  const blur = new THREE.ShaderMaterial({
    uniforms: { tex: { value: null }, dir: { value: new THREE.Vector2() } }, vertexShader: vs,
    fragmentShader: 'uniform sampler2D tex; uniform vec2 dir; varying vec2 vUv; void main(){ vec3 s = texture2D(tex, vUv).rgb * 0.227; s += texture2D(tex, vUv + dir * 1.385).rgb * 0.316; s += texture2D(tex, vUv - dir * 1.385).rgb * 0.316; s += texture2D(tex, vUv + dir * 3.231).rgb * 0.07; s += texture2D(tex, vUv - dir * 3.231).rgb * 0.07; gl_FragColor = vec4(s, 1.0); }'
  });
  const comp = new THREE.ShaderMaterial({
    uniforms: { base: { value: null }, b1: { value: null }, b2: { value: null }, str: { value: 1.1 }, vig: { value: 0.0 } }, vertexShader: vs,
    fragmentShader: 'uniform sampler2D base; uniform sampler2D b1; uniform sampler2D b2; uniform float str; uniform float vig; varying vec2 vUv; void main(){ vec3 c = texture2D(base, vUv).rgb + (texture2D(b1, vUv).rgb * 0.6 + texture2D(b2, vUv).rgb * 0.9) * str; float d = distance(vUv, vec2(0.5)); c *= 1.0 - vig * smoothstep(0.3, 0.8, d); gl_FragColor = vec4(c, 1.0); }'
  });
  FX.bloom = { quadCam, quadScene, quad, bright, blur, comp, mkRT, w: 0, h: 0 };
}

function sizeBloom(w, h) {
  const B = FX.bloom;
  if (B.w === w && B.h === h) return;
  [B.base, B.a1, B.b1, B.a2, B.b2].forEach(t => t && t.dispose());
  B.w = w; B.h = h;
  B.base = B.mkRT(w, h);
  B.a1 = B.mkRT(w >> 1, h >> 1); B.b1 = B.mkRT(w >> 1, h >> 1);
  B.a2 = B.mkRT(w >> 2, h >> 2); B.b2 = B.mkRT(w >> 2, h >> 2);
}

function pass(mat, target) {
  const B = FX.bloom;
  B.quad.material = mat;
  R3.renderer.setRenderTarget(target);
  R3.renderer.render(B.quadScene, B.quadCam);
}

function blurInto(src, tmp, dst, w, h, spread) {
  const B = FX.bloom;
  B.blur.uniforms.tex.value = src; B.blur.uniforms.dir.value.set(spread / w, 0); pass(B.blur, tmp);
  B.blur.uniforms.tex.value = tmp.texture; B.blur.uniforms.dir.value.set(0, spread / h); pass(B.blur, dst);
}

function renderWithBloom() {
  const r = R3.renderer;
  if (lowGfx) { r.setRenderTarget(null); r.render(R3.scene, R3.camera); return; }
  if (!FX.bloom) initBloom();
  const B = FX.bloom;
  const size = r.getDrawingBufferSize(new THREE.Vector2());
  sizeBloom(Math.max(4, size.x), Math.max(4, size.y));

  r.setRenderTarget(B.base); r.render(R3.scene, R3.camera);
  B.bright.uniforms.tex.value = B.base.texture; pass(B.bright, B.a1);
  blurInto(B.a1.texture, B.b1, B.a1, B.w >> 1, B.h >> 1, 1.2);
  blurInto(B.a1.texture, B.b2, B.a2, B.w >> 2, B.h >> 2, 1.6);
  blurInto(B.a2.texture, B.b2, B.a2, B.w >> 2, B.h >> 2, 2.4);

  const cineK = FX.cine ? cineEnvelope() : 0;
  B.comp.uniforms.base.value = B.base.texture;
  B.comp.uniforms.b1.value = B.a1.texture;
  B.comp.uniforms.b2.value = B.a2.texture;
  B.comp.uniforms.str.value = 1.0 + cineK * 0.6 + (typeof boss !== 'undefined' && boss && boss.phase2 ? 0.15 : 0);
  B.comp.uniforms.vig.value = 0.35 + cineK * 0.45;
  pass(B.comp, null);
}

// ---------- Кинематографичная камера ----------
function startCinematic(x, y, dur = 1.1, kind = 'exec') {
  FX.cine = { x, y, t: 0, dur, kind, a0: (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.4) };
  const lt = document.getElementById('letterbox-top'), lb = document.getElementById('letterbox-bottom');
  if (lt) lt.classList.remove('-translate-y-full');
  if (lb) lb.classList.remove('translate-y-full');
}

function cineEnvelope() {
  const c = FX.cine; if (!c) return 0;
  const p = c.t / c.dur;
  return Math.min(1, p / 0.15, (1 - p) / 0.3);
}

function updateCinematic(dt) {
  const c = FX.cine; if (!c) return;
  c.t += dt;
  if (c.t >= c.dur) {
    FX.cine = null;
    if (introTimer <= 0) {
      const lt = document.getElementById('letterbox-top'), lb = document.getElementById('letterbox-bottom');
      if (lt) lt.classList.add('-translate-y-full');
      if (lb) lb.classList.add('translate-y-full');
    }
    return;
  }
  const e = cineEnvelope();
  const ease = e * e * (3 - 2 * e);
  const cam = R3.camera;
  const p = c.t / c.dur;
  const tx = wx(c.x), tz = wz(c.y);
  const d = c.kind === 'slain' ? 11 : 8.5;
  const a = c.a0 + p * (c.kind === 'slain' ? 1.4 : 0.9) * Math.sign(c.a0);
  const cx = tx + Math.sin(a) * d, cz = tz + Math.cos(a) * d, cy = c.kind === 'slain' ? 5.5 : 3.6;
  cam.position.set(
    cam.position.x + (cx - cam.position.x) * ease,
    cam.position.y + (cy - cam.position.y) * ease,
    cam.position.z + (cz - cam.position.z) * ease
  );
  const lookY = 1.6 * ease;
  const lx = R3.camT.x + (tx - R3.camT.x) * ease, lz = R3.camT.z + (tz - R3.camT.z) * ease;
  cam.lookAt(lx, lookY, lz);
  cam.fov = 42 - 8 * ease; cam.updateProjectionMatrix();
}

function resetCineFov() {
  if (!FX.cine && R3.camera.fov !== 42) { R3.camera.fov = 42; R3.camera.updateProjectionMatrix(); }
}
