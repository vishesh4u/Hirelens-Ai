// Pure-logic tests: no database or network needed.
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSkill, normalizeSkills, findSkillsInText } = require('../src/services/skillNormalizer');
const engine = require('../src/services/scoringEngine');
const { analyzeJobDeterministic } = require('../src/services/jobAnalyzer');
const { parseResumeText, validateUpload } = require('../src/services/resumeParser');
const { loadFrontendDemoData, loadFrontendModules } = require('../scripts/loadFrontend');

const job = {
  title: 'Full Stack Developer', description: 'Build apps with React, Node.js and MongoDB. REST API endpoints.',
  requiredSkills: ['JavaScript', 'React', 'Node.js', 'MongoDB', 'REST API'], preferredSkills: ['Docker', 'AWS', 'TypeScript'],
  experience: 2, education: "Bachelor's"
};
const strong = {
  name: 'Aarav', skills: ['JS', 'ReactJS', 'Node', 'Mongo DB', 'REST APIs', 'TypeScript'], education: ['B.Tech in Computer Science'],
  experience: [{ role: 'Software Engineer', company: 'X', years: 3, summary: 'React dashboards and Node.js services on MongoDB.' }],
  projects: [{ name: 'Booking', desc: 'Full-stack app', tech: ['React', 'Node.js', 'MongoDB'] }], certifications: []
};
const weak = { name: 'Rahul', skills: ['JS', 'HTML'], education: ['BCA'], experience: [{ role: 'Intern', company: 'Y', years: 1, summary: 'Static pages' }], projects: [], certifications: [] };

test('skill normalization maps aliases to canonical names', () => {
  const cases = { JS: 'JavaScript', ReactJS: 'React', 'React.js': 'React', Node: 'Node.js', NodeJS: 'Node.js', Mongo: 'MongoDB', 'Mongo DB': 'MongoDB', Postgres: 'PostgreSQL', 'REST API': 'REST API' };
  for (const [k, v] of Object.entries(cases)) assert.equal(normalizeSkill(k), v);
  assert.deepEqual(normalizeSkills(['js', 'JavaScript', ' reactjs ']), ['JavaScript', 'React']);
  assert.equal(normalizeSkill('Rust'), 'Rust'); // unknown skills pass through untouched
});

test('free-text detection does not fire on ambiguous English words', () => {
  assert.deepEqual(findSkillsInText('Please express your rest interests'), []);
  assert.ok(findSkillsInText('Built services with MySQL and Docker').includes('Docker'));
  assert.ok(!findSkillsInText('mysql only').includes('SQL'));
});

test('overall score equals the weighted sum of components', () => {
  const r = engine.scoreCandidate(strong, job);
  const w = engine.DEFAULT_WEIGHTS;
  assert.equal(r.overallScore, Math.round(r.skillsScore * w.skills + r.experienceScore * w.experience + r.semanticScore * w.semantic + r.educationScore * w.education + r.projectsScore * w.projects));
  for (const k of ['skillsScore', 'experienceScore', 'semanticScore', 'educationScore', 'projectsScore', 'overallScore']) assert.ok(r[k] >= 0 && r[k] <= 100, k);
});

test('missing skills and explainability come from actual data', () => {
  const r = engine.scoreCandidate(weak, job);
  assert.deepEqual(r.missingSkills, ['React', 'Node.js', 'MongoDB', 'REST API']);
  assert.deepEqual(r.matchedRequired, ['JavaScript']);
  assert.ok(r.gaps.some((g) => g.includes('React')));
  assert.ok(r.evidence.every((e) => typeof e === 'string' && e.length));
  const s = engine.scoreCandidate(strong, job);
  assert.ok(s.evidence.some((e) => e.includes('Project "Booking"') && e.includes('React')));
  assert.deepEqual(s.missingSkills, []);
  assert.ok(engine.scoreCandidate(strong, job).overallScore > r.overallScore);
});

test('weights are validated (must total 100%) and accept percentages', () => {
  assert.throws(() => engine.resolveWeights({ skills: 0.9 }), /total 100%/);
  assert.throws(() => engine.resolveWeights({ bogus: 1 }), /Unknown weight/);
  assert.throws(() => engine.resolveWeights({ skills: -1 }), /non-negative/);
  const w = engine.resolveWeights({ skills: 50, experience: 25, semantic: 15, education: 5, projects: 5 });
  assert.equal(w.skills, 0.5);
  assert.deepEqual(engine.resolveWeights(), { ...engine.DEFAULT_WEIGHTS });
});

test('scoring does not use protected attributes', () => {
  const a = engine.scoreCandidate({ ...strong, gender: 'female', age: 55, religion: 'x', maritalStatus: 'single' }, job);
  const b = engine.scoreCandidate({ ...strong, gender: 'male', age: 22, religion: 'y', maritalStatus: 'married' }, job);
  assert.deepEqual(a, b);
});

test('ranking sorts, and the simulator re-ranks without touching saved rows', () => {
  const mk = (id, o) => ({ candidateId: id, name: id, status: 'New', overallScore: 0, ...o });
  const rows = [
    mk('A', { skillsScore: 60, experienceScore: 100, semanticScore: 70, educationScore: 80, projectsScore: 70 }),
    mk('B', { skillsScore: 95, experienceScore: 40, semanticScore: 70, educationScore: 80, projectsScore: 70 })
  ].map((r) => ({ ...r, overallScore: engine.computeOverall(r, engine.DEFAULT_WEIGHTS) }));
  const before = JSON.stringify(rows);
  const ranked = engine.rankRows(rows, 'skills');
  assert.equal(ranked[0].candidateId, 'B');
  const sim = engine.simulateRanking(rows, { skills: 0.05, experience: 0.75, semantic: 0.1, education: 0.05, projects: 0.05 });
  const a = sim.rankings.find((r) => r.candidateId === 'A');
  const b = sim.rankings.find((r) => r.candidateId === 'B');
  assert.equal(a.simulatedRank, 1);
  assert.equal(a.rankChange, a.originalRank - a.simulatedRank);
  assert.equal(b.rankChange, b.originalRank - b.simulatedRank);
  assert.equal(JSON.stringify(rows), before);
});

test('scores match the frontend engine on its own demo data', () => {
  // Cross-check: run the frontend's own scoreCandidate (frontend/js/scoring.js) on its demo data and compare.
  const sb = loadFrontendModules(['config', 'scoring', 'state']);
  const vm = require('vm');
  const { data, score } = vm.runInContext('({ data: defaultData(), score: scoreCandidate })', sb);
  for (const c of data.cands) {
    const j = data.jobs.find((x) => x.id === c.jobId);
    const fe = score(c, j, { skills: 0.35, experience: 0.20, semantic: 0.25, education: 0.10, projects: 0.10 });
    const be = engine.scoreCandidate(
      { ...c, certifications: c.certs },
      { title: j.title, description: j.desc, requiredSkills: j.req, preferredSkills: j.pref, experience: j.exp, education: j.edu });
    assert.equal(be.overallScore, fe.overall, c.name);
    assert.equal(be.skillsScore, fe.skills, c.name);
  }
});

test('job description analysis extracts skills, years and education', () => {
  const a = analyzeJobDeterministic("Design REST API services using Node.js, Express and MongoDB. 3+ years of experience required. Bachelor's degree in engineering. Nice to have: Docker, AWS and Redis.");
  assert.ok(['Node.js', 'Express.js', 'MongoDB', 'REST API'].every((s) => a.requiredSkills.includes(s)));
  assert.deepEqual(a.preferredSkills.sort(), ['AWS', 'Docker', 'Redis']);
  assert.equal(a.experience.years, 3);
  assert.match(a.education, /Bachelor/i);
});

test('resume parser extracts structure and never invents data', () => {
  const text = `AARAV SHARMA
aarav@example.com | +91 98765 43210

SKILLS
Languages: JavaScript, TypeScript
Frameworks: ReactJS, Node, Express JS

EXPERIENCE
Software Engineer at Brightline Apps  2021 - 2024
- Built React dashboards and Node.js services.

PROJECTS
Hostel Booking - Full-stack booking app
Tech: React, Node.js, MongoDB

EDUCATION
B.Tech in Computer Science, Riverbend Institute (2021)

CERTIFICATIONS
- Front-End Developer Certificate`;
  const p = parseResumeText(text);
  assert.equal(p.name, 'Aarav Sharma');
  assert.equal(p.email, 'aarav@example.com');
  assert.match(p.phone, /98765/);
  assert.ok(['JavaScript', 'React', 'Node.js', 'Express.js'].every((s) => p.skills.includes(s)));
  assert.equal(p.experience[0].years, 3);
  assert.equal(p.projects[0].name, 'Hostel Booking');
  assert.ok(p.projects[0].tech.includes('MongoDB'));
  assert.match(p.education[0], /B\.Tech/);
  assert.deepEqual(p.certifications, ['Front-End Developer Certificate']);
  const empty = parseResumeText('Just some words with no structure');
  assert.equal(empty.email, ''); assert.deepEqual(empty.experience, []); assert.equal(empty.resumeText, 'Just some words with no structure');
});

test('upload validation rejects bad type, spoofed content, oversize and empty files', () => {
  const pdf = Buffer.from('%PDF-1.4 test');
  assert.equal(validateUpload({ originalname: 'cv.pdf', mimetype: 'application/pdf', size: pdf.length, buffer: pdf }), '.pdf');
  assert.throws(() => validateUpload({ originalname: 'cv.exe', mimetype: 'application/octet-stream', size: 5, buffer: pdf }), /Unsupported/);
  assert.throws(() => validateUpload({ originalname: 'cv.pdf', mimetype: 'application/pdf', size: 5, buffer: Buffer.from('MZ....') }), /not a valid PDF/);
  assert.throws(() => validateUpload({ originalname: 'cv.pdf', mimetype: 'text/plain', size: 5, buffer: pdf }), /does not match/);
  assert.throws(() => validateUpload({ originalname: 'cv.pdf', mimetype: 'application/pdf', size: 6 * 1024 * 1024, buffer: pdf }), /too large/);
  assert.throws(() => validateUpload(undefined), /No resume/);
});

test('seed loader reads the frontend demo dataset', () => {
  const d = loadFrontendDemoData();
  assert.equal(d.jobs.length, 4);
  assert.equal(d.cands.length, 8);
});
