/* HireLens AI — Application bootstrap: delegated DOM event listeners and startup.
 * Classic (non-module) script: top-level declarations are shared globals; load order is set in index.html. */
'use strict';

document.addEventListener('click', function (e) {
  var dd = $('#dd'); if (dd && !e.target.closest('#dd')) dd.classList.remove('open');
  var el = e.target.closest('[data-act]'); if (!el) return;
  var a = el.getAttribute('data-act');
  if (el.type === 'checkbox' && e.type === 'click') { /* handled below via change */ return; }
  var fn = actions[a]; if (!fn) return;
  try { fn(el, e); } catch (err) { showDevError('Action "' + a + '" failed: ' + err.message); }
  if (el.closest('.dd-menu')) { var d2 = $('#dd'); if (d2) d2.classList.remove('open'); }
});

document.addEventListener('change', function (e) {
  var t = e.target;
  try {
    if (t.matches && t.matches('input[data-act="sel"]')) { actions.sel(t); return; }
    if (t.id === 'upFile') {
      var f = t.files && t.files[0], msg = $('#upMsg'), btn = $('#upLoad');
      if (!f) { upload = null; btn.disabled = true; msg.textContent = 'Select a resume file (PDF or DOCX, maximum 5 MB).'; return; }
      var isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
      var isDocx = /\.docx$/i.test(f.name);
      if (!isPdf && !isDocx) { upload = { ok: false }; btn.disabled = true; msg.innerHTML = '<span style="color:var(--bad)">Only PDF or DOCX files are supported.</span>'; return; }
      if (f.size > 5 * 1024 * 1024) { upload = { ok: false }; btn.disabled = true; msg.innerHTML = '<span style="color:var(--bad)">This file is larger than 5 MB.</span>'; return; }
      upload = { ok: true, name: f.name, file: f }; btn.disabled = false; btn.textContent = 'Upload & Parse Resume';
      msg.innerHTML = '<span style="color:var(--ok)">Ready to upload.</span> ' + esc(f.name) + ' (' + Math.max(1, Math.round(f.size / 1024)) + ' KB). Press "Upload & Parse Resume" to send it to the server for parsing.';
      return;
    }
    if (t.getAttribute('data-change') === 'setstatus') { actions.status({ dataset: { id: t.getAttribute('data-id'), s: t.value } }); return; }
    if (t.id === 'fJob') { filters.jobId = t.value; refreshTable(); }
    else if (t.id === 'fStatus') { filters.status = t.value; refreshTable(); }
    else if (t.id === 'fSort') { filters.sort = t.value; refreshTable(); }
    else if (t.id === 'fExp') { filters.exp = t.value; refreshTable(); }
    else if (t.id === 'rJob') { filters.jobId = t.value; render(); }
    else if (t.id === 'rStatus') { filters.status = t.value; render(); }
    else if (t.id === 'rMin') { filters.min = Number(t.value) || 0; render(); }
    else if (t.id === 'iqCand') { iqSelId = t.value; render(); }
  } catch (err) { showDevError('Change handler failed: ' + err.message); }
});

document.addEventListener('input', function (e) {
  var t = e.target;
  if (t.id === 'fQ') { filters.q = t.value; refreshTable(); }
  else if (t.id === 'fMin') { filters.min = Number(t.value) || 0; refreshTable(); }
  else if (t.id === 'topSearch') { filters.q = t.value; if (parseRoute(location.hash).page === 'candidates') refreshTable(); }
  else if (t.id === 'rMin' && t.type === 'range') { /* simulator slider handled below */ }
  if (t.hasAttribute && t.hasAttribute('data-simw') && simWeights) {
    var k = t.getAttribute('data-simw'), v = Number(t.value) / 100;
    if (k in simWeights) { simWeights[k] = v; render(); var s2 = $('[data-simw="' + k + '"]'); if (s2) s2.focus(); }
  }
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeModal();
  if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.matches && e.target.matches('th.sortable')) { e.preventDefault(); try { actions.sortk(e.target); } catch (err) { showDevError('Sort failed: ' + err.message); } }
});

document.addEventListener('submit', function (e) {
  var f = e.target; e.preventDefault();
  try {
    if (f.id === 'loginForm') {
      var em = $('#email').value.trim(), pw = $('#password').value, errEl = $('#loginErr'), btn = $('#loginSubmitBtn');
      var isRegister = f.getAttribute('data-mode') === 'register';
      errEl.textContent = ''; btn.disabled = true; btn.innerHTML = '<span class="spin"></span> ' + (isRegister ? 'Creating account…' : 'Signing in…');
      var action = isRegister ? registerWithApi($('#regName').value.trim(), em, pw) : loginWithApi(em, pw);
      action.catch(function (err) {
        if (err instanceof ApiAuthError || /already exists|required|must be/i.test(err.message)) { errEl.textContent = err.message; return; }
        // Network/server unreachable: fall back to the offline demo account so the UI still works.
        backendOnline = false;
        if (!isRegister && authenticate(em, pw)) { loginNow(); return; }
        errEl.textContent = isRegister ? ('Could not create the account: ' + err.message) : 'Invalid email or password, and the server is unreachable. Try demo@hirelens.ai / password for offline demo mode.';
      }).then(function () { btn.disabled = false; btn.textContent = isRegister ? 'Create Account' : 'Sign In'; });
      return;
    }
    var kind = f.getAttribute('data-form');
    if (kind === 'job') {
      var title = $('#jfTitle').value.trim(), company = $('#jfCompany').value.trim(), desc = $('#jfDesc').value.trim(), exp = Number($('#jfExp').value) || 0, err = $('#jfErr');
      if (!title || !company || !desc) { err.textContent = 'Job title, company and description are required.'; return; }
      if (exp < 0 || exp > 40) { err.textContent = 'Experience must be between 0 and 40 years.'; return; }
      var data = { title: title, company: company, location: $('#jfLocation').value.trim() || 'Not specified', exp: exp, edu: $('#jfEdu').value.trim(), req: splitSkills($('#jfReq').value), pref: splitSkills($('#jfPref').value), desc: desc };
      var id = f.getAttribute('data-id');
      var submitBtn = f.querySelector('button.primary'); if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<span class="spin"></span> Saving…'; }
      if (id) {
        API.updateJob(id, data).then(function (updated) { var j = findJob(db, id); Object.assign(j, updated); logEvent('Updated job ' + title); closeModal(); afterChange('Job updated'); })
          .catch(function (e) { var j = findJob(db, id); Object.assign(j, data); j.analysis = null; logEvent('Updated job ' + title + ' (offline)'); closeModal(); afterChange('Job updated offline (' + e.message + ')'); });
      } else {
        API.createJob(data).then(function (created) { db.jobs.push(created); logEvent('Created job ' + title); closeModal(); saveDB(); toast('Job created successfully'); go('#/jobs'); })
          .catch(function (e) { data.id = db.nextJobId++; data.status = 'Open'; data.created = new Date().toISOString(); data.analysis = null; db.jobs.push(data); logEvent('Created job ' + title + ' (offline)'); closeModal(); saveDB(); toast('Job created offline (' + e.message + ')', true); go('#/jobs'); });
      }
    } else if (kind === 'notes') {
      var cid = f.getAttribute('data-id'), c = findCand(db, cid); if (!c) return;
      var notesVal = $('#notesText').value; c.notes = notesVal; saveDB(); toast('Notes saved');
      API.updateCandidate(cid, { notes: notesVal }).catch(function (e) { showDevError('Notes saved locally; server sync failed: ' + e.message); });
    } else if (kind === 'settings') {
      db.settings.name = $('#sName').value.trim() || 'Recruiter'; db.settings.email = $('#sEmail').value.trim(); db.settings.company = $('#sCompany').value.trim() || 'Company'; db.settings.notify = $('#sNotify').checked; db.settings.theme = $('#sTheme').value;
      afterChange('Settings saved');
    }
  } catch (err2) { showDevError('Form error: ' + err2.message); }
});

document.addEventListener('click', function (e) {
  if (e.target && e.target.id === 'demoBtn') { backendOnline = false; loginNow(); return; }
  if (e.target && e.target.id === 'authToggle') {
    e.preventDefault();
    var f = $('#loginForm'), isRegister = f.getAttribute('data-mode') === 'register';
    f.setAttribute('data-mode', isRegister ? 'login' : 'register');
    $('#nameField').style.display = isRegister ? 'none' : 'block';
    $('#loginTitle').textContent = isRegister ? 'Sign in to HireLens' : 'Create your HireLens account';
    $('#loginSub').textContent = isRegister ? 'Enter your credentials to access your workspace.' : 'Set up a recruiter account on this backend.';
    $('#loginSubmitBtn').textContent = isRegister ? 'Sign In' : 'Create Account';
    e.target.textContent = isRegister ? 'New here? Create an account' : 'Already have an account? Sign in';
    $('#loginErr').textContent = '';
  }
});

window.addEventListener('hashchange', function () { render(); window.scrollTo(0, 0); });

function initializeApplication() {
  appEl = document.getElementById('app');
  LOGIN_HTML = appEl.innerHTML;
  db = loadDB();
  window.runSelfTest = showTestResults;
  window.HireLens = { runSelfTest: computeSelfTest, scoreCandidate: scoreCandidate, normalizeSkill: normalizeSkill, resetData: function () { localStorage.removeItem(KEY); setToken(null); location.reload(); } };
  render();
  if (pendingNotice && db.user) { toast(pendingNotice); pendingNotice = ''; }
  // If a JWT is stored (from a previous real sign-in), verify it and refresh jobs/candidates from the server.
  var token = getToken();
  if (token) {
    API.me().then(function (r) {
      backendOnline = true;
      return syncFromServer().then(function () { db.user = { email: r.user.email, name: r.user.name }; saveDB(); render(); });
    }).catch(function () { setToken(null); backendOnline = false; if (db.user && db.user.email !== DEMO_EMAIL) { db.user = null; saveDB(); } render(); });
  }
}

try { initializeApplication(); }
catch (error) {
  showDevError('Startup error: ' + (error && error.message ? error.message : error));
}
