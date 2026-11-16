// Change this to the URL where the PHP API is hosted.
const API_BASE = "https://www.toptowertechnologies.com/attendance/api";
const $ = (id) => document.getElementById(id);
let adminToken = sessionStorage.getItem("dw_admin_token") || "";
let lastRecords = [];

function apiUrl(path) { return `${API_BASE}/${path}`; }
async function api(path, options = {}, admin = false) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (admin && adminToken) headers.Authorization = `Bearer ${adminToken}`;
  const response = await fetch(apiUrl(path), { ...options, headers });
  const data = await response.json().catch(() => ({success:false,message:"Invalid API response"}));
  if (!response.ok || data.success === false) throw new Error(data.message || "Request failed");
  return data;
}
function showMessage(el, message, type="success") { el.textContent=message; el.className=`message ${type}`; }
function dateString(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function periodDates() {
  const now = new Date(), mode=$("periodSelect").value;
  if(mode==="custom") return {from:$("fromDate").value,to:$("toDate").value};
  if(mode==="week") { const d=new Date(now); const day=(d.getDay()+6)%7; d.setDate(d.getDate()-day); return {from:dateString(d),to:dateString(now)}; }
  if(mode==="month") return {from:`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`,to:dateString(now)};
  return {from:"2000-01-01",to:dateString(now)};
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b===btn));
  $("checkinView").classList.toggle("hidden",btn.dataset.view!=="checkin");
  $("adminView").classList.toggle("hidden",btn.dataset.view!=="admin");
}));
$("todayLabel").textContent = new Intl.DateTimeFormat("en-NG",{weekday:"short",day:"numeric",month:"long",year:"numeric"}).format(new Date());

async function loadPublicStaff() {
  try {
    const data=await api("staff.php");
    $("staffSelect").innerHTML='<option value="">Choose your name</option>'+data.staff.map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
  } catch(e) { $("staffSelect").innerHTML='<option value="">Unable to load staff list</option>'; }
}
$("checkinBtn").addEventListener("click",async()=>{
  const id=$("staffSelect").value, msg=$("checkinMessage");
  if(!id) return showMessage(msg,"Please select your registered name.","error");
  $("checkinBtn").disabled=true; $("checkinBtn").textContent="Recording…";
  try {
    const data=await api("attendance.php",{method:"POST",body:JSON.stringify({staff_id:Number(id)})});
    const r=data.attendance;
    const time=new Date(r.checked_in_at).toLocaleTimeString("en-NG",{hour:"2-digit",minute:"2-digit",hour12:true});
    if(r.status==="late") showMessage(msg,`Attendance recorded at ${time}. You are late by ${r.minutes_late} minute(s). Please endeavour to arrive on time.`, "error");
    else showMessage(msg,`Attendance recorded at ${time}. You are present and on time.`, "success");
  } catch(e) { showMessage(msg,e.message,"error"); }
  finally { $("checkinBtn").disabled=false; $("checkinBtn").innerHTML='Mark me present <span>→</span>'; }
});

function setAdminVisible(yes) { $("loginPanel").classList.toggle("hidden",yes); $("adminPanel").classList.toggle("hidden",!yes); }
async function login(password) {
  const data=await api("login.php",{method:"POST",body:JSON.stringify({password})});
  adminToken=data.token; sessionStorage.setItem("dw_admin_token",adminToken); setAdminVisible(true); await loadDashboard();
}
$("loginForm").addEventListener("submit",async e=>{e.preventDefault();try{await login($("adminPassword").value);showMessage($("loginMessage"),"Signed in.");}catch(err){showMessage($("loginMessage"),err.message,"error");}});
$("logoutBtn").addEventListener("click",()=>{adminToken="";sessionStorage.removeItem("dw_admin_token");setAdminVisible(false);});
$("periodSelect").addEventListener("change",()=>$("customDates").classList.toggle("hidden",$("periodSelect").value!=="custom"));
$("applyFilter").addEventListener("click",loadDashboard);
$("addStaffForm").addEventListener("submit",async e=>{e.preventDefault();try{await api("admin.php?action=staff",{method:"POST",body:JSON.stringify({name:$("newStaffName").value.trim()})},true);$("newStaffName").value="";await loadDashboard();await loadPublicStaff();}catch(err){alert(err.message);}});
$("settingsForm").addEventListener("submit",async e=>{e.preventDefault();try{await api("admin.php?action=settings",{method:"POST",body:JSON.stringify({opening_time:$("openingTime").value,grace_minutes:Number($("graceMinutes").value)})},true);showMessage($("settingsMessage"),"Attendance settings saved.");await loadDashboard();}catch(err){showMessage($("settingsMessage"),err.message,"error");}});
$("exportBtn").addEventListener("click",()=>{
  const rows=[["Date","Staff","Check-in","Status","Minutes late"],...lastRecords.map(r=>[r.date,r.staff_name,r.time,r.status,r.minutes_late])];
  const csv=rows.map(row=>row.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\r\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="dewilliams-attendance.csv";a.click();URL.revokeObjectURL(a.href);
});
async function loadDashboard() {
  try {
    const range=periodDates();
    const q=new URLSearchParams({action:"dashboard",from:range.from,to:range.to});
    const data=await api(`admin.php?${q}`,{},true);
    $("statStaff").textContent=data.summary.staff_count;
    $("statPresent").textContent=data.summary.present_count;
    $("statLate").textContent=data.summary.late_count;
    $("statAverage").textContent=data.summary.average_minutes_late;
    $("periodCaption").textContent=`${range.from} to ${range.to}`;
    $("staffSummary").innerHTML=data.staff_summary.length?data.staff_summary.map(s=>`<tr><td><strong>${escapeHtml(s.name)}</strong></td><td>${s.present_count}</td><td>${s.late_count}</td><td>${s.late_rate}%</td><td>${s.total_minutes_late}</td></tr>`).join(""):'<tr><td colspan="5">No attendance records for this period.</td></tr>';
    $("attendanceRows").innerHTML=data.records.length?data.records.map(r=>`<tr><td>${r.date}</td><td>${escapeHtml(r.staff_name)}</td><td>${r.time}</td><td><span class="status ${r.status==="late"?"late":"on-time"}">${r.status==="late"?"Late":"On time"}</span></td><td>${r.minutes_late}</td></tr>`).join(""):'<tr><td colspan="5">No attendance records for this period.</td></tr>';
    lastRecords=data.records;
    $("staffList").innerHTML=data.staff.map(s=>`<div class="staff-item"><span>${escapeHtml(s.name)}</span><button class="remove-btn" data-id="${s.id}" data-name="${escapeHtml(s.name)}">Deactivate</button></div>`).join("")||'<p class="small-note">No staff registered.</p>';
    document.querySelectorAll(".remove-btn").forEach(b=>b.addEventListener("click",async()=>{if(!confirm(`Deactivate ${b.dataset.name}? Past attendance records will remain.`))return;try{await api(`admin.php?action=staff&id=${b.dataset.id}`,{method:"DELETE"},true);await loadDashboard();await loadPublicStaff();}catch(e){alert(e.message);}}));
    const settings=await api("admin.php?action=settings",{},true);
    $("openingTime").value=settings.settings.opening_time;$("graceMinutes").value=settings.settings.grace_minutes;
  } catch(e) {
    if(e.message.toLowerCase().includes("unauthorized")){adminToken="";sessionStorage.removeItem("dw_admin_token");setAdminVisible(false);}
    else console.error(e);
  }
}
setAdminVisible(false);
if(adminToken){setAdminVisible(true);loadDashboard();}
loadPublicStaff();
