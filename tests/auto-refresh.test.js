const assert = require('assert');
const path = require('path');
const refreshUtils = require(path.join('..', 'refresh-utils.js'));

function test(name, fn){
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err){
    console.error(`✗ ${name}`);
    throw err;
  }
}

function createScheduler(){
  const tasks = [];
  return {
    tasks,
    set(fn, ms){
      const id = tasks.length;
      tasks.push({ fn, ms, cleared:false });
      return id;
    },
    clear(id){
      if(tasks[id]){
        tasks[id].cleared = true;
      }
    },
    run(id){
      const task = tasks[id];
      if(task && !task.cleared){
        task.fn();
      }
    }
  };
}

test('auto start triggers immediate refresh and schedules interval', () => {
  let calls = 0;
  const scheduler = createScheduler();
  refreshUtils.createAutoRefresh({
    refresh: () => { calls++; },
    intervalMs: 2000,
    scheduler
  });
  assert.strictEqual(calls, 1, 'refresh runs immediately on start');
  assert.strictEqual(scheduler.tasks.length, 1, 'interval scheduled once');
  scheduler.run(0);
  assert.strictEqual(calls, 2, 'interval invokes refresh');
});

test('stop prevents additional ticks and dispose clears timer', () => {
  let calls = 0;
  const scheduler = createScheduler();
  const refresher = refreshUtils.createAutoRefresh({
    refresh: () => { calls++; },
    intervalMs: 2000,
    scheduler
  });
  assert.strictEqual(calls, 1, 'initial call happened');
  refresher.stop();
  scheduler.run(0);
  assert.strictEqual(calls, 1, 'stop prevents interval calls');
  refresher.dispose();
  assert.strictEqual(scheduler.tasks[0].cleared, true, 'interval cleared on dispose');
});

test('visibility hidden suppresses refresh until visible again', () => {
  const doc = {
    hidden: false,
    listeners: {},
    addEventListener(event, handler){ this.listeners[event] = handler; },
    removeEventListener(event){ delete this.listeners[event]; }
  };
  let calls = 0;
  const scheduler = createScheduler();
  refreshUtils.createAutoRefresh({
    refresh: () => { calls++; },
    intervalMs: 1500,
    scheduler,
    visibility: doc
  });
  assert.strictEqual(calls, 1, 'initial call happens while visible');
  doc.hidden = true;
  scheduler.run(0);
  assert.strictEqual(calls, 1, 'hidden document skips refresh');
  doc.hidden = false;
  doc.listeners.visibilitychange();
  assert.strictEqual(calls, 2, 'visibility change triggers refresh');
});

test('invalid interval falls back to default minimum', () => {
  const scheduler = createScheduler();
  const refresher = refreshUtils.createAutoRefresh({
    refresh: () => {},
    intervalMs: -20,
    scheduler
  });
  assert.strictEqual(refresher.intervalMs, refreshUtils.DEFAULT_INTERVAL);
});
