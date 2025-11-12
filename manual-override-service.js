(function(globalFactory){
  if(typeof module === 'object' && typeof module.exports === 'object'){
    module.exports = globalFactory();
  } else {
    (typeof window !== 'undefined' ? window : globalThis).ManualOverrideService = globalFactory();
  }
})(function(){
  const STORAGE_KEY = 'faux-emails';
  const ENDPOINT = '/api/ai-overrides';
  const VALID_CATEGORIES = new Set(['red', 'green', 'blue', 'grey']);

  function normalizeCategory(value){
    const normalized = String(value || '').toLowerCase();
    return VALID_CATEGORIES.has(normalized) ? normalized : 'grey';
  }

  function defaultNote(note){
    const trimmed = typeof note === 'string' ? note.trim() : '';
    return trimmed || 'Manual override applied.';
  }

  function ensureArray(value){
    return Array.isArray(value) ? value.slice() : [];
  }

  function ensureObject(value){
    return value && typeof value === 'object' ? value : {};
  }

  function applyManualOverride(emails, id, override = {}, now = new Date()){
    if(!Array.isArray(emails)){
      throw new TypeError('applyManualOverride expects an array of emails');
    }
    const email = emails.find(item => item && item.id === id);
    if(!email){
      throw new Error(`Email with id "${id}" not found`);
    }
    const ai = ensureObject(email.ai);
    const category = normalizeCategory(override.category);
    const note = defaultNote(override.note);
    const assessedAt = new Date(now).toISOString();

    const updatedAi = {
      ...ai,
      blockers: ensureArray(ai.blockers),
      required_permissions: ensureArray(ai.required_permissions),
      required_context: ensureArray(ai.required_context),
      category,
      notes: note,
      assessor_version: 'manual-override',
      assessed_at: assessedAt
    };

    email.ai = updatedAi;
    email.aiCategory = category;
    email.aiSynopsis = note;

    return email;
  }

  function readEmails(storage, storageKey){
    const raw = storage.getItem(storageKey);
    if(!raw){
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeEmails(storage, storageKey, emails){
    storage.setItem(storageKey, JSON.stringify(emails));
  }

  async function persistOverride(payload, options = {}){
    if(!payload || !payload.id){
      throw new TypeError('persistOverride requires an id');
    }
    const storage = options.storage || (typeof window !== 'undefined' ? window.localStorage : null);
    if(!storage){
      throw new Error('Storage is unavailable for manual override persistence');
    }
    const storageKey = options.storageKey || STORAGE_KEY;
    const emails = readEmails(storage, storageKey);
    const updated = applyManualOverride(emails, payload.id, {
      category: payload.category,
      note: payload.note
    }, options.now || new Date());
    writeEmails(storage, storageKey, emails);

    const fetchImpl = options.fetchImpl;
    if(typeof fetchImpl === 'function'){
      const body = {
        id: payload.id,
        category: updated.ai.category,
        note: updated.ai.notes || '',
        assessed_at: updated.ai.assessed_at,
        assessor_version: updated.ai.assessor_version
      };
      const response = await fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      if(response && typeof response.ok === 'boolean' && !response.ok){
        throw new Error('Backend rejected manual override');
      }
    }

    return updated;
  }

  return {
    ENDPOINT,
    applyManualOverride,
    persistOverride
  };
});
