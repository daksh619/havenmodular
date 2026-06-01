// ============================================================
// HAVENMODULAR — Main JavaScript
// ============================================================

// ── PAGE ROUTING ─────────────────────────────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + id);
  if (target) {
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Hide footer on admin
    const footer = document.getElementById('siteFooter');
    if (footer) footer.style.display = id === 'admin' ? 'none' : '';
  }
  if (id === 'admin') renderLeads();
}

// ── NAV SCROLL ───────────────────────────────────────────────
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

// ── MOBILE DRAWER ────────────────────────────────────────────
function toggleDrawer() {
  document.getElementById('navDrawer').classList.toggle('open');
  document.getElementById('navOverlay').classList.toggle('open');
}

// ── REVEAL ON SCROLL ─────────────────────────────────────────
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('visible'); revealObs.unobserve(e.target); }
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

// ── COMPARISON BARS ──────────────────────────────────────────
const barObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.querySelectorAll('.cv2-fill').forEach(bar => {
        const w = bar.style.width; bar.style.width = '0%';
        setTimeout(() => { bar.style.width = w; }, 100);
      });
      barObs.unobserve(e.target);
    }
  });
}, { threshold: 0.2 });
document.querySelectorAll('.cv2-row:not(.cv2-header):not(.cv2-overall)').forEach(el => barObs.observe(el));

// ── FAQ ACCORDION ────────────────────────────────────────────
document.querySelectorAll('.faq-q').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
  });
});

// ── HERO PARALLAX ────────────────────────────────────────────
window.addEventListener('scroll', () => {
  const hero = document.getElementById('hero');
  if (!hero) return;
  const vid = hero.querySelector('.hero-video');
  if (vid) vid.style.transform = `translateY(${window.scrollY * 0.3}px)`;
}, { passive: true });

// ── CINEMATIC LOOP ───────────────────────────────────────────
(function() {
  const stage     = document.getElementById('cineStage');
  if (!stage) return;
  const slides    = Array.from(stage.querySelectorAll('.cine-slide'));
  const dots      = Array.from(stage.querySelectorAll('.cine-dot'));
  const labelTag  = document.getElementById('cineLabelTag');
  const labelSub  = document.getElementById('cineLabelSub');
  const labelWrap = document.getElementById('cineLabelWrap');
  const fillBar   = document.getElementById('cineProgressFill');
  const flipLayer = document.getElementById('cineFlipLayer');
  const prevBtn   = document.getElementById('cinePrev');
  const nextBtn   = document.getElementById('cineNext');
  let current = 0, timer = null, paused = false;
  const DURATIONS = [7000, 5000, 7000, 5000, 5000, 5000];

  function pauseSlideVideo(slide, reset = true) {
    const vid = slide?.querySelector('video');
    if (!vid) return;
    vid.pause();
    if (reset) vid.currentTime = 0;
  }

  function playSlideVideo(slide) {
    slides.forEach(sl => {
      if (sl !== slide) pauseSlideVideo(sl);
    });
    const vid = slide?.querySelector('video');
    if (!vid) return;
    vid.currentTime = 0;
    vid.play().catch(() => {});
  }

  function startFill(dur) {
    if (!fillBar) return;
    fillBar.style.transition = 'none'; fillBar.style.width = '0%';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      fillBar.style.transition = `width ${dur}ms linear`; fillBar.style.width = '100%';
    }));
  }

  function updateLabels(idx) {
    if (!labelWrap) return;
    labelWrap.classList.add('updating');
    setTimeout(() => {
      const sl = slides[idx];
      if (labelTag) labelTag.textContent = sl.dataset.label || '';
      if (labelSub)  labelSub.innerHTML  = sl.dataset.sublabel || '';
      labelWrap.classList.remove('updating');
    }, 350);
  }

  function goTo(next, dir = 'right') {
    if (next === current) return;
    const prev = current; current = next;
    if (flipLayer) { flipLayer.classList.add('flash'); setTimeout(() => flipLayer.classList.remove('flash'), 180); }
    slides.forEach((sl, i) => {
      if (i !== prev && i !== next) {
        sl.classList.remove('active', 'exit', 'enter-right', 'enter-left');
        pauseSlideVideo(sl);
      }
    });
    pauseSlideVideo(slides[prev]);
    slides[next].classList.add(dir === 'right' ? 'enter-right' : 'enter-left');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      slides[prev].classList.add('exit'); slides[prev].classList.remove('active');
      slides[next].classList.remove('enter-right', 'enter-left'); slides[next].classList.add('active');
      playSlideVideo(slides[next]);
    }));
    setTimeout(() => slides[prev].classList.remove('exit'), 1300);
    updateLabels(next);
    dots.forEach((d, i) => d.classList.toggle('active', i === next));
    clearTimeout(timer);
    const dur = DURATIONS[next] || 5000;
    startFill(dur);
    if (!paused) timer = setTimeout(advance, dur);
  }

  function advance() { goTo((current + 1) % slides.length, 'right'); }

  const dur0 = DURATIONS[0];
  startFill(dur0); timer = setTimeout(advance, dur0);

  stage.addEventListener('mouseenter', () => { paused = true; clearTimeout(timer); if (fillBar) fillBar.style.transition = 'none'; });
  stage.addEventListener('mouseleave', () => {
    paused = false; const dur = DURATIONS[current] || 5000;
    startFill(dur); timer = setTimeout(advance, dur);
  });
  if (prevBtn) prevBtn.addEventListener('click', () => { clearTimeout(timer); goTo((current - 1 + slides.length) % slides.length, 'left'); });
  if (nextBtn) nextBtn.addEventListener('click', () => { clearTimeout(timer); goTo((current + 1) % slides.length, 'right'); });
  dots.forEach((d, i) => d.addEventListener('click', () => { clearTimeout(timer); goTo(i, i > current ? 'right' : 'left'); }));

  let tStart = 0;
  stage.addEventListener('touchstart', e => { tStart = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - tStart;
    if (Math.abs(dx) > 50) { clearTimeout(timer); dx < 0 ? goTo((current + 1) % slides.length, 'right') : goTo((current - 1 + slides.length) % slides.length, 'left'); }
  }, { passive: true });

  slides.forEach((sl, i) => {
    sl.classList.toggle('active', i === current);
    sl.classList.remove('exit', 'enter-right', 'enter-left');
    if (i === current) playSlideVideo(sl);
    else pauseSlideVideo(sl);
  });
})();

// ── MULTI-STEP FORM ──────────────────────────────────────────
let currentStep = 1;
const TOTAL_STEPS = 5;

function nextStep(n) {
  document.getElementById('step' + currentStep).classList.remove('active');
  currentStep = n;
  document.getElementById('step' + n).classList.add('active');
  updateStepDots();
  window.scrollTo({ top: document.getElementById('formWrap')?.offsetTop - 100 || 0, behavior: 'smooth' });
}

function updateStepDots() {
  const dots = document.querySelectorAll('.step-dot');
  dots.forEach((d, i) => {
    d.classList.remove('current', 'done');
    if (i + 1 < currentStep) d.classList.add('done');
    else if (i + 1 === currentStep) d.classList.add('current');
  });
}

function showFormStatus(message, type) {
  const status = document.getElementById('formStatus');
  if (!status) return;
  status.textContent = message;
  status.className = 'form-status ' + (type || '');
  status.style.display = 'block';
}

function clearFormStatus() {
  const status = document.getElementById('formStatus');
  if (!status) return;
  status.textContent = '';
  status.className = 'form-status';
  status.style.display = 'none';
}

async function submitForm(event) {
  if (event?.preventDefault) event.preventDefault();
  clearFormStatus();
  const consent = document.getElementById('f-consent');
  if (!consent?.checked) { showFormStatus('Please tick the consent checkbox to submit.', 'error'); return; }

  const lead = {
    id: Date.now(),
    name:        (document.getElementById('f-name')?.value || '').trim(),
    email:       (document.getElementById('f-email')?.value || '').trim(),
    phone:       (document.getElementById('f-phone')?.value || '').trim(),
    eircode:     (document.getElementById('f-eircode')?.value || '').trim(),
    county:      (document.getElementById('f-county')?.value || '').trim(),
    product:     '45 sqm two-bedroom modular garden home',
    use:         (document.getElementById('f-use')?.value || '').trim(),
    owner:       document.querySelector('input[name="owner"]:checked')?.value || '',
    garden:      (document.getElementById('f-garden')?.value || '').trim(),
    access:      document.querySelector('input[name="access"]:checked')?.value || '',
    accessWidth: (document.getElementById('f-access-width')?.value || '').trim(),
    slope:       document.querySelector('input[name="slope"]:checked')?.value || '',
    water:       document.querySelector('input[name="water"]:checked')?.value || '',
    drainage:    document.querySelector('input[name="drainage"]:checked')?.value || '',
    elec:        document.querySelector('input[name="elec"]:checked')?.value || '',
    timeline:    (document.getElementById('f-timeline')?.value || '').trim(),
    budget:      document.querySelector('input[name="budget"]:checked')?.value || '',
    notes:       (document.getElementById('f-notes')?.value || '').trim(),
    photoCount:  document.getElementById('f-photos')?.files?.length || 0,
    sketchFile:  document.getElementById('f-sketch')?.files?.[0]?.name || '',
    status:      'New',
    date:        new Date().toLocaleDateString('en-IE'),
    suitability: 'Pending review',
  };

  if (!lead.name) { nextStep(1); showFormStatus('Please enter your name.', 'error'); return; }
  if (!lead.email && !lead.phone) { nextStep(1); showFormStatus('Please enter either your email address or phone number.', 'error'); return; }
  if (!lead.notes) { nextStep(4); showFormStatus('Please add a short message or requirements before submitting.', 'error'); return; }

  const submitButton = document.getElementById('submitSiteCheck');
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Sending...';
  }

  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead)
    });

    if (!response.ok) throw new Error('Contact API failed');

    saveLead(lead);
    document.getElementById('formWrap').style.display = 'none';
    document.getElementById('thankYouWrap').style.display = 'block';
  } catch (error) {
    showFormStatus('Something went wrong. Please try again or contact us directly on WhatsApp.', 'error');
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = 'Submit My Site Check ↗';
    }
  }
}

// ── LEAD STORAGE ─────────────────────────────────────────────
function getLeads() {
  try { return JSON.parse(localStorage.getItem('hm_leads') || '[]'); } catch { return []; }
}
function saveLead(lead) {
  const leads = getLeads();
  leads.unshift(lead);
  localStorage.setItem('hm_leads', JSON.stringify(leads));
}
function updateLeadStatus(id, status) {
  const leads = getLeads();
  const l = leads.find(x => x.id === id);
  if (l) { l.status = status; localStorage.setItem('hm_leads', JSON.stringify(leads)); renderLeads(); }
}

const STATUS_CLASSES = {
  'New': 'status-new', 'Contacted': 'status-contacted', 'Qualified': 'status-qualified',
  'Site Visit': 'status-visit', 'Quoted': 'status-quoted', 'Deposit': 'status-deposit', 'Lost': 'status-lost'
};

function renderLeads() {
  const leads = getLeads();
  const search = (document.getElementById('adminSearch')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('adminStatus')?.value || '';
  const filtered = leads.filter(l => {
    const matchSearch = !search || [l.name, l.email, l.county, l.eircode].some(f => (f||'').toLowerCase().includes(search));
    const matchStatus = !statusFilter || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const tbody = document.getElementById('adminTableBody');
  const empty = document.getElementById('adminEmpty');
  if (!tbody) return;

  document.getElementById('statTotal').textContent = leads.length;
  document.getElementById('statNew').textContent = leads.filter(l => l.status === 'New').length;
  document.getElementById('statQualified').textContent = leads.filter(l => l.status === 'Qualified').length;
  document.getElementById('statDeposit').textContent = leads.filter(l => l.status === 'Deposit').length;

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = filtered.map(l => `
    <tr>
      <td><strong>${l.name || '—'}</strong></td>
      <td>${l.phone || '—'}</td>
      <td><span style="color:var(--forest)">${l.email || '—'}</span></td>
      <td>${l.county || '—'}</td>
      <td style="font-size:.78rem">${l.use || '—'}</td>
      <td style="font-size:.78rem">${l.budget || '—'}</td>
      <td style="font-size:.78rem">${l.timeline || '—'}</td>
      <td>
        <select class="form-select" style="font-size:.72rem;padding:.3rem .5rem;width:auto;min-width:110px" onchange="updateLeadStatus(${l.id}, this.value)">
          ${['New','Contacted','Qualified','Site Visit','Quoted','Deposit','Lost'].map(s =>
            `<option value="${s}" ${l.status===s?'selected':''}>${s}</option>`
          ).join('')}
        </select>
        <span class="status-badge ${STATUS_CLASSES[l.status]||'status-new'}" style="margin-left:.4rem">${l.status}</span>
      </td>
      <td style="font-size:.75rem;white-space:nowrap">${l.date || '—'}</td>
      <td style="font-size:.75rem;max-width:180px;color:var(--mid-grey)">${l.notes ? l.notes.substring(0,80)+'…' : '—'}</td>
    </tr>
  `).join('');
}

function addSampleLead() {
  const names = ['Aoife Murphy','Ciarán O\'Brien','Sinéad Walsh','Pádraig Ryan','Niamh Kelly'];
  const counties = ['Dublin','Cork','Galway','Limerick','Wicklow','Kildare','Meath'];
  const uses = ['Elderly parent / granny flat','Adult child / independent living','Guest suite'];
  const budgets = ['€90,000 – €120,000','€70,000 – €90,000','€120,000+'];
  const statuses = ['New','Contacted','Qualified'];
  const l = {
    id: Date.now(),
    name: names[Math.floor(Math.random()*names.length)],
    email: 'sample@example.ie',
    phone: '+353 87 ' + Math.floor(1000000 + Math.random()*9000000),
    eircode: 'D' + Math.floor(10+Math.random()*89) + ' X' + Math.floor(100+Math.random()*900),
    county: counties[Math.floor(Math.random()*counties.length)],
    use: uses[Math.floor(Math.random()*uses.length)],
    garden: '100–200 sqm',
    timeline: 'Within 6 months',
    budget: budgets[Math.floor(Math.random()*budgets.length)],
    notes: 'Interested in the Classic package. Garden is mostly flat with good side access.',
    status: statuses[Math.floor(Math.random()*statuses.length)],
    date: new Date().toLocaleDateString('en-IE'),
    suitability: 'Pending review',
  };
  saveLead(l);
  renderLeads();
}

// ── LIGHTBOX ─────────────────────────────────────────────────
function openLightbox(src) {
  const overlay = document.getElementById('lightboxOverlay');
  const img = document.getElementById('lightboxImg');
  if (!overlay || !img) return;
  img.src = src;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  const overlay = document.getElementById('lightboxOverlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });
