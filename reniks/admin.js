const API = "../api/api.php";
function money(n){ return new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN'}).format(n); }

function token(){ return localStorage.getItem("adminToken"); }
function mustBeLoggedIn(){
  const t = token(), u = localStorage.getItem("adminUser");
  if (!t || !u) { location.href = "admin_login.html"; return false; }
  document.getElementById("adminTag").textContent = "Admin: " + u;
  document.getElementById("logout").onclick = (e)=>{ e.preventDefault(); localStorage.removeItem("adminToken"); localStorage.removeItem("adminUser"); location.href="admin_login.html"; };
  return true;
}
async function api(action, params={}, method="GET", needsToken=false){
  const url = new URL(API, window.location.href);
  url.searchParams.set("action", action);
  if (needsToken) url.searchParams.set("token", token());
  const opt = { method };
  if (method !== "GET") { opt.headers = {"Content-Type":"application/json"}; opt.body = JSON.stringify(params); }
  const res = await fetch(url.toString() + (method==="GET"?"&"+new URLSearchParams(params):""), opt);
  return res.json();
}

/* ---------- Products ---------- */
async function loadProducts(){
  const res = await api("list_products");
  const inv = await api("get_inventory");
  const wrap = document.getElementById("admin-products");
  wrap.innerHTML = "";
  if (!res.ok) { wrap.textContent="Failed to load."; return; }
  res.products.forEach(p=>{
    const div = document.createElement("div");
    div.className = "card";
    const qty = inv.ok ? (inv.inventory[p.id] || 0) : 0;
    div.innerHTML = `<h3>${p.name}</h3>
      <div class="small">ID: ${p.id} | Barcode: ${p.barcode||"-"}</div>
      <div>Price: ${money(p.price)} | Tax: ${(p.tax_rate||0)}</div>
      <div>Stock: <input type="number" value="${qty}" style="width:100px"/></div>
      <div style="display:flex; gap:8px; margin-top:8px;">
        <button class="save">Save</button>
        <button class="delete" style="background:#b00020">Delete</button>
      </div>`;
    div.querySelector(".save").onclick = async ()=>{
      const newQty = parseInt(div.querySelector("input").value||"0",10);
      await api("update_inventory", {id:p.id, qty:newQty}, "POST", true);
      alert("Updated");
    };
    div.querySelector(".delete").onclick = async ()=>{
      if (!confirm("Delete product?")) return;
      await api("delete_product", {id:p.id}, "POST", true);
      loadProducts();
    };
    wrap.appendChild(div);
  });
}
async function addProduct(e){
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd.entries());
  payload.price = parseFloat(payload.price);
  payload.tax_rate = payload.tax_rate ? parseFloat(payload.tax_rate) : 0;
  payload.stock = payload.stock ? parseInt(payload.stock,10) : 0;
  const res = await api("add_product", payload, "POST", true);
  if (!res.ok) alert(res.error||"Failed");
  e.target.reset();
  loadProducts();
}

/* ---------- Reports ---------- */
async function loadReport(){
  const from = document.getElementById("from").value || "";
  const to = document.getElementById("to").value || from || "";
  const res = await api("list_sales", {from, to});
  const wrap = document.getElementById("report");
  wrap.innerHTML = "";
  if (!res.ok) { wrap.textContent="Failed to load."; return; }
  let sub0=0,disc=0,sub=0,tax=0,tot=0,count=0;
  res.sales.forEach(s=>{ sub0+=s.subtotal_before_discount; disc+=s.discount_amount; sub+=s.subtotal; tax+=s.tax; tot+=s.total; count++; });
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<h3>Summary ${from?from:""} ${to?("to "+to):""}</h3>
    <div>Transactions: <strong>${count}</strong></div>
    <div>Subtotal (before discount): <strong>${money(sub0)}</strong></div>
    <div>Discounts: <strong>-${money(disc)}</strong></div>
    <div>Subtotal: <strong>${money(sub)}</strong></div>
    <div>Tax: <strong>${money(tax)}</strong></div>
    <div>Total: <strong>${money(tot)}</strong></div>`;
  wrap.appendChild(card);

  // list recent sales
  res.sales.slice(-10).reverse().forEach(s=>{
    const d = document.createElement("div");
    d.className = "card";
    d.innerHTML = `<div><strong>${s.id}</strong> — ${new Date(s.timestamp).toLocaleString()}</div>
      <div>Cashier: ${s.cashier||"-"} | Method: ${s.method}</div>
      <div>Total: ${money(s.total)} | Discount: -${money(s.discount_amount)}</div>`;
    wrap.appendChild(d);
  });
}
function downloadCSV(){
  const from = document.getElementById("from").value || "";
  const to = document.getElementById("to").value || from || "";
  const url = new URL(API, window.location.href);
  url.searchParams.set("action", "export_sales_csv");
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);
  url.searchParams.set("token", token());
  window.location.href = url.toString();
}

/* ---------- Cashier Management ---------- */
async function loadCashiers(){
  const res = await api("list_cashiers", {}, "GET", true);
  const wrap = document.getElementById("cashier-list");
  wrap.innerHTML = "";
  if (!res.ok) { wrap.textContent="Failed to load cashiers"; return; }
  res.cashiers.forEach(c=>{
    const row = document.createElement("div");
    row.className = "card";
    row.innerHTML = `<div><strong>${c.name}</strong> — PIN: ${c.pin} — ${c.active?"Active":"Inactive"}</div>
      <div style="margin-top:6px;">
        <button class="toggle">${c.active?"Deactivate":"Activate"}</button>
      </div>`;
    row.querySelector(".toggle").onclick = async ()=>{
      await api("set_cashier_active", {name:c.name, active:!c.active}, "POST", true);
      loadCashiers();
    };
    wrap.appendChild(row);
  });
}
async function addCashier(e){
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd.entries());
  payload.active = true;
  const res = await api("add_cashier", payload, "POST", true);
  if (!res.ok) alert(res.error||"Failed");
  e.target.reset();
  loadCashiers();
}

/* ---------- Boot ---------- */
document.addEventListener("DOMContentLoaded", ()=>{
  if (!mustBeLoggedIn()) return;
  document.getElementById("product-form").addEventListener("submit", addProduct);
  document.getElementById("cashier-form").addEventListener("submit", addCashier);
  document.getElementById("run").onclick = loadReport;
  document.getElementById("download").onclick = downloadCSV;

  // default to today
  const today = new Date().toISOString().slice(0,10);
  document.getElementById("from").value = today;
  document.getElementById("to").value = today;

  loadProducts();
  loadReport();
  loadCashiers();
});
