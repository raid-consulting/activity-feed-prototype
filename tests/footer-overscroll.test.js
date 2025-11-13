const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'footer-overscroll.js'), 'utf8');

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
}

function loadOverscroll(stubGlobal = {}) {
  const globalRef = stubGlobal;
  globalRef.window = globalRef;
  globalRef.globalThis = globalRef;
  globalRef.global = globalRef;
  const context = vm.createContext({
    module: { exports: {} },
    exports: {},
    require,
    console,
    window: globalRef,
    globalThis: globalRef,
    global: globalRef
  });
  const script = new vm.Script(source, { filename: 'footer-overscroll.js' });
  script.runInContext(context);
  return { module: context.module.exports, global: globalRef };
}

const { module: overscrollBase } = loadOverscroll();
const compute = overscrollBase.computeRequiredOffset;

test('adds just enough offset for long pages hidden by footer', () => {
  const offset = compute({ footerHeight: 96, baseTailSpace: 28, safeArea: 0, minGap: 12 });
  assert.strictEqual(offset, 80, 'offset matches footer height plus breathing room minus existing space');
});

test('does not add extra offset when space already available', () => {
  const offset = compute({ footerHeight: 90, baseTailSpace: 140, safeArea: 0, minGap: 12 });
  assert.strictEqual(offset, 0, 'no overscroll needed when trailing space exceeds footer');
});

test('incorporates safe area and dynamic footer changes', () => {
  const initial = compute({ footerHeight: 80, baseTailSpace: 50, safeArea: 20, minGap: 8 });
  assert.strictEqual(initial, 58, 'safe area and custom gap increase offset');

  const resized = compute({ footerHeight: 120, baseTailSpace: 50, safeArea: 20, minGap: 8 });
  assert.strictEqual(resized, 98, 'larger footer requires additional overscroll');
});

function createOverscrollHarness({
  baseContentHeight,
  existingTailSpace = 0,
  footerHeight,
  safeArea = 0,
  minGap = 12,
  viewportHeight = 900,
  initialOffset = 120
}) {
  const stubGlobal = {
    pageYOffset: 0
  };

  const resizeObservers = [];
  class FakeResizeObserver {
    constructor(cb) {
      this.cb = cb;
      resizeObservers.push(this);
    }
    observe() {}
    disconnect() {}
  }

  const mutationObservers = [];
  class FakeMutationObserver {
    constructor(cb) {
      this.cb = cb;
      mutationObservers.push(this);
    }
    observe() {}
    disconnect() {}
  }

  const globalListeners = {};
  stubGlobal.addEventListener = (type, handler) => {
    if (!globalListeners[type]) {
      globalListeners[type] = new Set();
    }
    globalListeners[type].add(handler);
  };
  stubGlobal.removeEventListener = (type, handler) => {
    if (globalListeners[type]) {
      globalListeners[type].delete(handler);
    }
  };

  const viewportListeners = {};
  stubGlobal.visualViewport = {
    addEventListener(type, handler) {
      if (!viewportListeners[type]) {
        viewportListeners[type] = new Set();
      }
      viewportListeners[type].add(handler);
    },
    removeEventListener(type, handler) {
      if (viewportListeners[type]) {
        viewportListeners[type].delete(handler);
      }
    }
  };

  stubGlobal.ResizeObserver = FakeResizeObserver;
  stubGlobal.MutationObserver = FakeMutationObserver;
  stubGlobal.requestAnimationFrame = (cb) => { cb(); return 1; };
  stubGlobal.cancelAnimationFrame = () => {};
  stubGlobal.setTimeout = (cb) => { cb(); return 1; };
  stubGlobal.clearTimeout = () => {};

  const styleValues = {
    '--footer-offset': `${initialOffset}px`,
    '--footer-safe-area': `${safeArea}px`
  };

  let currentOffset = initialOffset;
  let currentFooterHeight = footerHeight;
  let trailingSpace = existingTailSpace;
  let sentinelInDom = false;

  const documentElement = {
    style: {
      setProperty(name, value) {
        styleValues[name] = value;
        if (name === '--footer-offset') {
          const numeric = parseFloat(value);
          currentOffset = Number.isFinite(numeric) ? numeric : 0;
          updateScrollHeight();
        }
      },
      getPropertyValue(name) {
        return styleValues[name] || '0';
      }
    },
    scrollHeight: 0,
    scrollTop: 0,
    clientHeight: viewportHeight
  };

  const updateScrollHeight = () => {
    documentElement.scrollHeight = baseContentHeight + trailingSpace + currentOffset;
  };
  updateScrollHeight();

  const sentinel = {
    offsetTop: baseContentHeight,
    offsetHeight: 0,
    style: { cssText: '' },
    setAttribute(name) {
      if (name === 'data-footer-sentinel') {
        sentinelInDom = true;
      }
    },
    getBoundingClientRect() {
      const top = baseContentHeight - documentElement.scrollTop;
      return { top, bottom: top, height: 0, width: 0, left: 0, right: 0 };
    }
  };

  const body = {
    insertBefore(node) {
      sentinelInDom = true;
      node.parentNode = body;
    }
  };

  const footer = {
    parentNode: body,
    getBoundingClientRect() {
      return { height: currentFooterHeight };
    }
  };

  const document = {
    documentElement,
    body,
    readyState: 'complete',
    createElement(tag) {
      if (tag !== 'div') {
        throw new Error(`unexpected tag ${tag}`);
      }
      return sentinel;
    },
    getElementById(id) {
      if (id === 'footer') {
        return footer;
      }
      return null;
    },
    querySelector(selector) {
      if (selector === '[data-footer-sentinel]' && sentinelInDom) {
        return sentinel;
      }
      return null;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener() {},
    removeEventListener() {}
  };

  document.scrollingElement = documentElement;

  stubGlobal.getComputedStyle = () => ({
    getPropertyValue(name) {
      return styleValues[name] || '0';
    }
  });

  const { module: overscroll } = loadOverscroll(stubGlobal);

  const controller = overscroll.initFooterOverscroll({ document, minGap });

  return {
    controller,
    document,
    documentElement,
    sentinel,
    footer,
    resizeObservers,
    mutationObservers,
    globalListeners,
    viewportListeners,
    minGap,
    safeArea,
    getOffset() {
      return currentOffset;
    },
    getTailSpace() {
      return documentElement.scrollHeight - baseContentHeight;
    },
    getTargetSpace() {
      return currentFooterHeight + safeArea + minGap;
    },
    footerTop() {
      return documentElement.clientHeight - currentFooterHeight;
    },
    scrollToBottom() {
      documentElement.scrollTop = Math.max(0, documentElement.scrollHeight - documentElement.clientHeight);
      stubGlobal.pageYOffset = documentElement.scrollTop;
    },
    sentinelTop() {
      return sentinel.getBoundingClientRect().top;
    },
    setFooterHeight(value) {
      currentFooterHeight = value;
    },
    setTrailingSpace(value) {
      trailingSpace = value;
      updateScrollHeight();
    },
    triggerResize() {
      if (globalListeners.resize) {
        globalListeners.resize.forEach((fn) => fn());
      }
    },
    triggerViewportResize() {
      if (viewportListeners.resize) {
        viewportListeners.resize.forEach((fn) => fn());
      }
    },
    fireResizeObservers() {
      resizeObservers.forEach((observer) => observer.cb());
    },
    fireMutationObservers() {
      mutationObservers.forEach((observer) => observer.cb());
    },
    refresh() {
      controller.refresh();
    }
  };
}

test('long pages scroll until content clears the footer', () => {
  const harness = createOverscrollHarness({
    baseContentHeight: 2400,
    existingTailSpace: 24,
    footerHeight: 128,
    viewportHeight: 900
  });

  harness.refresh();
  harness.scrollToBottom();

  const tailSpace = harness.getTailSpace();
  assert.ok(
    tailSpace >= harness.getTargetSpace(),
    `tail space ${tailSpace} should meet or exceed required clearance ${harness.getTargetSpace()}`
  );

  const sentinelTop = harness.sentinelTop();
  const clearanceLine = harness.footerTop() - harness.minGap;
  assert.ok(
    sentinelTop <= clearanceLine,
    `sentinel top ${sentinelTop} should fall above footer line ${clearanceLine}`
  );
});

test('short pages avoid extra trailing whitespace', () => {
  const harness = createOverscrollHarness({
    baseContentHeight: 480,
    existingTailSpace: 260,
    footerHeight: 120,
    viewportHeight: 900
  });

  harness.refresh();

  assert.strictEqual(harness.getOffset(), 0, 'offset reduced to zero for naturally short pages');
  assert.strictEqual(harness.getTailSpace(), 260, 'tail space remains the natural trailing gap');
});

test('footer offset reacts to dynamic footer resizing', () => {
  const harness = createOverscrollHarness({
    baseContentHeight: 2000,
    existingTailSpace: 16,
    footerHeight: 96,
    viewportHeight: 900
  });

  harness.refresh();

  const initialOffset = harness.getOffset();
  const expectedInitial = harness.getTargetSpace() - 16;
  assert.strictEqual(initialOffset, expectedInitial, 'initial offset matches requirement');

  harness.setFooterHeight(156);
  harness.fireResizeObservers();
  harness.triggerResize();
  harness.triggerViewportResize();

  const updatedTailSpace = harness.getTailSpace();
  const required = harness.getTargetSpace();
  assert.ok(
    updatedTailSpace >= required,
    `updated tail space ${updatedTailSpace} should accommodate new footer height ${required}`
  );
});
