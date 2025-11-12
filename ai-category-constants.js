(function(globalFactory){
  if(typeof module === 'object' && typeof module.exports === 'object'){
    module.exports = globalFactory();
  } else {
    const target = typeof window !== 'undefined' ? window : globalThis;
    const api = globalFactory();
    target.AICategory = api;
    target.AI_CATEGORY_COPY = api.AI_CATEGORY_COPY;
  }
})(function(){
  const AI_CATEGORY_COPY = {
    green: { title: 'Fully automated', desc: 'AI can complete this end-to-end.' },
    red:   { title: 'No AI path',      desc: 'No steps are feasible for AI.' },
    blue:  { title: 'Needs input',     desc: 'AI is blocked by missing context or permissions.' },
    grey:  { title: 'Unassessed',      desc: 'Awaiting AI review.' }
  };

  function normalizeCategory(value){
    const key = String(value || '').toLowerCase();
    return AI_CATEGORY_COPY[key] ? key : 'grey';
  }

  function getCategoryPresentation(value){
    const key = normalizeCategory(value);
    const copy = AI_CATEGORY_COPY[key];
    return {
      key,
      title: copy.title,
      description: copy.desc,
      stripeClass: `card-stripe-${key}`,
      ariaLabel: copy.title
    };
  }

  return {
    AI_CATEGORY_COPY,
    normalizeCategory,
    getCategoryPresentation
  };
});
