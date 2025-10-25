

const api = 'https://toptowertechnologies.com/hotel-menu/api.php';

let state = {
  categories: [],
  products: [],
  activeCategoryId: 'all',
  search: '',
  availability: 'all',
  outlet: null
};

function fmtCurrency(n){
  try{
    return new Intl.NumberFormat(undefined,{style:'currency',currency:'NGN',maximumFractionDigits:0}).format(n);
  }catch(e){
    return '₦' + Number(n).toFixed(0);
  }
}

async function loadDataForOutlet(outlet){
  // fetch menu from API and pass outlet; API will return merged products (food + drinks) for the outlet
  const res = await fetch(`${api}?action=getMenu&outlet=${encodeURIComponent(outlet)}`,{cache:'no-store'});
  const data = await res.json();
  if(!data.success){ alert('Failed to load menu'); return; }
  state.categories = data.data.categories;
  state.products = data.data.products;
  state.outlet = outlet;
  document.getElementById('currentOutlet').textContent = prettifyOutlet(outlet);
  localStorage.setItem('dw_outlet', outlet);
  renderCategories();
  renderItems();
}

function prettifyOutlet(key){
  return ({
    restaurant: 'Restaurant',
    dining_poolside: 'Dining / Poolside',
    rooftop_bar: 'Rooftop Bar',
    open_lounge_bar: 'Open Lounge Bar',
    vip_bar: 'VIP Bar'
  })[key] || key;
}

function renderCategories(){
  const wrap = document.getElementById('categoryChips');
  wrap.innerHTML = '';
  const mk = (id, name)=>{
    const c = document.createElement('div');
    c.className = 'chip' + (String(state.activeCategoryId)===String(id)?' active':'');
    c.textContent = name;
    c.onclick = ()=>{ state.activeCategoryId = id; renderCategories(); renderItems(); };
    return c;
  };
  wrap.appendChild(mk('all','All'));
  state.categories.forEach(cat=> wrap.appendChild(mk(cat.id, cat.name)));
}

function renderItems(){
  const list = document.getElementById('itemsList');
  const search = state.search.toLowerCase();
  let items = state.products.slice();

  if(state.activeCategoryId!=='all'){
    items = items.filter(p=> String(p.category_id)===String(state.activeCategoryId));
  }
  if(state.availability==='available') items = items.filter(p=> !!p.available);
  if(state.availability==='na') items = items.filter(p=> !p.available);
  if(search) items = items.filter(p=> (p.name||'').toLowerCase().includes(search) );

  document.getElementById('count').textContent = `${items.length} item${items.length!==1?'s':''}`;
  list.innerHTML = '';
  if(items.length===0){
    list.innerHTML = '<div class="small">No items match your filter.</div>';
    return;
  }
  items.forEach(p=>{
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `
      <div style="display:flex;gap:10px;align-items:center">
        <div>
          <div class="item-name">${p.name}</div>
          <div class="small" style="opacity:.8">${p.description?p.description:''}</div>
        </div>
      </div>
      <div style="display:flex;gap:10px;align-items:center">
        <span class="price">${fmtCurrency(p.price)}</span>
        <span class="status ${p.available?'ok':'na'}">${p.available?'Available':'Not Available'}</span>
      </div>
    `;
    list.appendChild(div);
  });
}

document.getElementById('searchInput').addEventListener('input', (e)=>{
  state.search = e.target.value; renderItems();
});
document.getElementById('availabilityFilter').addEventListener('change', (e)=>{
  state.availability = e.target.value; renderItems();
});
document.getElementById('year').textContent = new Date().getFullYear();

// outlet selection
const overlay = document.getElementById('overlay');
const outletButtons = document.getElementById('outletButtons');
outletButtons.addEventListener('click', (e)=>{
  const btn = e.target.closest('button');
  if(!btn) return;
  const outlet = btn.getAttribute('data-outlet');
  overlay.style.display = 'none';
  loadDataForOutlet(outlet);
});

// change outlet button
document.getElementById('changeOutletBtn').addEventListener('click', ()=>{
  document.getElementById('overlay').style.display = 'flex';
});

// on load check localStorage
window.addEventListener('DOMContentLoaded', ()=>{
  const chosen = localStorage.getItem('dw_outlet');
  if(chosen){
    // hide overlay and load
    overlay.style.display = 'none';
    loadDataForOutlet(chosen);
  }else{
    overlay.style.display = 'flex';
  }
});
