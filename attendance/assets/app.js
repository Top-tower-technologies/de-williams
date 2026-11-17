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
  if(btn.dataset.view!=="checkin") closeCheckinCamera();
}));
$("todayLabel").textContent = new Intl.DateTimeFormat("en-NG",{weekday:"short",day:"numeric",month:"long",year:"numeric"}).format(new Date());

async function loadPublicStaff() {
  try {
    const data=await api("staff.php");
    $("staffSelect").innerHTML='<option value="">Choose your name</option>'+data.staff.map(s=>`<option value="${s.id}"${s.face_enrolled?"":" disabled"}>${escapeHtml(s.name)}${s.face_enrolled?"":" (face not registered)"}</option>`).join("");
  } catch(e) { $("staffSelect").innerHTML='<option value="">Unable to load staff list</option>'; }
}
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
$("settingsForm").addEventListener("submit",async e=>{e.preventDefault();try{await api("admin.php?action=settings",{method:"POST",body:JSON.stringify({opening_time:$("openingTime").value,grace_minutes:Number($("graceMinutes").value),face_threshold:Number($("faceThreshold").value)})},true);showMessage($("settingsMessage"),"Attendance settings saved.");await loadDashboard();}catch(err){showMessage($("settingsMessage"),err.message,"error");}});
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
    $("attendanceRows").innerHTML=data.records.length?data.records.map(r=>`<tr><td>${r.date}</td><td>${escapeHtml(r.staff_name)}</td><td>${r.time}</td><td><span class="status ${r.status==="late"?"late":"on-time"}">${r.status==="late"?"Late":"On time"}</span></td><td>${r.minutes_late}</td><td>${r.photo?`<button class="view-photo-btn" data-file="${escapeHtml(r.photo)}" data-caption="${escapeHtml(r.staff_name)} · ${r.date} ${r.time}">View</button>`:"—"}</td></tr>`).join(""):'<tr><td colspan="6">No attendance records for this period.</td></tr>';
    lastRecords=data.records;
    $("staffList").innerHTML=data.staff.map(s=>`<div class="staff-item"><div class="staff-name"><span>${escapeHtml(s.name)}</span><span class="chip ${s.face_enrolled?"ok":"none"}">${s.face_enrolled?"Face registered":"No face"}</span></div><div class="staff-actions">${s.face_enrolled?`<button class="link-btn view-face-btn" data-id="${s.id}" data-name="${escapeHtml(s.name)}">View</button>`:""}<button class="link-btn face-btn" data-id="${s.id}" data-name="${escapeHtml(s.name)}">${s.face_enrolled?"Re-register":"Register face"}</button>${s.face_enrolled?`<button class="link-btn remove-face-btn" data-id="${s.id}" data-name="${escapeHtml(s.name)}">Remove face</button>`:""}<button class="remove-btn" data-id="${s.id}" data-name="${escapeHtml(s.name)}">Deactivate</button></div></div>`).join("")||'<p class="small-note">No staff registered.</p>';
    document.querySelectorAll(".remove-btn").forEach(b=>b.addEventListener("click",async()=>{if(!confirm(`Deactivate ${b.dataset.name}? Past attendance records will remain.`))return;try{await api(`admin.php?action=staff&id=${b.dataset.id}`,{method:"DELETE"},true);await loadDashboard();await loadPublicStaff();}catch(e){alert(e.message);}}));
    const settings=await api("admin.php?action=settings",{},true);
    $("openingTime").value=settings.settings.opening_time;$("graceMinutes").value=settings.settings.grace_minutes;
    const thr=Number(settings.settings.face_threshold),sel=$("faceThreshold");
    sel.value=[...sel.options].reduce((best,o)=>Math.abs(o.value-thr)<Math.abs(best.value-thr)?o:best).value;
  } catch(e) {
    if(e.message.toLowerCase().includes("unauthorized")){adminToken="";sessionStorage.removeItem("dw_admin_token");setAdminVisible(false);}
    else console.error(e);
  }
}
setAdminVisible(false);
if(adminToken){setAdminVisible(true);loadDashboard();}
loadPublicStaff();


/* =====================================================================
   Face verification (face-api.js, runs in the browser; the server makes
   the final accept/reject decision and keeps the reference data)
   ===================================================================== */
const MODEL_URL = "/attendance/assets/models";
const CHECKIN_LABEL = 'Verify face &amp; mark me present <span>→</span>';
let modelsReady = null;

function loadFaceModels() {
  if (typeof faceapi === "undefined") return Promise.reject(new Error("The face recognition library could not be loaded. Check your connection and refresh the page."));
  if (!modelsReady) {
    modelsReady = (async () => {
      if (faceapi.tf && faceapi.tf.ready) await faceapi.tf.ready();
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);
    })().catch(e => { modelsReady = null; throw new Error("Could not load the face recognition models. Check your connection and refresh the page."); });
  }
  return modelsReady;
}

async function startCamera(video) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("Camera is not available. Open this page over HTTPS in a modern browser.");
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
  video.srcObject = stream;
  await video.play();
  return stream;
}
function stopCamera(video) {
  const stream = video.srcObject;
  if (stream) stream.getTracks().forEach(t => t.stop());
  video.srcObject = null;
}
function cameraErrorMessage(e) {
  if (e && e.name === "NotAllowedError") return "Camera permission was denied. Allow camera access in your browser settings and try again.";
  if (e && (e.name === "NotFoundError" || e.name === "OverconstrainedError")) return "No camera was found on this device.";
  if (e && e.name === "NotReadableError") return "The camera is being used by another app. Close it and try again.";
  return (e && e.message) || "Could not start the camera.";
}

// Detects exactly one face in the live video and returns its descriptor plus a small snapshot.
async function captureFace(video, photoWidth) {
  if (!video.videoWidth) throw new Error("The camera is not ready yet. Please wait a moment.");
  const found = await faceapi
    .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors();
  if (!found.length) throw new Error("No face detected. Face the camera in good light and try again.");
  if (found.length > 1) throw new Error("More than one face detected. Only one person should be in view.");
  if (found[0].detection.box.width < video.videoWidth * 0.2) throw new Error("Move a little closer to the camera and try again.");
  const w = photoWidth, h = Math.round(video.videoHeight / video.videoWidth * w);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d").drawImage(video, 0, 0, w, h);
  return {
    descriptor: Array.from(found[0].descriptor).map(x => Math.round(x * 1e5) / 1e5),
    photo: canvas.toDataURL("image/jpeg", 0.75)
  };
}

/* ---------- Staff check-in ---------- */
let cameraReady = false, checkinSession = 0;
function updateCheckinButton() { $("checkinBtn").disabled = !(cameraReady && $("staffSelect").value); }
function closeCheckinCamera() {
  checkinSession++;
  stopCamera($("checkinVideo"));
  cameraReady = false;
  $("cameraBox").classList.add("hidden");
  $("cameraBtn").textContent = "Open camera";
  $("cameraBtn").disabled = false;
  updateCheckinButton();
}
async function openCheckinCamera() {
  const session = ++checkinSession, status = $("cameraStatus"), btn = $("cameraBtn");
  $("cameraBox").classList.remove("hidden");
  btn.disabled = true;
  showMessage($("checkinMessage"), "", "success");
  status.textContent = "Loading face recognition…";
  try {
    await loadFaceModels();
    if (session !== checkinSession) return;
    status.textContent = "Starting camera…";
    const stream = await startCamera($("checkinVideo"));
    if (session !== checkinSession) { stream.getTracks().forEach(t => t.stop()); return; }
    cameraReady = true;
    status.textContent = "Centre your face in the outline, then tap the button below.";
    btn.textContent = "Close camera";
  } catch (e) {
    if (session !== checkinSession) return;
    closeCheckinCamera();
    showMessage($("checkinMessage"), cameraErrorMessage(e), "error");
    return;
  }
  btn.disabled = false;
  updateCheckinButton();
}
$("cameraBtn").addEventListener("click", () => cameraReady ? closeCheckinCamera() : openCheckinCamera());
$("staffSelect").addEventListener("change", updateCheckinButton);

$("checkinBtn").addEventListener("click", async () => {
  const id = $("staffSelect").value, msg = $("checkinMessage"), btn = $("checkinBtn");
  if (!id) return showMessage(msg, "Please select your name.", "error");
  if (!cameraReady) return showMessage(msg, "Open the camera first.", "error");
  btn.disabled = true; btn.textContent = "Verifying face…";
  showMessage(msg, "", "success");
  let done = false;
  try {
    const cap = await captureFace($("checkinVideo"), 320);
    const data = await api("attendance.php", { method: "POST", body: JSON.stringify({ staff_id: Number(id), descriptor: cap.descriptor, photo: cap.photo }) });
    const r = data.attendance;
    const time = new Date(r.checked_in_at).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: true });
    if (data.already_checked_in) showMessage(msg, `Your attendance was already recorded today at ${time}.`, "success");
    else if (r.status === "late") showMessage(msg, `Face verified. Attendance recorded at ${time}. You are late by ${r.minutes_late} minute(s). Please endeavour to arrive on time.`, "error");
    else showMessage(msg, `Face verified. Attendance recorded at ${time}. You are present and on time.`, "success");
    done = true;
  } catch (e) { showMessage(msg, e.message, "error"); }
  finally { btn.innerHTML = CHECKIN_LABEL; if (done) closeCheckinCamera(); else updateCheckinButton(); }
});

/* ---------- Admin: register a staff member's face ---------- */
let enrollStaff = null, enrollSamples = [], enrollReady = false, enrollSession = 0;
function renderSamples() {
  $("sampleStrip").innerHTML = enrollSamples.map((s, i) => `<div class="sample"><img src="${s.photo}" alt="Sample ${i + 1}"><button type="button" data-i="${i}" aria-label="Remove sample ${i + 1}">×</button></div>`).join("");
  $("captureSampleBtn").textContent = `Capture sample (${enrollSamples.length}/3)`;
  $("captureSampleBtn").disabled = !enrollReady || enrollSamples.length >= 3;
  $("saveFaceBtn").disabled = !enrollSamples.length;
}
$("sampleStrip").addEventListener("click", e => {
  const b = e.target.closest("button[data-i]");
  if (!b) return;
  enrollSamples.splice(Number(b.dataset.i), 1);
  renderSamples();
});
function closeFaceModal() {
  enrollSession++;
  stopCamera($("enrollVideo"));
  enrollReady = false; enrollStaff = null; enrollSamples = [];
  $("faceModal").classList.add("hidden");
}
async function openFaceModal(id, name) {
  const session = ++enrollSession, st = $("enrollStatus");
  enrollStaff = { id, name }; enrollSamples = []; enrollReady = false;
  $("faceModalTitle").textContent = `Register face · ${name}`;
  showMessage($("faceModalMessage"), "", "success");
  $("faceModal").classList.remove("hidden");
  renderSamples();
  st.textContent = "Loading face recognition…";
  try {
    await loadFaceModels();
    if (session !== enrollSession) return;
    st.textContent = "Starting camera…";
    const stream = await startCamera($("enrollVideo"));
    if (session !== enrollSession) { stream.getTracks().forEach(t => t.stop()); return; }
    enrollReady = true;
    st.textContent = "Ask the staff member to look at the camera, then capture.";
  } catch (e) {
    if (session !== enrollSession) return;
    st.textContent = "";
    showMessage($("faceModalMessage"), cameraErrorMessage(e), "error");
  }
  renderSamples();
}
$("captureSampleBtn").addEventListener("click", async () => {
  const btn = $("captureSampleBtn");
  btn.disabled = true; btn.textContent = "Scanning…";
  try {
    enrollSamples.push(await captureFace($("enrollVideo"), 400));
    showMessage($("faceModalMessage"), "", "success");
  } catch (e) { showMessage($("faceModalMessage"), e.message, "error"); }
  renderSamples();
});
$("saveFaceBtn").addEventListener("click", async () => {
  if (!enrollStaff || !enrollSamples.length) return;
  const btn = $("saveFaceBtn");
  btn.disabled = true; btn.textContent = "Saving…";
  try {
    await api("admin.php?action=face", { method: "POST", body: JSON.stringify({ staff_id: enrollStaff.id, descriptors: enrollSamples.map(s => s.descriptor), photo: enrollSamples[0].photo }) }, true);
    closeFaceModal();
    await loadDashboard(); await loadPublicStaff();
  } catch (e) { showMessage($("faceModalMessage"), e.message, "error"); }
  finally { btn.textContent = "Save face"; renderSamples(); }
});
$("faceModalClose").addEventListener("click", closeFaceModal);

/* ---------- Admin: view saved photos ---------- */
async function showPhoto(file, title, caption) {
  $("photoModalTitle").textContent = title;
  $("photoModalCaption").textContent = caption || "";
  $("photoModalImg").removeAttribute("src");
  $("photoModal").classList.remove("hidden");
  try {
    const res = await fetch(apiUrl(`admin.php?action=photo&file=${encodeURIComponent(file)}`), { headers: { Authorization: `Bearer ${adminToken}` }, cache: "no-store" });
    if (!res.ok) throw new Error("Photo not available.");
    $("photoModalImg").src = URL.createObjectURL(await res.blob());
  } catch (e) { $("photoModalCaption").textContent = e.message; }
}
function closePhotoModal() {
  const img = $("photoModalImg");
  if (img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
  img.removeAttribute("src");
  $("photoModal").classList.add("hidden");
}
$("photoModalClose").addEventListener("click", closePhotoModal);
$("attendanceRows").addEventListener("click", e => {
  const b = e.target.closest(".view-photo-btn");
  if (b) showPhoto(b.dataset.file, "Check-in photo", b.dataset.caption);
});
$("staffList").addEventListener("click", async e => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.classList.contains("face-btn")) openFaceModal(Number(b.dataset.id), b.dataset.name);
  else if (b.classList.contains("view-face-btn")) showPhoto(`enroll_${b.dataset.id}.jpg`, "Registered face", b.dataset.name);
  else if (b.classList.contains("remove-face-btn")) {
    if (!confirm(`Remove the registered face for ${b.dataset.name}? They cannot check in until a new face is registered.`)) return;
    try { await api(`admin.php?action=face&id=${b.dataset.id}`, { method: "DELETE" }, true); await loadDashboard(); await loadPublicStaff(); }
    catch (err) { alert(err.message); }
  }
});
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (!$("faceModal").classList.contains("hidden")) closeFaceModal();
  if (!$("photoModal").classList.contains("hidden")) closePhotoModal();
});
