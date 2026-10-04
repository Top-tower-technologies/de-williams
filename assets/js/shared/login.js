const form=document.querySelector('#loginForm'),msg=document.querySelector('#msg');
form.addEventListener('submit',async e=>{
  e.preventDefault(); msg.textContent='Signing in...';
  const body={username:form.username.value.trim(),password:form.password.value};
  try{
    const r=await fetch(`${APP.api}/auth/login.php`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(body)});
    const d=await r.json(); if(!r.ok)throw Error(d.message||'Login failed');
    const wanted=document.body.dataset.portal;
    if(d.user.role!==wanted){await fetch(`${APP.api}/auth/logout.php`,{method:'POST',credentials:'include'});throw Error(`This account belongs to the ${d.user.role==='admin'?'Admin':'Front Desk'} portal.`)}
    location.href='dashboard.html';
  }catch(x){msg.textContent=x.message}
});
