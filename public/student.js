const $ = s => document.querySelector(s);
let portalCourses = [];
const palette = [['#eeeaff','#735fe2','⌘'],['#e8f3ff','#508bd4','▤'],['#e7f7ef','#319b72','◈'],['#fff2e5','#d89647','⌁']];

async function api(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || 'Something went wrong. Please try again.');
    error.status = response.status;
    throw error;
  }
  return body;
}
function esc(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function showPortal(student) {
  $('#login-view').hidden = true; $('#portal-view').hidden = false;
  $('#student-name').textContent = student.name.split(' ')[0];
  $('#student-avatar').textContent = student.name.split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase();
  $('#student-code-label').textContent = student.code; $('#student-email').textContent = student.email;
  loadCourses();
}
function courseCard(course, index, enrolled) {
  const [bg,fg,icon] = palette[index % palette.length];
  const action = enrolled
    ? `<button class="course-action unenroll" data-action="drop" data-id="${course.id}">Unenroll</button>`
    : `<button class="course-action" data-action="enroll" data-id="${course.id}" ${Number(course.available) < 1 ? 'disabled' : ''}>${Number(course.available) < 1 ? 'Full' : 'Enroll'}</button>`;
  const detail = enrolled
    ? `Registered ${new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(new Date(course.registeredAt))}`
    : `${course.available} of ${course.capacity} seats available`;
  return `<article class="student-course"><div class="course-card-top"><span class="course-icon" style="background:${bg};color:${fg}">${icon}</span><span class="course-code">${esc(course.code)}</span></div><h3>${esc(course.title)}</h3><p class="course-instructor">Instructor · ${esc(course.instructor)}</p><div class="course-meta"><span>${esc(detail)}</span>${action}</div></article>`;
}
function renderCourses() {
  const mine = portalCourses.filter(c=>Number(c.isEnrolled) === 1);
  const search = $('#course-search').value.trim().toLowerCase();
  const options = portalCourses.filter(c=>Number(c.isEnrolled) !== 1 && `${c.title} ${c.code} ${c.instructor}`.toLowerCase().includes(search));
  $('#my-course-count').textContent = mine.length;
  $('#available-course-count').textContent = portalCourses.filter(c=>Number(c.isEnrolled)!==1 && Number(c.available)>0).length;
  $('#my-courses').innerHTML = mine.length ? mine.map((c,i)=>courseCard(c,i,true)).join('') : '<div class="empty-state">You’re not enrolled in a course yet. Explore the catalog below to get started.</div>';
  $('#explore-courses').innerHTML = options.length ? options.map((c,i)=>courseCard(c,i,false)).join('') : '<div class="empty-state">No available courses match that search.</div>';
}
async function loadCourses() {
  try { const data=await api('/api/student/portal'); portalCourses=data.courses; renderCourses(); }
  catch(error) {
    if (error.status === 401) {
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
      $('#portal-view').hidden = true;
      $('#login-view').hidden = false;
      $('#login-error').textContent = 'Your session ended. Please sign in again.';
      return;
    }
    toast(`Could not load courses: ${error.message}. Select Refresh to try again.`);
  }
}
function toast(message) {
  const el=$('#portal-toast'); el.textContent=message; el.classList.add('visible');
  clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove('visible'),2600);
}

$('#login-form').addEventListener('submit',async event=>{
  event.preventDefault(); $('#login-error').textContent='';
  const button=$('#sign-in-button'); button.disabled=true; button.textContent='Signing in…';
  try {
    const data=await api('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({studentCode:$('#student-code').value,password:$('#student-password').value})});
    showPortal(data.student);
  } catch(error) { $('#login-error').textContent=error.message; }
  finally { button.disabled=false; button.innerHTML='Sign in <span>→</span>'; }
});
$('#toggle-password').addEventListener('click',()=>{
  const input=$('#student-password'), show=input.type==='password'; input.type=show?'text':'password'; $('#toggle-password').textContent=show?'Hide':'Show';
});
$('#logout-button').addEventListener('click',async()=>{await api('/api/auth/logout',{method:'POST'});portalCourses=[];$('#portal-view').hidden=true;$('#login-view').hidden=false;$('#login-form').reset();});
$('#portal-refresh').addEventListener('click',loadCourses);
$('#course-search').addEventListener('input',renderCourses);
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]'); if(!button)return;
  const course=portalCourses.find(c=>String(c.id)===button.dataset.id); if(!course)return;
  if(button.dataset.action==='drop'&&!window.confirm(`Unenroll from ${course.title}?`))return;
  button.disabled=true;
  try {
    const verb=button.dataset.action==='drop'?'DELETE':'POST';
    const result=await api(`/api/student/courses/${course.id}/enroll`,{method:verb});
    toast(result.message); await loadCourses();
  } catch(error) { toast(error.message); button.disabled=false; }
});

api('/api/auth/me').then(data=>data.student?showPortal(data.student):null).catch(()=>{});
