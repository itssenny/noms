export function feedbackPatch(recipe,{rating='',notes='',append=false}){
 const patch={},value=String(rating??'').trim(),text=String(notes??'').trim();
 if(value){const number=Number(value);if(!Number.isFinite(number)||number<1||number>5||(!Number.isInteger(number)&&number!==recipe.rating))throw new Error('Choose a rating between 1 and 5.');if(Number.isInteger(number))patch.rating=number}
 else if(!append)patch.rating=null;
 if(text.length>5000)throw new Error('Keep new notes under 5,000 characters.');
 if(text)patch.note=text;
 return patch;
}
export function noteTimeLabel(value,now=new Date()){
 const date=new Date(value),stamp=value?Number(date):NaN;if(!Number.isFinite(stamp))return 'Earlier note · date unknown';
 const elapsed=(Number(now)-stamp)/1000;
 if(elapsed<0)return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'}).format(date);
 if(elapsed<60)return 'Just now';if(elapsed<3600)return `${Math.floor(elapsed/60)} min ago`;
 if(elapsed<86400)return `${Math.floor(elapsed/3600)} hr ago`;if(elapsed<172800)return '1 day ago';
 if(elapsed<604800)return new Intl.DateTimeFormat('en-GB',{weekday:'long'}).format(date);
 return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'}).format(date);
}
