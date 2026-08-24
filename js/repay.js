/* =========================================================
   LOAN REPAYMENT — Roopya / Easebuzz Pay-in
   Flow: enter PAN -> list loans -> select one -> pay
   ========================================================= */
const REPAY_CFG = {
  base: 'https://api.roopya.money/api/v2/processing-fee',
  domain: 'needcash',
  authKey: 'QLK0708208679',
  apiCode: 'CPLR019'
};

const repayWidget = document.getElementById('repayWidget');

if (repayWidget) {
  const panStep = document.getElementById('repayStepPan');
  const loansStep = document.getElementById('repayStepLoans');
  const panInput = document.getElementById('repayPan');
  const fetchBtn = document.getElementById('repayFetchBtn');
  const panError = document.getElementById('repayPanError');
  const loanList = document.getElementById('repayLoanList');
  const loansNote = document.getElementById('repayLoansNote');
  const payBtn = document.getElementById('repayPayBtn');
  const payError = document.getElementById('repayPayError');
  const backBtn = document.getElementById('repayBackBtn');
  const payReady = document.getElementById('repayReady');

  const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
  let loans = [];
  let selectedIdx = -1;

  const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  const escapeHtml = s => String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  // Loan records vary by tenant, so read the first key that is actually present.
  const pick = (obj, keys) => {
    for (const k of keys) {
      if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
    }
    return undefined;
  };

  const toNum = v => {
    const n = Number(String(v ?? '').replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  function showMsg(el, msg) {
    if (!msg) { el.hidden = true; el.textContent = ''; return; }
    el.textContent = msg;
    el.hidden = false;
  }

  function setBusy(btn, busy, idleLabel) {
    btn.disabled = busy;
    btn.classList.toggle('is-busy', busy);
    btn.querySelector('.repay-btn-label').textContent = busy ? 'Please wait…' : idleLabel;
  }

  async function callApi(path, payload) {
    let res;
    try {
      res = await fetch(REPAY_CFG.base + '/' + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'domain_name': REPAY_CFG.domain },
        body: JSON.stringify({ auth_key: REPAY_CFG.authKey, api_code: REPAY_CFG.apiCode, ...payload })
      });
    } catch (e) {
      throw new Error('Could not reach the payment server. Check your connection and try again.');
    }
    let json;
    try { json = await res.json(); }
    catch (e) { throw new Error('The payment server sent an unreadable response. Please try again.'); }
    if (!res.ok || json.status === false) {
      throw new Error(json.message || 'Something went wrong. Please try again.');
    }
    return json;
  }

  // Formats "2026-07-21T00:00:00.000Z" as "21 Jul 2026"
  function fmtDate(v) {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d)) return String(v);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function normalizeLoan(raw, i) {
    // `amount` is the total payable (principal + interest); `loan_amount` is the principal.
    const amount = toNum(pick(raw, [
      'amount', 'due_amount', 'dueAmount', 'emi_amount', 'emiAmount',
      'payable_amount', 'payableAmount', 'outstanding_amount', 'outstandingAmount',
      'total_amount', 'totalAmount'
    ]));
    const principal = toNum(pick(raw, ['loan_amount', 'loanAmount', 'principal']));
    const statusTxt = String(pick(raw, ['loan_status', 'status', 'loanStatus', 'state']) ?? '').toLowerCase();
    const activeFlag = pick(raw, ['is_active', 'isActive', 'active']);
    const overdue = pick(raw, ['is_overdue', 'isOverdue']) === true;

    let active;
    if (activeFlag !== undefined) {
      active = activeFlag === true || activeFlag === 1 || activeFlag === '1';
    } else if (statusTxt) {
      active = /active|due|overdue|pending|open|disburs/.test(statusTxt) &&
        !/closed|settled|paid|inactive/.test(statusTxt);
    } else {
      active = amount > 0;
    }

    const id = pick(raw, [
      'loan_dtls_id', 'loanDtlsId', 'loan_number', 'loanNumber',
      'loan_id', 'loanId', 'application_id', 'applicationId', 'id'
    ]);

    return {
      raw,
      amount,
      principal,
      overdue,
      active,
      days: toNum(pick(raw, ['number_of_days', 'numberOfDays', 'tenure_days'])),
      statusLabel: statusTxt
        ? statusTxt.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        : (active ? 'Active' : 'Inactive'),
      ref: id !== undefined && id !== null ? ('Loan #' + id) : ('Loan ' + (i + 1)),
      dueDate: fmtDate(pick(raw, [
        'last_emi_date', 'lastEmiDate', 'due_date', 'dueDate',
        'repayment_date', 'repaymentDate', 'next_due_date'
      ])),
      contactId: pick(raw, ['contact_id', 'contactId']),
      leadId: pick(raw, ['lead_id', 'leadId']),
      pipelineId: pick(raw, ['pipeline_id', 'pipelineId'])
    };
  }

  function renderLoans() {
    loanList.innerHTML = '';
    selectedIdx = -1;
    payBtn.disabled = true;
    payBtn.querySelector('.repay-btn-label').textContent = 'Proceed to Pay';

    if (!loans.length) {
      loanList.innerHTML =
        '<div class="repay-empty">' +
        '<strong>No loans found</strong>' +
        '<span>We could not find any outstanding loan against this PAN. ' +
        'If you think this is a mistake, please contact support.</span>' +
        '</div>';
      loansNote.hidden = true;
      return;
    }

    const payable = loans.filter(l => l.active).length;
    loansNote.textContent = payable
      ? 'Select the loan you want to repay.'
      : 'These loans have no pending dues, so they cannot be paid right now.';
    loansNote.hidden = false;

    loans.forEach((loan, i) => {
      // Principal, tenure and due date give context for why the payable differs from the loan amount.
      const meta = [];
      if (loan.principal > 0) meta.push('Principal ' + inr(loan.principal));
      if (loan.days > 0) meta.push(loan.days + ' days');
      if (loan.dueDate) meta.push('Due ' + loan.dueDate);

      const row = document.createElement('label');
      row.className = 'repay-loan' + (loan.active ? '' : ' is-inactive');
      row.innerHTML =
        '<input type="radio" name="repayLoan" value="' + i + '"' + (loan.active ? '' : ' disabled') + '>' +
        '<span class="repay-loan-body">' +
        '<span class="repay-loan-top">' +
        '<span class="repay-loan-ref">' + escapeHtml(loan.ref) + '</span>' +
        '<span class="repay-badges">' +
        '<span class="repay-badge ' + (loan.active ? 'is-active' : 'is-off') + '">' +
        escapeHtml(loan.statusLabel) +
        '</span>' +
        (loan.overdue ? '<span class="repay-badge is-overdue">Overdue</span>' : '') +
        '</span>' +
        '</span>' +
        '<span class="repay-loan-amt">' + inr(loan.amount) + '</span>' +
        (meta.length ? '<span class="repay-loan-due">' + escapeHtml(meta.join(' \u00b7 ')) + '</span>' : '') +
        '</span>';

      row.querySelector('input').addEventListener('change', () => {
        selectedIdx = i;
        payBtn.disabled = false;
        showMsg(payError, '');
        payBtn.querySelector('.repay-btn-label').textContent = 'Pay ' + inr(loan.amount);
        loanList.querySelectorAll('.repay-loan').forEach(el => el.classList.remove('is-picked'));
        row.classList.add('is-picked');
      });

      loanList.appendChild(row);
    });
  }

  async function handleFetch() {
    const pan = panInput.value.trim().toUpperCase();
    panInput.value = pan;

    if (!PAN_RE.test(pan)) {
      showMsg(panError, 'Enter a valid PAN, for example ABCDE1234F.');
      panInput.focus();
      return;
    }
    showMsg(panError, '');
    setBusy(fetchBtn, true, 'Fetch My Loans');

    try {
      const res = await callApi('pan-loan-summary', { panNumber: pan });
      const rows = Array.isArray(res.data) ? res.data : (res.data ? [res.data] : []);

      // Field names differ per tenant — log the raw record so the mapping can be verified.
      if (rows.length) console.log('[repay] raw loan record:', rows[0]);

      loans = rows.map(normalizeLoan);
      renderLoans();
      panStep.hidden = true;
      loansStep.hidden = false;
    } catch (err) {
      showMsg(panError, err.message);
    } finally {
      setBusy(fetchBtn, false, 'Fetch My Loans');
    }
  }

  async function handlePay() {
    const loan = loans[selectedIdx];
    if (!loan) return;

    if (loan.amount <= 0) {
      showMsg(payError, 'This loan has no payable amount.');
      return;
    }
    if (loan.contactId === undefined || loan.leadId === undefined || loan.pipelineId === undefined) {
      console.error('[repay] loan record is missing contact_id / lead_id / pipeline_id:', loan.raw);
      showMsg(payError, 'This loan is missing payment details. Please contact support.');
      return;
    }

    showMsg(payError, '');
    setBusy(payBtn, true, 'Pay ' + inr(loan.amount));

    try {
      const res = await callApi('create-paymentLink-partner', {
        amount: loan.amount,
        description: 'Loan repayment',
        contact_id: loan.contactId,
        lead_id: loan.leadId,
        pipeline_id: loan.pipelineId,
        reason: 'Loan repayment via website'
      });

      const url = res.data && (res.data.payUrl || res.data.short_url);
      if (!url) throw new Error('Could not start the payment. Please try again.');

      // Log the link id so a failed Easebuzz page can be traced back to a payment.
      console.log('[repay] payment link', res.data.link_id, url);

      // Easebuzz occasionally serves "Could Not Load Payment Page" when a link is
      // opened the instant it is created, so give it a moment and always leave a
      // clickable link in case the automatic redirect lands badly.
      payReady.querySelector('.repay-ready-amt').textContent = inr(loan.amount);
      const link = payReady.querySelector('.repay-ready-link');
      link.href = url;
      loansStep.hidden = true;
      payReady.hidden = false;
      setTimeout(() => { window.location.href = url; }, 1200);
      return;
    } catch (err) {
      showMsg(payError, err.message);
      setBusy(payBtn, false, 'Pay ' + inr(loan.amount));
    }
  }

  fetchBtn.addEventListener('click', handleFetch);
  panInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleFetch(); });
  panInput.addEventListener('input', () => showMsg(panError, ''));
  payBtn.addEventListener('click', handlePay);
  backBtn.addEventListener('click', () => {
    loansStep.hidden = true;
    payReady.hidden = true;
    panStep.hidden = false;
    showMsg(payError, '');
    panInput.focus();
  });
}
