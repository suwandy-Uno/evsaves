import { PRICES } from './prices.js';
import { fmt, fmtNum, getSymbol, getDistUnit } from './utils.js';

// ─── RENDER HELPERS ───────────────────────────────────────────────────────────

function renderInputGroup(inp, sym) {
  const prefixHtml = inp.prefix ? `<span class="input-addon">${inp.prefix}</span>` : '';
  const suffixHtml = inp.suffix ? `<span class="input-addon input-addon-right">${inp.suffix}</span>` : '';

  if (inp.type === 'range') {
    return `
      <div class="form-group">
        <label for="${inp.id}">${inp.label}: <span class="range-value" id="${inp.id}-display">${inp.default}%</span></label>
        <input type="range" id="${inp.id}" value="${inp.default}" min="${inp.min}" max="${inp.max}" step="${inp.step || 1}">
        <div class="range-labels"><span>${inp.min}%</span><span>${inp.max}%</span></div>
      </div>`;
  }
  if (inp.type === 'select') {
    const opts = inp.options.map(o => `<option value="${o.value}"${o.value == inp.default ? ' selected' : ''}>${o.label}</option>`).join('');
    return `<div class="form-group"><label for="${inp.id}">${inp.label}</label><select id="${inp.id}">${opts}</select></div>`;
  }
  return `
    <div class="form-group">
      <label for="${inp.id}">${inp.label}</label>
      <div class="input-wrap">${prefixHtml}
        <input type="number" id="${inp.id}" value="${inp.default}" min="${inp.min ?? ''}" max="${inp.max ?? ''}" step="${inp.step ?? 'any'}">
      ${suffixHtml}</div>
    </div>`;
}

function renderResultCard(r) {
  const colorClass = r.color === 'highlight' ? 'result-card highlight' :
                     r.color === 'red'       ? 'result-card red'       :
                     r.color === 'green'     ? 'result-card green'     : 'result-card neutral';
  const spanClass = r.color === 'highlight'  ? 'result-card highlight' : colorClass;
  return `<div class="${spanClass}${r.span ? ' span2' : ''}">
    <div class="label">${r.label}</div>
    <div class="value" id="${r.id}">—</div>
    ${r.note ? `<div class="result-note">${r.note}</div>` : ''}
  </div>`;
}

function renderChart(items) {
  const rows = items.map(item => `
    <div class="bar-item">
      <div class="bar-label">${item.label}</div>
      <div class="bar-track">
        <div class="bar-fill ${item.cls}" id="${item.id}" style="width:0%">
          <span class="bar-amount" id="${item.id}-amt">—</span>
        </div>
      </div>
    </div>`).join('');
  return `<div class="chart-container"><div class="chart-title">Annual Cost Comparison</div><div class="bar-chart">${rows}</div></div>`;
}

function updateChart(items, values) {
  const max = Math.max(...values.map(v => Math.abs(v)), 1);
  items.forEach((item, i) => {
    const bar = document.getElementById(item.id);
    const amt = document.getElementById(item.id + '-amt');
    if (bar) bar.style.width = ((Math.abs(values[i]) / max) * 100) + '%';
    if (amt) amt.textContent = item.fmtFn ? item.fmtFn(values[i]) : values[i];
  });
}

function setResult(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function autoColorCard(id, value) {
  const el = document.getElementById(id)?.closest('.result-card');
  if (!el) return;
  if (el.classList.contains('highlight')) return;
  el.className = 'result-card ' + (value >= 0 ? 'green' : 'red');
}

function getVal(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  return el.type === 'range' ? parseFloat(el.value) : parseFloat(el.value) || 0;
}

function bindInputs(container, onCalc) {
  container.querySelectorAll('input, select').forEach(inp => {
    inp.addEventListener('input', () => {
      if (inp.type === 'range') {
        const disp = document.getElementById(inp.id + '-display');
        if (disp) disp.textContent = inp.value + '%';
      }
      onCalc();
    });
  });
}

function renderCalcLayout(inputsHtml, resultsHtml, dividerLabel) {
  return `
    <div class="calc-layout">
      <div class="calc-inputs">
        <h2>Your Details</h2>
        ${dividerLabel ? `<p class="section-divider">${dividerLabel}</p>` : ''}
        ${inputsHtml}
        <button class="btn-calc" id="calc-btn">Calculate</button>
        <p class="last-updated">Prices updated: <span data-last-updated></span></p>
      </div>
      <div class="calc-results">
        <h2>Your Results</h2>
        ${resultsHtml}
      </div>
    </div>`;
}

// ─── CALCULATOR CONFIGS ───────────────────────────────────────────────────────

const CONFIGS = {

  // ── 1. EV VS PETROL / GAS ───────────────────────────────────────────────────
  'ev-vs-petrol': {
    getInputs(region, ov) {
      const p = PRICES[region];
      const sym = p.symbol;
      const isUS = region === 'us';
      const isAU = region === 'au';
      return [
        { id: 'annual_dist', label: `Annual ${isAU ? 'Distance (km)' : 'Mileage (miles)'}`, type: 'number', default: ov.annual_dist ?? (isAU ? 15000 : 8000), min: 1000, max: 100000, step: 500 },
        isUS
          ? { id: 'mpg', label: 'Current Car MPG', type: 'number', default: ov.mpg ?? 28, min: 5, max: 60, step: 1 }
          : isAU
            ? { id: 'l100km', label: 'Fuel Use (L/100km)', type: 'number', default: ov.l100km ?? 8.5, min: 3, max: 20, step: 0.1 }
            : { id: 'mpg', label: 'Petrol Car MPG', type: 'number', default: ov.mpg ?? 35, min: 10, max: 80, step: 1 },
        isUS
          ? { id: 'fuel_price', label: 'Gas Price ($/gal)', type: 'number', default: ov.fuel_price ?? p.gas_per_gallon, min: 1, max: 8, step: 0.01, prefix: '$' }
          : { id: 'fuel_price', label: `Petrol Price (${sym}/litre)`, type: 'number', default: ov.fuel_price ?? p.petrol_per_litre, min: 0.50, max: 3, step: 0.01, prefix: sym },
        { id: 'ev_eff', label: `EV Efficiency (${isAU ? 'km/kWh' : 'miles/kWh'})`, type: 'number', default: ov.ev_eff ?? (isAU ? 5.5 : 3.5), min: 1.5, max: 8, step: 0.1 },
        { id: 'home_rate', label: `Home Electricity (${sym}/kWh)`, type: 'number', default: ov.home_rate ?? p.electricity_per_kwh, min: 0.05, max: 1, step: 0.001, prefix: sym },
        { id: 'public_pct', label: 'Public Charging %', type: 'range', default: ov.public_pct ?? 20, min: 0, max: 100, step: 5 },
        { id: 'public_rate', label: `Public Charging (${sym}/kWh)`, type: 'number', default: ov.public_rate ?? p.public_charging_per_kwh, min: 0.10, max: 1.50, step: 0.01, prefix: sym },
        { id: 'ev_premium', label: `EV Purchase Premium (${sym})`, type: 'number', default: ov.ev_premium ?? (isAU ? 10000 : isUS ? 8000 : 8000), min: 0, max: 50000, step: 500, prefix: sym },
        { id: 'fuel_insurance', label: `Petrol/Gas Insurance (${sym}/yr)`, type: 'number', default: ov.fuel_insurance ?? (isAU ? 1200 : isUS ? 1400 : 800), min: 100, max: 10000, step: 50, prefix: sym },
        { id: 'ev_insurance', label: `EV Insurance (${sym}/yr)`, type: 'number', default: ov.ev_insurance ?? (isAU ? 1350 : isUS ? 1550 : 950), min: 100, max: 10000, step: 50, prefix: sym },
        ...( region === 'uk' ? [
          { id: 'road_tax_saving', label: 'Road Tax Saving (£/yr)', type: 'number', default: ov.road_tax_saving ?? 190, min: 0, max: 500, step: 10, prefix: '£' },
          { id: 'servicing_saving', label: 'Servicing Saving (£/yr)', type: 'number', default: ov.servicing_saving ?? 200, min: 0, max: 1000, step: 50, prefix: '£' },
        ] : [])
      ];
    },
    calculate(v, region) {
      const p = PRICES[region];
      const sym = p.symbol;
      const isUS = region === 'us';
      const isAU = region === 'au';
      const publicShare = v.public_pct / 100;
      const homeShare = 1 - publicShare;

      let annualFuelCost;
      if (isUS) {
        annualFuelCost = (v.annual_dist / v.mpg) * v.fuel_price;
      } else if (isAU) {
        annualFuelCost = (v.annual_dist / 100) * v.l100km * v.fuel_price;
      } else {
        annualFuelCost = (v.annual_dist / v.mpg) * 4.54609 * v.fuel_price;
      }

      const annualEvHome   = (v.annual_dist * homeShare / v.ev_eff) * v.home_rate;
      const annualEvPublic = (v.annual_dist * publicShare / v.ev_eff) * v.public_rate;
      const annualEvCost   = annualEvHome + annualEvPublic;
      const fuelSaving     = annualFuelCost - annualEvCost;
      const insuranceDiff  = v.ev_insurance - v.fuel_insurance;
      const roadTax        = region === 'uk' ? (v.road_tax_saving ?? 190) : (isAU ? 150 : 0);
      const servicing      = region === 'uk' ? (v.servicing_saving ?? 200) : (isAU ? 200 : 200);
      const totalAnnual    = fuelSaving + roadTax + servicing - insuranceDiff;
      const monthly        = totalAnnual / 12;
      const breakEven      = totalAnnual > 0 ? v.ev_premium / totalAnnual : Infinity;
      const fiveYear       = totalAnnual * 5 - v.ev_premium;

      const f = n => fmt(n, sym);
      const auto = n => n >= 0 ? 'green' : 'red';

      return {
        results: [
          { id: 'monthly_saving', label: 'Monthly Saving', value: f(monthly), color: 'highlight', span: true },
          { id: 'annual_fuel_cost', label: isUS ? 'Annual Gas Cost' : 'Annual Petrol Cost', value: f(annualFuelCost), color: 'neutral' },
          { id: 'annual_ev_cost', label: 'Annual EV Cost', value: f(annualEvCost), color: 'neutral' },
          { id: 'fuel_saving', label: isUS ? 'Annual Gas Saving' : 'Annual Fuel Saving', value: f(fuelSaving), color: auto(fuelSaving), raw: fuelSaving },
          { id: 'total_saving', label: 'Total Annual Saving', value: f(totalAnnual), color: auto(totalAnnual), raw: totalAnnual },
          { id: 'breakeven', label: 'Break-Even Point', value: isFinite(breakEven) && breakEven >= 0 ? fmtNum(breakEven, 1) + ' yrs' : 'Never', color: breakEven <= 7 ? 'green' : 'red' },
          { id: 'five_year', label: '5-Year Net Saving', value: f(fiveYear), color: auto(fiveYear), raw: fiveYear },
        ],
        chart: [
          { id: 'bar-fuel', label: isUS ? 'Gas Car' : 'Petrol', cls: 'petrol', fmtFn: n => f(n), value: annualFuelCost },
          { id: 'bar-ev', label: 'EV', cls: 'ev', fmtFn: n => f(n), value: annualEvCost },
        ]
      };
    }
  },

  // ── 2. EV CHARGING COST ──────────────────────────────────────────────────────
  'ev-charging': {
    getInputs(region, ov) {
      const p = PRICES[region];
      const sym = p.symbol;
      const dist = getDistUnit(region);
      return [
        { id: 'battery_kwh', label: 'Battery Size (kWh)', type: 'number', default: ov.battery_kwh ?? 60, min: 10, max: 150, step: 0.5 },
        { id: 'start_pct', label: 'Start Charge %', type: 'number', default: ov.start_pct ?? 20, min: 0, max: 99, step: 1 },
        { id: 'end_pct', label: 'End Charge %', type: 'number', default: ov.end_pct ?? 80, min: 1, max: 100, step: 1 },
        { id: 'home_rate', label: `Home Electricity (${sym}/kWh)`, type: 'number', default: ov.home_rate ?? p.electricity_per_kwh, min: 0.05, max: 1, step: 0.001, prefix: sym },
        { id: 'charge_eff', label: 'Charging Efficiency %', type: 'number', default: ov.charge_eff ?? 88, min: 70, max: 100, step: 1 },
        { id: 'ev_eff', label: `EV Efficiency (${dist}/kWh)`, type: 'number', default: ov.ev_eff ?? (region === 'au' ? 5.5 : 3.5), min: 1, max: 8, step: 0.1 },
        { id: 'monthly_charges', label: 'Charges per Month', type: 'number', default: ov.monthly_charges ?? 8, min: 1, max: 60, step: 1 },
      ];
    },
    calculate(v, region) {
      const sym = PRICES[region].symbol;
      const dist = getDistUnit(region);
      const f = n => fmt(n, sym, 2);
      const pct = clamp(v.end_pct - v.start_pct, 0, 100);
      const kwhToWall = (v.battery_kwh * pct / 100) / (v.charge_eff / 100);
      const kwhToBank = v.battery_kwh * pct / 100;
      const cost = kwhToWall * v.home_rate;
      const rangeAdded = kwhToBank * v.ev_eff;
      const costPerDist = rangeAdded > 0 ? cost / rangeAdded : 0;
      const monthly = cost * v.monthly_charges;

      return {
        results: [
          { id: 'kwh_from_wall', label: 'kWh from Wall', value: fmtNum(kwhToWall, 1) + ' kWh', color: 'neutral' },
          { id: 'charge_cost', label: 'Cost per Charge', value: f(cost), color: 'neutral', span: true },
          { id: 'range_added', label: `Range Added (${dist})`, value: fmtNum(rangeAdded, 0) + ` ${dist}`, color: 'green' },
          { id: 'cost_per_dist', label: `Cost per ${dist === 'miles' ? 'Mile' : 'km'}`, value: fmt(costPerDist, sym, 3), color: 'neutral' },
          { id: 'monthly_cost', label: 'Est. Monthly Cost', value: fmt(monthly, sym), color: 'neutral' },
          { id: 'annual_cost', label: 'Est. Annual Cost', value: fmt(monthly * 12, sym), color: 'neutral' },
        ],
        chart: null
      };
    }
  },

  // ── 3. EV RUNNING COST ───────────────────────────────────────────────────────
  'ev-running': {
    getInputs(region, ov) {
      const p = PRICES[region];
      const sym = p.symbol;
      const dist = getDistUnit(region);
      const isAU = region === 'au';
      return [
        { id: 'annual_dist', label: `Annual Distance (${dist})`, type: 'number', default: ov.annual_dist ?? (isAU ? 15000 : 8000), min: 1000, max: 100000, step: 500 },
        { id: 'ev_eff', label: `EV Efficiency (${dist}/kWh)`, type: 'number', default: ov.ev_eff ?? (isAU ? 5.5 : 3.5), min: 1.5, max: 8, step: 0.1 },
        { id: 'home_rate', label: `Home Rate (${sym}/kWh)`, type: 'number', default: ov.home_rate ?? p.electricity_per_kwh, min: 0.05, max: 1, step: 0.001, prefix: sym },
        { id: 'public_pct', label: 'Public Charging %', type: 'range', default: ov.public_pct ?? 15, min: 0, max: 100, step: 5 },
        { id: 'public_rate', label: `Public Rate (${sym}/kWh)`, type: 'number', default: ov.public_rate ?? p.public_charging_per_kwh, min: 0.10, max: 1.50, step: 0.01, prefix: sym },
        { id: 'insurance', label: `Annual Insurance (${sym})`, type: 'number', default: ov.insurance ?? (isAU ? 1350 : 950), min: 100, max: 10000, step: 50, prefix: sym },
        { id: 'servicing', label: `Annual Servicing (${sym})`, type: 'number', default: ov.servicing ?? (isAU ? 300 : 200), min: 0, max: 3000, step: 50, prefix: sym },
        { id: 'tyres', label: `Annual Tyres (${sym})`, type: 'number', default: ov.tyres ?? 150, min: 0, max: 2000, step: 25, prefix: sym },
      ];
    },
    calculate(v, region) {
      const sym = PRICES[region].symbol;
      const dist = getDistUnit(region);
      const f = n => fmt(n, sym);
      const pub = v.public_pct / 100;
      const home = 1 - pub;
      const annualKwh = v.annual_dist / v.ev_eff;
      const chargeCost = annualKwh * home * v.home_rate + annualKwh * pub * v.public_rate;
      const totalAnnual = chargeCost + v.insurance + v.servicing + v.tyres;
      const monthly = totalAnnual / 12;
      const perDist = v.annual_dist > 0 ? totalAnnual / v.annual_dist : 0;
      const fiveYear = totalAnnual * 5;

      return {
        results: [
          { id: 'annual_charge', label: 'Annual Charging Cost', value: f(chargeCost), color: 'neutral' },
          { id: 'total_annual', label: 'Total Annual Running', value: f(totalAnnual), color: 'neutral', span: true },
          { id: 'monthly_running', label: 'Monthly Running Cost', value: f(monthly), color: 'highlight', span: true },
          { id: 'per_dist', label: `Cost per ${dist === 'miles' ? 'Mile' : 'km'}`, value: fmt(perDist, sym, 2), color: 'neutral' },
          { id: 'five_year', label: '5-Year Running Cost', value: f(fiveYear), color: 'neutral' },
        ],
        chart: [
          { id: 'bar-charge', label: 'Charging', cls: 'ev', fmtFn: n => f(n), value: chargeCost },
          { id: 'bar-insurance', label: 'Insurance', cls: 'bar-mid', fmtFn: n => f(n), value: v.insurance },
          { id: 'bar-service', label: 'Servicing', cls: 'bar-low', fmtFn: n => f(n), value: v.servicing },
        ]
      };
    }
  },

  // ── 4. EV TOTAL COST OF OWNERSHIP ───────────────────────────────────────────
  'ev-tco': {
    getInputs(region, ov) {
      const p = PRICES[region];
      const sym = p.symbol;
      const dist = getDistUnit(region);
      const isAU = region === 'au';
      return [
        { id: 'purchase_price', label: `Purchase Price (${sym})`, type: 'number', default: ov.purchase_price ?? (isAU ? 55000 : 40000), min: 5000, max: 200000, step: 500, prefix: sym },
        { id: 'resale_5yr', label: `Resale Value 5 Yrs (${sym})`, type: 'number', default: ov.resale_5yr ?? (isAU ? 28000 : 22000), min: 0, max: 150000, step: 500, prefix: sym },
        { id: 'annual_dist', label: `Annual Distance (${dist})`, type: 'number', default: ov.annual_dist ?? (isAU ? 15000 : 10000), min: 1000, max: 100000, step: 500 },
        { id: 'ev_eff', label: `EV Efficiency (${dist}/kWh)`, type: 'number', default: ov.ev_eff ?? (isAU ? 5.5 : 3.5), min: 1.5, max: 8, step: 0.1 },
        { id: 'home_rate', label: `Electricity Rate (${sym}/kWh)`, type: 'number', default: ov.home_rate ?? p.electricity_per_kwh, min: 0.05, max: 1, step: 0.001, prefix: sym },
        { id: 'insurance', label: `Annual Insurance (${sym})`, type: 'number', default: ov.insurance ?? (isAU ? 1350 : 950), min: 100, max: 10000, step: 50, prefix: sym },
        { id: 'servicing', label: `Annual Servicing (${sym})`, type: 'number', default: ov.servicing ?? 250, min: 0, max: 3000, step: 50, prefix: sym },
        { id: 'finance_annual', label: `Annual Finance Cost (${sym})`, type: 'number', default: ov.finance_annual ?? 0, min: 0, max: 20000, step: 100, prefix: sym },
      ];
    },
    calculate(v, region) {
      const sym = PRICES[region].symbol;
      const dist = getDistUnit(region);
      const f = n => fmt(n, sym);
      const annualCharge = (v.annual_dist / v.ev_eff) * v.home_rate;
      const annualRunning = v.insurance + v.servicing + annualCharge;
      const depreciation = v.purchase_price - v.resale_5yr;
      const fiveYearTco = depreciation + annualRunning * 5 + v.finance_annual * 5;
      const monthly = fiveYearTco / 60;
      const perDist = v.annual_dist > 0 ? fiveYearTco / (v.annual_dist * 5) : 0;

      return {
        results: [
          { id: 'depreciation', label: '5-Year Depreciation', value: f(depreciation), color: 'neutral' },
          { id: 'annual_running', label: 'Annual Running Cost', value: f(annualRunning), color: 'neutral' },
          { id: 'five_tco', label: '5-Year Total Cost of Ownership', value: f(fiveYearTco), color: 'neutral', span: true },
          { id: 'monthly_own', label: 'Monthly Ownership Cost', value: f(monthly), color: 'highlight', span: true },
          { id: 'per_dist', label: `Cost per ${dist === 'miles' ? 'Mile' : 'km'}`, value: fmt(perDist, sym, 2), color: 'neutral' },
        ],
        chart: [
          { id: 'bar-dep', label: 'Depreciation', cls: 'petrol', fmtFn: n => f(n), value: depreciation },
          { id: 'bar-run', label: 'Running (5yr)', cls: 'ev', fmtFn: n => f(n), value: annualRunning * 5 },
          { id: 'bar-fin', label: 'Finance (5yr)', cls: 'bar-mid', fmtFn: n => f(n), value: v.finance_annual * 5 },
        ]
      };
    }
  },

  // ── 5. MODEL RUNNING COST (prefilled, extends ev-running) ───────────────────
  'model-running': {
    getInputs(region, ov) {
      return CONFIGS['ev-running'].getInputs(region, ov);
    },
    calculate(v, region) {
      return CONFIGS['ev-running'].calculate(v, region);
    }
  },

  // ── 6. EV VS HYBRID ─────────────────────────────────────────────────────────
  'ev-vs-hybrid': {
    getInputs(region, ov) {
      const p = PRICES[region];
      const sym = p.symbol;
      const dist = getDistUnit(region);
      const isUS = region === 'us';
      const isAU = region === 'au';
      return [
        { id: 'annual_dist', label: `Annual ${isAU ? 'Distance (km)' : 'Mileage (miles)'}`, type: 'number', default: ov.annual_dist ?? (isAU ? 15000 : 8000), min: 1000, max: 100000, step: 500 },
        isUS
          ? { id: 'hybrid_mpg', label: 'Hybrid MPG', type: 'number', default: ov.hybrid_mpg ?? 45, min: 20, max: 80, step: 1 }
          : isAU
            ? { id: 'hybrid_l100km', label: 'Hybrid Use (L/100km)', type: 'number', default: ov.hybrid_l100km ?? 5.5, min: 2, max: 15, step: 0.1 }
            : { id: 'hybrid_mpg', label: 'Hybrid MPG', type: 'number', default: ov.hybrid_mpg ?? 50, min: 20, max: 80, step: 1 },
        isUS
          ? { id: 'fuel_price', label: 'Gas Price ($/gal)', type: 'number', default: ov.fuel_price ?? p.gas_per_gallon, min: 1, max: 8, step: 0.01, prefix: '$' }
          : { id: 'fuel_price', label: `Petrol (${sym}/L)`, type: 'number', default: ov.fuel_price ?? p.petrol_per_litre, min: 0.50, max: 3, step: 0.01, prefix: sym },
        { id: 'ev_eff', label: `EV Efficiency (${dist}/kWh)`, type: 'number', default: ov.ev_eff ?? (isAU ? 5.5 : 3.5), min: 1.5, max: 8, step: 0.1 },
        { id: 'home_rate', label: `Home Electricity (${sym}/kWh)`, type: 'number', default: ov.home_rate ?? p.electricity_per_kwh, min: 0.05, max: 1, step: 0.001, prefix: sym },
        { id: 'public_pct', label: 'EV Public Charging %', type: 'range', default: ov.public_pct ?? 20, min: 0, max: 100, step: 5 },
        { id: 'public_rate', label: `Public Rate (${sym}/kWh)`, type: 'number', default: ov.public_rate ?? p.public_charging_per_kwh, min: 0.10, max: 1.50, step: 0.01, prefix: sym },
      ];
    },
    calculate(v, region) {
      const sym = PRICES[region].symbol;
      const f = n => fmt(n, sym);
      const isUS = region === 'us';
      const isAU = region === 'au';
      let hybridAnnual;
      if (isUS) hybridAnnual = (v.annual_dist / v.hybrid_mpg) * v.fuel_price;
      else if (isAU) hybridAnnual = (v.annual_dist / 100) * v.hybrid_l100km * v.fuel_price;
      else hybridAnnual = (v.annual_dist / v.hybrid_mpg) * 4.54609 * v.fuel_price;

      const pub = v.public_pct / 100;
      const evAnnual = (v.annual_dist * (1-pub) / v.ev_eff) * v.home_rate
                     + (v.annual_dist * pub / v.ev_eff) * v.public_rate;
      const saving = hybridAnnual - evAnnual;

      return {
        results: [
          { id: 'hybrid_cost', label: 'Annual Hybrid Fuel Cost', value: f(hybridAnnual), color: 'neutral' },
          { id: 'ev_cost', label: 'Annual EV Energy Cost', value: f(evAnnual), color: 'neutral' },
          { id: 'annual_saving', label: 'Annual Saving (EV over Hybrid)', value: f(saving), color: saving >= 0 ? 'green' : 'red', span: true },
          { id: 'monthly_saving', label: 'Monthly Saving', value: f(saving/12), color: 'highlight', span: true },
          { id: 'five_saving', label: '5-Year Saving', value: f(saving*5), color: saving >= 0 ? 'green' : 'red' },
        ],
        chart: [
          { id: 'bar-hybrid', label: 'Hybrid', cls: 'petrol', fmtFn: n => f(n), value: hybridAnnual },
          { id: 'bar-ev', label: 'EV', cls: 'ev', fmtFn: n => f(n), value: evAnnual },
        ]
      };
    }
  },

  // ── 7. SOLAR EV CHARGING ────────────────────────────────────────────────────
  'solar-ev': {
    getInputs(region, ov) {
      const p = PRICES[region];
      const sym = p.symbol;
      const dist = getDistUnit(region);
      const isAU = region === 'au';
      return [
        { id: 'annual_dist', label: `Annual Distance (${dist})`, type: 'number', default: ov.annual_dist ?? (isAU ? 15000 : 8000), min: 1000, max: 100000, step: 500 },
        { id: 'ev_eff', label: `EV Efficiency (${dist}/kWh)`, type: 'number', default: ov.ev_eff ?? (isAU ? 5.5 : 3.5), min: 1.5, max: 8, step: 0.1 },
        { id: 'solar_pct', label: 'Solar % of EV Charging', type: 'range', default: ov.solar_pct ?? 40, min: 0, max: 100, step: 5 },
        { id: 'grid_rate', label: `Grid Electricity (${sym}/kWh)`, type: 'number', default: ov.grid_rate ?? p.electricity_per_kwh, min: 0.05, max: 1, step: 0.001, prefix: sym },
        { id: 'solar_rate', label: `Solar Cost (${sym}/kWh)`, type: 'number', default: ov.solar_rate ?? (isAU ? 0.08 : 0.06), min: 0, max: 0.30, step: 0.001, prefix: sym },
      ];
    },
    calculate(v, region) {
      const sym = PRICES[region].symbol;
      const f = n => fmt(n, sym);
      const totalKwh = v.annual_dist / v.ev_eff;
      const solarKwh = totalKwh * v.solar_pct / 100;
      const gridKwh  = totalKwh * (1 - v.solar_pct / 100);
      const gridCost = totalKwh * v.grid_rate;
      const withSolar = gridKwh * v.grid_rate + solarKwh * v.solar_rate;
      const saving = gridCost - withSolar;

      return {
        results: [
          { id: 'total_kwh', label: 'Annual kWh Needed', value: fmtNum(totalKwh, 0) + ' kWh', color: 'neutral' },
          { id: 'grid_only', label: 'Grid-Only Annual Cost', value: f(gridCost), color: 'neutral' },
          { id: 'solar_cost', label: 'With Solar Annual Cost', value: f(withSolar), color: 'neutral' },
          { id: 'annual_saving', label: 'Annual Solar Saving', value: f(saving), color: saving >= 0 ? 'green' : 'red', span: true },
          { id: 'five_saving', label: '5-Year Solar Saving', value: f(saving * 5), color: saving >= 0 ? 'green' : 'red' },
        ],
        chart: [
          { id: 'bar-grid', label: 'Grid Only', cls: 'petrol', fmtFn: n => f(n), value: gridCost },
          { id: 'bar-solar', label: 'With Solar', cls: 'ev', fmtFn: n => f(n), value: withSolar },
        ]
      };
    }
  },

  // ── 8. UK ROAD TAX SAVINGS ──────────────────────────────────────────────────
  'road-tax': {
    getInputs(region, ov) {
      return [
        { id: 'petrol_ved', label: 'Petrol VED (£/yr)', type: 'number', default: ov.petrol_ved ?? 190, min: 0, max: 600, step: 5, prefix: '£' },
        { id: 'ev_ved', label: 'EV VED (£/yr)', type: 'number', default: ov.ev_ved ?? 0, min: 0, max: 600, step: 5, prefix: '£' },
        { id: 'years', label: 'Years to Calculate', type: 'number', default: ov.years ?? 5, min: 1, max: 20, step: 1 },
      ];
    },
    calculate(v, region) {
      const f = n => fmt(n, '£');
      const annual = v.petrol_ved - v.ev_ved;
      return {
        results: [
          { id: 'petrol_ved_display', label: 'Petrol Annual VED', value: f(v.petrol_ved), color: 'neutral' },
          { id: 'ev_ved_display', label: 'EV Annual VED', value: f(v.ev_ved), color: 'neutral' },
          { id: 'annual_saving', label: 'Annual Saving', value: f(annual), color: annual >= 0 ? 'green' : 'red', span: true },
          { id: 'total_saving', label: `${Math.round(v.years)}-Year Saving`, value: f(annual * v.years), color: annual >= 0 ? 'green' : 'red', span: true },
        ],
        chart: [
          { id: 'bar-petrol', label: 'Petrol VED', cls: 'petrol', fmtFn: n => f(n), value: v.petrol_ved },
          { id: 'bar-ev', label: 'EV VED', cls: 'ev', fmtFn: n => f(n), value: v.ev_ved },
        ]
      };
    }
  },

  // ── 9. UK BIK CALCULATOR ────────────────────────────────────────────────────
  'bik': {
    getInputs(region, ov) {
      return [
        { id: 'p11d', label: 'Car P11D Value (£)', type: 'number', default: ov.p11d ?? 40000, min: 5000, max: 150000, step: 500, prefix: '£' },
        { id: 'bik_pct', label: 'BIK Rate %', type: 'number', default: ov.bik_pct ?? 3, min: 0, max: 37, step: 1 },
        { id: 'tax_rate', label: 'Income Tax Rate %', type: 'select', default: ov.tax_rate ?? 20, options: [{ value: 20, label: '20% Basic Rate' }, { value: 40, label: '40% Higher Rate' }, { value: 45, label: '45% Additional Rate' }] },
      ];
    },
    calculate(v, region) {
      const f = n => fmt(n, '£');
      const bikValue = v.p11d * v.bik_pct / 100;
      const annual = bikValue * v.tax_rate / 100;
      const monthly = annual / 12;
      return {
        results: [
          { id: 'bik_value', label: 'Taxable BIK Value', value: f(bikValue), color: 'neutral' },
          { id: 'annual_tax', label: 'Annual BIK Tax', value: f(annual), color: 'neutral', span: true },
          { id: 'monthly_tax', label: 'Monthly BIK Tax', value: f(monthly), color: 'highlight', span: true },
          { id: 'vs_petrol', label: 'vs 25% Petrol BIK', value: f(v.p11d * 0.25 * v.tax_rate / 100), color: 'neutral', note: 'Petrol equivalent (25% BIK)' },
          { id: 'annual_saving_vs_petrol', label: 'Annual Saving vs Petrol', value: f(v.p11d * (0.25 - v.bik_pct/100) * v.tax_rate/100), color: 'green' },
        ],
        chart: null
      };
    }
  },

  // ── 10. UK SALARY SACRIFICE ─────────────────────────────────────────────────
  'salary-sacrifice': {
    getInputs(region, ov) {
      return [
        { id: 'monthly_sacrifice', label: 'Monthly Gross Sacrifice (£)', type: 'number', default: ov.monthly_sacrifice ?? 500, min: 50, max: 5000, step: 25, prefix: '£' },
        { id: 'tax_rate', label: 'Income Tax Rate %', type: 'select', default: ov.tax_rate ?? 20, options: [{ value: 20, label: '20% Basic Rate' }, { value: 40, label: '40% Higher Rate' }, { value: 45, label: '45% Additional Rate' }] },
        { id: 'ni_rate', label: 'NI Rate %', type: 'number', default: ov.ni_rate ?? 8, min: 0, max: 20, step: 1 },
      ];
    },
    calculate(v, region) {
      const f = n => fmt(n, '£');
      const taxSaving   = v.monthly_sacrifice * v.tax_rate / 100;
      const niSaving    = v.monthly_sacrifice * v.ni_rate / 100;
      const totalSaving = taxSaving + niSaving;
      const netCost     = v.monthly_sacrifice - totalSaving;
      const annualSaving = totalSaving * 12;
      return {
        results: [
          { id: 'gross_sacrifice', label: 'Monthly Gross Sacrifice', value: f(v.monthly_sacrifice), color: 'neutral' },
          { id: 'monthly_tax_save', label: 'Monthly Tax Saving', value: f(taxSaving), color: 'green' },
          { id: 'monthly_ni_save', label: 'Monthly NI Saving', value: f(niSaving), color: 'green' },
          { id: 'net_cost', label: 'Net Monthly Cost', value: f(netCost), color: 'highlight', span: true },
          { id: 'annual_saving', label: 'Annual Tax/NI Saving', value: f(annualSaving), color: 'green', span: true },
        ],
        chart: [
          { id: 'bar-gross', label: 'Gross Cost', cls: 'petrol', fmtFn: n => f(n), value: v.monthly_sacrifice },
          { id: 'bar-net', label: 'Net Cost', cls: 'ev', fmtFn: n => f(n), value: netCost },
        ]
      };
    }
  },

  // ── 11. AU STAMP DUTY ───────────────────────────────────────────────────────
  'stamp-duty': {
    getInputs(region, ov) {
      return [
        { id: 'vehicle_price', label: 'Vehicle Price (AUD)', type: 'number', default: ov.vehicle_price ?? 55000, min: 5000, max: 250000, step: 500, prefix: '$' },
        { id: 'duty_rate', label: 'Stamp Duty Rate %', type: 'number', default: ov.duty_rate ?? 3.0, min: 0, max: 10, step: 0.1 },
        { id: 'ev_discount_pct', label: 'EV Discount %', type: 'number', default: ov.ev_discount_pct ?? 100, min: 0, max: 100, step: 5 },
        { id: 'fixed_fee', label: 'Fixed Registration Fee ($)', type: 'number', default: ov.fixed_fee ?? 350, min: 0, max: 2000, step: 10, prefix: '$' },
      ];
    },
    calculate(v, region) {
      const f = n => fmt(n, '$');
      const standardDuty = v.vehicle_price * v.duty_rate / 100 + v.fixed_fee;
      const discount = standardDuty * v.ev_discount_pct / 100;
      const evDuty = standardDuty - discount;
      return {
        results: [
          { id: 'standard_duty', label: 'Standard Stamp Duty', value: f(standardDuty), color: 'neutral' },
          { id: 'ev_discount', label: 'EV Discount', value: f(discount), color: 'green', span: true },
          { id: 'ev_duty', label: 'EV Stamp Duty Payable', value: f(evDuty), color: evDuty === 0 ? 'green' : 'neutral', span: true },
        ],
        chart: [
          { id: 'bar-standard', label: 'Petrol Car', cls: 'petrol', fmtFn: n => f(n), value: standardDuty },
          { id: 'bar-ev', label: 'EV', cls: 'ev', fmtFn: n => f(n), value: evDuty },
        ]
      };
    }
  },

  // ── 12. US TAX CREDIT ───────────────────────────────────────────────────────
  'tax-credit': {
    getInputs(region, ov) {
      return [
        { id: 'vehicle_price', label: 'Vehicle Price ($)', type: 'number', default: ov.vehicle_price ?? 42000, min: 10000, max: 150000, step: 500, prefix: '$' },
        { id: 'eligible_credit', label: 'Eligible Tax Credit ($)', type: 'number', default: ov.eligible_credit ?? 7500, min: 0, max: 7500, step: 500, prefix: '$' },
        { id: 'tax_liability', label: 'Annual Tax Liability ($)', type: 'number', default: ov.tax_liability ?? 10000, min: 0, max: 100000, step: 500, prefix: '$' },
      ];
    },
    calculate(v, region) {
      const f = n => fmt(n, '$');
      const usable = Math.min(v.eligible_credit, v.tax_liability);
      const netCost = v.vehicle_price - usable;
      return {
        results: [
          { id: 'eligible', label: 'Eligible Credit', value: f(v.eligible_credit), color: 'neutral' },
          { id: 'usable', label: 'Usable Credit', value: f(usable), color: 'green', span: true },
          { id: 'net_cost', label: 'Net Purchase Price', value: f(netCost), color: 'highlight', span: true },
          { id: 'unused', label: 'Unused Credit', value: f(v.eligible_credit - usable), color: v.eligible_credit > v.tax_liability ? 'red' : 'neutral' },
        ],
        chart: [
          { id: 'bar-full', label: 'Full Price', cls: 'petrol', fmtFn: n => f(n), value: v.vehicle_price },
          { id: 'bar-net', label: 'Net Price', cls: 'ev', fmtFn: n => f(n), value: netCost },
        ]
      };
    }
  },

  // ── 13. FLEET COST ──────────────────────────────────────────────────────────
  'fleet': {
    getInputs(region, ov) {
      const p = PRICES[region];
      const sym = p.symbol;
      const dist = getDistUnit(region);
      return [
        { id: 'num_vehicles', label: 'Number of Vehicles', type: 'number', default: ov.num_vehicles ?? 10, min: 1, max: 500, step: 1 },
        { id: 'annual_dist', label: `Annual Distance Each (${dist})`, type: 'number', default: ov.annual_dist ?? (region === 'au' ? 20000 : 12000), min: 1000, max: 100000, step: 1000 },
        { id: 'petrol_annual', label: `Petrol Annual Cost per Vehicle (${sym})`, type: 'number', default: ov.petrol_annual ?? (region === 'us' ? 2000 : 1800), min: 100, max: 20000, step: 100, prefix: sym },
        { id: 'ev_annual', label: `EV Annual Energy Cost per Vehicle (${sym})`, type: 'number', default: ov.ev_annual ?? (region === 'us' ? 800 : 650), min: 50, max: 10000, step: 50, prefix: sym },
        { id: 'ev_premium_per', label: `EV Premium per Vehicle (${sym})`, type: 'number', default: ov.ev_premium_per ?? 8000, min: 0, max: 50000, step: 500, prefix: sym },
      ];
    },
    calculate(v, region) {
      const sym = PRICES[region].symbol;
      const f = n => fmt(n, sym);
      const saving = v.petrol_annual - v.ev_annual;
      const annual = saving * v.num_vehicles;
      const five = annual * 5;
      const monthly = annual / 12;
      const totalPremium = v.ev_premium_per * v.num_vehicles;
      const breakEven = annual > 0 ? totalPremium / annual : Infinity;
      return {
        results: [
          { id: 'saving_per', label: 'Saving per Vehicle/yr', value: f(saving), color: saving >= 0 ? 'green' : 'red' },
          { id: 'annual_fleet', label: 'Annual Fleet Saving', value: f(annual), color: annual >= 0 ? 'green' : 'red', span: true },
          { id: 'monthly_fleet', label: 'Monthly Fleet Saving', value: f(monthly), color: 'highlight', span: true },
          { id: 'five_fleet', label: '5-Year Fleet Saving', value: f(five), color: five >= 0 ? 'green' : 'red' },
          { id: 'fleet_breakeven', label: 'Fleet Break-Even', value: isFinite(breakEven) ? fmtNum(breakEven, 1) + ' yrs' : 'Never', color: breakEven <= 7 ? 'green' : 'red' },
        ],
        chart: [
          { id: 'bar-petrol', label: 'Petrol Fleet (yr)', cls: 'petrol', fmtFn: n => f(n), value: v.petrol_annual * v.num_vehicles },
          { id: 'bar-ev', label: 'EV Fleet (yr)', cls: 'ev', fmtFn: n => f(n), value: v.ev_annual * v.num_vehicles },
        ]
      };
    }
  },

  // ── 14. USED EV VALUE ───────────────────────────────────────────────────────
  'used-ev': {
    getInputs(region, ov) {
      const p = PRICES[region];
      const sym = p.symbol;
      return [
        { id: 'original_price', label: `Original Price (${sym})`, type: 'number', default: ov.original_price ?? (region === 'au' ? 55000 : 40000), min: 5000, max: 200000, step: 500, prefix: sym },
        { id: 'age_years', label: 'Age (years)', type: 'number', default: ov.age_years ?? 3, min: 0, max: 15, step: 1 },
        { id: 'mileage', label: `Mileage (${getDistUnit(region)})`, type: 'number', default: ov.mileage ?? (region === 'au' ? 45000 : 30000), min: 0, max: 300000, step: 1000 },
        { id: 'battery_health', label: 'Battery Health %', type: 'number', default: ov.battery_health ?? 85, min: 50, max: 100, step: 1 },
        { id: 'annual_depreciation', label: 'Annual Depreciation %', type: 'number', default: ov.annual_depreciation ?? 15, min: 1, max: 40, step: 0.5 },
      ];
    },
    calculate(v, region) {
      const sym = PRICES[region].symbol;
      const f = n => fmt(n, sym);
      const baseDepreciation = v.original_price * (1 - Math.pow(1 - v.annual_depreciation / 100, v.age_years));
      const baseValue = Math.max(v.original_price - baseDepreciation, 0);
      const batteryAdjFactor = (v.battery_health - 80) / 100 * 0.20;
      const estimatedValue = Math.max(baseValue * (1 + batteryAdjFactor), 0);
      return {
        results: [
          { id: 'base_value', label: 'Base Depreciated Value', value: f(baseValue), color: 'neutral' },
          { id: 'batt_adj', label: 'Battery Health Adjustment', value: f(estimatedValue - baseValue), color: (estimatedValue - baseValue) >= 0 ? 'green' : 'red' },
          { id: 'est_value', label: 'Estimated Market Value', value: f(estimatedValue), color: 'highlight', span: true },
          { id: 'total_dep', label: 'Total Depreciation', value: f(v.original_price - estimatedValue), color: 'neutral' },
        ],
        chart: null
      };
    }
  },

  // ── 15. EV INSURANCE COST ESTIMATOR ────────────────────────────────────────
  'insurance': {
    getInputs(region, ov) {
      const p = PRICES[region];
      const sym = p.symbol;
      return [
        { id: 'current_insurance', label: `Current Insurance (${sym}/yr)`, type: 'number', default: ov.current_insurance ?? (region === 'us' ? 1400 : region === 'au' ? 1200 : 800), min: 100, max: 10000, step: 50, prefix: sym },
        { id: 'ev_insurance', label: `EV Insurance Estimate (${sym}/yr)`, type: 'number', default: ov.ev_insurance ?? (region === 'us' ? 1600 : region === 'au' ? 1400 : 950), min: 100, max: 10000, step: 50, prefix: sym },
        { id: 'years', label: 'Years', type: 'number', default: ov.years ?? 5, min: 1, max: 20, step: 1 },
      ];
    },
    calculate(v, region) {
      const sym = PRICES[region].symbol;
      const f = n => fmt(n, sym);
      const diff = v.ev_insurance - v.current_insurance;
      const totalDiff = diff * v.years;
      return {
        results: [
          { id: 'petrol_ins', label: 'Current Annual Insurance', value: f(v.current_insurance), color: 'neutral' },
          { id: 'ev_ins', label: 'EV Annual Insurance', value: f(v.ev_insurance), color: 'neutral' },
          { id: 'annual_diff', label: 'Annual Difference', value: (diff >= 0 ? '+' : '') + f(diff), color: diff > 0 ? 'red' : 'green', span: true },
          { id: 'total_diff', label: `${Math.round(v.years)}-Year Difference`, value: (totalDiff >= 0 ? '+' : '') + f(totalDiff), color: totalDiff > 0 ? 'red' : 'green', span: true },
        ],
        chart: [
          { id: 'bar-petrol', label: 'Current', cls: 'ev', fmtFn: n => f(n), value: v.current_insurance },
          { id: 'bar-ev', label: 'EV', cls: 'petrol', fmtFn: n => f(n), value: v.ev_insurance },
        ]
      };
    }
  },

  // ── 16. HOME CHARGER INSTALLATION ───────────────────────────────────────────
  'home-charger': {
    getInputs(region, ov) {
      const p = PRICES[region];
      const sym = p.symbol;
      const isUS = region === 'us';
      const isAU = region === 'au';
      return [
        { id: 'charger_cost', label: `Charger Unit Cost (${sym})`, type: 'number', default: ov.charger_cost ?? (isAU ? 800 : isUS ? 600 : 650), min: 100, max: 5000, step: 50, prefix: sym },
        { id: 'install_cost', label: `Installation Cost (${sym})`, type: 'number', default: ov.install_cost ?? (isAU ? 400 : isUS ? 300 : 450), min: 0, max: 5000, step: 50, prefix: sym },
        { id: 'grant_amount', label: `Grant / Rebate (${sym})`, type: 'number', default: ov.grant_amount ?? (region === 'uk' ? 350 : isAU ? 0 : 0), min: 0, max: 3000, step: 50, prefix: sym },
        { id: 'charging_sessions_pw', label: 'Charging Sessions per Week', type: 'number', default: ov.charging_sessions_pw ?? 4, min: 1, max: 14, step: 1 },
        { id: 'home_rate', label: `Home Rate (${sym}/kWh)`, type: 'number', default: ov.home_rate ?? p.electricity_per_kwh, min: 0.05, max: 1, step: 0.001, prefix: sym },
        { id: 'public_rate', label: `Public Rate (${sym}/kWh)`, type: 'number', default: ov.public_rate ?? p.public_charging_per_kwh, min: 0.10, max: 1.50, step: 0.01, prefix: sym },
        { id: 'kwh_per_session', label: 'kWh per Session', type: 'number', default: ov.kwh_per_session ?? 20, min: 1, max: 80, step: 1 },
      ];
    },
    calculate(v, region) {
      const sym = PRICES[region].symbol;
      const f = n => fmt(n, sym);
      const netCost = v.charger_cost + v.install_cost - v.grant_amount;
      const annualKwh = v.charging_sessions_pw * v.kwh_per_session * 52;
      const annualHomeCharge = annualKwh * v.home_rate;
      const annualPublicCharge = annualKwh * v.public_rate;
      const annualSaving = annualPublicCharge - annualHomeCharge;
      const payback = annualSaving > 0 ? netCost / annualSaving : Infinity;
      return {
        results: [
          { id: 'gross_cost', label: 'Gross Installation Cost', value: f(v.charger_cost + v.install_cost), color: 'neutral' },
          { id: 'grant', label: 'Grant / Rebate', value: f(v.grant_amount), color: 'green' },
          { id: 'net_cost', label: 'Net Installation Cost', value: f(netCost), color: 'highlight', span: true },
          { id: 'annual_saving', label: 'Annual Saving vs Public', value: f(annualSaving), color: annualSaving >= 0 ? 'green' : 'red' },
          { id: 'payback', label: 'Payback Period', value: isFinite(payback) ? fmtNum(payback, 1) + ' yrs' : 'N/A', color: payback <= 5 ? 'green' : 'neutral' },
        ],
        chart: null
      };
    }
  },

  // ── 17. HP GAIN CALCULATOR ──────────────────────────────────────────────────
  'hp-gain': {
    getInputs(region, ov) {
      return [
        { id: 'base_hp', label: 'Current Horsepower (hp)', type: 'number', default: ov.base_hp ?? 150, min: 50, max: 2000, step: 5 },
        { id: 'gain_pct', label: 'Modification Gain %', type: 'number', default: ov.gain_pct ?? 20, min: 1, max: 200, step: 1 },
      ];
    },
    calculate(v, region) {
      const newHp = v.base_hp * (1 + v.gain_pct / 100);
      const gain  = newHp - v.base_hp;
      return {
        results: [
          { id: 'base_hp_d', label: 'Base Horsepower', value: fmtNum(v.base_hp, 0) + ' hp', color: 'neutral' },
          { id: 'gain_hp', label: 'HP Gained', value: '+' + fmtNum(gain, 0) + ' hp', color: 'green', span: true },
          { id: 'new_hp', label: 'New Horsepower', value: fmtNum(newHp, 0) + ' hp', color: 'highlight', span: true },
        ],
        chart: [
          { id: 'bar-base', label: 'Base HP', cls: 'bar-mid', fmtFn: n => fmtNum(n, 0) + ' hp', value: v.base_hp },
          { id: 'bar-new', label: 'New HP', cls: 'ev', fmtFn: n => fmtNum(n, 0) + ' hp', value: newHp },
        ]
      };
    }
  },

  // ── 18. 0-60 CALCULATOR ─────────────────────────────────────────────────────
  'zero-to-sixty': {
    getInputs(region, ov) {
      return [
        { id: 'weight_lbs', label: 'Vehicle Weight (lbs)', type: 'number', default: ov.weight_lbs ?? 3200, min: 1000, max: 8000, step: 50 },
        { id: 'horsepower', label: 'Horsepower (hp)', type: 'number', default: ov.horsepower ?? 250, min: 50, max: 2000, step: 5 },
        { id: 'drivetrain', label: 'Drivetrain', type: 'select', default: ov.drivetrain ?? 1.0, options: [{ value: 1.0, label: 'FWD / RWD' }, { value: 0.92, label: 'AWD (approx -8%)' }] },
      ];
    },
    calculate(v, region) {
      const pwRatio = v.weight_lbs / v.horsepower;
      const t60 = Math.pow(pwRatio / 0.45, 0.55) * parseFloat(v.drivetrain);
      const mph60 = 60;
      const estTopSpeed = Math.sqrt(v.horsepower / (v.weight_lbs / 4000)) * 80;
      return {
        results: [
          { id: 'pw_ratio', label: 'Power-to-Weight', value: fmtNum(v.horsepower / (v.weight_lbs / 2000), 1) + ' hp/tonne', color: 'neutral' },
          { id: 't60', label: 'Estimated 0-60 mph', value: fmtNum(t60, 2) + ' sec', color: 'highlight', span: true },
          { id: 'est_top', label: 'Est. Top Speed', value: fmtNum(Math.min(estTopSpeed, 200), 0) + ' mph', color: 'neutral', note: 'Very rough estimate' },
        ],
        chart: null
      };
    }
  },

  // ── 19. QUARTER MILE ────────────────────────────────────────────────────────
  'quarter-mile': {
    getInputs(region, ov) {
      return [
        { id: 'weight_lbs', label: 'Vehicle Weight (lbs)', type: 'number', default: ov.weight_lbs ?? 3200, min: 1000, max: 8000, step: 50 },
        { id: 'horsepower', label: 'Horsepower (hp)', type: 'number', default: ov.horsepower ?? 250, min: 50, max: 2000, step: 5 },
      ];
    },
    calculate(v, region) {
      const et = 6.269 * Math.pow(v.weight_lbs / v.horsepower, 1/3);
      const trap = 234 / et;
      return {
        results: [
          { id: 'et', label: 'Estimated ET (¼ mile)', value: fmtNum(et, 2) + ' sec', color: 'highlight', span: true },
          { id: 'trap', label: 'Estimated Trap Speed', value: fmtNum(trap, 0) + ' mph', color: 'green', span: true },
          { id: 'note', label: 'Formula', value: 'Wallace Racing (6.269 × ∛(W/HP))', color: 'neutral', span: true },
        ],
        chart: null
      };
    }
  },

  // ── 20. TURBO SIZE ──────────────────────────────────────────────────────────
  'turbo-size': {
    getInputs(region, ov) {
      return [
        { id: 'engine_cc', label: 'Engine Size (cc)', type: 'number', default: ov.engine_cc ?? 2000, min: 500, max: 8000, step: 50 },
        { id: 'target_hp', label: 'Target Horsepower (hp)', type: 'number', default: ov.target_hp ?? 400, min: 50, max: 2000, step: 10 },
        { id: 'rpm', label: 'Peak RPM', type: 'number', default: ov.rpm ?? 6000, min: 2000, max: 10000, step: 200 },
        { id: 'vol_eff', label: 'Volumetric Efficiency %', type: 'number', default: ov.vol_eff ?? 85, min: 50, max: 100, step: 1 },
      ];
    },
    calculate(v, region) {
      const engineLitres = v.engine_cc / 1000;
      const displacementCfm = engineLitres * v.rpm / 1728 * v.vol_eff / 100;
      const requiredCfm = v.target_hp * 0.6;
      const pressureRatio = requiredCfm / displacementCfm;
      const boostPsi = (pressureRatio - 1) * 14.7;
      return {
        results: [
          { id: 'req_cfm', label: 'Required Airflow (CFM)', value: fmtNum(requiredCfm, 0) + ' CFM', color: 'neutral' },
          { id: 'pr', label: 'Pressure Ratio', value: fmtNum(pressureRatio, 2) + ':1', color: 'neutral' },
          { id: 'est_boost', label: 'Estimated Boost Pressure', value: fmtNum(boostPsi, 1) + ' psi', color: 'highlight', span: true },
          { id: 'boost_bar', label: '(in bar)', value: fmtNum(boostPsi * 0.0689476, 2) + ' bar', color: 'neutral' },
        ],
        chart: null
      };
    }
  },

  // ── 21. BOOST PRESSURE ──────────────────────────────────────────────────────
  'boost-pressure': {
    getInputs(region, ov) {
      return [
        { id: 'base_hp', label: 'Current HP (NA or low boost)', type: 'number', default: ov.base_hp ?? 150, min: 50, max: 2000, step: 5 },
        { id: 'target_hp', label: 'Target Horsepower (hp)', type: 'number', default: ov.target_hp ?? 300, min: 50, max: 2000, step: 5 },
        { id: 'current_boost', label: 'Current Boost (psi)', type: 'number', default: ov.current_boost ?? 0, min: 0, max: 50, step: 0.5 },
      ];
    },
    calculate(v, region) {
      const currentMap = v.current_boost + 14.7;
      const targetPressureRatio = v.target_hp / v.base_hp;
      const requiredMap = currentMap * targetPressureRatio;
      const targetBoost = requiredMap - 14.7;
      const extraBoost = targetBoost - v.current_boost;
      return {
        results: [
          { id: 'hp_gain', label: 'HP Increase Required', value: '+' + fmtNum(v.target_hp - v.base_hp, 0) + ' hp', color: 'green' },
          { id: 'target_boost', label: 'Target Boost Pressure', value: fmtNum(targetBoost, 1) + ' psi', color: 'highlight', span: true },
          { id: 'target_bar', label: '(in bar)', value: fmtNum(targetBoost * 0.0689476, 2) + ' bar', color: 'neutral' },
          { id: 'boost_increase', label: 'Boost Increase Needed', value: fmtNum(extraBoost, 1) + ' psi', color: 'green' },
        ],
        chart: null
      };
    }
  },

  // ── 22. MODIFIED CAR INSURANCE IMPACT ───────────────────────────────────────
  'modified-insurance': {
    getInputs(region, ov) {
      return [
        { id: 'base_premium', label: 'Base Annual Premium (£)', type: 'number', default: ov.base_premium ?? 800, min: 100, max: 10000, step: 50, prefix: '£' },
        { id: 'engine_mod_pct', label: 'Engine Mods Impact %', type: 'number', default: ov.engine_mod_pct ?? 25, min: 0, max: 200, step: 5 },
        { id: 'visual_mod_pct', label: 'Visual Mods Impact %', type: 'number', default: ov.visual_mod_pct ?? 10, min: 0, max: 100, step: 5 },
        { id: 'suspension_pct', label: 'Suspension Mods Impact %', type: 'number', default: ov.suspension_pct ?? 10, min: 0, max: 100, step: 5 },
        { id: 'years', label: 'Years', type: 'number', default: ov.years ?? 3, min: 1, max: 20, step: 1 },
      ];
    },
    calculate(v, region) {
      const f = n => fmt(n, '£');
      const totalIncrease = v.engine_mod_pct + v.visual_mod_pct + v.suspension_pct;
      const modifiedPremium = v.base_premium * (1 + totalIncrease / 100);
      const annualIncrease = modifiedPremium - v.base_premium;
      return {
        results: [
          { id: 'base', label: 'Base Premium', value: f(v.base_premium), color: 'neutral' },
          { id: 'total_inc', label: 'Total Premium Increase %', value: '+' + fmtNum(totalIncrease, 0) + '%', color: 'red' },
          { id: 'modified', label: 'Modified Car Premium', value: f(modifiedPremium), color: 'red', span: true },
          { id: 'annual_extra', label: 'Annual Extra Cost', value: f(annualIncrease), color: 'red' },
          { id: 'total_extra', label: `${Math.round(v.years)}-Year Extra Cost`, value: f(annualIncrease * v.years), color: 'red' },
        ],
        chart: [
          { id: 'bar-base', label: 'Base', cls: 'ev', fmtFn: n => f(n), value: v.base_premium },
          { id: 'bar-mod', label: 'Modified', cls: 'petrol', fmtFn: n => f(n), value: modifiedPremium },
        ]
      };
    }
  },

}; // end CONFIGS

// ─── MAIN INIT ────────────────────────────────────────────────────────────────

function clamp(a, min, max) { return Math.min(Math.max(a, min), max); }

export function initCalculator(type, region, overrides = {}) {
  const config = CONFIGS[type];
  if (!config) { console.error('Unknown calculator type:', type); return; }

  const root = document.getElementById('calc-root');
  if (!root) { console.error('#calc-root not found'); return; }

  const sym = getSymbol(region);
  const inputs = config.getInputs(region, overrides);

  // Build inputs HTML
  const sections = [];
  let currentSection = null;
  inputs.forEach(inp => {
    if (inp.sectionLabel) {
      if (currentSection) sections.push({ label: currentSection.label, items: currentSection.items });
      currentSection = { label: inp.sectionLabel, items: [] };
    } else {
      if (!currentSection) currentSection = { label: null, items: [] };
      currentSection.items.push(inp);
    }
  });
  if (currentSection) sections.push({ label: currentSection.label, items: currentSection.items });

  let inputsHtml = '';
  sections.forEach(sec => {
    if (sec.label) inputsHtml += `<p class="section-divider">${sec.label}</p>`;
    sec.items.forEach(inp => { inputsHtml += renderInputGroup(inp, sym); });
  });

  // Initial calculate to get result shapes
  const initialValues = {};
  inputs.filter(i => i.id).forEach(i => { initialValues[i.id] = parseFloat(i.default) || 0; });
  const { results: resultDefs, chart: chartItems } = config.calculate(initialValues, region);

  // Build results HTML
  let resultsHtml = `<div class="result-grid">`;
  resultDefs.forEach(r => { resultsHtml += renderResultCard(r); });
  resultsHtml += `</div>`;
  if (chartItems) resultsHtml += renderChart(chartItems);

  root.innerHTML = renderCalcLayout(inputsHtml, resultsHtml);

  // Set last updated
  const lastUpdated = PRICES[region]?.last_updated || '2026-06-01';
  root.querySelectorAll('[data-last-updated]').forEach(el => el.textContent = lastUpdated);

  // Calculate function
  function runCalc() {
    const vals = {};
    inputs.filter(i => i.id).forEach(inp => {
      vals[inp.id] = parseFloat(document.getElementById(inp.id)?.value) || 0;
    });
    const { results, chart } = config.calculate(vals, region);
    results.forEach(r => { setResult(r.id, r.value); });
    if (chart) updateChart(chart, chart.map(c => c.value));
  }

  // Bind inputs
  bindInputs(root, runCalc);
  root.getElementById?.('calc-btn')?.addEventListener('click', runCalc);
  const btn = root.querySelector('#calc-btn');
  if (btn) btn.addEventListener('click', runCalc);

  runCalc();
}
