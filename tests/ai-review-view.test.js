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
    setAttribute(name, value){
      this.attributes[name] = value;
      if(name === 'hidden'){
        this.hidden = true;
      }
    },
    getAttribute(name){ return this.attributes[name]; },
    removeAttribute(name){
      delete this.attributes[name];
      if(name === 'hidden'){
        this.hidden = false;
      }
    },
    hasAttribute(name){
      return Object.prototype.hasOwnProperty.call(this.attributes, name);
    },
    addEventListener(event, handler){ this.listeners[event] = handler; },
    removeEventListener(event){ delete this.listeners[event]; },
    contains(){ return false; },
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
  const logs = { error: [], warn: [], info: [] };
  const consoleStub = {
    log: () => {},
    info: (...args) => { logs.info.push(args); },
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
  emptyState.setAttribute('hidden', '');
  emptyState.setAttribute('data-empty-banner', 'true');
  const emptyRefresh = registerElement('emptyRefresh', createElement('emptyRefresh'));
  const errorState = registerElement('errorState', createElement('errorState'));
  errorState.setAttribute('hidden', '');
  errorState.setAttribute('data-banner-kind', 'error');
  const errorMessageNode = createElement();
  errorState.querySelector = (selector) => selector === 'p' ? errorMessageNode : null;
  const errorRetry = registerElement('errorRetry', createElement('errorRetry'));
  const degradedBanner = registerElement('degradedBanner', createElement('degradedBanner'));
  degradedBanner.setAttribute('hidden', '');
  degradedBanner.setAttribute('data-banner-kind', 'cached');
  const degradedMessage = registerElement('degradedMessage', createElement('degradedMessage'));
  degradedBanner.contains = (node) => node === degradedMessage;
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
      if (selector === '[data-empty-banner]') {
        return elements.emptyState ? [elements.emptyState] : [];
      }
      if (selector === '[data-banner-kind="cached"]') {
        return elements.degradedBanner ? [elements.degradedBanner] : [];
      }
      if (selector === '[data-banner-kind="error"]' || selector === '#errorState') {
        return elements.errorState ? [elements.errorState] : [];
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
    if(env.timers && typeof env.timers.runAll === 'function'){
      env.timers.runAll();
    }
  }
  await env.flush();
}

function getInfoLogs(env, event){
  return env.logs.info
    .filter(args => args[0] === '[ai_review]' && args[1] === event)
    .map(args => args[2]);
}

function getLatestInfo(env, event){
  const entries = getInfoLogs(env, event);
  return entries.length ? entries[entries.length - 1] : null;
}

function getEmptyLogs(env, tag){
  return env.logs.info
    .filter(args => args[0] === `[ai_review.empty] ${tag}`)
    .map(args => args[1]);
}

function getErrorLogs(env, tag){
  return env.logs.info
    .filter(args => args[0] === `[ai_review.error] ${tag}`)
    .map(args => args[1]);
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
  const stateLogs=getInfoLogs(env,'ai_review_state');
  assert(stateLogs.some(entry=>entry.view==='success' && entry.itemCount===items.length), 'state log captures success view');
  const bannerLog=getLatestInfo(env,'banner_decision');
  assert(bannerLog, 'banner decision emitted');
  assert(Array.isArray(bannerLog.active) && bannerLog.active.length===0, 'no banners active on successful load');
  assert.strictEqual(getInfoLogs(env,'banner_conflict').length, 0, 'no conflicts logged on success');
  const emptyDecisions=getEmptyLogs(env,'decision');
  assert(emptyDecisions.length>0, 'empty banner decisions logged for success with items');
  const lastDecision=emptyDecisions[emptyDecisions.length-1];
  assert.strictEqual(lastDecision.shouldShow, false, 'empty banner hidden when items present');
  assert.strictEqual(lastDecision.reason, 'has_items', 'empty banner reason reflects items present');
  assert.strictEqual(getEmptyLogs(env,'dom_before').length>0, true, 'empty banner dom_before emitted');
  assert.strictEqual(getEmptyLogs(env,'dom_after').length>0, true, 'empty banner dom_after emitted');
  assert.strictEqual(getEmptyLogs(env,'conflict').length, 0, 'no empty banner conflicts when items present');
  const errorDecisions=getErrorLogs(env,'decision');
  assert(errorDecisions.length>0, 'error banner decision logs emitted on success');
  const lastErrorDecision=errorDecisions[errorDecisions.length-1];
  assert.strictEqual(lastErrorDecision.shouldShow, false, 'error banner hidden on success');
  assert.strictEqual(lastErrorDecision.reason, 'not_error', 'error banner reason not_error on success');
  assert.strictEqual(getErrorLogs(env,'dom_before').length>0, true, 'error banner dom_before emitted on success render');
  assert.strictEqual(getErrorLogs(env,'dom_after').length>0, true, 'error banner dom_after emitted on success render');
  assert.strictEqual(getErrorLogs(env,'conflict').length, 0, 'no error banner conflicts on success');
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
  const bannerLog=getLatestInfo(env,'banner_decision');
  assert(bannerLog && bannerLog.active.includes('empty'), 'empty banner recorded');
  assert(!bannerLog.active.includes('error'), 'error banner not active on empty');
  assert.strictEqual(getInfoLogs(env,'banner_conflict').length, 0, 'no conflicts logged on empty state');
  const emptyDecisions=getEmptyLogs(env,'decision');
  assert(emptyDecisions.length>0, 'empty banner decisions logged for empty success');
  const latest=emptyDecisions[emptyDecisions.length-1];
  assert.strictEqual(latest.shouldShow, true, 'empty banner shown when zero items');
  assert.strictEqual(latest.reason, 'success_zero', 'empty banner reason indicates zero items');
  assert.strictEqual(latest.state.phase, 'success', 'empty banner state snapshot records success phase');
  assert.strictEqual(latest.state.itemCount, 0, 'empty banner state snapshot itemCount zero');
  assert.strictEqual(getEmptyLogs(env,'dom_before').length>0, true, 'empty banner dom_before emitted for empty success');
  assert.strictEqual(getEmptyLogs(env,'dom_after').length>0, true, 'empty banner dom_after emitted for empty success');
  assert.strictEqual(getEmptyLogs(env,'conflict').length, 0, 'no empty banner conflicts when showing banner');
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
  const bannerLog=getLatestInfo(env,'banner_decision');
  assert(bannerLog && bannerLog.active.includes('error'), 'error banner recorded');
  assert(!bannerLog.active.includes('degraded'), 'degraded banner not active when hard error');
  assert.strictEqual(getInfoLogs(env,'banner_conflict').length, 0, 'no conflicts logged on error state');
  const errorDecisions=getErrorLogs(env,'decision');
  assert(errorDecisions.length>0, 'error banner decisions captured on failure');
  const finalDecision=errorDecisions[errorDecisions.length-1];
  assert.strictEqual(finalDecision.shouldShow, true, 'error banner shown on final failure');
  assert.strictEqual(finalDecision.reason, 'final_error', 'error banner reason final_error on hard failure');
  assert(finalDecision.state && finalDecision.state.retries >= finalDecision.state.maxRetries, 'final failure logs exhausted retries');
  assert.strictEqual(getErrorLogs(env,'dom_before').length>0, true, 'error banner dom_before emitted on failure');
  assert.strictEqual(getErrorLogs(env,'dom_after').length>0, true, 'error banner dom_after emitted on failure');
  assert.strictEqual(getErrorLogs(env,'conflict').length, 0, 'no error banner conflicts on failure');
  const retryLogs=getErrorLogs(env,'retry_progress');
  assert.strictEqual(retryLogs.length, 2, 'two retry attempts logged before failure');
  assert.strictEqual(retryLogs[0].attempt, 1, 'first retry attempt logged');
  assert.strictEqual(retryLogs[1].attempt, 2, 'second retry attempt logged');
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
  const bannerLog=getLatestInfo(env,'banner_decision');
  assert(bannerLog && bannerLog.active.includes('degraded'), 'degraded banner recorded');
  assert(!bannerLog.active.includes('error'), 'error banner not active during degraded state');
  assert.strictEqual(getInfoLogs(env,'banner_conflict').length, 0, 'no conflicts logged on degraded state');
  const errorDecisions=getErrorLogs(env,'decision');
  assert(errorDecisions.length>0, 'error banner decisions captured with cache fallback');
  const finalDecision=errorDecisions[errorDecisions.length-1];
  assert.strictEqual(finalDecision.shouldShow, false, 'error banner hidden when cache available');
  assert.strictEqual(finalDecision.reason, 'not_error', 'error banner reason not_error when degraded');
}

async function testTransientRetryThenSuccess(){
  let attempt=0;
  const items=[createSampleEmail('t1')];
  const env = await mountAiReview({
    loader: () => {
      attempt++;
      if(attempt===1){
        return Promise.reject(new Error('temporary failure'));
      }
      return Promise.resolve(items);
    },
    seedEmails: []
  });
  await settle(env,6);

  assert.strictEqual(env.elements.errorState.hidden, true, 'error banner hidden after successful retry');
  assert.strictEqual(env.elements.groupContainer.hidden, false, 'group visible after retry success');
  const decisions=getErrorLogs(env,'decision');
  assert(decisions.some(entry=>entry.reason==='transient_retry'), 'transient retry decision logged');
  assert.strictEqual(decisions[decisions.length-1].reason, 'not_error', 'final decision not_error after recovery');
  const retryLogs=getErrorLogs(env,'retry_progress');
  assert.strictEqual(retryLogs.length, 1, 'single retry logged before recovery');
  assert.strictEqual(retryLogs[0].attempt, 1, 'retry_progress captures first retry attempt');
  assert.strictEqual(getErrorLogs(env,'conflict').length, 0, 'no error banner conflicts during retry flow');
}

async function testMutualExclusion(){
  const emptyEnv = await mountAiReview({ loader: () => Promise.resolve([]), seedEmails: [] });
  await settle(emptyEnv);
  assert(!(emptyEnv.elements.emptyState.hidden === false && emptyEnv.elements.errorState.hidden === false), 'empty and error not both visible after empty load');
  assert.strictEqual(getInfoLogs(emptyEnv,'banner_conflict').length, 0, 'no conflicts logged for empty state env');

  const errorEnv = await mountAiReview({ loader: () => Promise.reject(new Error('fail')), seedEmails: [] });
  await settle(errorEnv);
  assert(!(errorEnv.elements.emptyState.hidden === false && errorEnv.elements.errorState.hidden === false), 'empty and error not both visible after error load');
  assert.strictEqual(getInfoLogs(errorEnv,'banner_conflict').length, 0, 'no conflicts logged for error state env');
}

(async () => {
  await runTest('success with items hides global states', testSuccessWithItems);
  await runTest('empty success shows only empty state', testEmptySuccess);
  await runTest('error without cache renders only error', testErrorNoCache);
  await runTest('error with cache falls back to degraded view', testErrorWithCache);
  await runTest('transient failure retries then succeeds without showing error', testTransientRetryThenSuccess);
  await runTest('empty and error states are mutually exclusive', testMutualExclusion);
})();
