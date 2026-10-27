/**
 * Loads the browser scoring/demo-data modules (frontend/js/config.js, scoring.js, state.js) into a
 * sandboxed vm context so the seed script and the parity test can use the frontend's own code.
 * Only minimal browser stubs are provided; nothing here touches the network or the DOM.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FRONTEND_JS = path.join(__dirname, '..', '..', 'frontend', 'js');

function loadFrontendModules(files = ['config', 'scoring', 'state'], dir = FRONTEND_JS) {
  const sandbox = {
    document: {}, location: { port: '', hash: '', protocol: 'http:' },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    fetch: () => Promise.reject(new Error('not available in this context')), FormData: function () {}
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const f of files) {
    const file = path.join(dir, `${f}.js`);
    if (!fs.existsSync(file)) throw new Error(`Frontend module not found: ${file}`);
    vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: `${f}.js` });
  }
  return sandbox;
}

/** The frontend's built-in demo dataset: { jobs: [...], cands: [...] }. */
function loadFrontendDemoData(dir) {
  const sb = loadFrontendModules(undefined, dir);
  return vm.runInContext('defaultData()', sb);
}

module.exports = { loadFrontendModules, loadFrontendDemoData, FRONTEND_JS };
