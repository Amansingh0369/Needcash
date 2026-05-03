// Nav scroll effect
window.addEventListener('scroll', () => {
  document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 20);
});

// Cursor glow
const glow = document.getElementById('cursorGlow');
document.addEventListener('mousemove', e => {
  glow.style.left = e.clientX + 'px';
  glow.style.top = e.clientY + 'px';
});

// Scroll reveal
const revealEls = document.querySelectorAll('.reveal');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
revealEls.forEach(el => revealObserver.observe(el));

// Calculator
const loanAmt  = document.getElementById('loanAmt');
const loanTerm = document.getElementById('loanTerm');
const loanRate = document.getElementById('loanRate');

function formatINR(n) {
  return n.toLocaleString('en-IN');
}

function updateCalc() {
  const P = parseInt(loanAmt.value);
  const N = parseInt(loanTerm.value);
  const annualRate = parseFloat(loanRate.value);
  const R = annualRate / 12 / 100;

  document.getElementById('loanAmtLabel').textContent  = '₹' + formatINR(P);
  document.getElementById('loanTermLabel').textContent = N + ' months';
  document.getElementById('loanRateLabel').textContent = annualRate + '% (per annum)';

  let emi;
  if (R === 0) {
    emi = P / N;
  } else {
    emi = P * R * Math.pow(1 + R, N) / (Math.pow(1 + R, N) - 1);
  }
  const totalRepay    = emi * N;
  const totalInterest = totalRepay - P;

  // Animate EMI value
  const emiEl = document.getElementById('emiValue');
  emiEl.style.transform  = 'scale(1.05)';
  emiEl.style.transition = 'transform .15s';
  setTimeout(() => { emiEl.style.transform = 'scale(1)'; }, 150);

  emiEl.textContent = formatINR(Math.round(emi));
  document.getElementById('totalRepay').textContent    = '₹ ' + formatINR(Math.round(totalRepay));
  document.getElementById('totalInterest').textContent = '₹ ' + formatINR(Math.round(totalInterest));

  // Update slider track fill
  [loanAmt, loanTerm, loanRate].forEach(s => {
    const pct = (s.value - s.min) / (s.max - s.min) * 100;
    s.style.background = `linear-gradient(90deg, #309f48 ${pct}%, #e8e8e8 ${pct}%)`;
  });
}

loanAmt.addEventListener('input',  updateCalc);
loanTerm.addEventListener('input', updateCalc);
loanRate.addEventListener('input', updateCalc);
updateCalc();
