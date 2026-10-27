/* HireLens AI — Actions: the data-act click handlers, sign-in/register flows, post-change refresh, in-browser self-test.
 * Classic (non-module) script: top-level declarations are shared globals; load order is set in index.html. */
'use strict';

/* Named computeSelfTest (not runSelfTest) because app.js publishes window.runSelfTest = showTestResults for console use;
 * as a shared global that name would otherwise overwrite this function and recurse forever. */
function computeSelfTest() {
  var res = [];
  function t(name, fn) { try { var ok = fn(); res.push({ name: name, ok: ok === true, detail: ok === true ? '' : 'returned ' + String(ok) }); } catch (e) { res.push({ name: name, ok: false, detail: e && e.message ? e.message : String(e) }); } }
  var d = defaultData();
  t('initialization: #app and login markup exist', function () { return !!appEl && LOGIN_HTML.indexOf('HireLens') >= 0 && LOGIN_HTML.indexOf('Sign In') >= 0; });
  t('localStorage: write, read and remove', function () { localStorage.setItem(TESTKEY, 'ok'); var v = localStorage.getItem(TESTKEY); localStorage.removeItem(TESTKEY); return v === 'ok'; });
  t('localStorage: corrupted JSON is rejected', function () { return parseStored('{not json') === null && parseStored('{"jobs":1}') === null && parseStored(JSON.stringify(d)) !== null; });
  t('default data: 4 jobs, 8 candidates, valid links', function () { return d.jobs.length === 4 && d.cands.length === 8 && validateDB(d); });
  t('login: demo credentials accepted, wrong rejected', function () { return authenticate(DEMO_EMAIL, DEMO_PASS) && !authenticate(DEMO_EMAIL, 'wrong') && !authenticate('', ''); });
  t('navigation: routes parse', function () { var a = parseRoute('#/jobs/2'), b = parseRoute(''), c = parseRoute('#/nope'); return a.page === 'jobs' && a.id === '2' && b.page === 'dashboard' && c.page === 'notfound' && parseRoute('#/compare').page === 'compare'; });
  t('navigation: every page renders', function () { var keep = db; db = d; try { return [viewDashboard, viewJobs, viewCandidates, viewShortlisted, viewReports, viewAnalytics, viewSettings, viewCompare, viewScreening, viewRanking, viewSimulator, viewInterview, viewEvaluation, viewFairness, viewAudit].every(function (f) { return typeof f() === 'string'; }) && viewProfile(1).length > 100 && viewJob(1).length > 100; } finally { db = keep; } });
  t('evaluation dataset: metrics bounded and consistent', function () { var e = evalDataset(); return e.precision >= 0 && e.precision <= 1 && e.recall >= 0 && e.recall <= 1 && e.f1 >= 0 && e.f1 <= 1 && e.consistent === true && e.cases.every(function (c) { return evalRun(c) === true; }); });
  t('skills: normalization', function () { return normalizeSkill('JS') === 'JavaScript' && normalizeSkill('ReactJS') === 'React' && normalizeSkill('React.js') === 'React' && normalizeSkill('Node') === 'Node.js' && normalizeSkill('Mongo DB') === 'MongoDB' && normalizeSkill('Express JS') === 'Express.js' && normalizeSkills(['JS', 'JavaScript']).length === 1; });
  t('scoring: weights sum to 1, scores bounded, overall is calculated', function () {
    var w = WEIGHTS.skills + WEIGHTS.experience + WEIGHTS.semantic + WEIGHTS.education + WEIGHTS.projects;
    if (Math.abs(w - 1) > 1e-9) return 'weights sum ' + w;
    return scoredAll(d).every(function (r) { var s = r.s, e = Math.round(s.skills * .35 + s.experience * .2 + s.semantic * .25 + s.education * .1 + s.projects * .1); return [s.overall, s.skills, s.experience, s.semantic, s.education, s.projects].every(function (v) { return v >= 0 && v <= 100; }) && s.overall === e; });
  });
  t('scoring: stronger candidate outscores weaker one', function () { var a = scoreCandidate(findCand(d, 1), findJob(d, 3)).overall, b = scoreCandidate(findCand(d, 3), findJob(d, 3)).overall; return a > b || 'Aarav ' + a + ' vs Rahul ' + b; });
  t('ranking: sorted descending within each job', function () { return d.jobs.every(function (j) { var r = rankForJob(d, j.id); return r.every(function (x, i) { return x.rank === i + 1 && (i === 0 || r[i - 1].s.overall >= x.s.overall); }); }); });
  t('filtering: search, job, status, minimum score, sort', function () {
    var a = filterCandidates(d, { q: 'aarav' }), b = filterCandidates(d, { jobId: 3 }), c = filterCandidates(d, { status: 'Rejected' }), all = filterCandidates(d, {}), hi = filterCandidates(d, { min: 80 }), skill = filterCandidates(d, { q: 'reactjs' }), low = filterCandidates(d, { sort: 'low' });
    return a.length === 1 && b.length === 3 && c.length === 1 && all.length === 8 && hi.length < all.length && hi.every(function (r) { return r.s.overall >= 80; }) && skill.length >= 3 && low[0].s.overall <= low[low.length - 1].s.overall;
  });
  t('status update: changes status and counts', function () { var before = countStatus(d, 'Hired'); var ok = setStatus(d, 3, 'Hired'); return ok && findCand(d, 3).status === 'Hired' && countStatus(d, 'Hired') === before + 1 && !setStatus(d, 3, 'Bogus') && !setStatus(d, 999, 'New'); });
  t('report: generated with required sections', function () { var keep = db; db = d; try { var r = buildReport(d, 1), h = viewReport(1); return !!r && r.s.overall > 0 && h.indexOf('Candidate Screening Report') >= 0 && h.indexOf('Score') >= 0 && buildReport(d, 999) === null; } finally { db = keep; } });
  t('interview: 5 technical, 3 behavioral, 2 project questions', function () { var c = findCand(d, 1), s = scoreCandidate(c, findJob(d, 3)), q = makeQuestions(c, findJob(d, 3), s); return q.technical.length === 5 && q.behavioral.length === 3 && q.project.length === 2; });
  t('job analysis: extracts skills and experience', function () { var a = analyzeJob(findJob(d, 3)); return a.req.indexOf('React') >= 0 && a.pref.indexOf('Docker') >= 0 && a.expYears === 2; });
  return res;
}

function showTestResults() {
  var r = computeSelfTest(), fails = r.filter(function (x) { return !x.ok; }).length;
  try { console.table(r); } catch (e) { /* ignore */ }
  openModal('<h2>Self-Test: ' + (fails ? fails + ' failed' : 'all ' + r.length + ' passed') + '</h2>' + r.map(function (x) { return '<div class="testrow"><span style="color:' + (x.ok ? 'var(--ok)' : 'var(--bad)') + '">' + (x.ok ? '✓' : '✕') + '</span><span>' + esc(x.name) + (x.ok ? '' : '<br><span class="muted small">' + esc(x.detail) + '</span>') + '</span></div>'; }).join('') + '<div class="row" style="margin-top:14px"><button class="btn primary" data-act="close">Close</button></div>');
  return r;
}

function afterChange(msg, isErr) { saveDB(); invalidateRemote('ranking:'); invalidateRemote('report:'); invalidateRemote('compare:'); invalidateRemote('analytics'); invalidateRemote('audit'); if (msg) toast(msg, isErr); render(); }

function refreshTable() { var t = $('#candTable'); if (t) t.innerHTML = tableRows(candRows()); var b = $('#cmpBtn'); if (b) b.textContent = 'Compare Selected (' + sel.length + ')'; }

var actions = {
  demo: function () { loginNow(); },
  menu: function () { var s = $('#side'); if (s) s.classList.toggle('open'); },
  dd: function () { var d = $('#dd'); if (d) d.classList.toggle('open'); },
  gosettings: function () { go('#/settings'); },
  toggletheme: function () { db.settings.theme = db.settings.theme === 'light' ? 'dark' : 'light'; afterChange('Theme changed'); },
  logout: function () { db.user = null; setToken(null); invalidateRemote(); db = defaultData(); saveDB(); closeModal(); location.hash = ''; render(); },
  close: function () { closeModal(); },
  closebg: function (el, e) { if (e.target === el) closeModal(); },
  print: function () { toast('Report generated'); try { window.print(); } catch (e) { showDevError('Print failed: ' + e.message); } },
  newjob: function () { openModal(jobFormHTML(null)); },
  editjob: function (el) { var j = findJob(db, el.dataset.id); if (j) openModal(jobFormHTML(j)); },
  screen: function (el) { filters.jobId = el.dataset.id; go('#/candidates'); },
  analyze: function (el) {
    var j = findJob(db, el.dataset.id); if (!j) return;
    el.disabled = true; el.innerHTML = '<span class="spin"></span> Analyzing…';
    API.analyzeJobApi(j.id).then(function (a) {
      j.analysis = { req: a.requiredSkills, pref: a.preferredSkills, exp: a.experience.text, expYears: a.experience.years, edu: a.education, resp: a.responsibilities };
      logEvent('Analyzed requirements for ' + j.title); afterChange('Requirements analyzed');
    }).catch(function () {
      // Offline fallback: the frontend has its own deterministic analyzer (same approach as the backend's).
      try { j.analysis = analyzeJob(j); logEvent('Analyzed requirements for ' + j.title + ' (offline)'); afterChange('Requirements analyzed (offline)'); } catch (e) { showDevError('Analysis failed: ' + e.message); render(); }
    });
  },
  applyreq: function (el) {
    var j = findJob(db, el.dataset.id); if (!j || !j.analysis) return;
    var patch = { req: normalizeSkills(j.analysis.req), pref: normalizeSkills(j.analysis.pref) };
    if (j.analysis.expYears) patch.exp = j.analysis.expYears;
    Object.assign(j, patch); logEvent('Updated requirements for ' + j.title); afterChange('Job requirements updated');
    API.updateJob(j.id, patch).catch(function (e) { showDevError('Could not save requirements to server (kept locally): ' + e.message); });
  },
  status: function (el) {
    var id = el.dataset.id, s = el.dataset.s, c = findCand(db, id); if (!c) return;
    var prev = c.status; c.status = s; // optimistic local update so the UI feels instant
    afterChange(s === 'Shortlisted' ? c.name + ' shortlisted' : s === 'Rejected' ? c.name + ' rejected' : c.name + ' moved to ' + s);
    API.updateCandidate(id, { status: s }).then(function (updated) { Object.assign(c, updated); invalidateRemote('report:' + id); }).catch(function (e) { c.status = prev; showDevError('Status update failed (kept locally offline): ' + e.message); afterChange(); });
  },
  sel: function (el) { var id = el.dataset.id, i = sel.indexOf(id); if (i >= 0) sel.splice(i, 1); else if (sel.length >= 4) { el.checked = false; toast('You can compare up to 4 candidates', true); } else sel.push(id); refreshTable(); },
  compare: function () { if (sel.length < 2) toast('Select 2 to 4 candidates first', true); else go('#/compare'); },
  cmpone: function (el) { var id = el.dataset.id; if (sel.indexOf(id) < 0) { if (sel.length >= 4) { toast('You can compare up to 4 candidates', true); return; } sel.push(id); } if (sel.length < 2) toast('Added to comparison. Select one more candidate.'); else go('#/compare'); },
  clearsel: function () { sel = []; render(); },
  questions: function (el) {
    var c = findCand(db, el.dataset.id); if (!c) return;
    el.disabled = true; var prevHtml = el.innerHTML; el.innerHTML = '<span class="spin"></span> Generating…';
    API.generateInterviewQuestions(c.id, c.jobId).then(function (q) {
      el.disabled = false; el.innerHTML = prevHtml;
      openModal(questionsHTML(c, q, q.source === 'ai')); toast(q.source === 'ai' ? 'Interview questions generated by AI' : 'Interview questions generated');
    }).catch(function () {
      el.disabled = false; el.innerHTML = prevHtml;
      openModal(questionsHTML(c)); toast('Interview questions generated (offline)');
    });
  },
  runscreen: function () {
    var pending = scoredAll(db).filter(function (r) { return r.c.status === 'New' || r.c.status === 'Under Review'; });
    if (!pending.length) { toast('No candidates are pending review', true); return; }
    var w = currentWeights();
    toast('Screening ' + pending.length + ' candidate(s)…');
    // Wait for the server to save every screening BEFORE re-rendering, otherwise Ranking/Analytics would
    // fetch stale data. Failures fall back to the local engine result already shown in the UI.
    Promise.all(pending.map(function (r) {
      var s = scoreCandidate(r.c, r.j, w);
      db.screenings.unshift({ t: new Date().toISOString(), candId: r.c.id, jobId: r.j.id, overall: s.overall });
      return API.screenCandidate(r.c.id, r.j.id, w).catch(function () { return null; });
    })).then(function () {
      db.screenings = db.screenings.slice(0, 50);
      logEvent('Batch screening completed for ' + pending.length + ' candidate(s)');
      afterChange('Screening completed for ' + pending.length + ' candidate(s)');
    });
  },
  screenone: function (el) {
    var id = el.dataset.id, c = findCand(db, id); if (!c) return;
    var j = findJob(db, c.jobId);
    el.disabled = true; el.innerHTML = '<span class="spin"></span> Screening…';
    API.screenCandidate(id, c.jobId, currentWeights()).then(function (r) {
      db.screenings.unshift({ t: new Date().toISOString(), candId: id, jobId: c.jobId, overall: r.overallScore });
      db.screenings = db.screenings.slice(0, 50); invalidateRemote('report:' + id);
      afterChange('Screening completed: ' + c.name + ' — ' + r.overallScore + '%');
    }).catch(function (e) {
      // Offline fallback: score with the local engine (identical formula) and record it the same way.
      if (j) { var s = scoreCandidate(c, j); db.screenings.unshift({ t: new Date().toISOString(), candId: id, jobId: j.id, overall: s.overall }); db.screenings = db.screenings.slice(0, 50); afterChange('Screening completed offline: ' + c.name + ' — ' + s.overall + '%'); }
      else { showDevError('Screening failed: ' + e.message); render(); }
    });
  },
  runEval: function (el) { el.disabled = true; el.innerHTML = '<span class="spin"></span> Running evaluation…'; setTimeout(function () { try { var out = $('#evalOut'); if (out) out.innerHTML = evalResultsHTML(); el.disabled = false; el.textContent = 'Run Evaluation'; logEvent('AI evaluation run'); saveDB(); toast('Evaluation complete'); } catch (e) { showDevError('Evaluation failed: ' + e.message); el.disabled = false; el.textContent = 'Run Evaluation'; } }, 400); },
  iqtab: function (el) { iqTab = el.getAttribute('data-tab'); render(); },
  iqgen: function (el) {
    var c = findCand(db, iqSelId); if (!c) return;
    el.disabled = true; el.innerHTML = '<span class="spin"></span> Generating…';
    API.generateInterviewQuestions(c.id, c.jobId).then(function (q) {
      iqResult = q; iqResultFor = c.id; iqTab = 'technical';
      logEvent('Interview kit generated (' + (q.source === 'ai' ? 'AI' : 'template') + ')'); afterChange();
    }).catch(function (e) {
      // Offline fallback: same local template generator the backend itself falls back to.
      var j = findJob(db, c.jobId);
      if (!j) { el.disabled = false; el.textContent = 'Generate Interview Kit'; toast('Could not generate questions for this candidate', true); return; }
      iqResult = makeQuestions(c, j, scoreCandidate(c, j)); iqResult.source = 'offline'; iqResultFor = c.id; iqTab = 'technical';
      afterChange('Generated offline (server unavailable: ' + e.message + ')');
    });
  },
  iqcopy: function () {
    if (!iqResult) return;
    var all = iqResult.technical.concat(iqResult.behavioral, iqResult.project, iqResult.followUp || []);
    try { navigator.clipboard.writeText(all.map(function (q, i) { return (i + 1) + '. ' + q; }).join('\n\n')).then(function () { toast('Questions copied to clipboard'); }, function () { toast('Clipboard unavailable in this browser', true); }); } catch (e) { toast('Clipboard unavailable', true); }
  },
  iqcopyone: function (el) {
    var text = el.getAttribute('data-q') || '';
    try { navigator.clipboard.writeText(text).then(function () { toast('Question copied'); }, function () { toast('Clipboard unavailable in this browser', true); }); } catch (e) { toast('Clipboard unavailable', true); }
  },
  simedit: function () { simWeights = (function () { var w = currentWeights(); return { skills: w.skills, experience: w.experience, semantic: w.semantic, education: w.education, projects: w.projects }; })(); render(); toast('Simulator active — drag the sliders'); },
  simreset: function () { simWeights = null; render(); toast('Reset to saved weights'); },
  simsave: function () {
    if (!simWeights) return;
    var sum = simWeights.skills + simWeights.experience + simWeights.semantic + simWeights.education + simWeights.projects;
    if (Math.abs(sum - 1) > 0.02) { toast('Weights must total 100% before saving (currently ' + Math.round(sum * 100) + '%)', true); return; }
    db.settings.weights = simWeights; simWeights = null; logEvent('Scoring weights updated'); afterChange('Default scoring weights saved');
  },
  selftestbtn: function () { showTestResults(); },
  sortk: function (el) { var k = el.getAttribute('data-k'); if (k === 'score') { filters.sort = filters.sort === 'high' ? 'low' : 'high'; } else { filters.sort = 'new'; } render(); },
  bell: function () {
    openModal('<h2>Notifications</h2>' + (db.log.length ? db.log.slice(0, 5).map(function (l) { return '<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--line)"><span>' + esc(l.m) + '</span><span class="muted small">' + fmtDate(l.t) + '</span></div>'; }).join('') : '<p class="muted">No notifications.</p>') + '<div class="row" style="margin-top:14px"><button class="btn primary" data-act="close">Close</button></div>');
  },
  report: function (el) { toast('Report generated'); go('#/reports/' + el.dataset.id); },
  loadprofile: function (el) {
    if (!upload || !upload.ok) { toast('Select a valid resume file first', true); return; }
    var job = ($('#upJob') || {}).value || (db.jobs[0] && db.jobs[0].id);
    if (!findJob(db, job)) { toast('Create a job first', true); return; }
    if (!upload.file) { actions.loadprofileOffline(job); return; } // e.g. page reloaded with a stale upload flag
    el.disabled = true; el.innerHTML = '<span class="spin"></span> Uploading…';
    API.uploadResume(upload.file, job).then(function (r) {
      db.cands.push(r.candidate); logEvent('Resume uploaded and parsed: ' + r.candidate.name + ' (' + upload.name + ')'); upload = null;
      afterChange(r.warnings.length ? 'Candidate added — ' + r.warnings.join(' ') : 'Resume parsed and candidate added');
    }).catch(function (e) {
      showDevError('Resume upload failed, loading an offline sample profile instead: ' + e.message);
      actions.loadprofileOffline(job);
    });
  },
  /** Offline fallback: loads one of the bundled sample profiles, same as the original browser-only demo. */
  loadprofileOffline: function (job) {
    var idx = -1; for (var i = 0; i < POOL.length; i++) if (db.poolUsed.indexOf(i) < 0) { idx = i; break; }
    if (idx < 0) { toast('All sample profiles are already loaded. Reset demo data to reuse them.', true); return; }
    db.poolUsed.push(idx);
    var p = POOL[idx], c = JSON.parse(JSON.stringify(p));
    c.id = 'offline-' + db.nextCandId++; c.jobId = job; c.email = p.name.toLowerCase().replace(/\s+/g, '.') + '@example.com'; c.status = 'New'; c.notes = ''; c.created = new Date().toISOString();
    db.cands.push(c); logEvent('Offline sample profile "' + p.name + '" loaded for resume ' + (upload && upload.name)); upload = null;
    afterChange('Sample candidate profile loaded (offline)');
  },
  resetask: function () { openModal('<h2>Reset Demo Data?</h2><p class="muted">This restores the original jobs and candidates and clears your changes in this browser.</p><div class="row" style="margin-top:14px"><button class="btn bad" data-act="resetdo">Reset Demo Data</button><button class="btn" data-act="close">Cancel</button></div>'); },
  resetdo: function () { closeModal(); try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } db = defaultData(); db.user = { email: DEMO_EMAIL }; sel = []; upload = null; filters = { q: '', jobId: '', status: '', min: 0, sort: 'high' }; go('#/dashboard'); saveDB(); render(); toast('Demo data reset'); },
  selftest: function (el, e) { e.preventDefault(); showTestResults(); }
};

/** Demo/offline sign-in: used when the user presses "Continue with Demo Account", or when the real
 *  API is unreachable, so the UI never gets stuck on a broken login screen. */
function loginNow(user) { db.user = user || { email: DEMO_EMAIL }; saveDB(); if (!location.hash || location.hash === '#/' || location.hash === '#') location.hash = '#/dashboard'; render(); if (pendingNotice) { toast(pendingNotice); pendingNotice = ''; } }

/** Real sign-in: on success, stores the JWT and pulls jobs/candidates from the server. */
function loginWithApi(email, password) {
  return API.login(email, password).then(function (r) {
    setToken(r.token); backendOnline = true; db.screenings = []; db.log = []; db.poolUsed = []; // drop demo-only activity
    return syncFromServer().then(function () { loginNow({ email: r.user.email, name: r.user.name }); });
  });
}

function registerWithApi(name, email, password) {
  return API.register(name, email, password).then(function (r) {
    setToken(r.token); backendOnline = true; db.jobs = []; db.cands = []; db.screenings = []; db.log = []; db.poolUsed = [];
    loginNow({ email: r.user.email, name: r.user.name });
    toast('Account created. Add a job to get started.');
  });
}
