/* HireLens AI — Views: icons, view helpers, chart helpers, every page renderer, modals and the app shell.
 * Classic (non-module) script: top-level declarations are shared globals; load order is set in index.html. */
'use strict';

var ICONS = {
  dashboard: 'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z',
  jobs: 'M3 7h18v13H3zM9 7V4h6v3',
  candidates: 'M16 8a4 4 0 1 0-8 0 4 4 0 0 0 8 0M4 21a8 8 0 0 1 16 0',
  shortlisted: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  reports: 'M6 3h9l4 4v14H6zM9 12h7M9 16h7',
  analytics: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3',
  menu: 'M4 6h16M4 12h16M4 18h16',
  screening: 'M4 5h16M4 12h16M4 19h10M16 15l2 2 4-4',
  ranking: 'M5 20v-8M12 20V5M19 20v-5M3 20h18',
  simulator: 'M4 8h9M17 8h3M14 5v6M4 16h3M11 16h9M7 13v6',
  compare: 'M8 3v18M16 3v18M3 8h4M3 16h4M17 8h4M17 16h4',
  interview: 'M4 5h16v10H8l-4 4zM8 9h8',
  evaluation: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3',
  fairness: 'M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6zM9 12l2 2 4-4',
  audit: 'M8 6h11M8 12h11M8 18h11M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  check: 'M5 13l4 4 10-10',
  xmark: 'M6 6l12 12M18 6L6 18',
  minus: 'M5 12h14',
  plus: 'M12 5v14M5 12h14',
  bell: 'M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 0 0 4 0',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19'
};

function icon(n) { return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="' + ICONS[n] + '"/></svg>'; }

function toast(msg, isErr) {
  var box = $('#toasts'); if (!box) return;
  var t = document.createElement('div'); t.className = 'toast' + (isErr ? ' err' : ''); t.textContent = msg; box.appendChild(t);
  setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3000);
}

function badge(s) { return '<span class="badge" style="--c:' + SCOLOR[s] + '">' + esc(s) + '</span>'; }

function scoreCell(v) { var cls = v >= 80 ? 'good' : v >= 60 ? 'warn' : 'bad'; return '<div class="scorecell"><b>' + v + '%</b><span class="minibar" aria-hidden="true"><i class="' + cls + '" style="width:' + v + '%"></i></span></div>'; }

function skillGroup(title, list, ic, cls) {
  return '<h3 style="margin-bottom:4px">' + title + '</h3>' + (list && list.length ? list.map(function (x) { return '<div class="fairrow ' + cls + '"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="' + ICONS[ic] + '"/></svg> ' + esc(x) + '</div>'; }).join('') : '<p class="muted small">None</p>');
}

function scoreWord(v) { return v >= 85 ? 'Excellent match' : v >= 70 ? 'Strong match' : v >= 55 ? 'Moderate match' : 'Below requirements'; }

function def(k, v) { return '<div class="defrow"><dt>' + k + '</dt><dd style="margin:0">' + v + '</dd></div>'; }

function chips(list, cls) {
  if (!list || !list.length) return '<span class="muted">None</span>';
  return list.map(function (x) { return '<span class="chip ' + (cls || '') + '">' + (cls === 'y' ? '✓ ' : cls === 'n' ? '✕ ' : '') + esc(x) + '</span>'; }).join('');
}

function ul(list) { return list && list.length ? '<ul class="plain">' + list.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '<p class="muted">None</p>'; }

function meter(label, v) { return '<div class="bar"><span>' + label + '</span><div class="track"><i style="width:' + v + '%"></i></div><b>' + v + '%</b></div>'; }

function ring(v) { return '<div class="ring" style="--p:' + v + '" role="img" aria-label="Overall match ' + v + ' percent"><b>' + v + '%</b></div>'; }

function hbars(entries) {
  if (!entries.length) return '<p class="muted">No data yet.</p>';
  var max = maxOf(entries, function (e) { return e[1]; });
  return entries.map(function (e) { return '<div class="bar"><span title="' + esc(e[0]) + '">' + esc(e[0]) + '</span><div class="track"><i style="width:' + (e[1] / max * 100) + '%"></i></div><b>' + e[1] + '</b></div>'; }).join('');
}

function columns(entries) {
  var max = maxOf(entries, function (e) { return e[1]; }), bw = 36, gap = (300 - entries.length * bw) / (entries.length + 1), out = '';
  entries.forEach(function (e, i) {
    var bh = e[1] / max * 90, x = gap + i * (bw + gap), y = 108 - bh;
    out += '<rect class="col" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw + '" height="' + Math.max(bh, 1).toFixed(1) + '" rx="4"/><text class="cv" x="' + (x + bw / 2).toFixed(1) + '" y="' + (y - 5).toFixed(1) + '">' + e[1] + '</text><text class="cl" x="' + (x + bw / 2).toFixed(1) + '" y="126">' + esc(e[0]) + '</text>';
  });
  return '<svg class="cols" viewBox="0 0 300 134" role="img" aria-label="Score distribution chart">' + out + '</svg>';
}

function donut(entries) {
  var total = entries.reduce(function (a, e) { return a + e[1]; }, 0);
  if (!total) return '<p class="muted">No data yet.</p>';
  var r = 42, C = 2 * Math.PI * r, off = 0, segs = '';
  entries.forEach(function (e) {
    if (!e[1]) return;
    var len = e[1] / total * C;
    segs += '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="' + SCOLOR[e[0]] + '" stroke-width="16" stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 60 60)"/>';
    off += len;
  });
  return '<div class="donut"><svg viewBox="0 0 120 120" role="img" aria-label="Candidates by status">' + segs + '<text class="dn" x="60" y="67" text-anchor="middle">' + total + '</text></svg><ul class="legend">' +
    entries.map(function (e) { return '<li><i style="background:' + SCOLOR[e[0]] + '"></i>' + esc(e[0]) + ' <b>' + e[1] + '</b></li>'; }).join('') + '</ul></div>';
}

function topCounts(list) {
  var m = {}; list.forEach(function (x) { m[x] = (m[x] || 0) + 1; });
  return Object.keys(m).map(function (k) { return [k, m[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8);
}

function distBuckets(rows) {
  var d = [['0-40', 0], ['41-60', 0], ['61-75', 0], ['76-90', 0], ['91-100', 0]];
  rows.forEach(function (r) { var o = r.s.overall; d[o <= 40 ? 0 : o <= 60 ? 1 : o <= 75 ? 2 : o <= 90 ? 3 : 4][1]++; });
  return d;
}

function stats(d) {
  var rows = scoredAll(d), n = d.cands.length;
  return {
    rows: rows, total: n, jobs: d.jobs.length, short: countStatus(d, 'Shortlisted'), review: countStatus(d, 'Under Review'), rejected: countStatus(d, 'Rejected'),
    avg: rows.length ? Math.round(rows.reduce(function (a, r) { return a + r.s.overall; }, 0) / rows.length) : 0
  };
}

function head(title, sub, actions) { return '<div class="head"><div><h1>' + title + '</h1><p class="muted">' + sub + '</p></div><div class="row noprint">' + (actions || '') + '</div></div>'; }

function viewDashboard() {
  var st = stats(db);
  var nowH = new Date().getHours();
  var greet = nowH < 12 ? 'Good morning' : nowH < 18 ? 'Good afternoon' : 'Good evening';
  var screened = (db.screenings || []).length || db.cands.filter(function (c) { return c.status !== 'New'; }).length;
  var cards = [['Open Roles', db.jobs.filter(function (j) { return j.status === 'Open'; }).length], ['Candidates', st.total], ['Screened', screened], ['Shortlisted', st.short], ['Average Match', st.avg + '%']];
  var pipeline = STATUSES.map(function (s) { return '<a href="#/candidates"><span>' + s + '</span><b>' + countStatus(db, s) + '</b></a>'; }).join('');
  var recent = st.rows.slice().sort(function (a, b) { return new Date(b.c.created) - new Date(a.c.created); }).slice(0, 6);
  return head(greet + ', ' + esc((db.settings.name || 'Recruiter').split(' ')[0]), 'Recruitment overview for your active roles') +
    '<div class="grid g5" style="margin-bottom:14px">' + cards.map(function (c) { return '<div class="card stat kpi"><b>' + c[1] + '</b><span>' + c[0] + '</span></div>'; }).join('') + '</div>' +
    '<div class="pgtable"><div><div class="card" style="margin-bottom:14px"><h2>Candidate Pipeline</h2><div class="pipeline">' + pipeline + '</div></div>' +
    '<div class="card"><h2>Recent Candidates</h2>' + (recent.length ? '<div class="tablewrap" style="border:0"><table class="rt"><thead><tr><th>Candidate</th><th>Position</th><th>Match</th><th>Status</th><th>Added</th></tr></thead><tbody>' +
      recent.map(function (r) { return '<tr><td data-l="Candidate"><a href="#/candidates/' + r.c.id + '"><b>' + esc(r.c.name) + '</b></a></td><td data-l="Position">' + esc(r.j.title) + '</td><td data-l="Match">' + scoreCell(r.s.overall) + '</td><td data-l="Status">' + badge(r.c.status) + '</td><td data-l="Added">' + fmtDate(r.c.created) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="empty">No candidates yet. <a href="#/candidates">Add candidates</a> to see them here.</div>') + '</div></div>' +
    '<div class="profile-rail"><div class="card"><h2>Score Distribution</h2>' + columns(distBuckets(st.rows)) + '</div>' +
    '<div class="card"><h2>Recent Activity</h2>' + (db.log.length ? db.log.slice(0, 6).map(function (l) { return '<div class="row between" style="padding:5px 0;border-bottom:1px solid var(--line)"><span>' + esc(l.m) + '</span><span class="muted small">' + fmtDate(l.t) + '</span></div>'; }).join('') : '<p class="muted">No activity yet.</p>') + '</div></div></div>';
}

function viewJobs() {
  return head('Jobs', 'Manage open positions and candidate pipelines', '<button class="btn primary" data-act="newjob">' + icon('plus') + 'Create Job</button>') +
    (db.jobs.length ? '<div class="card" style="padding:0;overflow:hidden"><div class="tablewrap" style="border:0"><table class="rt"><thead><tr><th>Job Title</th><th>Company</th><th>Location</th><th>Experience</th><th>Candidates</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>' +
      db.jobs.map(function (j) {
        var n = db.cands.filter(function (c) { return c.jobId === j.id; }).length;
        return '<tr><td data-l="Job Title"><a href="#/jobs/' + j.id + '"><b>' + esc(j.title) + '</b></a><span class="sub">' + chips(j.req.slice(0, 3)) + '</span></td><td data-l="Company">' + esc(j.company) + '</td><td data-l="Location">' + esc(j.location) + '</td><td data-l="Experience">' + (j.exp || 0) + '+ yrs</td><td data-l="Candidates">' + n + '</td><td data-l="Status"><span class="badge" style="--c:#16805C">' + esc(j.status) + '</span></td><td data-l="Created">' + fmtDate(j.created) + '</td><td data-l="Actions"><div class="row"><a class="btn sm" href="#/jobs/' + j.id + '">View</a><button class="btn sm" data-act="editjob" data-id="' + j.id + '">Edit</button><button class="btn sm" data-act="screen" data-id="' + j.id + '">Screen</button></div></td></tr>';
      }).join('') + '</tbody></table></div></div>' : '<div class="empty">No jobs yet. Create your first job to start screening.</div>');
}

function viewJob(id) {
  var j = findJob(db, id); if (!j) return viewNotFound();
  var a = j.analysis, ranked = rankForJob(db, j.id), nC = db.cands.filter(function (c) { return c.jobId === j.id; }).length;
  return head(esc(j.title), esc(j.company) + ' · ' + esc(j.location) + ' · Open role', '<button class="btn" data-act="editjob" data-id="' + j.id + '">Edit</button><button class="btn" data-act="analyze" data-id="' + j.id + '">Analyze Requirements</button><button class="btn primary" data-act="screen" data-id="' + j.id + '">Screen Candidates</button>') +
    '<div class="pgtable"><div><div class="card" style="margin-bottom:14px"><h2>Job Description</h2><p>' + esc(j.desc) + '</p>' +
    def('Experience', (j.exp || 0) + '+ years') + def('Education', esc(j.edu || 'Not specified')) + def('Location', esc(j.location)) + def('Company', esc(j.company)) +
    '<h3 style="margin-top:12px">Required skills</h3>' + chips(j.req) + '<h3 style="margin-top:8px">Preferred skills</h3>' + chips(j.pref) + '</div>' +
    '<div class="card" style="margin-bottom:14px"><h2>Requirement Analysis — Demo Engine</h2>' + (a ?
      '<p class="muted small">Deterministic keyword and pattern analysis in your browser. It is not an AI model.</p><h3 style="margin-top:8px">Required skills</h3>' + chips(a.req) + '<h3>Preferred skills</h3>' + chips(a.pref) + '<p style="margin-top:8px">Experience: ' + esc(a.exp) + '<br>Education: ' + esc(a.edu) + '</p><h3>Responsibilities</h3>' + ul(a.resp) + '<button class="btn sm" style="margin-top:8px" data-act="applyreq" data-id="' + j.id + '">Use as job requirements</button>'
      : '<p class="muted">Select "Analyze Requirements" to extract skills, experience, education and responsibilities from the job description.</p>') + '</div>' +
    '</div><div class="profile-rail"><div class="card"><h2>At a Glance</h2>' + def('Status', '<span class="badge" style="--c:#16805C">' + esc(j.status) + '</span>') + def('Candidates', String(nC)) + def('Experience', (j.exp || 0) + '+ years') + def('Education', esc(j.edu || 'Not specified')) + def('Created', fmtDate(j.created)) + '</div>' +
    '<div class="card"><h2>Top Ranked</h2>' + (ranked.length ? ranked.slice(0, 5).map(function (r) { return '<div class="row between" style="padding:5px 0"><a href="#/candidates/' + r.c.id + '">' + esc(r.c.name) + '</a><b>' + r.s.overall + '%</b></div>'; }).join('') : '<p class="muted">No candidates yet.</p>') + '</div></div></div>' +
    '<div class="card" style="margin-top:14px"><h2>Ranked Candidates</h2>' + (ranked.length ? '<div class="tablewrap" style="border:0"><table class="rt"><thead><tr><th>Rank</th><th>Candidate</th><th>Match</th><th>Status</th><th></th></tr></thead><tbody>' + ranked.map(function (r) { return '<tr><td data-l="Rank">#' + r.rank + '</td><td data-l="Candidate"><a href="#/candidates/' + r.c.id + '"><b>' + esc(r.c.name) + '</b></a></td><td data-l="Match">' + scoreCell(r.s.overall) + '</td><td data-l="Status">' + badge(r.c.status) + '</td><td><a class="btn sm" href="#/candidates/' + r.c.id + '">View</a></td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="muted">No candidates yet. Upload a resume from the Candidates page.</p>') + '</div>';
}

function tableRows(rows) {
  if (!rows.length) return '<div class="empty">No candidates match these filters. Clear a filter or add a candidate profile.</div>';
  return '<div class="tablewrap" style="border:0"><table class="rt"><thead><tr><th>Compare</th><th>Rank</th><th>Candidate</th><th data-act="sortk" data-k="score" class="sortable' + (filters.sort === 'high' || filters.sort === 'low' ? ' sorted' : '') + '" role="button" tabindex="0" aria-label="Sort by match score">Match' + (filters.sort === 'low' ? ' <span class="arr">↑</span>' : filters.sort === 'high' ? ' <span class="arr">↓</span>' : '') + '</th><th>Skills</th><th data-act="sortk" data-k="new" class="sortable' + (filters.sort === 'new' ? ' sorted' : '') + '" role="button" tabindex="0" aria-label="Sort by date added">Updated</th><th>Experience</th><th>Status</th><th>Actions</th></tr></thead><tbody>' +
    rows.map(function (r) {
      return '<tr><td data-l="Compare"><input type="checkbox" data-act="sel" data-id="' + r.c.id + '" aria-label="Select ' + esc(r.c.name) + ' for comparison"' + (sel.indexOf(r.c.id) >= 0 ? ' checked' : '') + '></td>' +
        '<td data-l="Rank">#' + r.rank + '</td><td data-l="Candidate"><a href="#/candidates/' + r.c.id + '"><b>' + esc(r.c.name) + '</b></a><span class="sub">' + esc(r.j.title) + '</span></td>' +
        '<td data-l="Match">' + scoreCell(r.s.overall) + '</td><td data-l="Skills">' + r.s.skills + '% <span class="muted small">(' + r.s.matchedReq.length + '/' + r.j.req.length + ' required)</span></td>' +
        '<td data-l="Updated">' + fmtDate(r.c.created) + '</td><td data-l="Experience">' + totalYears(r.c) + ' yrs</td><td data-l="Status">' + badge(r.c.status) + '</td>' +
        '<td data-l="Actions"><div class="row"><a class="btn sm" href="#/candidates/' + r.c.id + '">View</a><button class="btn sm ok" data-act="status" data-id="' + r.c.id + '" data-s="Shortlisted">Shortlist</button><button class="btn sm bad" data-act="status" data-id="' + r.c.id + '" data-s="Rejected">Reject</button><a class="btn sm" href="#/reports/' + r.c.id + '">Report</a></div></td></tr>';
    }).join('') + '</tbody></table></div>';
}

function viewCandidates() {
  return head('Candidates', 'Review and evaluate candidates across active roles', '<button class="btn primary" id="cmpBtn" data-act="compare">Compare Selected (' + sel.length + ')</button>') +
    '<div class="card" style="margin-bottom:14px"><h2>Add Candidate</h2><div class="filters" style="margin-bottom:8px"><select id="upJob" aria-label="Job for this resume">' + db.jobs.map(function (j) { return '<option value="' + j.id + '"' + (String(filters.jobId) === String(j.id) ? ' selected' : '') + '>' + esc(j.title) + '</option>'; }).join('') + '</select>' +
    '<input type="file" id="upFile" accept="application/pdf,.pdf,.docx" aria-label="Resume PDF or DOCX"><button class="btn primary" id="upLoad" data-act="loadprofile" disabled>Upload & Parse Resume</button></div>' +
    '<p id="upMsg" class="muted small">Select a resume file (PDF or DOCX, maximum 5 MB) and a job, then upload it to be parsed on the server.</p></div>' +
    '<div class="card" style="padding:12px 16px"><div class="filters" style="margin-bottom:0"><input id="fQ" placeholder="Search candidates..." aria-label="Search candidates" value="' + esc(filters.q) + '">' +
    '<select id="fJob" aria-label="Filter by job"><option value="">Job: All jobs</option>' + db.jobs.map(function (j) { return '<option value="' + j.id + '"' + (String(filters.jobId) === String(j.id) ? ' selected' : '') + '>' + esc(j.title) + '</option>'; }).join('') + '</select>' +
    '<select id="fStatus" aria-label="Filter by status"><option value="">Status: All</option>' + STATUSES.map(function (s) { return '<option' + (filters.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +
    '<select id="fExp" aria-label="Filter by experience"><option value="">Experience: Any</option><option value="1">1+ yrs</option><option value="2">2+ yrs</option><option value="3">3+ yrs</option><option value="5">5+ yrs</option></select>' +
    '<input id="fMin" type="number" min="0" max="100" placeholder="Match: 80%+" aria-label="Minimum score" value="' + (filters.min || '') + '">' +
    '<select id="fSort" aria-label="Sort"><option value="high"' + (filters.sort === 'high' ? ' selected' : '') + '>Highest match</option><option value="low"' + (filters.sort === 'low' ? ' selected' : '') + '>Lowest match</option><option value="new"' + (filters.sort === 'new' ? ' selected' : '') + '>Newest</option></select></div></div>' +
    '<div class="card" style="padding:12px 16px"><div id="candTable">' + tableRows(candRows()) + '</div></div>';
}

function candRows() {
  var rows = filterCandidates(db, filters);
  if (filters.exp) rows = rows.filter(function (r) { return totalYears(r.c) >= Number(filters.exp); });
  return rows;
}

function viewProfile(id) {
  var c = findCand(db, id), j = c && findJob(db, c.jobId); if (!j) return viewNotFound();
  var s = scoreCandidate(c, j), rank = scoredAll(db).filter(function (r) { return r.c.id === c.id; })[0].rank;
  return head(esc(c.name), esc(j.title) + ' · ' + esc(c.email), '<button class="btn primary" data-act="report" data-id="' + c.id + '">Generate Report</button>') +
    '<div class="pgtable"><div>' +
    '<div class="card" style="margin-bottom:14px"><div class="row" style="gap:16px">' + ring(s.overall) + '<div><h2 style="margin:0">Match for ' + esc(j.title) + '</h2><p class="muted">Rank #' + rank + ' for this role · ' + scoreWord(s.overall) + '</p><p style="margin:6px 0">' + badge(c.status) + '</p><select data-change="setstatus" data-id="' + c.id + '" aria-label="Set status">' + STATUSES.map(function (t) { return '<option' + (c.status === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></div></div>' +
    '<div style="margin-top:14px">' + meter('Skills', s.skills) + meter('Experience', s.experience) + meter('Relevance', s.semantic) + meter('Education', s.education) + meter('Projects', s.projects) + '</div>' +
    '<p class="muted small" style="margin-top:8px">Relevance is keyword overlap in demo mode, not an LLM embedding.</p></div>' +
    '<div class="card" style="margin-bottom:14px"><h2>Screening Insights</h2><h3>Why This Score</h3><p class="small">' + esc(s.explanation) + '</p>' +
    '<h3 style="margin-top:10px">Experience match</h3><p class="muted small">' + esc(s.notes.experience) + '</p>' +
    '<h3 style="margin-top:8px">Education match</h3><p class="muted small">' + esc(s.notes.education) + '</p>' +
    '<h3 style="margin-top:8px">Project relevance</h3><p class="muted small">' + esc(s.notes.project) + '</p>' +
    '<h3 style="margin-top:12px">Resume Evidence</h3>' + ul(s.evidence) + '</div>' +
    '<div class="card" style="margin-bottom:14px"><h2>Skill Analysis</h2>' + skillGroup('Matched', s.matched, 'check', 'yes') + skillGroup('Partial', s.partial, 'minus', 'yes') + skillGroup('Missing', s.missing, 'xmark', 'no') + '<h3 style="margin-top:12px">All listed skills</h3>' + chips(normalizeSkills(c.skills)) + '</div>' +
    '<div class="card"><h2>Experience</h2>' + (c.experience.length ? c.experience.map(function (e) { return '<p><b>' + esc(e.role) + '</b>, ' + esc(e.company) + ' <span class="muted">(' + e.years + ' yr)</span><br><span class="muted">' + esc(e.summary) + '</span></p>'; }).join('') : '<p class="muted">None listed</p>') +
    '<h2 style="margin:14px 0 8px">Projects</h2>' + c.projects.map(function (p) { return '<p><b>' + esc(p.name) + '</b><br><span class="muted">' + esc(p.desc) + '</span><br>' + chips(p.tech) + '</p>'; }).join('') + '</div>' +
    '</div><div class="profile-rail">' +
    '<div class="card"><h2>Decision</h2><div style="display:grid;gap:8px"><button class="btn ok" data-act="status" data-id="' + c.id + '" data-s="Shortlisted">Shortlist</button><button class="btn bad" data-act="status" data-id="' + c.id + '" data-s="Rejected">Reject</button><button class="btn" data-act="status" data-id="' + c.id + '" data-s="Under Review">Move to Review</button><button class="btn" data-act="status" data-id="' + c.id + '" data-s="Interview">Move to Interview</button></div>' +
    '<p class="muted small" style="margin-top:10px">AI-assisted analysis. The final hiring decision remains with the recruiter.</p></div>' +
    '<div class="card"><h2>Details</h2>' + def('Email', esc(c.email)) + def('Phone', esc(c.phone)) + def('Location', esc(c.location)) + def('Experience', totalYears(c) + ' yrs') + def('Education', esc(c.education.join('; '))) + def('Certifications', esc(c.certs.join('; ') || 'None')) + '</div>' +
    '<div class="card"><h2>Tools</h2><div style="display:grid;gap:8px"><button class="btn" data-act="questions" data-id="' + c.id + '">Generate Interview Questions</button><button class="btn" data-act="cmpone" data-id="' + c.id + '">Add to Compare</button><a class="btn" href="#/reports/' + c.id + '">View Screening Report</a></div></div>' +
    '<div class="card"><h2>Recruiter Notes</h2><form data-form="notes" data-id="' + c.id + '"><textarea id="notesText" rows="4" aria-label="Recruiter notes">' + esc(c.notes) + '</textarea><button class="btn sm primary" style="margin-top:8px">Save Notes</button></form></div>' +
    '</div></div>';
}

function viewCompare() {
  var R = sel.map(function (id) { var c = findCand(db, id), j = c && findJob(db, c.jobId); return c && j ? { c: c, j: j, s: scoreCandidate(c, j) } : null; }).filter(Boolean);
  if (R.length < 2) return head('Compare Candidates', 'Pick 2 to 4 candidates') + '<div class="empty">Select at least two candidates on the <a href="#/candidates">Candidates</a> page to compare them.</div>';
  var offlineNote = '';
  var sameJob = R.every(function (r) { return r.j.id === R[0].j.id; });
  if (sameJob) {
    var key = 'compare:' + sel.slice().sort().join(',') + ':' + R[0].j.id;
    var e = remoteFetch(key, function () { return API.compareCandidates(sel, R[0].j.id); });
    if (e.status === 'loading') return remoteSkeleton('Compare Candidates', 'Scoring candidates on the server…');
    if (e.status === 'ok') {
      var byId = {}; e.data.candidates.forEach(function (row) { byId[row.candidateId] = row; });
      R.forEach(function (r) { var row = byId[r.c.id]; if (row) r.s = { overall: row.overallScore, skills: row.skillsScore, experience: row.experienceScore, semantic: row.semanticScore, education: row.educationScore, projects: row.projectsScore, matched: row.matchedSkills, missing: row.missingSkills, strengths: r.s.strengths, gaps: r.s.gaps }; });
    } else offlineNote = '<p class="muted small noprint" style="color:var(--bad)">Live comparison unavailable (' + esc(e.error) + '); showing a locally computed equivalent.</p>';
  } else offlineNote = '<p class="muted small noprint">Selected candidates span more than one job, so this comparison is computed locally.</p>';
  function row(label, f) { return '<tr><th scope="row">' + label + '</th>' + R.map(function (r) { return '<td>' + f(r) + '</td>'; }).join('') + '</tr>'; }
  function metricRow(label, get, hl) { var vals = R.map(get), mx = Math.max.apply(null, vals); return '<tr><th scope="row">' + label + '</th>' + R.map(function (r) { var v = get(r); return '<td' + (hl && v === mx ? ' style="background:var(--accent-soft)"' : '') + '><b>' + v + '%</b></td>'; }).join('') + '</tr>'; }
  return head('Compare Candidates', R.length + ' selected', '<button class="btn" data-act="clearsel">Clear Selection</button>') +
    offlineNote +
    '<div class="card tablewrap"><table class="cmp"><thead><tr><th></th>' + R.map(function (r) { return '<th><a href="#/candidates/' + r.c.id + '">' + esc(r.c.name) + '</a><br><span class="muted small">' + esc(r.j.title) + '</span></th>'; }).join('') + '</tr></thead><tbody>' +
    metricRow('Overall Match', function (r) { return r.s.overall; }, true) +
    metricRow('Skills', function (r) { return r.s.skills; }, true) + metricRow('Experience', function (r) { return r.s.experience; }, true) +
    metricRow('Relevance', function (r) { return r.s.semantic; }, true) +
    metricRow('Education', function (r) { return r.s.education; }, true) + metricRow('Projects', function (r) { return r.s.projects; }, true) +
    row('Matched Skills', function (r) { return chips(r.s.matched, 'y'); }) + row('Missing Skills', function (r) { return chips(r.s.missing, 'n'); }) +
    row('Strengths', function (r) { return ul(r.s.strengths); }) + row('Gaps', function (r) { return ul(r.s.gaps); }) + row('Status', function (r) { return badge(r.c.status); }) + '</tbody></table></div>';
}

function viewShortlisted() {
  var rows = scoredAll(db).filter(function (r) { return r.c.status === 'Shortlisted'; }).sort(function (a, b) { return b.s.overall - a.s.overall; });
  return head('Shortlisted', 'Candidates you have shortlisted across all roles') + (rows.length ? '<div class="card" style="padding:12px 16px"><div class="tablewrap" style="border:0"><table class="rt"><thead><tr><th>Candidate</th><th>Role</th><th>Match</th><th>Top Skills</th><th>Actions</th></tr></thead><tbody>' + rows.map(function (r) {
    return '<tr><td data-l="Candidate"><a href="#/candidates/' + r.c.id + '"><b>' + esc(r.c.name) + '</b></a></td><td data-l="Role">' + esc(r.j.title) + '</td><td data-l="Match">' + scoreCell(r.s.overall) + '</td><td data-l="Skills">' + chips(r.s.matched.slice(0, 4), 'y') + '</td><td data-l="Actions"><div class="row"><a class="btn sm" href="#/candidates/' + r.c.id + '">View</a><a class="btn sm" href="#/reports/' + r.c.id + '">Report</a><button class="btn sm" data-act="status" data-id="' + r.c.id + '" data-s="Interview">Move to Interview</button></div></td></tr>';
  }).join('') + '</tbody></table></div></div>' : '<div class="empty">No shortlisted candidates yet. Shortlist someone from the <a href="#/candidates">Candidates</a> page.</div>');
}

function viewReports() {
  var rows = scoredAll(db);
  return head('Reports', 'Open a screening report for any candidate') + (rows.length ? '<div class="card tablewrap"><table class="rt"><thead><tr><th>Candidate</th><th>Job</th><th>Score</th><th>Status</th><th></th></tr></thead><tbody>' +
    rows.map(function (r) { return '<tr><td data-l="Candidate">' + esc(r.c.name) + '</td><td data-l="Job">' + esc(r.j.title) + '</td><td data-l="Score">' + r.s.overall + '%</td><td data-l="Status">' + badge(r.c.status) + '</td><td><a class="btn sm" href="#/reports/' + r.c.id + '">Open Report</a></td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="empty">No candidates to report on yet.</div>');
}

/** Adapts a /api/reports/:id response into the same {cand,job,s,date,status,notes} shape buildReport() returns,
 *  so the existing report template below needs no changes regardless of which source produced it. */
function reportFromApi(rep, localCand) {
  return {
    cand: { name: rep.candidate.name, email: rep.candidate.email, location: rep.candidate.location, skills: rep.candidate.skills || [], education: rep.candidate.education || [], experience: rep.candidate.experience || [], projects: rep.candidate.projects || [], certs: rep.candidate.certifications || [] },
    job: { title: rep.job.title, company: rep.job.company },
    s: { overall: rep.scores.overallScore, skills: rep.scores.skillsScore, experience: rep.scores.experienceScore, semantic: rep.scores.semanticScore, education: rep.scores.educationScore, projects: rep.scores.projectsScore, matched: rep.matchedSkills, partial: rep.partialSkills, missing: rep.missingSkills, strengths: rep.strengths, gaps: rep.gaps, evidence: rep.evidence, notes: rep.notes, explanation: rep.explanation },
    date: rep.generatedAt, status: rep.candidate.status, notes: localCand ? localCand.notes : '', summary: rep.summary
  };
}

function viewReport(id) {
  var c0 = findCand(db, id); if (!c0) return viewNotFound();
  var key = 'report:' + id, e = remoteFetch(key, function () { return API.getReport(id, c0.jobId); });
  var r;
  if (e.status === 'loading') return remoteSkeleton('Screening Report', 'Fetching the latest report from the server…');
  if (e.status === 'ok') r = reportFromApi(e.data, c0);
  else { r = buildReport(db, id); if (!r) return viewNotFound(); } // offline/local fallback (same scoring formula)
  var c = r.cand, j = r.job, s = r.s, q = makeQuestions(c, j, s);
  var offlineNote = e.status === 'error' ? '<p class="muted small noprint" style="color:var(--bad)">Live report unavailable (' + esc(e.error) + '); showing a locally computed equivalent.</p>' : '';
  return head('Screening Report', 'Ready to print or save as PDF', '<button class="btn primary" data-act="print">Print / Save as PDF</button><a class="btn" href="#/reports">All Reports</a>') +
    offlineNote +
    '<article class="report">' +
    '<div class="row between" style="border-bottom:2px solid var(--text);padding-bottom:12px;margin-bottom:16px"><div><h1>HireLens AI</h1><p class="muted small">Candidate Screening Report · Confidential</p></div><div style="text-align:right"><p class="small muted">Generated</p><p class="small"><b>' + fmtDate(r.date) + '</b></p></div></div>' +
    '<h2>Candidate Summary</h2>' + def('Candidate', '<b>' + esc(c.name) + '</b>') + def('Position', esc(j.title) + ', ' + esc(j.company)) + def('Location', esc(c.location)) + def('Overall Match Score', '<b>' + s.overall + '%</b> — ' + scoreWord(s.overall)) + def('Recruiter Status', esc(r.status)) +
    (r.summary ? '<h2>AI Summary</h2><p class="small">' + esc(r.summary) + '</p>' : '') +
    '<h2>Match Breakdown</h2>' + meter('Skills', s.skills) + meter('Experience', s.experience) + meter('Relevance', s.semantic) + meter('Education', s.education) + meter('Projects', s.projects) +
    '<h2>Matched Skills</h2>' + chips(s.matched, 'y') + '<h2>Skill Gaps</h2>' + chips(s.missing, 'n') +
    '<h2>Experience</h2>' + ul(c.experience.map(function (e) { return e.role + ', ' + e.company + ' (' + e.years + ' yr): ' + e.summary; })) + '<p class="muted small">' + esc(s.notes.experience) + '</p>' +
    '<h2>Education</h2>' + ul(c.education) + '<p class="muted small">' + esc(s.notes.education) + '</p>' +
    '<h2>Projects</h2>' + ul(c.projects.map(function (p) { return p.name + ': ' + p.desc + ' (' + p.tech.join(', ') + ')'; })) +
    '<h2>Key Strengths</h2>' + ul(s.strengths) + '<h2>Evidence</h2>' + ul(s.evidence) +
    '<h2>Screening Explanation</h2><p class="small">' + esc(s.explanation) + '</p>' +
    '<h2>Recommended Interview Questions</h2><h3>Technical</h3>' + ul(q.technical.slice(0, 3)) + '<h3 style="margin-top:6px">Behavioral</h3>' + ul(q.behavioral.slice(0, 2)) +
    '<h2>Recruiter Decision</h2>' + def('Status', esc(r.status)) + def('Notes', esc(r.notes) || 'None') +
    '<p class="muted small" style="margin-top:20px;border-top:1px solid var(--line);padding-top:10px">HireLens AI — demo build. Screening insights are decision-support only; final hiring decisions remain with the recruiter.</p></article>';
}

function viewAnalytics() {
  var e = remoteFetch('analytics', function () { return API.getAnalytics(); });
  if (e.status === 'loading') return remoteSkeleton('Analytics', 'Calculating pipeline analytics on the server…');
  var st = stats(db), n = st.total || 1;
  var byStatus = STATUSES.map(function (s) { return [s, countStatus(db, s)]; });
  var perJobLocal = db.jobs.map(function (j) { return [j.title, db.cands.filter(function (c) { return c.jobId === j.id; }).length]; });
  if (e.status === 'error') {
    // Offline fallback: identical charts computed from the local engine.
    return head('Analytics', 'Pipeline health across all jobs') +
      '<p class="muted small noprint" style="color:var(--bad)">Live analytics unavailable (' + esc(e.error) + '); showing a locally computed equivalent.</p>' +
      '<div class="grid g5"><div class="card stat"><b>' + st.avg + '%</b><span>Average Score</span></div><div class="card stat"><b>' + Math.round(st.short / n * 100) + '%</b><span>Shortlisted</span></div><div class="card stat"><b>' + Math.round(st.rejected / n * 100) + '%</b><span>Rejected</span></div></div>' +
      '<div class="grid g2" style="margin-top:14px"><div class="card"><h2>Candidates by Status</h2>' + donut(byStatus) + '</div><div class="card"><h2>Score Distribution</h2>' + columns(distBuckets(st.rows)) + '</div>' +
      '<div class="card"><h2>Most Common Skills</h2>' + hbars(topCounts(db.cands.reduce(function (a, c) { return a.concat(normalizeSkills(c.skills)); }, []))) + '</div>' +
      '<div class="card"><h2>Most Common Missing Skills</h2>' + hbars(topCounts(st.rows.reduce(function (a, r) { return a.concat(r.s.missing); }, []))) + '</div>' +
      '<div class="card"><h2>Candidates per Job</h2>' + hbars(perJobLocal) + '</div></div>';
  }
  var a = e.data;
  var byStatusApi = STATUSES.map(function (s) { return [s, (a.statusBreakdown && a.statusBreakdown[s]) || 0]; });
  var distApi = (a.scoreDistribution || []).map(function (b) { return [b.range, b.count]; });
  var perJobApi = (a.candidatesPerJob || []).map(function (r) { return [r.title, r.candidates]; });
  var gapsApi = (a.skillGaps || []).map(function (g) { return [g.skill, g.count]; });
  return head('Analytics', 'Pipeline health across all jobs') +
    '<div class="grid g5"><div class="card stat"><b>' + a.averageScore + '%</b><span>Average Score</span></div><div class="card stat"><b>' + Math.round(a.shortlisted / (a.totalCandidates || 1) * 100) + '%</b><span>Shortlisted</span></div><div class="card stat"><b>' + Math.round(a.rejected / (a.totalCandidates || 1) * 100) + '%</b><span>Rejected</span></div></div>' +
    '<div class="grid g2" style="margin-top:14px"><div class="card"><h2>Candidates by Status</h2>' + donut(byStatusApi) + '</div><div class="card"><h2>Score Distribution</h2>' + columns(distApi.length ? distApi : [['0-49', 0], ['50-100', 0]]) + '</div>' +
    '<div class="card"><h2>Most Common Skills</h2>' + hbars(topCounts(db.cands.reduce(function (a2, c) { return a2.concat(normalizeSkills(c.skills)); }, []))) + '</div>' +
    '<div class="card"><h2>Most Common Missing Skills (server)</h2>' + hbars(gapsApi) + '</div>' +
    '<div class="card"><h2>Candidates per Job</h2>' + hbars(perJobApi.length ? perJobApi : perJobLocal) + '</div></div>';
}

function viewSettings() {
  var s = db.settings, w = currentWeights();
  function wpct(k) { return Math.round(w[k] * 100); }
  return head('Settings', 'Workspace preferences — stored in this browser only') +
    '<div class="pgtable"><div><form class="card" style="margin-bottom:14px" data-form="settings"><h2>Profile</h2>' +
    '<div class="field"><label for="sName">Name</label><input id="sName" value="' + esc(s.name) + '"></div><div class="field"><label for="sEmail">Email</label><input id="sEmail" type="email" value="' + esc(s.email) + '"></div>' +
    '<div class="field"><label for="sCompany">Company</label><input id="sCompany" value="' + esc(s.company) + '"></div>' +
    '<div class="field"><label><input type="checkbox" id="sNotify"' + (s.notify ? ' checked' : '') + '> Notify me about new screenings</label></div>' +
    '<div class="formsec">Appearance</div><div class="field"><label for="sTheme">Theme</label><select id="sTheme"><option value="dark"' + (s.theme === 'dark' ? ' selected' : '') + '>Dark (default)</option><option value="light"' + (s.theme === 'light' ? ' selected' : '') + '>Light</option></select></div>' +
    '<div class="row"><button class="btn primary">Save Settings</button><button type="button" class="btn" data-act="logout">Sign Out</button></div></form>' +
    '<div class="card"><h2>Data Management</h2><p class="muted small">All jobs, candidates, screenings and audit logs live in this browser\u2019s localStorage. Resetting restores the original demo dataset.</p>' +
    '<div class="row" style="margin-top:12px"><button type="button" class="btn" data-act="selftestbtn">Run Self-Test</button><button type="button" class="btn bad" data-act="resetask">Reset Demo Data</button></div></div></div>' +
    '<div class="profile-rail"><div class="card"><h2>Scoring Weights</h2><p class="muted small">Default hybrid scoring model. Adjust live in the <a href="#/simulator">Ranking Simulator</a>.</p>' +
    meter('Skills', wpct('skills')) + meter('Experience', wpct('experience')) + meter('Relevance', wpct('semantic')) + meter('Education', wpct('education')) + meter('Projects', wpct('projects')) + '</div>' +
    '<div class="card"><h2>About This Build</h2><p class="muted small">Browser-only demo. No real AI, resume extraction, database or server authentication. The centralized API layer is ready for backend integration. Scores come from a deterministic engine; a developer self-test is available under Data Management.</p></div></div></div>';
}

function viewNotFound() { return head('Not Found', 'That page or item does not exist') + '<a class="btn" href="#/dashboard">Back to Dashboard</a>'; }

function viewScreening() {
  var scr = db.screenings || [];
  return head('Screening', 'Run the explainable matching engine and review screening insights', '<button class="btn primary" data-act="runscreen">Run Screening (All Pending)</button>') +
    '<div class="banner"><h2>AI-Assisted Screening</h2><p class="muted">Scores come from a transparent hybrid engine: Skills ' + Math.round(currentWeights().skills * 100) + '%, Experience ' + Math.round(currentWeights().experience * 100) + '%, Relevance ' + Math.round(currentWeights().semantic * 100) + '%, Education ' + Math.round(currentWeights().education * 100) + '%, Projects ' + Math.round(currentWeights().projects * 100) + '%. No personal attributes are used. Final decisions remain with the recruiter.</p></div>' +
    '<div class="card" style="margin-bottom:14px"><h2>Candidates Pending Review</h2>' + (function () {
      var pending = scoredAll(db).filter(function (r) { return r.c.status === 'New' || r.c.status === 'Under Review'; });
      if (!pending.length) return '<div class="empty">No candidates are pending review. Upload a resume from the <a href="#/candidates">Candidates</a> page.</div>';
      return '<div class="tablewrap"><table class="rt"><thead><tr><th>Candidate</th><th>Job</th><th>Match Score</th><th>Top Skill Gaps</th><th>Status</th><th>Action</th></tr></thead><tbody>' +
        pending.map(function (r) { return '<tr><td data-l="Candidate"><a href="#/candidates/' + r.c.id + '">' + esc(r.c.name) + '</a></td><td data-l="Job">' + esc(r.j.title) + '</td><td data-l="Match"><b>' + r.s.overall + '%</b></td><td data-l="Gaps">' + (r.s.missing.length ? chips(r.s.missing.slice(0, 3), 'n') : '<span class="muted">None</span>') + '</td><td data-l="Status">' + badge(r.c.status) + '</td><td><div class="row"><button class="btn sm primary" data-act="screenone" data-id="' + r.c.id + '">Screen</button><button class="btn sm ok" data-act="status" data-id="' + r.c.id + '" data-s="Shortlisted">Shortlist</button><a class="btn sm" href="#/candidates/' + r.c.id + '">Insights</a></div></td></tr>'; }).join('') + '</tbody></table></div>';
    })() + '</div>' +
    '<div class="card"><h2>Screening History</h2>' + (scr.length ? '<div class="tablewrap"><table class="rt"><thead><tr><th>Time</th><th>Candidate</th><th>Job</th><th>Score</th></tr></thead><tbody>' + scr.slice(0, 10).map(function (x) {
      var c = findCand(db, x.candId), j = findJob(db, x.jobId);
      return '<tr><td data-l="Time">' + fmtDate(x.t) + '</td><td data-l="Candidate">' + (c ? esc(c.name) : '—') + '</td><td data-l="Job">' + (j ? esc(j.title) : '—') + '</td><td data-l="Score"><b>' + x.overall + '%</b></td></tr>';
    }).join('') + '</tbody></table></div>' : '<div class="empty">No screening runs recorded yet. Press “Run Screening (All Pending)” above.</div>') + '</div>';
}

/** Adapts /api/jobs/:id/ranking rows {candidateId,name,status,overallScore,...} into {c,s,rank} so the
 *  ranking table template below (shared with the local engine's rankForJob output) needs no changes. */
function rankingRowFromApi(row) {
  return { c: { id: row.candidateId, name: row.name, status: row.status }, rank: row.rank,
    s: { overall: row.overallScore, skills: row.skillsScore, experience: row.experienceScore, semantic: row.semanticScore, matched: row.matchedSkills, missing: row.missingSkills } };
}

function viewRanking() {
  var jobId = filters.jobId || (db.jobs[0] && db.jobs[0].id);
  var j = findJob(db, jobId);
  var rows = [];
  if (jobId) {
    var key = 'ranking:' + jobId, e = remoteFetch(key, function () { return API.getRanking(jobId); });
    if (e.status === 'loading') return remoteSkeleton('Candidate Ranking', 'Fetching live ranking from the server…');
    var offlineNote = '';
    if (e.status === 'ok') rows = e.data.map(rankingRowFromApi);
    else { rows = rankForJob(db, jobId); offlineNote = '<p class="muted small noprint" style="color:var(--bad)">Live ranking unavailable (' + esc(e.error) + '); showing a locally computed equivalent.</p>'; }
  }
  rows = rows.filter(function (r) { return r.s.overall >= (Number(filters.min) || 0) && (!filters.status || r.c.status === filters.status); });
  return head('Candidate Ranking', (j ? esc(j.title) + ' · ' : '') + rows.length + ' candidates ranked by calculated match') +
    (offlineNote || '') +
    '<div class="card" style="padding:12px 16px;margin-bottom:14px"><div class="filters" style="margin-bottom:0"><select id="rJob" aria-label="Job">' + db.jobs.map(function (x) { return '<option value="' + x.id + '"' + (String(jobId) === String(x.id) ? ' selected' : '') + '>' + esc(x.title) + '</option>'; }).join('') + '</select>' +
    '<select id="rStatus" aria-label="Status"><option value="">Status: All</option>' + STATUSES.map(function (s) { return '<option' + (filters.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +
    '<input id="rMin" type="number" min="0" max="100" placeholder="Match: 80%+" value="' + (filters.min || '') + '">' +
    '<select id="rReq" aria-label="Required skill"><option value="">Any required skill</option>' + (j ? j.req.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('') : '') + '</select></div></div>' +
    (rows.length ? '<div class="card" style="padding:12px 16px"><div class="tablewrap" style="border:0"><table class="rt"><thead><tr><th>Rank</th><th>Candidate</th><th>Match</th><th>Skills</th><th>Experience</th><th>Relevance</th><th>Status</th><th>Actions</th></tr></thead><tbody>' +
      rows.map(function (r, i) { return '<tr><td data-l="Rank"><span class="rank-badge' + (i < 3 ? ' top' : '') + '">#' + r.rank + '</span></td><td data-l="Candidate"><a href="#/candidates/' + r.c.id + '"><b>' + esc(r.c.name) + '</b></a><span class="sub">' + scoreWord(r.s.overall) + '</span></td><td data-l="Match">' + scoreCell(r.s.overall) + '</td><td data-l="Skills">' + r.s.skills + '%</td><td data-l="Experience">' + r.s.experience + '%</td><td data-l="Relevance">' + r.s.semantic + '%</td><td data-l="Status">' + badge(r.c.status) + '</td><td data-l="Actions"><div class="row"><a class="btn sm" href="#/candidates/' + r.c.id + '">Profile</a><a class="btn sm" href="#/reports/' + r.c.id + '">Report</a><button class="btn sm ok" data-act="status" data-id="' + r.c.id + '" data-s="Shortlisted">Shortlist</button></div></td></tr>'; }).join('') +
      '</tbody></table></div><p class="muted small" style="margin-top:8px">Full score breakdown is on each candidate profile. Test alternative weights in the <a href="#/simulator">Ranking Simulator</a>.</p></div>'
      : '<div class="empty">No candidates match these ranking filters. Lower the minimum score or clear the status filter.</div>');
}

function viewSimulator() {
  if (!db.jobs.length) return head('Ranking Simulator', 'Recalculate rankings with custom weights') + '<div class="empty">No jobs created yet. Create a job on the <a href="#/jobs">Jobs</a> page first.</div>';
  var jobId = filters.jobId || (db.jobs[0] && db.jobs[0].id);
  var w = simWeights || currentWeights();  var pct = { skills: Math.round(w.skills * 100), experience: Math.round(w.experience * 100), semantic: Math.round(w.semantic * 100), education: Math.round(w.education * 100), projects: Math.round(w.projects * 100) };
  var total = pct.skills + pct.experience + pct.semantic + pct.education + pct.projects;
  var before = rankForJob(db, jobId, WEIGHTS).map(function (r) { return { id: r.c.id, name: r.c.name, score: r.s.overall }; });
  var after = rankForJob(db, jobId, w).map(function (r) { return { id: r.c.id, name: r.c.name, score: r.s.overall }; });
  function afterLine(i, a) {
    var old = -1; before.forEach(function (x, k) { if (x.id === a.id) old = k; });
    var mv = old - i, cls = mv > 0 ? 'up' : mv < 0 ? 'down' : 'same';
    return '<div class="row between" style="padding:5px 0"><span><span class="rank-badge' + (i < 3 ? ' top' : '') + '">#' + (i + 1) + '</span> <a href="#/candidates/' + a.id + '">' + esc(a.name) + '</a></span><span><b>' + a.score + '%</b> <span class="mv ' + cls + '">' + (mv > 0 ? '▲ +' + mv : mv < 0 ? '▼ ' + mv : '—') + '</span></span></div>';
  }
  function expl() {
    var moved = [];
    after.forEach(function (a, i) { var o = -1; before.forEach(function (x, k) { if (x.id === a.id) o = k; }); if (o !== i) moved.push({ name: a.name, from: o + 1, to: i + 1 }); });
    if (!moved.length) return '<p class="muted small">Rankings are unchanged with these weights.</p>';
    var m = moved[0];
    return '<p class="muted small">' + esc(m.name) + ' moved from #' + m.from + ' to #' + m.to + ' because the new weights (skills ' + pct.skills + '%, experience ' + pct.experience + '%, relevance ' + pct.semantic + '%, education ' + pct.education + '%, projects ' + pct.projects + '%) favour this candidate\u2019s profile differently.' + (moved.length - 1 ? ' (' + (moved.length - 1) + ' other candidate(s) also moved.)' : '') + '</p>';
  }
  function sliders() {
    return [['skills', 'Skills'], ['experience', 'Experience'], ['semantic', 'Relevance'], ['education', 'Education'], ['projects', 'Projects']].map(function (k) {
      return '<div class="slider"><span>' + k[1] + '</span><input type="range" min="0" max="100" step="5" data-simw="' + k[0] + '" value="' + pct[k[0]] + '" aria-label="' + k[1] + ' weight"><b>' + pct[k[0]] + '%</b></div>';
    }).join('');
  }
  return head('Ranking Simulator', 'Decision support: test alternative scoring weights before applying them') +
    '<div class="pgtable"><div><div class="card"><h2>Scoring Configuration</h2>' +
    '<div class="filters" style="margin-bottom:12px"><select id="rJob" aria-label="Job">' + db.jobs.map(function (x) { return '<option value="' + x.id + '"' + (String(jobId) === String(x.id) ? ' selected' : '') + '>' + esc(x.title) + '</option>'; }).join('') + '</select><b style="color:' + (total === 100 ? 'var(--ok)' : 'var(--warn)') + '">Total: ' + total + '%</b>' +
    (simWeights ? '<button class="btn" data-act="simreset">Reset</button><button class="btn primary" data-act="simsave">Save as Default</button>' : '<button class="btn primary" data-act="simedit">Adjust Weights</button>') + '</div>' +
    (simWeights ? sliders() : '<p class="muted small">Current model: Skills ' + pct.skills + '%, Experience ' + pct.experience + '%, Relevance ' + pct.semantic + '%, Education ' + pct.education + '%, Projects ' + pct.projects + '%. Press “Adjust Weights” to simulate alternatives.</p>') +
    '<p class="muted small" style="margin-top:10px">Scores are recalculated live from candidate data. Saving applies these weights across the app.</p></div></div>' +
    '<div class="profile-rail"><div class="card"><h2>Ranking Preview — Your Weights</h2>' + after.map(function (a, i) { return afterLine(i, a); }).join('') + '<h3 style="margin-top:10px">Why it changed</h3>' + expl() + '</div>' +
    '<div class="card"><h2>Baseline — Default Weights</h2>' + before.map(function (a, i) { return '<div class="row between" style="padding:5px 0"><span><span class="rank-badge">#' + (i + 1) + '</span> <a href="#/candidates/' + a.id + '">' + esc(a.name) + '</a></span><b>' + a.score + '%</b></div>'; }).join('') + '</div></div></div>';
}

/** Right-hand match-score panel: overall ring + weighted breakdown + skill gaps. All values come straight
 *  from scoreCandidate() (the same engine the backend uses) — nothing here is invented. */
function scorePanelHTML(c, j, s, w) {
  w = w || WEIGHTS;
  var strong = (s.matched || []).slice(0, 8), missing = (s.missing || []).slice(0, 8);
  var partial = (s.partial || []).slice(0, 6);
  return '<div class="card matchring"><div class="mlabel">Match Score</div><div class="ring" style="--p:' + s.overall + '"><b>' + s.overall + '%</b></div><div class="mword" style="color:' + scoreColorVar(s.overall) + '">' + scoreWord(s.overall) + '</div></div>' +
    '<div class="card"><h2>Score Breakdown</h2>' +
    bar2('Skills', s.skills, w.skills) + bar2('Experience', s.experience, w.experience) + bar2('Semantic', s.semantic, w.semantic) + bar2('Education', s.education, w.education) + bar2('Projects', s.projects, w.projects) +
    '</div>' +
    '<div class="card"><h2>Skill Gaps</h2><div class="gaplist">' +
    (missing.length ? '<div class="small muted" style="margin:2px 0 4px">Missing</div>' + missing.map(function (sk) { return '<div class="gaprow"><span class="gn">' + esc(sk) + '</span><span class="badge" style="--c:var(--bad)">Missing</span></div>'; }).join('') : '') +
    (partial.length ? '<div class="small muted" style="margin:8px 0 4px">Needs Improvement</div>' + partial.map(function (sk) { return '<div class="gaprow"><span class="gn">' + esc(sk) + '</span><span class="badge" style="--c:var(--warn)">Partial</span></div>'; }).join('') : '') +
    (strong.length ? '<div class="small muted" style="margin:8px 0 4px">Strong</div>' + strong.map(function (sk) { return '<div class="gaprow"><span class="gn">' + esc(sk) + '</span><span class="badge" style="--c:var(--ok)">Match</span></div>'; }).join('') : '') +
    (!missing.length && !partial.length && !strong.length ? '<div class="muted small">No skill data on this candidate yet.</div>' : '') +
    '</div></div>';
}

function bar2(label, val, weight) { return '<div class="bar"><span class="muted">' + label + ' <span class="small" style="opacity:.7">(' + Math.round(weight * 100) + '%)</span></span><div class="track"><i style="width:' + Math.max(0, Math.min(100, val)) + '%;background:' + scoreColorVar(val) + '"></i></div><b>' + val + '</b></div>'; }

function scoreColorVar(v) { return v >= 80 ? 'var(--ok)' : v >= 60 ? 'var(--warn)' : 'var(--bad)'; }

/** One expandable question card. No per-question metadata is invented — only the text the API/engine
 *  actually returned is shown; expanding just restates it alongside a copy action. */
function qcard(n, text, source) {
  return '<details class="qcard"><summary><span class="qn">' + n + '</span><span class="qtext">' + esc(text) + '</span>' + (source ? '<span class="srcpill ' + (source === 'ai' ? 'ai' : 'tpl') + '">' + (source === 'ai' ? 'AI' : 'Template') + '</span>' : '') + '</summary>' +
    '<div class="qbody"><div>' + esc(text) + '</div><button class="btn sm" data-act="iqcopyone" data-q="' + esc(text).replace(/"/g, '&quot;') + '">Copy Question</button></div></details>';
}

function qlist(items, source) { return items && items.length ? items.map(function (t, i) { return qcard(i + 1, t, source); }).join('') : '<div class="empty">No questions generated for this section.</div>'; }

function viewInterview() {
  if (!db.cands.length) return head('AI Interview', 'Generate a structured interview kit for one candidate') + '<div class="empty">No candidates yet. Add candidates on the <a href="#/candidates">Candidates</a> page first.</div>';
  if (!iqSelId || !findCand(db, iqSelId)) iqSelId = db.cands[0].id;
  var c = findCand(db, iqSelId), j = findJob(db, c.jobId);
  var w = currentWeights(); var s = j ? scoreCandidate(c, j, w) : null;
  var q = (iqResultFor === iqSelId && iqResult) ? iqResult : null;
  var tabs = [['technical', 'Technical'], ['behavioral', 'Behavioral'], ['project', 'Project'], ['followUp', 'Follow-up']];
  var counts = q ? { technical: q.technical.length, behavioral: q.behavioral.length, project: q.project.length, followUp: (q.followUp || []).length } : { technical: 0, behavioral: 0, project: 0, followUp: 0 };
  var activeItems = q ? (q[iqTab] || []) : [];
  return head('Candidate Evaluation', 'AI interview workspace — real screening data from the backend, questions from the interview API') +
    '<div class="card" style="margin-bottom:14px"><div class="filters"><select id="iqCand" aria-label="Candidate">' + db.cands.map(function (x) { var xj = findJob(db, x.jobId); return '<option value="' + x.id + '"' + (x.id === iqSelId ? ' selected' : '') + '>' + esc(x.name) + ' — ' + esc(xj ? xj.title : 'No job') + '</option>'; }).join('') + '</select>' +
    '<button class="btn primary" data-act="iqgen" id="iqGenBtn">' + (q ? 'Regenerate Interview Kit' : 'Generate Interview Kit') + '</button></div></div>' +
    '<div class="evalshell">' +
    '<div class="card" id="iqMain">' +
    '<div class="evalhead"><div><h1>' + esc(c.name) + '</h1><p class="sub">' + esc(j ? j.title : 'No job linked') + (j && j.company ? ' · ' + esc(j.company) : '') + (s ? ' · Overall evaluation: ' + s.overall + '% (' + scoreWord(s.overall) + ')' : '') + '</p></div></div>' +
    '<div class="iqtabs">' + tabs.map(function (t) { return '<button class="iqtab' + (iqTab === t[0] ? ' on' : '') + '" data-act="iqtab" data-tab="' + t[0] + '">' + t[1] + (q ? '<span class="ct">' + counts[t[0]] + '</span>' : '') + '</button>'; }).join('') + '</div>' +
    (q ? qlist(activeItems, q.source) : '<div class="empty">Press “Generate Interview Kit” to pull technical, behavioral, project and follow-up questions for ' + esc(c.name) + '.</div>') +
    '</div>' +
    '<div class="scorepanel">' + (s ? scorePanelHTML(c, j, s, w) : '<div class="card"><p class="muted small">Link this candidate to a job to see a match score.</p></div>') + '</div>' +
    '</div>';
}

function evalDataset() {
  var d = defaultData();
  var cases = [
    { name: 'Skill normalization: JS→JavaScript, ReactJS→React, Node→Node.js, Mongo→MongoDB', run: function () { return normalizeSkill('JS') === 'JavaScript' && normalizeSkill('ReactJS') === 'React' && normalizeSkill('Node') === 'Node.js' && normalizeSkill('Mongo') === 'MongoDB'; } },
    { name: 'Score calculation: overall equals weighted sum of components', run: function () { var w = WEIGHTS; return scoredAll(d).every(function (r) { var s = r.s; return s.overall === Math.round(s.skills * w.skills + s.experience * w.experience + s.semantic * w.semantic + s.education * w.education + s.projects * w.projects); }); } },
    { name: 'Skill gap detection: missing lists required skills the candidate lacks', run: function () { var r = scoreCandidate(findCand(d, 6), findJob(d, 1)); return r.missing.indexOf('React') >= 0 && r.missing.indexOf('Git') >= 0 && r.matchedReq.indexOf('HTML') >= 0; } },
    { name: 'Ranking: sorted descending within each job', run: function () { return d.jobs.every(function (j) { var r = rankForJob(d, j.id); return r.every(function (x, i) { return i === 0 || r[i - 1].s.overall >= x.s.overall; }); }); } },
    { name: 'Stronger candidate outscores weaker one (same job)', run: function () { return scoreCandidate(findCand(d, 1), findJob(d, 3)).overall > scoreCandidate(findCand(d, 3), findJob(d, 3)).overall; } },
    { name: 'Filtering: status and minimum-score filters', run: function () { var a = filterCandidates(d, { status: 'Rejected' }), b = filterCandidates(d, { min: 80 }); return a.length === 1 && b.length < 8 && b.every(function (r) { return r.s.overall >= 80; }); } },
    { name: 'Comparison: scored results returned for selected candidates', run: function () { var r = [1, 2].map(function (id) { var c = findCand(d, id), j = findJob(d, c.jobId); return { score: scoreCandidate(c, j) }; }); return r.length === 2 && r.every(function (x) { return x.score.overall > 0; }); } },
    { name: 'Report: buildReport returns all sections, unknown id returns null', run: function () { var r = buildReport(d, 1); return !!r && r.s.evidence.length > 0 && !!r.status && buildReport(d, 999) === null; } }
  ];
  var tp = 0, fp = 0, fn = 0;
  d.cands.forEach(function (c) {
    var j = findJob(d, c.jobId), s = scoreCandidate(c, j);
    var coverage = j.req.length ? j.req.filter(function (x) { return s.matchedReq.indexOf(x) >= 0; }).length / j.req.length : 1;
    var truth = coverage >= 0.6, pred = s.overall >= 70;
    if (pred && truth) tp++; else if (pred && !truth) fp++; else if (!pred && truth) fn++;
  });
  var precision = tp + fp ? tp / (tp + fp) : 0, recall = tp + fn ? tp / (tp + fn) : 0;
  var f1 = precision + recall ? 2 * precision * recall / (precision + recall) : 0;
  var r1 = rankForJob(d, 3), r2 = rankForJob(d, 3);
  var consistent = JSON.stringify(r1.map(function (x) { return x.c.id; })) === JSON.stringify(r2.map(function (x) { return x.c.id; }));
  return { cases: cases, precision: precision, recall: recall, f1: f1, consistent: consistent };
}

function evalRun(c) { try { return c.run() === true; } catch (err) { return false; } }

function viewEvaluation() {
  return head('AI Evaluation', 'Deterministic test suite for the screening engine — metrics are computed from real runs, never invented', '<button class="btn primary" data-act="runEval">Run Evaluation</button>') +
    '<div id="evalOut"><div class="banner"><h2>Demo Evaluation Dataset</h2><p class="muted">Covers: skill matching, score calculation, skill gap detection, ranking, normalization, filtering, comparison and reports. Press “Run Evaluation” to execute the suite against the demo dataset.</p></div><div class="empty">No evaluation results yet.</div></div>';
}

function evalResultsHTML() {
  var e = evalDataset(), pass = e.cases.filter(evalRun).length, fail = e.cases.length - pass;
  return '<div class="grid g5"><div class="card stat metric"><b>' + e.cases.length + '</b><span>Test Cases</span></div>' +
    '<div class="card stat metric"><b style="color:var(--ok)">' + pass + '</b><span>Passed</span></div>' +
    '<div class="card stat metric"><b style="color:' + (fail ? 'var(--bad)' : 'var(--muted)') + '">' + fail + '</b><span>Failed</span></div>' +
    '<div class="card stat metric"><b>' + Math.round(e.precision * 100) + '%</b><span>Precision</span></div>' +
    '<div class="card stat metric"><b>' + Math.round(e.recall * 100) + '%</b><span>Recall</span></div>' +
    '<div class="card stat metric"><b>' + e.f1.toFixed(2) + '</b><span>F1 Score</span></div>' +
    '<div class="card stat metric"><b>' + (e.consistent ? '100%' : '0%') + '</b><span>Ranking Consistency</span></div></div>' +
    '<div class="card" style="margin-top:14px"><h2>Evaluation Test Results</h2><div class="tablewrap" style="border:0"><table class="rt"><thead><tr><th>Test</th><th>Category</th><th>Expected</th><th>Actual</th><th>Status</th></tr></thead><tbody>' +
    e.cases.map(function (c) { var ok = evalRun(c), cat = c.name.split(':')[0]; return '<tr><td data-l="Test">' + esc(c.name) + '</td><td data-l="Category">' + esc(cat) + '</td><td data-l="Expected">Pass</td><td data-l="Actual">' + (ok ? 'Pass' : 'Fail') + '</td><td data-l="Status"><span style="color:' + (ok ? 'var(--ok)' : 'var(--bad)') + ';font-weight:600">' + (ok ? '✓ Pass' : '✕ Fail') + '</span></td></tr>'; }).join('') + '</tbody></table></div></div>' +
    '<p class="muted small" style="margin-top:12px">Precision / recall / F1 compare engine predictions (overall score ≥ 70) against hand-labelled ground truth (required-skill coverage ≥ 60%) on the demo dataset. Ranking consistency = identical output across repeated identical runs.</p>';
}

function viewFairness() {
  var excluded = ['Gender', 'Age', 'Religion', 'Caste', 'Photograph', 'Marital Status'];
  var factors = [['Skills', 'Required and preferred skill coverage'], ['Experience', 'Years and relevance of professional experience'], ['Job Relevance', 'Keyword overlap between profile and job description'], ['Education', 'Highest qualification against the requirement'], ['Projects', 'Project work using required technologies']];
  return head('Fairness &amp; Responsible Screening', 'What the engine uses — and deliberately does not use') +
    '<div class="split2"><div class="card"><h2>Protected Attributes — Not Used For Ranking</h2>' + excluded.map(function (x) { return '<div class="fairrow no"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="' + ICONS.minus + '"/></svg> <b>' + x + '</b><span class="muted small" style="margin-left:auto">Excluded</span></div>'; }).join('') + '<p class="muted small" style="margin-top:10px">These attributes are never collected, scored or ranked by the engine.</p></div>' +
    '<div class="card"><h2>Ranking Factors</h2>' + factors.map(function (f) { return '<div class="fairrow yes"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="' + ICONS.check + '"/></svg> <b>' + f[0] + '</b><span class="muted small" style="margin-left:auto">' + f[1] + '</span></div>'; }).join('') + '</div></div>' +
    '<div class="banner" style="margin-top:14px"><h2>Human Oversight</h2><p>AI assists recruiters. Final hiring decisions remain with the recruiter. Every score is explainable and any ranking can be overridden by a recruiter decision.</p></div>';
}

function viewAudit() {
  var e = remoteFetch('audit', function () { return API.getAuditLogs(); });
  if (e.status === 'loading') return remoteSkeleton('Audit Logs', 'Fetching the audit trail from the server…');
  var rows, sourceNote = '', subtitle = 'Workspace activity history';
  if (e.status === 'ok') {
    rows = e.data.map(function (l) { return { t: l.createdAt, user: (l.user && (l.user.name || l.user.email)) || 'System', m: l.action + (l.metadata && l.metadata.title ? ': ' + l.metadata.title : '') }; });
  } else {
    rows = db.log.map(function (l) { return { t: l.t, user: db.settings.name || 'Recruiter', m: l.m }; });
    sourceNote = '<p class="muted small noprint" style="color:var(--bad)">Live audit log unavailable (' + esc(e.error) + '); showing locally recorded activity.</p>';
  }
  return head('Audit Logs', subtitle) + sourceNote +
    (rows.length ? '<div class="card" style="padding:12px 16px"><div class="tablewrap" style="border:0"><table class="rt"><thead><tr><th>Timestamp</th><th>User</th><th>Action</th></tr></thead><tbody>' + rows.map(function (l) {
      var x = new Date(l.t);
      return '<tr><td data-l="Timestamp">' + (isNaN(x) ? '' : x.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })) + ' · ' + fmtDate(l.t) + '</td><td data-l="User">' + esc(l.user) + '</td><td data-l="Action">' + esc(l.m) + '</td></tr>';
    }).join('') + '</tbody></table></div></div>' : '<div class="empty">No audit events recorded yet. Actions such as screening, shortlisting and report generation will appear here.</div>');
}

function shell(page, content) {
  var name = db.settings.name || 'User';
  var r = parseRoute(location.hash), ctx = '';
  if (r.id) { var jj = findJob(db, r.id), cc = findCand(db, r.id); ctx = jj ? jj.title : cc ? cc.name : ''; }
  var nav = GROUPS.map(function (g) {
    return '<div class="navgroup">' + g[0] + '</div>' + g[1].map(function (p) {
      return '<a class="nav' + (p === page ? ' on' : '') + '" href="#/' + p + '"' + (p === page ? ' aria-current="page"' : '') + '>' + icon(p) + (NAVLABEL[p] || cap(p)) + '</a>';
    }).join('');
  }).join('');
  return '<div class="shell"><aside class="side" id="side"><div class="logo"><svg class="i" viewBox="0 0 24 24" aria-hidden="true" style="width:22px;height:22px;color:var(--accent)"><circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5M8 11l2 2 4-4"/></svg><span>HireLens <b>AI</b></span></div>' + nav +
    '<div class="rai">AI-assisted screening insights are decision-support tools. Final hiring decisions remain with the recruiter.</div></aside>' +
    '<div class="mainwrap"><header class="topbar noprint"><button class="btn sm menu-btn" data-act="menu" aria-label="Toggle navigation">' + icon('menu') + '</button>' +
    '<div class="crumb grow"><b>' + (NAVLABEL[page] || cap(page)) + '</b>' + (ctx ? '<span class="sep">/</span><span class="muted">' + esc(ctx) + '</span>' : '') + '</div>' +
    '<div class="topsearch"><input id="topSearch" type="search" placeholder="Search candidates..." aria-label="Search candidates"></div>' +
    '<button class="iconbtn notifdot" data-act="bell" aria-label="Notifications">' + icon('bell') + '</button>' +
    '<button class="iconbtn" data-act="toggletheme" aria-label="Toggle dark mode">' + icon('sun') + '</button>' +
    '<div class="dd" id="dd"><button class="btn sm" data-act="dd" aria-haspopup="true"><span class="avatar">' + esc(name.charAt(0).toUpperCase()) + '</span>' + esc(name) + '</button><div class="dd-menu"><div class="dd-note small muted">' + esc(name) + ' · ' + (getToken() && backendOnline ? 'Connected' : 'Offline / Demo Mode') + '</div><button data-act="gosettings">Settings</button><button data-act="toggletheme">Toggle Theme</button><button data-act="logout">Sign Out</button></div></div></header>' +
    '<main id="main">' + content + '</main><footer class="foot"><b>HireLens AI</b> · Intelligent Resume Screening &amp; Candidate Shortlisting · Demo build — all data is local to this browser</footer></div></div>';
}

function closeModal() { var m = $('#modalRoot'); if (m && m.parentNode) m.parentNode.removeChild(m); }

function openModal(html) {
  closeModal();
  var d = document.createElement('div'); d.id = 'modalRoot'; d.className = 'modal-bg'; d.setAttribute('data-act', 'closebg');
  d.innerHTML = '<div class="modal" role="dialog" aria-modal="true">' + html + '</div>';
  document.body.appendChild(d);
  var f = d.querySelector('input,textarea,select,button'); if (f) f.focus();
}

function jobFormHTML(job) {
  var j = job || { title: '', company: db.settings.company, location: '', exp: '', edu: "Bachelor's", req: [], pref: [], desc: '' };
  function f(id, label, val, type, extra) { return '<div class="field"><label for="' + id + '">' + label + '</label><input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(val) + '" ' + (extra || '') + '></div>'; }
  return '<h2>' + (job ? 'Edit Job' : 'Create Job') + '</h2><form data-form="job" data-id="' + (job ? job.id : '') + '">' +
    '<div class="formsec">Job Information</div>' + f('jfTitle', 'Job Title', j.title, 'text', 'required') + f('jfCompany', 'Company', j.company, 'text', 'required') + f('jfLocation', 'Location', j.location) +
    '<div class="formsec">Requirements</div>' + f('jfExp', 'Experience Required (years)', j.exp, 'number', 'min="0" max="40"') + f('jfEdu', 'Education', j.edu) +
    f('jfReq', 'Required Skills (comma separated)', j.req.join(', ')) + f('jfPref', 'Preferred Skills (comma separated)', j.pref.join(', ')) +
    '<div class="formsec">Job Description</div>' +
    '<div class="field"><label for="jfDesc">Job Description</label><textarea id="jfDesc" rows="6" required>' + esc(j.desc) + '</textarea></div><p class="form-err" id="jfErr" role="alert"></p>' +
    '<div class="row"><button class="btn primary">' + (job ? 'Save Changes' : 'Create Job') + '</button><button type="button" class="btn" data-act="close">Cancel</button></div></form>';
}

function questionsHTML(c, apiQ, isAi) {
  var j = findJob(db, c.jobId), q = apiQ || makeQuestions(c, j, scoreCandidate(c, j));
  return '<h2>Interview Assistant' + (apiQ ? (isAi ? ' — AI Generated' : ' — Server Templates') : ' — Offline') + '</h2><p class="muted small">' + (isAi ? 'Generated by the configured AI model from this candidate\'s skills, projects and job requirements.' : 'Generated from templates using this candidate\'s skills and projects and the job requirements.') + '</p><h3 style="margin-top:10px">Technical questions</h3>' + ul(q.technical) + '<h3 style="margin-top:8px">Behavioral questions</h3>' + ul(q.behavioral) + '<h3 style="margin-top:8px">Project questions</h3>' + ul(q.project) + (q.followUp && q.followUp.length ? '<h3 style="margin-top:8px">Follow-up questions</h3>' + ul(q.followUp) : '') + '<div class="row" style="margin-top:14px"><button class="btn primary" data-act="close">Close</button></div>';
}
