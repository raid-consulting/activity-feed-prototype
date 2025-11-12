const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createElement(id){
  const element = {
    id,
    hidden: false,
    className: '',
    textContent: '',
    innerHTML: '',
    _innerHTML: '',
    attributes: {},
    listeners: {},
    set innerHTML(value){
      this._innerHTML = value;
    },
    get innerHTML(){
      return this._innerHTML;
    },
    setAttribute(name, value){
      this.attributes[name] = value;
    },
    getAttribute(name){
      return this.attributes[name];
    },
    addEventListener(event, handler){
      this.listeners[event] = handler;
    },
    removeEventListener(event){
      delete this.listeners[event];
    },
    querySelector(){ return null; },
    querySelectorAll(){ return []; },
    scrollIntoView(){},
    focus(){},
  };
  return element;
}

async function runAiReviewMount(){
  const logs = { error: [], warn: [] };
  const consoleStub = {
    log: () => {},
    info: () => {},
    debug: () => {},
    warn: (...args) => { logs.warn.push(args); },
    error: (...args) => { logs.error.push(args); },
  };

  const elements = {};
  const registerElement = (id, element) => {
    elements[id] = element;
    return element;
  };

  const countBadges = {
    all: { textContent: '0' },
    green: { textContent: '0' },
    blue: { textContent: '0' },
    red: { textContent: '0' },
    grey: { textContent: '0' }
  };

  const filterButtons = ['all','green','blue','red','grey'].map(key => {
    return {
      attributes: { 'data-filter': key, 'aria-pressed': key === 'all' ? 'true' : 'false' },
      addEventListener(){},
      getAttribute(name){ return this.attributes[name]; },
      setAttribute(name, value){ this.attributes[name] = value; },
    };
  });

  const documentElement = {
    attributes: { 'data-theme': 'dark' },
    setAttribute(name, value){ this.attributes[name] = value; },
    getAttribute(name){ return this.attributes[name]; }
  };

  const groupContainer = registerElement('groupContainer', createElement('groupContainer'));
  groupContainer.querySelectorAll = (selector) => {
    if (selector !== '.card[data-id]') return [];
    const results = [];
    const regex = /data-id="([^"]+)"/g;
    let match;
    while ((match = regex.exec(groupContainer._innerHTML))) {
      const btn = createElement();
      btn.getAttribute = (name) => name === 'data-id' ? match[1] : null;
      btn.addEventListener = () => {};
      results.push(btn);
    }
    return results;
  };

  const loadingState = registerElement('loadingState', createElement('loadingState'));
  const emptyState = registerElement('emptyState', createElement('emptyState'));
  const emptyRefresh = registerElement('emptyRefresh', createElement('emptyRefresh'));
  const errorState = registerElement('errorState', createElement('errorState'));
  const errorMessageNode = createElement();
  errorState.querySelector = (selector) => selector === 'p' ? errorMessageNode : null;
  const errorRetry = registerElement('errorRetry', createElement('errorRetry'));
  const reviewContent = registerElement('reviewContent', createElement('reviewContent'));
  const searchInput = registerElement('searchInput', createElement('searchInput'));
  searchInput.value = '';
  searchInput.addEventListener = () => {};
  const detailView = registerElement('detailView', createElement('detailView'));
  detailView.setAttribute = function(name, value){ this.attributes[name] = value; };
  detailView.getAttribute = function(name){ return this.attributes[name]; };
  detailView.attributes = {};
  const detailTitle = registerElement('detailTitle', createElement('detailTitle'));
  const detailMeta = registerElement('detailMeta', createElement('detailMeta'));
  const detailBody = registerElement('detailBody', createElement('detailBody'));
  const detailSynopsis = registerElement('detailSynopsis', createElement('detailSynopsis'));
  const detailTag = registerElement('detailTag', createElement('detailTag'));
  const detailCrumb = registerElement('detailCrumb', createElement('detailCrumb'));
  const detailAiMeta = registerElement('detailAiMeta', createElement('detailAiMeta'));
  const detailAiRequirements = registerElement('detailAiRequirements', createElement('detailAiRequirements'));
  const detailReassess = registerElement('detailReassess', createElement('detailReassess'));
  detailReassess.addEventListener = () => {};
  const detailBack = registerElement('detailBack', createElement('detailBack'));
  const detailBackBtn = registerElement('detailBackBtn', createElement('detailBackBtn'));
  detailBack.addEventListener = () => {};
  detailBackBtn.addEventListener = () => {};
  const globalMenuHost = registerElement('globalMenu', createElement('globalMenu'));
  const appFooter = registerElement('appFooter', createElement('appFooter'));
  const themeToggle = registerElement('themeToggle', createElement('themeToggle'));
  themeToggle.addEventListener = () => {};
  const themeLabel = registerElement('themeLabel', createElement('themeLabel'));
  const logoutBtn = registerElement('logoutBtn', createElement('logoutBtn'));
  logoutBtn.disabled = true;

  const document = {
    documentElement,
    getElementById(id){ return elements[id] || null; },
    querySelectorAll(selector){
      if (selector === '[data-filter]') {
        return filterButtons;
      }
      return [];
    },
    querySelector(selector){
      const match = selector.match(/\[data-count="([^\"]+?)"\]/);
      if (match && countBadges[match[1]]) {
        return countBadges[match[1]];
      }
      return null;
    }
  };

  const storage = new Map();
  const localStorage = {
    getItem(key){ return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value){ storage.set(key, String(value)); },
    removeItem(key){ storage.delete(key); }
  };
  localStorage.setItem('faux-auth', 'tester@example.com');

  const location = {
    pathname: '/ai-review.html',
    replace(url){ this.replaced = url; }
  };

  const performance = {
    _now: 0,
    now(){ this._now += 5; return this._now; }
  };

  const telemetryCalls = [];

  const AIClassifier = {
    VERSION: 'stub-1',
    ingest(emails){
      return emails.map(email => {
        const clone = { ...email };
        return this.applyAssessment(clone);
      });
    },
    applyAssessment(email){
      email.ai = {
        category: 'green',
        assessor_version: this.VERSION,
        notes: `Assessment for ${email.id}`,
        confidence: 0.9,
        assessed_at: new Date().toISOString(),
        blockers: [],
        required_permissions: [],
        required_context: []
      };
      email.aiCategory = email.ai.category;
      email.aiSynopsis = email.ai.notes;
      return email;
    },
    reassess(emails, id){
      const found = emails.find(item => item.id === id);
      if (!found) return null;
      return this.applyAssessment(found);
    }
  };

  const AutoRefresh = {
    DEFAULT_INTERVAL: 15000,
    createAutoRefresh(options){
      return {
        intervalMs: options.intervalMs,
        start(){
          if (typeof options.refresh === 'function') {
            options.refresh();
          }
        },
        stop(){},
        dispose(){},
      };
    }
  };

  const context = {
    console: consoleStub,
    document,
    localStorage,
    location,
    performance,
    setTimeout,
    clearTimeout,
    Date,
    Array,
    Promise,
    Math,
    JSON,
    String,
    Number,
    Boolean,
  };

  context.window = context;
  context.window.document = document;
  context.window.console = consoleStub;
  context.window.localStorage = localStorage;
  context.window.location = location;
  context.window.matchMedia = () => ({ matches: false });
  context.window.performance = performance;
  context.window.telemetry = { log(event, payload){ telemetryCalls.push({ event, payload }); } };
  context.window.AutoRefresh = AutoRefresh;
  context.window.AIClassifier = AIClassifier;

  context.window.AICategory = undefined;
  context.window.navigator = { userAgent: 'node' };

  const scriptPath = path.join(__dirname, '..', 'ai-review.html');
  const html = fs.readFileSync(scriptPath, 'utf8');
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  const scripts = [];
  let match;
  while ((match = pattern.exec(html))) {
    const attrs = match[1] || '';
    if (/\bsrc\s*=/.test(attrs)) continue;
    scripts.push(match[2]);
  }

  const vmContext = vm.createContext(context);
  scripts.forEach(code => {
    const script = new vm.Script(code, { filename: 'ai-review-inline.js' });
    script.runInContext(vmContext);
  });

  await new Promise(resolve => setImmediate(resolve));

  assert.strictEqual(logs.error.length, 0, 'console.error should not be called');
  assert.strictEqual(logs.warn.length, 0, 'console.warn should not be called');
  assert.strictEqual(loadingState.hidden, true, 'loading state should be hidden after load');
  assert.strictEqual(groupContainer.hidden, false, 'group container should be visible');
  assert.strictEqual(errorState.hidden, true, 'error state should stay hidden on success');
  assert.strictEqual(emptyState.hidden, true, 'empty state should stay hidden when items exist');
  assert(groupContainer._innerHTML.includes('card'), 'cards should be rendered');
  assert(telemetryCalls.some(entry => entry.event === 'ai_review_load' && entry.payload && entry.payload.status === 'success'), 'load telemetry should include success');
}

(async () => {
  try {
    await runAiReviewMount();
    console.log('✓ AI Review view renders without console errors');
  } catch (err) {
    console.error('✗ AI Review view renders without console errors');
    console.error(err);
    process.exitCode = 1;
  }
})();
