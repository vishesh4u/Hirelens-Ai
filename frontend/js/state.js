/* HireLens AI — Application state: shared DOM/format helpers, demo data model, localStorage persistence, UI state variables.
 * Classic (non-module) script: top-level declarations are shared globals; load order is set in index.html. */
'use strict';

function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

function $(s, r) { return (r || document).querySelector(s); }

function fmtDate(d) { var x = new Date(d); return isNaN(x) ? '' : x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }

function daysAgo(n) { return new Date(Date.now() - n * 864e5).toISOString(); }

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function maxOf(a, f) { var m = 1; a.forEach(function (x) { var v = f(x); if (v > m) m = v; }); return m; }

function defaultData() {
  function J(id, title, company, location, exp, edu, req, pref, desc, age) {
    return { id: id, title: title, company: company, location: location, exp: exp, edu: edu, req: normalizeSkills(req), pref: normalizeSkills(pref), desc: desc, status: 'Open', created: daysAgo(age), analysis: null };
  }
  function P(name, desc, tech) { return { name: name, desc: desc, tech: tech }; }
  function E(role, company, years, summary) { return { role: role, company: company, years: years, summary: summary }; }
  function C(id, jobId, name, phone, location, skills, edu, experience, projects, certs, status, age) {
    return { id: id, jobId: jobId, name: name, email: name.toLowerCase().replace(/\s+/g, '.') + '@example.com', phone: phone, location: location, skills: skills, education: edu, experience: experience, projects: projects, certs: certs, status: status, notes: '', created: daysAgo(age) };
  }
  return {
    v: 2, user: null, nextJobId: 5, nextCandId: 9, poolUsed: [], screenings: [],
    settings: { name: 'Demo Recruiter', email: DEMO_EMAIL, company: 'HireLens Demo Co.', notify: true, theme: 'dark' },
    log: [{ t: daysAgo(0), m: 'Demo data loaded' }],
    jobs: [
      J(1, 'Senior Frontend Developer', 'NorthPeak Labs', 'Bengaluru', 4, "Bachelor's", ['JavaScript', 'React', 'HTML', 'CSS', 'Git'], ['TypeScript', 'Tailwind CSS', 'Redux'],
        "We are looking for a Senior Frontend Developer with 4+ years of experience to build responsive interfaces using JavaScript, React, HTML and CSS. You will design reusable components, review pull requests and collaborate with designers. Bachelor's degree in Computer Science or a related field. Preferred: TypeScript, Tailwind CSS and Redux.", 21),
      J(2, 'Backend Engineer', 'Cedar Systems', 'Pune', 3, "Bachelor's", ['Node.js', 'Express.js', 'MongoDB', 'REST API', 'SQL'], ['Docker', 'AWS', 'Redis'],
        "Design and maintain REST API services using Node.js, Express and MongoDB. Optimise SQL queries and own service reliability. 3+ years of experience required. Bachelor's degree in engineering. Nice to have: Docker, AWS and Redis.", 15),
      J(3, 'Full Stack Developer', 'Lumen Works', 'Indore', 2, "Bachelor's", ['JavaScript', 'React', 'Node.js', 'MongoDB', 'REST API'], ['Docker', 'AWS', 'TypeScript'],
        "Build full-stack web applications with React, Node.js and MongoDB. Develop REST API endpoints, collaborate with designers and ship features end to end. 2+ years of experience. Bachelor's degree in Computer Science. Preferred: Docker, AWS and TypeScript.", 9),
      J(4, 'Data Analyst', 'Orbit Analytics', 'Remote', 1, "Bachelor's", ['Python', 'SQL', 'Excel', 'Pandas', 'Statistics'], ['Tableau', 'Power BI'],
        "Analyse business data with Python, SQL, Excel and Pandas. Create dashboards and report insights to stakeholders using statistics. 1+ years of experience. Bachelor's degree in a quantitative field. Preferred: Tableau and Power BI.", 5)
    ],
    cands: [
      C(1, 3, 'Aarav Sharma', '+91 90000 01001', 'Indore', ['JS', 'ReactJS', 'Node', 'Mongo DB', 'Express JS', 'REST APIs', 'Git', 'TypeScript'], ['B.Tech in Computer Science, Riverbend Institute of Technology (2021)'],
        [E('Software Engineer', 'Brightline Apps', 3, 'Built React dashboards and Node.js REST services backed by MongoDB.')],
        [P('Hostel Booking Platform', 'Full-stack booking app with JWT auth and payments', ['React', 'Node.js', 'MongoDB']), P('Realtime Chat App', 'Socket-based chat with rooms and a REST API', ['Node.js', 'Express.js']), P('Portfolio CMS', 'Dashboard for managing content', ['React', 'TypeScript'])],
        ['Front-End Developer Certificate'], 'Shortlisted', 8),
      C(2, 3, 'Priya Singh', '+91 90000 01002', 'Pune', ['JavaScript', 'React.js', 'Node.js', 'MongoDB', 'Docker', 'AWS', 'Git'], ['B.E. in Information Technology, Lakeview College of Engineering (2022)'],
        [E('Junior Developer', 'Stackwell', 2, 'Developed React features and deployed Node.js services on AWS with Docker.')],
        [P('Expense Tracker', 'Full-stack expense app deployed on AWS with Docker', ['React', 'Node.js', 'MongoDB', 'Docker']), P('Quiz Portal', 'Timed quiz application', ['React', 'MongoDB'])],
        ['Cloud Practitioner Certificate'], 'Under Review', 7),
      C(3, 3, 'Rahul Verma', '+91 90000 01003', 'Bhopal', ['JS', 'React', 'HTML', 'CSS', 'Git'], ['BCA, Summit University (2024)'],
        [E('Intern', 'PixelForge', 1, 'Built static pages and small React components.')],
        [P('Landing Page Kit', 'Responsive marketing pages', ['HTML', 'CSS', 'JavaScript']), P('Todo App', 'React todo application', ['React'])],
        [], 'New', 6),
      C(4, 1, 'Ananya Patel', '+91 90000 01004', 'Bengaluru', ['JavaScript', 'React', 'HTML', 'CSS', 'Tailwind', 'Redux', 'Git', 'TypeScript'], ['B.Tech in Information Technology, Harbor Institute (2019)'],
        [E('Senior UI Engineer', 'Nimbus Interfaces', 5, 'Led a React component library and Redux-based dashboards.')],
        [P('Design System', 'Reusable React component library', ['React', 'TypeScript', 'Tailwind CSS']), P('Analytics Dashboard', 'Interactive charts UI with Redux state', ['React', 'Redux'])],
        ['UX Fundamentals Certificate'], 'Interview', 6),
      C(5, 2, 'Vikram Mehta', '+91 90000 01005', 'Pune', ['Node.js', 'Express', 'MongoDB', 'SQL', 'REST API', 'Docker', 'Postgres'], ['M.Tech in Software Engineering, Northgate Institute (2018)'],
        [E('Backend Engineer', 'Cobalt Payments', 4, 'Owned Node.js REST services and SQL data models for a payments platform.')],
        [P('Payments Gateway Service', 'REST API service with Node.js and SQL', ['Node.js', 'Express.js', 'PostgreSQL']), P('Job Queue Worker', 'Background workers and monitoring', ['Node.js', 'Docker'])],
        ['Database Associate Certificate'], 'Shortlisted', 5),
      C(6, 1, 'Neha Kapoor', '+91 90000 01006', 'Jaipur', ['HTML', 'CSS', 'JS', 'jQuery'], ['Diploma in Computer Engineering, Metro Polytechnic (2023)'],
        [E('Web Trainee', 'Sitecraft', 1, 'Maintained static websites with HTML, CSS and jQuery.')],
        [P('College Website', 'Static multi-page site', ['HTML', 'CSS'])],
        [], 'Rejected', 4),
      C(7, 2, 'Kabir Nair', '+91 90000 01007', 'Kochi', ['Java', 'SQL', 'Spring Boot', 'REST API', 'Git'], ['B.Tech in Computer Science, Coastal Institute (2021)'],
        [E('Software Developer', 'Harbor Soft', 2, 'Built Java REST services with SQL storage.')],
        [P('Library Management', 'Java service with SQL storage', ['Java', 'SQL'])],
        ['Java Foundations Certificate'], 'New', 3),
      C(8, 4, 'Isha Rao', '+91 90000 01008', 'Hyderabad', ['Python', 'SQL', 'Excel', 'Pandas', 'Tableau', 'Statistics'], ['M.Sc in Statistics, Deccan University (2021)'],
        [E('Data Analyst', 'Quantia', 2, 'Analysed sales data with Python, SQL and Pandas and built Tableau dashboards.')],
        [P('Sales Forecasting', 'Time-series forecasting with Pandas', ['Python', 'Pandas']), P('Churn Dashboard', 'Tableau dashboard on SQL data', ['SQL', 'Tableau'])],
        ['Data Analytics Certificate'], 'Under Review', 2)
    ]
  };
}



function isArr(x) { return Array.isArray(x); }

function validateDB(d) {
  try {
    if (!d || typeof d !== 'object' || !isArr(d.jobs) || !isArr(d.cands) || !isArr(d.log) || !d.settings || typeof d.settings !== 'object') return false;
    var ids = {};
    for (var i = 0; i < d.jobs.length; i++) {
      var j = d.jobs[i];
      if (!j || typeof j.id !== 'number' || typeof j.title !== 'string' || !isArr(j.req) || !isArr(j.pref) || typeof j.desc !== 'string') return false;
      ids[j.id] = 1;
    }
    for (var k = 0; k < d.cands.length; k++) {
      var c = d.cands[k];
      if (!c || typeof c.id !== 'number' || typeof c.name !== 'string' || !isArr(c.skills) || !isArr(c.education) || !isArr(c.experience) || !isArr(c.projects) || !isArr(c.certs) || STATUSES.indexOf(c.status) < 0 || !ids[c.jobId]) return false;
    }
    return typeof d.nextJobId === 'number' && typeof d.nextCandId === 'number' && isArr(d.poolUsed);
  } catch (e) { return false; }
}

function parseStored(text) {
  try { var d = JSON.parse(text); return validateDB(d) ? d : null; } catch (e) { return null; }
}

/* ---- mode: a real session (JWT, MongoDB is the source of truth) vs. the explicit offline Demo Mode ---- */
var bootState = ''; // '' | 'loading' | 'error' while a stored session is being verified
function isDemo() { return !!(db && db.user && db.user.demo); }
function isLive() { return !!getToken() && !isDemo(); }

/* ---- preferences: theme ('light' | 'dark' | 'system') and saved scoring weights; independent of any workspace data ---- */
function loadPrefs() {
  var p = {};
  try { p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') || {}; } catch (e) { p = {}; }
  if (p.theme !== 'light' && p.theme !== 'dark' && p.theme !== 'system') p.theme = 'system';
  return p;
}
function savePrefs() {
  var p = loadPrefs();
  try { if (db && db.settings && db.settings.weights) p.weights = db.settings.weights; localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch (e) { /* storage unavailable */ }
}
function getTheme() { return loadPrefs().theme; }
function setTheme(t) { var p = loadPrefs(); p.theme = (t === 'light' || t === 'dark') ? t : 'system'; try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch (e) { /* ignore */ } applyTheme(); }
function resolvedTheme() { var t = getTheme(); if (t === 'system') { try { return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; } catch (e) { return 'dark'; } } return t; }
function applyTheme() { document.documentElement.setAttribute('data-theme', resolvedTheme()); document.documentElement.setAttribute('data-theme-pref', getTheme()); }

/** Clears any workspace data held in memory (used before loading a real account and after sign-out). */
function resetLiveData() { db.jobs = []; db.cands = []; db.screenings = []; db.log = []; db.poolUsed = []; sel = []; upload = null; uploadQueue = []; invalidateRemote(); }

function loadDB() {
  var raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
  var d = raw ? parseStored(raw) : null;
  if (!d) { d = defaultData(); if (raw) { pendingNotice = 'Saved data was invalid and has been reset to the demo data.'; } }
  if (!isArr(d.screenings)) d.screenings = [];
  if (d.settings.theme !== 'light' && d.settings.theme !== 'dark') d.settings.theme = 'dark';
  return d;
}

var storageOk = true;

function saveDB() {
  if (isLive()) { savePrefs(); return; } // real session: the server is the source of truth, nothing business-related is stored here
  savePrefs();
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { if (storageOk) { storageOk = false; toast('Browser storage is unavailable. Changes will not persist after refresh.', true); } }
}

function authenticate(email, pass) { return String(email || '').trim().toLowerCase() === DEMO_EMAIL && pass === DEMO_PASS; }

var db, pendingNotice = '', sel = [], upload = null, LOGIN_HTML = '', appEl, filters = { q: '', jobId: '', status: '', min: 0, sort: 'high' };

var simWeights = null;
var uploadConfig = { maxBytes: 5 * 1024 * 1024, aiExtraction: false }, pendingUploadJob = false;
var uploadQueue = [], uploadJobId = ''; // resume upload/review queue (in memory only)

var iqSelId = null, iqTab = 'technical', iqResult = null, iqResultFor = null; // Interview workspace state

function currentWeights() {
  try {
    var w = db && db.settings && db.settings.weights;
    if (w && Math.abs(w.skills + w.experience + w.semantic + w.education + w.projects - 1) < 0.01) return w;
  } catch (e) { }
  return WEIGHTS;
}

function logEvent(m) { db.log.unshift({ t: new Date().toISOString(), m: m }); db.log = db.log.slice(0, 25); }
