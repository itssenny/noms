import { supabase } from './supabase-client.js';

const profileView = document.querySelector('#profile-view');
const profileButton = document.querySelector('#profile-button');
const cuisines = ['Italian', 'Japanese', 'Chinese', 'Mexican', 'Korean', 'Mediterranean', 'Indian', 'Thai', 'French', 'Middle Eastern'];
let session = null;
let visitorRequest=0;
let profileCollectionContext=null,profileCollectionRequest=0;
function profileCollectionTabs(rows,own,profileId){
 profileCollectionContext={rows,own,profileId};profileCollectionRequest++;
 return `<section class="panel profile-collections"><nav class="profile-collection-tabs" role="tablist" aria-label="Profile collections">${[['created','Created recipes'],['made','What I made'],['cookbooks','Cookbooks']].map(([id,label])=>`<button type="button" role="tab" id="profile-tab-${id}" aria-controls="profile-collection-panel" aria-selected="${id==='created'}" tabindex="${id==='created'?0:-1}" data-profile-tab="${id}">${label}</button>`).join('')}</nav><div id="profile-collection-panel" role="tabpanel" aria-labelledby="profile-tab-created">${profileRecipeCollection(rows,own)}</div></section>`;
}
function profileRecipeCollection(rows,own,made=false){return `<div class="recipe-grid">${rows.map(recipe=>`<article class="panel">${own?`<small>${recipe.visibility==='public'?'Public':'Private'}${made?` · ${escapeHtml(new Date(recipe.lastCookedAt).toLocaleDateString())}`:''}</small>`:''}<h3>${escapeHtml(recipe.name)}</h3><button class="text-btn" data-visit-recipe="${escapeHtml(recipe.id)}">Open recipe</button>${own&&!made?`<button class="text-btn" data-edit-recipe="${escapeHtml(recipe.id)}">Edit</button>`:''}</article>`).join('')||`<p>${made?'No cooking history yet. Finish cooking a recipe to see it here.':'No created recipes yet.'}</p>`}</div>`}
async function showProfileCollection(tab){
 const ctx=profileCollectionContext,panel=profileView.querySelector('#profile-collection-panel'),request=++profileCollectionRequest,version=profileVersion;if(!ctx||!panel)return;
 for(const button of profileView.querySelectorAll('[data-profile-tab]')){const active=button.dataset.profileTab===tab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1}
 panel.setAttribute('aria-labelledby','profile-tab-'+tab);
 if(tab==='created'){panel.innerHTML=profileRecipeCollection(ctx.rows,ctx.own);return}
 if(tab==='made'){panel.innerHTML=ctx.own?profileRecipeCollection(ctx.rows.filter(r=>r.lastCookedAt).sort((a,b)=>Date.parse(b.lastCookedAt)-Date.parse(a.lastCookedAt)),true,true):'<p>Cooking history is private.</p>';return}
 panel.innerHTML='<p role="status">Loading Cookbooks…</p>';
 try{const {data,error}=await supabase.rpc('get_profile_cookbooks',{p_profile_id:ctx.profileId});if(request!==profileCollectionRequest||version!==profileVersion||!panel.isConnected)return;if(error)throw error;
 panel.innerHTML=`${ctx.own&&ctx.profileId===session?.user?.id?'<button class="text-btn" data-profile-cookbooks>Manage my Cookbooks →</button>':''}<div class="recipe-grid profile-cookbook-grid">${(data||[]).map(book=>{const author=book.author||{};return `<article class="panel profile-cookbook"><small>${book.visibility==='public'?'Public':'Private'}</small><h3><a href="#/cookbook/${encodeURIComponent(book.id)}" data-cookbook-open="${escapeHtml(book.id)}">${escapeHtml(book.name)}</a></h3><p>${book.recipe_ids.length} recipe${book.recipe_ids.length===1?'':'s'} · <a href="#/profile/${encodeURIComponent(author.username||author.id||book.user_id)}" data-visit-profile="${escapeHtml(author.username||author.id||book.user_id)}">${escapeHtml(author.display_name||author.username||'Cook')}</a></p></article>`}).join('')||'<p>No Cookbooks yet.</p>'}</div>`;
 }catch(error){if(request===profileCollectionRequest&&version===profileVersion&&panel.isConnected)panel.innerHTML=`<p role="alert">Could not load Cookbooks. ${escapeHtml(error.message)}</p><button class="text-btn" data-profile-tab="cookbooks">Try again</button>`}
}
document.addEventListener('click',event=>{const tab=event.target.closest('[data-profile-tab]');if(tab)showProfileCollection(tab.dataset.profileTab);if(event.target.closest('[data-profile-cookbooks]'))window.dispatchEvent(new CustomEvent('noms-open-cookbooks'))});
document.addEventListener('keydown',event=>{const tab=event.target.closest('[role="tab"][data-profile-tab]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=[...tab.parentElement.querySelectorAll('[role="tab"]')],index=tabs.indexOf(tab),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowLeft'?-1:1)+tabs.length)%tabs.length;tabs[next].focus();tabs[next].click()});

let profile = null;
let profileVersion=0,profileRequest=0,profileLoad=null,sessionSeen=false;

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
})[character]);

function initials() {
  const source = profile?.display_name || profile?.username || session?.user?.email || 'noms';
  return source.split(/\s+|@/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
}

function avatarMarkup(className = 'profile-avatar') {
  return profile?.avatar_url
    ? `<img class="${className}" src="${escapeHtml(profile.avatar_url)}" alt="${escapeHtml(profile.display_name || 'Profile')} avatar">`
    : `<div class="${className} profile-avatar-fallback" aria-hidden="true">${escapeHtml(initials())}</div>`;
}

function updateHeaderAvatar() {
  if (!profileButton) return;
  if (profile?.avatar_url) {
    profileButton.innerHTML = `<img src="${escapeHtml(profile.avatar_url)}" alt="">`;
  } else {
    profileButton.textContent = initials();
  }
}

async function loadProfile(render=true) {
  if (!session?.user) return;
  const user=session.user,target=window.miseActiveProfile?.id||user.id,current=profileVersion,request=++profileRequest,visit=visitorRequest;
  if(render)profileView.innerHTML = '<div class="profile-loading">Setting the table…</div>';
  const { data, error } = await supabase.from('profiles').select('*').eq('id',target).maybeSingle();
  if(current!==profileVersion||request!==profileRequest)return;
  if (error) throw error;
  let loaded=data;
  if (!loaded && target===user.id) {
    const fallbackName = user.user_metadata?.display_name || '';
    const created = await supabase.from('profiles').insert({ id:user.id,display_name:fallbackName }).select().single();
    if(current!==profileVersion||request!==profileRequest)return;
    if (created.error) throw created.error;
    loaded=created.data;
  }
  profile=loaded;updateHeaderAvatar();
  if(render&&visit===visitorRequest&&profileView.classList.contains('active'))renderProfile();
}
function syncProfileSession(nextSession){
 const changed=(session?.user?.id||null)!==(nextSession?.user?.id||null);
 session=nextSession;
 if(changed){visitorRequest++;profileVersion++;profileRequest++;profile=null;profileLoad=null;profileView.innerHTML='';updateHeaderAvatar()}
 if(!session?.user)return;
 if(profile){updateHeaderAvatar();return}
 if(!profileLoad){const current=profileVersion;const pending=loadProfile(false).catch(error=>{if(current===profileVersion)console.warn('Could not load profile photo.',error.message)}).finally(()=>{if(profileLoad===pending)profileLoad=null});profileLoad=pending}
}

function renderProfile() {
  const name = profile.display_name || 'Your name';
  const username = profile.username ? `@${profile.username}` : '@choose_a_username';
  const tastes = profile.favorite_cuisines || [];
  const memberSince = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(session.user.created_at));
  profileView.innerHTML = `
    <div class="profile-page">
      <section class="profile-card">
        <div class="profile-wash" aria-hidden="true"></div>
        <div class="profile-identity">
          ${avatarMarkup()}
          <div class="profile-copy">
            <p class="eyebrow">${profile.profile_type==='official'||profile.profile_type==='brand'?'OFFICIAL PROFILE':'MY KITCHEN'}</p>
            <h1>${escapeHtml(name)}${profile.is_verified?'<span class="verified-mark" aria-label="Official profile">✓</span>':''}</h1>
            <p class="profile-handle">${escapeHtml(username)}</p>
            ${profile.bio ? `<p class="profile-bio">${escapeHtml(profile.bio)}</p>` : '<p class="profile-bio profile-empty">Add a little about what you love to cook.</p>'}
            <div class="profile-tags"><span>${escapeHtml(profile.diet_preference)}</span><i>·</i><span>${escapeHtml(profile.cooking_level)}</span></div>
            ${tastes.length ? `<div class="cuisine-list">${tastes.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>` : ''}
          </div>
          <div class="profile-actions">
            <button class="secondary-btn" data-profile-share>Profile link</button><button class="primary-btn" data-profile-action="edit">Edit Profile</button>
            <button class="secondary-btn" data-profile-action="logout">Log Out</button>
          </div>
        </div>
        <div class="profile-footer">
          <div class="profile-stats"><span><b>${window.miseProfileStats?.recipes ?? 0}</b> Recipes</span><span><b>${window.miseProfileStats?.ingredients ?? 0}</b> Ingredients</span></div>
          <span>Member since ${escapeHtml(memberSince)}</span>
        </div>
      </section>
      ${profileCollectionTabs(window.miseOwnedRecipes||[],true,profile.id)}
    </div>`;
}

function renderEditor() {
  const selected = profile.favorite_cuisines || [];
  profileView.innerHTML = `
    <div class="profile-edit-page">
      <button class="back-btn" data-profile-action="cancel">← Back to profile</button>
      <div class="page-head"><div><p class="eyebrow">YOUR DETAILS</p><h1>Edit profile</h1><p>Make this corner of noms feel like yours.</p></div></div>
      <form class="profile-form" id="profile-form">
        <section class="panel avatar-editor">
          ${avatarMarkup('profile-avatar profile-avatar-small')}
          <label class="upload-btn">Choose profile picture<input type="file" name="avatar" accept="image/jpeg,image/png,image/webp,image/gif"></label>
          <small>JPG, PNG, WebP or GIF, up to 5 MB.</small>
        </section>
        <section class="panel profile-fields">
          <div class="form-grid">
            <label>Display name<input name="display_name" maxlength="80" required value="${escapeHtml(profile.display_name)}" placeholder="Senny"></label>
            <label>Username<div class="username-input"><span>@</span><input name="username" minlength="3" maxlength="30" pattern="[a-z0-9_]+" required value="${escapeHtml(profile.username)}" placeholder="senny"></div><small>Lowercase letters, numbers and underscores.</small></label>
          </div>
          <label>Bio <span class="optional">Optional</span><textarea name="bio" maxlength="240" rows="3" placeholder="A few words about your kitchen…">${escapeHtml(profile.bio)}</textarea></label>
          <div class="form-grid">
            <label>Diet preference<select name="diet_preference">${['Everything', 'Vegetarian', 'Vegan', 'Pescatarian'].map(value => `<option ${value === profile.diet_preference ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
            <label>Cooking level<select name="cooking_level">${['Beginner', 'Home Cook', 'Confident Cook', 'Chef Mode'].map(value => `<option ${value === profile.cooking_level ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
          </div>
          <fieldset class="privacy-settings"><legend>Privacy</legend>
          <label class="privacy-choice"><input type="checkbox" name="is_private" ${profile.profile_type==='official'||profile.profile_type==='brand'?'disabled':''} ${profile.is_private!==false?'checked':''}> Private Profile</label>
          <p>Only you can see your profile and recipe collection. Your recipes won't appear on your public profile.</p>
          <label class="privacy-choice"><input type="checkbox" name="show_diet" ${profile.show_diet?'checked':''}> Show diet preference on my public profile</label>
          <label class="privacy-choice"><input type="checkbox" name="show_cooking_level" ${profile.show_cooking_level?'checked':''}> Show cooking level on my public profile</label>
          </fieldset><fieldset><legend>Favorite cuisines <small>Choose up to 5</small></legend><div class="cuisine-choices">${cuisines.map(value => `<label><input type="checkbox" name="favorite_cuisines" value="${value}" ${selected.includes(value) ? 'checked' : ''}><span>${value}</span></label>`).join('')}</div></fieldset>
          <div class="profile-form-actions"><button type="button" class="secondary-btn" data-profile-action="cancel">Cancel</button><button class="primary-btn">Save changes</button></div>
          <p class="profile-form-message" id="profile-form-message" role="status"></p>
        </section>
      </form>
    </div>`;
}

async function uploadAvatar(file,userId) {
  if (!file?.size) return profile.avatar_url;
  if (file.size > 5 * 1024 * 1024) throw new Error('Profile pictures must be 5 MB or smaller.');
  const extension = file.name.split('.').pop().toLowerCase();
  const path = `${userId}/avatar.${extension}`;
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

document.addEventListener('click', async event => {
  const action = event.target.closest('[data-profile-action]')?.dataset.profileAction;
  if (action === 'edit') renderEditor();
  if (action === 'cancel') renderProfile();
  if (action === 'logout') {
    const button = event.target.closest('button');
    button.disabled = true;
    const { error } = await supabase.auth.signOut();
    if (error) { button.disabled = false; document.querySelector('#toast').textContent = error.message; }
  }
});

document.addEventListener('change', event => {
  if (event.target.name !== 'favorite_cuisines') return;
  const checked = [...document.querySelectorAll('input[name="favorite_cuisines"]:checked')];
  if (checked.length > 5) { event.target.checked = false; document.querySelector('#profile-form-message').textContent = 'Choose up to 5 cuisines.'; }
});

document.addEventListener('submit', async event => {
  if (event.target.id !== 'profile-form') return;
  event.preventDefault();
  const form = event.target;
  const button = form.querySelector('.primary-btn');
  const message = form.querySelector('#profile-form-message');
  const data = new FormData(form);
  button.disabled = true;
  message.textContent = 'Saving…';
  const current=profileVersion,userId=session?.user?.id;if(!userId)return;
  profileRequest++;
  try {
    const avatarUrl = await uploadAvatar(data.get('avatar'),profile.id);
    if(current!==profileVersion)return;
    const values = {
      display_name: data.get('display_name').trim(),
      username: data.get('username').trim().toLowerCase(),
      bio: data.get('bio').trim() || null,
      avatar_url: avatarUrl || null,
      diet_preference: data.get('diet_preference'),
      cooking_level: data.get('cooking_level'),
      favorite_cuisines: data.getAll('favorite_cuisines'),
      is_private:profile.profile_type==='official'||profile.profile_type==='brand'?false:data.has('is_private'),show_diet:data.has('show_diet'),show_cooking_level:data.has('show_cooking_level')
    };
    const saved = await supabase.from('profiles').update(values).eq('id',profile.id).select().single();
    if(current!==profileVersion)return;
    if (saved.error) throw saved.error;
    profile = saved.data;
    updateHeaderAvatar();
    window.miseActiveProfile=profile;
    renderProfile();
    window.dispatchEvent(new CustomEvent('mise-profile-saved',{detail:{profile}}));
  } catch (error) {
    if(current!==profileVersion||!form.isConnected)return;
    button.disabled = false;
    message.textContent = error.code === '23505' ? 'That username is already taken.' : error.message;
  }
});

window.addEventListener('mise-auth-change', event => {
 sessionSeen=true;syncProfileSession(event.detail.session);
});
window.addEventListener('mise-active-profile-change',event=>{
 profile=event.detail.profile;profileVersion++;profileRequest++;profileLoad=null;updateHeaderAvatar();
 if(profileView.classList.contains('active')&&!/^#\/profile\//.test(location.hash))renderProfile();
});
window.addEventListener('mise-profile-open', () => {visitorRequest++;const current=profileVersion;loadProfile().catch(error => {
 if(current!==profileVersion)return;
 profileView.innerHTML = `<div class="profile-error"><h2>We couldn't load your profile.</h2><p>${escapeHtml(error.message)}</p><p>Make sure the Profile v1 SQL migration has been run in Supabase.</p></div>`;
})});

supabase?.auth.getSession().then(({ data }) => {if(!sessionSeen)syncProfileSession(data.session)}).catch(error=>console.warn('Could not load profile session.',error.message));

window.addEventListener('mise-profile-visit',async event=>{
 const request=++visitorRequest,version=profileVersion;
 profileView.innerHTML='<div class="profile-loading">Loading profile…</div>';
 try{
 const {data,error}=await supabase.rpc('get_visible_profile',{p_lookup:event.detail.lookup});
 if(request!==visitorRequest||version!==profileVersion)return;if(error)throw error;
 if(!data){profileView.innerHTML='<div class="panel"><h1>Profile unavailable</h1></div>';return}
 if(data.id===(window.miseActiveProfile?.id||session?.user?.id)){profile=data;renderProfile();return}
 const p=data;
 let rows=[];
 if(!p.is_private){const result=await supabase.rpc('get_profile_recipes',{p_user_id:p.id});if(result.error)throw result.error;rows=result.data||[]}
 if(request!==visitorRequest||version!==profileVersion)return;
 profileView.innerHTML=`<div class="profile-page"><section class="profile-card"><div class="profile-identity">
 ${p.avatar_url?`<img class="profile-avatar" src="${escapeHtml(p.avatar_url)}" alt="Profile avatar">`:''}
 <div class="profile-copy"><h1>${escapeHtml(p.is_private?(p.username?'@'+p.username:'Cook'):(p.display_name||p.username||'Cook'))}</h1><p>${p.username?'@'+escapeHtml(p.username):''}</p>${p.profile_type==='official'||p.profile_type==='brand'?`<p class="official-profile-label">${p.is_verified?'Verified official':'Official'} Noms profile</p>`:''}
 ${p.is_private?'<p>This profile is private.</p>':`<p>${escapeHtml(p.bio)}</p><div class="profile-tags">${[p.diet_preference,p.cooking_level,...(p.favorite_cuisines||[])].filter(Boolean).map(value=>`<span>${escapeHtml(value)}</span>`).join('')}</div>`}
 </div></div></section>${p.is_private?'':`${profileCollectionTabs(rows,false,p.id)}`}</div>`;
 }catch(error){if(request===visitorRequest&&version===profileVersion)profileView.innerHTML=`<div class="panel"><h1>Profile unavailable</h1><p>${escapeHtml(error.message)}</p></div>`}
});
document.addEventListener('click',event=>{
 if(event.target.closest('[data-profile-share]')){location.hash='/profile/'+encodeURIComponent(profile.username||session.user.id)}
 if(event.target.closest('[data-profile-created]'))window.dispatchEvent(new CustomEvent('noms-open-created'));
});
