const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

async function runTest(name, fn){
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (err){
    console.error(`✗ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

function createTimer(){
  let id = 0;
  const tasks = new Map();
  return {
    set(fn, ms){
      const handle = ++id;
      tasks.set(handle, { fn, ms, cleared:false });
      return handle;
    },
    clear(handle){
      const task = tasks.get(handle);
      if(task){
        task.cleared = true;
      }
    },
    run(handle){
      const task = tasks.get(handle);
      if(task && !task.cleared){
        task.cleared = true;
        task.fn();
      }
    },
    runAll(){
      Array.from(tasks.keys()).forEach(handle => this.run(handle));
    }
  };
}

function createElement(id){
  let _innerHTML = '';
  return {
    id,
    hidden: false,
    className: '',
    textContent: '',
    attributes: {},
    listeners: {},
    focusCount: 0,
    _innerHTML,
    set innerHTML(value){ _innerHTML = value; },
    get innerHTML(){ return _innerHTML; },
    setAttribute(name, value){ this.attributes[name] = value; },
    getAttribute(name){ return this.attributes[name]; },
    addEventListener(event, handler){ this.listeners[event] = handler; },
    removeEventListener(event){ delete this.listeners[event]; },
    querySelector(){ return null; },
    querySelectorAll(){ return []; },
    scrollIntoView(){},
    focus(){ this.focusCount++; },
  };
}

function createSampleEmail(id, overrides={}){
  return {
    id,
    from: `${id}@example.com`,
    subject: `Subject ${id}`,
    body: `Body ${id}`,
    status: 'open',
    received: Date.now(),
    ...overrides,
  };
}

async function mountAiReview({ loader, seedEmails, cachedEmails }={}){
  const logs = { error: [], warn: [] };
  const consoleStub = {
    log: () => {},
    info: () => {},
    debug: () => {},
    warn: (...args) => { logs.warn.push(args); },
    error: (...args) => { logs.error.push(args); },
  };

  const timers = createTimer();

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
    while ((match = regex.exec(groupContainer.innerHTML || ''))){
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
  const degradedBanner = registerElement('degradedBanner', createElement('degradedBanner'));
  const degradedMessage = registerElement('degradedMessage', createElement('degradedMessage'));
  const degradedRetry = registerElement('degradedRetry', createElement('degradedRetry'));
  const noResultsNotice = registerElement('noResultsNotice', createElement('noResultsNotice'));
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
  if(Array.isArray(seedEmails)){
    localStorage.setItem('faux-emails', JSON.stringify(seedEmails));
  } else if(Array.isArray(cachedEmails)){
    localStorage.setItem('faux-emails', JSON.stringify(cachedEmails));
  } else {
    localStorage.setItem('faux-emails', '[]');
  }

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
      const immediate = options && options.immediate !== false;
      return {
        intervalMs: options.intervalMs,
        start(){
          if(immediate && typeof options.refresh === 'function'){
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
    setTimeout: (fn, ms) => timers.set(fn, ms),
    clearTimeout: handle => timers.clear(handle),
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

  const loadEmails = Array.isArray(cachedEmails) ? cachedEmails : Array.isArray(seedEmails) ? seedEmails : [];
  const fetchImpl = typeof loader === 'function'
    ? loader
    : () => Promise.resolve(loadEmails);
  context.window.aiReviewDataSource = { fetch: fetchImpl };

  const scriptPath = path.join(__dirname, '..', 'ai-review.html');
  const html = fs.readFileSync(scriptPath, 'utf8');
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  const scripts = [];
  let match;
  while ((match = pattern.exec(html))){
    const attrs = match[1] || '';
    if (/\bsrc\s*=/.test(attrs)) continue;
    scripts.push(match[2]);
  }

  const vmContext = vm.createContext(context);
  scripts.forEach(code => {
    const script = new vm.Script(code, { filename: 'ai-review-inline.js' });
    script.runInContext(vmContext);
  });

  async function flush(){
    await new Promise(resolve => setImmediate(resolve));
  }

  return {
    elements,
    errorMessageNode,
    telemetryCalls,
    timers,
    logs,
    flush,
    context,
  };
}

async function settle(env, cycles=3){
  for(let i=0;i<cycles;i++){
    await env.flush();
  }
}

async function testSuccessWithItems(){
  const items = [createSampleEmail('a1'), createSampleEmail('a2')];
  const env = await mountAiReview({ loader: () => Promise.resolve(items), seedEmails: items });
  await settle(env);

  assert.strictEqual(env.logs.error.length, 0, 'no console errors');
  assert.strictEqual(env.elements.loadingState.hidden, true, 'loading hidden after success');
  assert.strictEqual(env.elements.groupContainer.hidden, false, 'group container visible');
  assert.strictEqual(env.elements.emptyState.hidden, true, 'empty hidden on success');
  assert.strictEqual(env.elements.errorState.hidden, true, 'error hidden on success');
  assert.strictEqual(env.elements.degradedBanner.hidden, true, 'degraded banner hidden on success');
  assert(env.elements.groupContainer.innerHTML.includes('card'), 'cards rendered');
  assert(env.telemetryCalls.some(entry => entry.event === 'ai_review_load' && entry.payload && entry.payload.status === 'success'), 'telemetry includes success');
}

async function testEmptySuccess(){
  const env = await mountAiReview({ loader: () => Promise.resolve([]), seedEmails: [] });
  await settle(env);

  assert.strictEqual(env.elements.groupContainer.hidden, true, 'group hidden when empty');
  assert.strictEqual(env.elements.emptyState.hidden, false, 'empty visible');
  assert.strictEqual(env.elements.errorState.hidden, true, 'error hidden when empty');
  assert.strictEqual(env.elements.degradedBanner.hidden, true, 'degraded hidden when empty');
  assert.strictEqual(env.elements.emptyState.focusCount > 0, true, 'empty received focus');
  assert(env.telemetryCalls.some(entry => entry.payload && entry.payload.status === 'empty'), 'telemetry logs empty');
}

async function testErrorNoCache(){
  const env = await mountAiReview({ loader: () => Promise.reject(new Error('boom')), seedEmails: [] });
  await settle(env);

  assert.strictEqual(env.elements.groupContainer.hidden, true, 'group hidden on error');
  assert.strictEqual(env.elements.emptyState.hidden, true, 'empty hidden on error');
  assert.strictEqual(env.elements.errorState.hidden, false, 'error visible');
  assert.strictEqual(env.elements.degradedBanner.hidden, true, 'degraded hidden without cache');
  assert.strictEqual(env.elements.errorState.focusCount > 0, true, 'error received focus');
  assert(env.telemetryCalls.some(entry => entry.payload && entry.payload.status === 'error'), 'telemetry logs error');
}

async function testErrorWithCache(){
  const cachedItems = [createSampleEmail('c1'), createSampleEmail('c2')];
  const env = await mountAiReview({ loader: () => Promise.reject(new Error('network down')), seedEmails: cachedItems });
  await settle(env);

  assert.strictEqual(env.elements.groupContainer.hidden, false, 'group visible with cache');
  assert.strictEqual(env.elements.degradedBanner.hidden, false, 'degraded banner visible');
  assert.strictEqual(env.elements.errorState.hidden, true, 'error hidden during degraded state');
  assert.strictEqual(env.elements.emptyState.hidden, true, 'empty hidden during degraded state');
  assert(env.elements.groupContainer.innerHTML.includes('card'), 'cached cards still rendered');
  assert(env.telemetryCalls.some(entry => entry.payload && entry.payload.status === 'degraded'), 'telemetry logs degraded state');
}

async function testRetryBeforeError(){
  const items = [createSampleEmail('retry1')];
  let attempts = 0;
  const env = await mountAiReview({
    loader: () => {
      attempts++;
      return attempts === 1
        ? Promise.reject(new Error('transient fault'))
        : Promise.resolve(items);
    },
    seedEmails: items
  });
  await settle(env);

  assert(attempts >= 2, 'loader retried at least once');
  assert.strictEqual(env.elements.errorState.hidden, true, 'error banner hidden after retry success');
  assert.strictEqual(env.elements.degradedBanner.hidden, true, 'degraded banner hidden after retry success');
  assert.strictEqual(env.elements.groupContainer.hidden, false, 'list visible after retry success');
}

async function testMutualExclusion(){
  const emptyEnv = await mountAiReview({ loader: () => Promise.resolve([]), seedEmails: [] });
  await settle(emptyEnv);
  assert(!(emptyEnv.elements.emptyState.hidden === false && emptyEnv.elements.errorState.hidden === false), 'empty and error not both visible after empty load');

  const errorEnv = await mountAiReview({ loader: () => Promise.reject(new Error('fail')), seedEmails: [] });
  await settle(errorEnv);
  assert(!(errorEnv.elements.emptyState.hidden === false && errorEnv.elements.errorState.hidden === false), 'empty and error not both visible after error load');
}

(async () => {
  await runTest('success with items hides global states', testSuccessWithItems);
  await runTest('empty success shows only empty state', testEmptySuccess);
  await runTest('error without cache renders only error', testErrorNoCache);
  await runTest('error with cache falls back to degraded view', testErrorWithCache);
  await runTest('transient failure retries before error', testRetryBeforeError);
  await runTest('empty and error states are mutually exclusive', testMutualExclusion);
})();
