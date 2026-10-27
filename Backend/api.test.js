// Integration tests: need `npm install` (supertest + mongodb-memory-server). Skipped automatically if those are missing.
const test = require('node:test');
const assert = require('node:assert/strict');

let request, MongoMemoryServer, mongoose;
try {
  request = require('supertest');
  ({ MongoMemoryServer } = require('mongodb-memory-server'));
  mongoose = require('mongoose');
} catch (e) { /* dependencies not installed */ }
const skip = request ? false : 'supertest / mongodb-memory-server not installed (run npm install)';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-test-secret';
delete process.env.AI_API_KEY; delete process.env.AI_MODEL;

test('API', { skip }, async (t) => {
  const mongod = await MongoMemoryServer.create();
  const { connectDB } = require('../src/config/db');
  await connectDB(mongod.getUri());
  const app = require('../src/server').createApp();
  const api = request(app);
  t.after(async () => { await mongoose.disconnect(); await mongod.stop(); });

  const ctx = {};
  const creds = { name: 'Rita Recruiter', email: 'Rita@Example.com', password: 'correct-horse-1' };
  let token, auth;

  await t.test('health reports database state', async () => {
    const r = await api.get('/api/health');
    assert.equal(r.status, 200); assert.deepEqual(r.body, { status: 'ok', database: 'connected' });
  });

  await t.test('register, login, invalid password, /me', async () => {
    const reg = await api.post('/api/auth/register').send(creds);
    assert.equal(reg.status, 201); assert.ok(reg.body.data.token); assert.equal(reg.body.data.user.role, 'recruiter');
    assert.equal(reg.body.data.user.passwordHash, undefined);
    assert.equal((await api.post('/api/auth/register').send(creds)).status, 409);
    assert.equal((await api.post('/api/auth/register').send({ ...creds, email: 'b@example.com', password: 'short' })).status, 400);
    const escalate = await api.post('/api/auth/register').send({ name: 'X', email: 'x@example.com', password: 'longenough1', role: 'admin' });
    assert.equal(escalate.body.data.user.role, 'recruiter');
    const bad = await api.post('/api/auth/login').send({ email: creds.email, password: 'wrong-password' });
    assert.equal(bad.status, 401); assert.equal(bad.body.success, false);
    const ok = await api.post('/api/auth/login').send({ email: creds.email, password: creds.password });
    assert.equal(ok.status, 200); token = ok.body.data.token; auth = { Authorization: `Bearer ${token}` };
    const me = await api.get('/api/auth/me').set(auth);
    assert.equal(me.body.data.user.email, 'rita@example.com');
  });

  await t.test('protected routes reject missing/invalid/tampered JWT', async () => {
    assert.equal((await api.get('/api/jobs')).status, 401);
    assert.equal((await api.get('/api/jobs').set('Authorization', 'Bearer not.a.jwt')).status, 401);
    assert.equal((await api.get('/api/jobs').set('Authorization', `Bearer ${token.slice(0, -3)}abc`)).status, 401);
    assert.equal((await api.get('/api/analytics')).status, 401);
    assert.equal((await api.post('/api/candidates/upload').attach('resume', require('path').join(__dirname, 'fixtures', 'priya_nair.pdf'))).status, 401); // unauthenticated upload
    assert.equal((await api.get('/api/candidates/upload-config')).status, 401);
    assert.equal((await api.get('/api/reports/000000000000000000000001')).status, 401);
  });

  let jobId; const cand = {};
  await t.test('jobs CRUD (+ requirements filled from description)', async () => {
    const c = await api.post('/api/jobs').set(auth).send({ title: 'Full Stack Developer', company: 'Lumen', description: 'Build apps with React, Node.js and MongoDB. 2+ years of experience. Bachelor\'s degree. Preferred: Docker and AWS.' });
    assert.equal(c.status, 201); jobId = c.body.data._id;
    assert.ok(c.body.data.requiredSkills.includes('React')); assert.deepEqual(c.body.data.preferredSkills.sort(), ['AWS', 'Docker']);
    assert.equal((await api.post('/api/jobs').set(auth).send({ company: 'no title' })).status, 400);
    assert.equal((await api.get(`/api/jobs/${jobId}`).set(auth)).body.data.title, 'Full Stack Developer');
    assert.equal((await api.get('/api/jobs/not-an-id').set(auth)).status, 400);
    const u = await api.put(`/api/jobs/${jobId}`).set(auth).send({ location: 'Indore', status: 'Closed' });
    assert.equal(u.body.data.location, 'Indore'); assert.equal(u.body.data.status, 'Closed');
    assert.equal((await api.put(`/api/jobs/${jobId}`).set(auth).send({ status: 'Bogus' })).status, 400);
    assert.equal((await api.get('/api/jobs').set(auth)).body.data.length, 1);
  });

  await t.test('jobs are private to their owner', async () => {
    const other = await api.post('/api/auth/register').send({ name: 'Other', email: 'other@example.com', password: 'another-pass-1' });
    const oa = { Authorization: `Bearer ${other.body.data.token}` };
    assert.equal((await api.get(`/api/jobs/${jobId}`).set(oa)).status, 404);
    assert.equal((await api.delete(`/api/jobs/${jobId}`).set(oa)).status, 404);
  });

  await t.test('candidates CRUD + filters', async () => {
    const mk = (name, skills, years, projects) => api.post('/api/candidates').set(auth).send({
      name, email: `${name.toLowerCase()}@example.com`, job: jobId, skills, education: ['B.Tech in Computer Science'],
      experience: [{ role: 'Dev', company: 'Co', years, summary: 'Web development' }], projects
    });
    const a = await mk('Aarav', ['JS', 'ReactJS', 'Node', 'Mongo DB'], 3, [{ name: 'Booking', desc: 'app', tech: ['React', 'Node.js', 'MongoDB'] }]);
    const b = await mk('Rahul', ['JS', 'HTML'], 1, []);
    assert.equal(a.status, 201); assert.deepEqual(a.body.data.skills, ['JavaScript', 'React', 'Node.js', 'MongoDB']);
    cand.a = a.body.data._id; cand.b = b.body.data._id;
    assert.equal((await api.post('/api/candidates').set(auth).send({ email: 'x@y.com' })).status, 400);
    assert.equal((await api.post('/api/candidates').set(auth).send({ name: 'Z', email: 'not-an-email' })).status, 400);
    assert.equal((await api.get('/api/candidates?search=aar').set(auth)).body.data.length, 1);
    assert.equal((await api.get('/api/candidates?skill=reactjs').set(auth)).body.data.length, 1);
    assert.equal((await api.get(`/api/candidates/${cand.a}`).set(auth)).body.data.name, 'Aarav');
    const u = await api.put(`/api/candidates/${cand.b}`).set(auth).send({ location: 'Bhopal' });
    assert.equal(u.body.data.location, 'Bhopal');
    assert.equal((await api.put(`/api/candidates/${cand.b}`).set(auth).send({ status: 'Nope' })).status, 400);
    assert.equal((await api.get('/api/candidates/000000000000000000000000').set(auth)).status, 404);
  });

  await t.test('screening, skill normalization, missing skills, ranking, simulator, compare', async () => {
    const s = await api.post('/api/screen').set(auth).send({ candidateId: cand.a, jobId });
    assert.equal(s.status, 201);
    const d = s.body.data;
    for (const k of ['overallScore', 'skillsScore', 'experienceScore', 'semanticScore', 'educationScore', 'projectsScore', 'matchedSkills', 'partialSkills', 'missingSkills', 'strengths', 'gaps', 'evidence', 'summary']) assert.ok(k in d, k);
    assert.ok(d.matchedSkills.includes('MongoDB')); assert.equal(d.summarySource, 'fallback');
    await api.post('/api/screen').set(auth).send({ candidateId: cand.b, jobId });
    const missing = await api.post('/api/screen').set(auth).send({ candidateId: cand.b, jobId });
    assert.ok(missing.body.data.missingSkills.includes('React'));
    assert.equal((await api.post('/api/screen').set(auth).send({ candidateId: cand.a, jobId, weights: { skills: 0.9 } })).status, 400);
    assert.equal((await api.post('/api/screen').set(auth).send({ candidateId: 'bad', jobId })).status, 400);

    const rank = await api.get(`/api/jobs/${jobId}/ranking`).set(auth);
    assert.equal(rank.body.data.length, 2); assert.equal(rank.body.data[0].name, 'Aarav'); assert.equal(rank.body.data[0].rank, 1);
    assert.equal((await api.get(`/api/jobs/${jobId}/ranking?sort=bogus`).set(auth)).status, 400);
    const sim = await api.post(`/api/jobs/${jobId}/ranking/simulate`).set(auth).send({ weights: { skills: 0.05, experience: 0.75, semantic: 0.1, education: 0.05, projects: 0.05 } });
    assert.equal(sim.status, 200);
    for (const r of sim.body.data.rankings) assert.ok('originalRank' in r && 'simulatedRank' in r && 'rankChange' in r);
    const after = await api.get(`/api/jobs/${jobId}/ranking`).set(auth);
    assert.deepEqual(after.body.data.map((r) => r.overallScore), rank.body.data.map((r) => r.overallScore)); // not persisted

    const cmp = await api.post('/api/candidates/compare').set(auth).send({ candidateIds: [cand.a, cand.b], jobId });
    assert.equal(cmp.status, 200); assert.equal(cmp.body.data.candidates.length, 2); assert.equal(cmp.body.data.winner, undefined);
    assert.equal((await api.post('/api/candidates/compare').set(auth).send({ candidateIds: [cand.a], jobId })).status, 400);
    assert.ok((await api.get('/api/candidates?minimumScore=95').set(auth)).body.data.length <= 1);
  });

  await t.test('interview questions (AI unconfigured -> fallback), report, analytics', async () => {
    const q = await api.post('/api/interview/questions').set(auth).send({ candidateId: cand.b, jobId });
    assert.equal(q.status, 200); assert.equal(q.body.data.source, 'fallback');
    for (const k of ['technical', 'behavioral', 'project', 'followUp']) assert.ok(q.body.data[k].length);
    const rep = await api.get(`/api/reports/${cand.a}?jobId=${jobId}`).set(auth);
    assert.equal(rep.status, 200); assert.ok(rep.body.data.scores.overallScore >= 0); assert.ok(rep.body.data.fairness);
    const an = await api.get('/api/analytics').set(auth);
    assert.equal(an.body.data.totalJobs, 1); assert.equal(an.body.data.totalCandidates, 2); assert.equal(an.body.data.screened, 2);
    assert.ok(an.body.data.averageScore > 0); assert.ok(an.body.data.skillGaps.length);
  });

  await t.test('status changes and audit logs', async () => {
    await api.put(`/api/candidates/${cand.a}`).set(auth).send({ status: 'Shortlisted' });
    await api.put(`/api/candidates/${cand.b}`).set(auth).send({ status: 'Rejected' });
    const logs = await api.get('/api/audit-logs?limit=100').set(auth);
    const actions = new Set(logs.body.data.map((l) => l.action));
    for (const a of ['LOGIN', 'JOB_CREATED', 'CANDIDATE_CREATED', 'SCREENING_COMPLETED', 'CANDIDATE_SHORTLISTED', 'CANDIDATE_REJECTED', 'REPORT_GENERATED']) assert.ok(actions.has(a), a);
    assert.equal(JSON.stringify(logs.body).includes('passwordHash'), false);
  });

  await t.test('resume upload rejects unsupported and spoofed files', async () => {
    const bad = await api.post('/api/candidates/upload').set(auth).attach('resume', Buffer.from('MZ binary'), { filename: 'evil.exe', contentType: 'application/octet-stream' });
    assert.equal(bad.status, 415);
    const spoof = await api.post('/api/candidates/upload').set(auth).attach('resume', Buffer.from('not a pdf'), { filename: 'cv.pdf', contentType: 'application/pdf' });
    assert.equal(spoof.status, 415);
    assert.equal((await api.post('/api/candidates/upload').set(auth)).status, 400);
    const big = await api.post('/api/candidates/upload').set(auth).attach('resume', Buffer.alloc(5 * 1024 * 1024 + 10, 'a'), { filename: 'big.pdf', contentType: 'application/pdf' });
    assert.equal(big.status, 413);
  });

  await t.test('REAL resume upload: PDF + DOCX create different candidates, no demo data, duplicates rejected', async () => {
    const fs = require('fs'); const path = require('path');
    const fx = (n) => path.join(__dirname, 'fixtures', n);
    const role = await api.post('/api/jobs').set(auth).send({ title: 'Resume Test Role', description: 'React, Node.js and MongoDB. 2+ years of experience. Bachelor\'s degree.' });
    const jobId2 = role.body.data._id;
    const up = (n, extra = {}) => { let r = api.post('/api/candidates/upload').set(auth).field('job', jobId2); for (const [k, v] of Object.entries(extra)) r = r.field(k, v); return r.attach('resume', fx(n)); };

    assert.equal((await api.post('/api/candidates/upload').set(auth).attach('resume', fx('priya_nair.pdf'))).status, 400); // job is required
    const prev = await up('priya_nair.pdf', { preview: 'true' });
    assert.equal(prev.status, 200); assert.equal(prev.body.data.preview.name, 'Priya Nair');
    assert.equal((await api.get(`/api/candidates?job=${jobId2}`).set(auth)).body.data.length, 0);          // preview saves nothing

    const a = await up('priya_nair.pdf'), b = await up('rohan_mehta.pdf'), c = await up('ananya_iyer.docx'), d = await up('marcus_webb.docx');
    for (const r of [a, b, c, d]) assert.equal(r.status, 201, JSON.stringify(r.body));
    const names = [a, b, c, d].map((r) => r.body.data.candidate.name);
    assert.deepEqual(names, ['Priya Nair', 'Rohan Mehta', 'Ananya Iyer', 'Marcus Webb']);
    assert.ok(!JSON.stringify([a.body, b.body, c.body, d.body]).match(/Dev Malhotra/i));
    assert.equal(a.body.data.candidate.resumeText, undefined);
    assert.ok(a.body.data.candidate.skills.includes('React')); assert.equal(a.body.data.candidate.email, 'priya.nair@example.com');
    assert.equal(b.body.data.candidate.experience.length, 0);                                               // nothing invented for a fresher

    const dup = await up('priya_nair.pdf');
    assert.equal(dup.status, 409); assert.equal(dup.body.message, 'This candidate already exists for this job.');

    // invalid files
    assert.equal((await api.post('/api/candidates/upload').set(auth).field('job', jobId2).attach('resume', fx('fake.exe'))).status, 415);
    assert.equal((await api.post('/api/candidates/upload').set(auth).field('job', jobId2).attach('resume', fx('corrupted.pdf'))).status, 422);
    assert.equal((await api.post('/api/candidates/upload').set(auth).field('job', jobId2).attach('resume', fx('empty_text.pdf'))).status, 422);
    assert.equal((await api.post('/api/candidates/upload').set(auth).field('job', jobId2).attach('resume', fx('empty_document.docx'))).status, 422);
    assert.equal((await api.post('/api/candidates/upload').set(auth).field('job', jobId2).attach('resume', fx('too_little.pdf'))).status, 422);

    // screening / ranking / compare / interview / report / analytics / audit all use the uploaded data
    const ids = [a, b, c, d].map((r) => r.body.data.candidate._id);
    for (const id of ids) assert.equal((await api.post('/api/screen').set(auth).send({ candidateId: id, jobId: jobId2 })).status, 201);
    const sPriya = (await api.post('/api/screen').set(auth).send({ candidateId: ids[0], jobId: jobId2 })).body.data;
    assert.ok(sPriya.matchedSkills.includes('React') && sPriya.matchedSkills.includes('MongoDB')); assert.deepEqual(sPriya.missingSkills, []);
    assert.ok(sPriya.evidence.some((e) => /Hostel Booking Platform/.test(e)));
    const rank = await api.get(`/api/jobs/${jobId2}/ranking`).set(auth);
    assert.equal(rank.body.data.length, 4); assert.equal(rank.body.data[0].name, 'Priya Nair');
    const cmp = await api.post('/api/candidates/compare').set(auth).send({ candidateIds: ids.slice(0, 3), jobId: jobId2 });
    assert.equal(cmp.status, 200); assert.deepEqual(cmp.body.data.candidates.map((x) => x.name), ['Priya Nair', 'Rohan Mehta', 'Ananya Iyer']);
    const iq = await api.post('/api/interview/questions').set(auth).send({ candidateId: ids[1], jobId: jobId2 });
    assert.equal(iq.status, 200); for (const k of ['technical', 'behavioral', 'project', 'roleSpecific', 'skillGap', 'followUp']) assert.ok(Array.isArray(iq.body.data[k]), k);
    assert.ok(iq.body.data.skillGap.some((q) => /Node\.js|MongoDB|React/.test(q)));                        // Rohan's real gaps
    assert.ok(iq.body.data.project.some((q) => /Library Management System|Weather Dashboard/.test(q)));      // his real projects
    const rep = await api.get(`/api/reports/${ids[0]}?jobId=${jobId2}`).set(auth);
    assert.equal(rep.status, 200); assert.equal(rep.body.data.candidate.name, 'Priya Nair'); assert.ok(rep.body.data.relevantProjects.includes('Hostel Booking Platform'));
    const an = await api.get('/api/analytics').set(auth);
    assert.ok(an.body.data.totalCandidates >= 4); assert.ok(an.body.data.screened >= 4);
    const logs = (await api.get('/api/audit-logs?limit=100').set(auth)).body.data.map((l) => l.action);
    for (const act of ['RESUME_PARSED', 'RESUME_UPLOADED', 'RANKING_GENERATED', 'INTERVIEW_QUESTIONS_GENERATED', 'REPORT_GENERATED']) assert.ok(logs.includes(act), act);
    ctx.uploadedIds = ids; ctx.uploadJob = jobId2;
  });

  await t.test('multi-tenant isolation: user B cannot read or use user A candidates, jobs, rankings or reports', async () => {
    const b = await api.post('/api/auth/register').send({ name: 'Bea B', email: 'bea@example.com', password: 'bea-password-1' });
    const ba = { Authorization: `Bearer ${b.body.data.token}` };
    const [id] = ctx.uploadedIds;
    assert.equal((await api.get(`/api/candidates/${id}`).set(ba)).status, 404);
    assert.equal((await api.put(`/api/candidates/${id}`).set(ba).send({ status: 'Rejected' })).status, 404);
    assert.equal((await api.get(`/api/reports/${id}?jobId=${ctx.uploadJob}`).set(ba)).status, 404);
    assert.equal((await api.get(`/api/jobs/${ctx.uploadJob}/ranking`).set(ba)).status, 404);
    assert.equal((await api.post('/api/screen').set(ba).send({ candidateId: id, jobId: ctx.uploadJob })).status, 404);
    assert.equal((await api.post('/api/interview/questions').set(ba).send({ candidateId: id, jobId: ctx.uploadJob })).status, 404);
    assert.equal((await api.post('/api/candidates/upload').set(ba).field('job', ctx.uploadJob).attach('resume', require('path').join(__dirname, 'fixtures', 'priya_nair.pdf'))).status, 404);
    const cfg = await api.get('/api/candidates/upload-config').set(auth); assert.equal(cfg.status, 200); assert.equal(cfg.body.data.maxBytes, 5 * 1024 * 1024);
    const own = await api.get(`/api/candidates/${id}`).set(auth); assert.equal(own.status, 200); assert.equal(own.body.data.resumeText, undefined); assert.ok(own.body.data.extraction && own.body.data.extraction.method);
    assert.equal((await api.get('/api/candidates').set(ba)).body.data.length, 0);
    assert.equal((await api.get('/api/analytics').set(ba)).body.data.totalCandidates, 0);
    assert.equal((await api.get('/api/audit-logs').set(ba)).body.data.some((l) => l.action === 'RESUME_UPLOADED'), false);
  });

  await t.test('delete cascades and errors are predictable', async () => {
    assert.equal((await api.delete(`/api/candidates/${cand.b}`).set(auth)).status, 200);
    assert.equal((await api.delete(`/api/jobs/${jobId}`).set(auth)).status, 200);
    const nf = await api.get(`/api/jobs/${jobId}`).set(auth);
    assert.deepEqual(nf.body, { success: false, message: 'Job not found' });
    assert.equal((await api.get('/api/nope').set(auth)).status, 404);
    assert.equal((await api.post('/api/auth/login').set('Content-Type', 'application/json').send('{bad json')).status, 400);
  });
});
