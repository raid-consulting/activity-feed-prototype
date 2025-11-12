(function (global) {
  const DEFAULT_GAP = 12;

  function computeRequiredOffset({
    footerHeight,
    baseTailSpace,
    safeArea = 0,
    minGap = DEFAULT_GAP
  }) {
    const numericFooter = Number.isFinite(footerHeight) ? footerHeight : 0;
    const numericTail = Number.isFinite(baseTailSpace) ? baseTailSpace : 0;
    const numericSafeArea = Number.isFinite(safeArea) ? safeArea : 0;
    const numericGap = Number.isFinite(minGap) ? minGap : DEFAULT_GAP;
    const targetTailSpace = Math.max(0, numericFooter) + Math.max(0, numericSafeArea) + Math.max(0, numericGap);
    const required = Math.max(0, targetTailSpace - Math.max(0, numericTail));
    return Math.ceil(required);
  }

  function initFooterOverscroll(options = {}) {
    const doc = options.document || global.document;
    if (!doc) return null;
    const root = doc.documentElement;
    if (!root) return null;

    if (root.__footerOverscrollController) {
      return root.__footerOverscrollController;
    }

    const footer = options.footer || doc.getElementById(options.footerId || 'appFooter');
    if (!footer) return null;

    const scrollElement = doc.scrollingElement || root;
    const existingSentinel = doc.querySelector('[data-footer-sentinel]');
    const sentinel = existingSentinel || doc.createElement('div');
    if (!existingSentinel) {
      sentinel.setAttribute('data-footer-sentinel', '');
      sentinel.setAttribute('aria-hidden', 'true');
      sentinel.style.cssText = 'position:relative;height:0;margin:0;padding:0;border:0;display:block;';
      footer.parentNode.insertBefore(sentinel, footer);
    }

    const readNumber = (value) => {
      const parsed = parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const getComputed = () => (global.getComputedStyle ? global.getComputedStyle(root) : { getPropertyValue: () => '0' });

    let currentOffset = readNumber(getComputed().getPropertyValue('--footer-offset'));
    const safeAreaValue = () => readNumber(getComputed().getPropertyValue('--footer-safe-area'));
    const minGap = Number.isFinite(options.minGap) ? options.minGap : DEFAULT_GAP;

    let frame = null;
    let resizeObserver = null;
    let mutationObserver = null;

    const apply = () => {
      frame = null;
      const footerRect = footer.getBoundingClientRect();
      const footerHeight = Math.ceil(footerRect.height || 0);
      const safeArea = safeAreaValue();
      const scrollTop = typeof scrollElement.scrollTop === 'number'
        ? scrollElement.scrollTop
        : (typeof global.pageYOffset === 'number' ? global.pageYOffset : 0);
      const sentinelRect = sentinel.getBoundingClientRect ? sentinel.getBoundingClientRect() : null;
      const rawTop = sentinelRect ? sentinelRect.top + scrollTop : sentinel.offsetTop;
      const sentinelTop = Number.isFinite(rawTop) ? rawTop : (Number.isFinite(sentinel.offsetTop) ? sentinel.offsetTop : 0);
      const rectHeight = sentinelRect ? sentinelRect.height : null;
      const sentinelHeight = Number.isFinite(rectHeight) ? rectHeight : (Number.isFinite(sentinel.offsetHeight) ? sentinel.offsetHeight : 0);
      const rawTailSpace = scrollElement.scrollHeight - sentinelTop - sentinelHeight;
      const tailSpace = Math.max(0, Number.isFinite(rawTailSpace) ? rawTailSpace : 0);
      const baseTailSpace = tailSpace - currentOffset;
      const nextOffset = computeRequiredOffset({
        footerHeight,
        baseTailSpace,
        safeArea,
        minGap
      });

      if (nextOffset !== currentOffset) {
        currentOffset = nextOffset;
        root.style.setProperty('--footer-offset', `${nextOffset}px`);
        schedule();
      }
    };

    const schedule = () => {
      if (frame != null) return;
      const raf = global.requestAnimationFrame || global.setTimeout;
      frame = raf(() => apply());
    };

    const handleResize = () => schedule();

    if ('ResizeObserver' in global) {
      resizeObserver = new global.ResizeObserver(schedule);
      resizeObserver.observe(scrollElement === root ? doc.body : scrollElement);
      resizeObserver.observe(footer);
      resizeObserver.observe(root);
    }

    if ('MutationObserver' in global) {
      mutationObserver = new global.MutationObserver(schedule);
      mutationObserver.observe(doc.body, { childList: true, subtree: true, characterData: true, attributes: true });
    }

    global.addEventListener('resize', handleResize, { passive: true });
    global.addEventListener('orientationchange', handleResize, { passive: true });

    const viewport = global.visualViewport;
    if (viewport && viewport.addEventListener) {
      viewport.addEventListener('resize', handleResize, { passive: true });
      viewport.addEventListener('scroll', handleResize, { passive: true });
    }

    schedule();

    const controller = {
      schedule,
      refresh: apply,
      disconnect() {
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
        if (mutationObserver) {
          mutationObserver.disconnect();
        }
        global.removeEventListener('resize', handleResize);
        global.removeEventListener('orientationchange', handleResize);
        if (viewport && viewport.removeEventListener) {
          viewport.removeEventListener('resize', handleResize);
          viewport.removeEventListener('scroll', handleResize);
        }
      }
    };

    root.__footerOverscrollController = controller;
    return controller;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      computeRequiredOffset,
      initFooterOverscroll
    };
  }

  if (global && typeof document !== 'undefined') {
    const start = () => {
      initFooterOverscroll();
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
