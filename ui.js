// A small local outline icon set: no external runtime or network dependency.
const shapes={
 trash2:'<path d="M3 6h18M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M5 6l1 14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-14M10 10v7m4-7v7"/>',
 bookmark:'<path d="M6 3h12v18l-6-4-6 4V3Z"/>',
 compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z"/>',
 cartPlus:'<path d="M2 3h3l3 12h11l2-8H6M9 20h.01M18 20h.01M12 6h6m-3-3v6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
 house:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
 book:'<path d="M12 5v16M12 5C9 3 6 3 3 4v15c3-1 6-1 9 2 3-3 6-3 9-2V4c-3-1-6-1-9 1Z"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/>',
 fridge:'<rect x="5" y="2" width="14" height="20" rx="3"/><path d="M5 10h14M8 5v2m0 6v4"/>',
 bag:'<path d="M5 7h14l2 14H3L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
 arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 utensils:'<path d="M4 3v6a3 3 0 0 0 6 0V3M7 3v18M20 3c-4 3-5 7-5 10h5m0-10v18"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 leaf:'<path d="M20 3C9 2 3 8 5 15c2 7 15 5 15-12ZM4 21 16 9"/>',
 box:'<path d="m3 7 9-4 9 4-9 4-9-4Zm0 0v11l9 4 9-4V7M12 11v11"/>',
 fish:'<path d="M7 12c3-9 11-9 15 0-4 9-12 9-15 0ZM7 12 2 6v12l5-6Z"/><circle cx="17" cy="11" r=".6"/>',
 bottle:'<path d="M9 3h6M10 3v5l-4 5v8h12v-8l-4-5V3M6 15h12"/>',
 check:'<path d="m5 12 4 4L19 6"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>'
};
export function icon(name){return `<svg class="app-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[name]||shapes.utensils}</svg>`}
export function renderIcons(){document.querySelectorAll('[data-icon]').forEach(node=>{node.outerHTML=icon(node.dataset.icon)})}

// Keep original selects as the form controls; render their options within Noms.
let openSelect=null,selectMenu=null,activeOption=-1,typeahead='',typeaheadTimer;
function closeSelectMenu(){
 if(!selectMenu)return;
 const select=openSelect,menu=selectMenu;
 openSelect=null;selectMenu=null;typeahead='';clearTimeout(typeaheadTimer);
 select?.removeAttribute('aria-expanded');select?.removeAttribute('aria-controls');select?.removeAttribute('aria-activedescendant');
 menu.remove();
}
function activateSelectOption(index){
 const options=[...selectMenu.querySelectorAll('[role="option"]')];
 if(!options.length)return;
 activeOption=(index+options.length)%options.length;
 options.forEach((option,i)=>option.classList.toggle('is-active',i===activeOption));
 openSelect.setAttribute('aria-activedescendant',options[activeOption].id);
 options[activeOption].scrollIntoView({block:'nearest'});
}
function commitSelectOption(){
 const select=openSelect,option=selectMenu?.querySelectorAll('[role="option"]')[activeOption];
 if(!select||!option)return;
 const index=Number(option.dataset.optionIndex),changed=select.selectedIndex!==index;
 select.selectedIndex=index;closeSelectMenu();select.focus();
 if(changed){select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));}
}
function showSelectMenu(select){
 if(select.disabled||select.multiple||select.size>1)return;
 if(openSelect===select){closeSelectMenu();return;}
 closeSelectMenu();openSelect=select;select.focus();
 const menu=document.createElement('div');selectMenu=menu;
 menu.className='noms-select-menu';menu.id='noms-select-menu';menu.setAttribute('role','listbox');if(typeof menu.showPopover==='function')menu.setAttribute('popover','manual');
 const label=select.getAttribute('aria-label')||select.labels?.[0]?.textContent?.trim()||'Options';menu.setAttribute('aria-label',label);
 let group=null;
 for(const [index,option] of [...select.options].entries()){
  if(option.hidden||option.disabled||option.parentElement.disabled)continue;
  const parent=option.parentElement;
  if(parent.tagName==='OPTGROUP'&&group!==parent){group=parent;const heading=document.createElement('div');heading.className='noms-select-group';heading.textContent=parent.label;menu.append(heading);}
  const row=document.createElement('div');row.role='option';row.id=`noms-option-${index}`;row.dataset.optionIndex=index;row.setAttribute('aria-selected',String(index===select.selectedIndex));row.textContent=option.label;menu.append(row);
 }
 (select.closest('dialog[open]')||document.body).append(menu);
 menu.addEventListener('pointerdown',event=>event.preventDefault());
 menu.addEventListener('pointermove',event=>{const row=event.target.closest('[role="option"]');if(row)activateSelectOption([...menu.querySelectorAll('[role="option"]')].indexOf(row));});
 menu.addEventListener('click',event=>{const row=event.target.closest('[role="option"]');if(!row)return;activateSelectOption([...menu.querySelectorAll('[role="option"]')].indexOf(row));commitSelectOption();});
 menu.addEventListener('toggle',event=>{if(event.newState==='closed'&&selectMenu===menu)closeSelectMenu();});
 if(typeof menu.showPopover==='function')menu.showPopover();
 const box=select.getBoundingClientRect(),spaceBelow=innerHeight-box.bottom-12,spaceAbove=box.top-12;
 const above=spaceBelow<Math.min(240,menu.scrollHeight)&&spaceAbove>spaceBelow;
 const maxHeight=Math.max(40,Math.min(280,above?spaceAbove:spaceBelow));
 Object.assign(menu.style,{minWidth:Math.min(box.width,innerWidth-24)+'px',maxWidth:innerWidth-24+'px',maxHeight:maxHeight+'px'});
 const width=menu.getBoundingClientRect().width;
 Object.assign(menu.style,{left:Math.max(12,Math.min(box.left,innerWidth-width-12))+'px',top:above?Math.max(8,box.top-menu.getBoundingClientRect().height-4)+'px':box.bottom+4+'px'});
 select.setAttribute('aria-expanded','true');select.setAttribute('aria-controls',menu.id);
 const rows=[...menu.querySelectorAll('[role="option"]')];activateSelectOption(Math.max(0,rows.findIndex(row=>Number(row.dataset.optionIndex)===select.selectedIndex)));
}
if(typeof document!=='undefined'){
 document.addEventListener('pointerdown',event=>{
  const select=event.target.closest('select');
  if(select&&!select.disabled&&!select.multiple&&select.size<=1){event.preventDefault();showSelectMenu(select);}
  else if(openSelect&&!selectMenu.contains(event.target))closeSelectMenu();
 },true);
 // WebKit can open its native picker on mousedown even after pointerdown is cancelled.
 document.addEventListener('mousedown',event=>{const select=event.target.closest('select');if(select&&!select.disabled&&!select.multiple&&select.size<=1)event.preventDefault();},true);
 document.addEventListener('click',event=>{const select=event.target.closest('select');if(select&&!select.disabled&&!select.multiple&&select.size<=1)event.preventDefault();},true);
 document.addEventListener('keydown',event=>{
  const select=event.target.closest('select');if(!select||select.disabled||select.multiple||select.size>1)return;
  if(openSelect!==select){if(['ArrowDown','ArrowUp','Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();showSelectMenu(select);}return;}
  if(event.key==='Tab'){closeSelectMenu();return;}
  if(['Escape','Enter',' ','ArrowDown','ArrowUp','Home','End'].includes(event.key)){
   event.preventDefault();event.stopPropagation();
   if(event.key==='Escape')closeSelectMenu();
   else if(event.key==='Enter'||event.key===' ')commitSelectOption();
   else activateSelectOption(event.key==='Home'?0:event.key==='End'?selectMenu.querySelectorAll('[role="option"]').length-1:activeOption+(event.key==='ArrowDown'?1:-1));
  }else if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
   event.preventDefault();typeahead+=event.key.toLowerCase();clearTimeout(typeaheadTimer);typeaheadTimer=setTimeout(()=>typeahead='',700);
   const rows=[...selectMenu.querySelectorAll('[role="option"]')],index=rows.findIndex(row=>row.textContent.toLowerCase().startsWith(typeahead));if(index>=0)activateSelectOption(index);
  }
 },true);
 document.addEventListener('focusout',event=>{if(event.target===openSelect)closeSelectMenu();});
 document.addEventListener('scroll',event=>{if(openSelect&&!selectMenu.contains(event.target))closeSelectMenu();},true);
 window.addEventListener('resize',closeSelectMenu);
 new MutationObserver(()=>{if(openSelect&&(!openSelect.isConnected||openSelect.disabled||openSelect.hidden))closeSelectMenu();}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','hidden']});
}
