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

  const CATEGORY_THEME_CLASS = {
    green: 'category-theme-green',
    red: 'category-theme-red',
    blue: 'category-theme-blue',
    grey: 'category-theme-grey'
  };

  function normalizeCategory(value){
    const key = String(value || '').toLowerCase();
    return AI_CATEGORY_COPY[key] ? key : 'grey';
  }

  function getCategoryPresentation(value){
    const key = normalizeCategory(value);
    const copy = AI_CATEGORY_COPY[key];
    const themeClass = CATEGORY_THEME_CLASS[key] || CATEGORY_THEME_CLASS.grey;
    return {
      key,
      title: copy.title,
      description: copy.desc,
      themeClass,
      ariaLabel: copy.title
    };
  }

  return {
    AI_CATEGORY_COPY,
    normalizeCategory,
    getCategoryPresentation
  };
});
