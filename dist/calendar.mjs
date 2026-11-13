export function currentWeek(now=new Date()){
 const monday=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);
 monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
 return Array.from({length:7},(_,i)=>{const date=new Date(monday);date.setDate(date.getDate()+i);return date});
}
export function weekLabel(dates){
 const format=new Intl.DateTimeFormat('en',{month:'short',day:'numeric',year:'numeric'});
 return `${format.format(dates[0])} — ${format.format(dates[6])}`;
}
export function kitchenSummary(total,ready){
 if(!total)return 'Add your first recipe to see what you can cook.';
 if(!ready)return 'No recipes are ready yet. Check your inventory or review missing ingredients.';
 return `You can make ${ready} ${ready===1?'recipe':'recipes'} with what you have.`;
}
