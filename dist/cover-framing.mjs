const bounded=(value,min,max,fallback)=>typeof value==='number'&&Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
export function normalizeFraming(value){return {x:bounded(value?.x,0,100,50),y:bounded(value?.y,0,100,50),zoom:bounded(value?.zoom,1,3,1)}}
export function framingStyle(value){const {x,y,zoom}=normalizeFraming(value);return `object-position:${x}% ${y}%;transform:scale(${zoom});transform-origin:${x}% ${y}%;`;}
export function dragFraming(value,dx,dy,width,height,naturalWidth,naturalHeight){
 const frame=normalizeFraming(value),scale=Math.max(width/naturalWidth,height/naturalHeight)*frame.zoom;
 const overflowX=naturalWidth*scale-width,overflowY=naturalHeight*scale-height;
 return normalizeFraming({...frame,x:overflowX>1?frame.x-dx/overflowX*100:frame.x,y:overflowY>1?frame.y-dy/overflowY*100:frame.y});
}
