async function api(path,opt={}){
  const options={...opt,credentials:'include'};
  options.headers={Accept:'application/json',...(opt.headers||{})};
  const r=await fetch(`${APP.api}/${path}`,options);
  let d={}; try{d=await r.json()}catch{}
  if(r.status===401){location.href='login.html';throw Error('Unauthorized')}
  if(r.status===403)throw Error(d.message||'Forbidden');
  if(!r.ok)throw Error(d.message||'Request failed');
  return d;
}
const money=n=>'₦'+Number(n||0).toLocaleString('en-NG',{maximumFractionDigits:2});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function master(){let [a,b,c]=await Promise.all([api('staff/list.php'),api('sections/list.php'),api('services/list.php')]);return {staff:a.staff,sections:b.sections,services:c.services}}
function opts(a){return a.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}
function txTable(rows){return `<div class="table-wrap"><table><thead><tr><th>Date</th><th>ID</th><th>Service</th><th>Staff</th><th>Section</th><th>Price</th><th>Discount</th><th>Net</th><th>Payment</th></tr></thead><tbody>${rows.length?rows.map(x=>`<tr><td>${esc(x.date)}</td><td>${esc(x.id)}</td><td>${esc(x.service_name)}</td><td>${esc(x.staff_name)}</td><td>${esc(x.section_name)}</td><td>${money(x.original_price)}</td><td>${money(x.discount_amount)}</td><td><b>${money(x.final_amount)}</b></td><td>${esc(x.payment_method)}</td></tr>`).join(''):'<tr><td colspan="9">No records found.</td></tr>'}</tbody></table></div>`}
async function requireRole(role){const s=await api('auth/session.php');if(role&&s.user.role!==role){location.href=s.user.role==='admin'?'../admin/dashboard.html':'../frontdesk/dashboard.html';throw Error('Wrong portal')}return s.user}
async function doLogout(){await api('auth/logout.php',{method:'POST'});location.href='../index.html'}
