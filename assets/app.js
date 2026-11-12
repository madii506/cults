// CULTS site. every coin is a cult.
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const API = '/api/cults';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const short = w => w ? w.slice(0, 4) + '…' + w.slice(-4) : '';
const nf = (n, d = 2) => n == null || isNaN(n) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
const big = n => n == null ? '—' : n >= 1e9 ? nf(n / 1e9, 2) + 'B' : n >= 1e6 ? nf(n / 1e6, 2) + 'M' : n >= 1e4 ? nf(n / 1e3, 1) + 'K' : nf(n, n < 10 ? 3 : 0);
const pct = (x, d = 2) => x == null ? '—' : (x * 100 < .01 && x > 0 ? '<0.01' : nf(x * 100, d)) + '%';
const ago = s => { const d = Date.now() / 1000 - s; return d < 90 ? 'just now' : d < 5400 ? Math.round(d / 60) + 'm ago' : d < 129600 ? Math.round(d / 3600) + 'h ago' : Math.round(d / 86400) + 'd ago'; };
const sym = c => c && c.symbol ? '$' + esc(c.symbol) : 'a coin';
const icon = (c, cls = 'ico') => c && c.icon ? `<img class="${cls}" src="${esc(IMG(c.icon))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'">` : `<span class="${cls}"></span>`;
const IMG = u => u ? (/^data:/.test(u) ? u : API + '?a=img&u=' + encodeURIComponent(u)) : '';
const isMint = s => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(s || '').trim());
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
async function api(a, q = {}, body) { const u = API + '?a=' + a + Object.entries(q).filter(([, v]) => v != null).map(([k, v]) => '&' + k + '=' + encodeURIComponent(v)).join('');
  const r = await fetch(u, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}); const j = await r.json().catch(() => ({ error: 'the engine did not answer' })); if (!r.ok || j.error) throw new Error(j.error || 'the engine did not answer'); return j; }
let toastT; function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3600); }
const copy = (s, m) => { navigator.clipboard && navigator.clipboard.writeText(s).then(() => toast(m || 'copied'), () => toast(s)); };

// ---------------------------------------------------------------- the mark: twelve bars, the first one green and longer
const BAR = k => { const L = k ? 118 : 150; return `<g transform="rotate(${k * 30} 500 500)"><rect x="474" y="${500 - 330 - (L - 118)}" width="52" height="${L}" rx="9"${k ? '' : ' class="g"'}/></g>`; };
$$('[data-ring]').forEach(s => { s.innerHTML = Array.from({ length: 12 }, (_, k) => BAR(k)).join(''); if (s.classList.contains('spin')) $$('rect', s).forEach((r, k) => r.style.animationDelay = (k * .1 - 1.2) + 's'); });
const ringEmpty = '<svg class="ring" viewBox="0 0 1000 1000">' + Array.from({ length: 12 }, (_, k) => BAR(k)).join('') + '</svg>';

// ---------------------------------------------------------------- the intro
let lenis = null, CONFIG = {}, WALLET = null, PF = Promise.resolve([]);
const intro = $('#intro'); let introApi = null, entered = false;
function finishIntro() { if (entered) return; entered = true; intro.classList.add('gone'); document.body.classList.remove('intro-on'); setTimeout(() => { if (introApi) introApi.dispose(); intro.remove(); }, 700); startSite(); }
function leave() { if (!introApi) return finishIntro(); intro.classList.add('out'); introApi.exit(finishIntro); setTimeout(finishIntro, 2200); }
$('#skip').onclick = leave; $('#enter').onclick = leave;
addEventListener('keydown', e => { if (!entered && (e.key === 'Enter' || e.key === 'Escape')) leave(); });
const noIntro = reduced || /[?&]nointro/.test(location.search) || location.hash.startsWith('#/c/') || !(() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } })();
if (noIntro) queueMicrotask(finishIntro);
else import('./intro3d.js?v=1').then(m => { let titled = false; introApi = m.createIntro($('#introCanvas'), { onTime: t => { if (t > .05) intro.classList.add('go'); if (!titled && t > m.T.title) { titled = true; intro.classList.add('titled'); } } });
  document.addEventListener('visibilitychange', () => introApi && !entered && introApi.pause(document.hidden)); }).catch(finishIntro);

// ---------------------------------------------------------------- the site
function go(id) { const el = id === 'top' ? 0 : document.getElementById(id); if (el == null) return; if (lenis) lenis.scrollTo(el, { offset: id === 'top' ? 0 : -60, duration: 1.6 }); else (el === 0 ? scrollTo(0, 0) : el.scrollIntoView({ behavior: 'smooth' })); }
document.addEventListener('click', e => { const a = e.target.closest('[data-go]'); if (a) { e.preventDefault(); go(a.dataset.go); } });

function startSite() { document.body.classList.add('in');
  if (window.Lenis && !reduced) { lenis = new Lenis({ duration: 1.15, smoothWheel: true, wheelMultiplier: .95, prevent: n => !!n.closest('.cult, .coins, .split') }); if (window.gsap) { lenis.on('scroll', ScrollTrigger.update); gsap.ticker.add(t => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0); } else { const raf = t => { lenis.raf(t); requestAnimationFrame(raf); }; requestAnimationFrame(raf); } }
  motion(); rites(); load(); route(); }

// ---------------------------------------------------------------- motion
function motion() { const nav = $('#nav'), navBars = $$('#nav .ring rect'), links = $$('.links a'), secs = links.map(a => document.getElementById(a.dataset.go));
  const onScroll = () => { const y = scrollY, h = document.documentElement.scrollHeight - innerHeight, p = h > 0 ? y / h : 0; nav.classList.toggle('solid', y > 40);
    const lit = Math.round(p * 12); navBars.forEach((r, k) => r.classList.toggle('on', k === 0 ? true : k <= lit));
    let cur = -1; secs.forEach((s, i) => { if (s && s.getBoundingClientRect().top < innerHeight * .45) cur = i; }); links.forEach((a, i) => a.classList.toggle('on', i === cur)); };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  if (!window.gsap || reduced) { $$('.m-line .w').forEach(w => w.style.opacity = 1); return; }
  gsap.registerPlugin(ScrollTrigger);
  // hero: the letters rise, the ring lights in spinner order, then breathes and turns as you scroll away
  const hr = $$('#heroRing rect');
  gsap.from('.word span', { yPercent: 110, opacity: 0, duration: 1.3, ease: 'expo.out', stagger: .07, delay: .15 });
  gsap.from(['.hero .sub', '.hero .row', '.ticker'], { y: 24, opacity: 0, duration: 1.1, ease: 'power3.out', stagger: .12, delay: .55 });
  gsap.fromTo(hr, { opacity: 0, scale: .6, svgOrigin: '500 500' }, { opacity: 1, scale: 1, duration: 1.1, ease: 'expo.out', stagger: .06, delay: .1, onComplete: breathe });
  function breathe() { const tl = gsap.timeline({ repeat: -1 }); hr.forEach((r, k) => tl.to(r, { opacity: .25, duration: .6, ease: 'sine.inOut', yoyo: true, repeat: 1 }, k * .22)); }
  gsap.to('#heroRing', { rotate: 120, scale: 1.5, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero-copy', { yPercent: -40, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom 20%', scrub: true } });
  // the manifesto: pinned, each word lights as you scroll
  $$('.m-line').forEach(l => { l.innerHTML = l.textContent.split(' ').map(w => `<span class="w">${esc(w)}</span>`).join(' '); });
  const words = $$('.m-line .w');
  gsap.to(words, { opacity: 1, ease: 'none', stagger: .5, scrollTrigger: { trigger: '.manifesto', start: 'top top', end: '+=' + Math.round(innerHeight * 1.6), scrub: .6, pin: true } });
  // the rites: a horizontal walk on wide screens
  const mm = gsap.matchMedia();
  mm.add('(min-width: 641px)', () => { const tr = $('.rites-track'), dist = () => Math.max(0, tr.scrollWidth - innerWidth);
    gsap.to(tr, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: '.rites-pin', start: 'center center', end: () => '+=' + dist(), scrub: .8, pin: true, invalidateOnRefresh: true } }); });
  // reveals, the ladder, the closing mark
  ScrollTrigger.batch('.rv', { start: 'top 88%', onEnter: b => gsap.fromTo(b, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'expo.out', stagger: .08, overwrite: true }) });
  gsap.set('.rv', { opacity: 0 });
  gsap.from('.lv .bar', { scaleY: 0, transformOrigin: '50% 100%', duration: 1.2, ease: 'expo.out', stagger: .1, scrollTrigger: { trigger: '.ladder', start: 'top 80%' } });
  const cr = $$('#closeRing rect'); gsap.fromTo(cr, { opacity: .08 }, { opacity: 1, stagger: .1, ease: 'none', scrollTrigger: { trigger: '.close', start: 'top 80%', end: 'center center', scrub: true } });
  gsap.to('#closeRing', { rotate: 30, ease: 'none', scrollTrigger: { trigger: '.close', start: 'top bottom', end: 'bottom top', scrub: true } });
  addEventListener('load', () => ScrollTrigger.refresh());
}

// ---------------------------------------------------------------- the five rites, drawn
function rites() { const cv = $$('[data-rite]'), live = new Set(), W = 500, H = 400;
  cv.forEach(c => { c.width = W * 2; c.height = H * 2; c._x = c.getContext('2d'); c._x.scale(2, 2); });
  const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? live.add(e.target) : live.delete(e.target)), { rootMargin: '100px' }); cv.forEach(c => io.observe(c));
  const bar = (x, k, cx, cy, s, col, L) => { x.save(); x.translate(cx, cy); x.rotate(k * Math.PI / 6); x.scale(s, s); const l = L || (k ? 118 : 150); x.fillStyle = col; x.beginPath(); x.roundRect(-26, -330 - (l - 118), 52, l, 9); x.fill(); x.restore(); };
  const dots = Array.from({ length: 260 }, (_, i) => { const ring = Math.floor(Math.sqrt(i * 1.6)), n = Math.max(1, ring * 9), a = (i * 2.399) % (Math.PI * 2); return { a, r: 14 + ring * 9.2, s: Math.max(.8, 4.4 - ring * .22), d: Math.random() }; });
  const parts = Array.from({ length: 70 }, () => ({ k: Math.floor(Math.random() * 12), t: Math.random() }));
  const draw = {
    census(x, t) { x.fillStyle = '#000'; x.fillRect(0, 0, W, H); const cx = W / 2, cy = H / 2, p = (t % 6) / 6;
      dots.forEach((d, i) => { const e = Math.min(1, Math.max(0, (p * 1.6 - d.d * .6))), k = 1 - Math.pow(1 - e, 3), ang = d.a + (1 - k) * 2, r = d.r * k + (1 - k) * 260;
        x.globalAlpha = Math.min(1, e * 2) * (p > .9 ? (1 - p) * 10 : 1); x.fillStyle = i === 0 ? '#3ef08a' : '#f2f2ee'; x.beginPath(); x.arc(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, d.s, 0, 7); x.fill(); }); x.globalAlpha = 1; },
    vow(x, t) { x.fillStyle = '#000'; x.fillRect(0, 0, W, H); const p = (t % 7) / 7, cx = W / 2; x.strokeStyle = '#2a2a27'; x.lineWidth = 1.5; x.beginPath(); x.roundRect(cx - 120, 50, 240, 300, 18); x.stroke();
      for (let i = 0; i < 12; i++) bar(x, i, cx, 112, .1, i ? '#f2f2ee' : '#3ef08a');
      const lines = [[170, 150], [200, 110], [226, 130], [252, 90]]; lines.forEach(([y, w], i) => { const e = Math.min(1, Math.max(0, p * 5 - i * .6)); x.fillStyle = i === 0 ? '#f2f2ee' : '#55554f'; x.beginPath(); x.roundRect(cx - w / 2, y, w * e, i === 0 ? 10 : 6, 3); x.fill(); });
      const s = Math.min(1, Math.max(0, p * 3.2 - 1.9)); x.strokeStyle = '#f2f2ee'; x.lineWidth = 2.2; x.beginPath(); for (let i = 0; i <= 60 * s; i++) { const u = i / 60, xx = cx - 70 + u * 140, yy = 300 + Math.sin(u * 14) * 9 * (1 - u * .5) - u * 8; i ? x.lineTo(xx, yy) : x.moveTo(xx, yy); } x.stroke();
      const st = Math.min(1, Math.max(0, p * 4 - 2.9)); if (st > 0) { x.globalAlpha = st; x.strokeStyle = '#3ef08a'; x.lineWidth = 3; x.beginPath(); x.arc(cx + 86, 300, 22 + (1 - st) * 30, 0, 7); x.stroke(); x.beginPath(); x.moveTo(cx + 76, 300); x.lineTo(cx + 84, 308); x.lineTo(cx + 98, 291); x.stroke(); x.globalAlpha = 1; } },
    rank(x, t) { x.fillStyle = '#000'; x.fillRect(0, 0, W, H); const p = (t % 6) / 6, lit = Math.floor(p * 15); for (let k = 0; k < 12; k++) { const on = k === 0 ? lit >= 12 : k <= lit; bar(x, k, W / 2, H / 2, .48, on ? (k === 0 ? '#3ef08a' : '#f2f2ee') : '#1e1e1c'); } },
    bless(x, t) { x.fillStyle = '#000'; x.fillRect(0, 0, W, H); const cx = W / 2, cy = H / 2, hit = new Array(12).fill(0);
      parts.forEach(q => { const u = (q.t + t * .35) % 1, a = q.k * Math.PI / 6 - Math.PI / 2, r = 18 + u * 110; if (u > .85) hit[q.k] = 1; x.globalAlpha = Math.sin(u * Math.PI); x.fillStyle = '#3ef08a'; x.beginPath(); x.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2.2, 0, 7); x.fill(); });
      x.globalAlpha = 1; for (let k = 0; k < 12; k++) bar(x, k, cx, cy, .44, k === 0 ? '#3ef08a' : hit[k] ? '#f2f2ee' : '#8b8b86'); x.fillStyle = '#3ef08a'; x.beginPath(); x.arc(cx, cy, 10 + Math.sin(t * 3) * 2, 0, 7); x.fill(); },
    apostasy(x, t) { x.fillStyle = '#000'; x.fillRect(0, 0, W, H); const cyc = Math.floor(t / 4), p = (t % 4) / 4, who = 1 + (cyc * 5) % 11, cx = W / 2, cy = H / 2;
      for (let k = 0; k < 12; k++) { if (k === who) continue; bar(x, k, cx, cy, .44, k === 0 ? '#3ef08a' : '#f2f2ee'); }
      const e = Math.max(0, p - .35) / .65, fall = e * e; x.save(); x.translate(cx, cy); x.rotate(who * Math.PI / 6); x.translate(0, -120 * (1 - fall * .2)); x.rotate(fall * 1.2); x.translate(fall * 30, fall * 260); x.globalAlpha = 1 - fall * .8;
      x.fillStyle = p > .25 ? '#ff5f57' : '#f2f2ee'; x.beginPath(); x.roundRect(-11, -26, 23, 52, 4); x.fill(); x.restore(); x.globalAlpha = 1;
      x.strokeStyle = '#1e1e1c'; x.lineWidth = 1.5; x.beginPath(); x.roundRect(cx - 41, cy - 40, 82, 80, 6); x.stroke(); }
  };
  const t0 = performance.now(); (function loop(now) { requestAnimationFrame(loop); const t = (now - t0) / 1000; live.forEach(c => draw[c.dataset.rite](c._x, t)); })(t0);
  cv.forEach(c => draw[c.dataset.rite](c._x, 2.5)); }

// ---------------------------------------------------------------- data
async function load() {
  api('config').then(c => { CONFIG = c; if (c.test) document.body.insertAdjacentHTML('beforeend', '<div class="test-badge">LOCAL TEST DATA</div>');
    const L = []; if (c.ca) L.push(`<button class="btn ghost" data-ca="${esc(c.ca)}">CA ${short(c.ca)}</button>`, `<a class="btn ghost" href="https://pump.fun/coin/${esc(c.ca)}" target="_blank" rel="noopener">buy</a>`); if (c.x) L.push(`<a class="btn ghost" href="${esc(c.x)}" target="_blank" rel="noopener">𝕏</a>`); $('#links').innerHTML = L.join(''); }).catch(() => { });
  PF = api('pumpfun').catch(() => []); loadLog(); loadBoard(); loadWall(); picks(); faiths(); orbit(); pfTable(); setInterval(() => { if (!document.hidden) loadLog(); }, 30000); }
document.addEventListener('click', e => { const b = e.target.closest('[data-ca]'); if (b) copy(b.dataset.ca, 'contract address copied'); const m = e.target.closest('[data-cult]'); if (m) { e.preventDefault(); openCult(m.dataset.cult); } });

async function loadLog(fresh) { const tk = $('#ticker'), tr = $('.track', tk);
  try { const j = await api('log', fresh ? { fresh: 1 } : {}); if (!j.list.length) { tk.classList.add('static'); tr.innerHTML = '<span>no vows yet. the first one is written here.</span>'; return; }
    const item = e => e.kind === 'vow' ? `<span><span class="k">● vow</span> <b>${short(e.w)}</b> swore ${big(e.ui)} ${sym({ symbol: e.coin })} for ${e.days}d · ${ago(e.at)}</span>`
      : e.kind === 'broke' ? `<span><span class="k r">● apostate</span> <b>${short(e.w)}</b> broke a ${e.days}-day vow on day ${e.day} · ${sym({ symbol: e.coin })}</span>`
      : e.kind === 'kept' ? `<span><span class="k">● kept</span> <b>${short(e.w)}</b> kept ${e.days} days of ${sym({ symbol: e.coin })}</span>`
      : `<span><span class="k">● blessing</span> <b>${short(e.w)}</b> blessed ${e.to} faithful of ${sym({ symbol: e.coin })} with ${nf(e.sol, 3)} SOL</span>`;
    const h = j.list.slice(0, 30).map(item).join(''); tk.classList.remove('static'); tr.innerHTML = h + h; tr.style.animationDuration = Math.max(40, j.list.slice(0, 30).length * 7) + 's'; }
  catch (e) { tk.classList.add('static'); tr.innerHTML = `<span>the chain is not answering right now. ${esc(e.message)}</span>`; } }

async function loadBoard(fresh) { const T = $('#boardTable'), tot = $('#totals');
  try { const j = await api('board', fresh ? { fresh: 1 } : {}), t = j.totals;
    tot.innerHTML = [['cults', t.cults], ['vows', t.vows], ['believers', t.believers], ['kept', t.kept], ['apostates', t.apostates]].map(([k, v]) => `<div class="stat"><b data-count="${v}">${nf(v, 0)}</b><span>${k}</span></div>`).join('');
    if (!j.cults.length) { T.innerHTML = `<div class="empty">${ringEmpty}<span>no cult has a vow yet. the first vow puts its coin on top.</span><a class="btn sm" href="#vow" data-go="vow">take a vow</a></div>`;
      PF.then(L => { if (!L.length) return; T.insertAdjacentHTML('beforeend', '<div style="padding:0 18px 22px"><p class="dim" style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;text-align:center">waiting for a prophet</p><div class="unsworn">' + L.slice(0, 6).map(c => `<div class="pr" data-cult="${esc(c.mint)}">${pic(c)}<span class="t"><b>$${esc(c.symbol)}</b><small>${big(c.holders)} holders · 0 sworn</small></span><span class="mc">${usd(c.mcap)}</span><span class="g" style="font-size:12px">be the first ›</span></div>`).join('') + '</div></div>'); }); return; }
    T.innerHTML = '<div class="tr th"><span>#</span><span style="text-align:left">cult</span><span>believers</span><span>sworn</span><span>faith</span><span>apostates</span><span>blessed</span><span></span></div>' +
      j.cults.map((c, i) => `<div class="tr" data-cult="${esc(c.mint)}"><span>${String(i + 1).padStart(2, '0')}</span><span class="nm">${icon(c.coin)}<b>${c.coin.symbol ? '$' + esc(c.coin.symbol) : short(c.mint)}</b></span><span>${nf(c.believers, 0)}</span><span>${pct(c.sworn)}</span><span>${nf(c.faith, 2)}</span><span>${nf(c.apostates, 0)}</span><span>${nf(c.blessed, 3)}</span><span class="go">›</span></div>`).join('');
    counters(tot); }
  catch (e) { T.innerHTML = `<div class="empty">the chain is not answering right now.<br>${esc(e.message)}</div>`; } }
function counters(root) { if (!window.gsap) return; $$('[data-count]', root).forEach(b => { const v = +b.dataset.count, o = { n: 0 }; gsap.to(o, { n: v, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: b, start: 'top 92%' }, onUpdate: () => b.textContent = nf(Math.round(o.n), 0) }); }); }

async function loadWall(fresh) { const S = $('#stones');
  try { const j = await api('wall', fresh ? { fresh: 1 } : {}); if (!j.list.length) { S.innerHTML = `<div class="empty">${ringEmpty}<span>no apostates yet. the first broken vow is carved here.</span></div>`; return; }
    S.innerHTML = j.list.slice(0, 120).map(v => `<div class="stone"><b>${short(v.w)}</b>swore ${big(v.ui)} for ${v.days} days<br>${v.never ? 'never held it' : v.day ? `broke on day ${v.day}` : 'broke it'}${v.brokeAt ? ' · ' + ago(v.brokeAt) : ''}<div class="c">${icon(v.coin)}<span>${v.coin && v.coin.symbol ? '$' + esc(v.coin.symbol) : short(v.mint)}</span></div><div style="margin-top:8px"><a href="https://solscan.io/tx/${esc(v.brokeSig || v.sig)}" target="_blank" rel="noopener">proof</a></div></div>`).join(''); }
  catch (e) { S.innerHTML = `<div class="empty">the chain is not answering right now.<br>${esc(e.message)}</div>`; } }

// ---------------------------------------------------------------- the congregations: real pump.fun coins
const ringSmall = '<svg viewBox="0 0 1000 1000">' + Array.from({ length: 12 }, (_, k) => BAR(k)).join('') + '</svg>';
const pic = c => c.icon ? `<img src="${esc(IMG(c.icon))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'ph'}))">` : '<span class="ph"></span>';
const ch = x => x == null ? '' : `<span class="${x >= 0 ? 'up' : 'dn'}">${x >= 0 ? '+' : ''}${nf(x, 1)}%</span>`;
const usd = n => n == null ? '' : '$' + big(n);
async function faiths() { const H = $('#hall'), R1 = $('#rising'), R2 = $('#rising2');
  api('hall').then(L => { if (!L.length) { H.innerHTML = '<div class="f-empty" style="grid-column:1/-1">the chain is quiet right now.</div>'; return; }
    H.innerHTML = L.slice(0, 10).map(c => `<div class="fc" data-cult="${esc(c.mint)}"><div class="pic">${pic(c)}${ringSmall}</div><b>$${esc(c.symbol)}</b><span class="nm2">${esc(c.name || '')}</span><span class="hc">${big(c.holders)}</span><span class="hl">holders</span><span class="mc">${usd(c.mcap)} ${ch(c.ch24)}</span></div>`).join('');
    if (window.gsap && !reduced) gsap.from($$('.fc', H), { y: 50, opacity: 0, duration: 1, ease: 'expo.out', stagger: .06, scrollTrigger: { trigger: H, start: 'top 85%' } }); }).catch(() => { H.innerHTML = '<div class="f-empty" style="grid-column:1/-1">the chain is not answering right now.</div>'; });
  api('trending').then(L => { if (!L.length) { $('.f-rows').innerHTML = '<div class="f-empty">nothing is rising right now.</div>'; return; }
    const pill = c => `<div class="fr" data-cult="${esc(c.mint)}">${pic(c)}<div style="text-align:left"><b>$${esc(c.symbol)}</b><br><span>${big(c.holders)} holders · ${usd(c.mcap)} ${ch(c.ch24)}</span></div></div>`;
    const fill = X => { let set = X.map(pill).join(''), n = X.length; while (n < 14) { set += X.map(pill).join(''); n += X.length; } return set + set; }; const a = L.filter((_, i) => i % 2 === 0), b = L.filter((_, i) => i % 2 === 1); R1.innerHTML = fill(a); R2.innerHTML = fill(b.length ? b : a); }).catch(() => { $('.f-rows').innerHTML = '<div class="f-empty">the chain is not answering right now.</div>'; }); }

// the orbit: the twelve biggest pump.fun congregations circle the mark, the biggest on top in green, like the mark itself
async function orbit() { const L = (await PF).slice(0, 12), box = $('#orbit'), hero = $('.hero'); if (L.length < 6 || !box) return;
  box.innerHTML = L.map((c, k) => `<button class="orb${k ? '' : ' first'}" data-cult="${esc(c.mint)}" title="$${esc(c.symbol)} · ${big(c.holders)} holders">${pic(c)}<span>$${esc(c.symbol)}</span></button>`).join('');
  const orbs = $$('.orb', box), n = orbs.length; let rot = 0, last = performance.now(), live = true, hover = false;
  new IntersectionObserver(e => live = e[0].isIntersecting).observe(hero); box.addEventListener('mouseover', () => hover = true); box.addEventListener('mouseout', () => hover = false);
  (function f(now) { requestAnimationFrame(f); const dt = Math.min(.05, (now - last) / 1000); last = now; if (!live) return; if (!hover && !reduced) rot += dt * (Math.PI * 2 / 160);
    const W = hero.clientWidth, H = hero.clientHeight, mob = W < 640, rx = mob ? W * .43 : Math.min(W * .43, 660), ry = mob ? H * .38 : Math.min(H * .36, 340), cx = W / 2, cy = H / 2 + 6;
    orbs.forEach((o, k) => { const a = -Math.PI / 2 + k * (Math.PI * 2 / n) + rot; o.style.transform = `translate(${cx + Math.cos(a) * rx}px, ${cy + Math.sin(a) * ry}px)`; }); })(last);
  setTimeout(() => box.classList.add('on'), 400); }
// the biggest congregations on pump.fun, ranked by holders, live
async function pfTable() { const L = await PF, box = $('#pf'), more = $('#pfMore'); if (!L.length) { box.innerHTML = '<div class="f-empty">the chain is not answering right now.</div>'; return; }
  const max = L[0].holders || 1; let shown = 0;
  const row = (c, i) => `<div class="pr" data-cult="${esc(c.mint)}"><span class="n">${String(i + 1).padStart(2, '0')}</span>${pic(c)}<span class="t"><b>$${esc(c.symbol)}</b><small>${esc(c.name || '')}</small></span><span class="bar"><i style="width:${Math.max(3, (c.holders || 0) / max * 100)}%"></i><em>${nf(c.holders, 0)} holders</em></span><span class="mc">${usd(c.mcap)}</span><span class="ch">${ch(c.ch24) || '<span class="dim">—</span>'}</span></div>`;
  const show = n => { const add = L.slice(shown, n); box.insertAdjacentHTML('beforeend', add.map((c, i) => row(c, shown + i)).join('')); const fresh = $$('.pr', box).slice(shown); shown = Math.min(n, L.length); more.hidden = shown >= L.length; more.textContent = `show all ${L.length}`;
    if (window.gsap && !reduced) gsap.from(fresh.map(r => $('.bar i', r)), { scaleX: 0, duration: 1.4, ease: 'expo.out', stagger: .04, scrollTrigger: { trigger: fresh[0], start: 'top 90%' } }); };
  show(15); more.onclick = () => { show(L.length); if (window.ScrollTrigger) ScrollTrigger.refresh(); }; if (window.ScrollTrigger) ScrollTrigger.refresh(); }

// ---------------------------------------------------------------- census
async function picks() { try { const L = await api('trending'); $('#picks').innerHTML = L.slice(0, 8).map(t => `<button class="pick" data-pick="${esc(t.mint)}">${icon(t)}${esc(t.symbol)}</button>`).join(''); } catch { } }
document.addEventListener('click', e => { const p = e.target.closest('[data-pick]'); if (p) { $('#censusMint').value = p.dataset.pick; runCensus(); } });
$('#censusForm').onsubmit = e => { e.preventDefault(); runCensus(); };
let cong = null;
async function runCensus() { const m = $('#censusMint').value.trim(), out = $('#censusOut'); if (!isMint(m)) return toast('paste a coin address');
  const btn = $('#censusForm .btn'); btn.disabled = true; btn.textContent = 'counting…';
  try { const [c, cu] = await Promise.all([api('census', { mint: m }), api('cult', { mint: m }).catch(() => null)]); out.hidden = false;
    $('#cgMid').innerHTML = `${c.coin.icon ? `<img src="${esc(IMG(c.coin.icon))}" alt="" referrerpolicy="no-referrer">` : ''}<b>${nf(c.holders, 0)}</b><span>${c.coin.symbol ? '$' + esc(c.coin.symbol) + ' · ' : ''}holders</span>`;
    $('#censusStats').innerHTML = [[nf(c.holders, 0), 'holders'], [pct(c.top10, 1), 'top 10 hold'], [nf(c.tiers.whale, 0), 'whales ≥1%'], [cu ? nf(cu.believers, 0) : '—', 'sworn believers'], [pct(c.top1, 2), 'largest wallet'], [nf(c.tiers.shrimp, 0), 'shrimp <0.01%'], [cu ? nf(cu.apostates, 0) : '—', 'apostates'], [(c.ms / 1000).toFixed(1) + 's', 'read in']].map(([v, k]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
    $('#openCult').dataset.cult = c.mint; drawCong(c); if (lenis) lenis.scrollTo(out, { offset: -80 }); }
  catch (e) { toast(e.message); } finally { btn.disabled = false; btn.textContent = 'count'; } }
function drawCong(c) { const cv = $('#congCanvas'), box = cv.parentElement, S = box.clientWidth, d = Math.min(2, devicePixelRatio || 1); cv.width = S * d; cv.height = S * d; const x = cv.getContext('2d'); x.scale(d, d);
  const L = c.ring, n = L.length, max = L.length ? L[0][1] : 1, pts = [], cx = S / 2, cy = S / 2, R0 = S * .2, R1 = S * .48;
  // the congregation on a spiral: biggest bags nearest the middle, every dot sized by its share
  L.forEach(([w, s], i) => { const u = n > 1 ? i / (n - 1) : 0, r = R0 + (R1 - R0) * Math.sqrt(u), a = i * 2.39996 - Math.PI / 2, sz = Math.max(1.4, Math.min(S * .03, Math.sqrt(s / max) * S * .03)); pts.push({ w, s, x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, sz, d: i / n }); });
  cong = { pts, S }; let t0 = performance.now();
  (function f(now) { const p = Math.min(1, (now - t0) / 1600); x.clearRect(0, 0, S, S); x.strokeStyle = '#1c1c1a'; x.lineWidth = 1; [R0 - 8, R1 + 8].forEach(r => { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke(); });
    pts.forEach((q, i) => { const e = Math.min(1, Math.max(0, p * 1.5 - q.d * .5)), k = 1 - Math.pow(1 - e, 3); if (!e) return; x.globalAlpha = k; x.fillStyle = i < 12 ? (i ? '#f2f2ee' : '#3ef08a') : '#8b8b86'; x.beginPath(); x.arc(cx + (q.x - cx) * k, cy + (q.y - cy) * k, q.sz, 0, 7); x.fill(); });
    x.globalAlpha = 1; if (p < 1) requestAnimationFrame(f); })(t0); }
$('#congCanvas').addEventListener('mousemove', e => { if (!cong) return; const r = e.target.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top; let best = null, bd = 1e9; for (const q of cong.pts) { const d = Math.hypot(q.x - mx, q.y - my); if (d < bd && d < Math.max(8, q.sz + 4)) { bd = d; best = q; } }
  let tip = $('.cg-tip'); if (!best) { if (tip) tip.remove(); return; } if (!tip) { tip = document.createElement('div'); tip.className = 'cg-tip'; e.target.parentElement.appendChild(tip); } tip.style.left = best.x + 'px'; tip.style.top = best.y + 'px'; tip.textContent = short(best.w) + ' · ' + pct(best.s, 3); });
$('#congCanvas').addEventListener('mouseleave', () => { const t = $('.cg-tip'); if (t) t.remove(); });

// ---------------------------------------------------------------- wallet
const prov = () => (window.phantom && window.phantom.solana) || window.solflare || window.backpack || window.solana || null;
let web3P = null; const web3 = () => web3P || (web3P = new Promise((ok, no) => { if (window.solanaWeb3) return ok(window.solanaWeb3); const s = document.createElement('script'); s.src = '/assets/web3.min.js'; s.onload = () => ok(window.solanaWeb3); s.onerror = () => no(new Error('could not load the signer')); document.head.appendChild(s); }));
const b64u8 = b => Uint8Array.from(atob(b), c => c.charCodeAt(0)), u8b64 = u => { let s = ''; u.forEach(c => s += String.fromCharCode(c)); return btoa(s); };
async function connect() { const p = prov(); if (!p) { toast('no Solana wallet found. open this page in Phantom, Solflare or Backpack'); return null; }
  try { const r = await p.connect(); WALLET = String((r && r.publicKey) || p.publicKey); } catch { toast('the wallet did not connect'); return null; }
  $('#connect').textContent = short(WALLET); $('#vowWallet').textContent = WALLET; $('#vowConnect').hidden = true; holdings(); mine(); return WALLET; }
$('#connect').onclick = () => WALLET ? copy(WALLET, 'wallet address copied') : connect(); $('#vowConnect').onclick = connect;
async function signSend(b64) { const S = await web3(), tx = S.Transaction.from(b64u8(b64)), p = prov();
  if (p.signAndSendTransaction) { const r = await p.signAndSendTransaction(tx); return typeof r === 'string' ? r : r.signature; }
  const s = await p.signTransaction(tx); return (await api('send', {}, { tx: u8b64(s.serialize()) })).sig; }

// ---------------------------------------------------------------- the vow
const V = { mint: null, coin: null, pct: 100, days: 30, hold: [] };
async function holdings() { const box = $('#vowCoins'); box.innerHTML = '<p class="dim">reading your wallet…</p>';
  try { V.hold = await api('holdings', { w: WALLET }); if (!V.hold.length) { box.innerHTML = '<p class="dim">this wallet holds no coins. paste one below once you do.</p>'; return; }
    box.innerHTML = V.hold.map(h => `<button class="coin" data-coin="${esc(h.mint)}">${icon(h)}${h.symbol ? '$' + esc(h.symbol) : short(h.mint)} <small>${big(h.ui)}</small></button>`).join(''); if (V.mint) pickCoin(V.mint); }
  catch (e) { box.innerHTML = `<p class="dim">${esc(e.message)}</p>`; } }
function pickCoin(m) { V.mint = m; const h = V.hold.find(x => x.mint === m); V.coin = h || V.coin; $$('.coin').forEach(b => b.classList.toggle('on', b.dataset.coin === m)); if (!h) $('#vowMint').value = m; vowState(); }
document.addEventListener('click', e => { const c = e.target.closest('[data-coin]'); if (c) { $('#vowMint').value = ''; V.coin = null; pickCoin(c.dataset.coin); } });
$('#vowMint').addEventListener('input', e => { const m = e.target.value.trim(); if (isMint(m)) { V.coin = null; pickCoin(m); api('cult', { mint: m }).then(c => { V.coin = { ...c.coin, mint: m }; card(); }).catch(() => { }); } });
const seg = (id, key) => $(id).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$(id + ' button').forEach(x => x.classList.toggle('on', x === b)); V[key] = +b.dataset.v; vowState(); });
seg('#vowPct', 'pct'); seg('#vowDays', 'days');
function vowState() { $('#vowSign').disabled = !V.mint; $('#vowSign').textContent = WALLET ? 'sign the vow' : 'connect and sign'; card(); }
function card() { const c = $('#vowCard'), x = c.getContext('2d'), W = 1200, H = 1500, s = V.coin && V.coin.symbol ? '$' + V.coin.symbol : V.mint ? short(V.mint) : '$YOURCOIN';
  x.fillStyle = '#050505'; x.fillRect(0, 0, W, H); x.strokeStyle = '#232321'; x.lineWidth = 4; x.beginPath(); x.roundRect(40, 40, W - 80, H - 80, 40); x.stroke();
  x.save(); x.translate(W / 2, 330); x.scale(.42, .42); for (let k = 0; k < 12; k++) { x.save(); x.rotate(k * Math.PI / 6); const L = k ? 118 : 150; x.fillStyle = k ? '#f2f2ee' : '#3ef08a'; x.beginPath(); x.roundRect(-26, -330 - (L - 118), 52, L, 9); x.fill(); x.restore(); } x.restore();
  x.textAlign = 'center'; x.fillStyle = '#f2f2ee'; x.font = '700 150px ID, Inter, sans-serif'; x.fillText('I SWEAR', W / 2, 720);
  x.font = '500 50px JB, monospace'; x.fillStyle = '#cfcfca'; x.fillText(`to hold ${V.pct}% of my ${s}`, W / 2, 830); x.fillText(`for ${V.days} days.`, W / 2, 900);
  x.fillStyle = '#8b8b86'; x.font = '400 38px JB, monospace'; x.fillText('if i break it, the wall remembers.', W / 2, 1010);
  x.fillStyle = '#3ef08a'; x.font = '500 40px JB, monospace'; x.fillText(WALLET ? short(WALLET) : 'your wallet', W / 2, 1200); x.fillStyle = '#55554f'; x.font = '400 32px JB, monospace'; x.fillText(new Date().toISOString().slice(0, 10) + ' · signed on solana', W / 2, 1256);
  x.fillStyle = '#f2f2ee'; x.font = '700 44px ID, Inter, sans-serif'; x.fillText('cults', W / 2, 1380);
  const text = `i swore to hold ${V.pct}% of my ${s} for ${V.days} days.\nif i sell, my wallet goes on the wall.\n\nevery coin is a cult.`; $('#vowShare').href = 'https://x.com/intent/tweet?text=' + encodeURIComponent(text + '\n' + location.origin); }
$('#vowSave').onclick = () => { const a = document.createElement('a'); a.download = 'my-vow.png'; a.href = $('#vowCard').toDataURL('image/png'); a.click(); };
$('#vowSign').onclick = async () => { const note = $('#vowNote'), btn = $('#vowSign'); if (!WALLET && !(await connect())) return; if (!V.mint) return toast('pick a coin');
  btn.disabled = true; note.className = 'note'; note.textContent = 'preparing the vow…';
  try { const v = await api('vow', {}, { from: WALLET, mint: V.mint, pct: V.pct, days: V.days }); note.textContent = `sign in your wallet: ${big(v.ui)} for ${v.days} days`; const sig = await signSend(v.tx);
    note.className = 'note ok'; note.innerHTML = `sworn. <a href="https://solscan.io/tx/${esc(sig)}" target="_blank" rel="noopener" style="text-decoration:underline">see it on-chain</a>`; toast('your vow is on-chain'); card();
    setTimeout(() => { loadLog(1); loadBoard(1); mine(1); }, 6000); }
  catch (e) { note.className = 'note err'; note.textContent = /reject|cancel|denied/i.test(e.message) ? 'you did not sign. nothing happened.' : e.message; } finally { btn.disabled = false; } };
async function mine(fresh) { if (!WALLET) return; try { const j = await api('me', { w: WALLET, ...(fresh ? { fresh: 1 } : {}) }); if (!j.cults.length) return; $('#mine').hidden = false;
  $('#mineList').innerHTML = '<div class="table">' + j.cults.map(c => `<div class="mem" data-cult="${esc(c.mint)}" style="cursor:pointer"><span>${c.place ? '#' + c.place : '—'}</span><span class="nm">${c.coin && c.coin.symbol ? '$' + esc(c.coin.symbol) : short(c.mint)}</span><span><span class="rk ${c.circle || c.rank}">${c.circle === 'prophet' ? 'the prophet' : c.circle === 'twelve' ? 'the twelve' : c.rank}</span></span><span>${nf(c.days, 1)}d</span><span>${nf(c.faith, 3)} faith</span><span>${c.vows.length} vow${c.vows.length > 1 ? 's' : ''}</span></div>`).join('') + '</div>'; } catch { } }
card();

// ---------------------------------------------------------------- blessing
let blessing = null;
$('#blessGo').onclick = async () => { const m = $('#blessMint').value.trim(), sol = +$('#blessSol').value, out = $('#blessOut'), btn = $('#blessGo'); if (!isMint(m)) return toast('paste the cult\'s coin address'); if (!WALLET && !(await connect())) return;
  btn.disabled = true; btn.textContent = 'reading the faithful…';
  try { const b = blessing = await api('bless', {}, { from: WALLET, mint: m, sol }), mx = b.list.length ? b.list[0].sol : 1;
    out.innerHTML = `<h3>${nf(b.sol, 4)} SOL to ${b.recipients} faithful</h3><p class="dim" style="font-size:12px;margin-top:6px">${b.txs.length} transaction${b.txs.length > 1 ? 's' : ''} to sign${b.left ? ` · ${b.left} with slices under ${CONFIG.minSol || 0.001} SOL left out` : ''}</p>
      <div class="split">${b.list.map((r, i) => `<div><span class="dim">${i + 1}</span><span><i style="width:${Math.max(2, r.sol / mx * 100)}%"></i><small class="dim">${short(r.w)}</small></span><span>${nf(r.sol, 4)}</span></div>`).join('')}</div>
      <button class="btn wide" id="blessSign">sign ${b.txs.length} transaction${b.txs.length > 1 ? 's' : ''}</button><p class="note" id="blessProg"></p>`;
    $('#blessSign').onclick = signBlessing; }
  catch (e) { out.innerHTML = `<p class="note err">${esc(e.message)}</p>`; } finally { btn.disabled = false; btn.textContent = 'prepare the blessing'; } };
async function signBlessing() { const b = blessing, pr = $('#blessProg'), btn = $('#blessSign'); btn.disabled = true; const sigs = [];
  try { for (let i = 0; i < b.txs.length; i++) { pr.className = 'note'; pr.textContent = `sign ${i + 1} of ${b.txs.length} in your wallet…`; sigs.push(await signSend(b.txs[i])); }
    pr.className = 'note ok'; pr.innerHTML = 'blessed. ' + sigs.map((s, i) => `<a href="https://solscan.io/tx/${esc(s)}" target="_blank" rel="noopener" style="text-decoration:underline">batch ${i + 1}</a>`).join(' · '); toast('the faithful are blessed'); setTimeout(() => { loadLog(1); loadBoard(1); }, 6000); }
  catch (e) { pr.className = 'note err'; pr.textContent = (sigs.length ? `${sigs.length} of ${b.txs.length} sent. ` : '') + (/reject|cancel|denied/i.test(e.message) ? 'you stopped signing.' : e.message) + (sigs.length ? ' prepare again to bless the rest.' : ''); btn.disabled = false; } }

// ---------------------------------------------------------------- a cult's own page
const cultEl = $('#cult');
function route() { const m = /^#\/c\/([1-9A-HJ-NP-Za-km-z]{32,44})$/.exec(location.hash); if (m) showCult(m[1]); else hideCult(); }
addEventListener('hashchange', route);
function openCult(m) { if (location.hash !== '#/c/' + m) location.hash = '/c/' + m; else showCult(m); }
$('#cultClose').onclick = () => { history.pushState('', '', location.pathname + location.search); hideCult(); };
cultEl.addEventListener('click', e => { if (e.target === cultEl) $('#cultClose').click(); });
addEventListener('keydown', e => { if (e.key === 'Escape' && !cultEl.hidden) $('#cultClose').click(); });
function hideCult() { if (cultEl.hidden) return; cultEl.classList.remove('on'); if (lenis) lenis.start(); setTimeout(() => cultEl.hidden = true, 350); document.documentElement.style.overflow = ''; }
async function showCult(m) { cultEl.hidden = false; requestAnimationFrame(() => cultEl.classList.add('on')); if (lenis) lenis.stop(); document.documentElement.style.overflow = 'hidden'; const B = $('#cultBody');
  B.innerHTML = `<div class="empty"><svg class="ring spin" viewBox="0 0 1000 1000">${Array.from({ length: 12 }, (_, k) => BAR(k)).join('')}</svg><span>reading the cult from the chain…</span></div>`; $$('#cultBody .spin rect').forEach((r, k) => r.style.animationDelay = (k * .1 - 1.2) + 's');
  try { const c = await api('cult', { mint: m }); renderCult(c); } catch (e) { B.innerHTML = `<div class="empty">${esc(e.message)}</div>`; } }
function renderCult(c) { const B = $('#cultBody'), name = c.coin && c.coin.symbol ? '$' + c.coin.symbol : short(c.mint), circle = c.list.filter(x => x.circle);
  const slot = k => { const m = circle[k], L = k ? 118 : 150; return `<g class="slot${m ? ' full' : ''}${k === 0 && m ? ' prophet' : ''}" transform="rotate(${k * 30} 500 500)"${m ? ` data-w="${esc(m.w)}"` : ''}><rect x="474" y="${500 - 330 - (L - 118)}" width="52" height="${L}" rx="9"/><title>${m ? short(m.w) + ' · ' + nf(m.faith, 3) + ' faith' : 'empty seat'}</title></g>`; };
  const lbl = k => { const m = circle[k]; if (!m) return ''; const a = (k * 30 - 90) * Math.PI / 180, r = 425 + (k ? 0 : 30); return `<text x="${500 + Math.cos(a) * r}" y="${500 + Math.sin(a) * r + 8}" text-anchor="middle"${k ? '' : ' style="fill:#3ef08a"'}>${short(m.w)}</text>`; };
  B.innerHTML = `<div class="c-head">${icon(c.coin, '')}<h2>${esc(name)}</h2>${c.coin && c.coin.name ? `<p class="dim">${esc(c.coin.name)}</p>` : ''}<span class="mint" data-copy="${esc(c.mint)}">${esc(c.mint)}</span></div>
    <div class="circle"><svg viewBox="0 0 1000 1000">${Array.from({ length: 12 }, (_, k) => slot(k)).join('')}${Array.from({ length: 12 }, (_, k) => lbl(k)).join('')}</svg><div class="mid"><b>${nf(c.believers, 0)}</b><span>believers</span></div></div>
    <p class="dim" style="font-size:12px">${c.prophet ? `the prophet: <span class="g">${short(c.prophet)}</span> · ${circle.length}/12 seats in the circle` : `${c.coin && c.coin.holders ? big(c.coin.holders) + ' holders. ' : ''}nobody has sworn yet. the first vow takes the prophet's seat.`}</p>
    <div class="stats">${[[c.coin && c.coin.holders != null ? big(c.coin.holders) : '—', 'holders'], [pct(c.sworn), 'supply sworn'], [nf(c.faith, 2), 'faith'], [nf(c.kept, 0), 'vows kept'], [nf(c.apostates, 0), 'apostates'], [nf(c.vows, 0), 'vows'], [nf(c.blessed, 3) + ' SOL', 'blessed'], [c.first ? ago(c.first) : '—', 'first vow']].map(([v, k]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('')}</div>
    <div class="row center"><button class="btn" data-act="vow">take a vow in ${esc(name)}</button><button class="btn ghost" data-act="bless">bless ${esc(name)}</button><button class="btn ghost" data-act="census">count holders</button></div>
    <div class="c-tabs"><button class="on" data-tab="members">members</button><button data-tab="vows">vows</button><button data-tab="blessings">blessings</button></div><div id="cTab"></div>`;
  const tabs = { members: () => c.list.length ? '<div class="mem th"><span>#</span><span>wallet</span><span>rank</span><span>days</span><span>faith</span><span>blessed</span></div>' + c.list.map(m => `<div class="mem"><span class="dim">${m.place || '—'}</span><span>${short(m.w)}</span><span><span class="rk ${m.circle || m.rank}">${m.circle === 'prophet' ? 'the prophet' : m.circle === 'twelve' ? 'the twelve' : m.rank}</span></span><span>${nf(m.days, 1)}</span><span>${nf(m.faith, 3)}</span><span>${nf(m.blessed, 4)}</span></div>`).join('') : `<div class="empty">${ringEmpty}<span>this cult has no vows yet. the first one makes you its prophet.</span></div>`,
    vows: () => c.vowList.length ? '<div class="mem th"><span></span><span>wallet</span><span>swore</span><span>for</span><span>state</span><span>when</span></div>' + c.vowList.map(v => `<div class="mem"><span></span><span><a href="https://solscan.io/tx/${esc(v.sig)}" target="_blank" rel="noopener">${short(v.w)}</a></span><span>${big(v.ui)}</span><span>${v.days}d</span><span class="st-${v.state}">${v.state === 'broken' ? (v.day ? 'broke day ' + v.day : 'broken') : v.state === 'keeping' ? 'day ' + Math.floor(v.kept + 1) : v.state}</span><span class="dim">${ago(v.at)}</span></div>`).join('') : '<div class="empty">no vows yet.</div>',
    blessings: () => c.blessList.length ? '<div class="mem th"><span></span><span>from</span><span>SOL</span><span>to</span><span>batch</span><span>when</span></div>' + c.blessList.map(b => `<div class="mem"><span></span><span><a href="https://solscan.io/tx/${esc(b.sig)}" target="_blank" rel="noopener">${short(b.w)}</a></span><span>${nf(b.sol, 4)}</span><span>${b.to}</span><span>${esc(b.part)}</span><span class="dim">${ago(b.at)}</span></div>`).join('') : '<div class="empty">no blessings yet.</div>' };
  const show = t => { $$('.c-tabs button', B).forEach(b => b.classList.toggle('on', b.dataset.tab === t)); $('#cTab').innerHTML = tabs[t](); }; show('members');
  B.onclick = e => { const t = e.target.closest('[data-tab]'); if (t) show(t.dataset.tab); const cp = e.target.closest('[data-copy]'); if (cp) copy(cp.dataset.copy, 'coin address copied'); const s = e.target.closest('.slot[data-w]'); if (s) copy(s.dataset.w, 'wallet copied');
    const a = e.target.closest('[data-act]'); if (!a) return; $('#cultClose').click(); setTimeout(() => { if (a.dataset.act === 'vow') { V.coin = c.coin ? { ...c.coin, mint: c.mint } : null; pickCoin(c.mint); go('vow'); } if (a.dataset.act === 'bless') { $('#blessMint').value = c.mint; go('bless'); } if (a.dataset.act === 'census') { $('#censusMint').value = c.mint; go('census'); runCensus(); } }, 380); };
  if (window.gsap) gsap.from($$('.circle .slot', B), { opacity: 0, scale: .5, svgOrigin: '500 500', stagger: .05, duration: .8, ease: 'expo.out' }); }
})();
