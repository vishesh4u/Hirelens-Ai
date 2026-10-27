/**
 * Development seed: demo recruiter + the frontend's demo jobs/candidates.
 * Reads the demo dataset straight from ../frontend/js (state.js defaultData) so the two never drift apart.
 * Refuses to run in production. Usage: npm run seed
 */
const { loadFrontendDemoData } = require('./loadFrontend');

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Seeding is disabled in production');
  require('dotenv').config();
  const bcrypt = require('bcryptjs');
  const { connectDB } = require('../src/config/db');
  const User = require('../src/models/User');
  const Job = require('../src/models/Job');
  const Candidate = require('../src/models/Candidate');
  const { normalizeSkills } = require('../src/services/skillNormalizer');

  await connectDB();
  const data = loadFrontendDemoData();
  const email = 'demo@hirelens.ai';
  const password = process.env.SEED_PASSWORD || 'password';

  let user = await User.findOne({ email });
  if (!user) user = await User.create({ name: 'Demo Recruiter', email, passwordHash: await bcrypt.hash(password, 12), role: 'recruiter' });
  if (await Job.exists({ createdBy: user._id })) {
    console.log('Demo data already present for demo@hirelens.ai; nothing to do.');
    return process.exit(0);
  }

  const jobIds = {};
  for (const j of data.jobs) {
    const doc = await Job.create({
      title: j.title, company: j.company, location: j.location, description: j.desc,
      requiredSkills: normalizeSkills(j.req), preferredSkills: normalizeSkills(j.pref),
      experience: j.exp, education: j.edu, status: 'Open', createdBy: user._id
    });
    jobIds[j.id] = doc._id;
  }
  for (const c of data.cands) {
    await Candidate.create({
      name: c.name, email: c.email, phone: c.phone === 'Not specified' ? '' : c.phone,
      location: c.location === 'Not specified' ? '' : c.location,
      skills: normalizeSkills(c.skills), education: c.education, experience: c.experience,
      projects: c.projects, certifications: c.certs, status: c.status, job: jobIds[c.jobId], createdBy: user._id
    });
  }
  console.log(`Seeded ${data.jobs.length} jobs and ${data.cands.length} candidates for ${email}.`);
  process.exit(0);
}

module.exports = { loadFrontendDemoData };
if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
