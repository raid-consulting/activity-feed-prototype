# Auto-refresh utility

The activity feed prototype shares a small helper in [`refresh-utils.js`](../refresh-utils.js) that coordinates background refreshes for views like **Activity Feed** and **AI review**.

## Defaults

* `DEFAULT_INTERVAL` — 15 seconds. Both feeds use this interval unless a page passes a custom `intervalMs`.
* `MIN_INTERVAL` — 1 second. Any interval lower than this automatically falls back to the default to avoid excessive polling.

## Lifecycle states

The object returned from `createAutoRefresh` can be in one of three observable states:

1. **Active** – `.isActive()` returns `true`; the refresh callback runs immediately (unless `immediate:false`) and then every interval while the document is visible.
2. **Stopped** – `.stop()` halts the timer but keeps listeners attached; call `.start()` again to resume polling.
3. **Disposed** – `.dispose()` clears the timer and removes visibility listeners. Disposed controllers cannot be restarted and should be recreated instead.

When `pauseWhenHidden` is `true` (the default), refreshes pause while `document.hidden` is `true`. A visibility change back to the foreground triggers a catch-up refresh so the UI stays current without wasting network calls in the background.

## Usage

```js
const refresher = AutoRefresh.createAutoRefresh({
  refresh: () => syncData(),
  intervalMs: AutoRefresh.DEFAULT_INTERVAL,
  immediate: false,   // skip the extra call when starting manually
  autoStart: false    // call .start() when the view is ready
});

refresher.start();      // begin polling
refresher.stop();       // temporarily pause
refresher.dispose();    // tear down before leaving the page
```

Both feeds start their controller after the initial render and dispose it when leaving the view (e.g., logging out) so we do not accumulate stray timers.
