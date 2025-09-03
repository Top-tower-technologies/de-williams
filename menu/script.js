
const api = 'https://paywiththunder.com/hotel-menu/api.php';

let state = {
  categories: [],
  products: [],
  activeCategoryId: 'all',
  search: '',
  availability: 'all'
};

function fmtCurrency(n){
  try{
    return new Intl.NumberFormat(undefined,{style:'currency',currency:'NGN',maximumFractionDigits:0}).format(n);
  }catch(e){
    return '₦' + Number(n).toFixed(0);
  }
}

async function loadData(){
  const res = await fetch(`${api}?action=getMenu`,{cache:'no-store'});
  const data = await res.json();
  if(!data.success){ alert('Failed to load menu'); return; }
  state.categories = data.data.categories;
  state.products = data.data.products;
  renderCategories();
  renderItems();
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
  let items = state.products;

  if(state.activeCategoryId!=='all'){
    items = items.filter(p=> String(p.category_id)===String(state.activeCategoryId));
  }
  if(state.availability==='available') items = items.filter(p=> !!p.available);
  if(state.availability==='na') items = items.filter(p=> !p.available);
  if(search) items = items.filter(p=> p.name.toLowerCase().includes(search));

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
        <div class="item-name">${p.name}</div>
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

loadData();
