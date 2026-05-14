/* =========================================================================
   NDEZO SCHOOL OF CHAMPIONS — application logic
   © Innocent Forteh. All rights reserved.
   ========================================================================= */

(function(){
'use strict';

/* ---------- ADMIN CREDENTIALS ---------- */
const ADMIN_USERNAME = 'forteh';
const ADMIN_PASSWORD = 'f0rteh';

/* ---------- STATE ---------- */
const STORAGE_KEY = 'ndezo_state_v1';
const ROSTER_KEY = 'ndezo_roster_v1';
const ADMIN_KEY = 'ndezo_admin_v1';

const defaultState = () => ({
  enrolled: false,
  user: { name:'', email:'', country:'', enrolledAt:null },
  lang: 'en',
  modules: {},  // { [num]: { reflection, reflectionWords, quizAttempts:[{score,passed,date}], passed, certId, certDate } }
  view: 'landing',
  currentModule: null,
  currentTab: 'teaching',
  adminMode: false,
  adminViewing: null, // studentId being viewed in admin
});

let STATE = loadState();
let ROSTER = loadRoster();

function loadState(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // shallow merge with defaults
    return Object.assign(defaultState(), parsed);
  } catch(e){ return defaultState(); }
}
function saveState(){
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE));
    // if student is enrolled, sync to roster too
    if(STATE.enrolled && STATE.user && STATE.user.email){
      syncToRoster();
    }
  }
  catch(e){ console.warn('Save failed', e); }
}

/* ---------- ROSTER (shared across this device — admin's view) ---------- */
function studentIdFromEmail(email){
  return String(email||'').trim().toLowerCase().replace(/[^a-z0-9@._-]/g,'_');
}

function loadRoster(){
  try {
    const raw = localStorage.getItem(ROSTER_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch(e){ return {}; }
}
function saveRoster(){
  try { localStorage.setItem(ROSTER_KEY, JSON.stringify(ROSTER)); }
  catch(e){ console.warn('Roster save failed', e); }
}
function syncToRoster(){
  const id = studentIdFromEmail(STATE.user.email);
  if(!id) return;
  const prev = ROSTER[id] || { notes:{ general:'', perModule:{} } };
  ROSTER[id] = {
    studentId: id,
    user: { ...STATE.user },
    modules: JSON.parse(JSON.stringify(STATE.modules || {})),
    diploma: STATE.diploma ? { ...STATE.diploma } : null,
    notes: prev.notes || { general:'', perModule:{} },
    lastActivity: Date.now()
  };
  saveRoster();
}

function getNotesForCurrentUser(){
  if(!STATE.enrolled || !STATE.user || !STATE.user.email) return { general:'', perModule:{} };
  const id = studentIdFromEmail(STATE.user.email);
  return (ROSTER[id] && ROSTER[id].notes) ? ROSTER[id].notes : { general:'', perModule:{} };
}

const t = (key) => (I18N[STATE.lang] && I18N[STATE.lang][key]) || I18N.en[key] || key;
const L = () => STATE.lang;

/* ---------- HELPERS ---------- */
function genCertId(num){
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2,6).toUpperCase();
  return `NSC-M${String(num).padStart(2,'0')}-${stamp}-${rand}`;
}
function genDiplomaId(){
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2,6).toUpperCase();
  return `NSC-DIPLOMA-${stamp}-${rand}`;
}
function fmtDate(d, lang){
  if(!d) d = new Date();
  if(typeof d === 'string' || typeof d === 'number') d = new Date(d);
  const opts = { year:'numeric', month:'long', day:'numeric' };
  try { return d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', opts); }
  catch(e){ return d.toDateString(); }
}
function escapeHTML(s){
  return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function wordCount(s){
  return String(s||'').trim().split(/\s+/).filter(Boolean).length;
}
function getModState(num){
  if(!STATE.modules[num]){
    STATE.modules[num] = {
      reflection:'', reflectionWords:0,
      quizAttempts:[], passed:false,
      certId:null, certDate:null
    };
  }
  return STATE.modules[num];
}
function isModuleUnlocked(num){
  if(num === 1) return true;
  const prev = STATE.modules[num-1];
  return !!(prev && prev.passed);
}
function totalPassed(){
  return MODULES.filter(m => STATE.modules[m.num] && STATE.modules[m.num].passed).length;
}
function diplomaEarned(){
  return totalPassed() === MODULES.length;
}
function diplomaState(){
  if(!STATE.diploma) STATE.diploma = { issued:false, id:null, date:null };
  return STATE.diploma;
}

/* ---------- ROUTER ---------- */
function navigate(view, opts){
  STATE.view = view;
  if(opts && opts.module) STATE.currentModule = opts.module;
  if(opts && opts.tab) STATE.currentTab = opts.tab;
  saveState();
  render();
  window.scrollTo({top:0, behavior:'smooth'});
}

/* ---------- COMPONENTS: shell ---------- */
function topbar(){
  let navLinks, right;

  if(STATE.adminMode){
    // ADMIN nav
    navLinks = `
      <button data-nav="admin" class="${STATE.view==='admin'||STATE.view==='admin-student'?'active':''}">${t('navAdminRoster')}</button>
      <button data-nav="curriculum" class="${STATE.view==='curriculum'?'active':''}">${t('navCurriculum')}</button>
      <button data-nav="founder" class="${STATE.view==='founder'?'active':''}">${t('navFounder')}</button>
    `;
    right = `<span style="font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold-bright);font-weight:600;padding:0 10px">${t('navAdminBadge')}</span>
             <button data-action="admin-signout">${t('navSignOut')}</button>`;
  } else if(STATE.enrolled){
    // STUDENT nav
    navLinks = `
      <button data-nav="dashboard" class="${STATE.view==='dashboard'?'active':''}">${t('navMyStudies')}</button>
      <button data-nav="curriculum" class="${STATE.view==='curriculum'?'active':''}">${t('navCurriculum')}</button>
      <button data-nav="founder" class="${STATE.view==='founder'?'active':''}">${t('navFounder')}</button>
    `;
    right = `<button data-nav="diploma" class="${STATE.view==='diploma'?'active':''}" ${diplomaEarned()?'':'style="opacity:.5"'}>${t('navDiploma')}</button>
             <button data-action="signout">${t('navSignOut')}</button>`;
  } else {
    // PUBLIC nav
    navLinks = `
      <button data-nav="curriculum" class="${STATE.view==='curriculum'?'active':''}">${t('navCurriculum')}</button>
      <button data-nav="founder" class="${STATE.view==='founder'?'active':''}">${t('navFounder')}</button>
    `;
    right = `<button data-action="signin" class="active">${t('navSignIn')}</button>`;
  }

  return `
    <header class="topbar">
      <div class="inner">
        <a href="#" data-nav="landing" style="display:flex;align-items:center;gap:14px;text-decoration:none">
          <div class="crest-mark">N</div>
          <h1>${t('schoolName')}<small>${t('schoolMotto')}</small></h1>
        </a>
        <nav>
          ${navLinks}
          <span style="display:inline-flex;border:1px solid rgba(214,168,60,.5);border-radius:2px;overflow:hidden;margin:0 4px">
            <button data-lang="en" class="${L()==='en'?'active':''}" style="border:none;border-radius:0">EN</button>
            <button data-lang="fr" class="${L()==='fr'?'active':''}" style="border:none;border-radius:0">FR</button>
          </span>
          ${right}
        </nav>
      </div>
    </header>
  `;
}

function footer(){
  return `
    <footer class="foot">
      <div class="inner" style="max-width:1240px;margin:0 auto;padding:38px 28px;display:grid;grid-template-columns:1fr 1fr;gap:30px;align-items:start">
        <div>
          <div style="font-family:var(--display);font-style:italic;font-size:24px;color:var(--gold-bright);margin-bottom:8px">${t('schoolName')}</div>
          <div style="font-size:13px;line-height:1.7;opacity:.85;max-width:480px">${t('footerTagline')}</div>
        </div>
        <div style="text-align:right;font-size:12px;line-height:1.9;opacity:.8">
          <div>${t('footerCopyright')}</div>
          <div>${t('footerContact')}: <a href="mailto:team21online@gmail.com" style="color:var(--gold-bright)">team21online@gmail.com</a></div>
          <div style="margin-top:10px;font-style:italic;font-family:var(--display);font-size:18px;color:var(--gold-bright)">${t('schoolMotto')} <span style="opacity:.6">— Mark 10:43</span></div>
        </div>
      </div>
    </footer>
  `;
}

/* ---------- VIEW: LANDING ---------- */
function viewLanding(){
  const pillars = [
    { n:'I', t:t('pillar1Title'), p:t('pillar1Body') },
    { n:'II', t:t('pillar2Title'), p:t('pillar2Body') },
    { n:'III', t:t('pillar3Title'), p:t('pillar3Body') },
    { n:'IV', t:t('pillar4Title'), p:t('pillar4Body') },
  ].map(p => `
    <div class="pillar">
      <div class="num">${p.n}</div>
      <h4>${escapeHTML(p.t)}</h4>
      <p>${escapeHTML(p.p)}</p>
    </div>
  `).join('');

  const modulesPreview = MODULES.slice(0,8).map(m => `
    <li style="padding:14px 0;border-bottom:1px dotted var(--rule);display:flex;gap:18px;align-items:baseline">
      <span style="font-family:var(--display);font-style:italic;color:var(--gold);font-size:22px;min-width:50px">${String(m.num).padStart(2,'0')}</span>
      <div style="flex:1">
        <div style="font-family:var(--serif);font-size:18px;color:var(--ink)">${escapeHTML(m[L()].title)}</div>
        <div style="font-size:13px;color:var(--ink-soft);margin-top:2px">${escapeHTML(m[L()].summary.slice(0,140))}...</div>
      </div>
    </li>
  `).join('');

  return `
    <section class="hero">
      <div>
        <div style="font-size:11px;letter-spacing:.34em;text-transform:uppercase;color:var(--gold-deep);font-weight:600;margin-bottom:18px">${t('heroEyebrow')}</div>
        <h2>${t('heroTitle1')} <em>${t('heroTitle2')}</em></h2>
        <p class="lede">${t('heroLede')}</p>
        <div style="display:flex;gap:14px;flex-wrap:wrap">
          <button class="btn gold" data-action="enroll">${t('ctaEnroll')}</button>
          <button class="btn ghost" data-nav="curriculum">${t('ctaCurriculum')}</button>
        </div>
        <div class="meta">
          <span><b>21</b> ${t('metaModules')}</span>
          <span><b>2</b> ${t('metaLanguages')}</span>
          <span><b>80%</b> ${t('metaPassMark')}</span>
          <span><b>22</b> ${t('metaCertificates')}</span>
        </div>
      </div>
      <div class="hero-art">
        <div class="corner tl"></div><div class="corner tr"></div>
        <div class="corner bl"></div><div class="corner br"></div>
        <div class="hero-art-inner">
          <div class="crest-mark">N</div>
          <h3>${t('heroArtH')}</h3>
          <p>Mark 10:43 · #NotSoWithYou</p>
        </div>
      </div>
    </section>

    <section class="container" style="margin-top:80px">
      <div class="section-eyebrow">${t('pillarsEyebrow')}</div>
      <h3 class="section-title">${t('pillarsTitle')}</h3>
      <div class="pillars" style="margin-top:36px">${pillars}</div>
    </section>

    <section class="container" style="margin-top:80px">
      <div style="display:grid;grid-template-columns:1.1fr 1fr;gap:60px;align-items:start">
        <div>
          <div class="section-eyebrow">${t('curriculumEyebrow')}</div>
          <h3 class="section-title">${t('curriculumTitle')}</h3>
          <p style="font-family:var(--serif);font-size:18px;line-height:1.7;color:var(--ink-soft);margin-top:18px">${t('curriculumBlurb')}</p>
          <button class="btn gold" data-nav="curriculum" style="margin-top:24px">${t('ctaSeeAll')}</button>
        </div>
        <div class="card parchment">
          <div style="font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold-deep);font-weight:600;margin-bottom:14px">${t('firstEightLabel')}</div>
          <ul style="list-style:none;padding:0;margin:0">${modulesPreview}</ul>
        </div>
      </div>
    </section>

    <section class="container" style="margin-top:80px">
      <div class="card deep" style="padding:60px 50px;text-align:center">
        <div style="font-family:var(--display);font-style:italic;font-size:42px;color:var(--gold-bright);line-height:1.2;margin-bottom:18px">"${t('founderQuote')}"</div>
        <div style="font-size:12px;letter-spacing:.28em;text-transform:uppercase;color:var(--paper);opacity:.85">— ${t('founderName')}, ${t('founderTitle')}</div>
        <button class="btn gold" data-nav="founder" style="margin-top:30px">${t('ctaMeetFounder')}</button>
      </div>
    </section>
  `;
}

/* ---------- VIEW: CURRICULUM ---------- */
function viewCurriculum(){
  const items = MODULES.map(m => {
    const ms = STATE.modules[m.num] || {};
    const unlocked = !STATE.enrolled || isModuleUnlocked(m.num);
    const passed = ms.passed;
    const status = passed
      ? `<span style="color:var(--gold-deep);font-weight:600">✦ ${t('statusPassed')}</span>`
      : (unlocked ? `<span style="color:var(--emerald)">${t('statusOpen')}</span>` : `<span style="color:var(--ink-soft)">🔒 ${t('statusLocked')}</span>`);
    const action = STATE.enrolled
      ? (unlocked ? `<button class="btn sm" data-mod="${m.num}">${passed?t('ctaReview'):t('ctaOpen')}</button>` : `<span style="font-size:11px;color:var(--ink-soft);letter-spacing:.18em;text-transform:uppercase">${t('completePrev')}</span>`)
      : `<button class="btn sm" data-action="enroll">${t('ctaEnrollToOpen')}</button>`;
    return `
      <li style="padding:22px 0;border-bottom:1px solid var(--rule);display:grid;grid-template-columns:60px 1fr auto auto;gap:24px;align-items:center">
        <span style="font-family:var(--display);font-style:italic;color:var(--gold);font-size:32px;text-align:right">${String(m.num).padStart(2,'0')}</span>
        <div>
          <div style="font-family:var(--serif);font-size:20px;color:var(--ink)">${escapeHTML(m[L()].title)}</div>
          <div style="font-size:13.5px;color:var(--ink-soft);margin-top:4px;line-height:1.55">${escapeHTML(m[L()].summary)}</div>
          <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold-deep);font-weight:600;margin-top:8px">${m.durationMin} ${t('minLabel')} · ${escapeHTML(m[L()].scriptureCite)}</div>
        </div>
        <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase">${status}</div>
        <div>${action}</div>
      </li>
    `;
  }).join('');

  return `
    <section class="container" style="padding-top:60px">
      <div class="section-eyebrow">${t('curriculumEyebrow')}</div>
      <h3 class="section-title">${t('curriculumFullTitle')}</h3>
      <p style="font-family:var(--serif);font-size:18px;line-height:1.7;color:var(--ink-soft);max-width:760px;margin-top:20px">${t('curriculumIntro')}</p>
      <ul style="list-style:none;padding:0;margin:50px 0 0">${items}</ul>
    </section>
  `;
}

/* ---------- VIEW: FOUNDER ---------- */
function viewFounder(){
  return `
    <section class="container" style="padding-top:60px;max-width:880px">
      <div class="section-eyebrow">${t('founderEyebrow')}</div>
      <h3 class="section-title">${t('founderName')}</h3>
      <div style="font-size:13px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold-deep);font-weight:600;margin:14px 0 30px">${t('founderTitle')}</div>
      <div class="card parchment" style="padding:50px 44px;font-family:var(--serif);font-size:17.5px;line-height:1.8;color:var(--ink)">
        ${t('founderBio').split('\n\n').map(p => `<p style="margin-bottom:18px">${p}</p>`).join('')}
      </div>
      <div style="margin-top:50px">
        <div class="section-eyebrow">${t('dedicationEyebrow')}</div>
        <h3 class="section-title" style="font-size:34px;margin-top:8px">${t('dedicationTitle')}</h3>
        <div class="card deep" style="padding:42px 38px;margin-top:24px;background:linear-gradient(180deg, #0a3a2a, #072820)">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;align-items:stretch">
            <div style="padding:8px 28px 8px 0;border-right:1px solid rgba(214,168,60,.25);text-align:center">
              <div style="font-size:10px;letter-spacing:.32em;text-transform:uppercase;color:var(--gold-bright);font-weight:600;opacity:.8;margin-bottom:8px">${t('dedicationNgochiLabel')}</div>
              <div style="font-family:var(--display);font-style:italic;font-size:34px;color:var(--gold-bright);line-height:1.15;margin-bottom:6px">Derick Ngochi</div>
              <div style="font-size:10.5px;letter-spacing:.28em;text-transform:uppercase;color:var(--paper);opacity:.6;margin-bottom:18px">${t('dedicationNgochiDates')}</div>
              <div style="font-family:var(--serif);font-style:italic;font-size:15px;color:var(--paper);line-height:1.7;opacity:.92">${t('dedicationNgochiBody')}</div>
            </div>
            <div style="padding:8px 0 8px 28px;text-align:center">
              <div style="font-size:10px;letter-spacing:.32em;text-transform:uppercase;color:var(--gold-bright);font-weight:600;opacity:.8;margin-bottom:8px">${t('dedicationNdezoLabel')}</div>
              <div style="font-family:var(--display);font-style:italic;font-size:34px;color:var(--gold-bright);line-height:1.15;margin-bottom:6px">${t('dedicationNdezoName')}</div>
              <div style="font-size:10.5px;letter-spacing:.28em;text-transform:uppercase;color:var(--paper);opacity:.6;margin-bottom:18px">${t('dedicationNdezoDates')}</div>
              <div style="font-family:var(--serif);font-style:italic;font-size:15px;color:var(--paper);line-height:1.7;opacity:.92">${t('dedicationNdezoBody')}</div>
            </div>
          </div>
          <div style="margin-top:32px;padding-top:24px;border-top:1px solid rgba(214,168,60,.25);text-align:center">
            <div style="font-family:var(--display);font-style:italic;font-size:22px;color:var(--gold-bright);line-height:1.4;margin-bottom:10px">${t('dedicationJoint')}</div>
            <div style="font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold-bright);opacity:.85">${t('dedicationMemorial')}</div>
          </div>
        </div>
      </div>

      <div style="margin-top:50px">
        <div class="section-eyebrow">${t('libraryEyebrow')}</div>
        <h3 class="section-title" style="font-size:34px;margin-top:8px">${t('libraryTitle')}</h3>
        <p style="font-family:var(--serif);font-size:17px;line-height:1.7;color:var(--ink-soft);margin-top:14px">${t('libraryIntro')}</p>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:30px">
          <a href="https://forteh.blogspot.com" target="_blank" rel="noopener" class="card" style="padding:30px;display:block;text-decoration:none;color:var(--ink)">
            <div style="font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold-deep);font-weight:600;margin-bottom:8px">${t('libraryFortehLabel')}</div>
            <div style="font-family:var(--display);font-style:italic;font-size:26px;color:var(--emerald-deep);line-height:1.2;margin-bottom:10px">DAIL-J Forteh</div>
            <div style="font-size:14.5px;color:var(--ink-soft);line-height:1.6">${t('libraryFortehDesc')}</div>
            <div style="margin-top:14px;font-size:12px;letter-spacing:.16em;color:var(--gold-deep);font-weight:600">forteh.blogspot.com →</div>
          </a>
          <a href="https://team21on.blogspot.com" target="_blank" rel="noopener" class="card" style="padding:30px;display:block;text-decoration:none;color:var(--ink)">
            <div style="font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold-deep);font-weight:600;margin-bottom:8px">${t('libraryTeam21Label')}</div>
            <div style="font-family:var(--display);font-style:italic;font-size:26px;color:var(--emerald-deep);line-height:1.2;margin-bottom:10px">Team21 — 21 Weeks</div>
            <div style="font-size:14.5px;color:var(--ink-soft);line-height:1.6">${t('libraryTeam21Desc')}</div>
            <div style="margin-top:14px;font-size:12px;letter-spacing:.16em;color:var(--gold-deep);font-weight:600">team21on.blogspot.com →</div>
          </a>
        </div>

        <div style="margin-top:36px">
          <div style="font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold-deep);font-weight:600;margin-bottom:18px">${t('libraryEssaysLabel')}</div>
          <ul style="list-style:none;padding:0;margin:0">
            <li style="padding:18px 0;border-bottom:1px dotted var(--rule)">
              <a href="https://forteh.blogspot.com/2019/04/fake-debate-real-issue.html" target="_blank" rel="noopener" style="color:var(--ink);text-decoration:none">
                <div style="font-family:var(--display);font-style:italic;font-size:22px;color:var(--emerald-deep);margin-bottom:4px">${t('essay1Title')}</div>
                <div style="font-size:13.5px;color:var(--ink-soft);line-height:1.55">${t('essay1Desc')}</div>
              </a>
            </li>
            <li style="padding:18px 0;border-bottom:1px dotted var(--rule)">
              <a href="https://forteh.blogspot.com/2020/09/why-do-servant-leaders-win.html" target="_blank" rel="noopener" style="color:var(--ink);text-decoration:none">
                <div style="font-family:var(--display);font-style:italic;font-size:22px;color:var(--emerald-deep);margin-bottom:4px">${t('essay2Title')}</div>
                <div style="font-size:13.5px;color:var(--ink-soft);line-height:1.55">${t('essay2Desc')}</div>
              </a>
            </li>
            <li style="padding:18px 0;border-bottom:1px dotted var(--rule)">
              <a href="https://forteh.blogspot.com/2020/08/retrospect.html" target="_blank" rel="noopener" style="color:var(--ink);text-decoration:none">
                <div style="font-family:var(--display);font-style:italic;font-size:22px;color:var(--emerald-deep);margin-bottom:4px">${t('essay3Title')}</div>
                <div style="font-size:13.5px;color:var(--ink-soft);line-height:1.55">${t('essay3Desc')}</div>
              </a>
            </li>
            <li style="padding:18px 0;border-bottom:1px dotted var(--rule)">
              <a href="https://forteh.blogspot.com/2020/03/headlines.html" target="_blank" rel="noopener" style="color:var(--ink);text-decoration:none">
                <div style="font-family:var(--display);font-style:italic;font-size:22px;color:var(--emerald-deep);margin-bottom:4px">${t('essay4Title')}</div>
                <div style="font-size:13.5px;color:var(--ink-soft);line-height:1.55">${t('essay4Desc')}</div>
              </a>
            </li>
            <li style="padding:18px 0">
              <a href="https://www.forevermissed.com/derickngochi/about" target="_blank" rel="noopener" style="color:var(--ink);text-decoration:none">
                <div style="font-family:var(--display);font-style:italic;font-size:22px;color:var(--emerald-deep);margin-bottom:4px">${t('essay5Title')}</div>
                <div style="font-size:13.5px;color:var(--ink-soft);line-height:1.55">${t('essay5Desc')}</div>
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div class="card deep" style="padding:40px;margin-top:40px;text-align:center">
        <div style="font-family:var(--display);font-style:italic;font-size:30px;color:var(--gold-bright);line-height:1.3">"${t('founderQuote')}"</div>
      </div>
    </section>
  `;
}

/* ---------- VIEW: DASHBOARD ---------- */
function viewDashboard(){
  const passed = totalPassed();
  const pct = Math.round((passed / MODULES.length) * 100);
  const next = MODULES.find(m => !STATE.modules[m.num] || !STATE.modules[m.num].passed);
  const grid = MODULES.map(m => {
    const ms = STATE.modules[m.num] || {};
    const unlocked = isModuleUnlocked(m.num);
    const status = ms.passed ? '✦' : (unlocked ? '○' : '🔒');
    const cls = ms.passed ? 'background:var(--emerald-deep);color:var(--gold-bright);border-color:var(--gold)' : (unlocked ? 'background:var(--paper);border-color:var(--rule)' : 'background:rgba(0,0,0,.04);color:var(--ink-soft);border-color:var(--rule);cursor:not-allowed');
    return `
      <button data-mod="${m.num}" ${unlocked?'':'disabled'} style="${cls};padding:18px 14px;border-width:1px;border-style:solid;border-radius:2px;text-align:left;cursor:${unlocked?'pointer':'not-allowed'};font-family:inherit">
        <div style="font-family:var(--display);font-style:italic;font-size:24px;line-height:1;margin-bottom:8px">${String(m.num).padStart(2,'0')} <span style="float:right">${status}</span></div>
        <div style="font-family:var(--serif);font-size:14.5px;line-height:1.35">${escapeHTML(m[L()].titleEm || m[L()].title)}</div>
      </button>
    `;
  }).join('');

  const dipState = diplomaState();
  const diplomaCard = diplomaEarned() ? `
    <div class="card deep" style="padding:36px;margin-top:30px;text-align:center">
      <div style="font-size:11px;letter-spacing:.32em;text-transform:uppercase;color:var(--gold-bright);font-weight:600">${t('dashDiplomaReady')}</div>
      <div style="font-family:var(--display);font-style:italic;font-size:36px;color:var(--paper);margin:12px 0 18px">${t('diplomaTitle')}</div>
      <button class="btn gold" data-nav="diploma">${t('ctaViewDiploma')}</button>
    </div>
  ` : '';

  const userNotes = getNotesForCurrentUser();
  const generalNote = userNotes && userNotes.general ? `
    <div class="card deep" style="padding:28px 32px;margin-top:30px;background:linear-gradient(180deg, #0a3a2a, #072820);position:relative">
      <div style="position:absolute;top:18px;right:22px;font-family:var(--display);font-style:italic;font-size:24px;color:var(--gold-bright);opacity:.55">✦</div>
      <div style="font-size:11px;letter-spacing:.32em;text-transform:uppercase;color:var(--gold-bright);font-weight:600">${t('studentNoteEyebrow')}</div>
      <div style="font-family:var(--display);font-style:italic;font-size:26px;color:var(--paper);margin:6px 0 14px">${t('studentNoteTitle')}</div>
      <div style="font-family:var(--serif);font-size:17px;line-height:1.75;color:var(--paper);white-space:pre-wrap">${escapeHTML(userNotes.general)}</div>
      <div style="margin-top:18px;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold-bright);opacity:.85;font-weight:600">— ${t('studentNoteSignature')}</div>
    </div>
  ` : '';

  return `
    <section class="container" style="padding-top:50px">
      <div class="section-eyebrow">${t('dashEyebrow')}</div>
      <h3 class="section-title">${t('dashWelcome')}, <em>${escapeHTML(STATE.user.name||'')}</em></h3>

      ${generalNote}

      <div style="display:grid;grid-template-columns:2fr 1fr;gap:30px;margin-top:36px">
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:14px">
            <h3 style="margin:0">${t('dashProgress')}</h3>
            <div style="font-family:var(--display);font-style:italic;font-size:32px;color:var(--gold-deep)">${passed}/${MODULES.length}</div>
          </div>
          <div style="background:rgba(0,0,0,.06);border-radius:2px;height:10px;overflow:hidden">
            <div style="background:linear-gradient(90deg, var(--emerald), var(--gold));height:100%;width:${pct}%"></div>
          </div>
          <div style="margin-top:10px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-soft)">${pct}% ${t('dashCompleted')}</div>

          ${next ? `
          <div style="margin-top:30px;padding-top:24px;border-top:1px solid var(--rule)">
            <div style="font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold-deep);font-weight:600;margin-bottom:10px">${t('dashNext')}</div>
            <div style="font-family:var(--serif);font-size:24px;color:var(--ink);margin-bottom:6px">${t('moduleLabel')} ${next.num}: <em>${escapeHTML(next[L()].titleEm || next[L()].title)}</em></div>
            <div style="font-size:14.5px;color:var(--ink-soft);line-height:1.6;margin-bottom:18px">${escapeHTML(next[L()].summary)}</div>
            <button class="btn gold" data-mod="${next.num}">${t('ctaContinue')}</button>
          </div>` : `
          <div style="margin-top:30px;padding-top:24px;border-top:1px solid var(--rule);text-align:center">
            <div style="font-family:var(--display);font-style:italic;font-size:28px;color:var(--gold-deep)">${t('dashAllDone')}</div>
          </div>`}
        </div>

        <div class="card parchment">
          <h3 style="margin-top:0">${t('dashCertificates')}</h3>
          <div style="font-family:var(--display);font-style:italic;font-size:48px;color:var(--gold);line-height:1">${passed}</div>
          <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-soft);margin-top:4px">${t('dashEarnedSoFar')}</div>
          <div style="margin-top:18px;font-size:13.5px;line-height:1.6;color:var(--ink-soft)">${t('dashCertExplain')}</div>
        </div>
      </div>

      ${diplomaCard}

      <div style="margin-top:50px">
        <div class="section-eyebrow">${t('dashAllModules')}</div>
        <h3 class="section-title">${t('dashYourPath')}</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:14px;margin-top:24px">${grid}</div>
      </div>
    </section>
  `;
}

/* ---------- VIEW: MODULE ---------- */
function viewModule(){
  const m = MODULES.find(x => x.num === STATE.currentModule);
  if(!m){ navigate('curriculum'); return ''; }
  if(!isModuleUnlocked(m.num)){
    return `
      <section class="container" style="padding-top:80px;text-align:center">
        <div style="font-size:48px;color:var(--ink-soft)">🔒</div>
        <h3 class="section-title" style="margin-top:20px">${t('lockedTitle')}</h3>
        <p style="font-family:var(--serif);font-size:17px;color:var(--ink-soft);max-width:520px;margin:14px auto 30px">${t('lockedBody').replace('{n}', m.num-1)}</p>
        <button class="btn gold" data-mod="${m.num-1}">${t('ctaGoBack')}</button>
      </section>
    `;
  }

  const ms = getModState(m.num);
  const tab = STATE.currentTab || 'teaching';
  const data = m[L()];

  const tabs = [
    { id:'teaching', label:t('tabTeaching') },
    { id:'reflection', label:t('tabReflection') },
    { id:'assignment', label:t('tabAssignment') },
    { id:'assessment', label:t('tabAssessment') },
    { id:'certificate', label:t('tabCertificate') },
  ];

  const tabBar = tabs.map(x => `
    <button class="modtab ${tab===x.id?'active':''}" data-tab="${x.id}" style="padding:14px 22px;border:none;background:transparent;font-family:var(--body);font-size:11.5px;letter-spacing:.22em;text-transform:uppercase;color:${tab===x.id?'var(--emerald-deep)':'var(--ink-soft)'};font-weight:${tab===x.id?'700':'500'};border-bottom:2px solid ${tab===x.id?'var(--gold)':'transparent'};cursor:pointer">${x.label}</button>
  `).join('');

  let pane = '';
  if(tab === 'teaching') pane = paneTeaching(m, data);
  else if(tab === 'reflection') pane = paneReflection(m, ms);
  else if(tab === 'assignment') pane = paneAssignment(m, data);
  else if(tab === 'assessment') pane = paneAssessment(m, ms);
  else if(tab === 'certificate') pane = paneCertificate(m, ms);

  const userNotes = getNotesForCurrentUser();
  const modNote = userNotes && userNotes.perModule && userNotes.perModule[m.num] ? userNotes.perModule[m.num] : '';
  const noteBlock = modNote ? `
    <div style="margin-top:28px;padding:20px 26px 22px;background:linear-gradient(180deg, rgba(214,168,60,.12), rgba(214,168,60,.06));border-left:3px solid var(--gold);position:relative">
      <div style="position:absolute;top:14px;right:18px;font-family:var(--display);font-style:italic;font-size:22px;color:var(--gold-deep);opacity:.55">✦</div>
      <div style="font-size:10.5px;letter-spacing:.32em;text-transform:uppercase;color:var(--gold-deep);font-weight:700;margin-bottom:6px">${t('studentModNoteEyebrow')}</div>
      <div style="font-family:var(--serif);font-size:16px;line-height:1.7;color:var(--ink);white-space:pre-wrap">${escapeHTML(modNote)}</div>
      <div style="margin-top:10px;font-size:10.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold-deep);font-weight:600">— ${t('studentNoteSignature')}</div>
    </div>
  ` : '';

  return `
    <section class="container" style="padding-top:40px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:20px;margin-bottom:8px">
        <button class="btn ghost sm" data-nav="dashboard">← ${t('navMyStudies')}</button>
        <div style="font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold-deep);font-weight:600">${t('moduleLabel')} ${String(m.num).padStart(2,'0')} / 21 · ${m.durationMin} ${t('minLabel')}</div>
      </div>
      <h2 style="font-family:var(--display);font-style:italic;font-weight:400;font-size:54px;line-height:1.05;color:var(--ink);margin:8px 0 16px">${escapeHTML(data.title)}</h2>
      <div style="font-size:15px;font-family:var(--serif);font-style:italic;color:var(--ink-soft);max-width:780px;line-height:1.65">${escapeHTML(data.summary)}</div>

      ${noteBlock}

      <div style="display:flex;gap:0;border-bottom:1px solid var(--rule);margin-top:36px;overflow-x:auto">${tabBar}</div>
      <div style="margin-top:36px">${pane}</div>
    </section>
  `;
}

function paneTeaching(m, data){
  const objectives = data.objectives.map(o => `<li style="padding:8px 0 8px 28px;position:relative;font-size:15.5px;line-height:1.65;color:var(--ink)"><span style="position:absolute;left:0;top:8px;color:var(--gold);font-family:var(--display);font-style:italic">✦</span>${escapeHTML(o)}</li>`).join('');
  return `
    <div style="display:grid;grid-template-columns:1fr 320px;gap:50px">
      <article class="prose" style="font-family:var(--serif);font-size:18px;line-height:1.85;color:var(--ink)">
        <div class="card parchment" style="padding:30px;margin-bottom:32px">
          <div style="font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold-deep);font-weight:600;margin-bottom:8px">${t('scriptureLabel')}</div>
          <div style="font-family:var(--display);font-style:italic;font-size:24px;line-height:1.45;color:var(--ink)">"${escapeHTML(data.scripture)}"</div>
          <div style="margin-top:10px;font-size:13px;color:var(--gold-deep);font-weight:600;letter-spacing:.06em">— ${escapeHTML(data.scriptureCite)}</div>
        </div>
        <style>.prose h3{font-family:var(--display);font-style:italic;font-size:28px;color:var(--emerald-deep);margin:30px 0 14px;font-weight:500}.prose p{margin-bottom:16px}.prose ul,.prose ol{margin:14px 0 18px 24px}.prose ul li, .prose ol li{margin-bottom:8px;line-height:1.7}.prose .pullquote{font-family:var(--display);font-style:italic;font-size:24px;color:var(--gold-deep);border-left:3px solid var(--gold);padding:14px 0 14px 22px;margin:30px 0;line-height:1.45}.prose strong{color:var(--emerald-deep);font-weight:700}.prose em{color:var(--ink)}</style>
        ${data.teaching}
      </article>
      <aside>
        <div class="card" style="padding:28px">
          <div style="font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold-deep);font-weight:600;margin-bottom:14px">${t('objectivesLabel')}</div>
          <ul style="list-style:none;padding:0;margin:0">${objectives}</ul>
          <button class="btn gold sm" data-tab="reflection" style="margin-top:24px;width:100%">${t('ctaToReflection')} →</button>
        </div>
      </aside>
    </div>
  `;
}

function paneReflection(m, ms){
  const wc = ms.reflectionWords || 0;
  const minWords = 200;
  const ok = wc >= minWords;
  return `
    <div style="max-width:820px;margin:0 auto">
      <div style="font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold-deep);font-weight:600;margin-bottom:8px">${t('reflectionEyebrow')}</div>
      <h3 style="font-family:var(--display);font-style:italic;font-weight:400;font-size:34px;color:var(--ink);margin:0 0 14px">${t('reflectionTitle')}</h3>
      <p style="font-family:var(--serif);font-size:17px;line-height:1.7;color:var(--ink-soft);margin-bottom:24px">${t('reflectionPrompt')}</p>
      <textarea id="refl-text" placeholder="${t('reflectionPlaceholder')}" style="width:100%;min-height:380px;padding:24px;border:1px solid var(--rule);background:rgba(255,255,255,.6);font-family:var(--serif);font-size:16.5px;line-height:1.75;color:var(--ink);resize:vertical;border-radius:2px">${escapeHTML(ms.reflection || '')}</textarea>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;flex-wrap:wrap;gap:10px">
        <div style="font-size:13px;color:${ok?'var(--gold-deep)':'var(--ink-soft)'};font-weight:600">
          <span id="refl-count">${wc}</span> / ${minWords} ${t('wordsLabel')} ${ok?`<span style="color:var(--gold-deep)">✦ ${t('reflectionUnlocked')}</span>`:''}
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn ghost sm" data-action="save-reflection">${t('ctaSave')}</button>
          <button class="btn gold sm" data-action="save-and-assess" ${ok?'':'disabled'} style="${ok?'':'opacity:.5;cursor:not-allowed'}">${t('ctaProceedAssessment')} →</button>
        </div>
      </div>
      <div style="margin-top:18px;font-size:13px;color:var(--ink-soft);font-style:italic">${t('reflectionMinNote').replace('{n}', minWords)}</div>
    </div>
  `;
}

function paneAssignment(m, data){
  return `
    <div style="max-width:820px;margin:0 auto">
      <div style="font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold-deep);font-weight:600;margin-bottom:8px">${t('assignmentEyebrow')}</div>
      <h3 style="font-family:var(--display);font-style:italic;font-weight:400;font-size:34px;color:var(--ink);margin:0 0 24px">${t('assignmentTitle')}</h3>
      <div class="card parchment" style="padding:36px 40px;font-family:var(--serif);font-size:17px;line-height:1.85;color:var(--ink)">
        <style>.assignment ol{margin:0 0 0 22px;padding:0}.assignment ol li{margin-bottom:14px;padding-left:6px}.assignment strong{color:var(--emerald-deep)}.assignment em{color:var(--gold-deep);font-style:italic}</style>
        <div class="assignment">${data.assignment}</div>
      </div>
      <div style="margin-top:24px;padding:18px 22px;background:rgba(15,77,56,.06);border-left:3px solid var(--emerald);font-size:14.5px;line-height:1.65;color:var(--ink)">
        <strong>${t('assignmentNote')}</strong> ${t('assignmentNoteBody')}
      </div>
    </div>
  `;
}

function paneAssessment(m, ms){
  const ok = (ms.reflectionWords||0) >= 200;
  if(!ok){
    return `
      <div style="text-align:center;max-width:560px;margin:60px auto">
        <div style="font-size:48px;color:var(--gold);font-family:var(--display);font-style:italic">✦</div>
        <h3 style="font-family:var(--display);font-style:italic;font-weight:400;font-size:30px;color:var(--ink);margin-top:18px">${t('assessmentLockedTitle')}</h3>
        <p style="font-family:var(--serif);font-size:16px;line-height:1.7;color:var(--ink-soft);margin-top:14px">${t('assessmentLockedBody')}</p>
        <button class="btn gold" data-tab="reflection" style="margin-top:24px">${t('ctaToReflection')}</button>
      </div>
    `;
  }
  if(ms.passed){
    const last = ms.quizAttempts[ms.quizAttempts.length-1];
    return `
      <div style="text-align:center;max-width:600px;margin:40px auto">
        <div style="font-family:var(--display);font-style:italic;font-size:60px;color:var(--gold-deep)">✦</div>
        <h3 style="font-family:var(--display);font-style:italic;font-weight:400;font-size:36px;color:var(--ink);margin:18px 0 8px">${t('assessmentPassed')}</h3>
        <div style="font-size:17px;color:var(--ink-soft);font-family:var(--serif)">${t('assessmentScore')} <strong style="color:var(--emerald-deep)">${last.score}%</strong></div>
        <div style="margin-top:30px;display:flex;gap:14px;justify-content:center;flex-wrap:wrap">
          <button class="btn gold" data-tab="certificate">${t('ctaViewCertificate')}</button>
          <button class="btn ghost" data-action="retake-quiz">${t('ctaRetake')}</button>
        </div>
      </div>
    `;
  }

  // Active quiz
  return `
    <div style="max-width:820px;margin:0 auto">
      <div style="font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold-deep);font-weight:600;margin-bottom:8px">${t('assessmentEyebrow')}</div>
      <h3 style="font-family:var(--display);font-style:italic;font-weight:400;font-size:34px;color:var(--ink);margin:0 0 14px">${t('assessmentTitle')}</h3>
      <p style="font-family:var(--serif);font-size:16px;line-height:1.7;color:var(--ink-soft);margin-bottom:24px">${t('assessmentIntro').replace('{n}', m.quiz.length)}</p>
      <form id="quiz-form">
        ${m.quiz.map((q, qi) => {
          const qd = q[L()];
          const opts = qd.opts.map((opt, oi) => `
            <label style="display:flex;align-items:flex-start;gap:14px;padding:14px 18px;border:1px solid var(--rule);background:var(--paper);margin-bottom:10px;cursor:pointer;border-radius:2px;font-family:var(--serif);font-size:15.5px;line-height:1.55">
              <input type="radio" name="q${qi}" value="${oi}" required style="margin-top:4px;flex-shrink:0;accent-color:var(--emerald)">
              <span>${escapeHTML(opt)}</span>
            </label>
          `).join('');
          return `
            <div class="card" style="margin-bottom:24px;padding:28px">
              <div style="font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold-deep);font-weight:600">${t('questionLabel')} ${qi+1} / ${m.quiz.length}</div>
              <div style="font-family:var(--serif);font-size:19px;line-height:1.55;color:var(--ink);margin:14px 0 22px">${escapeHTML(qd.q)}</div>
              ${opts}
            </div>
          `;
        }).join('')}
        <div style="text-align:center;margin-top:30px">
          <button type="submit" class="btn gold">${t('ctaSubmitQuiz')}</button>
        </div>
      </form>
      ${ms.quizAttempts.length ? `
        <div style="margin-top:30px;font-size:13px;color:var(--ink-soft);text-align:center">
          ${t('previousAttempts')}: ${ms.quizAttempts.map(a => `<span style="margin:0 6px;color:${a.passed?'var(--gold-deep)':'var(--crimson)'}">${a.score}%</span>`).join('·')}
        </div>` : ''}
      <div style="margin-top:14px;font-size:12px;color:var(--ink-soft);text-align:center;font-style:italic">${t('passRule')}</div>
    </div>
  `;
}

function paneCertificate(m, ms){
  if(!ms.passed){
    return `
      <div style="text-align:center;max-width:560px;margin:60px auto">
        <div style="font-size:48px;color:var(--ink-soft);opacity:.5">🏛</div>
        <h3 style="font-family:var(--display);font-style:italic;font-weight:400;font-size:30px;color:var(--ink);margin-top:18px">${t('certNotYetTitle')}</h3>
        <p style="font-family:var(--serif);font-size:16px;line-height:1.7;color:var(--ink-soft);margin-top:14px">${t('certNotYetBody')}</p>
        <button class="btn gold" data-tab="assessment" style="margin-top:24px">${t('ctaToAssessment')}</button>
      </div>
    `;
  }
  return `
    <div style="max-width:880px;margin:0 auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:14px" class="no-print">
        <div style="font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold-deep);font-weight:600">${t('certEyebrow')}</div>
        <button class="btn gold sm" data-action="print-cert">${t('ctaPrint')} / ${t('ctaSavePDF')}</button>
      </div>
      ${certificateMarkup(m, ms)}
    </div>
  `;
}

function certificateMarkup(m, ms){
  const data = m[L()];
  const userName = STATE.user.name || '—';
  const date = fmtDate(ms.certDate, L());
  const id = ms.certId || '—';
  return `
    <div class="cert-frame" style="background:linear-gradient(180deg, #f8f1df, #f3eacd);border:1px solid var(--gold);box-shadow:0 0 0 8px var(--paper) inset, 0 0 0 9px var(--gold) inset, 0 24px 70px -20px rgba(0,0,0,.35);padding:80px 80px 70px;position:relative;font-family:var(--serif)">
      <div style="text-align:center">
        <div style="display:inline-flex;align-items:center;justify-content:center;width:78px;height:78px;border:2px solid var(--gold-deep);border-radius:50%;font-family:var(--display);font-style:italic;font-size:44px;color:var(--gold-deep);background:rgba(255,255,255,.4)">N</div>
        <div style="margin-top:14px;font-size:11px;letter-spacing:.42em;text-transform:uppercase;color:var(--gold-deep);font-weight:700">${t('schoolName')}</div>
        <div style="margin-top:4px;font-size:10px;letter-spacing:.32em;text-transform:uppercase;color:var(--ink-soft)">${t('schoolMotto')} · Mark 10:43</div>
      </div>
      <div style="text-align:center;margin-top:50px">
        <div style="font-size:11px;letter-spacing:.42em;text-transform:uppercase;color:var(--ink-soft)">${t('certHereby')}</div>
        <div style="font-family:var(--display);font-style:italic;font-size:64px;color:var(--ink);line-height:1.1;margin:24px 0 12px;letter-spacing:.01em">${escapeHTML(userName)}</div>
        <div style="font-size:11px;letter-spacing:.42em;text-transform:uppercase;color:var(--ink-soft)">${t('certHasCompleted')}</div>
        <div style="margin-top:22px">
          <div style="font-size:11px;letter-spacing:.32em;text-transform:uppercase;color:var(--gold-deep);font-weight:600">${t('moduleLabel')} ${String(m.num).padStart(2,'0')} / 21</div>
          <div style="font-family:var(--display);font-style:italic;font-size:38px;color:var(--emerald-deep);line-height:1.2;margin-top:8px">${escapeHTML(data.title)}</div>
        </div>
        <div style="margin:36px auto 0;max-width:580px;font-size:14px;line-height:1.7;color:var(--ink-soft);font-style:italic">${t('certBlurb')}</div>
        <div style="margin-top:32px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold-deep);font-weight:600">${t('certScripture')}: "${escapeHTML(data.scripture.length > 110 ? data.scripture.slice(0,110)+'…' : data.scripture)}" — ${escapeHTML(data.scriptureCite)}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:40px;align-items:end;margin-top:60px">
        <div>
          <div style="font-family:var(--display);font-style:italic;font-size:24px;color:var(--ink);border-bottom:1px solid var(--ink);padding-bottom:6px;display:inline-block;min-width:240px">Innocent Forteh</div>
          <div style="font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:var(--ink-soft);margin-top:6px">${t('certSignFounder')}</div>
        </div>
        <div style="text-align:center">
          <div style="width:74px;height:74px;border-radius:50%;background:radial-gradient(circle at 35% 30%, #c4423a, #7a1f1f);box-shadow:0 4px 14px rgba(0,0,0,.3), inset -3px -3px 8px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;color:var(--gold-bright);font-family:var(--display);font-style:italic;font-size:22px;border:2px solid var(--gold-deep);margin:0 auto">N</div>
          <div style="font-size:9px;letter-spacing:.24em;text-transform:uppercase;color:var(--ink-soft);margin-top:6px;font-weight:600">${t('certSeal')}</div>
        </div>
        <div style="text-align:right">
          <div style="font-family:var(--serif);font-size:18px;color:var(--ink);border-bottom:1px solid var(--ink);padding-bottom:6px;display:inline-block;min-width:240px">${date}</div>
          <div style="font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:var(--ink-soft);margin-top:6px">${t('certSignDate')}</div>
        </div>
      </div>
      <div style="margin-top:36px;text-align:center;font-size:10px;letter-spacing:.16em;color:var(--ink-soft);font-family:var(--body)">
        ${t('certIdLabel')}: <span style="font-family:monospace;letter-spacing:.06em">${escapeHTML(id)}</span> &nbsp;·&nbsp; ${t('certVerify')}
      </div>
      <div style="position:absolute;top:24px;left:24px;font-family:var(--display);font-style:italic;font-size:32px;color:var(--gold);opacity:.55">✦</div>
      <div style="position:absolute;top:24px;right:24px;font-family:var(--display);font-style:italic;font-size:32px;color:var(--gold);opacity:.55">✦</div>
      <div style="position:absolute;bottom:24px;left:24px;font-family:var(--display);font-style:italic;font-size:32px;color:var(--gold);opacity:.55">✦</div>
      <div style="position:absolute;bottom:24px;right:24px;font-family:var(--display);font-style:italic;font-size:32px;color:var(--gold);opacity:.55">✦</div>
    </div>
  `;
}

/* ---------- VIEW: DIPLOMA ---------- */
function viewDiploma(){
  if(!diplomaEarned()){
    return `
      <section class="container" style="padding-top:80px;text-align:center;max-width:600px">
        <div style="font-size:48px;color:var(--ink-soft)">🏛</div>
        <h3 class="section-title" style="margin-top:20px">${t('diplomaNotYetTitle')}</h3>
        <p style="font-family:var(--serif);font-size:17px;color:var(--ink-soft);margin-top:14px;line-height:1.7">${t('diplomaNotYetBody').replace('{passed}', totalPassed()).replace('{total}', MODULES.length)}</p>
        <button class="btn gold" data-nav="dashboard" style="margin-top:30px">${t('ctaToStudies')}</button>
      </section>
    `;
  }
  // ensure diploma is issued
  const dip = diplomaState();
  if(!dip.issued){
    dip.issued = true;
    dip.id = genDiplomaId();
    dip.date = Date.now();
    saveState();
  }
  const date = fmtDate(dip.date, L());
  return `
    <section class="container" style="padding-top:40px;max-width:1000px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:14px" class="no-print">
        <div>
          <div style="font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold-deep);font-weight:600">${t('diplomaEyebrow')}</div>
          <h3 class="section-title">${t('diplomaTitle')}</h3>
        </div>
        <button class="btn gold" data-action="print-diploma">${t('ctaPrint')} / ${t('ctaSavePDF')}</button>
      </div>
      <div class="cert-frame" style="background:linear-gradient(180deg, #f8f1df, #f3eacd);border:1px solid var(--gold);box-shadow:0 0 0 12px var(--paper) inset, 0 0 0 13px var(--gold) inset, 0 0 0 18px var(--paper) inset, 0 0 0 19px var(--gold-deep) inset, 0 30px 80px -20px rgba(0,0,0,.4);padding:100px 100px 80px;position:relative;font-family:var(--serif)">
        <div style="text-align:center">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:96px;height:96px;border:3px solid var(--gold-deep);border-radius:50%;font-family:var(--display);font-style:italic;font-size:54px;color:var(--gold-deep);background:rgba(255,255,255,.4);box-shadow:inset 0 0 0 5px rgba(255,255,255,.5)">N</div>
          <div style="margin-top:18px;font-size:12px;letter-spacing:.5em;text-transform:uppercase;color:var(--gold-deep);font-weight:700">${t('schoolName')}</div>
          <div style="margin-top:4px;font-size:10px;letter-spacing:.36em;text-transform:uppercase;color:var(--ink-soft)">${t('schoolMotto')} · Mark 10:43</div>
        </div>
        <div style="text-align:center;margin-top:60px">
          <div style="font-family:var(--display);font-style:italic;font-size:46px;color:var(--gold-deep);line-height:1">${t('diplomaTitle')}</div>
          <div style="font-size:12px;letter-spacing:.42em;text-transform:uppercase;color:var(--ink-soft);margin-top:18px">${t('certHereby')}</div>
          <div style="font-family:var(--display);font-style:italic;font-size:78px;color:var(--ink);line-height:1.05;margin:28px 0 18px">${escapeHTML(STATE.user.name||'—')}</div>
          <div style="font-size:13px;letter-spacing:.32em;text-transform:uppercase;color:var(--ink-soft);max-width:680px;margin:0 auto;line-height:1.8">${t('diplomaBody')}</div>
          <div style="margin:34px auto 0;max-width:640px;font-size:15px;line-height:1.8;color:var(--ink);font-family:var(--serif);font-style:italic">"${t('diplomaQuote')}"</div>
          <div style="margin-top:8px;font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold-deep);font-weight:600">— Mark 10:43</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:50px;align-items:end;margin-top:80px">
          <div>
            <div style="font-family:var(--display);font-style:italic;font-size:28px;color:var(--ink);border-bottom:1px solid var(--ink);padding-bottom:6px;display:inline-block;min-width:280px">Innocent Forteh</div>
            <div style="font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:var(--ink-soft);margin-top:8px">${t('certSignFounder')}</div>
          </div>
          <div style="text-align:center">
            <div style="width:96px;height:96px;border-radius:50%;background:radial-gradient(circle at 35% 30%, #c4423a, #7a1f1f);box-shadow:0 6px 20px rgba(0,0,0,.4), inset -4px -4px 10px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;color:var(--gold-bright);font-family:var(--display);font-style:italic;font-size:28px;border:3px solid var(--gold-deep);margin:0 auto">N</div>
            <div style="font-size:9px;letter-spacing:.24em;text-transform:uppercase;color:var(--ink-soft);margin-top:6px;font-weight:600">${t('certSeal')}</div>
          </div>
          <div style="text-align:right">
            <div style="font-family:var(--serif);font-size:20px;color:var(--ink);border-bottom:1px solid var(--ink);padding-bottom:6px;display:inline-block;min-width:280px">${date}</div>
            <div style="font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:var(--ink-soft);margin-top:8px">${t('certSignDate')}</div>
          </div>
        </div>
        <div style="margin-top:40px;text-align:center;font-size:10px;letter-spacing:.16em;color:var(--ink-soft);font-family:var(--body)">
          ${t('diplomaIdLabel')}: <span style="font-family:monospace;letter-spacing:.06em">${escapeHTML(dip.id)}</span> &nbsp;·&nbsp; ${t('certVerify')}
        </div>
      </div>
    </section>
  `;
}

/* ---------- ADMIN VIEWS ---------- */

function rosterSummary(rec){
  const passed = Object.values(rec.modules||{}).filter(m=>m && m.passed).length;
  const pct = Math.round((passed / MODULES.length) * 100);
  const reflWords = Object.values(rec.modules||{}).reduce((s,m)=>s + (m && m.reflectionWords||0), 0);
  const allAttempts = Object.values(rec.modules||{}).reduce((s,m)=>s + ((m && m.quizAttempts) ? m.quizAttempts.length : 0), 0);
  return { passed, pct, reflWords, allAttempts, diploma: rec.diploma && rec.diploma.issued };
}

function viewAdminRoster(){
  const ids = Object.keys(ROSTER);
  const rows = ids.map(id => {
    const rec = ROSTER[id];
    const s = rosterSummary(rec);
    const enrolled = rec.user && rec.user.enrolledAt ? fmtDate(rec.user.enrolledAt, L()) : '—';
    const last = rec.lastActivity ? fmtDate(rec.lastActivity, L()) : '—';
    const notesCount = (rec.notes && rec.notes.general ? 1 : 0) + (rec.notes && rec.notes.perModule ? Object.keys(rec.notes.perModule).filter(k => rec.notes.perModule[k]).length : 0);
    return `
      <tr style="border-bottom:1px solid var(--rule);cursor:pointer" data-admin-student="${escapeHTML(id)}">
        <td style="padding:14px 12px;font-family:var(--serif);font-size:15.5px;color:var(--ink);font-weight:600">${escapeHTML(rec.user&&rec.user.name||'—')}</td>
        <td style="padding:14px 12px;font-size:13.5px;color:var(--ink-soft)">${escapeHTML(rec.user&&rec.user.email||'—')}</td>
        <td style="padding:14px 12px;font-size:13.5px;color:var(--ink-soft)">${escapeHTML(rec.user&&rec.user.country||'—')}</td>
        <td style="padding:14px 12px">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="flex:1;background:rgba(0,0,0,.06);border-radius:2px;height:6px;overflow:hidden;min-width:90px">
              <div style="background:linear-gradient(90deg, var(--emerald), var(--gold));height:100%;width:${s.pct}%"></div>
            </div>
            <div style="font-size:12.5px;color:var(--ink);font-weight:600;min-width:70px">${s.passed}/${MODULES.length}</div>
          </div>
          ${s.diploma ? `<div style="font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold-deep);font-weight:600;margin-top:4px">✦ ${t('adminDiplomaIssued')}</div>` : ''}
        </td>
        <td style="padding:14px 12px;font-size:12.5px;color:var(--ink-soft);text-align:center">${notesCount > 0 ? `<span style="color:var(--gold-deep);font-weight:600">✎ ${notesCount}</span>` : '—'}</td>
        <td style="padding:14px 12px;font-size:12px;color:var(--ink-soft)">${last}</td>
        <td style="padding:14px 12px;text-align:right"><button class="btn ghost sm">${t('adminViewBtn')} →</button></td>
      </tr>
    `;
  }).join('');

  const empty = ids.length === 0 ? `
    <div class="card parchment" style="padding:60px 40px;text-align:center;margin-top:30px">
      <div style="font-family:var(--display);font-style:italic;font-size:36px;color:var(--ink-soft)">${t('adminEmptyTitle')}</div>
      <p style="font-family:var(--serif);font-size:16px;line-height:1.7;color:var(--ink-soft);margin:18px auto 0;max-width:520px">${t('adminEmptyBody')}</p>
      <div style="margin-top:24px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <button class="btn ghost" data-action="admin-seed-demo">${t('adminSeedDemo')}</button>
        <button class="btn ghost" data-action="admin-import-student">${t('adminImportBtn')}</button>
      </div>
    </div>
  ` : '';

  return `
    <section class="container" style="padding-top:40px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:20px">
        <div>
          <div class="section-eyebrow">${t('adminEyebrow')}</div>
          <h3 class="section-title">${t('adminRosterTitle')}</h3>
          <p style="font-family:var(--serif);font-size:15px;color:var(--ink-soft);margin-top:10px;max-width:680px;line-height:1.6">${t('adminRosterIntro')}</p>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <button class="btn ghost sm" data-action="admin-import-student">${t('adminImportBtn')}</button>
          <button class="btn ghost sm" data-action="admin-export-roster" ${ids.length===0?'disabled style="opacity:.5;cursor:not-allowed"':''}>${t('adminExportBtn')}</button>
          ${ids.length === 0 ? `<button class="btn gold sm" data-action="admin-seed-demo">${t('adminSeedDemo')}</button>` : ''}
        </div>
      </div>
      <input id="admin-import-input" type="file" accept=".json,application/json" style="display:none">

      ${empty}

      ${ids.length > 0 ? `
      <div style="margin-top:30px;display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:14px">
        <div class="card" style="padding:20px"><div style="font-size:10.5px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold-deep);font-weight:600">${t('adminStatStudents')}</div><div style="font-family:var(--display);font-style:italic;font-size:40px;color:var(--ink);line-height:1;margin-top:6px">${ids.length}</div></div>
        <div class="card" style="padding:20px"><div style="font-size:10.5px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold-deep);font-weight:600">${t('adminStatDiplomas')}</div><div style="font-family:var(--display);font-style:italic;font-size:40px;color:var(--gold-deep);line-height:1;margin-top:6px">${ids.filter(id => ROSTER[id].diploma && ROSTER[id].diploma.issued).length}</div></div>
        <div class="card" style="padding:20px"><div style="font-size:10.5px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold-deep);font-weight:600">${t('adminStatModulesPassed')}</div><div style="font-family:var(--display);font-style:italic;font-size:40px;color:var(--emerald);line-height:1;margin-top:6px">${ids.reduce((s,id)=>s + rosterSummary(ROSTER[id]).passed, 0)}</div></div>
        <div class="card" style="padding:20px"><div style="font-size:10.5px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold-deep);font-weight:600">${t('adminStatNotes')}</div><div style="font-family:var(--display);font-style:italic;font-size:40px;color:var(--ink);line-height:1;margin-top:6px">${ids.reduce((s,id)=>{const n=ROSTER[id].notes||{general:'',perModule:{}};return s+(n.general?1:0)+Object.values(n.perModule||{}).filter(Boolean).length;},0)}</div></div>
      </div>

      <div class="card" style="margin-top:30px;padding:0;overflow:hidden">
        <table style="width:100%;border-collapse:collapse;font-family:var(--body)">
          <thead>
            <tr style="background:rgba(15,77,56,.06);border-bottom:1px solid var(--rule)">
              <th style="padding:14px 12px;text-align:left;font-size:10.5px;letter-spacing:.24em;text-transform:uppercase;color:var(--gold-deep);font-weight:600">${t('adminColName')}</th>
              <th style="padding:14px 12px;text-align:left;font-size:10.5px;letter-spacing:.24em;text-transform:uppercase;color:var(--gold-deep);font-weight:600">${t('adminColEmail')}</th>
              <th style="padding:14px 12px;text-align:left;font-size:10.5px;letter-spacing:.24em;text-transform:uppercase;color:var(--gold-deep);font-weight:600">${t('adminColCountry')}</th>
              <th style="padding:14px 12px;text-align:left;font-size:10.5px;letter-spacing:.24em;text-transform:uppercase;color:var(--gold-deep);font-weight:600">${t('adminColProgress')}</th>
              <th style="padding:14px 12px;text-align:center;font-size:10.5px;letter-spacing:.24em;text-transform:uppercase;color:var(--gold-deep);font-weight:600">${t('adminColNotes')}</th>
              <th style="padding:14px 12px;text-align:left;font-size:10.5px;letter-spacing:.24em;text-transform:uppercase;color:var(--gold-deep);font-weight:600">${t('adminColLastActivity')}</th>
              <th style="padding:14px 12px"></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ` : ''}

      <div style="margin-top:30px;padding:18px 22px;background:rgba(15,77,56,.06);border-left:3px solid var(--emerald);font-size:13.5px;line-height:1.7;color:var(--ink);max-width:900px">
        <strong style="color:var(--emerald-deep)">${t('adminNote')}</strong> ${t('adminLocalDeviceNote')}
      </div>
    </section>
  `;
}

function viewAdminStudent(){
  const id = STATE.adminViewing;
  if(!id || !ROSTER[id]){ navigate('admin'); return ''; }
  const rec = ROSTER[id];
  const s = rosterSummary(rec);
  const notes = rec.notes || (rec.notes = { general:'', perModule:{} });
  const enrolled = rec.user && rec.user.enrolledAt ? fmtDate(rec.user.enrolledAt, L()) : '—';
  const last = rec.lastActivity ? fmtDate(rec.lastActivity, L()) : '—';

  const moduleRows = MODULES.map(m => {
    const ms = (rec.modules && rec.modules[m.num]) || {};
    const passed = !!ms.passed;
    const attempts = (ms.quizAttempts || []).length;
    const lastScore = attempts ? (ms.quizAttempts[attempts-1].score + '%') : '—';
    const bestScore = attempts ? (Math.max(...ms.quizAttempts.map(a=>a.score)) + '%') : '—';
    const reflWords = ms.reflectionWords || 0;
    const note = (notes.perModule && notes.perModule[m.num]) || '';
    return `
      <div class="card" style="margin-bottom:14px;padding:22px;border-left:3px solid ${passed?'var(--gold-deep)':'var(--rule)'}">
        <div style="display:grid;grid-template-columns:60px 1fr auto;gap:16px;align-items:baseline">
          <div style="font-family:var(--display);font-style:italic;font-size:30px;color:${passed?'var(--gold-deep)':'var(--ink-soft)'}">${String(m.num).padStart(2,'0')}</div>
          <div>
            <div style="font-family:var(--serif);font-size:18px;color:var(--ink)">${escapeHTML(m[L()].title)}</div>
            <div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:8px;font-size:12px;color:var(--ink-soft)">
              <span><strong style="color:var(--ink)">${t('adminModStatus')}:</strong> ${passed?`<span style="color:var(--gold-deep)">✦ ${t('statusPassed')}</span>`:t('adminNotYet')}</span>
              <span><strong style="color:var(--ink)">${t('adminModAttempts')}:</strong> ${attempts}</span>
              <span><strong style="color:var(--ink)">${t('adminModBest')}:</strong> ${bestScore}</span>
              <span><strong style="color:var(--ink)">${t('adminModLast')}:</strong> ${lastScore}</span>
              <span><strong style="color:var(--ink)">${t('adminModRefl')}:</strong> ${reflWords} ${t('wordsLabel')}</span>
              ${ms.certId ? `<span><strong style="color:var(--ink)">${t('certIdLabel')}:</strong> <code style="font-size:11px;color:var(--gold-deep)">${escapeHTML(ms.certId)}</code></span>` : ''}
            </div>
            ${ms.reflection ? `<details style="margin-top:10px"><summary style="cursor:pointer;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold-deep);font-weight:600">${t('adminViewReflection')}</summary><div style="margin-top:10px;padding:14px 16px;background:rgba(255,255,255,.5);border-left:2px solid var(--gold);font-family:var(--serif);font-size:14px;line-height:1.7;color:var(--ink);white-space:pre-wrap;max-height:240px;overflow-y:auto">${escapeHTML(ms.reflection)}</div></details>` : ''}
          </div>
          <div></div>
        </div>
        <div style="margin-top:16px;padding-top:14px;border-top:1px dotted var(--rule)">
          <div style="font-size:10.5px;letter-spacing:.24em;text-transform:uppercase;color:var(--gold-deep);font-weight:600;margin-bottom:6px">${t('adminModNoteLabel')}</div>
          <textarea id="note-mod-${m.num}" placeholder="${t('adminModNotePlaceholder').replace('{num}', m.num)}" style="width:100%;min-height:70px;padding:10px 14px;border:1px solid var(--rule);background:rgba(255,255,255,.6);font-family:var(--serif);font-size:14.5px;line-height:1.5;color:var(--ink);resize:vertical">${escapeHTML(note)}</textarea>
          <div style="margin-top:8px;text-align:right"><button class="btn ghost sm" data-action="admin-save-module-note" data-mod-num="${m.num}">${t('ctaSaveNote')}</button></div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <section class="container" style="padding-top:40px">
      <div style="margin-bottom:16px"><button class="btn ghost sm" data-action="admin-back">← ${t('adminBackToRoster')}</button></div>

      <div class="card parchment" style="padding:36px 40px">
        <div style="display:grid;grid-template-columns:1fr auto;gap:30px;align-items:start">
          <div>
            <div style="font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold-deep);font-weight:600">${t('adminStudentProfile')}</div>
            <div style="font-family:var(--display);font-style:italic;font-size:46px;color:var(--ink);line-height:1.05;margin:6px 0 8px">${escapeHTML(rec.user&&rec.user.name||'—')}</div>
            <div style="font-size:14px;color:var(--ink-soft);line-height:1.7">
              <div>${escapeHTML(rec.user&&rec.user.email||'—')} · ${escapeHTML(rec.user&&rec.user.country||'—')}</div>
              <div style="margin-top:2px"><span style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold-deep)">${t('adminEnrolledOn')}</span> ${enrolled} · <span style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold-deep)">${t('adminLastSeen')}</span> ${last}</div>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-family:var(--display);font-style:italic;font-size:48px;color:var(--gold-deep);line-height:1">${s.passed}/${MODULES.length}</div>
            <div style="font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--ink-soft);font-weight:600">${t('adminModsPassed')}</div>
            ${s.diploma ? `<div style="margin-top:8px;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold-deep);font-weight:700">✦ ${t('adminDiplomaIssued')}</div>` : ''}
          </div>
        </div>
        <div style="margin-top:20px;background:rgba(0,0,0,.06);border-radius:2px;height:8px;overflow:hidden">
          <div style="background:linear-gradient(90deg, var(--emerald), var(--gold));height:100%;width:${s.pct}%"></div>
        </div>
      </div>

      <div class="card deep" style="padding:32px 38px;margin-top:24px">
        <div style="font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold-bright);font-weight:600">${t('adminGeneralNoteEyebrow')}</div>
        <h3 style="font-family:var(--display);font-style:italic;font-weight:400;font-size:30px;color:var(--paper);margin:6px 0 10px">${t('adminGeneralNoteTitle')}</h3>
        <p style="font-size:14px;color:var(--paper);opacity:.9;line-height:1.65;margin-bottom:16px">${t('adminGeneralNoteIntro')}</p>
        <textarea id="note-general" placeholder="${t('adminGeneralNotePlaceholder')}" style="width:100%;min-height:120px;padding:14px 18px;border:1px solid rgba(214,168,60,.4);background:rgba(255,255,255,.07);font-family:var(--serif);font-size:15.5px;line-height:1.65;color:var(--paper);resize:vertical;border-radius:2px">${escapeHTML(notes.general||'')}</textarea>
        <div style="margin-top:12px;text-align:right"><button class="btn gold sm" data-action="admin-save-general-note">${t('ctaSaveNote')}</button></div>
      </div>

      <div style="margin-top:40px">
        <div class="section-eyebrow">${t('adminModulesEyebrow')}</div>
        <h3 class="section-title" style="font-size:34px;margin-top:8px">${t('adminModulesTitle')}</h3>
        <div style="margin-top:24px">${moduleRows}</div>
      </div>

      <div style="margin-top:40px;padding-top:24px;border-top:1px solid var(--rule);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px">
        <div style="font-size:13px;color:var(--ink-soft)">${t('adminDangerZone')}</div>
        <button class="btn ghost sm" data-action="admin-delete-student" data-student-id="${escapeHTML(id)}" style="color:var(--crimson);border-color:var(--crimson)">${t('ctaDeleteStudent')}</button>
      </div>
    </section>
  `;
}

function saveAdminNote(kind, modNum){
  const id = STATE.adminViewing;
  if(!id || !ROSTER[id]) return;
  const rec = ROSTER[id];
  if(!rec.notes) rec.notes = { general:'', perModule:{} };
  if(kind === 'general'){
    const ta = document.getElementById('note-general');
    if(ta) rec.notes.general = ta.value || '';
  } else if(kind === 'module'){
    const ta = document.getElementById('note-mod-' + modNum);
    if(ta){
      if(!rec.notes.perModule) rec.notes.perModule = {};
      rec.notes.perModule[modNum] = ta.value || '';
    }
  }
  saveRoster();
  flashSaved(kind === 'general' ? '[data-action="admin-save-general-note"]' : `[data-action="admin-save-module-note"][data-mod-num="${modNum}"]`);
}

function flashSaved(selector){
  const btn = document.querySelector(selector);
  if(!btn) return;
  const orig = btn.textContent;
  btn.textContent = '✓ ' + t('saved');
  setTimeout(() => { btn.textContent = orig; }, 1400);
}

function exportRoster(){
  const blob = new Blob([JSON.stringify(ROSTER, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ndezo-roster-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
}

function importStudentRecord(parsed){
  // Accept either a single student record or a full roster object
  if(parsed && parsed.studentId && parsed.user){
    // single record
    ROSTER[parsed.studentId] = Object.assign({ notes:{ general:'', perModule:{} } }, parsed);
    saveRoster();
    return;
  }
  if(parsed && typeof parsed === 'object'){
    // assume roster format
    let imported = 0;
    for(const key in parsed){
      const r = parsed[key];
      if(r && r.user && r.user.email){
        const sid = r.studentId || studentIdFromEmail(r.user.email);
        ROSTER[sid] = Object.assign({ notes:{ general:'', perModule:{} } }, r, { studentId: sid });
        imported++;
      }
    }
    saveRoster();
    if(imported === 0) throw new Error(t('adminImportNoStudents'));
    return;
  }
  throw new Error(t('adminImportBadFormat'));
}

function seedDemoStudents(){
  const now = Date.now();
  const day = 86400000;
  const seedData = [
    {
      name: 'Aminata Okafor', email: 'aminata.okafor@example.com', country: 'Nigeria',
      enrolledAt: now - 40*day, lastActivity: now - 1*day,
      passedCount: 8, hasDiploma: false,
      generalNote: 'Aminata — your reflection on Module 6 (Humility) was one of the most honest pieces of writing I have read in this academy. Keep going. You are not behind. You are deep.'
    },
    {
      name: 'Daniel Mbeki', email: 'd.mbeki@example.com', country: 'South Africa',
      enrolledAt: now - 70*day, lastActivity: now - 4*day,
      passedCount: 14, hasDiploma: false,
      generalNote: 'Daniel — I see the consistency. Three modules in two weeks while still leading your team. The discipline you are building now will hold you in the dark seasons. Welcome to Module 15.'
    },
    {
      name: 'Marie Nkemdirim', email: 'marie.n@example.com', country: 'Cameroon',
      enrolledAt: now - 120*day, lastActivity: now - 7*day,
      passedCount: 21, hasDiploma: true,
      generalNote: 'Marie — felicitations. The Diploma is yours. Now the real assignment begins: find one person this year you will personally pour into. The baton must keep moving. Proud of you.'
    },
    {
      name: 'Joseph Kamau', email: 'jkamau@example.com', country: 'Kenya',
      enrolledAt: now - 14*day, lastActivity: now - 2*day,
      passedCount: 3, hasDiploma: false,
      generalNote: 'Joseph — welcome. I am glad you began. The first three weeks are about settling in; the work gets deeper from Module 4 onward. Take your time. Write before you are tested.'
    }
  ];
  seedData.forEach(d => {
    const sid = studentIdFromEmail(d.email);
    if(ROSTER[sid]) return; // don't overwrite real users
    const modules = {};
    for(let i = 1; i <= d.passedCount; i++){
      modules[i] = {
        reflection: 'I have read this module carefully and reflected on what it asks of me. The teaching on this week confronts me precisely where I needed to be confronted. I am noting the specific actions I will take and the people I will speak with this week. I am committing to live what I have learnt, not just to know it. The Lord help me to walk in this.',
        reflectionWords: 215,
        quizAttempts: [{ score: 80 + Math.floor(Math.random()*20), passed: true, date: d.lastActivity, correct:4, total:5 }],
        passed: true,
        certId: `NSC-M${String(i).padStart(2,'0')}-DEMO-${Math.random().toString(36).slice(2,6).toUpperCase()}`,
        certDate: d.lastActivity - (d.passedCount - i)*day
      };
    }
    ROSTER[sid] = {
      studentId: sid,
      user: { name: d.name, email: d.email, country: d.country, enrolledAt: d.enrolledAt },
      modules,
      diploma: d.hasDiploma ? { issued:true, id:`NSC-DIPLOMA-DEMO-${Math.random().toString(36).slice(2,6).toUpperCase()}`, date: d.lastActivity } : null,
      notes: { general: d.generalNote, perModule: {} },
      lastActivity: d.lastActivity
    };
  });
  saveRoster();
}


/* ---------- SIGN-IN MODAL ---------- */
function signinModal(){
  const tab = STATE.modalTab || 'enroll';
  return `
    <div id="modal" style="position:fixed;inset:0;background:rgba(7,42,30,.78);display:flex;align-items:center;justify-content:center;z-index:1000;padding:24px">
      <div class="card parchment" style="max-width:540px;width:100%;padding:0;position:relative;overflow:hidden">
        <button data-action="close-modal" style="position:absolute;top:14px;right:14px;background:none;border:none;font-size:20px;color:var(--ink-soft);cursor:pointer;z-index:2">×</button>
        <div style="display:flex;border-bottom:1px solid var(--rule);background:rgba(255,255,255,.4)">
          <button data-modal-tab="enroll" style="flex:1;padding:18px;border:none;background:${tab==='enroll'?'transparent':'rgba(0,0,0,.04)'};color:${tab==='enroll'?'var(--emerald-deep)':'var(--ink-soft)'};font-family:var(--body);font-size:11.5px;letter-spacing:.24em;text-transform:uppercase;font-weight:${tab==='enroll'?'700':'500'};border-bottom:2px solid ${tab==='enroll'?'var(--gold)':'transparent'};cursor:pointer">${t('modalTabEnroll')}</button>
          <button data-modal-tab="admin" style="flex:1;padding:18px;border:none;background:${tab==='admin'?'transparent':'rgba(0,0,0,.04)'};color:${tab==='admin'?'var(--emerald-deep)':'var(--ink-soft)'};font-family:var(--body);font-size:11.5px;letter-spacing:.24em;text-transform:uppercase;font-weight:${tab==='admin'?'700':'500'};border-bottom:2px solid ${tab==='admin'?'var(--gold)':'transparent'};cursor:pointer">${t('modalTabAdmin')}</button>
        </div>
        <div style="padding:38px 44px 40px">
          ${tab === 'enroll' ? enrollPane() : adminPane()}
        </div>
      </div>
    </div>
  `;
}

function enrollPane(){
  return `
    <div style="font-size:11px;letter-spacing:.32em;text-transform:uppercase;color:var(--gold-deep);font-weight:600">${t('enrollEyebrow')}</div>
    <h3 style="font-family:var(--display);font-style:italic;font-weight:400;font-size:36px;color:var(--ink);margin:8px 0 14px">${t('enrollTitle')}</h3>
    <p style="font-family:var(--serif);font-size:15px;line-height:1.7;color:var(--ink-soft);margin-bottom:22px">${t('enrollIntro')}</p>
    <form id="enroll-form">
      <label style="display:block;margin-bottom:14px">
        <div style="font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold-deep);font-weight:600;margin-bottom:6px">${t('enrollFullName')}</div>
        <input name="name" required style="width:100%;padding:12px 16px;border:1px solid var(--rule);font-family:var(--serif);font-size:16px;background:rgba(255,255,255,.7);color:var(--ink)">
      </label>
      <label style="display:block;margin-bottom:14px">
        <div style="font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold-deep);font-weight:600;margin-bottom:6px">${t('enrollEmail')}</div>
        <input name="email" type="email" required style="width:100%;padding:12px 16px;border:1px solid var(--rule);font-family:var(--serif);font-size:16px;background:rgba(255,255,255,.7);color:var(--ink)">
      </label>
      <label style="display:block;margin-bottom:20px">
        <div style="font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold-deep);font-weight:600;margin-bottom:6px">${t('enrollCountry')}</div>
        <input name="country" required style="width:100%;padding:12px 16px;border:1px solid var(--rule);font-family:var(--serif);font-size:16px;background:rgba(255,255,255,.7);color:var(--ink)">
      </label>
      <label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:22px;font-size:13.5px;line-height:1.55;color:var(--ink-soft)">
        <input type="checkbox" required style="margin-top:4px;flex-shrink:0;accent-color:var(--emerald)">
        <span>${t('enrollCovenant')}</span>
      </label>
      <button type="submit" class="btn gold" style="width:100%">${t('ctaCommitEnroll')}</button>
      <div style="margin-top:14px;font-size:12px;color:var(--ink-soft);text-align:center;font-style:italic">${t('enrollFreeNote')}</div>
    </form>
  `;
}

function adminPane(){
  const err = STATE.adminError ? `<div style="margin-bottom:14px;padding:10px 14px;background:rgba(159,53,46,.1);border-left:3px solid var(--crimson);color:var(--crimson);font-size:13.5px;font-family:var(--serif)">${t('adminBadCredentials')}</div>` : '';
  return `
    <div style="font-size:11px;letter-spacing:.32em;text-transform:uppercase;color:var(--gold-deep);font-weight:600">${t('adminLoginEyebrow')}</div>
    <h3 style="font-family:var(--display);font-style:italic;font-weight:400;font-size:36px;color:var(--ink);margin:8px 0 14px">${t('adminLoginTitle')}</h3>
    <p style="font-family:var(--serif);font-size:15px;line-height:1.7;color:var(--ink-soft);margin-bottom:22px">${t('adminLoginIntro')}</p>
    ${err}
    <form id="admin-form">
      <label style="display:block;margin-bottom:14px">
        <div style="font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold-deep);font-weight:600;margin-bottom:6px">${t('adminUsername')}</div>
        <input name="username" autocomplete="username" required style="width:100%;padding:12px 16px;border:1px solid var(--rule);font-family:var(--serif);font-size:16px;background:rgba(255,255,255,.7);color:var(--ink)">
      </label>
      <label style="display:block;margin-bottom:20px">
        <div style="font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold-deep);font-weight:600;margin-bottom:6px">${t('adminPassword')}</div>
        <input name="password" type="password" autocomplete="current-password" required style="width:100%;padding:12px 16px;border:1px solid var(--rule);font-family:var(--serif);font-size:16px;background:rgba(255,255,255,.7);color:var(--ink)">
      </label>
      <button type="submit" class="btn gold" style="width:100%">${t('ctaAdminSignIn')}</button>
      <div style="margin-top:14px;font-size:12px;color:var(--ink-soft);text-align:center;font-style:italic">${t('adminLoginNote')}</div>
    </form>
  `;
}

/* ---------- RENDER ---------- */
function render(){
  let main = '';
  if(STATE.view === 'landing') main = viewLanding();
  else if(STATE.view === 'curriculum') main = viewCurriculum();
  else if(STATE.view === 'founder') main = viewFounder();
  else if(STATE.view === 'dashboard') main = STATE.enrolled ? viewDashboard() : viewLanding();
  else if(STATE.view === 'module') main = STATE.enrolled ? viewModule() : viewLanding();
  else if(STATE.view === 'diploma') main = STATE.enrolled ? viewDiploma() : viewLanding();
  else if(STATE.view === 'admin') main = STATE.adminMode ? viewAdminRoster() : viewLanding();
  else if(STATE.view === 'admin-student') main = STATE.adminMode ? viewAdminStudent() : viewLanding();
  else main = viewLanding();

  let html = topbar() + `<main>${main}</main>` + footer();
  if(STATE.modal === 'signin') html += signinModal();

  document.getElementById('app').innerHTML = html;
  attach();
}

/* ---------- EVENT BINDING ---------- */
function attach(){
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const v = el.dataset.nav;
      navigate(v);
    });
  });
  document.querySelectorAll('[data-lang]').forEach(el => {
    el.addEventListener('click', () => {
      STATE.lang = el.dataset.lang;
      saveState();
      render();
    });
  });
  document.querySelectorAll('[data-mod]').forEach(el => {
    el.addEventListener('click', () => {
      const n = parseInt(el.dataset.mod, 10);
      if(STATE.adminMode){ return; /* admin uses data-admin-mod */ }
      if(!STATE.enrolled){ STATE.modal='signin'; STATE.modalTab='enroll'; render(); return; }
      if(!isModuleUnlocked(n)) return;
      STATE.currentTab = 'teaching';
      navigate('module', { module:n });
    });
  });
  document.querySelectorAll('[data-tab]').forEach(el => {
    el.addEventListener('click', () => {
      // save reflection if leaving reflection tab
      if(STATE.currentTab === 'reflection'){ saveReflection(false); }
      STATE.currentTab = el.dataset.tab;
      saveState();
      render();
    });
  });
  document.querySelectorAll('[data-modal-tab]').forEach(el => {
    el.addEventListener('click', () => {
      STATE.modalTab = el.dataset.modalTab;
      STATE.adminError = false;
      render();
    });
  });
  document.querySelectorAll('[data-admin-student]').forEach(el => {
    el.addEventListener('click', () => {
      STATE.adminViewing = el.dataset.adminStudent;
      navigate('admin-student');
    });
  });
  document.querySelectorAll('[data-action]').forEach(el => {
    el.addEventListener('click', (e) => {
      const a = el.dataset.action;
      if(a === 'signin' || a === 'enroll'){ STATE.modal='signin'; STATE.modalTab = (a==='signin'?(STATE.modalTab||'enroll'):'enroll'); STATE.adminError=false; render(); }
      else if(a === 'close-modal'){ STATE.modal=null; STATE.adminError=false; render(); }
      else if(a === 'signout'){
        if(confirm(t('confirmSignOut'))){
          STATE = defaultState();
          saveState();
          render();
        }
      }
      else if(a === 'admin-signout'){
        STATE.adminMode = false;
        STATE.adminViewing = null;
        STATE.view = 'landing';
        try { localStorage.removeItem(ADMIN_KEY); } catch(e){}
        saveState();
        render();
      }
      else if(a === 'save-reflection'){ saveReflection(true); }
      else if(a === 'save-and-assess'){ saveReflection(false); STATE.currentTab='assessment'; saveState(); render(); }
      else if(a === 'retake-quiz'){
        const ms = getModState(STATE.currentModule);
        ms.passed = false;
        saveState();
        render();
      }
      else if(a === 'print-cert' || a === 'print-diploma'){ window.print(); }
      else if(a === 'admin-back'){ STATE.adminViewing=null; navigate('admin'); }
      else if(a === 'admin-save-general-note'){ saveAdminNote('general'); }
      else if(a === 'admin-save-module-note'){ saveAdminNote('module', parseInt(el.dataset.modNum,10)); }
      else if(a === 'admin-export-roster'){ exportRoster(); }
      else if(a === 'admin-import-student'){ document.getElementById('admin-import-input').click(); }
      else if(a === 'admin-delete-student'){
        const sid = el.dataset.studentId;
        if(sid && confirm(t('adminConfirmDelete'))){
          delete ROSTER[sid];
          saveRoster();
          STATE.adminViewing = null;
          navigate('admin');
        }
      }
      else if(a === 'admin-seed-demo'){ seedDemoStudents(); render(); }
    });
  });
  // enrol form
  const f = document.getElementById('enroll-form');
  if(f){
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(f);
      STATE.user = {
        name: (fd.get('name')||'').toString().trim(),
        email: (fd.get('email')||'').toString().trim(),
        country: (fd.get('country')||'').toString().trim(),
        enrolledAt: Date.now()
      };
      STATE.enrolled = true;
      STATE.modal = null;
      STATE.view = 'dashboard';
      saveState();
      syncToRoster();
      render();
    });
  }
  // admin form
  const af = document.getElementById('admin-form');
  if(af){
    af.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(af);
      const u = (fd.get('username')||'').toString().trim();
      const p = (fd.get('password')||'').toString();
      if(u === ADMIN_USERNAME && p === ADMIN_PASSWORD){
        STATE.adminMode = true;
        STATE.modal = null;
        STATE.adminError = false;
        STATE.view = 'admin';
        try { localStorage.setItem(ADMIN_KEY, JSON.stringify({ since: Date.now() })); } catch(e){}
        saveState();
        render();
      } else {
        STATE.adminError = true;
        render();
      }
    });
  }
  // admin import file input
  const importInput = document.getElementById('admin-import-input');
  if(importInput){
    importInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          importStudentRecord(parsed);
          render();
        } catch(err){ alert(t('adminImportError') + ': ' + err.message); }
      };
      reader.readAsText(file);
    });
  }
  // reflection live count
  const refl = document.getElementById('refl-text');
  if(refl){
    refl.addEventListener('input', () => {
      const wc = wordCount(refl.value);
      const counter = document.getElementById('refl-count');
      if(counter) counter.textContent = wc;
      const btn = document.querySelector('[data-action="save-and-assess"]');
      if(btn){
        if(wc >= 200){ btn.removeAttribute('disabled'); btn.style.opacity='1'; btn.style.cursor='pointer'; }
        else { btn.setAttribute('disabled',''); btn.style.opacity='.5'; btn.style.cursor='not-allowed'; }
      }
    });
  }
  // quiz form
  const qf = document.getElementById('quiz-form');
  if(qf){
    qf.addEventListener('submit', (e) => {
      e.preventDefault();
      submitQuiz();
    });
  }
}

function saveReflection(showFeedback){
  const refl = document.getElementById('refl-text');
  if(!refl) return;
  const ms = getModState(STATE.currentModule);
  ms.reflection = refl.value;
  ms.reflectionWords = wordCount(refl.value);
  saveState();
  if(showFeedback){
    const btn = document.querySelector('[data-action="save-reflection"]');
    if(btn){
      const orig = btn.textContent;
      btn.textContent = '✓ ' + t('saved');
      setTimeout(() => { btn.textContent = orig; }, 1400);
    }
  }
}

function submitQuiz(){
  const m = MODULES.find(x => x.num === STATE.currentModule);
  if(!m) return;
  const ms = getModState(m.num);
  let correct = 0;
  const detail = [];
  m.quiz.forEach((q, i) => {
    const sel = document.querySelector(`input[name="q${i}"]:checked`);
    const chosen = sel ? parseInt(sel.value, 10) : -1;
    const isCorrect = chosen === q[L()].correct;
    if(isCorrect) correct++;
    detail.push({ chosen, correct: q[L()].correct, isCorrect, why: q[L()].why, q: q[L()].q });
  });
  const score = Math.round((correct / m.quiz.length) * 100);
  const passed = score >= 80;
  ms.quizAttempts.push({ score, passed, date: Date.now(), correct, total: m.quiz.length });
  if(passed){
    ms.passed = true;
    if(!ms.certId){
      ms.certId = genCertId(m.num);
      ms.certDate = Date.now();
    }
  }
  saveState();
  showQuizResult(m, score, passed, detail);
}

function showQuizResult(m, score, passed, detail){
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(7,42,30,.85);display:flex;align-items:center;justify-content:center;z-index:1000;padding:24px;overflow-y:auto';
  overlay.innerHTML = `
    <div class="card parchment" style="max-width:680px;width:100%;padding:50px 50px 40px;max-height:90vh;overflow-y:auto">
      <div style="text-align:center">
        <div style="font-family:var(--display);font-style:italic;font-size:72px;color:${passed?'var(--gold-deep)':'var(--crimson)'};line-height:1">${passed?'✦':'✗'}</div>
        <h3 style="font-family:var(--display);font-style:italic;font-weight:400;font-size:38px;color:var(--ink);margin:14px 0 8px">${passed?t('quizPassedTitle'):t('quizFailedTitle')}</h3>
        <div style="font-family:var(--serif);font-size:20px;color:var(--ink-soft)">${t('youScored')} <strong style="color:${passed?'var(--gold-deep)':'var(--crimson)'};font-size:30px;font-family:var(--display);font-style:italic">${score}%</strong></div>
        <div style="margin-top:6px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-soft)">${t('passRule')}</div>
      </div>
      <div style="margin-top:30px;border-top:1px solid var(--rule);padding-top:24px">
        <div style="font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold-deep);font-weight:600;margin-bottom:14px">${t('reviewLabel')}</div>
        ${detail.map((d, i) => `
          <div style="margin-bottom:18px;padding:14px 16px;border-left:3px solid ${d.isCorrect?'var(--gold-deep)':'var(--crimson)'};background:rgba(255,255,255,.5);font-family:var(--serif)">
            <div style="font-size:14.5px;line-height:1.55;color:var(--ink);font-weight:600;margin-bottom:6px">${i+1}. ${escapeHTML(d.q)}</div>
            <div style="font-size:13.5px;color:${d.isCorrect?'var(--gold-deep)':'var(--crimson)'};font-weight:600">${d.isCorrect?'✓ '+t('correct'):'✗ '+t('incorrect')}</div>
            <div style="font-size:13.5px;color:var(--ink-soft);line-height:1.6;margin-top:6px;font-style:italic">${escapeHTML(d.why)}</div>
          </div>
        `).join('')}
      </div>
      <div style="margin-top:24px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        ${passed
          ? `<button class="btn gold" id="qr-cert">${t('ctaViewCertificate')} →</button><button class="btn ghost" id="qr-close">${t('ctaClose')}</button>`
          : `<button class="btn gold" id="qr-retry">${t('ctaTryAgain')}</button><button class="btn ghost" id="qr-back">${t('ctaBackToTeaching')}</button>`
        }
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  if(passed){
    overlay.querySelector('#qr-cert').addEventListener('click', () => { close(); STATE.currentTab='certificate'; saveState(); render(); });
    overlay.querySelector('#qr-close').addEventListener('click', () => { close(); render(); });
  } else {
    overlay.querySelector('#qr-retry').addEventListener('click', () => { close(); render(); });
    overlay.querySelector('#qr-back').addEventListener('click', () => { close(); STATE.currentTab='teaching'; saveState(); render(); });
  }
}

/* ---------- BOOT ---------- */
document.addEventListener('DOMContentLoaded', render);
if(document.readyState !== 'loading') render();

})();
