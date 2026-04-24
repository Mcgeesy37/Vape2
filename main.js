/* ================================================
   OBSIDIAN — MAIN.JS
   The Vapor Sanctum · Full Legendary Engine
   ================================================ */

'use strict';

// ============================================
// UTILITIES
// ============================================
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (min, max) => Math.random() * (max - min) + min;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ============================================
// 1. LOADER
// ============================================
const loader    = $('#loader');
const loaderFill = $('#loaderFill');
const loaderPct  = $('#loaderPct');
let progress = 0;

const loaderInterval = setInterval(() => {
  progress += rand(2, 8);
  if (progress >= 100) {
    progress = 100;
    clearInterval(loaderInterval);
    setTimeout(() => {
      loader.classList.add('done');
      initCounters();
      startHeroAutoSlide();
    }, 400);
  }
  loaderFill.style.width = progress + '%';
  loaderPct.textContent  = Math.floor(progress) + '%';
}, 60);

// ============================================
// 2. SMOKE ENGINE — DUAL CANVAS
// ============================================
const bgCanvas = $('#bgCanvas');
const bgCtx    = bgCanvas.getContext('2d');
const fgCanvas = $('#fgCanvas');
const fgCtx    = fgCanvas.getContext('2d');

let CW = bgCanvas.width  = fgCanvas.width  = window.innerWidth;
let CH = bgCanvas.height = fgCanvas.height = window.innerHeight;

window.addEventListener('resize', () => {
  CW = bgCanvas.width  = fgCanvas.width  = window.innerWidth;
  CH = bgCanvas.height = fgCanvas.height = window.innerHeight;
}, { passive: true });

class SmokeCloud {
  constructor(cfg = {}) {
    this.x       = cfg.x   ?? rand(0, CW);
    this.y       = cfg.y   ?? CH + rand(20, 60);
    this.vx      = cfg.vx  ?? rand(-0.4, 0.4);
    this.vy      = cfg.vy  ?? -rand(0.3, 1.2);
    this.r       = cfg.r   ?? rand(40, 100);
    this.maxR    = cfg.maxR ?? this.r * rand(2, 4);
    this.opacity = 0;
    this.life    = 0;
    this.maxLife = cfg.maxLife ?? rand(250, 500);
    this.rot     = rand(0, Math.PI * 2);
    this.rotV    = rand(-0.005, 0.005);
    this.layer   = cfg.layer ?? 'bg';      // 'bg' or 'fg'
    this.burst   = cfg.burst ?? false;

    // Color: warm gold/cream palette
    const cols = [
      [210, 175, 90],
      [235, 210, 155],
      [180, 145, 70],
      [250, 235, 195],
      [155, 115, 50],
    ];
    const w = this.burst
      ? [0.5, 0.2, 0.15, 0.1, 0.05]
      : [0.3, 0.3, 0.2, 0.12, 0.08];
    let rnd = Math.random(), cum = 0;
    this.col = cols[0];
    for (let i = 0; i < cols.length; i++) {
      cum += w[i];
      if (rnd < cum) { this.col = cols[i]; break; }
    }
    this.peak = this.burst ? 0.28 : 0.12;
  }

  update() {
    this.life++;
    this.x  += this.vx + Math.sin(this.life * 0.02) * 0.3;
    this.y  += this.vy;
    this.vy *= 0.9985;
    this.r   = Math.min(this.r * 1.007, this.maxR);
    this.rot += this.rotV;
    const p = this.life / this.maxLife;
    this.opacity = p < 0.18
      ? (p / 0.18) * this.peak
      : (1 - (p - 0.18) / 0.82) * this.peak;
  }

  draw(ctx) {
    if (this.opacity < 0.002) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.scale(1, 0.65 + Math.sin(this.life * 0.025) * 0.12);
    const [r, g, b] = this.col;
    const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, this.r);
    gr.addColorStop(0,    `rgba(${r},${g},${b},${this.opacity})`);
    gr.addColorStop(0.4,  `rgba(${r},${g},${b},${this.opacity * 0.5})`);
    gr.addColorStop(0.75, `rgba(${r},${g},${b},${this.opacity * 0.15})`);
    gr.addColorStop(1,    `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(0, 0, this.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  dead() { return this.life >= this.maxLife || this.y < -this.r * 2; }
}

const bgClouds = [];
const fgClouds = [];
let smokeFrame = 0;

// Device tip position
function getDeviceTip() {
  const el = $('#hdTip');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top };
}

function spawnSmoke() {
  smokeFrame++;

  // BG: slow, massive ambient smoke across entire screen
  if (smokeFrame % 6 === 0) {
    for (let i = 0; i < 3; i++) {
      bgClouds.push(new SmokeCloud({ layer: 'bg' }));
    }
  }

  // Device tip: dense rising smoke
  if (smokeFrame % 2 === 0) {
    const tip = getDeviceTip();
    if (tip) {
      for (let i = 0; i < 4; i++) {
        fgClouds.push(new SmokeCloud({
          x: tip.x + rand(-10, 10),
          y: tip.y + rand(-5, 5),
          r: rand(8, 22),
          maxR: rand(50, 110),
          vy: -rand(1.2, 2.8),
          vx: rand(-0.6, 0.6),
          maxLife: rand(100, 200),
          layer: 'fg',
          burst: true,
        }));
      }
    }
  }

  // Prune
  if (bgClouds.length > 600) bgClouds.splice(0, 40);
  if (fgClouds.length > 500) fgClouds.splice(0, 40);
}

function renderSmoke() {
  bgCtx.clearRect(0, 0, CW, CH);
  fgCtx.clearRect(0, 0, CW, CH);
  spawnSmoke();

  for (let i = bgClouds.length - 1; i >= 0; i--) {
    bgClouds[i].update();
    bgClouds[i].draw(bgCtx);
    if (bgClouds[i].dead()) bgClouds.splice(i, 1);
  }
  for (let i = fgClouds.length - 1; i >= 0; i--) {
    fgClouds[i].update();
    fgClouds[i].draw(fgCtx);
    if (fgClouds[i].dead()) fgClouds.splice(i, 1);
  }
  requestAnimationFrame(renderSmoke);
}
renderSmoke();

// Public burst function
function smokeBurst(x, y, count = 20, strong = true) {
  for (let i = 0; i < count; i++) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(0.8, strong ? 3.5 : 1.5);
    fgClouds.push(new SmokeCloud({
      x: x + rand(-20, 20),
      y: y + rand(-10, 10),
      r: rand(6, strong ? 24 : 14),
      maxR: rand(40, strong ? 130 : 70),
      vy: -Math.abs(Math.sin(angle) * speed),
      vx: Math.cos(angle) * speed * 0.6,
      maxLife: rand(80, strong ? 220 : 140),
      layer: 'fg',
      burst: true,
    }));
  }
}

// ============================================
// 3. CUSTOM CURSOR
// ============================================
const cursorRing = $('#cursorRing');
const cursorDot  = $('#cursorDot');
const cursorText = $('#cursorText');

let mx = -999, my = -999;
let rx = -999, ry = -999;
let isHovering = false;

document.addEventListener('mousemove', (e) => {
  mx = e.clientX;
  my = e.clientY;
  cursorDot.style.left = mx + 'px';
  cursorDot.style.top  = my + 'px';
  cursorText.style.left = (mx + 28) + 'px';
  cursorText.style.top  = (my - 14) + 'px';
}, { passive: true });

function animateCursor() {
  rx = lerp(rx, mx, 0.12);
  ry = lerp(ry, my, 0.12);
  cursorRing.style.left = rx + 'px';
  cursorRing.style.top  = ry + 'px';
  requestAnimationFrame(animateCursor);
}
animateCursor();

// Set cursor text on hover
document.addEventListener('mouseover', (e) => {
  const el = e.target.closest('[data-cursor]');
  const txt = el?.dataset.cursor || '';
  if (txt) {
    cursorText.textContent = txt;
    cursorText.classList.add('show');
    cursorRing.classList.add('expanded');
  } else {
    cursorText.classList.remove('show');
    cursorRing.classList.remove('expanded');
  }
});

// Smoke trail on fast mouse move
let lastMX = 0, lastMY = 0, trailFrame = 0;
document.addEventListener('mousemove', (e) => {
  const dx = e.clientX - lastMX;
  const dy = e.clientY - lastMY;
  const speed = Math.sqrt(dx*dx + dy*dy);
  trailFrame++;
  if (speed > 18 && trailFrame % 3 === 0) {
    fgClouds.push(new SmokeCloud({
      x: e.clientX,
      y: e.clientY,
      r: rand(4, 10),
      maxR: rand(20, 50),
      vy: -rand(0.3, 0.9),
      vx: -dx * 0.05 + rand(-0.3, 0.3),
      maxLife: rand(40, 80),
      layer: 'fg',
      burst: false,
    }));
  }
  lastMX = e.clientX; lastMY = e.clientY;
}, { passive: true });

// Click burst
document.addEventListener('click', (e) => {
  smokeBurst(e.clientX, e.clientY, 16, true);
}, { passive: true });

// ============================================
// 4. HERO SLIDER
// ============================================
const slides  = $$('.hero-slide');
const scBtns  = $$('.sc-btn');
let curSlide  = 0;
let autoTimer = null;

function goToSlide(idx) {
  slides[curSlide].classList.remove('active');
  scBtns[curSlide].classList.remove('active');
  curSlide = (idx + slides.length) % slides.length;
  slides[curSlide].classList.add('active');
  scBtns[curSlide].classList.add('active');
}

function startHeroAutoSlide() {
  autoTimer = setInterval(() => goToSlide(curSlide + 1), 6000);
}

$('#slideNext')?.addEventListener('click', () => {
  clearInterval(autoTimer);
  goToSlide(curSlide + 1);
  startHeroAutoSlide();
  smokeBurst(window.innerWidth / 2, window.innerHeight / 2, 10, false);
});
$('#slidePrev')?.addEventListener('click', () => {
  clearInterval(autoTimer);
  goToSlide(curSlide - 1);
  startHeroAutoSlide();
  smokeBurst(window.innerWidth / 2, window.innerHeight / 2, 10, false);
});
scBtns.forEach((btn, i) => {
  btn.addEventListener('click', () => {
    clearInterval(autoTimer);
    goToSlide(i);
    startHeroAutoSlide();
  });
});

// ============================================
// 5. NAVBAR
// ============================================
const nav = $('#nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('solid', window.scrollY > 80);
}, { passive: true });

// ============================================
// 6. HERO DEVICE ANIMATION (watt counter)
// ============================================
const hdTemp = $('#hdTemp');
let watt = 23;
let wattDir = 1;
setInterval(() => {
  watt += wattDir * rand(0.5, 2);
  if (watt > 80) wattDir = -1;
  if (watt < 15) wattDir = 1;
  if (hdTemp) hdTemp.textContent = Math.floor(watt);
}, 1200);

// Fire button — smoke explosion
$('#fireBtn')?.addEventListener('click', (e) => {
  const r = e.target.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top;
  smokeBurst(x, y, 35, true);
  e.stopPropagation();
});

// ============================================
// 7. COUNTER ANIMATION
// ============================================
function initCounters() {
  $$('.hs-num').forEach(el => {
    const target = parseInt(el.dataset.target);
    const dur = 2200;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 4);
      el.textContent = Math.floor(ease * target).toLocaleString('de-DE');
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = target.toLocaleString('de-DE');
    };
    requestAnimationFrame(tick);
  });
}

// ============================================
// 8. SCROLL REVEAL
// ============================================
$$('.about-card, .ag-li, .prod, .flavor-item, .hs-item, .ag-card, .section-heading, .section-tag, .flavors-header, .products-intro, .gca-content').forEach((el, i) => {
  el.classList.add('reveal-up');
  el.style.transitionDelay = `${(i % 5) * 0.09}s`;
});

const revObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('in');
      revObs.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });

$$('.reveal-up, .reveal-left').forEach(el => revObs.observe(el));

// ============================================
// 9. 3D CARD TILT
// ============================================
$$('.tilt-card').forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const r = card.getBoundingClientRect();
    const cx = r.left + r.width  / 2;
    const cy = r.top  + r.height / 2;
    const dx = (e.clientX - cx) / (r.width  / 2);
    const dy = (e.clientY - cy) / (r.height / 2);
    card.style.transform = `
      perspective(600px)
      rotateY(${dx * 8}deg)
      rotateX(${-dy * 6}deg)
      translateZ(10px)
    `;
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = 'perspective(600px) rotateY(0deg) rotateX(0deg) translateZ(0)';
  });
  card.addEventListener('mouseenter', (e) => {
    const r = card.getBoundingClientRect();
    smokeBurst(r.left + r.width/2, r.top + r.height/3, 10, false);
  });
});

// ============================================
// 10. ADD TO CART
// ============================================
const cartNotif = $('#cartNotif');
const cnName    = $('#cnName');
const cnClose   = $('#cnClose');
let notifTimer  = null;

$$('.add-to-cart').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (btn.classList.contains('fired')) return;

    const name = btn.dataset.name || 'Produkt';
    btn.classList.add('fired');
    cnName.textContent = name;
    cartNotif.classList.add('show');

    // BIG smoke burst
    const r = btn.getBoundingClientRect();
    smokeBurst(r.left + r.width/2, r.top, 32, true);

    // Extra burst above
    setTimeout(() => smokeBurst(r.left + r.width/2, r.top - 40, 18, true), 150);

    clearTimeout(notifTimer);
    notifTimer = setTimeout(() => {
      cartNotif.classList.remove('show');
      setTimeout(() => btn.classList.remove('fired'), 600);
    }, 3500);
  });
});

cnClose?.addEventListener('click', () => {
  cartNotif.classList.remove('show');
});

// ============================================
// 11. PRODUCT CARD HOVER SMOKE
// ============================================
$$('.prod').forEach((card, i) => {
  card.addEventListener('mouseenter', () => {
    const r = card.getBoundingClientRect();
    smokeBurst(r.left + r.width/2, r.top + r.height * 0.4, 14, false);
  });
});

// ============================================
// 12. FLAVOR BOARD
// ============================================
const flavorData = [
  { name: 'Golden Caramel Noir',  desc: 'Verbrannter Zucker. Dunkle Vanille. Unausweichlich.',     cat: 'DESSERT',  color: [200, 160, 40]  },
  { name: 'Arctic Cedar Freeze',  desc: 'Winterkälte trifft Waldatmosphäre. Betäubend frisch.',    cat: 'MENTHOL',  color: [80, 200, 160]  },
  { name: 'Black Lychee Rose',    desc: 'Ostasiatische Eleganz. Einmal probiert, nie vergessen.',  cat: 'FRUCHT',   color: [200, 80, 120]   },
  { name: 'Obsidian Tobacco',     desc: 'Gereifter Virginia-Tabak. Der Klassiker, perfektioniert.',cat: 'KLASSIK',  color: [180, 130, 80]  },
  { name: 'Midnight Blueberry',   desc: 'Wilde Beere. Nächtliche Intensität. Tief & dunkel.',      cat: 'FRUCHT',   color: [80, 100, 220]  },
  { name: 'Velvet Mango Storm',   desc: 'Tropischer Sturm in einem Zug. Warm, saftig, wild.',      cat: 'FRUCHT',   color: [220, 140, 40]  },
];

const fpName = $('#fpName');
const fpDesc = $('#fpDesc');
const fpCat  = $('#fpCat');
const fpOrb  = $('#fpOrb');
const fpCanvas = $('#fpCanvas');
let fpCtx = null;
if (fpCanvas) {
  fpCanvas.width  = fpCanvas.offsetWidth;
  fpCanvas.height = fpCanvas.offsetHeight;
  fpCtx = fpCanvas.getContext('2d');
}

// Mini smoke in flavor preview
const fpClouds = [];
function renderFpSmoke() {
  if (!fpCtx) return;
  fpCtx.clearRect(0, 0, fpCanvas.width, fpCanvas.height);
  if (fpClouds.length < 8) {
    fpClouds.push(new SmokeCloud({
      x: rand(0, fpCanvas.width),
      y: fpCanvas.height + 20,
      r: rand(20, 50),
      maxR: rand(60, 120),
      vy: -rand(0.3, 0.8),
      vx: rand(-0.3, 0.3),
      maxLife: rand(120, 220),
      burst: false,
    }));
  }
  for (let i = fpClouds.length - 1; i >= 0; i--) {
    fpClouds[i].update();
    fpClouds[i].draw(fpCtx);
    if (fpClouds[i].dead()) fpClouds.splice(i, 1);
  }
  requestAnimationFrame(renderFpSmoke);
}
renderFpSmoke();

function setFlavor(idx) {
  const d = flavorData[idx];
  const [r, g, b] = d.color;

  // Animate out
  fpName.style.opacity = '0';
  fpDesc.style.opacity = '0';
  fpName.style.transform = 'translateY(12px)';
  fpDesc.style.transform = 'translateY(12px)';

  setTimeout(() => {
    fpName.textContent = d.name;
    fpDesc.textContent = d.desc;
    fpCat.textContent  = d.cat;
    fpOrb.style.background = `radial-gradient(circle, rgba(${r},${g},${b},0.2), transparent 65%)`;

    fpName.style.opacity = '1';
    fpDesc.style.opacity = '1';
    fpName.style.transform = 'translateY(0)';
    fpDesc.style.transform = 'translateY(0)';
  }, 250);

  // Burst in flavor preview
  if (fpCanvas) {
    for (let i = 0; i < 14; i++) {
      fpClouds.push(new SmokeCloud({
        x: rand(0, fpCanvas.width),
        y: fpCanvas.height * 0.6 + rand(0, 40),
        r: rand(15, 35),
        maxR: rand(50, 100),
        vy: -rand(0.5, 1.5),
        vx: rand(-0.5, 0.5),
        maxLife: rand(80, 160),
        burst: true,
      }));
    }
  }
}

$$('.flavor-item').forEach((item, i) => {
  item.addEventListener('click', () => {
    $$('.flavor-item').forEach(fi => fi.classList.remove('fi--active'));
    item.classList.add('fi--active');
    setFlavor(i);

    const r = item.getBoundingClientRect();
    smokeBurst(r.right - 80, r.top + r.height/2, 12, false);
  });
  item.addEventListener('mouseenter', () => {
    const r = item.getBoundingClientRect();
    smokeBurst(r.right - 100, r.top + r.height/2, 6, false);
  });
});

// ============================================
// 13. NEWSLETTER FORM
// ============================================
const gcaBtn     = $('#gcaBtn');
const gcaEmail   = $('#gcaEmail');
const gcaSuccess = $('#gcaSuccess');

gcaBtn?.addEventListener('click', () => {
  const val = gcaEmail?.value.trim();
  if (!val || !val.includes('@')) {
    gcaEmail.style.borderColor = 'rgba(200,60,60,0.5)';
    gcaEmail.focus();
    setTimeout(() => gcaEmail.style.borderColor = '', 1400);
    return;
  }
  gcaSuccess?.classList.add('show');
  gcaBtn.style.pointerEvents = 'none';
  gcaBtn.querySelector('.mb-text').textContent = '✓ Eingetragen';

  const r = gcaBtn.getBoundingClientRect();
  smokeBurst(r.left + r.width/2, r.top, 40, true);
  setTimeout(() => smokeBurst(r.left + r.width/2, r.top - 30, 25, true), 200);
  setTimeout(() => smokeBurst(r.left + r.width/2, r.top - 60, 18, true), 400);
});

// ============================================
// 14. PARALLAX BG WORD
// ============================================
const bgWord = $('.about-bg-word');
const aboutSection = $('#about');
if (bgWord && aboutSection) {
  window.addEventListener('scroll', () => {
    const r = aboutSection.getBoundingClientRect();
    const pct = clamp(-r.top / aboutSection.offsetHeight, 0, 1);
    bgWord.style.transform = `translate(-50%, calc(-50% + ${pct * 60}px))`;
    bgWord.style.opacity = 0.5 - pct * 0.4;
  }, { passive: true });
}

// ============================================
// 15. MARQUEE HOVER SPEED
// ============================================
const mTrack = $('.marquee-inner');
let marqueeSpeed = 1;
const marqueeWrap = $('.marquee-wrap');
marqueeWrap?.addEventListener('mouseenter', () => {
  if (mTrack) mTrack.style.animationDuration = '60s';
});
marqueeWrap?.addEventListener('mouseleave', () => {
  if (mTrack) mTrack.style.animationDuration = '20s';
});

// ============================================
// 16. PAGE LOAD INTRO SMOKE
// ============================================
window.addEventListener('load', () => {
  setTimeout(() => {
    // Massive initial smoke explosion from bottom center
    for (let i = 0; i < 40; i++) {
      bgClouds.push(new SmokeCloud({
        x: CW * 0.3 + rand(0, CW * 0.4),
        y: CH + rand(0, 60),
        r: rand(40, 100),
        maxR: rand(120, 300),
        vy: -rand(0.4, 1.4),
        vx: rand(-0.6, 0.6),
        maxLife: rand(300, 600),
        layer: 'bg',
      }));
    }
  }, 800);
});

// ============================================
// 17. SECTION ENTRY SMOKE
// ============================================
const sectionObs = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const r = entry.target.getBoundingClientRect();
      smokeBurst(r.left + r.width/2, r.top + r.height/2, 14, false);
      sectionObs.unobserve(entry.target);
    }
  });
}, { threshold: 0.2 });

$$('#about, #products, #flavors, #contact').forEach(s => sectionObs.observe(s));

// ============================================
// 18. HERO ENTER BUTTON
// ============================================
$('#heroEnterBtn')?.addEventListener('mouseenter', (e) => {
  const r = e.target.getBoundingClientRect();
  smokeBurst(r.left + r.width/2, r.top + r.height/2, 16, false);
});

// ============================================
// CONSOLE SIGNATURE
// ============================================
console.log(
  '%c◈ OBSIDIAN\n%cThe Vapor Sanctum · Built with Legend',
  'color:#c8a040;font-size:36px;font-family:serif;font-style:italic;font-weight:bold;',
  'color:#6a6060;font-size:11px;font-family:monospace;letter-spacing:3px;'
);
