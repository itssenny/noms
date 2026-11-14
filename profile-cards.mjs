import {framingStyle} from './cover-framing.mjs';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function profileCardColour(item){const key=String(item.id||item.name||'recipe'),hash=Array.from(key).reduce((v,c)=>(v*31+c.charCodeAt(0))>>>0,0);return ['#f5cce1','#e5ed66','#cab7fb'][hash%3]}
export function profileCoverPath(value){const marker='/storage/v1/object/public/recipe-covers/';if(value.includes(marker)){try{return decodeURIComponent(value.split(marker)[1].split('?')[0])}catch{return ''}}return /^https?:|^blob:/i.test(value)?'':value}
export function profileCardCover(item={},kind='recipe'){
 const value=item.imageUrl||item.image_url||'',path=profileCoverPath(value),image=!path&&/^https?:|^blob:/i.test(value);
 const art=kind==='cookbook'?'<rect x="3" y="3" width="18" height="18"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/>':'<path d="M4 3v6a3 3 0 0 0 6 0V3M7 3v18M20 3c-4 3-5 7-5 10h5m0-10v18"/>';
 return `<div class="profile-card-cover" ${path?`data-profile-cover-path="${escape(path)}" data-profile-cover-framing="${escape(framingStyle(item.imageFraming||item.image_framing))}"`:''}>${image?`<img src="${escape(value)}" alt="" loading="lazy" style="${framingStyle(item.imageFraming||item.image_framing)}">`:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${art}</svg>`}</div>`;
}
