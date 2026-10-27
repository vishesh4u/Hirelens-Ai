/* HireLens AI — Browser-side scoring: skill normalization, text similarity, the scoring engine and pure domain logic (offline fallback; same formula as Backend/src/services/scoringEngine.js).
 * Classic (non-module) script: top-level declarations are shared globals; load order is set in index.html. */
'use strict';

var ALIASES = {
  'js': 'JavaScript', 'javascript': 'JavaScript', 'ecmascript': 'JavaScript',
  'ts': 'TypeScript', 'typescript': 'TypeScript',
  'reactjs': 'React', 'react.js': 'React', 'react': 'React',
  'node': 'Node.js', 'nodejs': 'Node.js', 'node.js': 'Node.js',
  'mongo db': 'MongoDB', 'mongo': 'MongoDB', 'mongodb': 'MongoDB',
  'express js': 'Express.js', 'expressjs': 'Express.js', 'express': 'Express.js', 'express.js': 'Express.js',
  'rest': 'REST API', 'rest api': 'REST API', 'rest apis': 'REST API', 'restful api': 'REST API',
  'postgres': 'PostgreSQL', 'postgresql': 'PostgreSQL',
  'aws': 'AWS', 'docker': 'Docker', 'git': 'Git', 'sql': 'SQL', 'python': 'Python',
  'html': 'HTML', 'html5': 'HTML', 'css': 'CSS', 'css3': 'CSS',
  'tailwind': 'Tailwind CSS', 'tailwind css': 'Tailwind CSS', 'redux': 'Redux', 'jquery': 'jQuery',
  'java': 'Java', 'excel': 'Excel', 'tableau': 'Tableau', 'power bi': 'Power BI', 'powerbi': 'Power BI',
  'pandas': 'Pandas', 'statistics': 'Statistics', 'redis': 'Redis', 'graphql': 'GraphQL', 'jest': 'Jest',
  'c': 'C', 'go': 'Go', 'golang': 'Go', 'rust': 'Rust', 'php': 'PHP', 'kotlin': 'Kotlin', 'swift': 'Swift', 'ruby': 'Ruby', 'r': 'R', 'scala': 'Scala',
  'matlab': 'MATLAB', 'bash': 'Bash', 'dart': 'Dart', 'flutter': 'Flutter', 'react native': 'React Native', 'django': 'Django', 'flask': 'Flask', 'fastapi': 'FastAPI',
  '.net': '.NET', 'asp.net': '.NET', 'dotnet': '.NET', 'laravel': 'Laravel', 'bootstrap': 'Bootstrap', 'sass': 'Sass', 'scss': 'Sass',
  'tensorflow': 'TensorFlow', 'pytorch': 'PyTorch', 'keras': 'Keras', 'opencv': 'OpenCV', 'matplotlib': 'Matplotlib', 'seaborn': 'Seaborn',
  'sqlite': 'SQLite', 'oracle': 'Oracle', 'firebase': 'Firebase', 'dynamodb': 'DynamoDB', 'elasticsearch': 'Elasticsearch',
  'azure': 'Azure', 'gcp': 'GCP', 'google cloud': 'GCP', 'heroku': 'Heroku', 'vercel': 'Vercel', 'netlify': 'Netlify',
  'github': 'GitHub', 'gitlab': 'GitLab', 'linux': 'Linux', 'postman': 'Postman', 'jira': 'Jira', 'figma': 'Figma', 'selenium': 'Selenium', 'cypress': 'Cypress',
  'junit': 'JUnit', 'mocha': 'Mocha', 'webpack': 'Webpack', 'vite': 'Vite', 'nginx': 'Nginx', 'jenkins': 'Jenkins', 'terraform': 'Terraform', 'ansible': 'Ansible',
  'agile': 'Agile', 'scrum': 'Scrum', 'oop': 'OOP', 'object oriented programming': 'OOP', 'data structures': 'Data Structures', 'dsa': 'Data Structures', 'algorithms': 'Algorithms',
  'machine learning': 'Machine Learning', 'ml': 'Machine Learning', 'deep learning': 'Deep Learning', 'nlp': 'NLP', 'natural language processing': 'NLP', 'computer vision': 'Computer Vision',
  'data analysis': 'Data Analysis', 'microservices': 'Microservices', 'jwt': 'JWT', 'oauth': 'OAuth', 'websocket': 'WebSockets', 'websockets': 'WebSockets', 'socket.io': 'Socket.IO',
  'ci cd': 'CI/CD', 'cicd': 'CI/CD', 'spark': 'Spark', 'apache spark': 'Spark', 'hadoop': 'Hadoop', 'kafka': 'Kafka', 'rabbitmq': 'RabbitMQ', 'mern': 'MERN Stack', 'mern stack': 'MERN Stack'
};

var STOP = {};
('a an and are as at be but by for from has have i in is it its of on or our that the their this to we will with you your using use work working strong experience years year ability etc via within across into over such also more than must should can able').split(' ').forEach(function (w) { STOP[w] = 1; });

function normalizeSkill(s) {
  var t = String(s == null ? '' : s).trim().replace(/\s+/g, ' ');
  if (!t) return '';
  return ALIASES[t.toLowerCase()] || t;
}

function normalizeSkills(list) {
  var seen = {}, out = [];
  (list || []).forEach(function (s) {
    var n = normalizeSkill(s), k = n.toLowerCase();
    if (n && !seen[k]) { seen[k] = 1; out.push(n); }
  });
  return out;
}

function splitSkills(text) { return normalizeSkills(String(text || '').split(/[,\n]/)); }

function tokenize(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9+#.\s]/g, ' ').split(/\s+/)
    .map(function (w) { return w.replace(/^\.+|\.+$/g, ''); })
    .filter(function (w) { return w.length > 1 && !STOP[w]; });
}

function termFreq(tokens) { var m = {}; tokens.forEach(function (t) { m[t] = (m[t] || 0) + 1; }); return m; }

function cosine(a, b) {
  var A = termFreq(a), B = termFreq(b), dot = 0, x = 0, y = 0, k;
  for (k in A) { x += A[k] * A[k]; if (B[k]) dot += A[k] * B[k]; }
  for (k in B) y += B[k] * B[k];
  return x && y ? dot / Math.sqrt(x * y) : 0;
}

function jaccard(a, b) {
  var A = {}, B = {}, i = 0, inter = 0, k, union = 0;
  a.forEach(function (t) { A[t] = 1; }); b.forEach(function (t) { B[t] = 1; });
  for (k in A) { union++; if (B[k]) inter++; }
  for (k in B) if (!A[k]) union++;
  return union ? inter / union : 0;
}

function eduLevel(text) {
  var t = String(text || '');
  if (/ph\.?\s?d|doctor/i.test(t)) return 5;
  if (/m\.?\s?tech|m\.?\s?sc|master|mba|mca/i.test(t)) return 4;
  if (/b\.?\s?tech|b\.?\s?e\b|b\.?\s?sc|bca|bachelor/i.test(t)) return 3;
  if (/diploma/i.test(t)) return 2;
  return 0;
}

var EDU_LABEL = { 0: 'Not detected', 2: 'Diploma', 3: "Bachelor's", 4: "Master's", 5: 'Doctorate' };

function totalYears(c) { return Math.max((c.experience || []).reduce(function (s, e) { return s + (Number(e.years) || 0); }, 0), Number(c.yearsOfExperience) || 0); }

function scoreCandidate(c, j, w) {
  var W = w || currentWeights();
  var req = normalizeSkills(j.req), pref = normalizeSkills(j.pref);
  var have = {};
  normalizeSkills(c.skills).forEach(function (s) { have[s.toLowerCase()] = 1; });
  var matched = req.filter(function (s) { return have[s.toLowerCase()]; });
  var missing = req.filter(function (s) { return !have[s.toLowerCase()]; });
  var mPref = pref.filter(function (s) { return have[s.toLowerCase()]; });
  var xPref = pref.filter(function (s) { return !have[s.toLowerCase()]; });
  /* Partial signals: required/preferred skills that are not listed as skills but appear
     in the candidate's experience or project details (deterministic substring check). */
  var profileText = ((c.experience || []).map(function (e) { return e.role + ' ' + e.summary; }).join(' ') + ' ' + (c.projects || []).map(function (p) { return p.name + ' ' + p.desc + ' ' + (p.tech || []).join(' '); }).join(' ')).toLowerCase();
  var partial = req.concat(pref).filter(function (s) { var l = s.toLowerCase(); return !have[l] && l.length > 2 && profileText.indexOf(l) >= 0; });

  var skills = Math.round(Math.min(100, (req.length ? matched.length / req.length * 90 : 90) + (pref.length ? mPref.length / pref.length * 10 : 0)));

  var years = totalYears(c), need = Number(j.exp) || 0, experience;
  if (need > 0) experience = years >= need ? Math.min(100, 85 + (years - need) * 7.5) : years / need * 85;
  else experience = Math.min(100, years / 3 * 100);
  experience = Math.round(experience);

  var candText = [normalizeSkills(c.skills).join(' ')]
    .concat((c.projects || []).map(function (p) { return p.name + ' ' + p.desc + ' ' + (p.tech || []).join(' '); }))
    .concat((c.experience || []).map(function (e) { return e.role + ' ' + e.summary; })).join(' ');
  var jobText = [j.title, j.desc, req.join(' '), pref.join(' ')].join(' ');
  var ct = tokenize(candText), jt = tokenize(jobText);
  var semantic = Math.round(Math.min(100, (0.7 * cosine(ct, jt) + 0.3 * jaccard(ct, jt)) * 200));

  var cLevel = 0;
  (c.education || []).forEach(function (e) { cLevel = Math.max(cLevel, eduLevel(e)); });
  var rLevel = eduLevel(j.edu);
  var education = rLevel === 0 ? (cLevel ? 100 : 60) : (cLevel >= rLevel ? 100 : Math.round(cLevel / rLevel * 80));

  var wanted = {}; req.concat(pref).forEach(function (s) { wanted[s.toLowerCase()] = 1; });
  var relProjects = (c.projects || []).filter(function (p) { return normalizeSkills(p.tech).some(function (t) { return wanted[t.toLowerCase()]; }); });
  var nProj = (c.projects || []).length, nCert = (c.certs || []).length;
  var projects = Math.min(100, relProjects.length * 35 + (nProj - relProjects.length) * 10 + nCert * 15);

  var overall = Math.round(skills * W.skills + experience * W.experience + semantic * W.semantic + education * W.education + projects * W.projects);

  var strengths = [], gaps = [], evidence = [];
  if (matched.length) strengths.push('Covers ' + matched.length + ' of ' + req.length + ' required skills: ' + matched.join(', ') + '.');
  if (need > 0 && years >= need) strengths.push(years + ' years of experience meets the ' + need + '-year requirement.');
  if (relProjects.length) strengths.push('Relevant project work: ' + relProjects.map(function (p) { return p.name; }).join(', ') + '.');
  if (mPref.length) strengths.push('Also has preferred skills: ' + mPref.join(', ') + '.');
  if (nCert) strengths.push('Certifications listed: ' + c.certs.join(', ') + '.');
  if (rLevel && cLevel >= rLevel) strengths.push('Education level meets the requirement.');
  if (missing.length) gaps.push('Required skills not found in the resume (this does not mean the candidate lacks them): ' + missing.join(', ') + '.');
  if (need > 0 && years < need) gaps.push(years + ' year(s) of experience against ' + need + ' required.');
  if (rLevel && cLevel < rLevel) gaps.push('Highest education found (' + EDU_LABEL[cLevel] + ') is below the required level (' + EDU_LABEL[rLevel] + ').');
  if (xPref.length) gaps.push('Preferred skills not found in the resume: ' + xPref.join(', ') + '.');
  if (!strengths.length) strengths.push('No clear strengths detected against this job.');
  if (!gaps.length) gaps.push('No gaps detected against the stated requirements.');
  evidence.push('Skills on profile: ' + (normalizeSkills(c.skills).join(', ') || 'none listed') + '.');
  (c.experience || []).forEach(function (e) { evidence.push(e.role + ' at ' + e.company + ' (' + e.years + ' yr): ' + e.summary); });
  (c.projects || []).forEach(function (p) { evidence.push('Project "' + p.name + '" using ' + ((p.tech || []).join(', ') || 'unspecified technologies') + '.'); });

  return {
    overall: overall, skills: skills, experience: experience, semantic: semantic, education: education, projects: projects,
    matched: matched.concat(mPref), missing: missing, matchedReq: matched, matchedPref: mPref, missingPref: xPref, partial: partial,
    strengths: strengths, gaps: gaps, evidence: evidence,
    notes: {
      experience: years + ' year(s) on the profile against ' + (need ? need + ' required.' : 'no stated requirement.'),
      education: 'Highest level found: ' + EDU_LABEL[cLevel] + '. Required: ' + (rLevel ? EDU_LABEL[rLevel] : 'not stated') + '.',
      project: relProjects.length + ' of ' + nProj + ' project(s) use required or preferred technologies; ' + nCert + ' certification(s).'
    },
    explanation: c.name + ' scored ' + overall + '%: skills ' + skills + '% (' + Math.round(W.skills * 100) + '% weight), experience ' + experience + '% (' + Math.round(W.experience * 100) + '%), relevance ' + semantic + '% (' + Math.round(W.semantic * 100) + '%), education ' + education + '% (' + Math.round(W.education * 100) + '%), projects and certifications ' + projects + '% (' + Math.round(W.projects * 100) + '%). Scores are calculated by fixed rules from the profile and the job requirements. No personal attributes such as gender, religion, race or age are used.'
  };
}

function findJob(d, id) { for (var i = 0; i < d.jobs.length; i++) if (String(d.jobs[i].id) === String(id)) return d.jobs[i]; return null; }

function findCand(d, id) { for (var i = 0; i < d.cands.length; i++) if (String(d.cands[i].id) === String(id)) return d.cands[i]; return null; }

function scoredAll(d, w) {
  var rows = [];
  d.cands.forEach(function (c) { var j = findJob(d, c.jobId); if (j) rows.push({ c: c, j: j, s: scoreCandidate(c, j, w), rank: 0 }); });
  var byJob = {};
  rows.forEach(function (r) { (byJob[r.j.id] = byJob[r.j.id] || []).push(r); });
  Object.keys(byJob).forEach(function (k) {
    byJob[k].sort(function (a, b) { return b.s.overall - a.s.overall || a.c.name.localeCompare(b.c.name); });
    byJob[k].forEach(function (r, i) { r.rank = i + 1; });
  });
  return rows;
}

function rankForJob(d, jobId, w) {
  return scoredAll(d, w).filter(function (r) { return String(r.j.id) === String(jobId); }).sort(function (a, b) { return a.rank - b.rank; });
}

function filterCandidates(d, f, w) {
  var q = String(f.q || '').trim().toLowerCase(), nq = normalizeSkill(q).toLowerCase();
  var rows = scoredAll(d, w).filter(function (r) {
    if (f.jobId && String(r.j.id) !== String(f.jobId)) return false;
    if (f.status && r.c.status !== f.status) return false;
    if (r.s.overall < (Number(f.min) || 0)) return false;
    if (q) {
      var hay = r.c.name.toLowerCase() + ' ' + r.c.email.toLowerCase();
      var skillHit = r.c.skills.some(function (s) { var a = String(s).toLowerCase(), n = normalizeSkill(s).toLowerCase(); return a.indexOf(q) >= 0 || n.indexOf(q) >= 0 || n.indexOf(nq) >= 0; });
      if (hay.indexOf(q) < 0 && !skillHit) return false;
    }
    return true;
  });
  var sort = f.sort || 'high';
  rows.sort(function (a, b) {
    if (sort === 'low') return a.s.overall - b.s.overall;
    if (sort === 'new') return new Date(b.c.created) - new Date(a.c.created);
    return b.s.overall - a.s.overall || a.c.name.localeCompare(b.c.name);
  });
  return rows;
}

function setStatus(d, id, status) {
  var c = findCand(d, id);
  if (!c || STATUSES.indexOf(status) < 0) return false;
  c.status = status;
  d.log.unshift({ t: new Date().toISOString(), m: c.name + ' marked ' + status });
  d.log = d.log.slice(0, 25);
  return true;
}

function countStatus(d, s) { return d.cands.filter(function (c) { return c.status === s; }).length; }

function buildReport(d, id) {
  var c = findCand(d, id), j = c && findJob(d, c.jobId);
  if (!c || !j) return null;
  return { cand: c, job: j, s: scoreCandidate(c, j), date: new Date().toISOString(), status: c.status, notes: c.notes || '' };
}

function analyzeJob(job) {
  var text = job.desc || '';
  function rx(k) { return new RegExp('(^|[^a-z0-9])' + k.replace(/[.+*?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z0-9])', 'i'); }
  function find(t) { var out = {}; Object.keys(ALIASES).forEach(function (k) { if (rx(k).test(t)) out[ALIASES[k]] = 1; }); return Object.keys(out); }
  var i = text.search(/preferred|nice to have|bonus|plus:/i);
  var reqPart = i > 0 ? text.slice(0, i) : text, prefPart = i > 0 ? text.slice(i) : '';
  var req = find(reqPart), pref = find(prefPart).filter(function (s) { return req.indexOf(s) < 0; });
  var m = text.match(/(\d+)\+?\s*(?:-\s*\d+\s*)?years?/i), e = text.match(/(b\.?tech|bachelor'?s?|master'?s?|m\.?tech|ph\.?d|diploma)[^.,;\n]*/i);
  var resp = text.split(/(?<=[.!?])\s+|\n/).filter(function (s) { return /build|develop|design|maintain|collaborat|analy|own|implement|create|ship|review|optimi/i.test(s); }).slice(0, 5).map(function (s) { return s.trim(); });
  return { req: req, pref: pref, exp: m ? m[0] : 'Not specified', expYears: m ? Number(m[1]) : 0, edu: e ? e[0].trim() : 'Not specified', resp: resp, at: new Date().toISOString() };
}

function makeQuestions(c, j, s) {
  var base = s.matched.length ? s.matched : normalizeSkills(j.req);
  var T = [
    function (x) { return 'Describe a real problem you solved with ' + x + ' and the trade-offs you made.'; },
    function (x) { return 'How do you test and debug code that relies on ' + x + '?'; },
    function (x) { return 'What are common mistakes when using ' + x + ', and how do you avoid them?'; },
    function (x) { return 'How would you review a teammate\'s pull request that involves ' + x + '?'; },
    function (x) { return 'How would you improve the performance or reliability of a system built with ' + x + '?'; }
  ];
  var tech = [], i;
  for (i = 0; i < 5; i++) tech.push(T[i % 5](base[i % Math.max(1, base.length)] || 'your main technology'));
  if (s.missing.length) tech[4] = 'Your profile does not list ' + s.missing[0] + ', which this role requires. How would you become productive with it in your first month?';
  var proj = (c.projects || []).slice(0, 2).map(function (p) { return 'Walk me through "' + p.name + '": why did you choose ' + ((p.tech && p.tech[0]) || 'that approach') + ', and what would you change now?'; });
  while (proj.length < 2) proj.push('Which part of your recent work best shows your fit for the ' + j.title + ' role, and why?');
  return {
    technical: tech,
    behavioral: ['Tell me about a time you disagreed with a teammate on a technical decision.', 'Describe a deadline you nearly missed and what you did about it.', 'How do you learn a new technology quickly?'],
    project: proj
  };
}
