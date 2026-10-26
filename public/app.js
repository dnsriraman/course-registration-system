const $ = selector => document.querySelector(selector);
const colors = [['#eeeaff','#7662df','⌘'],['#e8f3ff','#5591db','▤'],['#e5f7f1','#36a981','◈'],['#fff2e5','#dc9a4d','⌁']];
const avatarColors = [['#eeeaff','#735ce0'],['#e6f4ff','#4387c5'],['#fff0e7','#c77948'],['#e7f7ee','#3b9874'],['#fcebf2','#c25f85']];
let coursesCache = [], toastTimer, adminSignedIn = false;
$('#today-label').textContent = new Intl.DateTimeFormat(undefined, {weekday:'short',month:'short',day:'numeric',year:'numeric'}).format(new Date());

async function request(url, options) {
  const response = await fetch(url, options), data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request could not be completed.');
  return data;
}
function setConnection(ok, message) {
  const alert = $('#connection-alert'); alert.classList.add('show'); alert.classList.toggle('connected', ok);
  $('#connection-text').textContent = message;
  $('#db-footer').textContent = ok ? `MySQL connected · ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}` : 'Database connection needs attention';
  $('#retry-button').hidden = ok;
}
function esc(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function initials(name) { return name.split(/\s+/).slice(0,2).map(part => part[0]).join('').toUpperCase(); }
function ago(value) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (mins < 1) return 'Just now'; if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(new Date(value));
}
function fillCourseOptions() {
  const select = $('#course-select'), old = select.value;
  select.innerHTML = '<option value="">Choose a course</option>' + coursesCache.map(c => `<option value="${c.id}" ${Number(c.available) <= 0 ? 'disabled' : ''}>${esc(c.code)} · ${esc(c.title)} (${c.available} seats left)</option>`).join('');
  if (old) select.value = old;
}
function renderCourses(rows) {
  coursesCache = rows; $('#nav-course-count').textContent = rows.length;
  if (!rows.length) { $('#courses-list').innerHTML = '<div class="loading-row">No courses yet.</div>'; return; }
  $('#courses-list').innerHTML = rows.map((c,i) => {
    const [bg,fg,icon] = colors[i % colors.length], percent = Math.min(100,Math.round(Number(c.enrolled)/Number(c.capacity)*100));
    return `<div class="course-row"><div class="course-name"><span class="course-symbol" style="background:${bg};color:${fg}">${icon}</span><span><strong>${esc(c.title)}</strong><small>${esc(c.code)} · ${esc(c.instructor)}</small></span></div><div class="progress-wrap"><div class="progress-meta"><span>${c.enrolled} enrolled</span><span>${percent}%</span></div><div class="progress-track"><div class="progress-bar ${percent>=85?'warn':''}" style="width:${percent}%"></div></div></div><div class="course-total">${c.available}<span style="color:#a4a7b4;font-weight:400"> left</span></div></div>`;
  }).join(''); fillCourseOptions();
}
function renderActivity(rows) {
  if (!rows.length) { $('#activity-list').innerHTML = '<div class="loading-row">No enrollments yet. Add the first one!</div>'; return; }
  $('#activity-list').innerHTML = rows.map((r,i) => {
    const [bg,fg] = avatarColors[i % avatarColors.length];
    return `<div class="activity-row"><span class="activity-avatar" style="background:${bg};color:${fg}">${esc(initials(r.studentName))}</span><span class="activity-info"><strong>${esc(r.studentName)}</strong><small>${esc(r.studentCode)} · ${esc(r.courseTitle)}</small></span><span class="activity-time">${esc(ago(r.registeredAt))}</span><button class="drop-button" data-student="${r.studentId}" data-course="${r.courseId}" data-name="${esc(r.studentName)}" data-title="${esc(r.courseTitle)}" aria-label="Unenroll ${esc(r.studentName)} from ${esc(r.courseTitle)}" title="Unenroll student">Unenroll</button></div>`;
  }).join('');
}
async function refreshDashboard() {
  if (!adminSignedIn) return;
  $('#refresh-button').disabled = true;
  try {
    const [health,data] = await Promise.all([request('/api/health'),request('/api/dashboard')]);
    setConnection(true,`Connected to MySQL · ${health.database}`);
    $('#student-count').textContent=data.stats.studentCount; $('#course-count').textContent=data.stats.courseCount;
    $('#registration-count').textContent=data.stats.registrationCount; renderCourses(data.courses); renderActivity(data.recent);
  } catch(error) {
    setConnection(false,error.message); $('#courses-list').innerHTML='<div class="loading-row">Connect MySQL to load your courses.</div>';
    $('#activity-list').innerHTML='<div class="loading-row">Your recent enrollments will appear here.</div>';
  } finally { $('#refresh-button').disabled=false; }
}
async function openModal() {
  $('#modal').hidden=false; $('#form-message').textContent='';
  try {
    const students=await request('/api/students');
    $('#student-select').innerHTML='<option value="">Choose a student</option>'+students.map(s=>`<option value="${s.id}">${esc(s.code)} · ${esc(s.name)}</option>`).join('');
    fillCourseOptions();
  } catch(error) { $('#form-message').textContent=error.message; }
}
function toast(message) {
  const el=$('#toast'); el.textContent=message; el.classList.add('visible'); clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove('visible'),3000);
}
$('#open-register').addEventListener('click',openModal);
$('#close-modal').addEventListener('click',()=>$('#modal').hidden=true);
$('#modal').addEventListener('click',e=>{if(e.target===$('#modal'))$('#modal').hidden=true;});
document.addEventListener('keydown',e=>{if(e.key==='Escape')$('#modal').hidden=true;});
$('#retry-button').addEventListener('click',refreshDashboard); $('#refresh-button').addEventListener('click',refreshDashboard);
$('#view-all').addEventListener('click',()=>toast('Showing the latest 8 enrollments.'));
$('#activity-list').addEventListener('click',async e=>{
  const button=e.target.closest('.drop-button'); if(!button)return;
  if(!window.confirm(`Unenroll ${button.dataset.name} from ${button.dataset.title}?`))return;
  button.disabled=true;
  try {
    const data=await request('/api/registrations',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({studentId:button.dataset.student,courseId:button.dataset.course})});
    toast(data.message); await refreshDashboard();
  } catch(error) { toast(error.message); button.disabled=false; }
});
$('#registration-form').addEventListener('submit',async e=>{
  e.preventDefault(); $('#form-message').textContent=''; const button=e.currentTarget.querySelector('button[type="submit"]'); button.disabled=true;
  try {
    const data=await request('/api/registrations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({studentId:$('#student-select').value,courseId:$('#course-select').value})});
    $('#modal').hidden=true; e.currentTarget.reset(); toast(data.message); await refreshDashboard();
  } catch(error) { $('#form-message').textContent=error.message; }
  finally { button.disabled=false; }
});

function openAdminModal(id, messageId) {
  $(id).hidden=false;
  $(messageId).textContent='';
}
function unlockAdmin(username) {
  adminSignedIn=true;
  document.body.classList.remove('admin-locked');
  $('#admin-auth-screen').hidden=true;
  $('.profile strong').textContent=username || 'Admin';
  refreshDashboard();
}
async function initializeAdmin() {
  try {
    const data=await request('/api/admin/me');
    if(data.admin) unlockAdmin(data.admin.username);
    else { document.body.classList.add('admin-locked'); $('#admin-auth-screen').hidden=false; }
  } catch(_error) { document.body.classList.add('admin-locked'); $('#admin-auth-screen').hidden=false; }
}

$('#admin-login-form').addEventListener('submit',async e=>{
  e.preventDefault(); $('#admin-login-error').textContent='';
  const button=$('#admin-sign-in'); button.disabled=true; button.textContent='Signing in…';
  try {
    const data=await request('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:$('#admin-username').value,password:$('#admin-password').value})});
    $('#admin-login-form').reset(); unlockAdmin(data.admin.username);
  } catch(error) { $('#admin-login-error').textContent=error.message; }
  finally { button.disabled=false; button.innerHTML='Sign in to admin <span>→</span>'; }
});
$('#admin-logout').addEventListener('click',async()=>{
  await request('/api/admin/logout',{method:'POST'}); adminSignedIn=false; document.body.classList.add('admin-locked');
  $('#admin-auth-screen').hidden=false; $('#admin-login-form').reset(); $('#admin-username').value='admin'; $('#admin-password').focus();
});
$('#open-add-student').addEventListener('click',()=>openAdminModal('#student-modal','#student-form-message'));
$('#open-add-course').addEventListener('click',()=>openAdminModal('#course-modal','#course-form-message'));
document.querySelectorAll('[data-close-modal]').forEach(button=>button.addEventListener('click',()=>button.closest('.modal-backdrop').hidden=true));
['#student-modal','#course-modal'].forEach(id=>$(id).addEventListener('click',e=>{if(e.target===$(id))$(id).hidden=true;}));
$('#student-form').addEventListener('submit',async e=>{
  e.preventDefault(); const button=e.currentTarget.querySelector('button[type="submit"]'); button.disabled=true;
  $('#student-form-message').textContent='';
  try {
    const data=await request('/api/admin/students',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:$('#new-student-code').value,name:$('#new-student-name').value,email:$('#new-student-email').value,password:$('#new-student-password').value})});
    $('#student-modal').hidden=true; e.currentTarget.reset(); toast(data.message); await refreshDashboard();
  } catch(error) { $('#student-form-message').textContent=error.message; }
  finally { button.disabled=false; }
});
$('#course-form').addEventListener('submit',async e=>{
  e.preventDefault(); const button=e.currentTarget.querySelector('button[type="submit"]'); button.disabled=true;
  $('#course-form-message').textContent='';
  try {
    const data=await request('/api/admin/courses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:$('#new-course-code').value,title:$('#new-course-title').value,instructor:$('#new-course-instructor').value,capacity:$('#new-course-capacity').value})});
    $('#course-modal').hidden=true; e.currentTarget.reset(); $('#new-course-instructor').value='Faculty team'; $('#new-course-capacity').value=30; toast(data.message); await refreshDashboard();
  } catch(error) { $('#course-form-message').textContent=error.message; }
  finally { button.disabled=false; }
});
initializeAdmin();
setInterval(()=>{if(adminSignedIn)refreshDashboard();},30000);
