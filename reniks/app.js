const API = "https://paywiththunder.com/boutique/api/api.php";
let PRODUCTS = [];
let CART = [];

function money(n){ 
  return new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN'}).format(n); 
}

async function api(action, params={}, method="GET"){
  const url = new URL(API, window.location.href);
  url.searchParams.set("action", action);

  const opt = { method };

  if (method !== "GET") {
    // Send as form-urlencoded so PHP $_POST can read it
    opt.headers = {"Content-Type":"application/x-www-form-urlencoded"};
    opt.body = new URLSearchParams(params).toString();
  }

  const res = await fetch(
    url.toString() + (method==="GET" ? "&"+new URLSearchParams(params) : ""), 
    opt
  );

  return res.json();
}

function renderProducts(list){
  const wrap = document.getElementById("product-list");
  wrap.innerHTML = "";
  list.forEach(p => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `<h3>${p.name}</h3>
      <div class="price">${money(p.price)}</div>
      <div class="small">ID: ${p.id}</div>
      <button>Add</button>`;
    div.querySelector("button").onclick = () => addToCart(p.id, 1);
    wrap.appendChild(div);
  });
}

function addToCart(id, qty){
  const ex = CART.find(x=>x.id===id);
  if (ex) ex.qty += qty;
  else {
    const p = PRODUCTS.find(x=>x.id===id);
    if (!p) return;
    CART.push({id, qty: qty, price: p.price, name: p.name, tax_rate: p.tax_rate || 0});
  }
  renderCart();
}

function renderCart(){
  const wrap = document.getElementById("cart");
  wrap.innerHTML = "";
  if (CART.length===0){ wrap.textContent = "Cart is empty."; totals(); return; }
  const header = document.createElement("div");
  header.className = "row";
  header.innerHTML = "<strong>Item</strong><strong>Qty</strong><strong>Price</strong><strong>Total</strong><strong></strong>";
  wrap.appendChild(header);
  CART.forEach((it, idx)=>{
    const row = document.createElement("div");
    row.className = "row";
    const lineSub = it.price * it.qty;
    const lineTax = lineSub * (it.tax_rate||0);
    const lineTot = lineSub + lineTax;
    row.innerHTML = `
      <div>${it.name}</div>
      <div><input type="number" min="1" value="${it.qty}"/></div>
      <div>${money(it.price)}</div>
      <div>${money(lineTot)}</div>
      <div><button aria-label="remove">✕</button></div>
    `;
    row.querySelector("input").onchange = (e)=>{
      CART[idx].qty = Math.max(1, parseInt(e.target.value||"1",10));
      renderCart();
    };
    row.querySelector("button").onclick = ()=>{
      CART.splice(idx,1); renderCart();
    };
    wrap.appendChild(row);
  });
  totals();
}

function totals(){
  let sub=0, tax=0, tot=0;
  CART.forEach(it=>{
    const s = it.price*it.qty;
    const tx = s*(it.tax_rate||0);
    sub += s; tax += tx; tot += s+tx;
  });
  const discount = parseFloat(document.getElementById("discount").value || "0");
  const applied = Math.min(Math.max(0, discount), sub);
  const subAfter = sub - applied;
  const taxAfter = sub>0 ? tax * (subAfter/sub) : 0;
  const totalAfter = subAfter + taxAfter;

  document.getElementById("subtotal").textContent = money(sub);
  document.getElementById("discountLabel").textContent = "-" + money(applied);
  document.getElementById("tax").textContent = money(taxAfter);
  document.getElementById("total").textContent = money(totalAfter);
  return {sub, taxApprox: taxAfter, totApprox: totalAfter, discount: applied};
}

async function loadProducts(){
  const res = await api("list_products");
  if (!res.ok) { alert("Failed to load products"); return; }
  PRODUCTS = res.products;
  renderProducts(PRODUCTS);
}

function filterProducts(q){
  q = q.trim().toLowerCase();
  if (!q) return PRODUCTS;
  return PRODUCTS.filter(p => p.name.toLowerCase().includes(q) || (p.barcode||"").includes(q));
}

async function checkout(){
  const { discount } = totals();
  const paid = parseFloat(document.getElementById("paid").value || "0");
  const method = document.getElementById("method").value;
  const msg = document.getElementById("msg");
  msg.textContent = "";
  if (CART.length===0) { msg.textContent="Cart is empty."; return; }

  const token = localStorage.getItem("cashierToken");
  const cashierName = localStorage.getItem("cashierName");
  if (!token || !cashierName) { location.href = "pos_login.html"; return; }

  // IMPORTANT: stringify items so PHP receives it properly
  const payload = {
    token, 
    cashier_name: cashierName,
    items: JSON.stringify(CART.map(it=>({id:it.id, qty:it.qty}))),
    discount_amount: discount,
    paid, 
    method
  };

  const res = await api("record_sale", payload, "POST");
  if (!res.ok) { msg.textContent = res.error || "Failed"; return; }

  const change = paid - res.sale.total;
  document.getElementById("change").textContent = "Change: " + money(change);
  window.open("receipt.php?id=" + encodeURIComponent(res.sale.id), "_blank");
  CART = [];
  renderCart();
  document.getElementById("paid").value = "";
  document.getElementById("discount").value = "0";
  totals();
}

function ensureLogin(){
  const token = localStorage.getItem("cashierToken");
  const name = localStorage.getItem("cashierName");
  if (!token || !name) { location.href = "pos_login.html"; return; }
  document.getElementById("cashierTag").textContent = "Cashier: " + name;
  document.getElementById("logout").onclick = (e)=>{
    e.preventDefault(); 
    localStorage.removeItem("cashierToken"); 
    localStorage.removeItem("cashierName"); 
    location.href="pos_login.html"; 
  };
}

document.addEventListener("DOMContentLoaded", ()=>{
  ensureLogin();
  loadProducts();
  document.getElementById("search").addEventListener("input", (e)=>{ 
    renderProducts(filterProducts(e.target.value)); 
  });
  document.getElementById("btn-checkout").addEventListener("click", checkout);
  document.getElementById("discount").addEventListener("input", totals);
});
