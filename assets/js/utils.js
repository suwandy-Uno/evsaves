import { PRICES } from './prices.js';

export function fmt(n, symbol = '£', decimals = 0) {
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  return `${symbol}${formatted}`;
}

export function fmtNum(n, decimals = 1) {
  return n.toLocaleString('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

export function fmtCurrency(n, symbol, decimals = 0) {
  return fmt(n, symbol, decimals);
}

export function getSymbol(region) {
  return PRICES[region]?.symbol || '£';
}

export function getDistUnit(region) {
  return PRICES[region]?.distance_unit || 'miles';
}

export function getLastUpdated(region) {
  return PRICES[region]?.last_updated || '2026-06-01';
}

export function initNav() {
  const toggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');
  if (toggle && navLinks) {
    toggle.addEventListener('click', () => {
      const open = navLinks.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open);
    });
    document.addEventListener('click', (e) => {
      if (!toggle.contains(e.target) && !navLinks.contains(e.target)) {
        navLinks.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }
}

export function initFaq() {
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const answer = btn.nextElementSibling;
      const isOpen = answer.classList.contains('open');
      document.querySelectorAll('.faq-answer').forEach(a => a.classList.remove('open'));
      document.querySelectorAll('.faq-question').forEach(b => b.setAttribute('aria-expanded', 'false'));
      if (!isOpen) {
        answer.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });
}

export function setLastUpdated(region) {
  document.querySelectorAll('[data-last-updated]').forEach(el => {
    el.textContent = getLastUpdated(region);
  });
}

export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}
