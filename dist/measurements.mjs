// US customary units: NIST SP 811. Base dimensions are grams and milliliters.
export const measures={g:['mass',1],kg:['mass',1000],oz:['mass',28.349523125],lb:['mass',453.59237],ml:['volume',1],l:['volume',1000],cup:['volume',236.5882365],tbsp:['volume',14.78676478125],tsp:['volume',4.92892159375],'fl oz':['volume',29.5735295625]};
const aliases={gram:'g',grams:'g',kilogram:'kg',kilograms:'kg',milliliter:'ml',milliliters:'ml',millilitre:'ml',millilitres:'ml',liter:'l',liters:'l',litre:'l',litres:'l',cups:'cup',tablespoon:'tbsp',tablespoons:'tbsp',tbs:'tbsp',teaspoon:'tsp',teaspoons:'tsp',ounce:'oz',ounces:'oz',pound:'lb',pounds:'lb',lbs:'lb',floz:'fl oz','fluid ounce':'fl oz','fluid ounces':'fl oz'};
export function normalizeUnit(unit){const key=String(unit??'').toLowerCase().replace(/\./g,'').replace(/\s+/g,' ').trim();return aliases[key]||key;}
export function parseMeasurement(value){
 if(typeof value==='number')return Number.isFinite(value)?value:null;
 const fractions={'½':'1/2','¼':'1/4','¾':'3/4','⅓':'1/3','⅔':'2/3','⅛':'1/8','⅜':'3/8','⅝':'5/8','⅞':'7/8'};
 const text=String(value??'').trim().replace(/(\d)([½¼¾⅓⅔⅛⅜⅝⅞])/g,'$1 $2').replace(/[½¼¾⅓⅔⅛⅜⅝⅞]/g,c=>fractions[c]);
 if(!text)return null;
 if(/^\d+(?:[.,]\d+)?$/.test(text))return Number(text.replace(',','.'));
 const m=/^(?:(\d+)\s+)?(\d+)\/(\d+)$/.exec(text);return m&&Number(m[3])>0?Number(m[1]||0)+Number(m[2])/Number(m[3]):null;
}
export function convertMeasurement(quantity,from,to,density=null){
 const value=parseMeasurement(quantity),a=measures[normalizeUnit(from)],b=measures[normalizeUnit(to)];
 if(value===null||!a||!b)return null;
 if(a[0]===b[0])return value*a[1]/b[1];
 if(!(typeof density==='number'&&Number.isFinite(density)&&density>0))return null;
 return value*a[1]*(a[0]==='volume'?density:1/density)/b[1];
}
export function verifiedDensity(ingredient,note=''){
 const metadata=ingredient?.conversion_metadata;
 // Never apply a generic factor to a recipe with a different preparation.
 if(metadata?.status!=='verified'||!metadata.source||metadata.preparation||/\b(sifted|packed|chopped|melted|cooked|whipped|sliced|ground)\b/i.test(note))return null;
 const value=Number(ingredient?.density_g_per_ml);return Number.isFinite(value)&&value>0?value:null;
}
export function displayMeasurement(quantity,unit,system='metric',ingredient=null,scale=1,note=''){
 const value=parseMeasurement(quantity),normalized=normalizeUnit(unit),measure=measures[normalized];
 if(value===null)return {quantity:null,unit};
 const scaled=value*(Number.isFinite(scale)&&scale>0?scale:1);
 if(!measure)return {quantity:scaled,unit};
 // Preserve source quantities in their own system; always derive from source.
 const sourceSystem=['g','kg','ml','l'].includes(normalized)?'metric':'us';
 if(sourceSystem===system)return {quantity:scaled,unit:normalized==='l'?'L':normalized};
 const density=verifiedDensity(ingredient,note);
 let target;
 if(system==='metric'){
  const mass=measure[0]==='mass'||density!==null;
  const base=convertMeasurement(scaled,normalized,mass?'g':'ml',density);
  target=base>=1000?(mass?'kg':'l'):(mass?'g':'ml');
 }else if(measure[0]==='mass'&&density===null){target=convertMeasurement(scaled,normalized,'oz')>=16?'lb':'oz';}
 else{const volume=convertMeasurement(scaled,normalized,'ml',density);target=volume>=236.5882365/4?'cup':volume>=14.78676478125?'tbsp':'tsp';}
 const result=convertMeasurement(scaled,normalized,target,density);
 return result===null?{quantity:scaled,unit}:{quantity:result,unit:target==='l'?'L':target};
}
export function formatMeasurement({quantity,unit}){
 if(quantity===null||quantity===undefined)return unit==='to taste'?'To taste':'As needed';
 let label;
 // Fractions only when the approximation differs by at most 2%; otherwise decimals.
 if(['cup','tbsp','tsp','lb','oz','fl oz'].includes(unit)){
  const eighth=Math.round(quantity*8)/8;
  if(eighth>0&&Math.abs(eighth-quantity)<=Math.max(1e-9,quantity*.02)){
   const whole=Math.floor(eighth),part=Math.round((eighth-whole)*8),glyph=['','⅛','¼','⅜','½','⅝','¾','⅞'][part];label=`${whole||(!part?'0':'')}${whole&&part?' ':''}${glyph}`;
  }
 }
 if(label===undefined)label=String(Number(quantity.toPrecision(3)));
 return `${label} ${unit==='cup'&&quantity!==1?'cups':unit}`;
}
export function measurementPreference(storage,userId){try{return storage.getItem('noms-measurement-'+(userId||'guest'))==='us'?'us':'metric'}catch{return 'metric'}}
export function saveMeasurementPreference(storage,userId,system){try{storage.setItem('noms-measurement-'+(userId||'guest'),system);return true}catch{return false}}
