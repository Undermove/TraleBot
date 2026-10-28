// @ts-nocheck — движок игр перенесён из прототипа как есть: рисует DOM сам, внутри корня .nm (numbers.css).
// Модуль «Числа»: десять уровней. Перед игрой — интерактивный объяснятор (как устроены числа этого промежутка),
// внутри уровня подсказки постепенно исчезают. Записи чисел 1–99 — public/audio/numbers/n/<число>.m4a
// (ElevenLabs «Alice», eleven_v4, ka). Вибрация и выключатель звука — общие с играми алфавита (alphabet/games/fx).
import { haptic, isMuted, playClip } from '../alphabet/games/fx'

// ───────── Общее: транскрипция, звук, вибрация ─────────
const CYR = { 'ა':'а','ბ':'б','გ':'г','დ':'д','ე':'э','ვ':'в','ზ':'з','თ':'т','ი':'и','კ':'к’','ლ':'л','მ':'м','ნ':'н','ო':'о','პ':'п’','ჟ':'ж','რ':'р','ს':'с','ტ':'т’','უ':'у','ფ':'п','ქ':'к','ღ':'гх','ყ':'къ','შ':'ш','ჩ':'ч','ც':'ц','ძ':'дз','წ':'ц’','ჭ':'ч’','ხ':'х','ჯ':'дж','ჰ':'х' };
const cyr = s => [...s].map(c => CYR[c] ?? c).join('');
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } };
const wait = ms => new Promise(r => setTimeout(r, reduced() ? Math.min(ms, 120) : ms));

const WORDS = { 1:'ერთი',2:'ორი',3:'სამი',4:'ოთხი',5:'ხუთი',6:'ექვსი',7:'შვიდი',8:'რვა',9:'ცხრა',10:'ათი' };
const RU = { 1:'один',2:'два',3:'три',4:'четыре',5:'пять',6:'шесть',7:'семь',8:'восемь',9:'девять',10:'десять',11:'одиннадцать',12:'двенадцать',13:'тринадцать',14:'четырнадцать',15:'пятнадцать',16:'шестнадцать',17:'семнадцать',18:'восемнадцать',19:'девятнадцать' };

let ac = null, layer = null;
const buffers = {}, raw = {};
const clipUrl = n => `/audio/numbers/n/${n}.m4a`;
function fetchClip(n) {
  if (!raw[n]) raw[n] = fetch(clipUrl(n)).then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
  return raw[n];
}
async function decode(n) {
  if (buffers[n] || !ac) return;
  const ab = await fetchClip(n);
  if (!ab || buffers[n]) return;
  try { buffers[n] = await ac.decodeAudioData(ab.slice(0)); } catch {}
}
// WebAudio — без задержки на касание; контекст будим первым касанием, до того играет <audio>
async function unlock() {
  if (ac) { if (ac.state === 'suspended') ac.resume().catch(() => {}); return; }
  const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
  ac = new C(); try { await ac.resume(); } catch {}
  Object.keys(raw).forEach(n => decode(+n));
}
function say(n) {
  if (isMuted()) return;
  if (ac && ac.state === 'running' && buffers[n]) {
    const s = ac.createBufferSource(); s.buffer = buffers[n]; s.connect(ac.destination); s.start();
  } else { void playClip(clipUrl(n)); decode(n); }
}
function tone(freq, dur, type = 'sine', gain = 0.12, slide) {
  if (isMuted() || !ac || ac.state !== 'running') return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
}
const PENTA = [523, 587, 659, 784, 880];
const sfx = {
  tick: i => tone(PENTA[i % 5] * (1 + Math.floor(i / 5) * 0.5), 0.07, 'triangle', 0.08),
  pick: () => tone(700, 0.05, 'triangle', 0.07),
  snap: () => { tone(180, 0.16, 'sine', 0.25, 70); tone(90, 0.2, 'sine', 0.2, 50); },
  good: () => { tone(784, 0.12, 'triangle', 0.1); setTimeout(() => tone(1047, 0.2, 'triangle', 0.1), 90); },
  bad: () => tone(170, 0.18, 'square', 0.05, 120),
  whoosh: () => tone(300, 0.18, 'sine', 0.05, 900)
};
const buzz = kind => haptic(kind);
function burst(x, y, colors) {
  if (reduced()) return;
  for (let i = 0; i < 14; i++) {
    const p = el('i', 'spark'); const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 60;
    p.style.left = x + 'px'; p.style.top = y + 'px';
    p.style.background = colors[i % colors.length];
    p.style.setProperty('--dx', Math.cos(a) * d + 'px'); p.style.setProperty('--dy', Math.sin(a) * d + 'px');
    (layer || document.body).appendChild(p); setTimeout(() => p.remove(), 700);
  }
}
const centerOf = e => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
function pips(host, total, done, current) {
  host.innerHTML = '';
  for (let i = 0; i < total; i++) host.appendChild(el('i', i < done ? 'on' : i === current ? 'cur' : ''));
}
// Слово из частей: каждая часть — грузинское написание, транскрипция и смысл
function segments(parts, cls = '') {
  const w = el('div', 'segs ' + cls);
  parts.forEach((p, i) => {
    const s = el('div', 'seg c-' + p.c);
    s.style.animationDelay = (i * 120) + 'ms';
    s.innerHTML = `<b lang="ka">${p.ka}</b><span class="tr">${cyr(p.ka)}</span><span class="mean">${p.mean}</span>`;
    w.appendChild(s);
  });
  return w;
}

// ───────── Слова чисел ─────────
const T = { ka: 'თ', mean: 'десять', c: 'navy' };
const METI = { ka: 'მეტი', mean: 'сверху', c: 'gold' };
const stem = n => ({ ka: WORDS[n].replace(/ი$/, ''), mean: RU[n], c: 'ruby' });
const TEENS = {
  11: { top: 1 }, 12: { top: 2 }, 14: { top: 4 }, 15: { top: 5 }, 16: { top: 6 },
  13: { top: 3, final: [{ ka: 'ცა', mean: 'т + сам', c: 'ruby' }, METI] },
  17: { top: 7, final: [{ ka: 'ჩვიდ', mean: 'т + швид', c: 'ruby' }, METI] },
  18: { top: 8, final: [T, { ka: 'ვრა', mean: 'восемь', c: 'ruby' }, METI] },
  19: { top: 9, final: [{ ka: 'ცხრა', mean: 'т + цхра', c: 'ruby' }, METI] }
};
const teenWord = n => (TEENS[n].final || [T, stem(TEENS[n].top), METI]).map(p => p.ka).join('');
const BOX = { 1: 'ოც', 2: 'ორმოც', 3: 'სამოც', 4: 'ოთხმოც' };
const BOXRU = { 1: 'двадцать', 2: 'два двадцать', 3: 'три двадцать', 4: 'четыре двадцать' };
const leftWord = k => k <= 10 ? WORDS[k] : teenWord(k);
function twenties(n) {
  const b = Math.floor(n / 20), k = n % 20;
  if (k === 0) return [{ ka: BOX[b] + 'ი', mean: b === 1 ? '20' : b + ' × 20', c: 'navy' }];
  return [{ ka: BOX[b], mean: b === 1 ? '20' : b + ' × 20', c: 'navy' }, { ka: 'და', mean: 'и', c: 'gold' }, { ka: leftWord(k), mean: String(k), c: 'ruby' }];
}
const numWord = n => n < 11 ? WORDS[n] : n < 20 ? teenWord(n) : twenties(n).map(p => p.ka).join('');
const plural = (n, a, b, c) => n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c;
const earIcon = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`;
const backIcon = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
function flash(x, y, text, kind) {
  const f = el('span', 'flash ' + kind, text); f.style.left = x + 'px'; f.style.top = y + 'px';
  (layer || document.body).appendChild(f); setTimeout(() => f.remove(), 800);
}
function setHud(hud, score, streak) {
  hud.querySelector('.score b').textContent = score;
  const s = hud.querySelector('.streak'); if (!s) return;
  s.textContent = 'серия ' + streak; s.classList.toggle('hot', streak >= 2);
}
// смена этапа внутри уровня: короткая плашка «что теперь по-другому»
function phaseTip(host, text) {
  if (!text) return;
  // плашка стоит в потоке под шапкой уровня и держится весь раунд — поверх игры не ложится
  const game = host.closest('.game') || host;
  const bar = game.querySelector(':scope > .levelbar');
  const p = el('div', 'phase', text);
  bar ? bar.after(p) : game.prepend(p);
  buzz('pop'); tone(520, .1, 'triangle', .08); setTimeout(() => tone(780, .14, 'triangle', .08), 90);
}

// ───────── Первые десять: ассоциации по звучанию ─────────
// Для 1–10 правила нет, поэтому каждое слово цепляем за похожее русское слово и картинку в голове
const ASSOC = {
  1: { hook: 'Берти', line: 'Один-единственный пёс по кличке <u>Берти</u>', short: 'Один пёс — <u>Берти</u>' },
  2: { hook: 'орут', line: 'Двое <u>ор</u>ут друг на друга', short: 'Двое <u>ор</u>ут' },
  3: { hook: 'сами', line: 'Втроём <u>сами</u> справимся', short: 'Трое справятся <u>сами</u>' },
  4: { hook: 'отхлебнул', line: '<u>Отх</u>лебнул четыре глотка', short: 'Четыре глотка — <u>отх</u>лебнул' },
  5: { hook: 'хутор', line: '<u>Хут</u>ор из пяти домов', short: '<u>Хут</u>ор в пять домов' },
  6: { hook: 'экспресс', line: '<u>Экс</u>пресс из шести вагонов', short: '<u>Экс</u>пресс в шесть вагонов' },
  7: { hook: 'шведы', line: 'Семь <u>швед</u>ов в лодке', short: 'Семь <u>швед</u>ов' },
  8: { hook: 'рвы', line: 'Замок за восемью <u>рва</u>ми', short: 'Замок за восемью <u>рва</u>ми' },
  9: { hook: 'Сахара', line: 'Девять верблюдов в <u>Сах</u>аре', short: 'Девять верблюдов в <u>Сах</u>аре' },
  10: { hook: 'а ты?', line: 'Я отжался десять раз, <u>а ты</u>?', short: 'Десять раз, <u>а ты</u>?' }
};
const LETTERS10 = [...new Set(Object.values(WORDS).join(''))];
function learnIntro(nums, title, lead, howto) {
  const cards = nums.map(n => `<button class="acard" data-n="${n}"><span class="a-d">${n}</span><span class="a-w"><b lang="ka">${WORDS[n]}</b><span>${cyr(WORDS[n])}</span></span><span class="a-line">${ASSOC[n].line}</span>${earIcon}</button>`).join('');
  return `<h2>${title}</h2><p>${lead}</p><div class="acards">${cards}</div>
    <div class="howto"><span class="howto-tag">${nums[0]}</span><span>${howto}</span></div>`;
}
function wireCards(host) {
  host.querySelectorAll('.acard').forEach(c => c.onclick = () => { const n = +c.dataset.n; say(n); buzz('tap'); c.classList.remove('heard'); void c.offsetWidth; c.classList.add('heard'); });
}

// «Ракета»: обратный отсчёт по-грузински. Слова лежат вразнобой, нажимай по порядку — ракета взлетит
function rocketGame(root, L, ctx) {
  const ROUNDS = L.rounds;
  let r = 0, score = 0, alive = true, raf = 0;
  root.addEventListener('game:leave', () => { alive = false; cancelAnimationFrame(raf); }, { once: true });
  ctx.intro(() => round());

  function round() {
    const R = ROUNDS[r];
    const seq = R.up ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    let step = 0, done = false, mistakes = 0;
    ctx.clear();
    const hud = el('div', 'hud');
    hud.innerHTML = `<span class="score"><b>${score}</b> очков</span><span class="count">запуск ${r + 1} / ${ROUNDS.length}</span>`;
    root.appendChild(hud);

    const pad = el('div', 'pad');
    pad.innerHTML = `<div class="sky"><i class="star s1"></i><i class="star s2"></i><i class="star s3"></i></div>
      <div class="rocket">${ROCKET}<i class="flame"></i></div>
      <div class="gauge">${seq.map(n => `<i data-n="${n}"></i>`).join('')}</div>
      <div class="next"><span class="next-cap">${R.up ? 'Считай вверх' : 'Обратный отсчёт'}</span><span class="next-n">${seq[0]}</span></div>`;
    root.appendChild(pad);
    phaseTip(root, R.tip);
    const fuse = el('div', 'fuse', '<i></i>'); root.appendChild(fuse);
    const grid = el('div', 'wgrid');
    [...seq].sort(() => Math.random() - .5).forEach(n => {
      const b = el('button', 'wtile');
      b.dataset.n = n;
      b.innerHTML = `<b lang="ka">${WORDS[n]}</b>${R.tr ? `<span class="tr">${cyr(WORDS[n])}</span>` : ''}`;
      b.addEventListener('pointerdown', e => { e.preventDefault(); tap(b, n); });
      grid.appendChild(b);
    });
    root.appendChild(grid);
    const foot = el('div', 'foot'); root.appendChild(foot);
    const rocket = pad.querySelector('.rocket'), nextN = pad.querySelector('.next-n');

    const t0 = performance.now(); let penalty = 0; const bar = fuse.firstChild;
    (function tick(now) {
      if (!alive || done) return;
      const left = 1 - (now - t0 + penalty) / R.time;
      bar.style.transform = `scaleX(${Math.max(0, left)})`;
      fuse.classList.toggle('low', left < .3);
      if (left <= 0) { fail(); return; }
      raf = requestAnimationFrame(tick);
    })(t0);

    function tap(b, n) {
      if (done || b.classList.contains('used')) return;
      const [x, y] = centerOf(b);
      if (n !== seq[step]) {
        mistakes++; penalty += 2500; sfx.bad(); buzz('bad');
        b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope');
        flash(x, y, `это ${n}`, 'bad');
        smoke();
        return;
      }
      b.classList.add('used'); say(n); buzz(step < 7 ? 'tap' : 'pop');
      tone(330 * Math.pow(1.09, step), .09, 'triangle', .08);
      pad.querySelector(`.gauge i[data-n="${n}"]`).classList.add('on');
      rocket.style.setProperty('--shake', (1 + step * .35) + 'px');
      rocket.classList.add('hum');
      step++;
      if (step < seq.length) { nextN.textContent = seq[step]; nextN.classList.remove('pop'); void nextN.offsetWidth; nextN.classList.add('pop'); }
      else launch();
    }
    function smoke() {
      const s = el('i', 'puff'); pad.appendChild(s); setTimeout(() => s.remove(), 900);
      rocket.classList.remove('sneeze'); void rocket.offsetWidth; rocket.classList.add('sneeze');
    }
    async function launch() {
      done = true;
      const left = Math.max(0, 1 - (performance.now() - t0 + penalty) / R.time);
      const gain = 300 + Math.round(300 * left) - mistakes * 40;
      score += Math.max(100, gain); setHud(hud, score);
      nextN.textContent = 'Пуск!';
      sfx.whoosh(); buzz('snap'); setTimeout(() => buzz('good'), 300);
      tone(120, 1.2, 'sawtooth', .05, 600);
      pad.classList.add('launch');
      await wait(1100);
      if (!alive) return;
      foot.appendChild(el('p', 'tipline', mistakes ? `Взлетела! Ошибок: ${mistakes}` : 'Взлетела без единой ошибки'));
      next();
    }
    function fail() {
      done = true; sfx.bad(); buzz('bad'); smoke();
      nextN.textContent = 'Отбой';
      grid.querySelectorAll('.wtile:not(.used)').forEach(b => b.classList.add('show'));
      foot.appendChild(el('p', 'hint', 'Время вышло. Под каждым словом теперь его число — посмотри и попробуй снова.'));
      grid.querySelectorAll('.wtile').forEach(b => b.insertAdjacentHTML('beforeend', `<span class="d">${b.dataset.n}</span>`));
      const again = el('button', 'cta', 'Ещё попытка'); again.onclick = () => { buzz('tap'); round(); };
      foot.appendChild(again);
    }
    function next() {
      const b = el('button', 'cta', r + 1 < ROUNDS.length ? 'Следующий запуск' : 'Итоги');
      b.onclick = () => { buzz('tap'); r++; r < ROUNDS.length ? round() : finish(); };
      foot.appendChild(b);
    }
  }
  function finish() {
    const t = el('div', 'teen-table');
    for (let n = 1; n <= 10; n++) {
      const row = el('button', 'teen-row');
      row.innerHTML = `<span class="d">${n}</span><b lang="ka">${WORDS[n]}</b><span class="tr">${cyr(WORDS[n])}</span>`;
      row.onclick = () => { say(n); buzz('tap'); };
      t.appendChild(row);
    }
    ctx.done({ title: `${score} очков`, text: 'Первые десять готовы. Дальше они станут кирпичиками: 12 — это десятка и ორ сверху.', extra: t,
      again: () => { r = 0; score = 0; round(); } });
  }
}
const ROCKET = `<svg viewBox="0 0 60 120" width="54" height="108" aria-hidden="true">
  <path d="M30 4c14 14 18 34 16 66H14C12 38 16 18 30 4z" fill="#FFFDF6" stroke="#15100A" stroke-width="3" stroke-linejoin="round"/>
  <path d="M30 4c6 6 10 13 13 22H17c3-9 7-16 13-22z" fill="#E01A3C" stroke="#15100A" stroke-width="3" stroke-linejoin="round"/>
  <circle cx="30" cy="44" r="8" fill="#1B5FB0" stroke="#15100A" stroke-width="3"/>
  <path d="M14 58L3 80l12-2zM46 58l11 22-12-2z" fill="#F5B820" stroke="#15100A" stroke-width="3" stroke-linejoin="round"/>
  <path d="M20 70h20l-3 9H23z" fill="#5A4735" stroke="#15100A" stroke-width="3" stroke-linejoin="round"/></svg>`;

// ───────── «Как это устроено»: правило открываешь руками, до игры ─────────
// Каждый объяснятор — несколько шагов; на каждом подсвечено одно действие, экран отвечает словом и голосом.
function exPrompt(host) {
  const p = el('p', 'ex-prompt');
  return { el: p, set(html) { p.innerHTML = html; p.classList.remove('new'); void p.offsetWidth; p.classList.add('new'); } };
}
const sayIf = say;
function wordSegs(n) {
  if (n <= 10) return [{ ka: WORDS[n], mean: String(n), c: 'ruby' }];
  if (n < 20) return TEENS[n].final || [T, stem(TEENS[n].top), METI];
  return twenties(n);
}
function showWord(host, n, note) {
  host.innerHTML = '';
  host.appendChild(segments(wordSegs(n).map(p => ({ ...p }))));
  host.appendChild(el('div', 'whole', `<b lang="ka">${numWord(n)}</b><span>${cyr(numWord(n))} · ${n}</span>`));
  if (note) host.appendChild(el('p', 'note', note));
}

// 1–10: одно число за раз. Нажал на цифру — услышал, слово сложилось из букв, под ним ассоциация
function learnExplore(nums) {
  return (s, unlock) => {
    let k = 0;
    s.classList.add('bare');
    const dots = el('div', 'pips'); s.appendChild(dots);
    const stage = el('div', 'lx'); s.appendChild(stage);
    function card() {
      const n = nums[k];
      pips(dots, nums.length, k, k);
      stage.innerHTML = '';
      const big = el('button', 'lx-big pulse', `${n}`); big.id = 'ex-tap'; big.setAttribute('aria-label', 'Послушать');
      const hint = el('span', 'lx-hint', 'нажми');
      const word = el('div', 'lx-word');
      const tr = el('div', 'lx-tr');
      const assoc = el('p', 'lx-assoc');
      stage.append(big, hint, word, tr, assoc);
      let heard = false;
      big.onclick = async () => {
        say(n); buzz('pop');
        big.classList.remove('tapped'); void big.offsetWidth; big.classList.add('tapped');
        if (heard) return;
        heard = true; big.classList.remove('pulse'); hint.remove();
        for (const ch of WORDS[n]) {
          word.appendChild(el('b', '', ch)).setAttribute('lang', 'ka');
          sfx.tick(word.children.length - 1); buzz('tap'); await wait(130);
        }
        tr.textContent = cyr(WORDS[n]);
        assoc.innerHTML = ASSOC[n].short; assoc.classList.add('on');
        const nx = el('button', 'lx-next', backIcon); nx.id = 'ex-next';
        nx.setAttribute('aria-label', k + 1 < nums.length ? 'Дальше' : 'Повторить');
        nx.onclick = () => { buzz('tap'); k++; k < nums.length ? card() : review(); };
        stage.appendChild(nx);
      };
    }
    function review() {
      pips(dots, nums.length, nums.length, -1);
      stage.innerHTML = '';
      const grid = el('div', 'lx-review');
      nums.forEach(n => {
        const b = el('button', 'lx-tile', `<span>${n}</span><b lang="ka">${WORDS[n]}</b>`);
        b.onclick = () => { say(n); buzz('tap'); b.classList.remove('tapped'); void b.offsetWidth; b.classList.add('tapped'); };
        grid.appendChild(b);
      });
      stage.appendChild(grid);
      unlock('Играть');
    }
    card();
  };
}

// «Буквы»: видишь цифру (или слышишь) — складываешь слово в клеточки. Заполнил — проверилось само
function lettersGame(root, L, ctx) {
  const R = L.tags;
  let i = 0, clean = 0, alive = true;
  root.addEventListener('game:leave', () => { alive = false; }, { once: true });
  ctx.intro(() => round());

  function round() {
    const t = R[i], n = t.n, word = [...WORDS[n]];
    let tries = 0, done = false;
    ctx.clear();
    const top = el('div', 'lg-top'); const dots = el('div', 'pips'); pips(dots, R.length, i, i); top.appendChild(dots);
    root.appendChild(top);

    const card = el('div', 'lg-card');
    if (t.ear) {
      const ear = el('button', 'lg-ear pulse', earIcon); ear.setAttribute('aria-label', 'Послушать');
      ear.onclick = () => { say(n); buzz('soft'); ear.classList.remove('pulse'); };
      card.appendChild(ear);
      setTimeout(() => alive && say(n), 350);
    } else card.appendChild(el('span', 'lg-digit', String(n)));
    if (t.hint) card.appendChild(el('p', 'lx-assoc on', ASSOC[n].short));
    root.appendChild(card);
    phaseTip(root, t.tip);

    const slots = el('div', 'lg-slots');
    word.forEach(() => slots.appendChild(el('button', 'lg-slot')));
    root.appendChild(slots);
    const tr = el('div', 'lx-tr'); root.appendChild(tr);

    const tray = el('div', 'lg-tray');
    [...word, ...letterTraps(n, t.hint ? 2 : 3)].sort(() => Math.random() - .5).forEach(ch => {
      const b = el('button', 'lg-letter', `<b lang="ka">${ch}</b>${t.hint ? `<i>${cyr(ch)}</i>` : ''}`);
      b.dataset.ch = ch;
      b.addEventListener('pointerdown', e => { e.preventDefault(); put(b); });
      tray.appendChild(b);
    });
    root.appendChild(tray);
    const foot = el('div', 'foot'); root.appendChild(foot);

    const slotEls = [...slots.children];
    slotEls.forEach(s => s.addEventListener('pointerdown', e => { e.preventDefault(); if (!done && s._src) { back(s); buzz('soft'); } }));
    function put(src) {
      if (done || src.classList.contains('gone')) return;
      const s = slotEls.find(s => !s._src); if (!s) return;
      const [x0, y0] = centerOf(src);
      s._src = src; s.innerHTML = `<b lang="ka">${src.dataset.ch}</b>`; s.classList.add('full');
      src.classList.add('gone');
      const [x1, y1] = centerOf(s);
      if (!reduced()) s.firstChild.animate([{ transform: `translate(${x0 - x1}px, ${y0 - y1}px)` }, { transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.3,.7,.4,1)' });
      sfx.tick(slotEls.indexOf(s)); buzz('tap');
      if (slotEls.every(s => s._src)) setTimeout(check, 180);
    }
    function back(s) { s._src.classList.remove('gone'); s._src = null; s.innerHTML = ''; s.classList.remove('full', 'bad'); }
    async function check() {
      if (done) return;
      const wrong = slotEls.filter((s, j) => s._src.dataset.ch !== word[j]);
      if (!wrong.length) return win();
      tries++; sfx.bad(); buzz('bad');
      wrong.forEach(s => s.classList.add('bad'));
      await wait(550);
      wrong.forEach(back);
      if (tries >= 2) reveal();
    }
    async function win() {
      done = true; if (!tries) clean++;
      slots.classList.add('ok'); sfx.good(); buzz('good');
      const [x, y] = centerOf(slots); burst(x, y, ['var(--gold-fill)', 'var(--leaf)', 'var(--navy)']);
      tr.textContent = cyr(WORDS[n]); say(n);
      if (t.ear) card.innerHTML = `<span class="lg-digit">${n}</span>`;
      await wait(1300);
      if (alive) nextRound();
    }
    function reveal() {
      done = true; say(n);
      slotEls.forEach((s, j) => { if (s._src) s._src.classList.remove('gone'); s._src = null; s.innerHTML = `<b lang="ka">${word[j]}</b>`; s.classList.add('full', 'shown'); });
      tray.classList.add('quiet');
      tr.textContent = cyr(WORDS[n]);
      if (t.ear) card.innerHTML = `<span class="lg-digit">${n}</span>`;
      card.appendChild(el('p', 'lx-assoc on', ASSOC[n].short));
      const nx = el('button', 'lx-next', backIcon); nx.setAttribute('aria-label', 'Дальше');
      nx.onclick = () => { buzz('tap'); nextRound(); };
      foot.appendChild(nx);
    }
  }
  function nextRound() { i++; i < R.length ? round() : finish(); }
  function finish() {
    const grid = el('div', 'lx-review');
    [...new Set(R.map(t => t.n))].sort((a, b) => a - b).forEach(n => {
      const b = el('button', 'lx-tile', `<span>${n}</span><b lang="ka">${WORDS[n]}</b>`);
      b.onclick = () => { say(n); buzz('tap'); };
      grid.appendChild(b);
    });
    ctx.done({ title: `${clean} из ${R.length}`, text: 'с первого раза', extra: grid, again: () => { i = 0; clean = 0; round(); } });
  }
}

// 11–19: кладёшь десятку, сверху маленькое число — слово собирается само
function teensExplore(s, unlock) {
  const pr = exPrompt(s); s.appendChild(pr.el);
  const stage = el('div', 'ex-stage teens');
  stage.innerHTML = `<div class="ex-stack"><div class="ex-top"></div><button class="ex-ten pulse" id="ex-tap">${'<i></i>'.repeat(10)}<span lang="ka">ათი</span></button></div>`;
  s.appendChild(stage);
  const word = el('div', 'ex-word'); s.appendChild(word);
  const chips = el('div', 'ex-chips');
  for (let n = 1; n <= 9; n++) chips.appendChild(el('button', 'ex-chip', `<span class="d">${n}</span><b lang="ka">${stem(n).ka}</b>`));
  s.appendChild(chips);
  const ten = stage.querySelector('.ex-ten'), top = stage.querySelector('.ex-top');
  const tried = new Set(); let step = 0;
  chips.classList.add('off');
  pr.set('Это десятка — <b lang="ka">ათი</b> (ати). <b>Нажми на неё</b>');
  ten.onclick = async () => {
    say(10); buzz('snap');
    if (step) return;
    step = 1; ten.classList.remove('pulse');
    word.innerHTML = `<div class="ex-ati"><b class="drop" lang="ka">ა</b><b class="keep c-navy" lang="ka">თ</b><b class="drop" lang="ka">ი</b></div>`;
    await wait(700);
    word.querySelector('.ex-ati').classList.add('shrink'); sfx.whoosh();
    await wait(500);
    ten.querySelector('span').textContent = 'თ';
    pr.set('В числах 11–19 от десятки остаётся одна буква <b lang="ka">თ</b> (т). Теперь <b>положи сверху двойку</b>');
    chips.classList.remove('off');
    chips.querySelectorAll('.ex-chip').forEach((c, i) => { c.classList.toggle('dim', i !== 1); c.classList.toggle('pulse', i === 1); });
  };
  chips.querySelectorAll('.ex-chip').forEach((c, i) => c.onclick = () => {
    const k = i + 1;
    if (step === 1 && k !== 2) { buzz('soft'); return; }
    put(k);
    if (step === 1) {
      step = 2;
      chips.querySelectorAll('.ex-chip').forEach(c => c.classList.remove('dim', 'pulse'));
      pr.set('<b lang="ka">მეტი</b> (мэт’и) — «сверху». Десять и два сверху — 12. <b>Теперь положи любое другое число</b>');
    } else {
      tried.add(k);
      pr.set(tried.size < 3 ? `Отлично. Попробуй ещё ${3 - tried.size === 1 ? 'одно' : 'пару'}` : 'Понял правило? Можно играть — или потыкать ещё');
      if (tried.size >= 3) unlock('В тир');
    }
  });
  function put(k) {
    const n = 10 + k;
    top.innerHTML = '<i></i>'.repeat(k);
    top.classList.remove('land'); void top.offsetWidth; top.classList.add('land');
    sfx.snap(); buzz('snap');
    showWord(word, n, TEENS[n].final ? 'Это хулиган — звук поменялся. Разберём их на следующем уровне.' : null);
    setTimeout(() => sayIf(n), 250);
  }
}

// хулиганы: нажми — и куски по правилу «сталкиваются» в настоящее слово
function hooliganExplore(s, unlock) {
  const pr = exPrompt(s); s.appendChild(pr.el);
  pr.set('По правилу 13 было бы <b>т + сам + мэт’и</b>. <b>Нажми на строку</b> — и услышишь, как говорят на самом деле');
  const ROWS = [
    { n: 13, rule: ['თ', 'სამ', 'მეტი'], how: 'т и с слиплись в ц' },
    { n: 17, rule: ['თ', 'შვიდ', 'მეტი'], how: 'т и ш слиплись в ч' },
    { n: 18, rule: ['თ', 'რვა', 'მეტი'], how: 'рва перевернулось в вра' },
    { n: 19, rule: ['თ', 'ცხრა', 'მეტი'], how: 'т спряталась в ц' }
  ];
  const list = el('div', 'ex-hoolies'); s.appendChild(list);
  const seen = new Set();
  ROWS.forEach((r, idx) => {
    const b = el('button', 'ex-hrow' + (idx === 0 ? ' pulse' : ''));
    b.id = 'ex-h' + r.n;
    b.innerHTML = `<span class="d">${r.n}</span><span class="ex-parts">${r.rule.map(p => `<b lang="ka">${p}</b>`).join('<i>+</i>')}</span><span class="ex-res"></span>`;
    b.onclick = async () => {
      buzz('snap'); b.classList.remove('pulse');
      if (seen.has(r.n)) { say(r.n); return; }
      seen.add(r.n);
      b.classList.add('crash'); sfx.snap();
      await wait(420);
      const w = teenWord(r.n);
      b.querySelector('.ex-parts').innerHTML = TEENS[r.n].final.map(p => `<b lang="ka" class="${p.ka === 'მეტი' ? '' : 'c-ruby'}">${p.ka}</b>`).join('<i>+</i>');
      b.querySelector('.ex-res').innerHTML = `<b lang="ka">${w}</b><span>${cyr(w)} · ${r.how}</span>`;
      b.classList.remove('crash'); b.classList.add('fixed');
      say(r.n);
      const nextRow = list.children[idx + 1]; if (nextRow && !seen.has(ROWS[idx + 1].n)) nextRow.classList.add('pulse');
      pr.set(seen.size < 4 ? `Ещё ${4 - seen.size}. Нажимай следующую строку` : 'Четыре хулигана. Остальные 11–19 — строго по правилу');
      if (seen.size === 4) unlock('Собирать ценники');
    };
    list.appendChild(b);
  });
}

// ящики: кладёшь ящики по 20 — слово меняется ოცი → ორმოცი → …; потом пакет и штуки
function boxesExplore(mode) {
  return (s, unlock) => {
    const pr = exPrompt(s); s.appendChild(pr.el);
    const counter = el('div', 'counter');
    counter.innerHTML = `<div class="pile"></div><div class="total"><span class="t-num">0</span><span class="t-cap">на прилавке</span></div>`;
    s.appendChild(counter);
    const word = el('div', 'ex-word'); s.appendChild(word);
    const stock = el('div', 'stock');
    const IT = [{ v: 20, cls: 'box', label: 'Ящик', sub: '20' }, { v: 10, cls: 'bag', label: 'Пакет', sub: '10' }, { v: 1, cls: 'one', label: 'Штука', sub: '1' }];
    const btn = {};
    IT.forEach(it => {
      const b = el('button', 'item ' + it.cls, `<span class="pic"></span><span class="i-label">${it.label}</span><span class="i-sub">${it.sub}</span><span class="plus-badge">+${it.v}</span>`);
      b.id = 'ex-' + it.cls; btn[it.cls] = b; stock.appendChild(b);
      b.addEventListener('pointerdown', e => { e.preventDefault(); add(it); });
    });
    s.appendChild(stock);
    const clear = el('button', 'cta ghost', 'Убрать всё'); clear.hidden = true; s.appendChild(clear);
    let boxes = 0, bags = 0, ones = 0, free = 0;
    const total = () => boxes * 20 + bags * 10 + ones;
    // сценарий: что сейчас можно нажать и что сказать после
    const script = mode === 'round'
      ? [{ only: 'box', say: 'Грузины считают ящиками по 20. <b>Положи на прилавок ящик</b>' },
         { only: 'box', say: 'Это <b>один ящик</b> — <b lang="ka">ოცი</b> (оци), 20. <b>Положи ещё ящик</b>' },
         { only: 'box', say: '<b lang="ka">ორმოცი</b> — «два двадцать», 40. Сорок — это два ящика. <b>Ещё ящик</b>' },
         { only: 'box', say: '<b lang="ka">სამოცი</b> — «три двадцать», 60. <b>И ещё один</b>' },
         { only: 'bag', say: '<b lang="ka">ოთხმოცი</b> — «четыре двадцать», 80. Больше ящиков не бывает. <b>Добавь пакет-десятку</b>' },
         { only: null, say: '80 <b>და</b> 10: «четыре двадцать и десять» — 90. Хвостик <b lang="ka">ი</b> у ящиков пропал, появилось <b lang="ka">და</b> — «и». <b>Теперь собирай что хочешь</b>' }]
      : [{ only: 'box', say: 'Собери 58. <b>Положи ящик</b>' },
         { only: 'box', say: '20. <b>Ещё ящик</b>' },
         { only: 'bag', say: '40 — <b lang="ka">ორმოცი</b>. Осталось 18, это десять и восемь сверху. <b>Положи пакет</b>' },
         ...Array.from({ length: 8 }, (_, j) => ({ only: 'one', say: `Штук: ${j} из 8. <b>Положи ещё штуку</b>` })),
         { only: null, say: '58 = два ящика <b>და</b> «десять и восемь сверху». Остаток 11–19 говорится как в первом десятке после 10. <b>Собирай что хочешь</b>' }];
    let st = 0;
    function gate() {
      const cur = script[st];
      Object.entries(btn).forEach(([k, b]) => { const on = !cur || !cur.only || cur.only === k; b.classList.toggle('dim', !on); b.classList.toggle('pulse', !!(cur && cur.only === k)); });
    }
    pr.set(script[0].say); gate();
    function add(it) {
      const cur = script[st];
      if (cur && cur.only && cur.only !== it.cls) { buzz('soft'); return; }
      if (it.v === 20 && boxes >= 4) { pr.set('Больше четырёх ящиков не бывает: 100 — это уже новое слово <b lang="ka">ასი</b>.'); sfx.bad(); buzz('bad'); return; }
      if (total() + it.v > 99) { sfx.bad(); buzz('bad'); return; }
      if (it.v === 20) boxes++; else if (it.v === 10) bags++; else ones++;
      // пакет и 10 штук — это одно и то же; в ящик складываем, как только набралось 20
      if (ones === 10) { ones = 0; bags++; }
      if (bags === 2) { bags = 0; boxes++; }
      btn[it.cls].classList.remove('press'); void btn[it.cls].offsetWidth; btn[it.cls].classList.add('press');
      it.v === 20 ? (sfx.snap(), buzz('snap')) : it.v === 10 ? (tone(260, .12, 'sine', .18, 120), buzz('pop')) : (sfx.tick(ones), buzz('tap'));
      render();
      if (st < script.length - 1) {
        st++;
        pr.set(script[st].say);
        if (st === script.length - 1) clear.hidden = false;
        gate();
      } else if (++free >= 3) unlock(mode === 'round' ? 'На рынок' : 'На большой рынок');
    }
    clear.onclick = () => { boxes = bags = ones = 0; render(); buzz('soft'); };
    function render() {
      const pile = counter.querySelector('.pile'); pile.innerHTML = '';
      for (let k = 0; k < boxes; k++) pile.appendChild(el('i', 'p-box'));
      for (let k = 0; k < bags; k++) pile.appendChild(el('i', 'p-bag'));
      for (let k = 0; k < ones; k++) pile.appendChild(el('i', 'p-one'));
      const t = total(); counter.querySelector('.t-num').textContent = t;
      if (t) { showWord(word, t); setTimeout(() => sayIf(t), 200); } else word.innerHTML = '';
    }
  };
}

// 21–39: ящик уже на прилавке, добавляешь сверху любой остаток до 19
function twentyPlusExplore(s, unlock) {
  const pr = exPrompt(s); s.appendChild(pr.el);
  pr.set('На прилавке один ящик — <b lang="ka">ოცი</b>, 20. <b>Нажми любое число</b> — оно ляжет рядом');
  const word = el('div', 'ex-word'); s.appendChild(word);
  showWord(word, 20);
  const chips = el('div', 'ex-chips wide');
  for (let k = 1; k <= 19; k++) chips.appendChild(el('button', 'ex-chip' + (k > 10 ? ' teen' : ''), `<span class="d">${k}</span>`));
  s.appendChild(chips);
  const tried = new Set();
  chips.querySelectorAll('.ex-chip').forEach((c, i) => c.onclick = () => {
    const k = i + 1, n = 20 + k;
    tried.add(k); sfx.snap(); buzz('snap');
    showWord(word, n, k > 10 ? `Остаток ${k} — это «${k === 13 || k > 16 ? 'хулиган' : 'десять и ' + (k - 10) + ' сверху'}»: слово целиком из второго десятка.` : null);
    setTimeout(() => sayIf(n), 200);
    const teens = [...tried].some(x => x > 10);
    pr.set(!teens ? 'Хвостик <b lang="ka">ი</b> у <b lang="ka">ოცი</b> пропал, появилось <b lang="ka">და</b> — «и». <b>Теперь попробуй число больше 10</b>' : tried.size < 3 ? 'Ещё одно' : 'Ящик + და + остаток. Можно собирать ценники');
    if (teens && tried.size >= 3) unlock('Собирать ценники');
  });
}

// ───────── Уровни: сложность растёт от уровня к уровню и внутри уровня ─────────
const LEVELS = [
  { game: 'letters', kind: 'Буквы', name: 'Один, два, три', range: '1–3', what: 'Первые слова и ассоциации к ним', time: 30000, learn: [1, 2, 3],
    tags: [
      { n: 1, hint: true }, { n: 2, hint: true }, { n: 3, hint: true },
      { n: 3, tip: 'Без подсказок' }, { n: 1 }, { n: 2 },
      { n: 2, ear: true, tip: 'На слух' }, { n: 3, ear: true }
    ] },
  { game: 'letters', kind: 'Буквы', name: 'Четыре, пять, шесть', range: '4–6', what: 'Ещё три слова и повтор 1–3', time: 30000, learn: [4, 5, 6],
    tags: [
      { n: 4, hint: true }, { n: 5, hint: true }, { n: 6, hint: true },
      { n: 6, tip: 'Без подсказок' }, { n: 4 }, { n: 3, tip: 'Повтор' }, { n: 5 },
      { n: 6, ear: true, tip: 'На слух' }, { n: 2, ear: true }, { n: 4, ear: true }
    ] },
  { game: 'letters', kind: 'Буквы', name: 'Семь, восемь, девять, десять', range: '7–10', what: 'Последние четыре и повтор', time: 30000, learn: [7, 8, 9, 10],
    tags: [
      { n: 7, hint: true }, { n: 8, hint: true }, { n: 9, hint: true }, { n: 10, hint: true },
      { n: 9, tip: 'Без подсказок' }, { n: 7 }, { n: 5, tip: 'Повтор' }, { n: 10 }, { n: 8 },
      { n: 9, ear: true, tip: 'На слух' }, { n: 6, ear: true }, { n: 7, ear: true }
    ] },
  { game: 'rocket', kind: 'Ракета', name: 'Обратный отсчёт', range: '1–10', what: 'Все десять по порядку и наоборот',
    rounds: [
      { tr: true, time: 45000 },
      { tr: false, time: 40000, tip: 'Без транскрипции' },
      { tr: false, up: true, time: 32000, tip: 'Теперь вверх и быстрее' }
    ] },
  { game: 'teens', kind: 'Тир', name: 'Десять и сверху', range: '11–19', what: 'Правило: т + число + мэт’и',
    orders: [
      { n: 12, show: 'digit', still: true },
      { n: 14, show: 'digit', still: true },
      { n: 15, show: 'digit', speed: 22 },
      { n: 11, show: 'digit', speed: 26 },
      { n: 16, show: 'ear', digits: true, speed: 26, tip: 'Теперь без цифры — слушай слово' },
      { n: 12, show: 'ear', digits: true, speed: 32 },
      { n: 14, show: 'ear', speed: 34, tip: 'На мишенях больше нет цифр' },
      { n: 15, show: 'ear', speed: 40 },
      { n: 11, show: 'ear', speed: 46 }
    ] },
  { game: 'tags', kind: 'Ценники', name: 'Четыре хулигана', range: '11–19', what: '13, 17, 18, 19 — исключения', time: 35000,
    tags: [
      { n: 12, parts: ['t', 'or', 'meti'], traps: ['ori', 'ati'], hint: true },
      { n: 15, parts: ['t', 'xut', 'meti'], traps: ['xuti', 'ati'], hint: true },
      { n: 13, parts: ['ca', 'meti'], traps: ['t', 'sam'], hint: true, tip: 'Первый хулиган' },
      { n: 18, parts: ['t', 'vra', 'meti'], traps: ['rva', 'ati'] },
      { n: 14, parts: ['t', 'otx', 'meti'], traps: ['otxi', 'ati'], tip: 'Дальше без подсказок под кусками' },
      { n: 17, parts: ['chvid', 'meti'], traps: ['t', 'shvid'] },
      { n: 19, parts: ['cxra', 'meti'], traps: ['t', 'ati'] },
      { n: 16, parts: ['t', 'eqvs', 'meti'], traps: ['eqvsi', 'ati', 'ca'] }
    ] },
  { game: 'mand', kind: 'Рынок', name: 'Ящики по двадцать', range: '20–90', what: 'Считаешь ящиками, а не десятками',
    customers: [
      { n: 20, show: 'color' }, { n: 40, show: 'color' }, { n: 30, show: 'color' },
      { n: 60, show: 'word', tip: 'Теперь слово без раскраски' }, { n: 50, show: 'word' }, { n: 80, show: 'word' },
      { n: 70, show: 'ear', tip: 'Дальше покупатели только говорят' }, { n: 90, show: 'ear' }
    ] },
  { game: 'tags', kind: 'Ценники', name: 'Двадцать и ещё', range: '21–39', what: 'Сам собираешь: ოც + და + остаток', time: 32000,
    tags: [
      { n: 23, parts: ['oc', 'da', 'sami'], traps: ['oci', 'samoc'], hint: true },
      { n: 25, parts: ['oc', 'da', 'xuti'], traps: ['oci', 'ati'], hint: true },
      { n: 30, parts: ['oc', 'da', 'ati'], traps: ['samoc', 'oci'], tip: 'Тридцать — это не «три»' },
      { n: 32, parts: ['oc', 'da', 't', 'or', 'meti'], traps: ['ati', 'ori', 'samoc'], tip: 'Остаток бывает и 11–19' },
      { n: 35, parts: ['oc', 'da', 't', 'xut', 'meti'], traps: ['xuti', 'samoc', 'oci'] },
      { n: 37, parts: ['oc', 'da', 'chvid', 'meti'], traps: ['t', 'shvid', 'samoc'] },
      { n: 39, parts: ['oc', 'da', 'cxra', 'meti'], traps: ['t', 'oci', 'samoc'] }
    ] },
  { game: 'mand', kind: 'Рынок', name: 'Большой рынок', range: 'до 99', what: 'Разбираешь любое число на слух',
    customers: [
      { n: 47, show: 'color' }, { n: 64, show: 'color' },
      { n: 58, show: 'word', tip: 'Слово без раскраски' }, { n: 71, show: 'word' }, { n: 86, show: 'word' },
      { n: 93, show: 'ear', tip: 'Теперь только на слух' }, { n: 65, show: 'ear' }, { n: 99, show: 'ear' }
    ] },
  { game: 'tags', kind: 'Ценники', name: 'Ярмарка', range: 'до 99', what: 'Без подсказок и быстрее', time: 26000,
    tags: [
      { n: 47, parts: ['ormoc', 'da', 'shvidi'], traps: ['otxmoc', 'i'] },
      { n: 64, parts: ['samoc', 'da', 'otxi'], traps: ['eqvsi', 'otxmoc'] },
      { n: 58, parts: ['ormoc', 'da', 't', 'vra', 'meti'], traps: ['rva', 'ati', 'otxmoc'] },
      { n: 80, parts: ['otxmoc', 'i'], traps: ['ormoc', 'da', 'ati'] },
      { n: 71, parts: ['samoc', 'da', 't', 'ert', 'meti'], traps: ['erti', 'ati', 'otxmoc'] },
      { n: 93, parts: ['otxmoc', 'da', 'ca', 'meti'], traps: ['t', 'sam', 'samoc'] },
      { n: 86, parts: ['otxmoc', 'da', 'eqvsi'], traps: ['ormoc', 'samoc', 'i'] },
      { n: 99, parts: ['otxmoc', 'da', 'cxra', 'meti'], traps: ['t', 'ati', 'cxra2'] }
    ] }
];
// у каждого уровня своё вступление: одно правило, коротко
const INTROS = [
  learnIntro([1, 2, 3], 'Один, два, три', 'Для первых десяти правила нет — зато к каждому слову есть похожее русское. Нажми на карточку и послушай.', 'На ценнике цифра. <b>Собери её слово по буквам</b> — алфавит ты уже знаешь.'),
  learnIntro([4, 5, 6], 'Четыре, пять, шесть', 'Три новых слова. Старые тоже будут попадаться.', 'Так же собираешь по буквам. В конце — на слух.'),
  learnIntro([7, 8, 9, 10], 'Семь, восемь, девять, десять', 'Последние четыре. <b lang="ka">ათი</b> (ати) — десять — понадобится дальше, в 11–19.', 'Собираешь по буквам, в конце — на слух.'),
  `<h2>Обратный отсчёт</h2>
   <p>Все десять слов вразнобой. Нажимай их по порядку: от <b lang="ka">ათი</b> (ати) до <b lang="ka">ერთი</b> (эрти). С каждым словом ракета гудит сильнее.</p>
   <div class="howto"><span class="howto-tag">10</span><span>Над ракетой — какое число нужно сейчас. <b>Найди его слово</b>. Ошибка — ракета чихает и теряет время.</span></div>`,
  `<h2>Десять и&nbsp;сверху</h2>
   <p><b lang="ka">მეტი</b> (мэт’и) значит «сверху». Числа 11–19 — это десятка, на которую положили маленькое число.</p>
   <div class="formula"><span class="c-navy" lang="ka">თ</span><span class="plus">+</span><span class="c-ruby" lang="ka">ორ</span><span class="plus">+</span><span class="c-gold" lang="ka">მეტი</span><span class="eq">=</span><span>12</span></div>
   <p class="tr-line">т + ор + мэт’и: десять и два сверху</p>
   <div class="howto"><span class="howto-word"><b class="c-navy" lang="ka">თ</b><i>?</i><b class="c-gold" lang="ka">მეტი</b></span><span>У слова выпала серединка. <b>Нажми на мишень</b>, на которой она написана.</span></div>`,
  `<h2>Четыре хулигана</h2>
   <p>Почти все 11–19 собираются по правилу. Но четыре числа его ломают — их надо просто запомнить:</p>
   <div class="hoolies">
     <div><span class="d">13</span><b lang="ka">ცამეტი</b><span>т + с слиплись в ц</span></div>
     <div><span class="d">17</span><b lang="ka">ჩვიდმეტი</b><span>т + ш слиплись в ч</span></div>
     <div><span class="d">18</span><b lang="ka">თვრამეტი</b><span>рва перевернулось в вра</span></div>
     <div><span class="d">19</span><b lang="ka">ცხრამეტი</b><span>т спряталась в ц</span></div>
   </div>
   <div class="howto"><span class="howto-tag">13</span><span>Видишь цену — <b>собери её слово</b> из кусков. Среди кусков есть ловушки.</span></div>`,
  `<h2>Грузины считают ящиками по&nbsp;двадцать</h2>
   <p><b lang="ka">ოცი</b> (оци) — 20, один ящик. <b lang="ka">ორმოცი</b> (ормоци) — «два двадцать», 40. Остаток добавляют через <b lang="ka">და</b> (да) — «и».</p>
   <div class="formula"><span class="c-navy" lang="ka">ოც</span><span class="plus">+</span><span class="c-gold" lang="ka">და</span><span class="plus">+</span><span class="c-ruby" lang="ka">ათი</span><span class="eq">=</span><span>30</span></div>
   <p class="tr-line">оц + да + ати: двадцать и десять</p>
   <div class="howto"><span class="howto-box"></span><span>Покупатель называет число. <b>Положи на прилавок ровно столько</b> — ящиками, пакетами и штуками.</span></div>`,
  `<h2>Двадцать и&nbsp;ещё</h2>
   <p>Всё от 21 до 39 — это <b lang="ka">ოც</b> + <b lang="ka">და</b> + остаток. Остаток может быть любым числом до 19, даже хулиганом.</p>
   <div class="formula"><span class="c-navy" lang="ka">ოც</span><span class="plus">+</span><span class="c-gold" lang="ka">და</span><span class="plus">+</span><span class="c-ruby" lang="ka">თორმეტი</span><span class="eq">=</span><span>32</span></div>
   <p class="tr-line">оц + да + тормэт’и: двадцать и двенадцать</p>
   <div class="howto"><span class="howto-tag">32</span><span>Теперь собираешь сам. Ловушки подсказывает русская привычка: «три» в тридцати.</span></div>`,
  `<h2>Большой рынок</h2>
   <p>Любое число до 99 — это ящики по двадцать, <b lang="ka">და</b> и остаток до 19.</p>
   <div class="formula small"><span class="c-navy" lang="ka">ოთხმოც</span><span class="plus">+</span><span class="c-gold" lang="ka">და</span><span class="plus">+</span><span class="c-ruby" lang="ka">ცხრამეტი</span><span class="eq">=</span><span>99</span></div>
   <p class="tr-line">отхмоц + да + цхрамэт’и: четыре ящика и девятнадцать</p>
   <div class="howto"><span class="howto-box"></span><span>Покупатели говорят быстрее и больше. В конце — только на слух.</span></div>`,
  `<h2>Ярмарка</h2>
   <p>Все правила вместе: ящики, <b lang="ka">და</b>, остаток, хулиганы и хвостик <b lang="ka">ი</b> у круглых. Подписей под кусками нет, времени меньше.</p>
   <div class="howto"><span class="howto-tag">86</span><span>Собери слово для каждой цены. Чем быстрее и чище — тем больше выручка.</span></div>`
];

// ───────── Игра «Тир»: выпавшая серединка ─────────
function teensGame(root, L, ctx) {
  const ORDERS = L.orders;
  let i = 0, score = 0, streak = 0, best = 0, hits = 0, raf = 0, alive = true;
  const FUSE = { digit: 9000, ear: 10000 };
  function stopLoop() { cancelAnimationFrame(raf); raf = 0; }
  root.addEventListener('game:leave', () => { alive = false; stopLoop(); }, { once: true });
  ctx.intro(() => order());

  function order() {
    stopLoop();
    const o = ORDERS[i], answer = TEENS[o.n].top, word = teenWord(o.n);
    const showDigits = o.show === 'digit' || o.digits;
    ctx.clear();
    const hud = el('div', 'hud');
    hud.innerHTML = `<span class="score"><b>${score}</b> очков</span><span class="streak ${streak >= 2 ? 'hot' : ''}">серия ${streak}</span><span class="count">${i + 1} / ${ORDERS.length}</span>`;
    root.appendChild(hud);

    // задача: слово с дыркой посередине — сразу видно, чего не хватает
    const task = el('div', 'task');
    task.innerHTML = `<p class="task-line">Сбей мишень с серединкой слова</p>
      <div class="gapword"><span class="gw c-navy"><b lang="ka">თ</b><i>т</i></span><span class="gw hole"><b>?</b><i>${o.show === 'digit' ? '' : 'что слышно?'}</i></span><span class="gw c-gold"><b lang="ka">მეტი</b><i>мэт’и</i></span></div>
      <div class="task-sub">${o.show === 'digit' ? `<span class="eqline"><b>${o.n}</b> = 10 + <span class="q">?</span></span>` : `<span class="eqline soft">слушай</span>`}</div>`;
    const ear = el('button', 'ear' + (o.show === 'ear' ? ' loud' : ''), earIcon); ear.setAttribute('aria-label', 'Послушать');
    ear.onclick = () => { say(o.n); buzz('soft'); };
    task.querySelector('.task-sub').appendChild(ear);
    root.appendChild(task);
    phaseTip(task, o.tip);
    setTimeout(() => alive && say(o.n), 350);
    const fuse = el('div', 'fuse', '<i></i>'); root.appendChild(fuse);

    // мишени: в первых раундах стоят на месте, потом едут всё быстрее
    const range = el('div', 'range' + (o.still ? ' still' : ''));
    const others = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(n => n !== answer).sort(() => Math.random() - .5);
    const mk = (n, k, li) => {
      const t = el('button', 'target');
      t.dataset.n = n;
      t.style.animationDelay = (k % 5) * 60 + li * 120 + 'ms';
      t.innerHTML = `<span class="disc"><b lang="ka">${stem(n).ka}</b><span class="tr">${cyr(stem(n).ka)}</span>${showDigits ? `<span class="d">${n}</span>` : ''}</span><span class="stick"></span>`;
      t.setAttribute('aria-label', stem(n).ka);
      t.addEventListener('pointerdown', e => { e.preventDefault(); shoot(t, n); });
      return t;
    };
    let lanes = [];
    if (o.still) {
      const set = [answer, ...others.slice(0, 3)].sort(() => Math.random() - .5);
      const lane = el('div', 'lane'); const track = el('div', 'track static'); lane.append(track, el('div', 'shelf'));
      set.forEach((n, k) => track.appendChild(mk(n, k, 0)));
      range.appendChild(lane);
    } else {
      const sets = [others.slice(0, 4), others.slice(4, 8)];
      sets[Math.random() < .5 ? 0 : 1].splice(Math.floor(Math.random() * 4), 0, answer);
      lanes = sets.map((set, li) => {
        const lane = el('div', 'lane'); const track = el('div', 'track'); lane.append(track, el('div', 'shelf'));
        [...set, ...set, ...set].forEach((n, k) => track.appendChild(mk(n, k, li)));
        range.appendChild(lane);
        return { track, dir: li ? -1 : 1, off: Math.random() * 300 };
      });
    }
    root.appendChild(range);
    const foot = el('div', 'foot'); root.appendChild(foot);

    let done = false, t0 = performance.now(), last = t0, period = 0, hinted = false;
    const fuseBar = fuse.firstChild;
    function loop(now) {
      if (!alive) return;
      const dt = Math.min(50, now - last) / 1000; last = now;
      if (lanes.length) {
        if (!period) period = lanes[0].track.scrollWidth / 3 || 400;
        for (const Ln of lanes) {
          Ln.off = (Ln.off + Ln.dir * o.speed * dt + period) % period;
          Ln.track.style.transform = `translateX(${-Ln.off}px)`;
        }
      }
      if (!done) {
        const left = 1 - (now - t0) / FUSE[o.show];
        fuseBar.style.transform = `scaleX(${Math.max(0, left)})`;
        fuse.classList.toggle('low', left < .3);
        // в самом первом раунде, если игрок медлит, нужная мишень подмигивает
        if (i === 0 && !hinted && now - t0 > 3000) { hinted = true; range.querySelectorAll(`.target[data-n="${answer}"]`).forEach(t => t.classList.add('wink')); }
        if (left <= 0) timeout();
      }
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    function shoot(t, n) {
      if (done || t.classList.contains('down')) return;
      const [x, y] = centerOf(t);
      n === answer ? hit(t, x, y) : miss(t, x, y);
    }
    function miss(t, x, y) {
      streak = 0; setHud(hud, score, streak); sfx.bad(); buzz('bad');
      t.classList.add('down'); flash(x, y, 'мимо', 'bad');
      t0 -= 1500; // промах съедает фитиль
    }
    async function hit(t, x, y) {
      done = true; hits++; streak++; best = Math.max(best, streak);
      const gain = 100 + Math.round(100 * Math.max(0, 1 - (performance.now() - t0) / FUSE[o.show])) + (streak >= 3 ? 50 : 0);
      score += gain; setHud(hud, score, streak);
      sfx.snap(); buzz('snap'); burst(x, y, ['var(--gold-fill)', 'var(--ruby)', '#fff']);
      flash(x, y, '+' + gain, 'good');
      t.classList.add('down');
      const hole = task.querySelector('.hole');
      const ghost = el('span', 'flying', `<b lang="ka">${stem(answer).ka}</b>`);
      ghost.style.left = x + 'px'; ghost.style.top = y + 'px'; (layer || document.body).appendChild(ghost);
      const [hx, hy] = centerOf(hole);
      requestAnimationFrame(() => { ghost.style.transform = `translate(${hx - x}px, ${hy - y}px) scale(1.2)`; });
      await wait(380); ghost.remove();
      fill(hole, false);
      sfx.whoosh(); buzz('pop');
      await wait(200);
      finishOrder(true);
    }
    function fill(hole, late) {
      hole.className = 'gw c-ruby filled' + (late ? ' late' : '');
      hole.innerHTML = `<b lang="ka">${stem(answer).ka}</b><i>${cyr(stem(answer).ka)}</i>`;
      task.querySelector('.task-sub').innerHTML = `<span class="eqline"><b>${o.n}</b> = 10 + <b class="c-ruby">${answer}</b></span>`;
    }
    function timeout() {
      done = true; streak = 0; setHud(hud, score, streak);
      sfx.bad(); buzz('bad');
      range.querySelectorAll(`.target[data-n="${answer}"]`).forEach(t => t.classList.add('wink'));
      fill(task.querySelector('.hole'), true);
      finishOrder(false);
    }
    async function finishOrder(ok) {
      task.querySelector('.gapword').classList.add('done');
      foot.appendChild(el('div', 'whole', `<b lang="ka">${word}</b><span>${cyr(word)}</span>`));
      if (!ok) foot.prepend(el('p', 'hint', 'Фитиль догорел. Вот правильная серединка:'));
      say(o.n); if (ok) sfx.good();
      await wait(ok ? 1400 : 2200);
      if (!alive) return;
      i++; i < ORDERS.length ? order() : finish();
    }
  }
  function finish() {
    stopLoop();
    const t = el('div', 'teen-table');
    for (let n = 11; n <= 19; n++) {
      const row = el('button', 'teen-row' + (TEENS[n].final ? ' hoolie' : ''));
      row.innerHTML = `<span class="d">${n}</span><b lang="ka">${teenWord(n)}</b><span class="tr">${TEENS[n].final ? 'хулиган · ' : ''}${cyr(teenWord(n))}</span>`;
      row.onclick = () => { say(n); buzz('tap'); };
      t.appendChild(row);
    }
    ctx.done({
      title: `${score} очков`,
      text: `Попаданий ${hits} из ${ORDERS.length}, лучшая серия ${best}. По правилу собираются 11, 12, 14, 15 и 16. Четыре жёлтых — хулиганы, ими займёмся на следующем уровне.`,
      extra: t, again: () => { i = 0; score = 0; streak = 0; best = 0; hits = 0; order(); }
    });
  }
}

// ───────── Игра «Рынок»: слово → число ─────────
const FACES = ['#E9B48A', '#C98E62', '#F1C9A5', '#A8714A', '#E3A97C'];
const PATIENCE = { color: 22000, word: 22000, ear: 26000 };
function mandGame(root, L, ctx) {
  const CUSTOMERS = L.customers;
  let i = 0, lari = 0, served = 0, alive = true;
  root.addEventListener('game:leave', () => { alive = false; }, { once: true });
  ctx.intro(() => customer());

  function customer() {
    const c = CUSTOMERS[i], n = c.n, word = numWord(n);
    ctx.clear();
    const hud = el('div', 'hud');
    hud.innerHTML = `<span class="score"><b>${lari}</b> лари</span><span class="count">покупатель ${i + 1} / ${CUSTOMERS.length}</span>`;
    root.appendChild(hud);

    const who = el('div', 'buyer');
    who.innerHTML = `<div class="face" style="--skin:${FACES[i % FACES.length]}"><i class="eye l"></i><i class="eye r"></i><i class="mouth"></i></div>`;
    const bubble = el('div', 'bubble');
    const colored = twenties(n).map(p => `<span class="c-${p.c}">${p.ka}</span>`).join('');
    bubble.innerHTML = c.show === 'ear'
      ? `<span class="b-small">Мне, пожалуйста…</span><span class="b-ear">нажми и послушай</span>`
      : `<span class="b-small">Мне, пожалуйста,</span><b lang="ka">${c.show === 'color' ? colored : word}</b><span class="b-tr">${cyr(word)}</span>`;
    const ear = el('button', 'ear' + (c.show === 'ear' ? ' loud' : ''), earIcon); ear.setAttribute('aria-label', 'Послушать заказ');
    ear.onclick = () => { say(n); buzz('soft'); };
    bubble.appendChild(ear);
    who.appendChild(bubble);
    root.appendChild(who);
    phaseTip(root, c.tip);
    setTimeout(() => alive && say(n), 350);
    const patience = el('div', 'fuse patience', '<i></i>'); root.appendChild(patience);

    const counter = el('div', 'counter');
    counter.innerHTML = `<div class="pile"></div><div class="total"><span class="t-num">0</span><span class="t-cap">на прилавке</span></div>`;
    root.appendChild(counter);
    const pile = counter.querySelector('.pile'), tNum = counter.querySelector('.t-num');

    const stock = el('div', 'stock');
    const ITEMS = [
      { v: 20, cls: 'box', label: 'Ящик', sub: '20 · <span lang="ka">ოცი</span>' },
      { v: 10, cls: 'bag', label: 'Пакет', sub: '10 · <span lang="ka">ათი</span>' },
      { v: 1, cls: 'one', label: 'Штука', sub: '1 · <span lang="ka">ერთი</span>' }
    ];
    let boxes = 0, bags = 0, ones = 0, done = false;
    const total = () => boxes * 20 + bags * 10 + ones;
    ITEMS.forEach(it => {
      const b = el('button', 'item ' + it.cls);
      b.innerHTML = `<span class="pic"></span><span class="i-label">${it.label}</span><span class="i-sub">${it.sub}</span><span class="plus-badge">+${it.v}</span>`;
      b.addEventListener('pointerdown', e => {
        e.preventDefault(); if (done) return;
        if (total() + it.v > 99) { sfx.bad(); buzz('bad'); return; }
        if (it.v === 20) boxes++; else if (it.v === 10) bags++; else ones++;
        b.classList.remove('press'); void b.offsetWidth; b.classList.add('press');
        it.v === 20 ? (sfx.snap(), buzz('snap')) : it.v === 10 ? (tone(260, .12, 'sine', .18, 120), buzz('pop')) : (sfx.tick(ones - 1), buzz('tap'));
        render(it.cls);
      });
      stock.appendChild(b);
    });
    root.appendChild(stock);

    const actions = el('div', 'cta-row');
    const clear = el('button', 'cta ghost', 'Убрать всё');
    const give = el('button', 'cta', 'Отдать');
    clear.onclick = () => { if (done) return; boxes = bags = ones = 0; render(); buzz('soft'); };
    give.onclick = () => handOver();
    actions.append(clear, give); root.appendChild(actions);
    const foot = el('div', 'foot'); root.appendChild(foot);

    function render(added) {
      pile.innerHTML = '';
      for (let k = 0; k < boxes; k++) pile.appendChild(el('i', 'p-box' + (added === 'box' && k === boxes - 1 ? ' new' : '')));
      for (let k = 0; k < bags; k++) pile.appendChild(el('i', 'p-bag' + (added === 'bag' && k === bags - 1 ? ' new' : '')));
      for (let k = 0; k < ones; k++) pile.appendChild(el('i', 'p-one' + (added === 'one' && k === ones - 1 ? ' new' : '')));
      tNum.textContent = total();
      give.disabled = total() === 0;
    }
    render();

    const t0 = performance.now(); const bar = patience.firstChild;
    (function tick(now) {
      if (!alive || done) return;
      const left = 1 - (now - t0) / PATIENCE[c.show];
      bar.style.transform = `scaleX(${Math.max(0, left)})`;
      patience.classList.toggle('low', left < .3);
      who.classList.toggle('impatient', left < .3);
      if (left <= 0) { leave(); return; }
      requestAnimationFrame(tick);
    })(t0);

    function handOver() {
      if (done) return;
      const t = total();
      if (t !== n) {
        sfx.bad(); buzz('bad');
        who.classList.remove('no'); void who.offsetWidth; who.classList.add('no');
        foot.innerHTML = `<p class="why">Ты даёшь <b lang="ka">${numWord(t)}</b> (${cyr(numWord(t))}) — это ${t}. ${t < n ? 'Мало.' : 'Много.'} Послушай ещё раз и посчитай ящики.</p>`;
        setTimeout(() => alive && say(n), 500);
        return;
      }
      done = true; served++;
      const tip = Math.max(0, Math.round(5 * (1 - (performance.now() - t0) / PATIENCE[c.show])));
      lari += 3 + tip; setHud(hud, lari);
      who.classList.add('happy'); sfx.good(); buzz('good');
      const [x, y] = centerOf(who.querySelector('.face')); burst(x, y, ['var(--gold-fill)', 'var(--orange)', 'var(--leaf)']);
      explain(true, tip);
    }
    function leave() { done = true; sfx.bad(); buzz('bad'); who.classList.add('gone'); explain(false, 0); }
    function explain(ok, tip) {
      stock.classList.add('quiet'); actions.remove();
      foot.innerHTML = '';
      if (!ok) foot.appendChild(el('p', 'hint', 'Покупатель не дождался. Вот как разбирается его заказ:'));
      foot.appendChild(segments(twenties(n)));
      const k = n % 20, b = Math.floor(n / 20);
      foot.appendChild(el('p', 'eqn', `${b} ${plural(b, 'ящик', 'ящика', 'ящиков')} × 20${k ? ' + ' + k : ''} = ${n}`));
      if (k > 10) foot.appendChild(el('p', 'note', `${k} — «десять и сверху»: пакет и ${k - 10} ${plural(k - 10, 'штука', 'штуки', 'штук')}.`));
      if (ok) foot.appendChild(el('p', 'tipline', `+3 лари${tip ? ' и ' + tip + ' на чай за скорость' : ''}`));
      say(n);
      const next = el('button', 'cta', i + 1 < CUSTOMERS.length ? 'Следующий покупатель' : 'Закрыть лавку');
      next.onclick = () => { buzz('tap'); i++; i < CUSTOMERS.length ? customer() : finish(); };
      foot.appendChild(next);
    }
  }
  function finish() {
    const t = el('div', 'teen-table');
    [20, 40, 60, 80].forEach(n => {
      const w = twenties(n)[0].ka;
      const row = el('button', 'teen-row');
      row.innerHTML = `<span class="d">${n}</span><b lang="ka">${w}</b><span class="tr">${cyr(w)} · ${BOXRU[n / 20]}</span>`;
      row.onclick = () => { say(n); buzz('tap'); };
      t.appendChild(row);
    });
    ctx.done({ title: `${lari} лари за день`, text: `Обслужено ${served} из ${CUSTOMERS.length}. Ящиков всего четыре вида — запомни их:`, extra: t,
      again: () => { i = 0; lari = 0; served = 0; customer(); } });
  }
}

// ───────── Игра «Ценники»: число → слово ─────────
const PIECES = {
  oc: { ka: 'ოც', m: '20', c: 'navy' }, oci: { ka: 'ოცი', m: 'ровно 20', c: 'navy' },
  ormoc: { ka: 'ორმოც', m: '2 × 20', c: 'navy' }, samoc: { ka: 'სამოც', m: '3 × 20', c: 'navy' }, otxmoc: { ka: 'ოთხმოც', m: '4 × 20', c: 'navy' },
  i: { ka: 'ი', m: 'хвостик', c: 'navy' }, da: { ka: 'და', m: 'и', c: 'gold' },
  t: { ka: 'თ', m: '10', c: 'ruby' }, meti: { ka: 'მეტი', m: 'сверху', c: 'ruby' }, ati: { ka: 'ათი', m: '10', c: 'ruby' },
  or: { ka: 'ორ', m: '2', c: 'ruby' }, ori: { ka: 'ორი', m: '2', c: 'ruby' }, ert: { ka: 'ერთ', m: '1', c: 'ruby' }, erti: { ka: 'ერთი', m: '1', c: 'ruby' },
  sam: { ka: 'სამ', m: '3', c: 'ruby' }, sami: { ka: 'სამი', m: '3', c: 'ruby' },
  otx: { ka: 'ოთხ', m: '4', c: 'ruby' }, otxi: { ka: 'ოთხი', m: '4', c: 'ruby' },
  xut: { ka: 'ხუთ', m: '5', c: 'ruby' }, xuti: { ka: 'ხუთი', m: '5', c: 'ruby' },
  eqvs: { ka: 'ექვს', m: '6', c: 'ruby' }, eqvsi: { ka: 'ექვსი', m: '6', c: 'ruby' },
  shvid: { ka: 'შვიდ', m: '7', c: 'ruby' }, shvidi: { ka: 'შვიდი', m: '7', c: 'ruby' },
  vra: { ka: 'ვრა', m: '8', c: 'ruby' }, rva: { ka: 'რვა', m: '8', c: 'ruby' },
  cxra: { ka: 'ცხრა', m: '9', c: 'ruby' }, cxra2: { ka: 'თცხრა', m: '10 + 9', c: 'ruby' },
  ca: { ka: 'ცა', m: 'т + сам', c: 'ruby' }, chvid: { ka: 'ჩვიდ', m: 'т + швид', c: 'ruby' }
};
// почему ловушка — ловушка; у хулиганов своё объяснение для лишней თ
const WHY = {
  oci: '<b lang="ka">ოცი</b> с хвостиком <b lang="ka">ი</b> — это ровно 20. Если дальше идёт <b lang="ka">და</b>, хвостик отпадает: <b lang="ka">ოც</b> + <b lang="ka">და</b>.',
  samoc: '<b lang="ka">სამოც</b> — «три двадцать», это 60, а не 30.',
  otxmoc: '<b lang="ka">ოთხმოც</b> — «четыре двадцать», это 80. Сорок — два ящика: <b lang="ka">ორმოც</b>.',
  ormoc: '<b lang="ka">ორმოც</b> — два ящика, 40. Посчитай ящики по 20 ещё раз.',
  ati: 'Внутри 11–19 десятка — одна буква <b lang="ka">თ</b>, а не целое <b lang="ka">ათი</b>.',
  ori: 'Внутри слова двойка теряет хвост: <b lang="ka">თ</b> + <b lang="ka">ორ</b> + <b lang="ka">მეტი</b>.',
  erti: 'Внутри слова единица теряет хвост: <b lang="ka">თ</b> + <b lang="ka">ერთ</b> + <b lang="ka">მეტი</b>.',
  otxi: 'Внутри слова четвёрка теряет хвост: <b lang="ka">ოთხ</b>, без <b lang="ka">ი</b>.',
  xuti: 'Внутри 11–19 пятёрка теряет хвост: <b lang="ka">ხუთ</b>, без <b lang="ka">ი</b>.',
  eqvsi: 'Внутри 11–19 шестёрка теряет хвост: <b lang="ka">ექვს</b>, без <b lang="ka">ი</b>. А 64 — это 60 и 4, не 6.',
  shvid: 'Хулиган 17: <b lang="ka">თ</b> и <b lang="ka">შ</b> слиплись в <b lang="ka">ჩ</b> — <b lang="ka">ჩვიდ</b> + <b lang="ka">მეტი</b>.',
  sam: 'Хулиган 13: <b lang="ka">თ</b> и <b lang="ka">ს</b> слиплись в <b lang="ka">ც</b> — <b lang="ka">ცა</b> + <b lang="ka">მეტი</b>.',
  ca: '<b lang="ka">ცა</b> бывает только в 13. Здесь число собирается по правилу.',
  rva: 'Хулиган 18: <b lang="ka">რვა</b> переворачивается в <b lang="ka">ვრა</b> — т + вра + мэт’и.',
  cxra2: 'Хулиган 19: <b lang="ka">თ</b> прячется в <b lang="ka">ც</b>, остаётся <b lang="ka">ცხრა</b> + <b lang="ka">მეტი</b>.',
  da: 'Круглому числу <b lang="ka">და</b> не нужен — после ящиков ничего не остаётся, хватит хвостика <b lang="ka">ი</b>.',
  i: 'Хвостик <b lang="ka">ი</b> ставится только у круглого числа. Если дальше <b lang="ka">და</b>, его нет.'
};
const WHY_T = {
  13: 'Хулиган 13: <b lang="ka">თ</b> и <b lang="ka">ს</b> слиплись в <b lang="ka">ც</b>. Отдельной <b lang="ka">თ</b> нет: <b lang="ka">ცა</b> + <b lang="ka">მეტი</b>.',
  17: 'Хулиган 17: <b lang="ka">თ</b> и <b lang="ka">შ</b> слиплись в <b lang="ka">ჩ</b>. Отдельной <b lang="ka">თ</b> нет: <b lang="ka">ჩვიდ</b> + <b lang="ka">მეტი</b>.',
  19: 'Хулиган 19: <b lang="ka">თ</b> прячется в <b lang="ka">ც</b>. Отдельной <b lang="ka">თ</b> нет: <b lang="ka">ცხრა</b> + <b lang="ka">მეტი</b>.'
};
// кусок по ключу; в «буквенных» уровнях куски — просто буквы слова
const pieceOf = k => PIECES[k] || { ka: k, m: cyr(k), c: 'ruby' };
function letterTraps(n, count) {
  const own = new Set(WORDS[n]);
  return LETTERS10.filter(c => !own.has(c)).sort(() => Math.random() - .5).slice(0, count);
}
function tagsGame(root, L, ctx) {
  const TAGS = L.tags.map(t => L.letters ? { ...t, parts: [...WORDS[t.n]], traps: letterTraps(t.n, t.hint ? 2 : 3) } : t);
  let i = 0, lari = 0, streak = 0, best = 0, clean = 0, alive = true;
  root.addEventListener('game:leave', () => { alive = false; }, { once: true });
  ctx.intro(() => tag());

  function tag() {
    const t = TAGS[i], n = t.n;
    let tries = 0, done = false;
    ctx.clear();
    const hud = el('div', 'hud');
    hud.innerHTML = `<span class="score"><b>${lari}</b> лари</span><span class="streak ${streak >= 2 ? 'hot' : ''}">серия ${streak}</span><span class="count">${i + 1} / ${TAGS.length}</span>`;
    root.appendChild(hud);

    const row = el('div', 'tagrow');
    const sideHint = L.letters ? (t.hint ? ASSOC[n].line : t.ear ? 'Послушай и собери слово по буквам' : 'Вспомни слово и собери по буквам')
      : n < 20 ? 'Десятка и сверху — или хулиган?' : 'Сколько ящиков по 20 и что остаётся?';
    row.innerHTML = `${t.ear ? '<div class="ptag ear-tag"><small>слушай</small></div>' : `<div class="ptag"><small>цена</small><span class="big">${n}</span></div>`}
      <div class="side"><b>${L.letters ? 'Собери слово по буквам' : 'Собери слово для цены'}</b><span>${sideHint}</span></div>`;
    root.appendChild(row);
    if (t.ear) {
      const ear = el('button', 'ear loud', earIcon); ear.setAttribute('aria-label', 'Послушать');
      ear.onclick = () => { say(n); buzz('soft'); };
      row.querySelector('.ear-tag').appendChild(ear);
      setTimeout(() => alive && say(n), 350);
    }
    phaseTip(root, t.tip);
    const fuse = el('div', 'fuse', '<i></i>'); root.appendChild(fuse);
    const line = el('div', 'line'); line.dataset.empty = 'Нажимай на куски по порядку';
    root.appendChild(line);
    const why = el('div', 'foot'); root.appendChild(why);

    const pieces = el('div', 'pieces');
    [...t.parts, ...t.traps].sort(() => Math.random() - .5).forEach((k, idx) => {
      const p = pieceOf(k);
      const b = el('button', 'piece' + (L.letters ? ' letter' : ''));
      b.dataset.k = k;
      b.innerHTML = L.letters ? `<b lang="ka">${p.ka}</b>${t.hint ? `<span class="tr">${cyr(p.ka)}</span>` : ''}`
        : `<b lang="ka">${p.ka}</b><span class="tr">${cyr(p.ka)}</span>${t.hint ? `<span class="mean">${p.m}</span>` : ''}`;
      b.style.animationDelay = idx * 40 + 'ms';
      b.addEventListener('pointerdown', e => { e.preventDefault(); place(b, k); });
      pieces.appendChild(b);
    });
    root.appendChild(pieces);

    const actions = el('div', 'cta-row');
    const reset = el('button', 'cta ghost', 'Сбросить');
    const hang = el('button', 'cta', 'Повесить ценник'); hang.disabled = true;
    reset.onclick = () => { if (done) return; [...line.children].forEach(c => unplace(c)); buzz('soft'); };
    hang.onclick = () => check();
    actions.append(reset, hang); root.appendChild(actions);

    function place(src, k) {
      if (done || src.classList.contains('gone')) return;
      const [x0, y0] = centerOf(src);
      const p = pieceOf(k);
      const chip = el('button', 'piece c-' + p.c + (L.letters ? ' letter' : ''));
      chip.dataset.k = k;
      chip.innerHTML = `<b lang="ka">${p.ka}</b>${L.letters && !t.hint ? '' : `<span class="tr">${cyr(p.ka)}</span>`}`;
      chip.addEventListener('pointerdown', e => { e.preventDefault(); if (!done) { unplace(chip); buzz('soft'); } });
      chip._src = src;
      line.appendChild(chip);
      src.classList.add('gone');
      const [x1, y1] = centerOf(chip);
      if (!reduced()) chip.animate([{ transform: `translate(${x0 - x1}px, ${y0 - y1}px) scale(.9)` }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.3,.7,.4,1)' });
      sfx.tick(line.children.length - 1); buzz('tap');
      clearErr(); hang.disabled = false;
    }
    function unplace(chip) { chip._src.classList.remove('gone'); chip.remove(); clearErr(); hang.disabled = !line.children.length; }
    function clearErr() { line.classList.remove('err'); line.querySelectorAll('.bad').forEach(c => c.classList.remove('bad')); }

    const t0 = performance.now(); let penalty = 0;
    const bar = fuse.firstChild;
    (function tick(now) {
      if (!alive || done) return;
      const left = 1 - (now - t0 + penalty) / L.time;
      bar.style.transform = `scaleX(${Math.max(0, left)})`;
      fuse.classList.toggle('low', left < .3);
      if (left <= 0) { reveal(false); return; }
      requestAnimationFrame(tick);
    })(t0);

    function check() {
      if (done) return;
      const got = [...line.children].map(c => c.dataset.k);
      if (got.join() === t.parts.join()) return win();
      tries++; streak = 0; penalty += 4000; setHud(hud, lari, streak);
      sfx.bad(); buzz('bad');
      line.classList.remove('err'); void line.offsetWidth; line.classList.add('err');
      // первое место, где слово разошлось с правильным
      const at = got.findIndex((k, j) => k !== t.parts[j]);
      const bad = at >= 0 ? line.children[at] : null;
      if (bad) bad.classList.add('bad');
      const k = bad?.dataset.k;
      const msg = L.letters ? (at < 0 ? 'Не хватает букв в конце.' : 'Здесь другая буква.') + ` Подсказка: ${ASSOC[n].line.replace(/<\/?u>/g, '')}.`
        : k === 't' && WHY_T[n % 20] ? WHY_T[n % 20]
        : k && WHY[k] && !t.parts.includes(k) ? WHY[k]
        : at < 0 ? 'Слово не дособрано — чего-то не хватает в конце.'
        : t.parts.includes(k) ? 'Кусок верный, но не на своём месте. Порядок: ящики → <b lang="ka">და</b> → остаток.'
        : 'Этот кусок здесь лишний.';
      why.innerHTML = ''; why.appendChild(el('p', 'why', msg));
      if (tries >= 2) setTimeout(() => alive && !done && reveal(false), 1600);
    }
    function win() {
      done = true; streak++; best = Math.max(best, streak); if (!tries) clean++;
      const left = Math.max(0, 1 - (performance.now() - t0 + penalty) / L.time);
      const gain = 3 + Math.round(5 * left) + (streak >= 3 ? 2 : 0);
      lari += gain; setHud(hud, lari, streak);
      line.classList.add('ok'); sfx.good(); buzz('good');
      const [x, y] = centerOf(line); burst(x, y, ['var(--gold-fill)', 'var(--leaf)', 'var(--navy)']);
      flash(x, y - 40, '+' + gain + ' лари', 'good');
      say(n); explain(true);
    }
    function reveal(ok) {
      done = true; streak = 0; sfx.bad(); buzz('bad'); setHud(hud, lari, streak);
      line.innerHTML = '';
      t.parts.forEach(k => { const p = pieceOf(k); line.appendChild(el('span', 'piece c-' + p.c, `<b lang="ka">${p.ka}</b><span class="tr">${cyr(p.ka)}</span>`)); });
      line.classList.remove('err'); line.classList.add('ok');
      say(n); explain(ok);
    }
    function explain(ok) {
      pieces.classList.add('quiet'); actions.remove();
      const word = numWord(n);
      why.innerHTML = '';
      if (!ok) why.appendChild(el('p', 'hint', tries >= 2 ? 'Вот как собирается это слово:' : 'Время вышло. Вот как собирается это слово:'));
      why.appendChild(el('div', 'whole', `<b lang="ka">${word}</b><span>${cyr(word)}</span>`));
      const b = Math.floor(n / 20), k = n % 20;
      why.appendChild(n <= 10 ? el('p', 'note', `${n} — ${ASSOC[n].line}`) : el('p', 'eqn', n < 20 ? `${n} = 10 + ${n - 10}` : `${b} × 20${k ? ' + ' + k : ''} = ${n}`));
      const next = el('button', 'cta', i + 1 < TAGS.length ? 'Следующий ценник' : 'Посчитать выручку');
      next.onclick = () => { buzz('tap'); i++; i < TAGS.length ? tag() : finish(); };
      why.appendChild(next);
    }
  }
  function finish() {
    ctx.done({ title: `${lari} лари выручки`, text: `С первого раза — ${clean} из ${TAGS.length}, лучшая серия ${best}.`,
      again: () => { i = 0; lari = 0; streak = 0; best = 0; clean = 0; tag(); } });
  }
}

const EXPLORE = [learnExplore([1, 2, 3]), learnExplore([4, 5, 6]), learnExplore([7, 8, 9, 10]), null,
  teensExplore, hooliganExplore, boxesExplore('round'), twentyPlusExplore, boxesExplore('big'), null];
const EX_TITLE = ['Один, два, три', 'Четыре, пять, шесть', 'Семь, восемь, девять, десять', null,
  'Как устроены 11–19', 'Четыре хулигана', 'Как считают ящиками', 'Двадцать и ещё', 'Любое число до 99', null];
// ───────── Карта уровней ─────────
const GAMES = { letters: lettersGame, teens: teensGame, mand: mandGame, tags: tagsGame, rocket: rocketGame };
const KIND_ICON = {
  rocket: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c4 3.5 5 8 4.4 13H7.6C7 10.5 8 6 12 2.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9.5 18.5L12 22l2.5-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="10" r="1.8" fill="currentColor"/></svg>',
  teens: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/></svg>',
  mand: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13.5" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 6.5c.5-2 2-3 4-3-.3 2-1.8 3.2-4 3z" fill="currentColor"/></svg>',
  tags: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1 1 0 0 1 0 1.4l-7.3 7.3a1 1 0 0 1-1.4 0z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="8" cy="8" r="1.6" fill="currentColor"/></svg>'
};
// ───────── Вход: один уровень = один урок модуля ─────────
export const NUMBER_LEVELS = LEVELS.length;
// какие записи понадобятся уровню: первые уровни — только 1–10, дальше — всё больше
const levelTop = k => (k < 4 ? 10 : k < 6 ? 19 : 99);

/**
 * Нарисовать уровень k (0..9) внутри host: объяснятор, игра, итог. onExit — «назад» из уровня,
 * onDone — игра пройдена (дальше урок показывает проверку). Возвращает уборку.
 */
export function mountLevel(host, k, { onExit, onDone }) {
  const L = LEVELS[k];
  const root = el('div', 'game g-' + L.game);
  host.appendChild(root);
  layer = host;
  const onDown = () => { void unlock(); };
  host.addEventListener('pointerdown', onDown, { capture: true });
  for (let n = 1; n <= levelTop(k); n++) fetchClip(n);
  if (ac) Object.keys(raw).forEach(n => decode(+n));

  const bar = el('div', 'levelbar');
  const back = el('button', 'back', backIcon + '<span>Назад</span>'); back.onclick = () => { buzz('tap'); onExit(); };
  bar.append(back, el('span', 'lvl-title', `<span>Уровень ${k + 1}</span> · ${L.name}`));
  const ctx = {
    clear() { root.innerHTML = ''; root.appendChild(bar); },
    intro(start) {
      ctx.clear();
      window.scrollTo(0, 0);
      const s = el('section', 'rule');
      if (EXPLORE[k]) {
        s.classList.add('explore');
        s.innerHTML = L.game === 'letters' ? '' : `<p class="eyebrow">Как это устроено · ${L.range}</p><h2>${EX_TITLE[k]}</h2>`;
        root.appendChild(s);
        let go = null;
        EXPLORE[k](s, label => {
          if (go) return;
          go = el('button', 'cta go-in', label); go.id = 'go';
          go.onclick = () => { buzz('tap'); start(); };
          s.appendChild(go); buzz('good');
        });
        return;
      }
      s.innerHTML = `<p class="eyebrow">${L.kind} · ${L.range}</p>` + INTROS[k];
      wireCards(s);
      const go = el('button', 'cta', 'Играть'); go.id = 'go';
      go.onclick = () => { buzz('tap'); start(); };
      s.appendChild(go); root.appendChild(s);
    },
    done({ title, text, extra, again }) {
      ctx.clear();
      window.scrollTo(0, 0);
      const s = el('section', 'rule');
      s.innerHTML = `<p class="eyebrow">Уровень ${k + 1}</p><h2>${title}</h2><p>${text}</p>`;
      if (extra) s.appendChild(extra);
      const a = el('button', 'cta ghost', 'Ещё раз'); a.onclick = () => { buzz('tap'); again(); };
      const nx = el('button', 'cta', 'Дальше'); nx.id = 'level-next';
      nx.onclick = () => { buzz('tap'); onDone(); };
      const r = el('div', 'cta-row'); r.append(a, nx); s.appendChild(r);
      root.appendChild(s);
      sfx.good();
    }
  };
  // кнопка «дальше» появляется под игрой; если она ушла за нижний край экрана — докручиваем к ней
  const reveal = new MutationObserver(muts => {
    const cta = muts.flatMap(m => [...m.addedNodes]).find(n => n.nodeType === 1 && (n.matches('.cta') || n.querySelector('.cta')));
    if (!cta) return;
    requestAnimationFrame(() => {
      const b = cta.matches('.cta') ? cta : cta.querySelector('.cta');
      if (b.getBoundingClientRect().bottom > window.innerHeight - 16) b.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  });
  reveal.observe(root, { childList: true, subtree: true });
  GAMES[L.game](root, L, ctx);
  return () => {
    reveal.disconnect();
    root.dispatchEvent(new Event('game:leave'));
    host.removeEventListener('pointerdown', onDown, { capture: true });
    root.remove();
    if (layer === host) layer = null;
  };
}
