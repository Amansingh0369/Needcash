// Credits
console.log(
  '%c This website is made by Aman Singh ',
  'background:#309f48;color:#fff;font-size:14px;font-weight:bold;padding:6px 10px;border-radius:4px;'
);
console.log('For contact, email me on singh0369aman@gmail.com');

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

function formatINR(n) {
  return n.toLocaleString('en-IN');
}

function updateCalc() {
  const P = parseInt(loanAmt.value);
  const D = parseInt(loanTerm.value);
  
  const totalRepay = P;

  document.getElementById('loanAmtLabel').textContent  = '₹' + formatINR(P);
  document.getElementById('loanTermLabel').textContent = D + ' days';

  // Calculate Repayment Date (Today + D days)
  const repayDate = new Date();
  repayDate.setDate(repayDate.getDate() + D);
  const options = { day: 'numeric', month: 'short', year: 'numeric' };
  const dateString = repayDate.toLocaleDateString('en-IN', options);

  // Animate total repayment value
  const totalRepayEl = document.getElementById('totalRepayValue');
  totalRepayEl.style.transform  = 'scale(1.05)';
  totalRepayEl.style.transition = 'transform .15s';
  setTimeout(() => { totalRepayEl.style.transform = 'scale(1)'; }, 150);

  totalRepayEl.textContent = formatINR(Math.round(totalRepay));
  document.getElementById('repayDate').textContent = dateString;

  // Update slider track fill
  [loanAmt, loanTerm].forEach(s => {
    const pct = (s.value - s.min) / (s.max - s.min) * 100;
    s.style.background = `linear-gradient(90deg, #309f48 ${pct}%, #e8e8e8 ${pct}%)`;
  });
}

// Calculator only exists on the home page
if (loanAmt && loanTerm) {
  loanAmt.addEventListener('input',  updateCalc);
  loanTerm.addEventListener('input', updateCalc);
  updateCalc();
}
