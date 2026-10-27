/**
 * Job description analysis. Deterministic extraction always runs; AI (if configured)
 * can only add to it. The system never depends on AI being available.
 */
const { ALIASES, normalizeSkills, findSkillsInText } = require('./skillNormalizer');
const { tokenize } = require('./scoringEngine');
const aiService = require('./aiService');

function analyzeJobDeterministic(description) {
  const text = String(description || '');
  const i = text.search(/preferred|nice to have|bonus|plus:/i);
  const reqPart = i > 0 ? text.slice(0, i) : text;
  const prefPart = i > 0 ? text.slice(i) : '';
  // Job text is intentionally scanned with the full alias table (e.g. "REST", "Express" are reliable here).
  const scan = (t) => {
    const out = new Set(findSkillsInText(t));
    Object.keys(ALIASES).forEach((k) => {
      if (['rest', 'express', 'node', 'vue', 'angular'].includes(k) && new RegExp(`(^|[^a-z0-9])${k}($|[^a-z0-9])`, 'i').test(t)) out.add(ALIASES[k]);
    });
    return [...out];
  };
  const requiredSkills = scan(reqPart);
  const preferredSkills = scan(prefPart).filter((s) => !requiredSkills.includes(s));

  const m = text.match(/(\d+)\+?\s*(?:-\s*\d+\s*)?years?/i);
  const e = text.match(/(b\.?tech|bachelor'?s?|master'?s?|m\.?tech|ph\.?d|diploma)[^.,;\n]*/i);
  const responsibilities = text.split(/(?<=[.!?])\s+|\n/)
    .filter((s) => /build|develop|design|maintain|collaborat|analy|own|implement|create|ship|review|optimi/i.test(s))
    .slice(0, 5).map((s) => s.trim());

  const skillTokens = new Set([...requiredSkills, ...preferredSkills].flatMap((s) => tokenize(s)));
  const freq = {};
  tokenize(text).forEach((t) => { if (!skillTokens.has(t) && !/^\d+$/.test(t)) freq[t] = (freq[t] || 0) + 1; });
  const keywords = Object.keys(freq).sort((a, b) => freq[b] - freq[a] || a.localeCompare(b)).slice(0, 10);

  return {
    requiredSkills, preferredSkills,
    experience: { years: m ? Number(m[1]) : 0, text: m ? m[0] : 'Not specified' },
    education: e ? e[0].trim() : 'Not specified',
    responsibilities, keywords
  };
}

async function analyzeJob(description, { useAI = true } = {}) {
  const base = analyzeJobDeterministic(description);
  let source = 'deterministic';
  if (useAI && aiService.isConfigured()) {
    const extra = await aiService.enhanceJobAnalysis(description, base);
    if (extra) {
      base.requiredSkills = normalizeSkills([...base.requiredSkills, ...extra.requiredSkills]);
      base.preferredSkills = normalizeSkills([...base.preferredSkills, ...extra.preferredSkills])
        .filter((s) => !base.requiredSkills.includes(s));
      if (extra.responsibilities.length) base.responsibilities = extra.responsibilities.slice(0, 8);
      source = 'ai-enhanced';
    }
  }
  return { ...base, source, analyzedAt: new Date().toISOString() };
}

module.exports = { analyzeJob, analyzeJobDeterministic };
