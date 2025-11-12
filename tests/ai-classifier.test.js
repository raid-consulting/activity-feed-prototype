const assert = require('assert');
const path = require('path');
const classifier = require(path.join('..', 'ai-classifier.js'));

function test(name, fn){
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err){
    console.error(`✗ ${name}`);
    throw err;
  }
}

test('marks urgent billing messages as red with blockers', () => {
  const now = new Date('2024-01-10T10:00:00Z');
  const email = { id: 'r1', status: 'urgent', subject: 'Payment overdue', body: 'Late fee triggered, manual review needed before charging invoice.' };
  classifier.applyAssessment(email, now);
  assert.ok(email.ai, 'ai assessment is attached');
  assert.strictEqual(email.ai.category, 'red');
  assert.strictEqual(email.ai.confidence, 0.85);
  assert.ok(email.ai.blockers.includes('requires_human_decision'));
  assert.ok(email.ai.blockers.includes('billing_risk'));
  assert.ok(email.ai.notes.includes('Manual review') || email.ai.notes.includes('Urgent'));
  assert.strictEqual(email.ai.assessed_at.startsWith('2024-01-10'), true);
});

test('detects context requirements and flags as blue', () => {
  const email = { id: 'b1', status: 'needs_context', subject: 'Smartlock offline', body: 'Device reports connectivity issues and needs context before automation continues.' };
  const result = classifier.evaluate(email, new Date('2024-02-02T00:00:00Z'));
  assert.strictEqual(result.category, 'blue');
  assert.ok(result.required_context.includes('device_status'));
  assert.ok(result.required_context.includes('operational_context') === false);
  assert.strictEqual(result.notes.includes('context'), true);
});

test('draft replies move to green and request permissions', () => {
  const email = { id: 'g1', status: 'draft', subject: 'Draft reply prepared', body: 'AI drafted a response ready for approval.' };
  const result = classifier.evaluate(email, new Date('2024-03-03T00:00:00Z'));
  assert.strictEqual(result.category, 'green');
  assert.ok(result.required_permissions.includes('send_mail'));
  assert.strictEqual(result.confidence, 0.8);
});

test('missing signals default to grey with empty blockers', () => {
  const result = classifier.evaluate({}, new Date('2024-04-04T00:00:00Z'));
  assert.strictEqual(result.category, 'grey');
  assert.strictEqual(Array.isArray(result.blockers), true);
  assert.strictEqual(result.blockers.length, 0);
  assert.strictEqual(result.required_permissions.length, 0);
  assert.strictEqual(result.required_context.length, 0);
});

test('reassess updates timestamps and keeps aiSynopsis in sync', () => {
  const items = classifier.ingest([
    { id: 'z1', status: 'info', subject: 'Heads up', body: 'FYI for later.' }
  ], new Date('2024-01-01T00:00:00Z'));
  const initialTimestamp = items[0].ai.assessed_at;
  assert.strictEqual(items[0].aiSynopsis, items[0].ai.notes);
  const updated = classifier.reassess(items, 'z1', new Date('2024-05-05T00:00:00Z'));
  assert.ok(updated, 'updated assessment returned');
  assert.notStrictEqual(updated.assessed_at, initialTimestamp);
  assert.strictEqual(items[0].aiSynopsis, items[0].ai.notes);
  assert.strictEqual(items[0].aiCategory, items[0].ai.category);
});
