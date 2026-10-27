/* HireLens AI — Hash router: page list, navigation groups, route parsing, render() and go().
 * Classic (non-module) script: top-level declarations are shared globals; load order is set in index.html. */
'use strict';

var PAGES = ['dashboard', 'jobs', 'candidates', 'screening', 'ranking', 'simulator', 'compare', 'interview', 'reports', 'analytics', 'evaluation', 'fairness', 'audit', 'settings'];

var NAVLABEL = { screening: 'Screening', ranking: 'Ranking', simulator: 'Ranking Simulator', compare: 'Compare', interview: 'AI Interview', evaluation: 'AI Evaluation', fairness: 'Fairness', audit: 'Audit Logs' };

var GROUPS = [['Workspace', ['dashboard', 'jobs', 'candidates', 'screening']], ['Decisions', ['ranking', 'compare', 'simulator']], ['Intelligence', ['interview', 'reports', 'analytics', 'evaluation']], ['Governance', ['fairness', 'audit']], ['System', ['settings']]];

function parseRoute(hash) {
  var parts = String(hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
  var page = parts[0] || 'dashboard';
  if (PAGES.indexOf(page) < 0 && page !== 'shortlisted') return { page: 'notfound' };
  return { page: page, id: parts[1] || null, sub: parts[2] || null };
}

function showLogin() { appEl.innerHTML = LOGIN_HTML; }

function render() {
  try {
    document.documentElement.setAttribute('data-theme', db.settings.theme === 'light' ? 'light' : 'dark');
    if (!db.user) { showLogin(); return; }
    var r = parseRoute(location.hash), content;
    switch (r.page) {
      case 'dashboard': content = viewDashboard(); break;
      case 'jobs': content = r.id ? viewJob(r.id) : viewJobs(); break;
      case 'candidates': content = r.id ? viewProfile(r.id) : viewCandidates(); break;
      case 'compare': content = viewCompare(); break;
      case 'shortlisted': content = viewShortlisted(); break;
      case 'screening': content = viewScreening(); break;
      case 'ranking': content = viewRanking(); break;
      case 'simulator': content = viewSimulator(); break;
      case 'interview': content = viewInterview(); break;
      case 'evaluation': content = viewEvaluation(); break;
      case 'fairness': content = viewFairness(); break;
      case 'audit': content = viewAudit(); break;
      case 'reports': content = r.id ? viewReport(r.id) : viewReports(); break;
      case 'analytics': content = viewAnalytics(); break;
      case 'settings': content = viewSettings(); break;
      default: content = viewNotFound();
    }
    appEl.innerHTML = shell(r.page, content);
  } catch (err) {
    showDevError('Render error: ' + (err && err.message ? err.message : err));
    try { appEl.innerHTML = shell('dashboard', '<div class="card"><h2>Something went wrong showing this page</h2><p class="muted">Details are in the error panel below. Use Reset Application Data if the problem repeats.</p><p style="margin-top:10px"><a class="btn" href="#/dashboard">Back to Dashboard</a></p></div>'); } catch (e2) { /* login screen markup remains */ }
  }
}

function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
