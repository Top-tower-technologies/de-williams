

const api = 'https://toptowertechnologies.com/hotel-menu/api.php';

let state = {
  categories: [],
  products: [],
  activeCategoryId: 'all',
  search: '',
  availability: 'all',
  outlet: null
};

// Format prices to NGN currency
function fmtCurrency(n) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
  } catch (e) {
    return '₦' + Number(n).toFixed(0);
  }
}

// Load menu data from backend based on selected outlet
async function loadDataForOutlet(outlet) {
  const res = await fetch(`${api}?action=getMenu&outlet=${encodeURIComponent(outlet)}`, { cache: 'no-store' });
  const data = await res.json();
  if (!data.success) {
    alert('Failed to load menu');
    return;
  }
  state.categories = data.data.categories;
  state.products = data.data.products;
  state.outlet = outlet;
  document.getElementById('currentOutlet').textContent = prettifyOutlet(outlet);
  localStorage.setItem('dw_outlet', outlet);
  renderCategories();
  renderItems();
}

// Pretty print outlet name
function prettifyOutlet(key) {
  return ({
    restaurant: 'Restaurant',
    dining_poolside: 'Dining / Poolside',
    rooftop_bar: 'Rooftop Bar',
    open_lounge_bar: 'Open Lounge Bar',
    vip_bar: 'VIP Bar'
  })[key] || key;
}

// Render menu categories as clickable chips
function renderCategories() {
  const wrap = document.getElementById('categoryChips');
  wrap.innerHTML = '';
  const mk = (id, name) => {
    const c = document.createElement('div');
    c.className = 'chip' + (String(state.activeCategoryId) === String(id) ? ' active' : '');
    c.textContent = name;
    c.onclick = () => {
      state.activeCategoryId = id;
      renderCategories();
      renderItems();
    };
    return c;
  };
  wrap.appendChild(mk('all', 'All'));
  state.categories.forEach(cat => wrap.appendChild(mk(cat.id, cat.name)));
}

// Render menu items — with grouping for Drinks
function renderItems() {
  const list = document.getElementById('itemsList');
  const search = state.search.toLowerCase();
  let items = state.products.slice();

  if (state.activeCategoryId !== 'all') {
    items = items.filter(p => String(p.category_id) === String(state.activeCategoryId));
  }
  if (state.availability === 'available') items = items.filter(p => !!p.available);
  if (state.availability === 'na') items = items.filter(p => !p.available);
  if (search) items = items.filter(p => (p.name || '').toLowerCase().includes(search));

  document.getElementById('count').textContent = `${items.length} item${items.length !== 1 ? 's' : ''}`;
  list.innerHTML = '';

  if (items.length === 0) {
    list.innerHTML = '<div class="small">No items match your filter.</div>';
    return;
  }

  const currentCat = state.categories.find(c => String(c.id) === String(state.activeCategoryId));
  const isDrinks = currentCat && currentCat.name.toLowerCase().includes('drink');

  if (isDrinks) {
    // Group drinks by sub_category
    const grouped = {};
    items.forEach(item => {
      const key = item.sub_category || 'Others';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });

    // Render each drink group with collapsible section
    Object.keys(grouped).forEach(subCat => {
      const section = document.createElement('div');
      section.className = 'drink-group';
      const header = document.createElement('div');
      header.className = 'drink-header';
      header.innerHTML = `
        <div class="drink-header-title">${subCat}</div>
        <div class="toggle-icon">▼</div>
      `;
      const content = document.createElement('div');
      content.className = 'drink-content';

      grouped[subCat].forEach(p => {
        const div = document.createElement('div');
        div.className = 'item';
        div.style.animation = 'fadeIn .25s ease';
        div.innerHTML = `
          <div>
            <div class="item-name">${p.name}</div>
            <div class="small" style="opacity:.8">${p.description || ''}</div>
          </div>
          <div style="display:flex;gap:10px;align-items:center">
            <span class="price">${fmtCurrency(p.price)}</span>
            <span class="status ${p.available ? 'ok' : 'na'}">${p.available ? 'Available' : 'Not Available'}</span>
          </div>
        `;
        content.appendChild(div);
      });

      header.addEventListener('click', () => {
        const open = section.classList.toggle('open');
        content.style.maxHeight = open ? content.scrollHeight + 'px' : '0px';
        header.querySelector('.toggle-icon').textContent = open ? '▲' : '▼';
      });

      section.appendChild(header);
      section.appendChild(content);
      list.appendChild(section);
    });
  } else {
    // Regular food categories
    items.forEach(p => {
      const div = document.createElement('div');
      div.className = 'item';
      div.style.animation = 'fadeIn .25s ease';
      div.innerHTML = `
        <div style="display:flex;gap:10px;align-items:center">
          <div class="item-name">${p.name}</div>
        </div>
        <div style="display:flex;gap:10px;align-items:center">
          <span class="price">${fmtCurrency(p.price)}</span>
          <span class="status ${p.available ? 'ok' : 'na'}">${p.available ? 'Available' : 'Not Available'}</span>
        </div>
      `;
      list.appendChild(div);
    });
  }
}

// Event listeners
document.getElementById('searchInput').addEventListener('input', (e) => {
  state.search = e.target.value;
  renderItems();
});
document.getElementById('availabilityFilter').addEventListener('change', (e) => {
  state.availability = e.target.value;
  renderItems();
});
document.getElementById('year').textContent = new Date().getFullYear();

// Outlet selection logic
const overlay = document.getElementById('overlay');
const outletButtons = document.getElementById('outletButtons');
outletButtons.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const outlet = btn.getAttribute('data-outlet');
  overlay.style.display = 'none';
  loadDataForOutlet(outlet);
});
document.getElementById('changeOutletBtn').addEventListener('click', () => {
  document.getElementById('overlay').style.display = 'flex';
});

// Check saved outlet on load
window.addEventListener('DOMContentLoaded', () => {
  const chosen = localStorage.getItem('dw_outlet');
  if (chosen) {
    overlay.style.display = 'none';
    loadDataForOutlet(chosen);
  } else {
    overlay.style.display = 'flex';
  }
});
