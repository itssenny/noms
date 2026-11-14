// Quantities and thresholds belong to personal stock, never shared ingredients.
export function stockStatus(item){return item.qty===null?(item.stockStatus==='low'?'low':'stock'):item.qty<=0?'out':item.qty<=item.threshold?'low':'stock'}
export function stockDraft(data,{quantity='inventory-quantity',unit='inventory-unit',threshold='inventory-threshold'}={}){
 const mode=data.get('stock-mode')||'exact',raw=data.get(quantity),limit=String(data.get(threshold)??'').trim();
 if(!['exact','unknown','empty'].includes(mode))throw new Error('Choose how to track this ingredient.');
 if(!limit||!Number.isFinite(Number(limit))||Number(limit)<0)throw new Error('Enter zero or a positive low-stock threshold.');
 let qty=mode==='empty'?0:mode==='unknown'?null:Number(raw);
 if(mode==='exact'&&(String(raw??'').trim()===''||!Number.isFinite(qty)||qty<0))throw new Error('Enter zero or a positive amount, or choose amount unknown.');
 return {qty,unit:data.get(unit),threshold:Number(limit),stockStatus:mode==='unknown'&&data.get('stock-status')==='low'?'low':null};
}

// Presence changes never invent a numeric quantity or overwrite stock metadata.
export function ingredientPresenceStock(row,present){
 if(!row.ingredientId)throw new Error('Choose a catalogue ingredient before tracking stock.');
 const previous=row.item||{},unit=previous.unit||(!['as needed','to taste'].includes(row.unit)?row.unit:'piece')||'piece';
 return {...previous,ingredientId:row.ingredientId,qty:present?(previous.qty===null||previous.qty>0?previous.qty:null):0,unit,threshold:previous.threshold??0,location:previous.location||'Pantry',stockStatus:present&&previous.qty!==0?previous.stockStatus??null:null};
}
