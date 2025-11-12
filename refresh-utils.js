(function(global){
  const root = typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : this);
  const DEFAULT_INTERVAL = 15000;
  const MIN_INTERVAL = 1000;

  function normalizeInterval(value){
    const numeric = Number(value);
    if(Number.isFinite(numeric) && numeric >= MIN_INTERVAL){
      return numeric;
    }
    return DEFAULT_INTERVAL;
  }

  function defaultScheduler(){
    const setFn = root && root.setInterval ? root.setInterval.bind(root) : setInterval;
    const clearFn = root && root.clearInterval ? root.clearInterval.bind(root) : clearInterval;
    return {
      set: setFn,
      clear: clearFn
    };
  }

  function createAutoRefresh(options){
    const opts = options || {};
    if(typeof opts.refresh !== 'function'){
      throw new TypeError('createAutoRefresh requires a refresh function');
    }

    const intervalMs = normalizeInterval(opts.intervalMs ?? opts.interval);
    const scheduler = opts.scheduler || defaultScheduler();
    const pauseWhenHidden = opts.pauseWhenHidden !== false;
    const immediate = opts.immediate !== false;
    const autoStart = opts.autoStart !== false;
    const visibilitySource = opts.visibility || (typeof document !== 'undefined' ? document : null);

    let timerId = null;
    let disposed = false;
    let active = false;
    let visibilityHandler = null;

    function invokeRefresh(){
      if(disposed) return;
      opts.refresh();
    }

    function schedule(){
      timerId = scheduler.set(() => {
        if(disposed) return;
        if(pauseWhenHidden && visibilitySource && visibilitySource.hidden){
          return;
        }
        invokeRefresh();
      }, intervalMs);
    }

    function clearTimer(){
      if(timerId !== null){
        scheduler.clear(timerId);
        timerId = null;
      }
    }

    function start(){
      if(disposed || active) return;
      active = true;
      if(immediate){
        invokeRefresh();
      }
      schedule();
    }

    function stop(){
      if(!active) return;
      active = false;
      clearTimer();
    }

    function dispose(){
      if(disposed) return;
      stop();
      if(visibilitySource && visibilityHandler){
        const remover = visibilitySource.removeEventListener || visibilitySource.off;
        if(typeof remover === 'function'){
          remover.call(visibilitySource, 'visibilitychange', visibilityHandler);
        }
      }
      disposed = true;
    }

    if(visibilitySource && typeof visibilitySource.addEventListener === 'function' && pauseWhenHidden){
      visibilityHandler = () => {
        if(disposed || !active) return;
        if(!visibilitySource.hidden){
          invokeRefresh();
        }
      };
      visibilitySource.addEventListener('visibilitychange', visibilityHandler);
    }

    if(autoStart){
      start();
    }

    return {
      start,
      stop,
      dispose,
      isActive(){ return active && !disposed; },
      get intervalMs(){ return intervalMs; }
    };
  }

  const api = {
    DEFAULT_INTERVAL,
    MIN_INTERVAL,
    createAutoRefresh
  };

  if(typeof module !== 'undefined' && module.exports){
    module.exports = api;
  } else if(root){
    root.AutoRefresh = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
