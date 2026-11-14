import {normalizeFraming} from './cover-framing.mjs';
import {initialCrop,moveCrop,resizeCrop,cropPixels} from './crop-geometry.mjs';
const editors=new WeakMap();
export function readCoverFraming(form){const state=editors.get(form);return normalizeFraming(state?.dirty?undefined:state?.originalFraming)}
export async function prepareCoverUpload(form){
 const state=editors.get(form);if(!state?.dirty)return form.querySelector('[name="cover"]')?.files?.[0]||null;
 if(!state.loaded)throw new Error('Wait for the photo to load before saving.');
 if(state.file)return state.file;
 const version=state.version,image=state.image,box=cropPixels(state.committed,image.naturalWidth,image.naturalHeight);
 const canvas=document.createElement('canvas');canvas.width=box.outputWidth;canvas.height=box.outputHeight;
 const context=canvas.getContext('2d');context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.drawImage(image,box.x,box.y,box.w,box.h,0,0,canvas.width,canvas.height);
 let blob;try{blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.94));}catch{throw new Error('Could not crop this photo. Upload the original photo again and retry.');}
 if(!blob)throw new Error('Could not create the cropped cover. Please retry.');
 if(version!==state.version)throw new Error('The photo changed while saving. Please save again.');
 state.file=new File([blob],'recipe-cover.webp',{type:blob.type||'image/webp'});return state.file;
}
export function initCoverEditor(form,recipe={}){
 const upload=form.querySelector('.cover-upload');if(!upload)return;
 const summary=document.createElement('div');summary.className='cover-summary';summary.hidden=true;
 summary.innerHTML='<img alt="Cover photo preview"><div><button type="button" class="secondary-btn" data-open-crop>Crop photo</button><small data-cover-status role="status"></small></div>';
 upload.after(summary);
 const dialog=document.createElement('dialog');dialog.className='cover-crop-dialog';dialog.setAttribute('aria-label','Crop recipe cover photo');
 dialog.innerHTML=`<div class="cover-crop-heading"><div><h2>Crop photo</h2><p>Drag the corners to resize the square, or drag inside to move it.</p></div><button type="button" class="round-btn" data-cancel-crop aria-label="Close photo crop">×</button></div><div class="crop-stage"><div class="crop-image-plane"><img class="crop-source" alt="Original photo" draggable="false"><div class="crop-window" tabindex="0" role="group" aria-label="Square crop selection. Use arrow keys to move."><div class="crop-grid" aria-hidden="true"></div>${['nw','ne','sw','se'].map(corner=>`<button type="button" class="crop-corner ${corner}" data-crop-corner="${corner}" aria-label="Resize ${ {nw:'top left',ne:'top right',sw:'bottom left',se:'bottom right'}[corner]} crop corner with arrow keys"></button>`).join('')}</div></div></div><p data-crop-status role="status"></p><div class="cover-crop-actions"><button type="button" class="text-btn" data-reset-cover>Reset</button><button type="button" class="secondary-btn" data-cancel-crop>Cancel</button><button type="button" class="primary-btn" data-apply-crop>Done</button></div>`;
 document.body.append(dialog);
 const image=dialog.querySelector('.crop-source'),stage=dialog.querySelector('.crop-stage'),plane=dialog.querySelector('.crop-image-plane'),selection=dialog.querySelector('.crop-window'),status=summary.querySelector('[data-cover-status]'),cropStatus=dialog.querySelector('[data-crop-status]');image.crossOrigin='anonymous';
 const state={image,loaded:false,originalFraming:normalizeFraming(recipe.imageFraming),crop:null,committed:null,dirty:false,file:null,version:0,urls:new Set(),drag:null,busy:false,source:''};editors.set(form,state);
 const urlFor=blob=>{const url=URL.createObjectURL(blob);state.urls.add(url);return url;};
 function render(){if(!state.crop)return;const {x,y,w,h}=state.crop;Object.assign(selection.style,{left:`${x*100}%`,top:`${y*100}%`,width:`${w*100}%`,height:`${h*100}%`});}
 function layout(){if(!state.loaded||!dialog.open)return;const scale=Math.min(stage.clientWidth/image.naturalWidth,stage.clientHeight/image.naturalHeight);plane.style.width=image.naturalWidth*scale+'px';plane.style.height=image.naturalHeight*scale+'px';render();}
 function load(url,replacement=false){state.loaded=false;state.committed=null;state.crop=null;state.file=null;state.version++;state.dirty=false;state.originalFraming=replacement?normalizeFraming():normalizeFraming(recipe.imageFraming);state.source=url;image.src=url;summary.querySelector('img').src=url;summary.hidden=false;upload.classList.add('has-cover-editor');const preview=upload.querySelector('.cover-preview');preview.style.backgroundImage='';preview.classList.remove('has-image');preview.querySelector('strong').textContent='Change cover photo';summary.querySelector('div').prepend(upload);status.textContent='';}
 function open(){state.crop=state.committed?{...state.committed}:state.loaded?initialCrop(image.naturalWidth,image.naturalHeight,1,state.originalFraming):null;cropStatus.textContent=state.loaded?'':'Loading photo…';dialog.showModal();layout();selection.focus();}
 function cancel(){if(!state.busy)dialog.close();}
 image.addEventListener('error',()=>{state.loaded=false;status.textContent='Could not load this photo. Choose another photo.';cropStatus.textContent=status.textContent;});
 image.addEventListener('load',()=>{state.loaded=true;state.crop=initialCrop(image.naturalWidth,image.naturalHeight,1,state.originalFraming);cropStatus.textContent='';layout();});
 if(recipe.imageUrl)load(recipe.imageUrl);
 summary.querySelector('[data-open-crop]').addEventListener('click',open);
 form.querySelector('[name="cover"]').addEventListener('change',event=>{const file=event.target.files[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)){event.target.value='';status.textContent='Choose a JPG, PNG or WebP image.';return;}load(urlFor(file),true);});
 dialog.addEventListener('cancel',event=>{if(state.busy)event.preventDefault();});
 dialog.addEventListener('keydown',event=>{if(event.key==='Escape')event.stopPropagation();});
 dialog.addEventListener('click',async event=>{
  if(event.target.closest('[data-cancel-crop]'))return cancel();
  if(event.target.closest('[data-reset-cover]')&&state.loaded&&!state.busy){state.crop=initialCrop(image.naturalWidth,image.naturalHeight,1);render();}
  const apply=event.target.closest('[data-apply-crop]');if(!apply||!state.loaded||state.busy)return;
  const previous={committed:state.committed,dirty:state.dirty,file:state.file};state.committed={...state.crop};state.dirty=true;state.file=null;state.version++;state.busy=true;dialog.querySelectorAll('button').forEach(button=>button.disabled=true);
  try{const file=await prepareCoverUpload(form);if(!form.isConnected)return;summary.querySelector('img').src=urlFor(file);status.textContent='Square crop ready. Save recipe to keep it.';dialog.close();}catch(error){Object.assign(state,previous);cropStatus.textContent=error.message;}finally{state.busy=false;dialog.querySelectorAll('button').forEach(button=>button.disabled=false);}
 });
 selection.addEventListener('pointerdown',event=>{if(event.button!==0||!state.loaded||state.busy)return;event.preventDefault();state.drag={x:event.clientX,y:event.clientY,crop:{...state.crop},corner:event.target.closest('[data-crop-corner]')?.dataset.cropCorner};selection.setPointerCapture(event.pointerId);});
 selection.addEventListener('pointermove',event=>{if(!state.drag)return;const box=plane.getBoundingClientRect(),dx=(event.clientX-state.drag.x)/box.width,dy=(event.clientY-state.drag.y)/box.height,ratio=image.naturalHeight/image.naturalWidth;state.crop=state.drag.corner?resizeCrop(state.drag.crop,state.drag.corner,dx,dy,ratio):moveCrop(state.drag.crop,dx,dy);render();});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])selection.addEventListener(name,()=>state.drag=null);
 selection.addEventListener('keydown',event=>{if(!state.loaded||state.busy||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const step=event.shiftKey ? .05 : .01,dx=event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0,dy=event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0,corner=event.target.closest('[data-crop-corner]')?.dataset.cropCorner;state.crop=corner?resizeCrop(state.crop,corner,dx,dy,image.naturalHeight/image.naturalWidth):moveCrop(state.crop,dx,dy);render();});
 const resizeObserver=new ResizeObserver(layout);resizeObserver.observe(stage);
 const observer=new MutationObserver(()=>{if(form.isConnected)return;dialog.close();dialog.remove();for(const url of state.urls)URL.revokeObjectURL(url);resizeObserver.disconnect();observer.disconnect();});observer.observe(document.body,{childList:true,subtree:true});
}
