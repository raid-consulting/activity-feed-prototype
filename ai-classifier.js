(function(globalFactory){
  if(typeof module === 'object' && typeof module.exports === 'object'){
    module.exports = globalFactory();
  } else {
    (typeof window !== 'undefined' ? window : globalThis).AIClassifier = globalFactory();
  }
})(function(){
  const VERSION = 'baseline-heuristic-v1';

  const KEYWORDS = {
    redSubject: ['overdue', 'payment', 'unhandled', 'failed', 'error'],
    redBody: ['manual review', 'cannot determine', 'late fee', 'escalated', 'failure'],
    blueSubject: ['needs context', 'offline', 'missing context', 'requires context'],
    blueBody: ['need context', 'provide context', 'missing information', 'offline', 'connectivity'],
    greenSubject: ['draft', 'prepared', 'ready for review'],
    greenBody: ['ai drafted', 'auto reply ready', 'automation can proceed']
  };

  const normalize = (value = '') => String(value || '').toLowerCase();

  function containsAny(text, keywords){
    const haystack = normalize(text);
    return keywords.some(keyword => haystack.includes(keyword));
  }

  function createDefaultAssessment(now){
    return {
      category: 'grey',
      confidence: 0.2,
      blockers: [],
      required_permissions: [],
      required_context: [],
      assessed_at: new Date(now).toISOString(),
      assessor_version: VERSION,
      notes: 'Automation readiness unknown; awaiting further signals.'
    };
  }

  function ensureUniquePush(list, value){
    if(value && !list.includes(value)){
      list.push(value);
    }
  }

  function evaluate(email = {}, now = new Date()){
    const assessment = createDefaultAssessment(now);
    const status = normalize(email.status);
    const subject = normalize(email.subject);
    const body = normalize(email.body);

    const markAssessment = (category, confidence, note) => {
      assessment.category = category;
      assessment.confidence = confidence;
      assessment.notes = note;
    };

    if(
      ['urgent', 'manual', 'escalated', 'error'].includes(status) ||
      containsAny(subject, KEYWORDS.redSubject) ||
      containsAny(body, KEYWORDS.redBody)
    ){
      markAssessment(
        'red',
        0.85,
        containsAny(body, ['manual review', 'cannot determine', 'unhandled'])
          ? 'Manual review required because automation signalled a failure.'
          : 'Urgent signal detected; automation paused pending human confirmation.'
      );
      ensureUniquePush(assessment.blockers, 'requires_human_decision');
      if(containsAny(body, ['payment', 'invoice', 'billing'])){
        ensureUniquePush(assessment.blockers, 'billing_risk');
      }
    } else if(
      ['needs_context', 'awaiting_context'].includes(status) ||
      containsAny(subject, KEYWORDS.blueSubject) ||
      containsAny(body, KEYWORDS.blueBody)
    ){
      markAssessment('blue', 0.7, 'Additional context required before automation can continue.');
      if(containsAny(body, ['device', 'connectivity', 'offline'])){
        ensureUniquePush(assessment.required_context, 'device_status');
      }
      if(containsAny(body, ['tenant', 'profile', 'history'])){
        ensureUniquePush(assessment.required_context, 'tenant_history');
      }
      if(!assessment.required_context.length){
        ensureUniquePush(assessment.required_context, 'operational_context');
      }
    } else if(
      ['draft', 'ready', 'auto_draft', 'prepared'].includes(status) ||
      containsAny(subject, KEYWORDS.greenSubject) ||
      containsAny(body, KEYWORDS.greenBody)
    ){
      markAssessment('green', 0.8, 'Automation draft is ready for approval.');
      ensureUniquePush(assessment.required_permissions, 'send_mail');
    } else {
      markAssessment('grey', 0.2, 'Automation readiness unknown; awaiting further signals.');
    }

    return assessment;
  }

  function applyAssessment(email = {}, now = new Date()){
    const result = evaluate(email, now);
    email.ai = result;
    email.aiCategory = result.category; // backwards compatibility
    if(!email.aiSynopsis){
      email.aiSynopsis = result.notes;
    }
    return email;
  }

  function ingest(items = [], now = new Date()){
    return items.map(item => applyAssessment(item, now));
  }

  function reassess(items = [], id, now = new Date()){
    const target = items.find(item => item && item.id === id);
    if(!target) return null;
    applyAssessment(target, now);
    return target.ai;
  }

  return {
    VERSION,
    evaluate,
    applyAssessment,
    ingest,
    reassess
  };
});
