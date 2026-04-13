/*
 * Triage.ai — Clinical Decision Support System
 * Copyright (c) 2026 Dhruv Jain & Sriyan Bodla. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this software, via any medium,
 * is strictly prohibited without prior written permission from the authors.
 *
 * For research and demonstration purposes only.
 * Not approved for clinical use.
 */

// ─── Configuration ──────────────────────────────────────────────

const API_BASE = '/api';
const MIN_LOADING_MS = 800;

// ─── Sample Patients ────────────────────────────────────────────

const SAMPLE_PATIENTS = [
  {
    age: 68, sex: 'Male',
    chiefComplaint: 'cardiac arrest unresponsive',
    heartRate: 30, sbp: 60, dbp: 30, o2Sat: 75,
    respRate: 6, temperature: 96.2, gcs: 3,
    arrivalMode: 'Ambulance', comorbidities: 3
  },
  {
    age: 55, sex: 'Female',
    chiefComplaint: 'severe chest pain radiating to jaw',
    heartRate: 110, sbp: 160, dbp: 95, o2Sat: 92,
    respRate: 22, temperature: 98.6, gcs: 15,
    arrivalMode: 'Ambulance', comorbidities: 2
  },
  {
    age: 42, sex: 'Male',
    chiefComplaint: 'abdominal pain fever vomiting',
    heartRate: 95, sbp: 128, dbp: 78, o2Sat: 97,
    respRate: 18, temperature: 101.8, gcs: 15,
    arrivalMode: 'Walk-in', comorbidities: 1
  },
  {
    age: 28, sex: 'Female',
    chiefComplaint: 'ankle injury after fall',
    heartRate: 78, sbp: 120, dbp: 72, o2Sat: 99,
    respRate: 16, temperature: 98.4, gcs: 15,
    arrivalMode: 'Walk-in', comorbidities: 0
  },
  {
    age: 22, sex: 'Male',
    chiefComplaint: 'sore throat 2 days',
    heartRate: 72, sbp: 118, dbp: 70, o2Sat: 99,
    respRate: 14, temperature: 99.1, gcs: 15,
    arrivalMode: 'Walk-in', comorbidities: 0
  }
];

let sampleIndex = 0;

// ─── ESI Metadata ───────────────────────────────────────────────

const ESI_META = {
  1: { label: 'RESUSCITATION', color: '#ef4444' },
  2: { label: 'EMERGENT',      color: '#f97316' },
  3: { label: 'URGENT',        color: '#eab308' },
  4: { label: 'LESS URGENT',   color: '#3b82f6' },
  5: { label: 'NON-URGENT',    color: '#22c55e' }
};


// ─── DOM References ─────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

let els = {};

// ─── Utilities ──────────────────────────────────────────────────

const debounce = (fn, ms) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ─── Counter Animation (Hero Stats) ────────────────────────────

const animateCounters = () => {
  $$('.stat-value').forEach((el) => {
    const target = parseInt(el.dataset.target, 10);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const duration = 2000;
    const start = performance.now();

    const step = (now) => {
      const elapsed = now - start;
      const progress = clamp(elapsed / duration, 0, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * target);

      el.textContent = `${prefix}${current.toLocaleString()}${suffix}`;

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  });
};

// ─── Intersection Observer (Methodology Cards) ─────────────────

const initRevealObserver = () => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          // Stagger reveal
          setTimeout(() => {
            entry.target.classList.add('visible');
          }, i * 120);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  $$('.method-card.reveal').forEach((card) => observer.observe(card));
};

// ─── Form Helpers ───────────────────────────────────────────────

const getFormData = () => ({
  age:             parseInt($('#age').value, 10),
  sex:             $('#sex').value,
  chief_complaint: $('#chiefComplaint').value.trim(),
  heart_rate:      parseInt($('#heartRate').value, 10),
  sbp:             parseInt($('#sbp').value, 10),
  dbp:             parseInt($('#dbp').value, 10),
  o2_sat:          parseInt($('#o2Sat').value, 10),
  resp_rate:       parseInt($('#respRate').value, 10),
  temperature:     parseFloat($('#temperature').value),
  gcs:             parseInt($('#gcs').value, 10),
  arrival_mode:    $('#arrivalMode').value,
  n_comorbidities: parseInt($('#comorbidities').value, 10)
});

const validateForm = () => {
  const data = getFormData();
  const missing = [];

  if (isNaN(data.age)) missing.push('Age');
  if (!data.sex) missing.push('Sex');
  if (!data.chief_complaint) missing.push('Chief Complaint');
  if (isNaN(data.heart_rate)) missing.push('Heart Rate');
  if (isNaN(data.sbp)) missing.push('Systolic BP');
  if (isNaN(data.dbp)) missing.push('Diastolic BP');
  if (isNaN(data.o2_sat)) missing.push('O2 Sat');
  if (isNaN(data.resp_rate)) missing.push('Resp. Rate');
  if (isNaN(data.temperature)) missing.push('Temperature');
  if (isNaN(data.gcs)) missing.push('GCS');
  if (!data.arrival_mode) missing.push('Arrival Mode');

  return { valid: missing.length === 0, missing, data };
};

const fillForm = (patient) => {
  $('#age').value = patient.age;
  $('#sex').value = patient.sex;
  $('#chiefComplaint').value = patient.chiefComplaint;
  $('#heartRate').value = patient.heartRate;
  $('#sbp').value = patient.sbp;
  $('#dbp').value = patient.dbp;
  $('#o2Sat').value = patient.o2Sat;
  $('#respRate').value = patient.respRate;
  $('#temperature').value = patient.temperature;
  $('#gcs').value = patient.gcs;
  $('#arrivalMode').value = patient.arrivalMode;
  $('#comorbidities').value = patient.comorbidities;
  els.comorbiditiesVal.textContent = patient.comorbidities;
};

// ─── Load Sample Patient ────────────────────────────────────────

const loadSamplePatient = () => {
  fillForm(SAMPLE_PATIENTS[sampleIndex]);
  sampleIndex = (sampleIndex + 1) % SAMPLE_PATIENTS.length;
};

// ─── Results Display ────────────────────────────────────────────

const showPanel = (panelId) => {
  [els.resultsEmpty, els.resultsLoading, els.resultsContent, els.resultsError].forEach((el) => {
    el.classList.add('hidden');
  });
  const target = document.getElementById(panelId);
  if (target) target.classList.remove('hidden');
};

const renderConfidenceRing = (percentage) => {
  const circumference = 2 * Math.PI * 52; // r=52
  const offset = circumference * (1 - percentage / 100);

  // Reset first for re-animation
  els.ringFill.style.transition = 'none';
  els.ringFill.style.strokeDashoffset = circumference;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      els.ringFill.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)';
      els.ringFill.style.strokeDashoffset = offset;
    });
  });

  // Animate the number
  const duration = 1200;
  const start = performance.now();

  const step = (now) => {
    const elapsed = now - start;
    const progress = clamp(elapsed / duration, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    els.confidenceValue.textContent = Math.round(eased * percentage);
    if (progress < 1) requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
};

const renderRiskFactors = (factors) => {
  els.riskFactors.innerHTML = factors
    .map((f) => `
      <div class="risk-factor">
        <div class="risk-factor-header">
          <span class="risk-factor-name">${f.name}</span>
          <span class="risk-factor-score">${(f.importance * 100).toFixed(0)}%</span>
        </div>
        <div class="risk-factor-bar">
          <div class="risk-factor-fill" data-width="${f.importance * 100}"></div>
        </div>
      </div>
    `)
    .join('');

  // Animate bars
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      els.riskFactors.querySelectorAll('.risk-factor-fill').forEach((bar) => {
        bar.style.width = `${bar.dataset.width}%`;
      });
    });
  });
};

const renderConformalSet = (conformalSet, coverageLevel) => {
  els.conformalSet.innerHTML = [1, 2, 3, 4, 5]
    .map((level) => {
      const inSet = conformalSet.includes(level);
      return `<span class="conformal-badge ${inSet ? 'in-set' : 'out-set'}">ESI ${level}</span>`;
    })
    .join('');

  const pct = Math.round((coverageLevel || 0.9) * 100);
  els.conformalNote.textContent = `${pct}% coverage guarantee`;
};

const renderClinicalFlags = (flags) => {
  els.clinicalFlags.innerHTML = flags
    .map((flag, i) => {
      const label = flag.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      return `<span class="clinical-flag" style="animation-delay: ${i * 0.08}s">${label}</span>`;
    })
    .join('');
};

const displayResults = (data) => {
  const level = data.esi_level;
  const meta = ESI_META[level];

  // ESI badge
  els.esiBadge.className = `esi-badge esi-${level}`;
  els.esiLevel.textContent = level;
  els.esiLabel.textContent = data.esi_label || meta.label;
  els.esiLabel.style.color = meta.color;
  els.esiLevelText.textContent = level;

  // Confidence ring
  renderConfidenceRing(Math.round(data.confidence * 100));

  // Ring stroke — keep neutral white to match site theme
  els.ringFill.style.stroke = 'rgba(255,255,255,0.7)';

  // Conformal set
  renderConformalSet(data.conformal_set, data.coverage_level);

  // Risk factors
  renderRiskFactors(data.risk_factors || []);

  // Clinical flags
  renderClinicalFlags(data.clinical_flags || []);

  // Recommendation
  els.recommendationBox.textContent = data.recommendation || 'No specific recommendation provided.';

  // Show results panel
  showPanel('resultsContent');
};

const showError = (message, title = 'Backend Unavailable') => {
  els.errorTitle.textContent = title;
  els.errorBody.textContent = message;
  showPanel('resultsError');
};

// ─── API Call ───────────────────────────────────────────────────

const analyzePatient = async () => {
  const { valid, missing, data } = validateForm();

  if (!valid) {
    showError(`Please fill in the following fields: ${missing.join(', ')}`, 'Missing Required Fields');
    return;
  }

  // Show loading
  els.analyzeBtn.classList.add('loading');
  els.analyzeBtn.disabled = true;
  showPanel('resultsLoading');

  const loadingStart = performance.now();

  let result = null;
  let error = null;

  try {
    const response = await fetch(`${API_BASE}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      if (response.status === 422) {
        const body = await response.json();
        const msgs = (body.detail || []).map(d => d.msg).join('; ');
        throw new Error(msgs || 'Invalid input values. Please check the form.');
      }
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }

    result = await response.json();
  } catch (err) {
    error = err;
  }

  const elapsed = performance.now() - loadingStart;
  if (elapsed < MIN_LOADING_MS) {
    await delay(MIN_LOADING_MS - elapsed);
  }

  if (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      showError('The prediction API is not running. Start the backend server at /api/predict and try again.');
    } else {
      showError(error.message || 'An unexpected error occurred. Please try again.');
    }
  } else {
    displayResults(result);
  }

  els.analyzeBtn.classList.remove('loading');
  els.analyzeBtn.disabled = false;
};

// Debounced version for the submit handler
const debouncedAnalyze = debounce(analyzePatient, 300);

// ─── Event Listeners ────────────────────────────────────────────

const initDemo = () => {
  els = {
    form:            $('#patientForm'),
    analyzeBtn:      $('#analyzeBtn'),
    loadSampleBtn:   $('#loadSampleBtn'),
    comorbidities:   $('#comorbidities'),
    comorbiditiesVal:$('#comorbiditiesValue'),
    resultsPanel:    $('#resultsPanel'),
    resultsEmpty:    $('#resultsEmpty'),
    resultsLoading:  $('#resultsLoading'),
    resultsContent:  $('#resultsContent'),
    resultsError:    $('#resultsError'),
    errorTitle:      $('#errorTitle'),
    errorBody:       $('#errorBody'),
    esiBadge:        $('#esiBadge'),
    esiLevel:        $('#esiLevel'),
    esiLabel:        $('#esiLabel'),
    esiLevelText:    $('#esiLevelText'),
    confidenceRing:  $('#confidenceRing'),
    ringFill:        $('#ringFill'),
    confidenceValue: $('#confidenceValue'),
    conformalSet:    $('#conformalSet'),
    conformalNote:   $('#conformalNote'),
    riskFactors:     $('#riskFactors'),
    clinicalFlags:   $('#clinicalFlags'),
    recommendationBox: $('#recommendationBox')
  };

  els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    debouncedAnalyze();
  });

  els.loadSampleBtn.addEventListener('click', loadSamplePatient);

  els.comorbidities.addEventListener('input', () => {
    els.comorbiditiesVal.textContent = els.comorbidities.value;
  });
};

const initLanding = () => {
  // Smooth scroll for anchor links
  $$('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Counter animation when hero is visible
  const hero = $('.hero');
  if (hero) {
    const heroObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          animateCounters();
          heroObserver.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    heroObserver.observe(hero);
  }

  // Methodology card reveal
  initRevealObserver();
};

const init = () => {
  const hasForm = !!$('#patientForm');

  if (hasForm) initDemo();
  initLanding();
  initFlowField();
};

// ─── Star Field Background ─────────────────────────────────────

const initFlowField = () => {
  const canvas = $('#flowFieldCanvas');
  const container = $('#flowFieldWrap');
  if (!canvas || !container) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const STAR_COUNT = 500;
  let width, height, stars, frameId;

  const createStar = () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: Math.random() * 1.4 + 0.4,
    base: Math.random() * 0.5 + 0.35,
    phase: Math.random() * Math.PI * 2,
    speed: Math.random() * 0.3 + 0.1,
  });

  const setup = () => {
    width = container.clientWidth;
    height = container.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    stars = Array.from({ length: STAR_COUNT }, createStar);
  };

  const draw = (now) => {
    const t = now * 0.001;
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const twinkle = s.base + Math.sin(t * s.speed + s.phase) * 0.3;
      ctx.globalAlpha = clamp(twinkle, 0.1, 0.95);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    frameId = requestAnimationFrame(draw);
  };

  setup();
  frameId = requestAnimationFrame(draw);
  window.addEventListener('resize', () => { cancelAnimationFrame(frameId); setup(); frameId = requestAnimationFrame(draw); });
};

// ─── Bootstrap ──────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
