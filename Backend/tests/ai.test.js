const test = require('node:test');
const assert = require('node:assert/strict');
const ai = require('../src/services/aiService');
const engine = require('../src/services/scoringEngine');

const job = { title: 'Backend Engineer', description: 'Node.js and MongoDB', requiredSkills: ['Node.js', 'MongoDB', 'AWS'], preferredSkills: [], experience: 1, education: '' };
const cand = { name: 'Dev', skills: ['Node', 'Mongo'], education: [], experience: [], projects: [{ name: 'API', desc: 'x', tech: ['Node.js'] }], certifications: [] };
const result = engine.scoreCandidate(cand, job);
const realFetch = global.fetch;
const env = { ...process.env };
test.afterEach(() => { global.fetch = realFetch; process.env = { ...env }; });

test('without AI configured, summary/questions fall back deterministically', async () => {
  delete process.env.AI_API_KEY; delete process.env.AI_MODEL;
  const s = await ai.generateSummary(cand, job, result);
  assert.equal(s.source, 'fallback'); assert.match(s.text, /Missing: AWS/);
  const q = await ai.generateInterviewQuestions(cand, job, result);
  assert.equal(q.source, 'fallback');
  for (const k of ['technical', 'behavioral', 'project', 'followUp']) assert.ok(q[k].length, k);
});

test('AI success path returns AI text and parsed questions (mocked provider)', async () => {
  process.env.AI_API_KEY = 'k'; process.env.AI_MODEL = 'm'; process.env.AI_PROVIDER = 'anthropic';
  let n = 0;
  global.fetch = async (url, opts) => {
    assert.match(url, /\/v1\/messages$/); assert.equal(opts.headers['x-api-key'], 'k');
    n++;
    const text = n === 1 ? 'Solid backend match; AWS is a gap.' : '```json\n{"technical":["T1"],"behavioral":["B1"],"project":["P1"],"followUp":["F1"]}\n```';
    return { ok: true, json: async () => ({ content: [{ type: 'text', text }] }) };
  };
  const s = await ai.generateSummary(cand, job, result);
  assert.deepEqual(s, { text: 'Solid backend match; AWS is a gap.', source: 'ai' });
  const q = await ai.generateInterviewQuestions(cand, job, result);
  assert.equal(q.source, 'ai'); assert.deepEqual(q.technical, ['T1']);
});

test('AI failure (network error, HTTP error, junk output) never throws and falls back', async () => {
  process.env.AI_API_KEY = 'k'; process.env.AI_MODEL = 'm';
  for (const impl of [
    async () => { throw new Error('network down'); },
    async () => ({ ok: false, status: 500, json: async () => ({}) }),
    async () => ({ ok: true, json: async () => ({ content: [{ type: 'text', text: 'not json at all' }] }) })
  ]) {
    global.fetch = impl;
    assert.equal((await ai.generateSummary(cand, job, result)).source === 'ai', impl.toString().includes('not json') ? true : false);
    assert.equal((await ai.generateInterviewQuestions(cand, job, result)).source, 'fallback');
    assert.equal(await ai.enhanceJobAnalysis('Node.js job', { requiredSkills: [], preferredSkills: [] }), null);
  }
});

test('AI job analysis only keeps skills literally present in the description', async () => {
  process.env.AI_API_KEY = 'k'; process.env.AI_MODEL = 'm';
  global.fetch = async () => ({ ok: true, json: async () => ({ content: [{ type: 'text', text: '{"requiredSkills":["Docker","Kubernetes"],"preferredSkills":[],"responsibilities":["Run services"]}' }] }) });
  const r = await ai.enhanceJobAnalysis('We use Docker daily.', { requiredSkills: [], preferredSkills: [] });
  assert.deepEqual(r.requiredSkills, ['Docker']);
});
