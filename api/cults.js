// CULTS engine. every coin is a cult.
// A vow is a memo transaction the believer signs in their own wallet: "cults:vow:1:<mint>:<amount>:<days>", plus a 0-lamport touch of the
// TAG address so every rite can be found with one getSignaturesForAddress. Nothing is locked and nothing is held: the chain is the only
// database. A vow is kept while the wallet never holds less than it swore, read from the token account's own history.
// Blessings are SOL sent by anyone (usually the dev, from creator fees) to a cult's faithful, weighted by faith, signed in their wallet.
const { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction, ComputeBudgetProgram, VersionedTransaction, Keypair } = require('@solana/web3.js');
const CFG = require('./cults-config.json');

const RPCS = [process.env.RPC_URL, 'https://api.mainnet-beta.solana.com', 'https://solana-rpc.publicnode.com'].filter(Boolean);
async function rpcFetch(url, opts) { let last = null; for (let round = 0; round < 2; round++) { for (const u of RPCS) { try { const r = await fetch(u, { ...opts, signal: AbortSignal.timeout(20000) }); if (r.status === 429 || r.status === 401 || r.status === 403 || r.status >= 500) { last = r; continue; } return r; } catch (e) { last = e; } } await new Promise(r => setTimeout(r, 600)); } if (last instanceof Error) throw last; return last; }
const conn = new Connection(RPCS[0], { commitment: 'confirmed', fetch: rpcFetch, disableRetryOnRateLimit: true });

const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', T22 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const ATA = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'), MEMO = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const SOL = 'So11111111111111111111111111111111111111112', JUP = 'https://lite-api.jup.ag', DAY = 86400;
const TAG = new PublicKey(process.env.CULTS_TAG || CFG.tag), TAG58 = TAG.toBase58();
const RANKS = CFG.ranks, MIN_LAMPORTS = Math.round(CFG.minSol * 1e9);

const out = (res, code, b, cache) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.setHeader('access-control-allow-origin', '*'); res.setHeader('cache-control', cache || 'no-store'); res.end(JSON.stringify(b)); };
const body = req => new Promise(ok => { if (req.body) return ok(typeof req.body === 'string' ? JSON.parse(req.body) : req.body); let d = ''; req.on('data', c => d += c); req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch { ok({}); } }); });
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, n);
const okKey = s => { try { return s ? new PublicKey(String(s).trim()).toBase58() : null; } catch { return null; } };
const pk = (s, what) => { try { return new PublicKey(String(s || '').trim()); } catch { throw new Error(what || 'that is not a Solana address'); } };
const k58 = k => (k && k.toBase58) ? k.toBase58() : String(k);
const nowS = () => Math.floor(Date.now() / 1000);
async function getJ(url, ms = 8000) { const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { accept: 'application/json' } }); if (!r.ok) throw new Error(r.status + ' ' + url.split('/')[2]); return r.json(); }
const cache = new Map();
async function memo(key, ttl, fn) { const c = cache.get(key); if (c && c.v !== undefined && Date.now() - c.t < ttl) return c.v; if (c && c.p) return c.p; const p = fn().then(v => { cache.set(key, { t: Date.now(), v }); return v; }, e => { if (c && c.v !== undefined) cache.set(key, { t: c.t, v: c.v }); else cache.delete(key); throw e; }); cache.set(key, { ...(c || { t: 0 }), p }); return p; }
async function pool(items, n, fn) { const res = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; res[k] = await fn(items[k], k); } })); return res; }

// ---------------------------------------------------------------- coins
async function jupInfo(mints) { const o = {}, L = [...new Set(mints)].filter(Boolean);
  for (let i = 0; i < L.length; i += 90) { try { const j = await memo('jup:' + L.slice(i, i + 90).join(','), 60000, () => getJ(`${JUP}/tokens/v2/search?query=${L.slice(i, i + 90).join(',')}`));
    for (const t of j || []) { const s = t.stats24h || {}; o[t.id] = { symbol: t.symbol, name: t.name, icon: t.icon || null, decimals: t.decimals, usd: t.usdPrice ?? null, ch24: s.priceChange ?? null, mcap: t.mcap ?? t.fdv ?? null, holders: t.holderCount ?? null, launchpad: t.launchpad || null }; } } catch { } }
  return o; }
async function mintInfo(mint) { return memo('mint:' + mint, 3600e3, async () => { const a = await conn.getAccountInfo(new PublicKey(mint)); if (!a) throw new Error('that mint does not exist'); const owner = a.owner.toBase58(); if (owner !== TOKEN && owner !== T22) throw new Error('that is not a token mint'); const d = a.data;
  return { program: owner, decimals: d[44], supply: d.readBigUInt64LE(36).toString() }; }); }
const ui = (raw, dec) => Number(BigInt(raw)) / 10 ** dec;
const ataOf = (owner, mint, prog) => PublicKey.findProgramAddressSync([owner.toBuffer(), new PublicKey(prog).toBuffer(), mint.toBuffer()], ATA)[0];

// every wallet holding a mint, read straight from the token program; pools and bonding curves (owners off the curve) are left out
async function holdersOf(mint) { const mi = await mintInfo(mint), filters = [{ memcmp: { offset: 0, bytes: mint } }]; if (mi.program === TOKEN) filters.push({ dataSize: 165 });
  const accs = await conn.getProgramAccounts(new PublicKey(mi.program), { filters, dataSlice: { offset: 32, length: 40 }, encoding: 'base64' }), map = new Map(); let off = 0;
  for (const a of accs) { const d = a.account.data, b = Buffer.isBuffer(d) ? d : Array.isArray(d) ? Buffer.from(d[0], 'base64') : Buffer.from(d); if (b.length < 40) continue; const amt = b.readBigUInt64LE(32); if (amt === 0n) continue; const ob = b.subarray(0, 32);
    if (!PublicKey.isOnCurve(ob)) { off++; continue; } const o = new PublicKey(ob).toBase58(); map.set(o, (map.get(o) || 0n) + amt); }
  return { ...mi, map, accounts: accs.length, offCurve: off }; }

// the census: who is in the congregation of any coin
async function census(m) { const mint = pk(m, 'that is not a mint address').toBase58(); return memo('census:' + mint, 60000, async () => { const t0 = Date.now(), h = await holdersOf(mint), sup = Number(h.supply) || 1;
  const L = [...h.map].map(([w, b]) => [w, Number(b) / sup]).sort((a, b) => b[1] - a[1]), info = (await jupInfo([mint]))[mint] || {};
  const sum = n => L.slice(0, n).reduce((s, x) => s + x[1], 0), tiers = { whale: 0, dolphin: 0, fish: 0, shrimp: 0 };
  for (const [, s] of L) tiers[s >= 0.01 ? 'whale' : s >= 0.001 ? 'dolphin' : s >= 0.0001 ? 'fish' : 'shrimp']++;
  return { mint, program: h.program === T22 ? 'token-2022' : 'token', decimals: h.decimals, supply: h.supply, accounts: h.accounts, offCurve: h.offCurve, holders: L.length, ms: Date.now() - t0, at: Date.now(),
    top1: sum(1), top10: sum(10), top12: sum(12), tiers, coin: { symbol: info.symbol || null, name: info.name || null, icon: info.icon || null, holders: info.holders ?? null, mcap: info.mcap ?? null, usd: info.usd ?? null, ch24: info.ch24 ?? null },
    ring: L.slice(0, 360).map(([w, s]) => [w, +s.toPrecision(4)]) }; }); }

// ---------------------------------------------------------------- the rites: every vow and blessing ever made, read from the chain
const TX = new Map();   // signature -> parsed transaction (immutable, so kept for the life of the instance)
async function txs(sigs) { const need = [...new Set(sigs)].filter(s => !TX.has(s));
  for (let i = 0; i < need.length; i += 10) { const part = need.slice(i, i + 10), got = await conn.getParsedTransactions(part, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' }); got.forEach((t, k) => { if (t) TX.set(part[k], t); }); if (i + 10 < need.length) await new Promise(r => setTimeout(r, 120)); }
  return sigs.map(s => TX.get(s) || null); }
const memoIx = (text, signer) => new TransactionInstruction({ programId: MEMO, keys: [{ pubkey: signer, isSigner: true, isWritable: false }], data: Buffer.from(text) });
const tagIx = from => SystemProgram.transfer({ fromPubkey: from, toPubkey: TAG, lamports: 0 });
const fits = t => { try { return t.serialize({ requireAllSignatures: false, verifySignatures: false }).length <= 1232; } catch { return false; } };

function parseRite(t, s) { if (!t || (t.meta && t.meta.err)) return null; const msg = t.transaction.message, by = k58(msg.accountKeys[0].pubkey), at = t.blockTime || s.blockTime || 0;
  const m = msg.instructions.find(ix => ix.program === 'spl-memo' && typeof ix.parsed === 'string' && ix.parsed.startsWith('cults:')); if (!m) return null; const p = m.parsed.split(':');
  if (p[1] === 'vow' && p[2] === '1') { const mint = okKey(p[3]), amount = /^[1-9]\d{0,19}$/.test(p[4] || '') ? p[4] : null, days = +p[5];
    if (!mint || !amount || !Number.isInteger(days) || days < 1 || days > 365 || mint === SOL) return null; return { kind: 'vow', sig: s.signature, at, w: by, mint, amount, days, ends: at + days * DAY }; }
  if (p[1] === 'bless' && p[2] === '1') { const mint = okKey(p[3]); if (!mint) return null; const to = [];
    for (const ix of msg.instructions) { const P = ix.parsed; if (ix.program === 'system' && P && P.type === 'transfer' && P.info.source === by && P.info.destination !== TAG58 && P.info.lamports > 0) to.push([P.info.destination, P.info.lamports]); }
    return { kind: 'bless', sig: s.signature, at, w: by, mint, id: clean(p[4], 16), part: clean(p[5], 9), to, lamports: to.reduce((a, x) => a + x[1], 0) }; }
  return null; }
const IDX = { rows: new Map(), newest: null };
const rites = fresh => memo('rites', fresh ? 0 : 15000, async () => { let before, got = [];
  for (let page = 0; page < 8; page++) { const L = await conn.getSignaturesForAddress(TAG, { limit: 1000, before, until: IDX.newest || undefined }); got.push(...L); if (L.length < 1000) break; before = L[L.length - 1].signature; }
  const ok = got.filter(s => !s.err);
  if (ok.length) { const T = await txs(ok.map(s => s.signature)); let all = true; T.forEach((t, k) => { if (!t) { all = false; return; } const r = parseRite(t, ok[k]); if (r) IDX.rows.set(r.sig, r); }); if (all) IDX.newest = got[0].signature; }
  return [...IDX.rows.values()].sort((a, b) => b.at - a.at); });

// ---------------------------------------------------------------- judgement: did the wallet ever hold less than it swore?
// every move of the wallet's token accounts for this coin since its first vow, with the balance before and after (other accounts added at today's balance)
async function standing(w, mint, since) { return memo(`st:${w}:${mint}:${since}`, 45000, async () => { const owner = new PublicKey(w), M = new PublicKey(mint), mi = await mintInfo(mint);
  const accs = (await conn.getParsedTokenAccountsByOwner(owner, { mint: M })).value.map(a => ({ key: a.pubkey.toBase58(), bal: BigInt(a.account.data.parsed.info.tokenAmount.amount) }));
  const ata = ataOf(owner, M, mi.program).toBase58(); if (!accs.some(a => a.key === ata)) accs.push({ key: ata, bal: 0n, closed: true });   // a closed account still has its history
  const now = accs.reduce((s, a) => s + a.bal, 0n), moves = []; let partial = false;
  for (const a of accs.slice(0, 4)) { const others = now - a.bal; let before, sigs = [];
    for (let pg = 0; pg < 4; pg++) { const L = await conn.getSignaturesForAddress(new PublicKey(a.key), { limit: 250, before }); const keep = L.filter(s => (s.blockTime || 0) >= since); sigs.push(...keep.filter(s => !s.err)); if (L.length < 250 || keep.length < L.length) break; before = L[L.length - 1].signature; if (pg === 3) partial = true; }
    const T = await txs(sigs.map(s => s.signature));
    T.forEach((t, k) => { if (!t || !t.meta) return; const keys = t.transaction.message.accountKeys.map(x => k58(x.pubkey)), idx = keys.indexOf(a.key); if (idx < 0) return;
      const pre = (t.meta.preTokenBalances || []).find(b => b.accountIndex === idx), post = (t.meta.postTokenBalances || []).find(b => b.accountIndex === idx); if (!pre && !post) return;
      const v = b => b ? BigInt(b.uiTokenAmount.amount) : 0n; moves.push({ at: t.blockTime || sigs[k].blockTime || 0, sig: sigs[k].signature, pre: v(pre) + others, bal: v(post) + others }); }); }
  moves.sort((a, b) => a.at - b.at); return { now: now.toString(), moves, partial }; }); }
function verdict(v, st, t) { const amt = BigInt(v.amount), end = v.ends;
  const dip = st.moves.find(m => m.at >= v.at && m.at < end && m.bal < amt);
  if (dip) return { state: 'broken', brokeAt: dip.at, brokeSig: dip.sig, day: Math.floor((dip.at - v.at) / DAY) + 1 };
  const first = st.moves.find(m => m.at >= v.at), atVow = first ? first.pre : BigInt(st.now);
  if (atVow < amt) return { state: 'broken', brokeAt: v.at, brokeSig: v.sig, day: 1, never: true };   // swore more than it held
  if (st.partial && t < end && BigInt(st.now) < amt) return { state: 'broken', brokeAt: null, day: null };
  if (t >= end) return { state: 'kept', kept: v.days };
  return { state: 'keeping', kept: (t - v.at) / DAY }; }
const rankOf = d => { let r = RANKS[0].id; for (const x of RANKS) if (d >= x.days) r = x.id; return r; };
const judged = fresh => memo('judged', fresh ? 0 : 20000, async () => { const rows = await rites(fresh), vows = rows.filter(r => r.kind === 'vow').map(v => ({ ...v })), t = nowS(), groups = new Map();
  for (const v of vows) { const k = v.w + ':' + v.mint; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(v); }
  await pool([...groups.values()], 6, async g => { let st = null; try { st = await standing(g[0].w, g[0].mint, Math.min(...g.map(v => v.at))); } catch { } for (const v of g) v.verdict = st ? verdict(v, st, t) : { state: 'unknown' }; });
  const mints = [...new Set(vows.map(v => v.mint))], sup = {}; await pool(mints, 6, async m => { try { sup[m] = await mintInfo(m); } catch { sup[m] = null; } });
  return { rows, vows: vows.filter(v => sup[v.mint]), mints: mints.filter(m => sup[m]), sup, t }; });

// a cult: its members, ranks, the twelve, its prophet, its blessings and apostates
function cultOf(mint, J) { const mi = J.sup[mint], sup = Number(mi.supply) || 1, V = J.vows.filter(v => v.mint === mint), B = J.rows.filter(r => r.kind === 'bless' && r.mint === mint), by = new Map();
  for (const v of V) { if (!by.has(v.w)) by.set(v.w, []); by.get(v.w).push(v); }
  const recv = new Map(); for (const b of B) for (const [to, l] of b.to) recv.set(to, (recv.get(to) || 0) + l);
  const members = []; let swornAll = 0n;
  for (const [w, L] of by) { const apostate = L.some(v => v.verdict.state === 'broken'); let faith = 0, best = 0, sworn = 0n, active = false;
    if (!apostate) for (const v of L) { const kept = v.verdict.state === 'kept' ? v.days : v.verdict.state === 'keeping' ? v.verdict.kept : 0; faith += Number(BigInt(v.amount)) / sup * 100 * kept; best = Math.max(best, kept); if (v.verdict.state === 'keeping') { active = true; sworn += BigInt(v.amount); } }
    swornAll += sworn; members.push({ w, rank: apostate ? 'apostate' : rankOf(best), faith: +faith.toPrecision(6), days: +best.toFixed(3), sworn: sworn.toString(), swornUi: ui(sworn, mi.decimals), active, vows: L.length, since: Math.min(...L.map(v => v.at)), blessed: (recv.get(w) || 0) / 1e9 }); }
  const faithful = members.filter(m => m.rank !== 'apostate').sort((a, b) => b.faith - a.faith || a.since - b.since);
  faithful.forEach((m, i) => { m.place = i + 1; if (i < 12 && m.faith > 0) m.circle = i === 0 ? 'prophet' : 'twelve'; });
  const apostates = members.filter(m => m.rank === 'apostate');
  return { mint, decimals: mi.decimals, supply: mi.supply, believers: faithful.filter(m => m.active).length, members: members.length, faithful: faithful.length, apostates: apostates.length,
    sworn: Number(swornAll) / sup, faith: +faithful.reduce((s, m) => s + m.faith, 0).toPrecision(6), kept: V.filter(v => v.verdict.state === 'kept').length, vows: V.length,
    blessed: B.reduce((s, b) => s + b.lamports, 0) / 1e9, blessings: B.length, prophet: faithful[0] && faithful[0].faith > 0 ? faithful[0].w : null, first: V.length ? Math.min(...V.map(v => v.at)) : null, last: V.length ? Math.max(...V.map(v => v.at)) : null,
    list: [...faithful, ...apostates.sort((a, b) => b.since - a.since)],
    vowList: V.slice().sort((a, b) => b.at - a.at).map(v => ({ sig: v.sig, at: v.at, w: v.w, amount: v.amount, ui: ui(v.amount, mi.decimals), share: Number(BigInt(v.amount)) / sup, days: v.days, ends: v.ends, ...v.verdict })),
    blessList: B.map(b => ({ sig: b.sig, at: b.at, w: b.w, sol: b.lamports / 1e9, to: b.to.length, part: b.part, id: b.id })) }; }
const coinsOf = async mints => { const info = await jupInfo(mints), o = {}; for (const m of mints) { const i = info[m] || {}; o[m] = { symbol: i.symbol || null, name: i.name || null, icon: i.icon || null, mcap: i.mcap ?? null }; } return o; };

async function cult(m, fresh) { const mint = pk(m, 'that is not a mint address').toBase58(), J = await judged(fresh); const coin = (await coinsOf([mint]))[mint];
  if (!J.sup[mint]) { const mi = await mintInfo(mint); return { mint, coin, decimals: mi.decimals, supply: mi.supply, believers: 0, members: 0, faithful: 0, apostates: 0, sworn: 0, faith: 0, kept: 0, vows: 0, blessed: 0, blessings: 0, prophet: null, first: null, last: null, list: [], vowList: [], blessList: [], at: Date.now() }; }
  return { ...cultOf(mint, J), coin, at: Date.now() }; }
async function board(fresh) { const J = await judged(fresh), L = J.mints.map(m => { const c = cultOf(m, J); delete c.list; delete c.vowList; delete c.blessList; return c; }), coins = await coinsOf(J.mints);
  L.forEach(c => c.coin = coins[c.mint]); L.sort((a, b) => b.faith - a.faith || b.believers - a.believers);
  return { at: Date.now(), cults: L, totals: { cults: L.length, vows: J.vows.length, believers: L.reduce((s, c) => s + c.believers, 0), apostates: L.reduce((s, c) => s + c.apostates, 0), blessed: +L.reduce((s, c) => s + c.blessed, 0).toFixed(6), kept: L.reduce((s, c) => s + c.kept, 0) } }; }
async function wall(fresh) { const J = await judged(fresh), B = J.vows.filter(v => v.verdict.state === 'broken'), coins = await coinsOf([...new Set(B.map(v => v.mint))]);
  return { at: Date.now(), list: B.sort((a, b) => (b.verdict.brokeAt || b.at) - (a.verdict.brokeAt || a.at)).map(v => ({ w: v.w, mint: v.mint, coin: coins[v.mint], sig: v.sig, at: v.at, days: v.days, ui: ui(v.amount, J.sup[v.mint].decimals), share: Number(BigInt(v.amount)) / Number(J.sup[v.mint].supply), ...v.verdict })) }; }
// the log of rites, newest first: vows taken, vows broken, vows kept, blessings
async function log(fresh) { const J = await judged(fresh), ev = [];
  for (const v of J.vows) { const d = J.sup[v.mint].decimals; ev.push({ kind: 'vow', at: v.at, w: v.w, mint: v.mint, ui: ui(v.amount, d), days: v.days, sig: v.sig });
    if (v.verdict.state === 'broken' && v.verdict.brokeAt) ev.push({ kind: 'broke', at: v.verdict.brokeAt, w: v.w, mint: v.mint, day: v.verdict.day, days: v.days, sig: v.verdict.brokeSig || v.sig });
    if (v.verdict.state === 'kept') ev.push({ kind: 'kept', at: v.ends, w: v.w, mint: v.mint, days: v.days, sig: v.sig }); }
  for (const b of J.rows.filter(r => r.kind === 'bless')) ev.push({ kind: 'bless', at: b.at, w: b.w, mint: b.mint, sol: b.lamports / 1e9, to: b.to.length, sig: b.sig });
  ev.sort((a, b) => b.at - a.at); const L = ev.filter(e => e.at <= J.t + 60).slice(0, 80), coins = await coinsOf([...new Set(L.map(e => e.mint))]); L.forEach(e => e.coin = coins[e.mint] ? coins[e.mint].symbol : null);
  return { at: Date.now(), list: L }; }
// one wallet: its vows in every cult and its rank in each
async function me(w, fresh) { w = pk(w).toBase58(); const J = await judged(fresh), mints = [...new Set(J.vows.filter(v => v.w === w).map(v => v.mint))], coins = await coinsOf(mints);
  return { w, at: Date.now(), cults: mints.map(m => { const c = cultOf(m, J), mine = c.list.find(x => x.w === w); return { mint: m, coin: coins[m], ...mine, vows: c.vowList.filter(v => v.w === w), size: c.faithful }; }) }; }
async function holdings(w) { const owner = pk(w), o = [];
  for (const prog of [TOKEN, T22]) { const L = await conn.getParsedTokenAccountsByOwner(owner, { programId: new PublicKey(prog) }); for (const a of L.value) { const i = a.account.data.parsed.info; if (+i.tokenAmount.amount > 0 && i.mint !== SOL) o.push({ mint: i.mint, amount: i.tokenAmount.amount, ui: +i.tokenAmount.uiAmountString, decimals: i.tokenAmount.decimals }); } }
  const info = await jupInfo(o.map(x => x.mint)); o.forEach(x => { const j = info[x.mint] || {}; x.symbol = j.symbol || null; x.name = j.name || null; x.icon = j.icon || null; x.usd = j.usd != null ? j.usd * x.ui : null; });
  return o.sort((a, b) => (b.usd || 0) - (a.usd || 0) || b.ui - a.ui).slice(0, 60); }
const trending = () => memo('trend', 300e3, async () => { const j = await getJ(`${JUP}/tokens/v2/toptrending/1h?limit=80`).catch(() => []);
  return (j || []).filter(t => /pump/i.test(t.launchpad || '') && t.holderCount >= 100).slice(0, 8).map(t => ({ mint: t.id, symbol: t.symbol, icon: t.icon || null, holders: t.holderCount })); });
const ping = () => memo('ping', 4000, async () => { const t0 = Date.now(), slot = await conn.getSlot('confirmed'); return { slot, ms: Date.now() - t0, rpc: process.env.RPC_URL ? 'custom' : 'public', tag: TAG58, at: Date.now() }; });

// ---------------------------------------------------------------- the transactions the believer and the blesser sign in their own wallets
const CU = { vow: 40000, bless: 60000 }, PRICE = 20000;
async function vowTx(b, bh) { const from = pk(b.from, 'connect a wallet first'), mint = pk(b.mint, 'that is not a mint address'), days = +b.days, M = mint.toBase58();
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error('a vow lasts 1 to 365 days'); if (M === SOL) throw new Error('SOL is not a cult'); const mi = await mintInfo(M);
  const have = (await conn.getParsedTokenAccountsByOwner(from, { mint })).value.reduce((s, a) => s + BigInt(a.account.data.parsed.info.tokenAmount.amount), 0n);
  let amount = /^[1-9]\d{0,19}$/.test(String(b.amount || '')) ? BigInt(b.amount) : null; if (b.pct != null) { const p = Math.max(0, Math.min(100, +b.pct)); amount = have * BigInt(Math.round(p * 100)) / 10000n; }
  if (!have) throw new Error('this wallet holds none of that coin. you can only vow what you hold'); if (!amount || amount <= 0n) throw new Error('vow at least a little');
  if (amount > have) throw new Error(`this wallet holds ${ui(have, mi.decimals).toLocaleString('en-US')}. you can only vow what you hold`);
  const text = `cults:vow:1:${M}:${amount}:${days}`, t = new Transaction({ feePayer: from, recentBlockhash: bh || (await conn.getLatestBlockhash('confirmed')).blockhash });
  t.add(ComputeBudgetProgram.setComputeUnitLimit({ units: CU.vow }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRICE }), memoIx(text, from), tagIx(from));
  return { t, memo: text, amount: amount.toString(), ui: ui(amount, mi.decimals), have: have.toString(), share: Number(amount) / Number(mi.supply), days }; }
async function buildVow(b) { const v = await vowTx(b); return { tx: v.t.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64'), memo: v.memo, amount: v.amount, ui: v.ui, share: v.share, days: v.days }; }
// split a blessing by faith; slices under the minimum are dropped and the rest re-split, so every transfer is worth sending
function split(lamports, list) { let L = list.filter(m => m.faith > 0).sort((a, b) => b.faith - a.faith); for (;;) { const tot = L.reduce((s, m) => s + m.faith, 0); if (!L.length) return []; const S = L.map(m => [m.w, Math.floor(lamports * m.faith / tot)]); if (S[S.length - 1][1] >= MIN_LAMPORTS) return S; L = L.slice(0, -1); } }
function blessBatches(from, mint, S, id, bh) { const B = []; let cur = [];
  const make = (part, k, n) => { const t = new Transaction({ feePayer: from, recentBlockhash: bh }); t.add(ComputeBudgetProgram.setComputeUnitLimit({ units: CU.bless }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRICE }), memoIx(`cults:bless:1:${mint}:${id}:${k}/${n}`, from)); for (const [w, l] of part) t.add(SystemProgram.transfer({ fromPubkey: from, toPubkey: new PublicKey(w), lamports: l })); t.add(tagIx(from)); return t; };
  for (const s of S) { const next = [...cur, s]; if (cur.length && (next.length > CFG.perTx || !fits(make(next, 99, 99)))) { B.push(cur); cur = [s]; } else cur = next; }
  if (cur.length) B.push(cur); return B.map((p, k) => ({ part: p, t: make(p, k + 1, B.length) })); }
async function buildBless(b) { const from = pk(b.from, 'connect a wallet first'), mint = pk(b.mint, 'that is not a mint address').toBase58(), sol = +b.sol;
  if (!(sol >= 0.01 && sol <= 5000)) throw new Error('a blessing is 0.01 to 5000 SOL'); const c = await cult(mint, true), keepers = c.list.filter(m => m.rank !== 'apostate' && m.faith > 0 && m.w !== from.toBase58());
  if (!keepers.length) throw new Error('this cult has no faithful yet. it can be blessed once someone has kept a vow for a while');
  const S = split(Math.floor(sol * 1e9), keepers); if (!S.length) throw new Error('the blessing is too small to reach anyone'); const id = Date.now().toString(36), bh = (await conn.getLatestBlockhash('confirmed')).blockhash, B = blessBatches(from, mint, S, id, bh);
  const bal = await conn.getBalance(from); const need = S.reduce((s, x) => s + x[1], 0) + B.length * 10000; if (bal < need) throw new Error(`this wallet has ${(bal / 1e9).toFixed(4)} SOL. the blessing needs ${(need / 1e9).toFixed(4)} with fees`);
  return { id, mint, sol: S.reduce((s, x) => s + x[1], 0) / 1e9, recipients: S.length, left: keepers.length - S.length, txs: B.map(x => x.t.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64')), list: S.slice(0, 40).map(([w, l]) => ({ w, sol: l / 1e9 })) }; }
// dry runs on mainnet, never signed: the exact vow a holder would sign, and a full blessing batch to brand-new wallets (the worst case)
async function sim(q) { const kind = q.kind === 'bless' ? 'bless' : 'vow', w = pk(q.w, 'add a wallet to dry-run from (w=)').toBase58(), runs = [], bh = '11111111111111111111111111111111';
  return memo(`sim:${kind}:${w}:${q.mint || ''}`, 30000, async () => { const run = async (t, what) => { const t0 = Date.now(), v = (await conn.simulateTransaction(new VersionedTransaction(t.compileMessage()), { sigVerify: false, replaceRecentBlockhash: true, commitment: 'confirmed' })).value;
      runs.push({ what, err: v.err ? JSON.stringify(v.err) : null, units: v.unitsConsumed ?? null, limit: CU[kind], ms: Date.now() - t0, bytes: t.serialize({ requireAllSignatures: false, verifySignatures: false }).length, logs: (v.logs || []).filter(l => /Memo|invoke \[1\]|success$|failed|rror|Signed/.test(l)).slice(0, 30) }); };
    if (kind === 'vow') { const v = await vowTx({ from: w, mint: q.mint, pct: 100, days: 30 }, bh); await run(v.t, v.memo); }
    else { const fresh = Array.from({ length: CFG.perTx }, () => [Keypair.generate().publicKey.toBase58(), MIN_LAMPORTS]), B = blessBatches(new PublicKey(w), q.mint ? pk(q.mint).toBase58() : SOL, fresh, 'selftest', bh); for (const x of B) await run(x.t, `bless ${x.part.length} new wallets`); }
    return { kind, w, at: Date.now(), runs }; }); }

module.exports = async (req, res) => {
  const q = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams), a = String(q.a || 'ping'), fresh = q.fresh === '1';
  try {
    if (req.method === 'GET') {
      if (a === 'ping') return out(res, 200, await ping(), 'public, max-age=3, s-maxage=4');
      if (a === 'config') return out(res, 200, { name: CFG.name, ticker: CFG.ticker, tag: TAG58, ca: okKey(process.env.CULTS_CA) || okKey(CFG.ca), x: process.env.CULTS_X || CFG.x || null, days: CFG.days, ranks: RANKS, minSol: CFG.minSol, ...(process.env.CULTS_TEST ? { test: true } : {}) }, 'public, max-age=60, s-maxage=300');
      if (a === 'census') return out(res, 200, await census(q.mint), 'public, max-age=30, s-maxage=60, stale-while-revalidate=300');
      if (a === 'cult') return out(res, 200, await cult(q.mint, fresh), fresh ? 'no-store' : 'public, max-age=10, s-maxage=15, stale-while-revalidate=60');
      if (a === 'board') return out(res, 200, await board(fresh), fresh ? 'no-store' : 'public, max-age=10, s-maxage=20, stale-while-revalidate=120');
      if (a === 'wall') return out(res, 200, await wall(fresh), fresh ? 'no-store' : 'public, max-age=10, s-maxage=20, stale-while-revalidate=120');
      if (a === 'log') return out(res, 200, await log(fresh), fresh ? 'no-store' : 'public, max-age=8, s-maxage=12, stale-while-revalidate=60');
      if (a === 'me') return out(res, 200, await me(q.w, fresh), 'no-store');
      if (a === 'holdings') return out(res, 200, await holdings(q.w), 'no-store');
      if (a === 'trending') return out(res, 200, await trending(), 'public, max-age=60, s-maxage=300');
      if (a === 'sim') return out(res, 200, await sim(q), 'public, max-age=15, s-maxage=30');
      return out(res, 400, { error: 'unknown action' });
    }
    const b = await body(req);
    if (a === 'vow') return out(res, 200, await buildVow(b));
    if (a === 'bless') return out(res, 200, await buildBless(b));
    if (a === 'send') { const sig = await conn.sendRawTransaction(Buffer.from(String(b.tx || ''), 'base64'), { skipPreflight: false, maxRetries: 4 }); return out(res, 200, { sig }); }
    return out(res, 400, { error: 'unknown action' });
  } catch (e) { return out(res, 400, { error: String(e && e.message || e).slice(0, 300) }); }
};
module.exports._t = { standing, judged, reset: () => { cache.clear(); IDX.rows.clear(); IDX.newest = null; }, verdict, rankOf, split, blessBatches, parseRite, cultOf, CU };
