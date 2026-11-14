// A small local outline icon set: no external runtime or network dependency.
const shapes={
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
