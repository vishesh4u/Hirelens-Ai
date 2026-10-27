/** Builds structured, backend-ready report data. Rendering (PDF/print) is left to the client. */
function buildReport({ candidate, job, result, savedScreening }) {
  const c = candidate.toObject ? candidate.toObject() : candidate;
  const j = job.toObject ? job.toObject() : job;
  return {
    generatedAt: new Date().toISOString(),
    screenedAt: savedScreening ? savedScreening.createdAt : null,
    candidate: {
      id: String(c._id), name: c.name, email: c.email, phone: c.phone, location: c.location, status: c.status,
      skills: c.skills, education: c.education, experience: c.experience, projects: c.projects, certifications: c.certifications
    },
    job: { id: String(j._id), title: j.title, company: j.company, location: j.location, requiredSkills: j.requiredSkills, preferredSkills: j.preferredSkills, experience: j.experience, education: j.education },
    scores: {
      overallScore: result.overallScore, skillsScore: result.skillsScore, experienceScore: result.experienceScore,
      semanticScore: result.semanticScore, educationScore: result.educationScore, projectsScore: result.projectsScore
    },
    scoringWeights: result.scoringWeights,
    matchedSkills: result.matchedSkills, partialSkills: result.partialSkills, missingSkills: result.missingSkills,
    strengths: result.strengths, gaps: result.gaps, evidence: result.evidence, notes: result.notes, explanation: result.explanation,
    summary: savedScreening && savedScreening.summary ? savedScreening.summary : null,
    fairness: 'Scores use skills, experience, job relevance, education and projects only. Gender, religion, caste, race, age, photograph and marital status are never used.',
    disclaimer: 'Decision support only. Final hiring decisions remain with the recruiter.'
  };
}

module.exports = { buildReport };
