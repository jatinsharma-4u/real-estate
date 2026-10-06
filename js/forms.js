/* Lead generation: modal + inline forms, validation, anti-spam, async submit with
   loading / success / failure states. Backend-ready (see README → "Connecting the form"). */
import { $, $$, site, waUrl, toast, prefersReduced } from './utils.js';
import { lockScroll, unlockScroll } from './scroll.js';

const tpl = $('#lead-form-tpl');
const modal = $('[data-lead-modal]');
let uid = 0;
let lastTrigger = null;
const MIN_FILL_MS = 1200;          // faster than a human can fill the form → likely a bot
const COOLDOWN_MS = 30_000;        // client-side courtesy limit; the server must enforce its own

/* context → modal copy + button label + preselected property type */
const CONTEXTS = {
  'Schedule a Visit': { title: 'Schedule a private visit', sub: "Choose a day that suits you and we'll arrange everything, including pick-up.", cta: 'Confirm Visit Request' },
  'Enquire Now': { title: 'Enquire now', sub: 'Tell us what you are looking for and an advisor will be in touch within one working day.', cta: 'Request a Callback' },
  'Request Brochure': { title: 'Get the brochure', sub: "We'll send the e-brochure, specifications and current price sheet.", cta: 'Send Me the Brochure' },
  'Get Price Details': { title: 'Get price details', sub: 'Receive the latest price sheet and payment plans for every configuration.', cta: 'Get Price Details' },
  'Check Availability': { title: 'Check availability', sub: 'See which floors and facings are open right now.', cta: 'Check Availability' },
  'Request Floor Plan': { title: 'Request the floor plan', sub: 'The full-size plan with dimensions and furniture layout, sent to you shortly.', cta: 'Send Me the Floor Plan' },
  'Join Waitlist': { title: 'Join the waitlist', sub: "We'll tell you the moment a residence in this configuration is released.", cta: 'Join the Waitlist' },
  'Talk to an Expert': { title: 'Talk to an expert', sub: 'Leave your number and a property advisor will call you back.', cta: 'Request a Callback' },
};

export function initForms() {
  if (!tpl) return;
  $$('[data-form-mount]').forEach(mountForm);
  setupModal();
  $$('[data-wa-link]').forEach((a) => { a.href = waUrl(); });
}

/* ---------- mounting ---------- */
function mountForm(host) {
  const id = `f${++uid}`;
  host.innerHTML = tpl.innerHTML.replaceAll('__ID__', id);
  const root = $('[data-leadform]', host);
  const form = $('[data-lead-form]', root);
  const source = host.dataset.source || 'Website';
  $('[data-source]', form).value = source;
  $('[data-ts]', form).value = String(Date.now());
  const date = $('[data-min-today]', form);
  if (date) date.min = localISO(new Date());

  // inline validation: on blur once touched, and re-validate live after an error
  $$('input, select, textarea', form).forEach((el) => {
    if (el.name === 'company_website') return;
    el.addEventListener('blur', () => { el.dataset.touched = '1'; validateField(el); });
    el.addEventListener('input', () => { if (el.closest('.field').classList.contains('is-invalid')) validateField(el); });
  });
  form.addEventListener('submit', (e) => { e.preventDefault(); submit(form, root); });
  $('[data-form-reset]', root).addEventListener('click', () => resetForm(form, root));
  if (host.dataset.formMount === 'modal') initSteps(root, form);
  $('[data-wa-link]', root).href = waUrl("Hi, I just sent an enquiry on the website. I'd like to speak with a property advisor.");
}

/* two-step flow (modal): details → preferences; no scrolling needed on any screen */
function initSteps(root, form) {
  root.classList.add('is-steps');
  const steps = $$('.form__step', form);
  const bar = $$('[data-steps-bar] li', root);
  const back = $('[data-step-back]', form);
  const next = $('[data-step-next]', form);
  const submitBtn = $('[data-submit]', form);
  const go = (n, focus = true) => {
    root.dataset.step = String(n);
    steps.forEach((s) => { s.hidden = Number(s.dataset.step) !== n; });
    bar.forEach((li, i) => li.classList.toggle('is-on', i + 1 <= n));
    back.hidden = n === 1;
    next.hidden = n !== 1;
    submitBtn.hidden = n === 1;
    $('[data-summary]', form).hidden = true;
    const { gsap } = window;
    const cur = steps[n - 1];
    if (gsap && !prefersReduced()) gsap.fromTo($$('.field', cur), { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.06, ease: 'expo.out', clearProps: 'transform,opacity,visibility' });
    if (focus) { const first = $('input:not([type=radio]), select', cur); first && setTimeout(() => first.focus({ preventScroll: true }), 80); }
  };
  next.addEventListener('click', () => {
    const bad = $$('input', steps[0]).filter((el) => RULES[el.name] && !validateField(el));
    if (bad.length) { bad[0].focus(); return; }
    go(2);
  });
  back.addEventListener('click', () => go(1));
  // Enter on step 1 moves forward instead of submitting an incomplete form
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && root.dataset.step === '1' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); next.click(); }
  });
  root._goStep = go;
  go(1, false);
}

const localISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/* ---------- validation ---------- */
const RULES = {
  name: (v) => {
    const s = v.trim();
    if (!s) return 'Please enter your full name.';
    if (s.length < 2) return 'Your name looks too short.';
    return '';
  },
  phone: (v) => {
    const s = v.trim();
    if (!s) return 'Please enter your phone number.';
    if (/[^\d+\s()\-]/.test(s)) return 'Use digits only, for example +91 98765 43210.';
    let d = s.replace(/\D/g, '');
    if (d.startsWith('0091')) d = d.slice(4);
    else if (d.startsWith('91') && d.length === 12) d = d.slice(2);
    else if (d.startsWith('0') && d.length === 11) d = d.slice(1);
    if (d.length === 10) return /^[6-9]/.test(d) ? '' : 'Indian mobile numbers start with 6, 7, 8 or 9.';
    if (s.startsWith('+') && d.length >= 8 && d.length <= 15) return '';
    return 'Enter a valid 10-digit number, or add a country code (+44 …).';
  },
  email: (v) => {
    const s = v.trim();
    if (!s) return 'Please enter your email address.';
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? '' : 'That email address doesn’t look right.';
  },
  visitDate: (v) => {
    if (!v) return '';
    const today = localISO(new Date());
    return v < today ? 'Please choose today or a later date.' : '';
  },
};

function validateField(el) {
  const rule = RULES[el.name];
  if (!rule) return true;
  const msg = rule(el.value);
  const field = el.closest('.field');
  const err = $('.field__err', field);
  field.classList.toggle('is-invalid', !!msg);
  el.setAttribute('aria-invalid', msg ? 'true' : 'false');
  if (err) { err.textContent = msg; err.hidden = !msg; }
  return !msg;
}

function validateAll(form) {
  const bad = [];
  $$('input, select, textarea', form).forEach((el) => { if (RULES[el.name] && !validateField(el)) bad.push(el); });
  return bad;
}

function showSummary(form, bad) {
  const box = $('[data-summary]', form);
  const ul = $('ul', box);
  ul.innerHTML = '';
  bad.forEach((el) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#${el.id}`;
    a.textContent = $('.field__err', el.closest('.field')).textContent;
    a.addEventListener('click', (e) => { e.preventDefault(); el.focus(); });
    li.append(a);
    ul.append(li);
  });
  box.hidden = false;
  box.focus({ preventScroll: false });
}

/* ---------- submit ---------- */
async function submit(form, root) {
  const summary = $('[data-summary]', form);
  const errBox = $('[data-form-error]', form);
  summary.hidden = true;
  errBox.hidden = true;

  const bad = validateAll(form);
  if (bad.length && root._goStep && bad.some((el) => el.closest('[data-step="1"]'))) root._goStep(1, false);
  if (bad.length) {
    if (bad.length > 1) showSummary(form, bad); else bad[0].focus();
    return;
  }

  const data = Object.fromEntries(new FormData(form).entries());

  // anti-spam #1: honeypot. Bots fill it; people never see it. Pretend success, send nothing.
  // anti-spam #2: implausibly fast submit.
  const tooFast = Date.now() - Number(data.ts || 0) < MIN_FILL_MS;
  if (data.company_website || tooFast) { await fakeDelay(700); return showSuccess(form, root); }

  // courtesy cooldown (real rate limiting must live on the server)
  const last = Number(sessionStorage.getItem('az:last') || 0);
  if (Date.now() - last < COOLDOWN_MS) { toast('Thanks, we already have your details. An advisor will call you shortly.'); return showSuccess(form, root); }

  const btn = $('[data-submit]', form);
  const label = $('[data-submit-label]', btn);
  const original = label.textContent;
  btn.classList.add('is-loading');
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  label.textContent = 'Sending…';

  try {
    await send({
      ...data,
      page: location.href,
      referrer: document.referrer || '',
      utm: Object.fromEntries(new URLSearchParams(location.search).entries()),
      submittedAt: new Date().toISOString(),
    });
    sessionStorage.setItem('az:last', String(Date.now()));
    window.dataLayer && window.dataLayer.push({ event: 'lead_submitted', source: data.source, propertyType: data.propertyType || '' });
    showSuccess(form, root);
  } catch (err) {
    const rate = err && err.status === 429;
    $('[data-error-title]', errBox).textContent = rate ? 'Too many requests.' : "We couldn't send your enquiry.";
    $('[data-error-msg]', errBox).textContent = rate
      ? 'Please wait a minute and try again.'
      : 'Please check your connection and try again, or reach us directly on WhatsApp or by phone.';
    errBox.hidden = false;
    errBox.scrollIntoView({ block: 'nearest', behavior: prefersReduced() ? 'auto' : 'smooth' });
  } finally {
    btn.classList.remove('is-loading');
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
    label.textContent = original;
  }
}

const fakeDelay = (ms) => new Promise((r) => setTimeout(r, ms));

async function send(payload) {
  const q = new URLSearchParams(location.search).get('simulate');
  if (!site.endpoint) {
    // Demo mode (no backend configured): simulate the round-trip. ?simulate=fail exercises the error state.
    await fakeDelay(q === 'slow' ? 4000 : 1100);
    if (q === 'fail') throw new Error('simulated failure');
    if (q === 'ratelimit') { const e = new Error('rate'); e.status = 429; throw e; }
    console.info('[azure] demo mode: enquiry NOT sent (no endpoint). Payload:', payload);
    return;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(site.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
      credentials: 'same-origin',
    });
    if (!res.ok) { const e = new Error('http ' + res.status); e.status = res.status; throw e; }
  } finally { clearTimeout(timer); }
}

function showSuccess(form, root) {
  const ok = $('[data-success]', root);
  const { gsap } = window;
  form.hidden = true;
  ok.hidden = false;
  if (gsap && !prefersReduced()) gsap.fromTo($$(':scope > *', ok), { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, ease: 'expo.out', stagger: 0.08 });
  ok.focus({ preventScroll: false });
}

function resetForm(form, root) {
  form.reset();
  $$('.field', form).forEach((f) => { f.classList.remove('is-invalid'); const e = $('.field__err', f); e && (e.hidden = true); });
  $$('[aria-invalid]', form).forEach((el) => el.removeAttribute('aria-invalid'));
  $('[data-ts]', form).value = String(Date.now());
  root._goStep && root._goStep(1, false);
  $('[data-success]', root).hidden = true;
  form.hidden = false;
  $('input[name="name"]', form).focus();
}

/* ---------- modal ---------- */
function setupModal() {
  if (!modal) return;
  const mount = $('[data-form-mount="modal"]', modal);

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-open-lead]');
    if (!t) return;
    e.preventDefault();
    openLead(t.dataset.openLead, { type: t.dataset.planType, trigger: t });
  });

  $('[data-modal-close]', modal).addEventListener('click', () => closeLead());
  modal.addEventListener('cancel', (e) => { e.preventDefault(); closeLead(); });
  // click on the dimmed backdrop (outside the panel) closes
  modal.addEventListener('pointerdown', (e) => { if (e.target === modal) closeLead(); });

  function openLead(context = 'Enquire Now', { type, trigger } = {}) {
    if (modal.open) return;
    const c = CONTEXTS[context] || CONTEXTS['Enquire Now'];
    lastTrigger = trigger || document.activeElement;
    $('[data-lead-context]', modal).textContent = context;
    $('[data-lead-title]', modal).textContent = c.title;
    $('[data-lead-sub]', modal).textContent = c.sub;
    const form = $('[data-lead-form]', mount);
    // reset to a fresh form if a previous submission finished
    if (form.hidden) resetForm(form, $('[data-leadform]', mount));
    const lf = $('[data-leadform]', mount);
    lf._goStep && lf._goStep(1, false);
    $('[data-submit-label]', form).textContent = c.cta;
    $('[data-source]', form).value = `${context}${type ? ' · ' + type : ''}`;
    $('[data-ts]', form).value = String(Date.now());
    const radio = $(`input[name="propertyType"][value="${type || ''}"]`, form);
    if (radio) radio.checked = true;

    modal.showModal();
    lockScroll();
    requestAnimationFrame(() => {
      modal.classList.add('is-open');
      setTimeout(() => $('input[name="name"]', form).focus({ preventScroll: true }), 350);
    });
  }

  function closeLead() {
    if (!modal.open) return;
    modal.classList.remove('is-open');
    const done = () => {
      modal.close();
      unlockScroll();
      lastTrigger && lastTrigger.focus && lastTrigger.focus({ preventScroll: true });
    };
    const panel = $('.modal__panel', modal);
    let fired = false;
    const once = () => { if (fired) return; fired = true; done(); };
    panel.addEventListener('transitionend', once, { once: true });
    setTimeout(once, prefersReduced() ? 0 : 750);
  }

  window.azOpenLead = openLead; // used by other modules
}

export const openLead = (...a) => window.azOpenLead && window.azOpenLead(...a);
