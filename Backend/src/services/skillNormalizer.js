/**
 * Central skill normalization. Ported from the frontend ALIASES table so the
 * browser demo and the backend agree on canonical skill names.
 */
const ALIASES = {
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
  'spring boot': 'Spring Boot', 'springboot': 'Spring Boot', 'kubernetes': 'Kubernetes', 'k8s': 'Kubernetes',
  'ci/cd': 'CI/CD', 'mysql': 'MySQL', 'vue': 'Vue.js', 'vuejs': 'Vue.js', 'vue.js': 'Vue.js',
  'angular': 'Angular', 'angularjs': 'Angular', 'next.js': 'Next.js', 'nextjs': 'Next.js',
  'numpy': 'NumPy', 'scikit-learn': 'scikit-learn', 'sklearn': 'scikit-learn', 'c++': 'C++', 'c#': 'C#'
};

// Words that are also common English words: never detected from free text, only from explicit skill lists.
const AMBIGUOUS = new Set(['rest', 'express', 'node', 'vue', 'angular']);

function normalizeSkill(s) {
  const t = String(s == null ? '' : s).trim().replace(/\s+/g, ' ');
  if (!t) return '';
  return ALIASES[t.toLowerCase()] || t;
}

function normalizeSkills(list) {
  const seen = new Set();
  const out = [];
  (Array.isArray(list) ? list : []).forEach((s) => {
    const n = normalizeSkill(s);
    const k = n.toLowerCase();
    if (n && !seen.has(k)) { seen.add(k); out.push(n); }
  });
  return out;
}

const escapeRe = (k) => k.replace(/[.+*?^${}()|[\]\\/]/g, '\\$&');
const SKILL_REGEXES = Object.keys(ALIASES)
  .filter((k) => !AMBIGUOUS.has(k))
  .map((k) => ({ canonical: ALIASES[k], rx: new RegExp('(^|[^a-z0-9+#])' + escapeRe(k) + '($|[^a-z0-9+#])', 'i') }));

/** Find known skills mentioned in free text (deterministic, dictionary based). */
function findSkillsInText(text) {
  const t = String(text || '');
  const found = new Set();
  SKILL_REGEXES.forEach(({ canonical, rx }) => { if (rx.test(t)) found.add(canonical); });
  return [...found];
}

module.exports = { ALIASES, normalizeSkill, normalizeSkills, findSkillsInText };
