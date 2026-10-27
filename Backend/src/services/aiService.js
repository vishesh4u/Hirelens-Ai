/**
 * All AI-provider code lives here. AI is an optional enhancement:
 * every public function falls back to deterministic output and never throws.
 * The AI never sets or changes a score.
 */
const { normalizeSkills } = require('./skillNormalizer');

const TIMEOUT_MS = 20000;

const isConfigured = () => Boolean(process.env.AI_API_KEY && process.env.AI_MODEL);
const embeddingsConfigured = () => Boolean(process.env.AI_API_KEY && process.env.AI_EMBEDDING_MODEL &&
  (process.env.AI_PROVIDER || 'anthropic') === 'openai');

async function postJson(url, headers, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ctrl.signal });
    if (!res.ok) throw new Error(`AI provider responded ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Returns the model's text, or throws. Keys are only sent to the provider, never logged or returned. */
async function complete(system, user, maxTokens = 700) {
  const provider = process.env.AI_PROVIDER || 'anthropic';
  if (provider === 'openai') {
    const base = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    const data = await postJson(`${base}/chat/completions`, { authorization: `Bearer ${process.env.AI_API_KEY}` }, {
      model: process.env.AI_MODEL, max_tokens: maxTokens, temperature: 0.2,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
    });
    return data.choices[0].message.content;
  }
  const base = (process.env.AI_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');
  const data = await postJson(`${base}/v1/messages`, { 'x-api-key': process.env.AI_API_KEY, 'anthropic-version': '2023-06-01' }, {
    model: process.env.AI_MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }]
  });
  return data.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
}

function parseJsonLoose(text) {
  const cleaned = String(text).replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{'), end = cleaned.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('No JSON in AI response');
  return JSON.parse(cleaned.slice(start, end + 1));
}
const strList = (v, max = 8) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, max) : []);

const GUARD = 'Use ONLY the facts provided. Never infer or mention gender, religion, caste, race, age, photo, marital status or other personal attributes. Do not invent experience or skills. Do not state or change any score.';

/* ------------------------------ deterministic fallbacks ------------------------------ */
function fallbackSummary(candidate, job, r) {
  const parts = [`${candidate.name || 'The candidate'} scored ${r.overallScore}% for ${job.title}.`];
  if (r.matchedRequired && r.matchedRequired.length) parts.push(`Matches ${r.matchedRequired.length} of ${r.matchedRequired.length + r.missingSkills.length} required skills (${r.matchedRequired.join(', ')}).`);
  if (r.missingSkills.length) parts.push(`Missing: ${r.missingSkills.join(', ')}.`);
  else parts.push('No required skills are missing.');
  parts.push('Scores are decision support; the final decision rests with the recruiter.');
  return parts.join(' ');
}

function fallbackQuestions(candidate, job, r) {
  const base = r.matchedSkills.length ? r.matchedSkills : normalizeSkills(job.requiredSkills);
  const T = [
    (x) => `Describe a real problem you solved with ${x} and the trade-offs you made.`,
    (x) => `How do you test and debug code that relies on ${x}?`,
    (x) => `What are common mistakes when using ${x}, and how do you avoid them?`,
    (x) => `How would you review a teammate's pull request that involves ${x}?`,
    (x) => `How would you improve the performance or reliability of a system built with ${x}?`
  ];
  const technical = T.map((f, i) => f(base[i % Math.max(1, base.length)] || 'your main technology'));
  if (r.missingSkills.length) technical[4] = `Your profile does not list ${r.missingSkills[0]}, which this role requires. How would you become productive with it in your first month?`;
  const project = (candidate.projects || []).slice(0, 2).map((p) => `Walk me through "${p.name}": why did you choose ${(p.tech && p.tech[0]) || 'that approach'}, and what would you change now?`);
  while (project.length < 2) project.push(`Which part of your recent work best shows your fit for the ${job.title} role, and why?`);
  const followUp = [
    'What was the hardest technical decision in that work, and what alternatives did you reject?',
    'How did you measure whether it succeeded?'
  ];
  if (r.missingSkills.length > 1) followUp.push(`Have you used ${r.missingSkills[1]} even informally? What was the context?`);
  return {
    technical,
    behavioral: ['Tell me about a time you disagreed with a teammate on a technical decision.', 'Describe a deadline you nearly missed and what you did about it.', 'How do you learn a new technology quickly?'],
    project, followUp
  };
}

/* ------------------------------ AI-backed functions (with fallback) ------------------------------ */
async function generateSummary(candidate, job, result) {
  const fallback = { text: fallbackSummary(candidate, job, result), source: 'fallback' };
  if (!isConfigured()) return fallback;
  try {
    const facts = {
      job: job.title, score: result.overallScore,
      matchedSkills: result.matchedSkills, partialSkills: result.partialSkills, missingSkills: result.missingSkills,
      strengths: result.strengths, gaps: result.gaps
    };
    const text = await complete(`You write concise recruiter summaries (max 80 words, plain text). ${GUARD}`,
      `Summarise this screening result for a recruiter:\n${JSON.stringify(facts)}`, 300);
    const clean = String(text).trim();
    return clean ? { text: clean, source: 'ai' } : fallback;
  } catch (err) {
    console.warn('AI summary unavailable, using fallback:', err.message);
    return fallback;
  }
}

async function generateInterviewQuestions(candidate, job, result) {
  const fallback = { ...fallbackQuestions(candidate, job, result), source: 'fallback' };
  if (!isConfigured()) return fallback;
  try {
    const facts = {
      jobTitle: job.title, jobDescription: String(job.description || '').slice(0, 2000),
      requiredSkills: job.requiredSkills, candidateSkills: candidate.skills,
      projects: (candidate.projects || []).map((p) => ({ name: p.name, tech: p.tech })),
      skillGaps: result.missingSkills
    };
    const text = await complete(`You prepare interview questions. Reply with JSON only: {"technical":[],"behavioral":[],"project":[],"followUp":[]} with 3-5 short strings each. ${GUARD}`,
      JSON.stringify(facts), 900);
    const j = parseJsonLoose(text);
    const out = { technical: strList(j.technical), behavioral: strList(j.behavioral), project: strList(j.project), followUp: strList(j.followUp) };
    if (!out.technical.length || !out.behavioral.length) throw new Error('Incomplete AI questions');
    return { ...out, source: 'ai' };
  } catch (err) {
    console.warn('AI interview questions unavailable, using fallback:', err.message);
    return fallback;
  }
}

/** Returns extra skills/responsibilities to merge into the deterministic analysis, or null. */
async function enhanceJobAnalysis(description, base) {
  if (!isConfigured()) return null;
  try {
    const text = await complete(`Extract job requirements. Reply with JSON only: {"requiredSkills":[],"preferredSkills":[],"responsibilities":[]}. Only list skills that appear in the text. ${GUARD}`,
      `Already extracted: ${JSON.stringify({ req: base.requiredSkills, pref: base.preferredSkills })}\n\nJob description:\n${String(description).slice(0, 6000)}`, 600);
    const j = parseJsonLoose(text);
    const lower = String(description).toLowerCase();
    // Guard against hallucinated skills: keep only those literally present in the text (after normalisation).
    const grounded = (list) => normalizeSkills(strList(list, 30)).filter((s) => lower.includes(s.toLowerCase()) || lower.includes(s.toLowerCase().replace(/\.js$/, '')));
    return { requiredSkills: grounded(j.requiredSkills), preferredSkills: grounded(j.preferredSkills), responsibilities: strList(j.responsibilities) };
  } catch (err) {
    console.warn('AI job analysis unavailable, using deterministic result:', err.message);
    return null;
  }
}

/** Optional embeddings similarity (0..1) between candidate and job text; null when unavailable. */
async function embeddingSimilarity(candidateText, jobText) {
  if (!embeddingsConfigured()) return null;
  try {
    const base = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    const data = await postJson(`${base}/embeddings`, { authorization: `Bearer ${process.env.AI_API_KEY}` },
      { model: process.env.AI_EMBEDDING_MODEL, input: [candidateText.slice(0, 6000), jobText.slice(0, 6000)] });
    const { vectorCosine } = require('./scoringEngine');
    return vectorCosine(data.data[0].embedding, data.data[1].embedding);
  } catch (err) {
    console.warn('Embeddings unavailable, using lexical similarity:', err.message);
    return null;
  }
}

module.exports = {
  isConfigured, embeddingsConfigured, generateSummary, generateInterviewQuestions, enhanceJobAnalysis, embeddingSimilarity,
  fallbackSummary, fallbackQuestions
};
