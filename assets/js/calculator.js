import { PRICES } from './prices.js';

const fmt = (n, symbol = '£') => `${symbol}${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function calculate() {
  const get = id => parseFloat(document.getElementById(id).value);

  const annualMileage       = get('annual-mileage');
  const mpg                 = get('mpg');
  const petrolPrice         = get('petrol-price');
  const evMilesPerKwh       = get('ev-miles-per-kwh');
  const homeRate            = get('home-rate');
  const publicPct           = get('public-pct') / 100;
  const publicRate          = get('public-rate');
  const evPremium           = get('ev-premium');
  const petrolInsurance     = get('petrol-insurance');
  const evInsurance         = get('ev-insurance');

  const homeShare  = 1 - publicPct;

  // Annual costs
  const annualPetrolCost   = (annualMileage / mpg) * 4.54609 * petrolPrice;
  const annualEvHome       = ((annualMileage * homeShare) / evMilesPerKwh) * homeRate;
  const annualEvPublic     = ((annualMileage * publicPct) / evMilesPerKwh) * publicRate;
  const annualEvCost       = annualEvHome + annualEvPublic;

  const fuelSaving         = annualPetrolCost - annualEvCost;
  const roadTaxSaving      = 190;
  const servicingSaving    = 200;
  const insuranceDiff      = evInsurance - petrolInsurance;  // positive = EV costs more

  const totalAnnualSaving  = fuelSaving + roadTaxSaving + servicingSaving - insuranceDiff;
  const monthlySaving      = totalAnnualSaving / 12;
  const breakEvenYears     = totalAnnualSaving > 0 ? evPremium / totalAnnualSaving : Infinity;
  const fiveYearSaving     = (totalAnnualSaving * 5) - evPremium;

  // Update results
  setResult('petrol-cost', annualPetrolCost, 'green');
  setResult('ev-cost', annualEvCost, 'green');
  setResult('fuel-saving', fuelSaving, fuelSaving >= 0 ? 'green' : 'red');
  setResult('total-saving', totalAnnualSaving, totalAnnualSaving >= 0 ? 'green' : 'red');
  setResult('monthly-saving', monthlySaving, monthlySaving >= 0 ? 'green' : 'red', true);
  setResult('five-year', fiveYearSaving, fiveYearSaving >= 0 ? 'green' : 'red');

  const beEl = document.getElementById('breakeven');
  if (beEl) {
    if (!isFinite(breakEvenYears) || breakEvenYears < 0) {
      beEl.textContent = 'Never';
    } else {
      beEl.textContent = breakEvenYears.toFixed(1) + ' yrs';
    }
    const card = beEl.closest('.result-card');
    if (card) {
      card.className = 'result-card ' + (breakEvenYears <= 7 ? 'green' : 'red');
    }
  }

  // Update highlight card
  const highlightEl = document.getElementById('monthly-saving');
  if (highlightEl) {
    const card = highlightEl.closest('.result-card');
    if (card) {
      card.className = 'result-card highlight ' + (monthlySaving >= 0 ? '' : 'red-highlight');
    }
  }

  // Draw bar chart
  drawChart(annualPetrolCost, annualEvCost);
}

function setResult(id, value, colorClass, isMonthly = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = fmt(value);
  const card = el.closest('.result-card');
  if (card && !card.classList.contains('highlight')) {
    card.className = 'result-card ' + colorClass;
  }
}

function drawChart(petrolCost, evCost) {
  const max = Math.max(petrolCost, evCost, 1);
  const petrolBar = document.getElementById('bar-petrol');
  const evBar     = document.getElementById('bar-ev');
  const petrolAmt = document.getElementById('bar-petrol-amt');
  const evAmt     = document.getElementById('bar-ev-amt');

  if (petrolBar) petrolBar.style.width = ((petrolCost / max) * 100) + '%';
  if (evBar)     evBar.style.width     = ((evCost    / max) * 100) + '%';
  if (petrolAmt) petrolAmt.textContent = fmt(petrolCost);
  if (evAmt)     evAmt.textContent     = fmt(evCost);
}

function syncRangeDisplay(rangeId, displayId, suffix = '%') {
  const range   = document.getElementById(rangeId);
  const display = document.getElementById(displayId);
  if (!range || !display) return;
  display.textContent = range.value + suffix;
  range.addEventListener('input', () => {
    display.textContent = range.value + suffix;
    calculate();
  });
}

function initPrices() {
  const petrolEl = document.getElementById('petrol-price');
  const homeEl   = document.getElementById('home-rate');
  if (petrolEl && !petrolEl.value) petrolEl.value = PRICES.uk.petrol_per_litre;
  if (homeEl   && !homeEl.value)   homeEl.value   = PRICES.uk.electricity_per_kwh;

  const luEl = document.getElementById('last-updated');
  if (luEl) luEl.textContent = PRICES.uk.last_updated;
}

document.addEventListener('DOMContentLoaded', () => {
  initPrices();
  syncRangeDisplay('public-pct', 'public-pct-display', '%');

  document.querySelectorAll('.calc-inputs input').forEach(input => {
    input.addEventListener('input', calculate);
    input.addEventListener('change', calculate);
  });

  // Nav toggle
  const toggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');
  if (toggle && navLinks) {
    toggle.addEventListener('click', () => navLinks.classList.toggle('open'));
  }

  // FAQ accordion
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const answer  = btn.nextElementSibling;
      const isOpen  = answer.classList.contains('open');
      document.querySelectorAll('.faq-answer').forEach(a => a.classList.remove('open'));
      document.querySelectorAll('.faq-question').forEach(b => b.setAttribute('aria-expanded', 'false'));
      if (!isOpen) {
        answer.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  calculate();
});
