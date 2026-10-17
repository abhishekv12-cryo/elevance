const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let token = localStorage.getItem("elevance_token");
let me = null;
let socket;

const I18N = {
  en:{home:"Dashboard",questions:"Questions",social:"Social",plans:"Plans",profile:"Profile",welcome:"Welcome",points:"Points",friends:"Friends",plan:"Plan"},
  es:{home:"Panel",questions:"Preguntas",social:"Social",plans:"Planes",profile:"Perfil",welcome:"Bienvenido",points:"Puntos",friends:"Amigos",plan:"Plan"},
  hi:{home:"डैशबोर्ड",questions:"प्रश्न",social:"सोशल",plans:"प्लान",profile:"प्रोफ़ाइल",welcome:"स्वागत है",points:"अंक",friends:"मित्र",plan:"प्लान"},
  pt:{home:"Painel",questions:"Perguntas",social:"Social",plans:"Planos",profile:"Perfil",welcome:"Bem-vindo",points:"Pontos",friends:"Amigos",plan:"Plano"},
  zh:{home:"仪表板",questions:"问题",social:"社交",plans:"套餐",profile:"资料",welcome:"欢迎",points:"积分",friends:"好友",plan:"套餐"},
  fr:{home:"Tableau",questions:"Questions",social:"Social",plans:"Plans",profile:"Profil",welcome:"Bienvenue",points:"Points",friends:"Amis",plan:"Plan"}
};

function toast(msg, bad=false){ const t=document.createElement("div");t.className="toast";t.textContent=msg;if(bad)t.classList.add("error");document.body.appendChild(t);setTimeout(()=>t.remove(),3200); }
async function api(url, options={}) {
  options.headers = {...(options.headers||{}), ...(token?{Authorization:`Bearer ${token}`}:{})};
  const r=await fetch(url,options); const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.error||"Request failed");
  return data;
}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
function lang(){return I18N[me?.language||"en"]||I18N.en;}

async function boot(){
  if(!token){showAuth();return}
  try { const x=await api("/api/me"); me=x.user; showApp(); render("home"); }
  catch { localStorage.removeItem("elevance_token"); token=null; showAuth(); }
}
function showAuth(){ $("#authPage").classList.remove("hidden");$("#appPage").classList.add("hidden");$("#nav").classList.add("hidden");}
function showApp(){ $("#authPage").classList.add("hidden");$("#appPage").classList.remove("hidden");$("#nav").classList.remove("hidden"); }
function saveLogin(x){token=x.token;localStorage.setItem("elevance_token",token);me=x.user;showApp();render("home");}

$("#loginTab").onclick=()=>{$("#loginTab").classList.add("active");$("#registerTab").classList.remove("active");$("#loginForm").classList.remove("hidden");$("#registerForm").classList.add("hidden")};
$("#registerTab").onclick=()=>{$("#registerTab").classList.add("active");$("#loginTab").classList.remove("active");$("#registerForm").classList.remove("hidden");$("#loginForm").classList.add("hidden")};

$("#loginForm").onsubmit=async e=>{
 e.preventDefault();
 try{
  const body={email:$("#loginEmail").value,password:$("#loginPassword").value};
  if($("#loginOtp").value) body.otp=$("#loginOtp").value;
  const x=await api("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  if(x.otpRequired){$("#loginOtp").hidden=false;toast("OTP sent. In development check the server console.");return}
  saveLogin(x);
 }catch(err){toast(err.message,true)}
};
$("#registerForm").onsubmit=async e=>{
 e.preventDefault();
 try{const x=await api("/api/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:$("#regName").value,email:$("#regEmail").value,phone:$("#regPhone").value,password:$("#regPassword").value})});saveLogin(x)}
 catch(err){toast(err.message,true)}
};
$("#forgotLink").onclick=()=>openForgot();
$("#logout").onclick=()=>{localStorage.removeItem("elevance_token");token=null;me=null;showAuth()};

$$("[data-page]").forEach(b=>b.onclick=()=>render(b.dataset.page));

async function render(page){
 const T=lang();
 if(page==="home") $("#pageContent").innerHTML=`
 <div class="page-head"><div><p class="eyebrow">REAL TIME COMMUNITY</p><h2>${T.welcome}, ${esc(me.name)} 👋</h2><p class="muted">Your community activity at a glance.</p></div></div>
 <div class="grid">
  <div class="stat"><span class="muted">${T.points}</span><strong>${me.points}</strong></div>
  <div class="stat"><span class="muted">${T.friends}</span><strong>${me.friends}</strong></div>
  <div class="stat"><span class="muted">${T.plan}</span><strong>${esc(me.plan)}</strong></div>
 </div>
 <div class="card" style="margin-top:16px"><h3>Quick actions</h3><div class="actions">
 <button class="primary" onclick="render('questions')">Ask a question</button><button class="secondary" onclick="render('social')">Open social feed</button><button class="secondary" onclick="render('profile')">View login history</button></div></div>`;
 if(page==="questions") await questionsPage();
 if(page==="social") await socialPage();
 if(page==="plans") await plansPage();
 if(page==="profile") await profilePage();
}
async function questionsPage(){
 const q=await api("/api/questions");
 $("#pageContent").innerHTML=`<div class="page-head"><div><h2>Questions & Answers</h2><p class="muted">Daily limit: ${me.plan==="Gold"?"Unlimited":questionLimit(me.plan)} question(s).</p></div><button class="primary" onclick="newQuestion()">+ Ask question</button></div>
 <div id="questionList">${q.map(questionHTML).join("")||'<div class="card muted">No questions yet.</div>'}</div>`;
}
function questionLimit(p){return {Free:1,Bronze:5,Silver:10,Gold:"∞"}[p]||1}
function questionHTML(q){return `<div class="question"><div class="post-head"><div><h3>${esc(q.title)}</h3><p class="muted">by ${esc(q.author?.name||"User")} · ${new Date(q.createdAt).toLocaleString()}</p></div></div><p>${esc(q.body)}</p>${q.answers.map(a=>`<div class="answer"><b>${esc(a.author?.name||"User")}</b><p>${esc(a.body)}</p><div class="actions"><button onclick="voteAnswer('${a.id}','up')">👍 ${a.upvotes}</button><button onclick="voteAnswer('${a.id}','down')">👎 ${a.downvotes}</button>${a.userId===me.id?`<button onclick="removeAnswer('${a.id}')">Remove</button>`:""}</div></div>`).join("")}<form onsubmit="answerQuestion(event,'${q.id}')"><textarea name="body" placeholder="Write an answer..." required></textarea><button class="secondary">Answer (+5 points)</button></form></div>`}
window.newQuestion=()=>showModal(`<h2>Ask a question</h2><form id="qForm"><input name="title" placeholder="Question title" required><textarea name="body" placeholder="Describe your question" required></textarea><button class="primary">Post question</button></form>`);
document.addEventListener("submit",async e=>{if(e.target.id==="qForm"){e.preventDefault();try{const f=new FormData(e.target);await api("/api/questions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:f.get("title"),body:f.get("body")})});closeModal();toast("Question posted");await refreshMe();render("questions")}catch(err){toast(err.message,true)}}});
window.answerQuestion=async(e,id)=>{e.preventDefault();const body=e.target.body.value;try{await api(`/api/questions/${id}/answers`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({body})});toast("+5 points awarded");await refreshMe();render("questions")}catch(err){toast(err.message,true)}};
window.voteAnswer=async(id,type)=>{try{await api(`/api/answers/${id}/vote`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type})});await refreshMe();render("questions")}catch(err){toast(err.message,true)}};
window.removeAnswer=async id=>{try{await api(`/api/answers/${id}`,{method:"DELETE"});await refreshMe();render("questions")}catch(err){toast(err.message,true)}};

async function socialPage(){
 const posts=await api("/api/posts");
 $("#pageContent").innerHTML=`<div class="page-head"><div><h2>Public Social Space</h2><p class="muted">Friends: ${me.friends}. Posting limit depends on your connections.</p></div></div>
 <div class="card"><form id="postForm"><textarea name="text" placeholder="Share something with the community..."></textarea><input name="media" type="file" accept="image/*,video/*"><button class="primary">Publish post</button></form></div>
 <div id="feed">${posts.map(postHTML).join("")||'<div class="card muted" style="margin-top:16px">No posts yet. Add a friend to start posting.</div>'}</div>`;
 $("#postForm").onsubmit=async e=>{e.preventDefault();try{await api("/api/posts",{method:"POST",body:new FormData(e.target)});toast("Post published");await socialPage()}catch(err){toast(err.message,true)}};
}
function postHTML(p){return `<div class="post"><div class="post-head"><div><b>${esc(p.author?.name||"User")}</b><div class="muted">${new Date(p.createdAt).toLocaleString()}</div></div><span class="pill">${p.likes.length} likes</span></div><p>${esc(p.text)}</p>${p.media?(p.mediaType==="video"?`<video controls src="${p.media}"></video>`:`<img src="${p.media}" alt="uploaded media">`):""}<div class="actions"><button onclick="likePost('${p.id}')">❤️ Like</button><button onclick="sharePost('${p.id}')">↗ Share (${p.shares})</button></div>${p.comments.map(c=>`<div class="comment"><b>${esc(c.author?.name||"User")}</b> ${esc(c.text)}</div>`).join("")}<form onsubmit="commentPost(event,'${p.id}')"><input name="text" placeholder="Comment..." required></form></div>`}
window.likePost=async id=>{try{await api(`/api/posts/${id}/like`,{method:"POST"});socialPage()}catch(err){toast(err.message,true)}};
window.sharePost=async id=>{try{const x=await api(`/api/posts/${id}/share`,{method:"POST"});toast(`Shared. Total shares: ${x.shares}`);socialPage()}catch(err){toast(err.message,true)}};
window.commentPost=async(e,id)=>{e.preventDefault();try{await api(`/api/posts/${id}/comments`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:e.target.text.value})});socialPage()}catch(err){toast(err.message,true)}};

async function plansPage(){
 const plans=await api("/api/plans");
 $("#pageContent").innerHTML=`<div class="page-head"><div><h2>Subscription Plans</h2><p class="muted">Payments are restricted to 10:00–11:00 AM IST as required.</p></div></div><div class="grid">${plans.map(p=>`<div class="card plan"><h3>${p.id}</h3><div class="price">₹${p.price}<small>/month</small></div><ul><li>${p.limit} questions/day</li><li>Server-side limit</li><li>Invoice email</li></ul>${p.id==="Free"?`<span class="pill">${me.plan==="Free"?"Current plan":"Free"}</span>`:`<button class="primary" onclick="subscribe('${p.id}')">${me.plan===p.id?"Current plan":"Subscribe"}</button>`}</div>`).join("")}</div>`;
}
window.subscribe=async plan=>{try{const x=await api("/api/subscribe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({plan})});me=x.user;toast(x.message);render("plans")}catch(err){toast(err.message,true)}};

async function profilePage(){
 const x=await api("/api/me");
 const users=await api("/api/users?q=");
 $("#pageContent").innerHTML=`<div class="page-head"><div><h2>Profile</h2><p class="muted">Account, rewards, friends and security history.</p></div></div>
 <div class="grid two">
  <div class="card"><h3>${esc(me.name)}</h3><p>${esc(me.email)}</p><p>${esc(me.phone)}</p><div class="actions"><span class="pill">${me.points} points</span><span class="pill">${me.friends} friends</span><span class="pill">${me.plan}</span></div>
  <hr style="border-color:#203851;margin:20px 0"><h3>Language</h3><div class="lang">${Object.entries({en:"English",es:"Spanish",hi:"Hindi",pt:"Portuguese",zh:"Chinese",fr:"French"}).map(([k,v])=>`<button onclick="changeLanguage('${k}')">${v}</button>`).join("")}</div>
  <hr style="border-color:#203851;margin:20px 0"><h3>Transfer points</h3><form id="transferForm"><select name="userId">${users.map(u=>`<option value="${u.id}">${esc(u.name)} — ${esc(u.email)}</option>`).join("")}</select><input name="amount" type="number" min="1" placeholder="Points" required><button class="primary">Transfer</button></form></div>
  <div class="card"><h3>Login history</h3><div class="table-wrap"><table class="table"><thead><tr><th>Time</th><th>Browser</th><th>OS</th><th>Device</th><th>IP</th></tr></thead><tbody>${x.loginHistory.map(l=>`<tr><td>${new Date(l.at).toLocaleString()}</td><td>${esc(l.browser)}</td><td>${esc(l.os)}</td><td>${esc(l.device)}</td><td>${esc(l.ip)}</td></tr>`).join("")||"<tr><td colspan='5'>No history yet</td></tr>"}</tbody></table></div></div>
 </div>
 <div class="card" style="margin-top:16px"><h3>Find users & make friends</h3><div class="actions">${users.map(u=>`<button class="secondary" onclick="addFriend('${u.id}')">${esc(u.name)} · Add friend</button>`).join("")||"<span class='muted'>No other users found.</span>"}</div></div>`;
 $("#transferForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{const x=await api("/api/points/transfer",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:f.get("userId"),amount:Number(f.get("amount"))})});me=x.user;toast(x.message);profilePage()}catch(err){toast(err.message,true)}};
}
window.addFriend=async id=>{try{const x=await api(`/api/friends/${id}`,{method:"POST"});me=x.user;toast("Friend added");profilePage()}catch(err){toast(err.message,true)}};
window.changeLanguage=async language=>{if(language===me.language)return;try{const x=await api("/api/language/request",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({language})});if(x.direct){me.language=language;render("profile");return}showModal(`<h2>Verify language change</h2><p>OTP sent via ${x.channel}. In development, check the server console.</p><form id="langForm"><input name="otp" placeholder="6-digit OTP" required><button class="primary">Verify & switch</button></form>`);$("#langForm").onsubmit=async e=>{e.preventDefault();try{const r=await api("/api/language/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({language,otp:e.target.otp.value})});me=r.user;closeModal();toast("Language changed");render("profile")}catch(err){toast(err.message,true)}}}catch(err){toast(err.message,true)}};

function openForgot(){showModal(`<h2>Forgot password</h2><p class="muted">Use your registered email or phone. Only one request is allowed per day.</p><form id="forgotForm"><input name="identifier" placeholder="Email or phone" required><button class="primary">Request reset OTP</button></form><div id="resetArea"></div>`);$("#forgotForm").onsubmit=async e=>{e.preventDefault();try{const x=await api("/api/forgot-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({identifier:e.target.identifier.value})});$("#resetArea").innerHTML=`<p class="success">${x.message}</p><form id="resetForm"><input name="otp" placeholder="OTP" required><input name="password" placeholder="New letters-only password (optional)"><button type="button" class="secondary" id="genPwd">Generate password</button><button class="primary">Reset password</button></form>`;$("#genPwd").onclick=async()=>{const p=await api("/api/password-generator");$("#resetForm [name=password]").value=p.password};$("#resetForm").onsubmit=async ev=>{ev.preventDefault();try{const f=new FormData(ev.target);const r=await api("/api/reset-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:x.userId,otp:f.get("otp"),password:f.get("password")||undefined})});toast(r.message);closeModal()}catch(err){toast(err.message,true)}}}catch(err){toast(err.message,true)}}}
function showModal(html){$("#modalContent").innerHTML=html;$("#modal").classList.remove("hidden")}
function closeModal(){$("#modal").classList.add("hidden");$("#modalContent").innerHTML=""}
$("#closeModal").onclick=closeModal;
async function refreshMe(){const x=await api("/api/me");me=x.user}

socket=io();
socket.on("new-post",()=>{if(!$("#appPage").classList.contains("hidden") && location.hash==="#social") socialPage().catch(()=>{})});
window.addEventListener("hashchange",()=>{const p=location.hash.slice(1)||"home";if(token)render(p)});

boot();
