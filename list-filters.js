(function(global){
  const noop=()=>{};
  const HAS_ELEMENT=typeof Element!=='undefined';

  function toArray(value){
    if(Array.isArray(value)) return value.filter(Boolean);
    if(value && typeof value.length==='number'){ return Array.from(value).filter(Boolean); }
    return [];
  }

  function defaultCategory(){
    return 'grey';
  }

  function defaultSearchText(item){
    return typeof item==='string' ? item : JSON.stringify(item||'');
  }

  function createListFilterController(options={}){
    const filterButtons=toArray(options.filterButtons || []);
    const searchInput=HAS_ELEMENT && options.searchInput instanceof Element ? options.searchInput : null;
    const countRoot=options.countRoot || (typeof document!=='undefined' ? document : null);
    const getCategory=typeof options.getCategory==='function' ? options.getCategory : defaultCategory;
    const getSearchText=typeof options.getSearchText==='function' ? options.getSearchText : defaultSearchText;
    let onChange=typeof options.onChange==='function' ? options.onChange : noop;

    const state={
      filter:(options.initialFilter || 'all'),
      search:'',
      items:[]
    };

    function syncButtonPressed(){
      filterButtons.forEach(btn=>{
        if(!HAS_ELEMENT || !(btn instanceof Element)) return;
        const key=btn.getAttribute('data-filter') || 'all';
        const pressed=key===state.filter;
        btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
      });
    }

    function applyFilterValue(value){
      const next=value || 'all';
      if(state.filter===next) return false;
      state.filter=next;
      syncButtonPressed();
      return true;
    }

    function applySearchValue(value){
      const next=(value || '').toLowerCase();
      if(state.search===next) return false;
      state.search=next;
      return true;
    }

    function updateCounts(){
      if(!countRoot) return;
      const nodes=typeof countRoot.querySelectorAll==='function'
        ? Array.from(countRoot.querySelectorAll('[data-count]'))
        : [];
      if(!nodes.length) return;
      const counts={};
      state.items.forEach(item=>{
        const key=getCategory(item) || 'grey';
        counts[key]=(counts[key]||0)+1;
      });
      nodes.forEach(node=>{
        if(!HAS_ELEMENT || !(node instanceof Element)) return;
        const key=node.getAttribute('data-count');
        if(key==='all'){
          node.textContent=String(state.items.length);
        } else if(key){
          node.textContent=String(counts[key] || 0);
        }
      });
    }

    function filterItems(source){
      const list=Array.isArray(source) ? source : state.items;
      if(!list.length) return [];
      return list.filter(item=>{
        const category=getCategory(item) || 'grey';
        if(state.filter!=='all' && category!==state.filter) return false;
        if(!state.search) return true;
        const hay=String(getSearchText(item) || '').toLowerCase();
        return hay.includes(state.search);
      });
    }

    function notify(){
      onChange({
        filter:state.filter,
        search:state.search,
        items:state.items.slice(),
        getFilteredItems:()=>filterItems()
      });
    }

    filterButtons.forEach(btn=>{
      if(!HAS_ELEMENT || !(btn instanceof Element)) return;
      if(btn.tagName==='BUTTON' && !btn.getAttribute('type')){
        btn.setAttribute('type','button');
      }
      btn.addEventListener('click',()=>{
        const value=btn.getAttribute('data-filter') || 'all';
        const changed=applyFilterValue(value);
        if(changed){
          notify();
        }
      });
    });

    if(searchInput){
      searchInput.addEventListener('input',()=>{
        const changed=applySearchValue(searchInput.value || '');
        if(changed){
          notify();
        }
      });
    }

    syncButtonPressed();

    return {
      setItems(items){
        state.items=Array.isArray(items) ? items.slice() : [];
        updateCounts();
      },
      getFilteredItems(list){
        return filterItems(list);
      },
      setFilter(value){
        if(applyFilterValue(value)){
          notify();
        }
      },
      setSearch(value){
        if(applySearchValue(value)){
          notify();
        }
      },
      refreshCounts:updateCounts,
      onChange(handler){
        onChange=typeof handler==='function' ? handler : noop;
      },
      getState(){
        return {
          filter:state.filter,
          search:state.search,
          items:state.items.slice()
        };
      }
    };
  }

  global.ListFilters={
    createListFilterController
  };
})(typeof window!=='undefined' ? window : this);
