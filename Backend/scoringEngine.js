/**
 * Deterministic hybrid scoring engine (pure functions, no I/O).
 * Ported from the frontend engine so backend and demo scores agree.
 * An LLM never decides the score; embeddings, when configured, only refine the semantic component.
 */
const { normalizeSkills } = require('./skillNormalizer');

const DEFAULT_WEIGHTS = Object.freeze({ skills: 0.35, experience: 0.20, semantic: 0.25, education: 0.10, projects: 0.10 });
const WEIGHT_KEYS = Object.keys(DEFAULT_WEIGHTS);
const STATUS_ORDER = ['Hired', 'Interview', 'Shortlisted', 'Under Review', 'New', 'Rejected'];

/* ------------------------------ weights ------------------------------ */
/** Merge with defaults, accept fractions (0.5) or percentages (50), and require a total of 100%. */
function resolveWeights(input) {
  if (input == null) return { ...DEFAULT_WEIGHTS };
  if (typeof input !== 'object' || Array.isArray(input)) throw new Error('weights must be an object');
  const merged = { ...DEFAULT_WEIGHTS };
  for (const k of Object.keys(input)) {
    if (!WEIGHT_KEYS.includes(k)) throw new Error(`Unknown weight "${k}"`);
    const v = Number(input[k]);
    if (!Number.isFinite(v) || v < 0) throw new Error(`Weight "${k}" must be a non-negative number`);
    merged[k] = v;
  }
  let sum = WEIGHT_KEYS.reduce((s, k) => s + merged[k], 0);
  if (sum > 1.5) { // percentages
    WEIGHT_KEYS.forEach((k) => { merged[k] = merged[k] / 100; });
    sum /= 100;
  }
  if (Math.abs(sum - 1) > 0.01) throw new Error(`Weights must total 100% (currently ${Math.round(sum * 100)}%)`);
  return merged;
}

const computeOverall = (c, w) =>
  Math.round(c.skillsScore * w.skills + c.experienceScore * w.experience + c.semanticScore * w.semantic +
    c.educationScore * w.education + c.projectsScore * w.projects);

/* ------------------------------ text similarity ------------------------------ */
const STOP = new Set(('a an and are as at be but by for from has have i in is it its of on or our that the their this to we will with you your using use work working strong experience years year ability etc via within across into over such also more than must should can able').split(' '));

function tokenize(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9+#.\s]/g, ' ').split(/\s+/)
    .map((w) => w.replace(/^\.+|\.+$/g, '')).filter((w) => w.length > 1 && !STOP.has(w));
}
function termFreq(tokens) { const m = {}; tokens.forEach((t) => { m[t] = (m[t] || 0) + 1; }); return m; }
function cosine(a, b) {
  const A = termFreq(a), B = termFreq(b);
  let dot = 0, x = 0, y = 0;
  for (const k in A) { x += A[k] * A[k]; if (B[k]) dot += A[k] * B[k]; }
  for (const k in B) y += B[k] * B[k];
  return x && y ? dot / Math.sqrt(x * y) : 0;
}
function jaccard(a, b) {
  const A = new Set(a), B = new Set(b);
  let inter = 0;
  A.forEach((t) => { if (B.has(t)) inter++; });
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}
/** Cosine similarity of two numeric vectors (used for embeddings). */
function vectorCosine(a, b) {
  if (!a || !b || a.length !== b.length || !a.length) return 0;
  let dot = 0, x = 0, y = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; }
  return x && y ? dot / Math.sqrt(x * y) : 0;
}

/* ------------------------------ education / experience ------------------------------ */
function eduLevel(text) {
  const t = String(text || '');
  if (/ph\.?\s?d|doctor/i.test(t)) return 5;
  if (/m\.?\s?tech|m\.?\s?sc|master|mba|mca/i.test(t)) return 4;
  if (/b\.?\s?tech|b\.?\s?e\b|b\.?\s?sc|bca|bachelor/i.test(t)) return 3;
  if (/diploma/i.test(t)) return 2;
  return 0;
}
const EDU_LABEL = { 0: 'Not detected', 2: 'Diploma', 3: "Bachelor's", 4: "Master's", 5: 'Doctorate' };
// Years from dated roles, or the figure the resume itself states (e.g. "3 years of experience") if that is higher.
const totalYears = (c) => Math.max((c.experience || []).reduce((s, e) => s + (Number(e.years) || 0), 0), Number(c.yearsOfExperience) || 0);

const projectText = (p) => [p.name, p.desc, (p.tech || []).join(' ')].filter(Boolean).join(' ');

/* ------------------------------ scoring ------------------------------ */
/**
 * @param candidate {skills, education[], experience[{role,company,years,summary}], projects[{name,desc,tech[]}], certifications[]}
 * @param job {title, description, requiredSkills[], preferredSkills[], experience(years), education}
 * @param weights optional partial weights
 * @param opts {embeddingSimilarity?: number 0..1} optional embedding cosine that refines the semantic score
 */
function scoreCandidate(candidate, job, weights, opts = {}) {
  const W = resolveWeights(weights);
  const c = candidate || {};
  const req = normalizeSkills(job.requiredSkills);
  const pref = normalizeSkills(job.preferredSkills);
  const candSkills = normalizeSkills(c.skills);
  const have = new Set(candSkills.map((s) => s.toLowerCase()));

  const matched = req.filter((s) => have.has(s.toLowerCase()));
  const missing = req.filter((s) => !have.has(s.toLowerCase()));
  const mPref = pref.filter((s) => have.has(s.toLowerCase()));
  const xPref = pref.filter((s) => !have.has(s.toLowerCase()));

  // Partial: wanted skills not listed as skills but literally present in experience/project text.
  const profileText = ((c.experience || []).map((e) => `${e.role || ''} ${e.summary || ''}`).join(' ') + ' ' +
    (c.projects || []).map(projectText).join(' ')).toLowerCase();
  const partial = req.concat(pref).filter((s) => {
    const l = s.toLowerCase();
    return !have.has(l) && l.length > 2 && profileText.includes(l);
  });

  const skillsScore = Math.round(Math.min(100,
    (req.length ? (matched.length / req.length) * 90 : 90) + (pref.length ? (mPref.length / pref.length) * 10 : 0)));

  const years = totalYears(c);
  const need = Number(job.experience) || 0;
  let experienceScore;
  if (need > 0) experienceScore = years >= need ? Math.min(100, 85 + (years - need) * 7.5) : (years / need) * 85;
  else experienceScore = Math.min(100, (years / 3) * 100);
  experienceScore = Math.round(experienceScore);

  const candText = [candSkills.join(' ')]
    .concat((c.projects || []).map(projectText))
    .concat((c.experience || []).map((e) => `${e.role || ''} ${e.summary || ''}`)).join(' ');
  const jobText = [job.title, job.description, req.join(' '), pref.join(' ')].join(' ');
  const ct = tokenize(candText), jt = tokenize(jobText);
  const lexical = Math.min(100, (0.7 * cosine(ct, jt) + 0.3 * jaccard(ct, jt)) * 200);
  let semanticScore = lexical;
  let semanticMethod = 'lexical';
  if (typeof opts.embeddingSimilarity === 'number' && Number.isFinite(opts.embeddingSimilarity)) {
    const emb = Math.max(0, Math.min(1, opts.embeddingSimilarity)) * 100;
    semanticScore = 0.6 * emb + 0.4 * lexical;
    semanticMethod = 'embedding+lexical';
  }
  semanticScore = Math.round(Math.min(100, semanticScore));

  let cLevel = 0;
  (c.education || []).forEach((e) => { cLevel = Math.max(cLevel, eduLevel(e)); });
  const rLevel = eduLevel(job.education);
  const educationScore = rLevel === 0 ? (cLevel ? 100 : 60) : (cLevel >= rLevel ? 100 : Math.round((cLevel / rLevel) * 80));

  const wanted = new Set(req.concat(pref).map((s) => s.toLowerCase()));
  const wantedList = [...wanted].filter((w) => w.length > 2);
  const relProjects = (c.projects || []).filter((p) => normalizeSkills(p.tech).some((t) => wanted.has(t.toLowerCase())));
  const nProj = (c.projects || []).length;
  const certs = c.certifications || [];
  const projectsScore = Math.max(0, Math.min(100, relProjects.length * 35 + (nProj - relProjects.length) * 10 + certs.length * 15));

  const relevantExperience = (c.experience || []).filter((e) => {
    const t = `${e.role || ''} ${e.summary || ''}`.toLowerCase();
    return [...wantedList].some((w) => t.includes(w));
  }).map((e) => `${e.role || 'Role'}${e.company ? ' at ' + e.company : ''}`);
  const components = { skillsScore, experienceScore, semanticScore, educationScore, projectsScore };
  const overallScore = computeOverall(components, W);

  /* ---- explainability: every line is derived from candidate/job data ---- */
  const strengths = [], gaps = [], evidence = [];
  if (matched.length) strengths.push(`Covers ${matched.length} of ${req.length} required skills: ${matched.join(', ')}.`);
  if (need > 0 && years >= need) strengths.push(`${years} years of experience meets the ${need}-year requirement.`);
  if (relProjects.length) strengths.push(`Relevant project work: ${relProjects.map((p) => p.name).join(', ')}.`);
  if (mPref.length) strengths.push(`Also has preferred skills: ${mPref.join(', ')}.`);
  if (certs.length) strengths.push(`Certifications listed: ${certs.join(', ')}.`);
  if (rLevel && cLevel >= rLevel) strengths.push('Education level meets the requirement.');
  if (missing.length) gaps.push(`Required skills not found in the resume (this does not mean the candidate lacks them): ${missing.join(', ')}.`);
  if (need > 0 && years < need) gaps.push(`${years} year(s) of experience against ${need} required.`);
  if (rLevel && cLevel < rLevel) gaps.push(`Highest education found (${EDU_LABEL[cLevel]}) is below the required level (${EDU_LABEL[rLevel]}).`);
  if (xPref.length) gaps.push(`Preferred skills not found in the resume: ${xPref.join(', ')}.`);
  if (partial.length) gaps.push(`Mentioned only in experience/projects, not listed as skills: ${partial.join(', ')}.`);
  if (!strengths.length) strengths.push('No clear strengths detected against this job.');
  if (!gaps.length) gaps.push('No gaps detected against the stated requirements.');

  evidence.push(`Skills on profile: ${candSkills.join(', ') || 'none listed'}.`);
  (c.experience || []).forEach((e) => evidence.push(`${e.role || 'Role'} at ${e.company || 'unspecified company'} (${Number(e.years) || 0} yr)${e.summary ? ': ' + e.summary : ''}`));
  (c.projects || []).forEach((p) => {
    const tech = normalizeSkills(p.tech);
    const hits = tech.filter((t) => wanted.has(t.toLowerCase()));
    evidence.push(`Project "${p.name}" uses ${tech.join(', ') || 'unspecified technologies'}` +
      (hits.length ? ` — matches job requirements: ${hits.join(', ')}.` : '.'));
  });

  const notes = {
    experience: `${years} year(s) of experience (${c.yearsOfExperience > 0 && Number(c.yearsOfExperience) >= (c.experience || []).reduce((a, e) => a + (Number(e.years) || 0), 0) ? 'as stated on the resume' : 'from dated roles'}) against ${need ? need + ' required.' : 'no stated requirement.'}`,
    education: `Highest level found: ${EDU_LABEL[cLevel]}. Required: ${rLevel ? EDU_LABEL[rLevel] : 'not stated'}.`,
    projects: `${relProjects.length} of ${nProj} project(s) use required or preferred technologies; ${certs.length} certification(s).`
  };
  const pct = (k) => Math.round(W[k] * 100);
  const explanation = `${c.name || 'Candidate'} scored ${overallScore}%: skills ${skillsScore}% (${pct('skills')}% weight), experience ${experienceScore}% (${pct('experience')}%), relevance ${semanticScore}% (${pct('semantic')}%), education ${educationScore}% (${pct('education')}%), projects and certifications ${projectsScore}% (${pct('projects')}%). Scores are calculated by fixed rules from the profile and job requirements; no personal attributes (gender, religion, caste, race, age, photo, marital status) are used.`;

  return {
    overallScore, ...components,
    matchedSkills: matched.concat(mPref), matchedRequired: matched, matchedPreferred: mPref,
    partialSkills: partial, missingSkills: missing, missingPreferred: xPref,
    strengths, gaps, evidence, notes, explanation,
    relevantProjects: relProjects.map((p) => p.name), relevantExperience,
    scoringWeights: W, semanticMethod
  };
}

/* ------------------------------ ranking ------------------------------ */
const SORTERS = {
  score: (r) => r.overallScore,
  skills: (r) => r.skillsScore,
  experience: (r) => r.experienceScore,
  relevance: (r) => r.semanticScore,
  status: (r) => -STATUS_ORDER.indexOf(r.status) // higher pipeline stage first
};

/** rows: [{candidateId, name, status, overallScore, skillsScore, ...}] -> sorted copy with `rank`. */
function rankRows(rows, sort = 'score') {
  const key = SORTERS[sort] || SORTERS.score;
  const sorted = rows.slice().sort((a, b) => (key(b) - key(a)) || (b.overallScore - a.overallScore) || String(a.name).localeCompare(String(b.name)));
  return sorted.map((r, i) => ({ ...r, rank: i + 1 }));
}

/**
 * Re-rank saved component scores under alternative weights. Nothing is persisted.
 * rankChange > 0 means the candidate moved up.
 */
function simulateRanking(rows, weights) {
  const W = resolveWeights(weights);
  const original = rankRows(rows, 'score');
  const recomputed = rows.map((r) => ({ ...r, overallScore: computeOverall(r, W) }));
  const simulated = rankRows(recomputed, 'score');
  const simRank = new Map(simulated.map((r) => [String(r.candidateId), r.rank]));
  return {
    weights: W,
    rankings: simulated.map((r) => {
      const orig = original.find((o) => String(o.candidateId) === String(r.candidateId));
      const originalRank = orig.rank;
      const simulatedRank = simRank.get(String(r.candidateId));
      return { ...r, originalScore: orig.overallScore, simulatedScore: r.overallScore, originalRank, simulatedRank, rankChange: originalRank - simulatedRank };
    })
  };
}

module.exports = {
  DEFAULT_WEIGHTS, WEIGHT_KEYS, resolveWeights, computeOverall, scoreCandidate, rankRows, simulateRanking,
  tokenize, cosine, jaccard, vectorCosine, eduLevel, totalYears
};
