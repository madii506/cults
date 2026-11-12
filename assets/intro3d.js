// CULTS intro: twelve monoliths in a circle on black water, seen from above as the mark itself, then the descent into the circle,
// the coin on the altar, and the look up at the sky the circle frames. No figures, no eyes, no text in the scene.
import * as THREE from './vendor/three.module.min.js';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { EffectComposer } from './vendor/EffectComposer.js';
import { RenderPass } from './vendor/RenderPass.js';
import { UnrealBloomPass } from './vendor/UnrealBloomPass.js';
import { OutputPass } from './vendor/OutputPass.js';

const G = new THREE.Color('#3ef08a'), WH = new THREE.Color('#f2f2ee');
const S = 0.03, R0 = (500 - 288) * S, LEN = 118 * S, WID = 52 * S, LEN0 = 150 * S, H = 13, H0 = 15.5;   // the mark's proportions, 1 unit = 33 px of the pfp
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), lerp = (a, b, t) => a + (b - a) * t;
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const T = { spin: 3.4, lit: 4.2, desc: [3.6, 10.6], hold: 11.4, up: [11.4, 14.2], title: 14.0 };

function coinTexture() { const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
  x.fillStyle = '#0c0c0c'; x.beginPath(); x.arc(256, 256, 256, 0, 7); x.fill(); x.strokeStyle = '#2b2b2b'; x.lineWidth = 14; x.beginPath(); x.arc(256, 256, 240, 0, 7); x.stroke();
  x.translate(256, 256); x.scale(.42, .42); for (let k = 0; k < 12; k++) { x.save(); x.rotate(k * Math.PI / 6); const L = k ? 118 : 150; x.fillStyle = k ? '#d8d8d2' : '#3ef08a'; const y = -330 - (L - 118), r = 9; x.beginPath(); x.roundRect(-26, y, 52, L, r); x.fill(); x.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function dotTexture() { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }
function floorAlpha() { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, '#c8c8c8'); g.addColorStop(.5, '#e2e2e2'); g.addColorStop(1, '#ffffff'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c); }

export function createIntro(canvas, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.capture });
  const dpr = Math.min(window.devicePixelRatio || 1, opts.dpr || 1.75); renderer.setPixelRatio(dpr); renderer.setClearColor(0x000000, 1);
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x000000, 0.01);
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 400); cam.up.set(0, 0, -1);

  // ---- light
  scene.add(new THREE.AmbientLight(0x6a6f6c, 0.6)); scene.add(new THREE.HemisphereLight(0x9aa6a2, 0x050505, 0.5));
  const moon = new THREE.DirectionalLight(0xbac6cc, 1.5); moon.position.set(-4, 30, 10); scene.add(moon);
  const fire = new THREE.PointLight(0xfff4e6, 0, 30, 2); fire.position.set(0, 4.6, 0); scene.add(fire);
  const glow = new THREE.PointLight(G, 0, 24, 2); glow.position.set(0, 3.2, -(R0 - 3.6)); scene.add(glow);

  // ---- the circle
  const stone = new THREE.MeshStandardMaterial({ color: 0x2c2d2d, roughness: .62, metalness: .1 });
  const world = new THREE.Group(); scene.add(world); const caps = [], slabs = [], tips = [];
  for (let k = 0; k < 12; k++) { const L = k ? LEN : LEN0, h = k ? H : H0, a = k * Math.PI / 6, g = new THREE.Group();
    const m = new THREE.Mesh(new RoundedBoxGeometry(WID, h, L, 3, .1), stone); m.position.set(0, h / 2, -(R0 + L / 2)); g.add(m);
    const cap = new THREE.Mesh(new THREE.PlaneGeometry(WID - .04, L - .04), new THREE.MeshBasicMaterial({ color: k ? WH : G, transparent: true, opacity: 0, toneMapped: false, fog: false }));
    cap.rotation.x = -Math.PI / 2; cap.position.set(0, h + .012, -(R0 + L / 2)); g.add(cap);
    const tip = new THREE.Mesh(new THREE.PlaneGeometry(WID - .16, L - .1), new THREE.MeshBasicMaterial({ color: k ? WH : G, transparent: true, opacity: 0, toneMapped: false, fog: false })); tip.position.set(0, h - (L - .1) / 2 - .08, -R0 + .012); g.add(tip); tips.push(tip);
    g.rotation.y = -a; world.add(g); caps.push(cap); slabs.push(m); }
  // the altar and the coin on it
  const altar = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.7, .55, 64), stone); altar.position.y = .275; world.add(altar);
  const coinTex = coinTexture(), coin = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.08, .12, 96), [new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: .35, metalness: .7, emissive: 0x111111 }), new THREE.MeshBasicMaterial({ map: coinTex, color: 0xb9b9b4 }), new THREE.MeshBasicMaterial({ map: coinTex, color: 0x777777 })]);
  coin.position.y = .64; world.add(coin);
  // carved circles on the floor
  const line = (r, w, o) => { const m = new THREE.Mesh(new THREE.RingGeometry(r - w, r + w, 160), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: o, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = .02; world.add(m); return m; };
  const lines = [line(2.3, .018, .1), line(R0 - .55, .02, .09), line(R0 + LEN + 1.1, .02, .07), line(R0 + LEN + 1.45, .008, .05)];
  // the mirror: the whole circle again, upside down under a dark glass floor
  const mirror = world.clone(true); mirror.scale.y = -1; scene.add(mirror); const mcoin = mirror.children.find(c => c.geometry === coin.geometry);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(160, 96), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .84, alphaMap: floorAlpha(), depthWrite: true }));
  floor.rotation.x = -Math.PI / 2; floor.renderOrder = 2; scene.add(floor);
  // a shaft of light down the middle of the circle
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 5.2, 34, 64, 1, true), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { o: { value: 0 } },
    vertexShader: 'varying vec2 vU; varying vec3 vN; varying vec3 vV; void main(){ vU=uv; vec4 p=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-p.xyz); gl_Position=projectionMatrix*p; }',
    fragmentShader: 'uniform float o; varying vec2 vU; varying vec3 vN; varying vec3 vV; void main(){ float f=pow(1.-abs(dot(vN,vV)),1.6); float a=o*f*smoothstep(0.,.25,vU.y)*pow(1.-vU.y,.6)*.16; gl_FragColor=vec4(vec3(.9,1.,.94)*a,a); }' }));
  shaft.position.y = 17; scene.add(shaft);
  // dust and stars
  const dotTex = dotTexture(), N = 1600, dp = new Float32Array(N * 3), dv = new Float32Array(N); for (let i = 0; i < N; i++) { const r = Math.sqrt(Math.random()) * 26, a = Math.random() * 7; dp[i * 3] = Math.sin(a) * r; dp[i * 3 + 1] = Math.random() * 18; dp[i * 3 + 2] = Math.cos(a) * r; dv[i] = .08 + Math.random() * .25; }
  const dustG = new THREE.BufferGeometry(); dustG.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dustG, new THREE.PointsMaterial({ size: .07, map: dotTex, transparent: true, opacity: .55, depthWrite: false, color: 0xd6ddd9 })); scene.add(dust);
  const SN = 1400, sp = new Float32Array(SN * 3); for (let i = 0; i < SN; i++) { const u = Math.random(), th = Math.random() * 7, ph = Math.acos(1 - u * .9); sp[i * 3] = Math.sin(ph) * Math.cos(th) * 180; sp[i * 3 + 1] = Math.cos(ph) * 180; sp[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * 180; }
  const starG = new THREE.BufferGeometry(); starG.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(starG, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, map: dotTex, transparent: true, opacity: 0, depthWrite: false, fog: false, color: 0xe8efe9 })); scene.add(stars);

  // ---- post
  const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, cam));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .32, .4, .55); composer.addPass(bloom); composer.addPass(new OutputPass());
  function size() { const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h); bloom.resolution.set(w * dpr / 2, h * dpr / 2); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  size(); addEventListener('resize', size);

  // ---- the path down: from above the mark, round the outside, between two stones, into the middle
  const gap = 15 * Math.PI / 180, dir = (r, y) => new THREE.Vector3(Math.sin(gap) * r, y, -Math.cos(gap) * r);
  const path = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 62, .02), new THREE.Vector3(-5, 36, -13), new THREE.Vector3(-1, 15, -21), dir(17.5, 4), dir(12.5, 2.3), dir(8, 2), new THREE.Vector3(.5, 1.9, -4.4), new THREE.Vector3(0, 1.9, -3.2)], false, 'centripetal', .5);
  const up0 = new THREE.Vector3(0, 0, -1), up1 = new THREE.Vector3(0, 1, 0), tgt = new THREE.Vector3(), upv = new THREE.Vector3(), q0 = new THREE.Quaternion(), tmp = new THREE.Vector3();
  const green = new THREE.Vector3(0, 2.6, R0 + 1), sky = new THREE.Vector3(0, 60, -.001);
  let exitT = null, exitFrom = null, onExit = null;
  function pose(t) {   // the camera and the world at time t (seconds since the intro began)
    let p, fov = 32, roll = 0;
    if (t < T.desc[0]) { p = path.getPoint(0); tgt.set(0, 0, 0); upv.copy(up0).applyAxisAngle(up1, lerp(-.5, 0, ease(clamp(t / T.desc[0])))); }
    else if (t < T.up[0]) { const u = ease(clamp((t - T.desc[0]) / (T.desc[1] - T.desc[0]))); p = path.getPoint(u); fov = lerp(32, 56, sm(.05, .7, u));
      const lookC = new THREE.Vector3(0, lerp(0, 2.2, sm(.2, .6, u)), 0); tgt.copy(lookC).lerp(green, sm(.72, 1, u)); upv.copy(up0).lerp(up1, sm(.02, .38, u)).normalize(); }
    else { const u = ease(clamp((t - T.up[0]) / (T.up[1] - T.up[0]))); p = new THREE.Vector3(0, lerp(1.9, 1.25, u), lerp(-3.2, 0, u)); fov = lerp(56, 94, u); tgt.copy(green).lerp(sky, u); upv.copy(up1).lerp(up0, sm(.15, .85, u)).normalize();
      if (t > T.up[1]) roll = (t - T.up[1]) * .045; }
    if (exitT != null) { const e = clamp((t - exitT) / 1.5), k = e * e * e; p = new THREE.Vector3(0, lerp(exitFrom, 70, k), 0); fov = lerp(94, 70, e); roll = exitRoll + e * .4; }
    cam.position.copy(p); cam.fov = fov; cam.updateProjectionMatrix(); if (roll) upv.applyAxisAngle(up1, roll); cam.up.copy(upv); cam.lookAt(tgt);
    // the spinner on the stone tops, then every stone lit and the first one green
    const head = t * 4.2, done = sm(T.spin - .4, T.spin + .5, t);
    caps.forEach((c, k) => { const d = ((head - k) % 12 + 12) % 12, trail = Math.pow(1 - d / 12, 2.4); c.material.opacity = lerp(.08 + .92 * trail, k ? .92 : 1, done) * sm(.15, 1.1, t); c.material.color.copy(k ? WH : (done > .5 ? G : WH)); });
    tips.forEach((m, k) => m.material.opacity = sm(T.up[0] + .4 + k * .06, T.up[1] - .2 + k * .06, t) * (k ? .9 : 1)); glow.intensity = sm(T.lit - .3, T.lit + 1.5, t) * 30; fire.intensity = sm(T.desc[0] + 1, T.desc[0] + 4, t) * 80;
    const low = 1 - sm(8, 50, cam.position.y); scene.fog.density = lerp(.004, .03, low); shaft.material.uniforms.o.value = sm(5.5, 9, t) * (1 - sm(T.up[0] + .6, T.up[1], t) * .55);
    stars.material.opacity = sm(T.up[0], T.up[1], t) * .85 + (1 - sm(0, 3, t)) * 0; coin.rotation.y = mcoin.rotation.y = t * .35; coin.position.y = mcoin.position.y = .64 + Math.sin(t * 1.3) * .03; mcoin.position.y = .64 + Math.sin(t * 1.3) * .03;
    lines.forEach(l => l.material.opacity = l.userData.o != null ? l.userData.o : (l.userData.o = l.material.opacity));
  }
  let exitRoll = 0;
  let t0 = null, raf = 0, still = null, last = 0, dead = false;
  function frame(now) { if (dead) return; raf = requestAnimationFrame(frame); if (t0 == null) t0 = now; const t = still != null ? still : (now - t0) / 1000, dt = Math.min(.05, (now - last) / 1000 || .016); last = now;
    for (let i = 0; i < N; i++) { dp[i * 3 + 1] -= dv[i] * dt; if (dp[i * 3 + 1] < 0) dp[i * 3 + 1] += 18; } dustG.attributes.position.needsUpdate = true;
    pose(t); composer.render(); if (opts.onTime) opts.onTime(t);
    if (exitT != null && t - exitT > 1.55 && onExit) { const f = onExit; onExit = null; f(); } }
  raf = requestAnimationFrame(frame);
  const api = {
    time: () => t0 == null ? 0 : (performance.now() - t0) / 1000,
    seek(t) { t0 = performance.now() - t * 1000; },
    still(t) { still = t; },
    render(t) { pose(t); composer.render(); },   // for frame capture
    exit(cb) { const t = api.time(); exitT = t; exitFrom = t > T.up[0] ? cam.position.y : 1.25; exitRoll = t > T.up[1] ? (t - T.up[1]) * .045 : 0; if (t < T.up[1]) { api.seek(T.up[1] + .01); exitT = T.up[1] + .01; } onExit = cb; },
    dispose() { dead = true; cancelAnimationFrame(raf); removeEventListener('resize', size); renderer.dispose(); scene.traverse(o => { if (o.geometry) o.geometry.dispose(); }); },
    pause(p) { if (p) { cancelAnimationFrame(raf); raf = 0; } else if (!raf && !dead) { const t = api.time(); raf = requestAnimationFrame(n => { t0 = n - t * 1000; frame(n); }); } }
  };
  return api;
}
