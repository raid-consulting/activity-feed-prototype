const assert = require('assert');
const path = require('path');
const overscroll = require(path.join('..', 'footer-overscroll.js'));

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
}

const compute = overscroll.computeRequiredOffset;

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
