const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function initialCrop(width,height,aspect=4/3,framing={x:50,y:50,zoom:1}){
 const zoom=clamp(Number(framing?.zoom)||1,1,3);
 const w=Math.min(width,height*aspect)/width/zoom,h=w*width/height/aspect;
 return {x:(1-w)*clamp(Number(framing?.x) || 0,0,100)/100,y:(1-h)*clamp(Number(framing?.y)||0,0,100)/100,w,h};
}
export function moveCrop(rect,dx,dy){return {...rect,x:clamp(rect.x+dx,0,1-rect.w),y:clamp(rect.y+dy,0,1-rect.h)}}
export function resizeCrop(rect,corner,dx,dy,aspect=null){
 const left=corner.includes('w'),top=corner.includes('n'),ax=left?rect.x+rect.w:rect.x,ay=top?rect.y+rect.h:rect.y;
 const maxW=left?ax:1-ax,maxH=top?ay:1-ay;
 let w=clamp(rect.w+(left?-dx:dx),Math.min(.08,maxW),maxW),h=clamp(rect.h+(top?-dy:dy),Math.min(.08,maxH),maxH);
 if(aspect){
  w=Math.max(w,h*aspect);w=Math.min(w,maxW,maxH*aspect);h=w/aspect;
 }
 return {x:left?ax-w:ax,y:top?ay-h:ay,w,h};
}
export function cropPixels(rect,width,height,maxEdge=1800){
 const x=clamp(rect.x,0,1)*width,y=clamp(rect.y,0,1)*height;
 const w=clamp(rect.w,1/width,1-rect.x)*width,h=clamp(rect.h,1/height,1-rect.y)*height;
 const scale=Math.min(1,maxEdge/Math.max(w,h));
 return {x,y,w,h,outputWidth:Math.max(1,Math.round(w*scale)),outputHeight:Math.max(1,Math.round(h*scale))};
}
