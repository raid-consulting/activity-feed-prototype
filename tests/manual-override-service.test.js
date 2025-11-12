const assert = require('assert');
const path = require('path');
const service = require(path.join('..', 'manual-override-service.js'));

function test(name, fn){
  Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`✓ ${name}`);
    })
    .catch(err => {
      console.error(`✗ ${name}`);
      throw err;
    });
}

function createStorage(initial){
  let value = initial;
  return {
    getItem(key){
      if(key !== 'faux-emails') return null;
      return value;
    },
    setItem(key, next){
      if(key !== 'faux-emails') throw new Error('Unexpected storage key');
      value = next;
    },
    dump(){
      return value;
    }
  };
}

test('applyManualOverride updates assessor and preserves arrays', () => {
  const emails = [{
    id: 'm1',
    ai: {
      category: 'red',
      notes: 'Original note',
      assessor_version: 'baseline-heuristic-v1',
      assessed_at: '2024-05-01T00:00:00.000Z',
      blockers: ['requires_human_decision'],
      required_permissions: ['send_mail'],
      required_context: []
    }
  }];
  const updated = service.applyManualOverride(emails, 'm1', { category: 'green', note: 'Override accepted' }, new Date('2024-06-01T12:00:00Z'));
  assert.strictEqual(updated.ai.category, 'green');
  assert.strictEqual(updated.ai.assessor_version, 'manual-override');
  assert.ok(updated.ai.assessed_at.startsWith('2024-06-01'));
  assert.strictEqual(updated.ai.notes, 'Override accepted');
  assert.deepStrictEqual(updated.ai.blockers, ['requires_human_decision']);
  assert.deepStrictEqual(updated.ai.required_permissions, ['send_mail']);
  assert.strictEqual(updated.aiSynopsis, 'Override accepted');
});

test('applyManualOverride defaults note when none supplied', () => {
  const emails = [{ id: 'm2', ai: { category: 'grey', notes: 'Pending', assessor_version: 'baseline-heuristic-v1' } }];
  const updated = service.applyManualOverride(emails, 'm2', { category: 'red', note: '   ' }, new Date('2024-07-04T00:00:00Z'));
  assert.strictEqual(updated.ai.category, 'red');
  assert.strictEqual(updated.ai.notes, 'Manual override applied.');
  assert.strictEqual(updated.aiSynopsis, 'Manual override applied.');
});

test('persistOverride writes to storage and posts to endpoint', async () => {
  const storage = createStorage(JSON.stringify([
    { id: 'm3', subject: 'Demo', ai: { category: 'grey', notes: 'Awaiting', assessor_version: 'baseline-heuristic-v1', assessed_at: '2024-05-01T00:00:00Z', blockers: [], required_permissions: [], required_context: [] } }
  ]));
  const calls = [];
  const fetchImpl = (url, options) => {
    calls.push({ url, options });
    return Promise.resolve({ ok: true });
  };
  const updated = await service.persistOverride({ id: 'm3', category: 'blue', note: 'Needs additional context' }, { storage, now: new Date('2024-08-01T08:00:00Z'), fetchImpl });
  assert.strictEqual(updated.ai.category, 'blue');
  assert.strictEqual(updated.ai.assessor_version, 'manual-override');
  assert.ok(updated.ai.assessed_at.startsWith('2024-08-01'));
  const stored = JSON.parse(storage.dump());
  assert.strictEqual(stored[0].ai.category, 'blue');
  assert.strictEqual(stored[0].ai.assessor_version, 'manual-override');
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].url, service.ENDPOINT);
  const payload = JSON.parse(calls[0].options.body);
  assert.strictEqual(payload.id, 'm3');
  assert.strictEqual(payload.category, 'blue');
  assert.strictEqual(payload.note, 'Needs additional context');
  assert.strictEqual(payload.assessor_version, 'manual-override');
});
