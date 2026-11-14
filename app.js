import {createCookbooks,cookbookAction} from './cookbooks.js';
import {taggedRecipes} from './recipe-tags.mjs';
let activeRecipeTag='';
import {initCoverEditor,readCoverFraming,prepareCoverUpload} from './cover-editor.js?v=20261114-smooth-controls';
import {normalizeFraming,framingStyle} from './cover-framing.mjs';
import { displayMeasurement, formatMeasurement, measurementPreference, saveMeasurementPreference } from './measurements.mjs?v=20261114-shared-spoons';
import { loadMeasurementIngredients } from './measurement-data.js';
let measurementIngredients=new Map();
function measuredLabel(row){return formatMeasurement(displayMeasurement(row.need,row.unit,measurementPreference(localStorage,activeUserId),measurementIngredients.get(row.ingredientId),1,row.note));}
import {ingredientDraft} from './supabase/functions/_shared/recipe-import.mjs?v=20261114-measurements';
import {ingredientDefaults,ingredientCategoryPreferences} from './ingredient-defaults.js?v=20261114-personal-categories';
import {stockStatus,stockDraft,ingredientPresenceStock} from './stock-model.mjs?v=20261114-tracking';
import {clearCategoryColours,loadCategoryColours} from './category-colours.js?v=20261114-tracking';
import {filterRecipes,filterInventory,categoryColour} from './list-models.mjs?v=20261114-tracking';
import {readOftenBought,writeOftenBought,pinIngredient,addIndependentIngredient,addFreeShoppingItem} from './shopping-extra.mjs';
import {feedbackPatch,noteTimeLabel} from './feedback.mjs';
import {recipeShelves} from './gallery.mjs';
import {substitutionRules,clearSubstitutions,loadSubstitutions} from './substitutions.js';
import { mealSlots, moveMeal, weekdays, dateKey, parseDate, dateForDay, shiftWeek, cleanRecipeSources, sourceRecipes, cartCoverage, cartMatches, addSelectedIngredients, detachRecipeSources } from './planning.mjs';
import { icon, renderIcons } from './ui.js?v=20261114-bookmark&dropdowns=2&card-actions=1&card-fix=3&privacy-badge=1&recipe-views=1';
import { supabase } from './supabase-client.js';
import { ingredientPicker, selectedIngredient, presetIngredient, searchIngredients, exactIngredientMatches, saveCatalogueIngredient, units, ingredientCategories } from './ingredients.js?v=20261114-measurements';
import { convertQuantity, recipeChecks, remainingInventory, quantityLabel, parseRecipeQuantity, needsPurchase, postCookQuantity, hasIngredientStock, recipeAvailabilityLabel } from './cooking.mjs?v=20261114-availability';
import { readAccountState, writeAccountState } from './account-state.mjs';
import { catalogueView, clearCatalogue } from './catalogue.js?v=20261114-personal-categories';
import { currentWeek, weekLabel } from './calendar.mjs';
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let cookingServings=1;
const coverBlobs=new Set();
function ownsRecipe(recipe){return !!activeProfileId&&recipe.userId===activeProfileId}
function createdRecipes(){return recipes.filter(ownsRecipe)}
function libraryRecipes(){return libraryTab==='created'?createdRecipes():recipes.filter(recipe=>savedIds.has(recipe.id)&&!ownsRecipe(recipe))}
function creatorAttribution(recipe){const creator=recipe.creator;if(!creator)return '';const label=creator.username?`@${creator.username}`:creator.display_name||'Cook',initials=(creator.display_name||creator.username||'N').split(/\s+|@/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase();return `<button type="button" class="creator-attribution" data-visit-profile="${escapeHtml(creator.username||creator.id)}" aria-label="View ${escapeHtml(label)} profile">${creator.avatar_url?`<img src="${escapeHtml(creator.avatar_url)}" alt="">`:`<span class="creator-avatar-fallback" aria-hidden="true">${escapeHtml(initials)}</span>`}<span>${escapeHtml(label)}</span>${creator.is_verified?'<span class="verified-mark" aria-label="Official profile">✓</span>':''}</button>`}
function recipeSourceMarkup(source){const label=String(source??'').trim();try{const url=new URL(/^www\./i.test(label)?'https://'+label:label);if(['http:','https:'].includes(url.protocol)&&url.hostname)return `<a href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`}catch{}return escapeHtml(label)}
function recipeAttribution(recipe){return creatorAttribution(recipe)||(ownsRecipe(recipe)?`<small class="recipe-visibility">${recipe.visibility==='public'?'Public':'Private'}</small>`:'')}
function coverPath(value){if(!value)return '';const marker='/storage/v1/object/public/recipe-covers/';if(value.includes(marker)){try{return decodeURIComponent(value.split(marker)[1].split('?')[0])}catch{return ''}}return /^https?:|^blob:/.test(value)?'':value}
async function hydrateRecipeRatings(rows){
 const ids=rows.map(row=>row.id).filter(Boolean);if(!ids.length)return rows;const version=sessionVersion;
 const {data,error}=await supabase.rpc('get_recipe_ratings',{p_ids:ids});if(version!==sessionVersion)return [];
 if(error)throw new Error('Ratings need database update 032_personal_community_ratings.sql. '+error.message);
 const made=await supabase.rpc('get_recipe_made',{p_ids:ids});if(version!==sessionVersion)return [];if(made.error)throw new Error('Check-ins need database update 035_recipe_made_checkins.sql. '+made.error.message);
 const history=new Map((made.data||[]).map(row=>[row.id,row.made_at]));const ratings=new Map((data||[]).map(row=>[row.id,row]));return rows.map(row=>({...row,made_at:history.get(row.id)||null,...(ratings.get(row.id)||{personal_rating:null,contribute_to_community:false,community_average:null,community_count:0})}));
}
function communityRatingMarkup(recipe){return recipe.visibility==='public'?`<span class="community-rating" data-community-rating="${escapeHtml(recipe.id)}">${recipe.communityCount?`<b>${Number(recipe.communityAverage).toFixed(1)} (${recipe.communityCount})</b><span>public rating</span>`:'No public ratings yet'}</span>`:''}
async function hydrateCovers(rows){const version=sessionVersion;rows=await hydrateRecipeRatings(rows);if(version!==sessionVersion)return [];return Promise.all(rows.map(async row=>{const path=coverPath(row.image_url);if(!path)return row;const {data,error}=await supabase.storage.from('recipe-covers').download(path);if(error||version!==sessionVersion)return {...row,image_url:'' ,_imagePath:row.image_url};const existing=recipes.find(recipe=>recipe.imagePath===path&&coverBlobs.has(recipe.imageUrl));const url=existing?.imageUrl||URL.createObjectURL(data);coverBlobs.add(url);return {...row,_imagePath:row.image_url,image_url:url}}))}
async function refreshLibrary(){
 const version=sessionVersion,request=++libraryRequest;
 const {data,error}=await supabase.rpc('get_saved_recipes');
 if(version!==sessionVersion||request!==libraryRequest)return;
 if(error)throw new Error('Recipe libraries need database update 016_profile_recipe_privacy.sql. '+error.message);
 const rows=data||[],hydrated=await hydrateCovers(rows.filter(row=>row.recipe).map(row=>row.recipe));
 if(version!==sessionVersion||request!==libraryRequest)return;
 savedIds=new Set(rows.map(row=>row.recipe_id));unavailableSaves=rows.filter(row=>!row.recipe).map(row=>row.recipe_id);
 recipes=[...new Map([...recipes.filter(recipe=>recipe.temporary),...createdRecipes(),...hydrated.map(row=>({...mapRecipe(row),temporary:false}))].map(recipe=>[recipe.id,recipe])).values()];
 window.miseOwnedRecipes=createdRecipes();
}
function bookmarkMarkup(recipe){const saved=savedIds.has(recipe.id);return `<button type="button" class="recipe-bookmark" data-save-recipe="${escapeHtml(recipe.id)}" aria-pressed="${saved}" aria-label="${saved?'Unsave recipe':'Save recipe'}" title="${saved?'Unsave recipe':'Save recipe'}">${icon('bookmark')}</button>`;}
function syncBookmarks(){for(const button of document.querySelectorAll('.recipe-bookmark')){const saved=savedIds.has(button.dataset.saveRecipe),label=saved?'Unsave recipe':'Save recipe';button.setAttribute('aria-pressed',String(saved));button.setAttribute('aria-label',label);button.title=label;}for(const button of document.querySelectorAll('[data-card-save]')){const saved=savedIds.has(button.dataset.saveRecipe)||button.dataset.cardOwned==='true';button.setAttribute('aria-pressed',String(saved));button.innerHTML=`${icon(saved?'check':'bookmark')}<span>${saved?'Saved':'Save'}</span>`;button.title=saved?'Remove from Saved':'Save recipe';}}
async function restoreReferencedRecipes(){
 const version=sessionVersion,ids=[...new Set([...plans.map(plan=>plan.recipe),...shopping.flatMap(item=>item.sourceIds||[]),currentRecipe?.id])].filter(id=>id&&!recipes.some(recipe=>recipe.id===id));
 const restored=await Promise.all(ids.map(async id=>{try{const {data,error}=await supabase.rpc('get_visible_recipe',{p_id:id});if(error||!data||version!==sessionVersion)return null;const [row]=await hydrateCovers([data]);if(version!==sessionVersion)return null;return {...mapRecipe(row),temporary:true};}catch{return null;}}));
 if(version!==sessionVersion)return;const current=new Set(recipes.map(recipe=>recipe.id));recipes.push(...restored.filter(recipe=>recipe&&!current.has(recipe.id)));
}
async function toggleSaved(id,button){
 const version=sessionVersion,userId=activeUserId;if(!userId||button.disabled)return;button.disabled=true;
 try{
  const remove=savedIds.has(id),query=remove?supabase.from('saved_recipes').delete().eq('user_id',userId).eq('recipe_id',id):supabase.from('saved_recipes').insert({user_id:userId,recipe_id:id});
  const {error}=await query;if(error&&error.code!=='23505')throw error;if(version!==sessionVersion)return;
  if(remove){savedIds.delete(id);const recipe=recipes.find(recipe=>recipe.id===id);if(recipe)recipe.temporary=true;}else savedIds.add(id);
  syncBookmarks();await refreshLibrary();if(version!==sessionVersion)return;syncBookmarks();
  if(document.querySelector('#recipes-view.active'))recipesView();toast(remove?'Removed from Saved':'Recipe saved');
 }catch(error){if(version===sessionVersion)toast(error.message)}finally{if(button.isConnected)button.disabled=false}
}
async function openSharedRoute(event){
 const tagged=location.hash.match(/^#\/tags\/(.+)$/);if(tagged&&activeUserId){try{activeRecipeTag=decodeURIComponent(tagged[1]).slice(0,100);show('tags',true)}catch{toast('Could not open this tag.')}return}
 const sharedCookbook=location.hash.match(/^#\/cookbook\/([0-9a-f-]{36})$/);if(sharedCookbook&&activeUserId){libraryTab='cookbooks';cookbooks.route(sharedCookbook[1]);show('recipes',true);return}
 const cookbookPage=location.hash.match(/^#\/recipes\/cookbooks(?:\/([0-9a-f-]{36}))?$/);
 if(cookbookPage&&activeUserId){libraryTab='cookbooks';cookbooks.route(cookbookPage[1]||'');show('recipes',true);return}
 const recipePage=location.hash.match(/^#\/recipes(?:\/(created|saved))?$/);
 if(recipePage&&activeUserId){libraryTab=recipePage[1]||'created';show('recipes',true);return}
 const mealPage=location.hash.match(/^#\/meal-plan(?:\/(weekly|shopping))?$/);
 if(mealPage&&activeUserId){show(mealPage[1]==='shopping'?'shopping':'planner',true);return}
 const primaryPage={'#/home':'home','#/discover':'discover','#/recipes':'recipes','#/inventory':'inventory','#/profile':'profile','#/inventory/catalogue':'catalogue'}[location.hash];
 if(primaryPage&&activeUserId){show(primaryPage,true);return}
 if(!location.hash&&event?.type==='hashchange'&&activeUserId){show('home',true);return}
 const route=location.hash.match(/^#\/(profile|recipe)\/([^/]+)$/);if(!route||!activeUserId)return;
 const request=++routeRequest,version=sessionVersion;let lookup;try{lookup=decodeURIComponent(route[2])}catch{return}
 if(route[1]==='profile'){show('profile',true);window.dispatchEvent(new CustomEvent('mise-profile-visit',{detail:{lookup}}));return}
 try{await refreshLibrary();if(request===routeRequest&&version===sessionVersion)await detail(lookup)}catch(error){toast(error.message)}
}
window.addEventListener('hashchange',openSharedRoute);
window.addEventListener('noms-open-profile-recipe',event=>detail(event.detail.id,'profile'));
window.addEventListener('noms-recipe-visibility-changed',event=>{const data=event.detail,recipe=recipes.find(r=>r.id===data.id);if(recipe){recipe.visibility=data.visibility;recipe.shareCode=data.share_code||null;if(data.visibility==='private')recipe.contributeToCommunity=false}});
window.addEventListener('noms-open-cookbooks',()=>{libraryTab='cookbooks';cookbooks.route('');show('recipes')});
window.addEventListener('noms-open-created',()=>{libraryTab='created';show('recipes')});
window.addEventListener('mise-open-saved',()=>{libraryTab='saved';show('recipes');refreshLibrary().then(recipesView).catch(error=>toast(error.message))});
window.addEventListener('mise-profile-saved',event=>{if(event.detail?.profile){activeProfile=event.detail.profile;managedProfiles=managedProfiles.map(profile=>profile.id===activeProfile.id?activeProfile:profile);window.miseActiveProfile=activeProfile;renderActiveProfileControl()}loadedUserId=null;handleDatabaseLoad({user:{id:activeUserId}})});
document.addEventListener('click',event=>{
 const save=event.target.closest('[data-save-recipe]');if(save){toggleSaved(save.dataset.saveRecipe,save);return}
 const profile=event.target.closest('[data-visit-profile]');if(profile){event.preventDefault();location.hash='/profile/'+encodeURIComponent(profile.dataset.visitProfile);openSharedRoute();return}
 const recipe=event.target.closest('[data-visit-recipe]');if(recipe){event.preventDefault();detail(recipe.dataset.visitRecipe,recipeOpenOrigin(recipe))}
});
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-card-save]');if(!button)return;
 event.preventDefault();event.stopImmediatePropagation();
 if(button.disabled)return;
 button.closest('details').open=false;toggleSaved(button.dataset.saveRecipe,button);
},true);
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-card-plan]');if(!button)return;
 event.preventDefault();event.stopImmediatePropagation();button.closest('details').open=false;
 const id=button.dataset.cardPlan,version=sessionVersion;button.disabled=true;
 try{if(!recipes.some(recipe=>recipe.id===id)){
  const {data,error}=await supabase.rpc('get_visible_recipe',{p_id:id});if(version!==sessionVersion)return;
  if(error||!data)throw new Error(error?.message||'Recipe no longer available');
  const [row]=await hydrateCovers([data]);if(version!==sessionVersion)return;
  if(!recipes.some(recipe=>recipe.id===id))recipes.push({...mapRecipe(row),temporary:true});
 }planModal(id);}catch(error){if(version===sessionVersion)toast(error.message);}finally{if(button.isConnected)button.disabled=false;}
},true);
document.addEventListener('change',event=>{if(event.target.id==='active-profile-select')switchProfile(event.target.value).catch(error=>toast(`Could not switch profile: ${error.message}`))});

const categories={"Salmon fillet":"Fish & Seafood","Miso paste":"Sauces & Condiments",Butter:"Dairy",Rice:"Carbohydrates",Pasta:"Carbohydrates",Tomatoes:"Vegetables",Cream:"Dairy",Garlic:"Vegetables","Chicken breast":"Meat","Soy sauce":"Sauces & Condiments",Carrots:"Vegetables",Eggs:"Eggs",Chickpeas:"Canned Goods","Bell pepper":"Vegetables",Onion:"Vegetables",Lime:"Fruits"};
const icons={"Fish & Seafood":icon('fish'),"Sauces & Condiments":icon('bottle'),Dairy:icon('bottle'),Carbohydrates:icon('box'),Vegetables:icon('leaf'),Meat:icon('utensils'),Eggs:icon('box'),"Canned Goods":icon('box'),Fruits:icon('leaf')};
let recipes=[
 {id:1,name:"Miso butter salmon",cuisine:"Japanese",tags:["dinner","high-protein"],prep:10,cook:20,time:30,difficulty:"Easy",rating:4.8,emoji:"🍣",bg:"#dce8df",servings:2,source:"Family recipe",ingredients:[["Salmon fillet",300,"g","skin on"],["Miso paste",30,"g","white miso"],["Butter",20,"g","softened"],["Rice",160,"g",""]],steps:["Rinse the rice until the water runs clear, then cook according to the packet.","Mix miso paste with softened butter until smooth.","Pat the salmon dry and spread the miso butter over the top.","Bake at 200°C for 12–15 minutes, until just cooked through.","Fluff the rice, plate with salmon and spoon over the pan juices."]},
 {id:2,name:"Creamy tomato pasta",cuisine:"Italian",tags:["comfort food","vegetarian"],prep:10,cook:15,time:25,difficulty:"Easy",rating:4.7,emoji:"🍝",bg:"#efd7c8",servings:2,source:"Nonna's notebook",ingredients:[["Pasta",200,"g","rigatoni"],["Tomatoes",300,"g","crushed"],["Cream",100,"ml",""],["Garlic",2,"pcs","finely sliced"]],steps:["Bring a large pot of salted water to a boil.","Cook the pasta until just shy of al dente; reserve a cup of pasta water.","Gently fry garlic, add tomatoes and simmer for 8 minutes.","Stir in the cream and a splash of pasta water.","Toss the pasta through the sauce until glossy, then season and serve."]},
 {id:3,name:"Ginger chicken bowls",cuisine:"Korean",tags:["dinner","high-protein"],prep:15,cook:25,time:40,difficulty:"Medium",rating:4.9,emoji:"🍲",bg:"#e6d5b8",servings:3,source:"Kitchen journal",ingredients:[["Chicken breast",400,"g","diced"],["Rice",240,"g",""],["Soy sauce",45,"ml",""],["Carrots",2,"pcs","julienned"]],steps:["Cook rice and keep covered.","Whisk soy sauce with grated ginger and a pinch of sugar.","Sear chicken in a hot pan until golden.","Add sauce and simmer until sticky and the chicken is cooked.","Serve over rice with carrots and sesame seeds."]},
 {id:4,name:"Chickpea shakshuka",cuisine:"Mediterranean",tags:["brunch","vegetarian"],prep:10,cook:25,time:35,difficulty:"Easy",rating:4.6,emoji:"🍳",bg:"#e9c993",servings:2,source:"Personal recipe",ingredients:[["Eggs",4,"pcs",""],["Tomatoes",400,"g","crushed"],["Chickpeas",240,"g","drained"],["Bell pepper",1,"pcs","sliced"]],steps:["Soften the pepper in olive oil.","Add tomatoes and chickpeas; simmer until thickened.","Make four wells and crack in the eggs.","Cover and cook until the whites set but yolks remain soft."]},
 {id:5,name:"Lime chicken tacos",cuisine:"Mexican",tags:["dinner","quick"],prep:15,cook:15,time:30,difficulty:"Easy",rating:4.5,emoji:"🌮",bg:"#d9e5c5",servings:3,source:"Adapted from a friend",ingredients:[["Chicken breast",350,"g","thinly sliced"],["Bell pepper",2,"pcs","sliced"],["Lime",2,"pcs","juiced"],["Onion",1,"pcs","sliced"]],steps:["Marinate chicken with lime and spices.","Sear chicken until deeply golden.","Cook pepper and onion until softened.","Pile into warm tortillas and finish with lime."]},
 {id:6,name:"Garlic fried rice",cuisine:"Chinese",tags:["lunch","quick"],prep:5,cook:12,time:17,difficulty:"Easy",rating:4.4,emoji:"🍚",bg:"#e8d8a9",servings:2,source:"Personal recipe",ingredients:[["Rice",300,"g","cooked and cold"],["Eggs",2,"pcs",""],["Garlic",3,"pcs","minced"],["Soy sauce",30,"ml",""]],steps:["Fry garlic gently until golden.","Add cold rice and toss over high heat.","Push rice aside, scramble the eggs, then mix through.","Season with soy sauce and serve immediately."]}
];
let inventory={"Salmon fillet":{qty:350,unit:"g",threshold:150,location:"Fridge"},"Miso paste":{qty:80,unit:"g",threshold:20,location:"Fridge"},Butter:{qty:120,unit:"g",threshold:50,location:"Fridge"},Rice:{qty:800,unit:"g",threshold:250,location:"Pantry"},Pasta:{qty:500,unit:"g",threshold:150,location:"Pantry"},Tomatoes:{qty:650,unit:"g",threshold:250,location:"Fridge"},Cream:{qty:80,unit:"ml",threshold:100,location:"Fridge"},Garlic:{qty:5,unit:"pcs",threshold:3,location:"Pantry"},"Chicken breast":{qty:250,unit:"g",threshold:200,location:"Freezer"},"Soy sauce":{qty:200,unit:"ml",threshold:50,location:"Pantry"},Carrots:{qty:1,unit:"pcs",threshold:2,location:"Fridge"},Eggs:{qty:6,unit:"pcs",threshold:4,location:"Fridge"},Chickpeas:{qty:0,unit:"g",threshold:200,location:"Pantry"},"Bell pepper":{qty:2,unit:"pcs",threshold:1,location:"Fridge"},Onion:{qty:3,unit:"pcs",threshold:2,location:"Pantry"},Lime:{qty:0,unit:"pcs",threshold:2,location:"Fridge"}};
let plans=[{id:1,day:"Monday",recipe:2,slot:"Dinner",servings:2},{id:2,day:"Wednesday",recipe:1,slot:"Dinner",servings:2},{id:3,day:"Friday",recipe:3,slot:"Dinner",servings:3},{id:4,day:"Sunday",recipe:4,slot:"Brunch",servings:2}],shopping=[{name:"Cream",qty:100,unit:"ml",checked:false,sources:["Creamy tomato pasta"]},{name:"Bread",qty:1,unit:"loaf",checked:true,sources:[]}],currentRecipe=null,cookStep=0;
recipes=[];inventory={};plans=[];shopping=[];
const cookbooks=createCookbooks({supabase,escapeHtml,session:()=>({version:sessionVersion,userId:activeUserId}),hydrate:hydrateCovers,mapRecipe,visual:recipeVisual,card,openCookbook:id=>{libraryTab='cookbooks';cookbooks.route(id);show('recipes',true)},getLibrary:async()=>{const version=sessionVersion;await refreshLibrary();return version===sessionVersion?[...createdRecipes(),...recipes.filter(r=>savedIds.has(r.id)&&!ownsRecipe(r))]:[]},remember:rows=>{for(const row of rows){const index=recipes.findIndex(r=>r.id===row.id);if(index<0)recipes.push({...row,temporary:true});else recipes[index]={...recipes[index],...row}}},isLibraryRecipe:id=>savedIds.has(id)||recipes.some(r=>r.id===id&&managedProfiles.some(p=>p.id===r.userId)),saveRecipe:async id=>{const version=sessionVersion;const {error}=await supabase.from('saved_recipes').insert({user_id:activeUserId,recipe_id:id});if(error&&error.code!=='23505')throw error;if(version===sessionVersion){savedIds.add(id);syncBookmarks()}}});
let activeUserId=null,activeProfileId=null,activeProfile=null,managedProfiles=[],loadedUserId=null,sessionVersion=0,showShoppingSources=true,plannerMonday=dateKey(currentWeek()[0]);
let libraryTab='created',savedIds=new Set(),unavailableSaves=[],visitorRecipe=null,libraryRequest=0,routeRequest=0,detailRequest=0;
let detailChoices={},cookingChoices={},plannerSlots=false,draggedMealId=null,cookingLog=null;let oftenBought=[],detailReturn='recipes',recipeFilters={search:'',ready:false,difficulty:'',tag:'',sort:'az'},inventoryFilters={search:'',location:'all',sort:'az',status:'all',tracking:'active'};const purchasePending=new Set();
function loadState(){oftenBought=[];try{oftenBought=readOftenBought(localStorage,activeUserId)}catch(error){console.warn(error)}plannerSlots=false;plans=[];shopping=[];try{({plans,shopping}=readAccountState(localStorage,activeUserId));plannerSlots=activeUserId?localStorage.getItem('mise-meal-planner-slots-'+activeUserId)==='true':false;showShoppingSources=activeUserId?localStorage.getItem('mise-meal-sources-'+activeUserId)!=='false':true;if(activeUserId)writeAccountState(localStorage,activeUserId,{plans,shopping})}catch(error){console.warn('Could not load local UI data.',error)}}
function saveState(){try{writeAccountState(localStorage,activeUserId,{plans,shopping});return true}catch(error){console.warn('Could not save local UI data.',error);toast('Could not save local planner changes');return false}}
function switchAccount(userId){
 if(activeUserId===userId)return;
 cookbooks.reset();sessionVersion++;libraryRequest++;routeRequest++;detailRequest++;savedIds=new Set();unavailableSaves=[];visitorRecipe=null;libraryTab='created';managedProfiles=[];activeProfile=null;activeProfileId=null;for(const url of coverBlobs)URL.revokeObjectURL(url);coverBlobs.clear();window.miseOwnedRecipes=[];detailReturn='recipes';recipeFilters={search:'',ready:false,difficulty:'',tag:'',sort:'az'};inventoryFilters={search:'',location:'all',sort:'az',status:'all',tracking:'active'};purchasePending.clear();$('#recipe-peek')?.remove();$('#planner-recipe-picker')?.remove();$('#post-cook-feedback')?.remove();cookingLog=null;clearCatalogue();clearSubstitutions();clearCategoryColours();detailChoices={};cookingChoices={};draggedMealId=null;plannerMonday=dateKey(currentWeek()[0]);activeUserId=userId;loadedUserId=null;
 recipes=[];inventory={};currentRecipe=null;cookStep=0;loadState();
 $('#modal-root').innerHTML='';
 for(const id of ['recipes','inventory','planner','shopping','detail','cooking','profile','catalogue','discover','tags'])$('#'+id+'-view').innerHTML='';
 window.miseProfileStats={recipes:0,ingredients:0};show('home',true);
}
async function currentUser(){let{data,error}=await supabase.auth.getUser();if(error||!data.user)throw new Error(error?.message||'Please sign in again.');return data.user}
function renderActiveProfileControl(){const select=$('#active-profile-select');if(!select)return;select.innerHTML=managedProfiles.map(profile=>`<option value="${escapeHtml(profile.id)}">@${escapeHtml(profile.username||profile.display_name||'profile')} · ${profile.profile_type==='official'||profile.profile_type==='brand'?'Official':'Personal'}</option>`).join('');select.value=activeProfileId||'';select.hidden=managedProfiles.length<2;const label=$('#active-profile-label');if(label){label.textContent=activeProfile?`@${activeProfile.username||activeProfile.display_name} · ${activeProfile.profile_type==='official'||activeProfile.profile_type==='brand'?'Official':'Personal'}`:'Profile';label.hidden=managedProfiles.length>1}}
async function switchProfile(profileId){const next=managedProfiles.find(profile=>profile.id===profileId);if(!next||next.id===activeProfileId)return;activeProfile=next;activeProfileId=next.id;try{localStorage.setItem(`noms-active-profile-${activeUserId}`,next.id)}catch{}cookbooks.reset();sessionVersion++;libraryRequest++;detailRequest++;loadedUserId=null;recipes=[];currentRecipe=null;visitorRecipe=null;window.miseOwnedRecipes=[];libraryTab='created';$('#modal-root').innerHTML='';for(const id of ['recipes','detail','discover','tags'])$('#'+id+'-view').innerHTML='';renderActiveProfileControl();window.miseActiveProfile=next;window.dispatchEvent(new CustomEvent('mise-active-profile-change',{detail:{profile:next,profiles:managedProfiles}}));show('recipes');await loadDatabase({user:{id:activeUserId}})}
function mapRecipe(row){let items=(row.recipe_ingredients||[]).sort((a,b)=>a.sort_order-b.sort_order);return{id:row.id,userId:row.user_id,visibility:row.visibility||'private',shareCode:row.share_code||null,catalogKey:row.catalog_key||null,creator:row.creator||(row.user_id===activeProfileId?activeProfile:null),imageFraming:normalizeFraming(row.image_framing),imagePath:row._imagePath??row.image_url??'',name:row.name,cuisine:row.cuisine||row.tags?.[0]||'Other',tags:row.tags||[],prep:row.prep_minutes||0,cook:row.cook_minutes||0,cookTimeType:row.cook_time_type||'cooking',time:row.total_minutes??((row.prep_minutes||0)+(row.cook_minutes||0)),difficulty:row.difficulty||'Easy',rating:Number(row.personal_rating)||0,contributeToCommunity:row.contribute_to_community===true,communityAverage:row.community_average==null?null:Number(row.community_average),communityCount:Number(row.community_count)||0,lastCookedAt:row.made_at||null,notes:row.notes||'',emoji:row.emoji||'🍽️',imageUrl:row.image_url||'',bg:/^#[0-9a-f]{3,8}$/i.test(row.background_color||'')?row.background_color:'#dce8df',servings:Number(row.servings)||1,source:row.source_url||row.source||'Personal recipe',ingredients:items.map(item=>{let name=item.ingredient.canonical_name;categories[name]=item.ingredient.category||'Other';return[name,item.quantity===null?null:Number(item.quantity),item.unit,item.preparation_note||'',item.ingredient.id]}),steps:row.instructions||[]}}
async function loadDatabase(session){
 const userId=session?.user?.id||null;switchAccount(userId);
 if(!userId)return;
 const profileLoadVersion=sessionVersion;
 if(!managedProfiles.length){const profiles=await supabase.from('profiles').select('*').order('created_at');if(profileLoadVersion!==sessionVersion)return;if(profiles.error)throw new Error(`Could not load profiles: ${profiles.error.message}`);managedProfiles=profiles.data||[];if(!managedProfiles.some(profile=>profile.id===userId))throw new Error('Your personal profile is unavailable.');let preferred=null;try{preferred=localStorage.getItem(`noms-active-profile-${userId}`)}catch{}activeProfile=managedProfiles.find(profile=>profile.id===preferred)||managedProfiles.find(profile=>profile.id===userId);activeProfileId=activeProfile.id;window.miseActiveProfile=activeProfile;renderActiveProfileControl();window.dispatchEvent(new CustomEvent('mise-active-profile-change',{detail:{profile:activeProfile,profiles:managedProfiles}}))}
 const loadKey=`${userId}:${activeProfileId}`;if(loadedUserId===loadKey)return;
 const version=sessionVersion;loadedUserId=loadKey;$('#home-view')._kitchenVersion=null;$('#home-view')._kitchenIssue=false;$('#home-view')._libraryIssue=false;home();toast('Loading your kitchen…');
 try{
 let[,recipeResult,inventoryResult,categoryPreferences]=await Promise.all([Promise.all([loadSubstitutions(userId),loadCategoryColours(userId)]),supabase.from('recipes').select('*,recipe_ingredients(quantity,unit,preparation_note,sort_order,ingredient:ingredients(id,canonical_name,category))').eq('user_id',activeProfileId).order('created_at'),supabase.from('inventory').select('*,ingredient:ingredients(id,canonical_name,category)').order('created_at'),ingredientCategoryPreferences(userId)]);
 if(version!==sessionVersion)return;
 if(recipeResult.error||inventoryResult.error)throw new Error(recipeResult.error?.message||inventoryResult.error?.message);
 for(const recipe of recipeResult.data||[])for(const item of recipe.recipe_ingredients||[]){const category=categoryPreferences.get(item.ingredient.id);if(category)item.ingredient.category=category;}
 const ownedRows=await hydrateCovers(recipeResult.data||[]);if(version!==sessionVersion)return;recipes=ownedRows.map(mapRecipe);window.miseOwnedRecipes=createdRecipes();try{await refreshLibrary();await restoreReferencedRecipes()}catch(error){if(version!==sessionVersion)return;$('#home-view')._libraryIssue=true;toast(error.message)}if(version!==sessionVersion)return;inventory={};(inventoryResult.data||[]).forEach(row=>{let name=row.ingredient.canonical_name;categories[name]=row.category_override||categoryPreferences.get(row.ingredient.id)||row.ingredient.category||'Other';inventory[name]={category:categories[name],categoryOverride:row.category_override||null,id:row.id,ingredientId:row.ingredient.id,qty:row.quantity===null?null:Number(row.quantity),unit:row.unit,stockStatus:row.stock_status??null,isActive:row.is_active!==false,threshold:Number(row.low_stock_threshold),location:row.storage_location}});shopping=shopping.map(item=>cleanRecipeSources(item,recipes));saveState();window.miseProfileStats={recipes:createdRecipes().length,ingredients:Object.keys(inventory).length};$('#home-view')._kitchenVersion=version;home();let active=document.querySelector('.view.active')?.id;if(active==='recipes-view')recipesView();if(active==='inventory-view')inventoryView();if(active==='planner-view')plannerView();if(active==='shopping-view')shoppingView();if(active==='profile-view')window.dispatchEvent(new CustomEvent('mise-profile-open'));toast('Kitchen loaded');openSharedRoute()
 }catch(error){
  if(version!==sessionVersion)return;
  loadedUserId=null;recipes=[];inventory={};$('#home-view')._kitchenVersion=version;$('#home-view')._kitchenIssue=true;home();toast(`Could not load kitchen: ${error.message}`);
 }
}
async function uploadRecipeCover(file,userId){if(!file?.size)return'';let ext=(file.name.split('.').pop()||'jpg').toLowerCase(),path=`${userId}/${crypto.randomUUID()}.${ext}`,uploaded=await supabase.storage.from('recipe-covers').upload(path,file,{contentType:file.type,upsert:false});if(uploaded.error)throw uploaded.error;return path}
async function createRecipe(record,coverFile){const profileId=activeProfileId,version=sessionVersion,user=await currentUser();if(version!==sessionVersion||profileId!==activeProfileId)throw new Error('Active profile changed. Review the recipe before saving.');record.imagePath=await uploadRecipeCover(coverFile,user.id);record.imageUrl=record.imagePath;if(version!==sessionVersion||profileId!==activeProfileId)throw new Error('Active profile changed. Review the recipe before saving.');let sourceIsUrl=/^https?:\/\//i.test(record.source);let created=await supabase.from('recipes').insert({user_id:profileId,visibility:record.visibility||'private',name:record.name,cuisine:record.cuisine,tags:record.tags,total_minutes:record.time,prep_minutes:record.prep,cook_minutes:record.cook,cook_time_type:record.cookTimeType||'cooking',difficulty:record.difficulty,servings:record.servings,instructions:record.steps,rating:record.rating,image_url:(record.imagePath??record.imageUrl)||null,emoji:record.emoji,background_color:record.bg,source:sourceIsUrl?null:(record.source||null),source_url:sourceIsUrl?record.source:null}).select('*').single();if(created.error)throw new Error(/image_framing/.test(created.error.message)?'Photo framing needs database update 029_recipe_cover_framing.sql.':/cook_time_type/.test(created.error.message)?'Cooking/baking time needs database update 022_recipe_time_type.sql.':created.error.message);try{let links=[];for(let i=0;i<record.ingredients.length;i++){let[name,quantity,unit,note,ingredientId]=record.ingredients[i];if(!ingredientId)throw new Error('Select each ingredient from the catalogue.');links.push({recipe_id:created.data.id,ingredient_id:ingredientId,quantity,unit,preparation_note:note||null,sort_order:i})}let joined=await supabase.from('recipe_ingredients').insert(links);if(joined.error)throw new Error(joined.error.code==='23502'?'Optional amounts need database update 008_optional_recipe_quantities.sql in Supabase.':joined.error.message);const [hydrated]=await hydrateCovers([{image_url:record.imagePath}]);return{...record,userId:profileId,imageUrl:hydrated.image_url,shareCode:created.data.share_code||null,id:created.data.id}}catch(error){await supabase.from('recipes').delete().eq('id',created.data.id);throw error}}
function recipePayload(record){
 const sourceIsUrl=/^https?:\/\//i.test(record.source);
 return {visibility:record.visibility||'private',name:record.name,cuisine:record.cuisine,tags:record.tags,total_minutes:record.time,prep_minutes:record.prep,cook_minutes:record.cook,cook_time_type:record.cookTimeType||'cooking',difficulty:record.difficulty,servings:record.servings,instructions:record.steps,image_url:(record.imagePath??record.imageUrl)||null,image_framing:normalizeFraming(record.imageFraming),source:sourceIsUrl?null:(record.source||null),source_url:sourceIsUrl?record.source:null};
}
async function updateRecipe(id,record,file){
 const profileId=activeProfileId,version=sessionVersion,user=await currentUser();if(version!==sessionVersion||profileId!==activeProfileId)throw new Error('Active profile changed. Review the recipe before saving.');
 if(file?.size){record.imagePath=await uploadRecipeCover(file,user.id);const [hydrated]=await hydrateCovers([{image_url:record.imagePath}]);record.imageUrl=hydrated.image_url}
 if(version!==sessionVersion||profileId!==activeProfileId)throw new Error('Active profile changed. Review the recipe before saving.');
 const {error}=await supabase.rpc('update_recipe',{p_id:id,p_recipe:recipePayload(record),p_ingredients:record.ingredients.map(([,quantity,unit,note,ingredient_id])=>({ingredient_id,quantity,unit,preparation_note:note||null}))});
 if(error)throw new Error(/image_framing/.test(error.message)?'Photo framing needs database update 029_recipe_cover_framing.sql.':error.code==='23502'?'Optional amounts need database update 008_optional_recipe_quantities.sql in Supabase.':error.code==='PGRST202'?'Recipe editing needs the database update 006_recipe_edit.sql applied in Supabase.':error.message);
 const fresh=await supabase.from('recipes').select('share_code,cook_time_type,image_url').eq('id',id).eq('user_id',profileId).single();
 if(fresh.error)throw new Error(/image_framing/.test(fresh.error.message)?'Photo framing needs database update 029_recipe_cover_framing.sql.':/cook_time_type/.test(fresh.error.message)?'Cooking/baking time needs database update 022_recipe_time_type.sql.':fresh.error.message);
 if(file?.size&&fresh.data.image_url!==record.imagePath)throw new Error('The cropped cover was not saved. Please retry.');
 return {...recipes.find(recipe=>recipe.id===id),...record,id,shareCode:fresh.data.share_code||null};
}
async function deleteRecipe(id){
 const profileId=activeProfileId,version=sessionVersion,previousRecipes=recipes,user=await currentUser();if(version!==sessionVersion||profileId!==activeProfileId)throw new Error('Active profile changed. Review the recipe before deleting.');
 const {data,error}=await supabase.from('recipes').delete().eq('id',id).eq('user_id',profileId).select('id');
 if(error)throw error;
 if(!data?.length)throw new Error('Recipe not found or access denied.');
 if(version!==sessionVersion)return false;
 shopping=detachRecipeSources(shopping,id,previousRecipes);recipes=recipes.filter(r=>r.id!==id);plans=plans.filter(p=>p.recipe!==id);
 if(currentRecipe?.id===id)currentRecipe=null;
 const saved=saveState();
 $('#detail-view').innerHTML='';$('#cooking-view').innerHTML='';
 home();show('recipes');
 toast(saved?'Recipe deleted':'Recipe deleted. Plan cleanup could not be saved in this browser.');return true;
}

async function upsertInventory(name,item,expectedUserId=null,{isActive=true}={}){if(!isActive&&item.qty!==0)throw new Error('Only out-of-stock ingredients can be marked inactive.');if(!item.ingredientId)throw new Error('Select an ingredient from the catalogue.');let user=await currentUser(),ingredient={id:item.ingredientId};if(expectedUserId&&(user.id!==expectedUserId||activeUserId!==expectedUserId))throw new Error('Please sign in again.');let result=await supabase.from('inventory').upsert({user_id:user.id,ingredient_id:ingredient.id,quantity:item.qty,is_active:isActive,unit:item.unit,storage_location:item.location,low_stock_threshold:item.threshold,...(item.stockStatus||Object.values(inventory).some(stock=>stock.ingredientId===item.ingredientId&&stock.stockStatus)?{stock_status:item.stockStatus??null}:{}),updated_at:new Date().toISOString(),category_override:item.categoryOverride??Object.values(inventory).find(stock=>stock.ingredientId===item.ingredientId)?.categoryOverride??null},{onConflict:'user_id,ingredient_id'}).select('id,ingredient_id').single();if(result.error)throw new Error(/is_active/.test(result.error.message)?'Pantry tracking needs database update 019_inventory_tracking.sql.':/stock_status/.test(result.error.message)?'Unknown-amount low-stock status needs database update 017_inventory_stock_status.sql.':result.error.message);return{...item,isActive,id:result.data.id,ingredientId:result.data.ingredient_id}}
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],fmt=n=>Number.isInteger(n)?n:n.toFixed(1);
function checks(r,s=r.servings,choices={}){return recipeChecks(r,inventory,s,substitutionRules(),choices)}
function availability(r,s){return checks(r,s).filter(needsPurchase).length}
function recipeVisual(recipe,loading='lazy'){return recipe.imageUrl?`<img src="${escapeHtml(recipe.imageUrl)}" alt="${escapeHtml(recipe.name)}" style="${framingStyle(recipe.imageFraming)}" loading="${loading}">`:`<div class="cover-fallback">${icon('utensils')}<span>A favourite in the making.</span></div>`}
// Covers can become unavailable independently of the recipe's access or data.
document.addEventListener('error',event=>{
 const image=event.target;if(!image.matches?.('.home-community-image>img,.home-recipe-image>img,.detail-image>img'))return;
 const fallback=document.createElement('div');fallback.className='cover-fallback';fallback.innerHTML=`${icon('utensils')}<span>Recipe photo unavailable.</span>`;image.replaceWith(fallback);
},true);
document.addEventListener('change',event=>{
 if(event.target.id!=='servings')return;const label=$('#recipe-yield-fact'),value=Number(event.target.value);
 if(label&&Number.isFinite(value)&&value>=1)label.textContent=String(value);
});
function recipeTagsMarkup(recipe){const tags=[...new Set((recipe.tags||[]).filter(Boolean))];if(!tags.length&&recipe.cuisine)tags.push(recipe.cuisine);return `<div class="recipe-tags" style="display:flex;gap:6px;flex-wrap:wrap">${tags.map(tag=>`<button type="button" class="tag" data-browse-tag="${escapeHtml(tag)}" aria-label="Browse recipes tagged ${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join('')}</div>`}
function recipeColour(recipe){
 const key=String(recipe.id||recipe.name||'recipe');
 const hash=Array.from(key).reduce((value,letter)=>(value*31+letter.charCodeAt(0))>>>0,0);
 return ['#f5cce1','#e5ed66','#cab7fb'][hash%3];
}
function recipeCardActions(recipe){
 const saved=ownsRecipe(recipe)||savedIds.has(recipe.id);
 return `<details class="recipe-card-actions"><summary aria-label="Recipe actions for ${escapeHtml(recipe.name)}" title="Recipe actions">${icon('plus')}</summary><div class="recipe-card-menu"><button type="button" data-cookbook-add="${escapeHtml(recipe.id)}">${icon('book')}<span>Add to Cookbook</span></button><button type="button" data-card-plan="${escapeHtml(recipe.id)}">${icon('calendar')}<span>Add to Meal Plan</span></button><button type="button" data-card-save data-card-owned="${ownsRecipe(recipe)}" data-save-recipe="${escapeHtml(recipe.id)}" aria-pressed="${saved}" ${ownsRecipe(recipe)?'disabled':''}>${icon(saved?'check':'bookmark')}<span>${saved?'Saved':'Save'}</span></button></div></details>`;
}
function card(r,{showCookbook=true}={}){const rows=checks(r),missing=rows.some(needsPurchase),label=recipeAvailabilityLabel(rows);return `<article class="recipe-card" style="--recipe-color:${recipeColour(r)}" tabindex="0" role="link" aria-label="Open ${escapeHtml(r.name)}" data-recipe="${escapeHtml(r.id)}">${showCookbook?recipeCardActions(r):''}<div class="recipe-image">${recipeVisual(r,'eager')}<span class="compat ${missing?'warn':''}">${missing?'':icon('check')}<span class="compat-label">${escapeHtml(label)}</span></span></div><div class="card-body"><div class="card-copy">${recipeAttribution(r)}${recipeTagsMarkup(r)}<h3>${escapeHtml(r.name)}</h3><div class="card-meta"><span>${icon('clock')}${r.time} min</span><span>·</span><span>${escapeHtml(r.difficulty)}</span></div><div class="card-ratings">${communityRatingMarkup(r)}<span class="personal-rating">${r.rating?`★ ${r.rating} · Your rating`:'Not rated by you'}</span></div></div><button class="round-btn" data-open-recipe="${escapeHtml(r.id)}" aria-label="Open ${escapeHtml(r.name)}">${icon('arrow')}</button></div></article>`}
// One explicit editorial selection from the existing official catalogue; no rotation.
const homeFeaturedCatalogKey='gochujang-pasta-v1';
function home(){
 const root=$('#home-view'),now=new Date(),loading=!loadedUserId||root._kitchenVersion!==sessionVersion;
 const issue=root._kitchenVersion===sessionVersion&&root._kitchenIssue;
 const cookbook=recipes.filter(recipe=>ownsRecipe(recipe)||savedIds.has(recipe.id)).sort((a,b)=>(Date.parse(b.lastCookedAt)||0)-(Date.parse(a.lastCookedAt)||0)||a.name.localeCompare(b.name,'en')||String(a.id).localeCompare(String(b.id)));
 $('#today-label').textContent=new Intl.DateTimeFormat('en',{weekday:'long',month:'long',day:'numeric'}).format(now);
 $('#kitchen-summary').textContent='Your kitchen, your kind of cooking.';
 const status=issue?'<p class="home-state" role="status">Your kitchen couldn’t load. <button class="text-btn" data-home-retry>Try again</button></p>':loading?'<p class="home-state" role="status">Opening your kitchen…</p>':'';
 $('#home-recipes').innerHTML=status||(cookbook.slice(0,4).map(recipe=>`<a class="home-recipe" href="#/recipe/${escapeHtml(recipe.id)}" data-home-recipe="${escapeHtml(recipe.id)}"><div class="home-recipe-image">${recipeVisual(recipe)}</div><div class="home-recipe-copy"><h3>${escapeHtml(recipe.name)}</h3>${recipe.time>0?`<span>${recipe.time} min</span>`:''}</div></a>`).join('')||`<div class="home-cookbook-empty"><span class="home-empty-mark" aria-hidden="true">${icon('book')}</span><h3>Good taste starts here.</h3><p>A recipe you love is all it takes. Create one, or find a favourite in Discover.</p><div><button class="primary-btn" data-action="add-recipe">${icon('plus')}Add recipe</button><a href="#/discover" data-view="discover" class="text-btn">Explore Discover →</a></div></div>`)+(root._libraryIssue?'<p class="home-state" role="status">Saved recipes couldn’t load. <button class="text-btn" data-home-retry>Try again</button></p>':'');
 $('#home-meals').innerHTML=status||Array.from({length:3},(_,index)=>{
  const day=new Date(now.getFullYear(),now.getMonth(),now.getDate()+index,12),key=dateKey(day);
  const entries=plans.filter(plan=>plan.date===key).sort((a,b)=>['Breakfast','Brunch','Lunch','Dinner','Snack'].indexOf(a.slot)-['Breakfast','Brunch','Lunch','Dinner','Snack'].indexOf(b.slot));
  return `<section class="home-day"><div class="home-day-date"><span>${index===0?'Today':new Intl.DateTimeFormat('en',{weekday:'long'}).format(day)}</span><time datetime="${key}">${new Intl.DateTimeFormat('en',{month:'short',day:'numeric'}).format(day)}</time></div><div class="home-day-meals">${entries.length?entries.map(plan=>{const recipe=recipes.find(recipe=>recipe.id===plan.recipe);return recipe?`<a class="home-planned-meal" href="#/recipe/${escapeHtml(recipe.id)}" data-home-recipe="${escapeHtml(recipe.id)}"><span class="home-meal-copy"><strong>${escapeHtml(recipe.name)}</strong><small>${plan.isLeftover?'Leftovers · ':''}${escapeHtml(plan.slot||'Meal')}${plan.servings>0?` · ${plan.servings} ${Number(plan.servings)===1?'serving':'servings'}`:''}</small></span>${recipe.imageUrl?`<img src="${escapeHtml(recipe.imageUrl)}" alt="" style="${framingStyle(recipe.imageFraming)}" loading="lazy">`:''}</a>`:'<p class="home-unavailable">Recipe unavailable. <a href="#/meal-plan/weekly" data-view="planner">Review in Meal Plan</a></p>'}).join(''):`<button class="home-add-meal" data-add-date="${key}">${icon('plus')}Add meal<span class="sr-only"> for ${escapeHtml(day.toDateString())}</span></button>`}</div></section>`;
 }).join('');
 const target=$('#home-pick');
 if(!activeUserId){target.innerHTML='';target._version=null;return}
 if(target._version!==sessionVersion){target._version=sessionVersion;loadHomePick()}
}
async function loadHomePick(){
 const target=$('#home-pick'),version=sessionVersion,request=Symbol();target._request=request;
 target.innerHTML='<p class="home-state" role="status">Finding the Noms Pick…</p>';
 try{
  const result=await supabase.from('recipes').select('id').eq('catalog_key',homeFeaturedCatalogKey).eq('visibility','public').limit(1);
  if(version!==sessionVersion||target._request!==request)return;if(result.error)throw result.error;
  let row=null;
  if(result.data?.[0]){const resultRecipe=await supabase.rpc('get_visible_recipe',{p_id:result.data[0].id});if(resultRecipe.error)throw resultRecipe.error;row=resultRecipe.data}
  if(version!==sessionVersion||target._request!==request)return;
  if(!row||row.visibility!=='public'||row.creator?.username!=='noms'||row.creator?.profile_type!=='official'){target.innerHTML='<p class="home-state">The next pick is still in the kitchen. Find something good in Discover.</p>';return}
  const [hydrated]=await hydrateCovers([row]);if(version!==sessionVersion||target._request!==request)return;
  const recipe=mapRecipe(hydrated);
  target.innerHTML=`<a class="home-community-recipe" href="#/recipe/${escapeHtml(recipe.id)}" data-home-recipe="${escapeHtml(recipe.id)}"><div class="home-community-image">${recipeVisual(recipe)}</div><div class="home-community-copy"><p class="home-section-label home-pick-index">NOMS PICK / 001</p><h3>${escapeHtml(recipe.name)}</h3><p>From the Noms kitchen.<br>One for a change of pace.</p><span class="home-pick-action">View recipe ${icon('arrow')}</span></div></a>`;
 }catch(error){if(version===sessionVersion&&target._request===request)target.innerHTML='<p class="home-state" role="status">The Noms Pick couldn’t load. <button class="text-btn" data-home-pick-retry>Try again</button></p>'}
}
document.addEventListener('click',event=>{
 const recipe=event.target.closest('[data-home-recipe]');if(recipe){event.preventDefault();detail(recipe.dataset.homeRecipe,'home');return}
 if(event.target.closest('[data-home-pick-retry]'))loadHomePick();
 if(event.target.closest('[data-home-retry]')){loadedUserId=null;loadDatabase({user:{id:activeUserId}})}
});

function recipesView(){
 if(libraryTab==='cookbooks'){cookbooks.render();return}
 cookbooks.reset();
 const tags=[...new Set(libraryRecipes().flatMap(recipe=>[recipe.cuisine,...recipe.tags]).filter(Boolean))].sort();
 const root=$('#recipes-view');
 if(root._libraryPageVersion!==sessionVersion){root._libraryPages=new Map();root._libraryPageVersion=sessionVersion;root._libraryTab=null;}
 if(root._libraryTab!==libraryTab){
  if(root._libraryTab&&root.querySelector('#all-recipes'))root._libraryPages.set(root._libraryTab,{nodes:[...root.childNodes],markup:root._libraryMarkup});
  const cached=root._libraryPages.get(libraryTab);
  root.replaceChildren(...(cached?.nodes||[]));root._libraryMarkup=cached?.markup;root._libraryTab=libraryTab;
 }
 const markup=`<div class="page-head"><div><p class="eyebrow">YOUR LITTLE BLACK COOKBOOK</p><h1>${libraryTab==='saved'?'Saved recipes':'Created recipes'}</h1><p>${libraryRecipes().length} recipes · ${libraryRecipes().filter(r=>!availability(r)).length} ready to cook</p></div><div class="detail-actions"><button class="secondary-btn" data-import-recipe>Import from website</button><button class="primary-btn" data-action="add-recipe">＋ Add recipe</button></div></div><div class="toolbar recipe-list-controls"><label class="search">${icon('search')}<input id="recipe-search" value="${escapeHtml(recipeFilters.search)}" placeholder="Search recipes or ingredients…"></label><button class="filter ${recipeFilters.ready?'':'active'}" data-filter="all">All</button><button class="filter ${recipeFilters.ready?'active':''}" data-filter="ready">Ready now</button><label><span class="sr-only">Difficulty</span><select data-recipe-difficulty><option value="">All difficulties</option>${['Easy','Medium','Hard'].map(level=>`<option ${recipeFilters.difficulty===level?'selected':''}>${level}</option>`).join('')}</select></label><label><span class="sr-only">Tags</span><select data-recipe-tag><option value="">All tags</option>${tags.map(tag=>`<option ${recipeFilters.tag===tag?'selected':''}>${escapeHtml(tag)}</option>`).join('')}</select></label><label><span class="sr-only">Sort</span><select data-recipe-sort>${[['az','Name A–Z'],['za','Name Z–A'],['time-asc','Time: shortest first'],['time-desc','Time: longest first'],['rating-desc','Your rating: highest first'],['rating-asc','Your rating: lowest first'],['difficulty-asc','Difficulty: easiest first'],['difficulty-desc','Difficulty: hardest first']].map(([value,label])=>`<option value="${value}" ${recipeFilters.sort===value?'selected':''}>${label}</option>`).join('')}</select></label></div><p class="list-result-count" id="recipe-result-count"></p><div class="recipe-grid" id="all-recipes"></div>`;if(root._libraryMarkup!==markup||!root.querySelector('#all-recipes')){root.innerHTML=markup;root._libraryMarkup=markup;}applyRecipeFilters();
}
function applyRecipeFilters(){const rows=filterRecipes(libraryRecipes(),recipeFilters,recipes.filter(recipe=>!availability(recipe)).map(recipe=>recipe.id));const grid=$('#all-recipes'),markup=(rows.map(card).join('')||'<p>No recipes match these filters.</p>')+(libraryTab==='saved'?unavailableSaves.map(id=>`<article class="panel"><p>This saved recipe is unavailable.</p><button class="text-btn danger-action" data-save-recipe="${escapeHtml(id)}">Remove from Saved</button></article>`).join(''):'');if(grid._cardsMarkup!==markup){grid.innerHTML=markup;grid._cardsMarkup=markup;}$('#recipe-result-count').textContent=`${rows.length} recipes shown`}
function invRows(rows){return rows.map(([name,item])=>{const status=item.qty===0?'Out of stock':stockStatus(item)==='low'||stockStatus(item)==='out'?'Low stock':'In stock',category=item.category||categories[name]||'Other';return `<tr data-location-row="${escapeHtml(item.location)}"><td><span class="category-dot" style="background:${categoryColour(category)}" aria-hidden="true"></span><strong>${escapeHtml(name)}</strong>${item.isActive===false?'<small class="inactive-label">Inactive</small>':''}</td><td><button type="button" data-edit-inventory="${escapeHtml(item.ingredientId)}" aria-label="Change stock status for ${escapeHtml(name)}" class="status ${status==='In stock'?'good':status==='Low stock'?'low':'out'}">${status}</button></td><td><div class="qty-control"><button data-qty="-" ${item.qty===null||item.isActive===false?'disabled':''} data-name="${escapeHtml(name)}">−</button><b>${item.qty===null?'Still have some — amount unknown':`${item.qty} ${escapeHtml(item.unit)}`}</b><button data-qty="+" ${item.qty===null||item.isActive===false?'disabled':''} data-name="${escapeHtml(name)}">＋</button></div></td><td>${escapeHtml(item.location)}</td><td><span class="category-dot" style="background:${categoryColour(category)}" aria-hidden="true"></span>${escapeHtml(category)}</td><td><button class="text-btn" data-edit-inventory="${escapeHtml(item.ingredientId)}">Edit</button></td><td><button class="inventory-shopping icon-cart-btn" data-inventory-shopping="${escapeHtml(item.ingredientId)}" aria-label="Add ${escapeHtml(name)} to shopping list">${icon('cartPlus')}</button></td></tr>`}).join('')}
function inventoryView(){
 const rows=filterInventory(inventory,{tracking:inventoryFilters.tracking});
 $('#inventory-view').innerHTML=`<div class="page-head"><div><p class="eyebrow">AT HOME</p><h1>Inventory</h1><p>${rows.length} ${inventoryFilters.tracking==='all'?'total':inventoryFilters.tracking} ingredients across fridge, freezer and pantry</p></div><div class="detail-actions"><button class="secondary-btn" data-view="catalogue">Manage ingredients</button><button class="primary-btn" data-action="add-inventory">＋ Add ingredient</button></div></div><div class="stat-grid" role="group" aria-label="Filter by stock status">${[['stock','In stock',''],['low','Running low','amber'],['out','Out of stock','coral']].map(([value,label,colour])=>`<button type="button" class="stat stock-filter ${colour}" data-inventory-status="${value}" aria-pressed="${inventoryFilters.status===value}"><b>${(value==='out'?Object.entries(inventory):rows).filter(([,item])=>stockStatus(item)===value&&(value!=='out'||item.isActive!==false)).length}</b><span>${label}</span></button>`).join('')}</div><div class="toolbar inventory-list-controls"><label class="search"><span class="sr-only">Search inventory</span>${icon('search')}<input id="inventory-search" value="${escapeHtml(inventoryFilters.search)}" placeholder="Search your kitchen…"></label><label><span class="sr-only">Tracking</span><select data-inventory-tracking-filter>${[['active','Active ingredients'],['inactive','Inactive ingredients'],['all','All ingredients']].map(([value,label])=>`<option value="${value}" ${inventoryFilters.tracking===value?'selected':''}>${label}</option>`).join('')}</select></label>${['all','Fridge','Freezer','Pantry'].map(location=>`<button class="filter ${inventoryFilters.location===location?'active':''}" data-location="${location}">${location==='all'?'All locations':location}</button>`).join('')}<label><span class="sr-only">Sort</span><select data-inventory-sort>${[['az','Name A–Z'],['za','Name Z–A'],['stock','In stock first'],['low','Low / out of stock first']].map(([value,label])=>`<option value="${value}" ${inventoryFilters.sort===value?'selected':''}>${label}</option>`).join('')}</select></label></div><p class="list-result-count" id="inventory-result-count" role="status"></p><div class="table-wrap"><table><thead><tr><th>Ingredient</th><th>Status</th><th>Quantity</th><th>Location</th><th>Category</th><th><span class="sr-only">Edit ingredient</span></th><th><span class="sr-only">Add to shopping</span></th></tr></thead><tbody id="inventory-body"></tbody></table></div>`;applyInventoryFilters()
}
function applyInventoryFilters(){const rows=filterInventory(inventory,inventoryFilters);$('#inventory-body').innerHTML=invRows(rows)||'<tr><td colspan="7">No ingredients match these filters.</td></tr>';$('#inventory-result-count').textContent=`${rows.length} ingredient${rows.length===1?'':'s'} shown${inventoryFilters.status==='all'?'':' · Select the highlighted stock filter again to show all statuses.'}`}
function stockFields(item={},names={quantity:'inventory-quantity',unit:'inventory-unit',threshold:'inventory-threshold'}){
 const mode=item.qty===null?'unknown':item.qty===0?'empty':'exact',limit=item.threshold??0;
 return `<div class="stock-fields"><label>Track stock<select name="stock-mode" data-stock-mode><option value="exact" ${mode==='exact'?'selected':''}>Use a quantity</option><option value="unknown" ${mode==='unknown'?'selected':''}>Still have some — amount unknown</option><option value="empty" ${mode==='empty'?'selected':''}>Out of stock</option></select></label><div class="form-grid"><label data-stock-quantity ${mode==='exact'?'':'hidden'}>Amount<input type="number" name="${names.quantity}" min="0" step="any" value="${item.qty??''}" ${mode==='exact'?'required':'disabled'}></label><label>Unit<select name="${names.unit}">${[...new Set([...units,item.unit])].filter(Boolean).map(unit=>`<option ${unit===(item.unit||'piece')?'selected':''}>${escapeHtml(unit)}</option>`).join('')}</select></label></div><label data-stock-status ${mode==='unknown'?'':'hidden'}>Stock status<select name="stock-status"><option value="stock">In stock</option><option value="low" ${item.stockStatus==='low'?'selected':''}>Running low</option></select></label><label>Running low at or below<input name="${names.threshold}" type="number" min="0" step="any" required value="${limit}"><small>In the unit selected above. Applies when you track a quantity.</small></label></div>`;
}
document.addEventListener('change',event=>{if(!event.target.matches('[data-stock-mode]'))return;const fields=event.target.closest('.stock-fields'),exact=event.target.value==='exact',input=fields.querySelector('[data-stock-quantity] input');fields.querySelector('[data-stock-quantity]').hidden=!exact;input.disabled=!exact;input.required=exact;fields.querySelector('[data-stock-status]').hidden=event.target.value!=='unknown';syncInventoryTracking(fields.closest('form'))});
document.addEventListener('input',event=>{if(event.target.matches('[name="inventory-quantity"]'))syncInventoryTracking(event.target.closest('form'))});
function syncInventoryTracking(form){
 const state=form?.querySelector('[name="inventory-active"]'),button=form?.querySelector('[data-set-inventory-active]');if(!state||!button)return;
 const mode=form.elements['stock-mode'].value,amount=form.elements['inventory-quantity'].value,out=mode==='empty'||(mode==='exact'&&amount.trim()!==''&&Number(amount)===0);
 if(!out)state.value='true';
 const active=state.value==='true';button.dataset.nextActive=String(!active);button.textContent=active?'Mark as Inactive':'Reactivate';button.disabled=active&&!out;button.setAttribute('aria-describedby','inactive-explanation');
 form.querySelector('#inactive-explanation').textContent=out?(active?'Changes are saved when you select Save changes.':'This ingredient will be inactive when you save changes.'):'Only out-of-stock ingredients can be marked inactive. Select Out of stock or set the amount to zero.';
}
function addInventoryModal(ingredient=null){modal(ingredient?'Track '+ingredient.canonical_name:'Add ingredient',`${ingredientPicker('ingredient')}${stockFields({qty:ingredient?0:null,unit:ingredient?.default_unit||'piece',threshold:0},{quantity:'qty',unit:'unit',threshold:'threshold'})}<label>Location<select name="location"><option>Fridge</option><option>Freezer</option><option>Pantry</option></select></label>`);if(ingredient)presetIngredient($('#modal-form .ingredient-picker'),ingredient)}
function editInventoryModal(id){const entry=Object.entries(inventory).find(([,item])=>item.ingredientId===id);if(!entry)return;const [name,item]=entry,category=item.category||categories[name]||'Other',options=[...new Set([...ingredientCategories,...Object.values(categories),category])].sort();modal('Edit '+name,`<input type="hidden" name="edit-inventory-id" value="${escapeHtml(id)}">${stockFields(item)}<label>Location<select name="inventory-location">${['Fridge','Freezer','Pantry'].map(location=>`<option ${item.location===location?'selected':''}>${location}</option>`).join('')}</select></label><label>Category<select name="inventory-category">${options.map(value=>`<option ${category===value?'selected':''}>${escapeHtml(value)}</option>`).join('')}</select></label><input type="hidden" name="inventory-active" value="${item.isActive!==false}"><div class="inventory-tracking-actions"><p>Active ingredients appear in your everyday pantry.</p><button type="button" class="secondary-btn" data-set-inventory-active="${escapeHtml(id)}">Mark as Inactive</button><small id="inactive-explanation"></small></div>`,'Save changes');syncInventoryTracking($('#modal-form'))}
document.addEventListener('noms-ingredient-selected',async event=>{
 const picker=event.target,form=picker.closest('form');if(form?.id!=='modal-form'||!form.querySelector('[name="ingredient"]'))return;
 const ingredient=event.detail.ingredient,version=sessionVersion;
 const fields=['unit','location','threshold'].map(name=>form.elements.namedItem(name));
 const initial=fields.map(field=>field.value),changed=new Set();
 const mark=event=>changed.add(event.target);form.addEventListener('input',mark);form.addEventListener('change',mark);
 const token={};form.ingredientDefaultToken=token;
 try{
  const defaults=await ingredientDefaults(ingredient.id);
  if(!form.isConnected||version!==sessionVersion||form.ingredientDefaultToken!==token)return;
  const values=[defaults?.default_unit||ingredient.default_unit||'piece',defaults?.storage_location||'Pantry',defaults?.low_stock_threshold??0];
  fields.forEach((field,i)=>{if(!changed.has(field)&&field.value===initial[i])field.value=String(values[i])});
 }catch(error){if(form.isConnected&&version===sessionVersion)toast(error.message)}
 finally{form.removeEventListener('input',mark);form.removeEventListener('change',mark)}
});
async function saveInventoryEdit(data){const id=data.get('edit-inventory-id'),entry=Object.entries(inventory).find(([,item])=>item.ingredientId===id);if(!entry)throw new Error('Ingredient no longer exists.');const version=sessionVersion,user=await currentUser();if(version!==sessionVersion||user.id!==activeUserId)throw new Error('Please sign in again.');const location=data.get('inventory-location'),category=data.get('inventory-category'),draft=stockDraft(data),values={storage_location:location,category_override:category,quantity:draft.qty,unit:draft.unit,low_stock_threshold:draft.threshold};const isActive=draft.qty!==0?true:data.get('inventory-active')===null?entry[1].isActive!==false:data.get('inventory-active')!=='false';values.is_active=isActive;if(draft.stockStatus||entry[1].stockStatus)values.stock_status=draft.stockStatus;const {data:saved,error}=await supabase.from('inventory').update(values).eq('ingredient_id',id).eq('user_id',user.id).select('id');if(error)throw new Error(/stock_status/.test(error.message)?'Unknown-amount low-stock status needs database update 017_inventory_stock_status.sql.':error.message);if(!saved?.length)throw new Error('Ingredient not found or access denied.');if(version!==sessionVersion)return;inventory[entry[0]]={...entry[1],...draft,isActive,location,category,categoryOverride:category};categories[entry[0]]=category}
function planRecipePhoto(recipe){return recipe.imageUrl?`<img src="${escapeHtml(recipe.imageUrl)}" alt="" style="${framingStyle(recipe.imageFraming)}" loading="lazy">`:`<div class="plan-photo-placeholder" aria-hidden="true">${icon('utensils')}</div>`}
function plannedCard(plan){
 const recipe=recipes.find(r=>r.id===plan.recipe);if(!recipe)return '';
 return `<article class="planned-card ${plan.isLeftover?'leftover-card':''}" draggable="true" data-plan-card="${escapeHtml(plan.id)}" data-recipe="${escapeHtml(recipe.id)}"><div class="planned-photo">${planRecipePhoto(recipe)}${plan.isLeftover?'<span class="leftover-badge">Leftovers</span>':''}</div><strong>${escapeHtml(recipe.name)}</strong><div class="planned-card-actions"><button class="plan-edit" data-edit-plan="${escapeHtml(plan.id)}">Move / edit</button><details class="plan-menu"><summary>More</summary>${plan.isLeftover?`<button data-open-recipe="${escapeHtml(recipe.id)}">View recipe</button>`:`<button data-start="${escapeHtml(recipe.id)}" data-cook-plan="${escapeHtml(plan.id)}" data-servings="${plan.servings}">Start cooking</button>`}<button data-duplicate-plan="${escapeHtml(plan.id)}">Duplicate meal</button><button data-leftover-plan="${escapeHtml(plan.id)}">Plan leftovers</button></details></div></article>`;
}
function openPlannerGallery(context={}){
 if(!recipes.length)return toast('Add a recipe first');
 let dialog=$('#planner-recipe-picker');if(!dialog){dialog=document.createElement('dialog');dialog.id='planner-recipe-picker';dialog.className='planner-recipe-picker';document.body.append(dialog)}
 dialog._planContext=context;
 const tags=[...new Set(recipes.flatMap(recipe=>[recipe.cuisine,...(recipe.tags||[])]).filter(Boolean))].sort();
 dialog.innerHTML=`<div class="gallery-heading"><div><p class="eyebrow">SOMETHING GOOD ON THE MENU</p><h2>What sounds good?</h2></div><button type="button" class="round-btn" data-close-gallery aria-label="Close recipe gallery">×</button></div><div class="gallery-controls"><label class="search"><span class="sr-only">Search recipes</span><input type="search" data-gallery-search placeholder="Find a recipe…"></label><label><span class="sr-only">Filter recipes</span><select data-gallery-filter><option value="all">All recipes</option><option value="ready">Ready to cook</option><option value="quick">30 minutes or less</option></select></label><label><span class="sr-only">Cuisine or tag</span><select data-gallery-tag><option value="">All cuisines & tags</option>${tags.map(tag=>`<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join('')}</select></label></div><div class="recipe-shelves"></div>`;
 renderPlannerGallery();dialog.querySelector('[data-close-gallery]').onclick=()=>dialog.close();
 dialog.onclick=event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close()}};
 if(!dialog.open)dialog.showModal();
}
function renderPlannerGallery(){
 const dialog=$('#planner-recipe-picker');if(!dialog)return;
 const shelves=recipeShelves(recipes,{query:dialog.querySelector('[data-gallery-search]').value,filter:dialog.querySelector('[data-gallery-filter]').value,tag:dialog.querySelector('[data-gallery-tag]').value,readyIds:recipes.filter(recipe=>!availability(recipe)).map(recipe=>recipe.id)});
 dialog.querySelector('.recipe-shelves').innerHTML=shelves.map(shelf=>`<section class="recipe-shelf" data-shelf="${shelf.id}"><div class="shelf-heading"><h3>${shelf.title}</h3><p>${shelf.description}</p></div>${shelf.recipes.length?`<div class="recipe-shelf-row">${shelf.recipes.map(recipe=>`<button type="button" class="gallery-recipe" data-select-plan-recipe="${escapeHtml(recipe.id)}">${planRecipePhoto(recipe)}<strong>${escapeHtml(recipe.name)}</strong></button>`).join('')}</div>`:`<p class="shelf-empty">${shelf.id==='recent'||shelf.id==='while'?'No matching cooking history yet.':'No matching recipes yet.'}</p>`}</section>`).join('');
}
function selectPlannerRecipe(id){
 const dialog=$('#planner-recipe-picker'),context=dialog?._planContext||{},recipe=recipes.find(recipe=>recipe.id===id);if(!recipe)return;
 dialog.close();
 if(context.change&&$('#modal-form')?.elements.recipe){const form=$('#modal-form');form.elements.recipe.value=id;form._substitutions={};form._leftoverOf=null;$('#selected-plan-recipe').innerHTML=planRecipePhoto(recipe)+`<strong>${escapeHtml(recipe.name)}</strong>`;refreshPlanMissing();return}
 planModal(id);const form=$('#modal-form');if(context.date)form.elements.date.value=context.date;if(context.slot)form.elements.slot.value=context.slot;
 refreshPlanMissing();
}
function plannerView(){
 const dates=currentWeek(parseDate(plannerMonday));
 $('#planner-view').innerHTML=`<div class="page-head"><div><p class="eyebrow">${weekLabel(dates)}</p><h1>Weekly overview</h1><p>Drag a meal to move it, or use Move / edit. Plan leftovers without adding to your shopping list.</p></div><button class="primary-btn" data-action="plan-meal">＋ Plan a meal</button></div><div class="planner-controls"><div class="week-navigation"><button class="secondary-btn" data-week="-1" data-drop-week="-1" aria-label="Previous week">← Previous week</button><button class="secondary-btn" data-week="today">This week</button><button class="secondary-btn" data-week="1" data-drop-week="1" aria-label="Next week">Next week →</button></div><label class="planner-view-toggle"><input type="checkbox" data-planner-slots ${plannerSlots?'checked':''}> Show meal slots</label></div><p class="planner-drag-status" role="status" aria-live="polite"></p><div class="week-grid ${plannerSlots?'with-meal-slots':''}">${dates.map((date,index)=>{
 const key=dateKey(date),day=weekdays[index],meals=plans.filter(plan=>plan.date===key&&recipes.some(recipe=>recipe.id===plan.recipe));
 const add=slot=>`<button class="add-slot" data-add-date="${key}" data-add-meal-slot="${slot}">＋ Add ${plannerSlots?slot.toLowerCase():'meal'}</button>`;
 return `<section class="day-column" data-planner-date="${key}" ${plannerSlots?'':`data-drop-date="${key}"`}><div class="day-title"><b>${day.slice(0,3)}</b><span class="day-date">${date.getDate()}</span><small class="today-label" hidden>Today</small></div>${plannerSlots?mealSlots.map(slot=>`<section class="meal-slot" data-drop-date="${key}" data-drop-slot="${slot}" aria-label="${day} ${slot}"><h3>${slot}</h3>${meals.filter(plan=>(plan.slot==='Brunch'?'Lunch':plan.slot)===slot).map(plannedCard).join('')}${add(slot)}</section>`).join(''):meals.map(plannedCard).join('')+add('Dinner')}</section>`;
 }).join('')}</div>`;
 highlightPlannerToday();
}
function highlightPlannerToday(){
 const today=dateKey(new Date());
 for(const column of $$('[data-planner-date]')){
  const current=column.dataset.plannerDate===today;
  column.classList.toggle('is-today',current);
  if(current)column.setAttribute('aria-current','date');else column.removeAttribute('aria-current');
  column.querySelector('.today-label').hidden=!current;
 }
}
setInterval(()=>{if(!document.hidden)highlightPlannerToday()},30000);
function movePlannedMeal(id,date,slot){
 const before=plans;
 try{plans=moveMeal(plans,id,date,slot);if(!saveState()){plans=before;return false}plannerMonday=dateKey(currentWeek(parseDate(date))[0]);plannerView();home();const meal=plans.find(plan=>String(plan.id)===String(id));$('.planner-drag-status').textContent=`Meal moved to ${meal.day}, ${date}, ${meal.slot}.`;return true}
 catch(error){plans=before;toast(error.message);return false}
}
function duplicatePlanModal(id,leftover){
 const source=plans.find(plan=>String(plan.id)===String(id));if(!source)return toast('This meal is no longer in your plan');
 planModal(source.recipe,source.day,null,{source,leftover});
}
function removeShoppingItems(index=null){
 const before=shopping;shopping=index===null?[]:shopping.filter((_,position)=>position!==index);
 if(!saveState()){shopping=before;return false}shoppingView();return true;
}
document.addEventListener('click',event=>{const remove=event.target.closest('[data-remove-shopping]');if(remove){if(removeShoppingItems(Number(remove.dataset.removeShopping)))toast('Item removed');return}if(event.target.closest('[data-clear-shopping]')){if(removeShoppingItems())toast('Shopping list cleared')}});
function shopRow(item,index){const sources=sourceRecipes(item,recipes);return `<div class="shop-row ${item.checked?'checked':''}"><label class="shop-check"><input type="checkbox" data-shop="${index}" aria-label="Mark ${escapeHtml(item.name)} ${item.checked?'not purchased':'purchased'}" ${item.checked?'checked':''}><span class="checkmark" aria-hidden="true">✓</span></label><div class="shop-item"><strong>${item.inventoryMode==='skip'?'':ingredientDot(categories[item.name]||'Other')}${escapeHtml(item.name)}</strong>${item.inventoryMode==='skip'?'<small>Shopping only</small>':''}${item.receivedPurchase?'<small>Already added to inventory</small>':''}${showShoppingSources&&sources.length?`<span class="shopping-sources"><small>For:</small>${sources.map(recipe=>`<button type="button" class="recipe-source" data-preview-recipe="${escapeHtml(recipe.id)}">${escapeHtml(recipe.name)}</button>`).join('')}</span>`:''}</div><div class="shopping-amount"><b>${escapeHtml(quantityLabel(item.qty,item.unit))}</b><button class="text-btn" data-edit-shopping="${index}" aria-label="Edit quantity and unit for ${escapeHtml(item.name)}">Edit</button><button type="button" class="text-btn danger-action" data-remove-shopping="${index}" aria-label="Remove ${escapeHtml(item.name)} from shopping list">Remove</button></div></div>`}
function previewRecipe(id,origin='recipes',planId=null){
 const recipe=recipes.find(r=>r.id===id);if(!recipe)return;
 const planned=plans.find(plan=>String(plan.id)===String(planId));
 let dialog=$('#recipe-peek');if(!dialog){dialog=document.createElement('dialog');dialog.id='recipe-peek';dialog.className='recipe-peek';document.body.append(dialog)}
 dialog.innerHTML=`<div class="peek-heading"><div><p class="eyebrow">FROM YOUR COOKBOOK</p><h2>${escapeHtml(recipe.name)}</h2></div><button class="round-btn" aria-label="Close recipe preview">×</button></div>${recipe.imageUrl?`<img class="peek-cover" src="${escapeHtml(recipe.imageUrl)}" alt="${escapeHtml(recipe.name)}">`:''}<p>${recipe.time} min · ${escapeHtml(recipe.difficulty)} · ${planned?.servings||recipe.servings} servings</p>${recipeTagsMarkup(recipe)}<h3>Ingredients</h3><ul>${recipe.ingredients.map(([name,qty,unit,note])=>`<li><strong>${escapeHtml(name)}</strong> · ${escapeHtml(quantityLabel(qty,unit))}${note?` — ${escapeHtml(note)}`:''}</li>`).join('')}</ul><h3>Method</h3><ol>${recipe.steps.map(step=>`<li>${escapeHtml(step)}</li>`).join('')}</ol><div class="peek-actions" style="display:flex;gap:10px;flex-wrap:wrap">${origin==='planner'&&planned&&!planned.isLeftover?`<button class="primary-btn peek-start" data-start="${escapeHtml(recipe.id)}" data-servings="${planned.servings}" data-cook-plan="${escapeHtml(planned.id)}">Start cooking</button>`:''}<button class="${origin==='planner'&&planned&&!planned.isLeftover?'secondary-btn':'primary-btn'} peek-open">Open full recipe ↗</button></div>`;
 dialog.querySelector('.round-btn').onclick=()=>dialog.close();dialog.querySelector('.peek-open').onclick=()=>{dialog.close();detail(id,origin)};
 if(dialog.querySelector('.peek-start'))dialog.querySelector('.peek-start').onclick=()=>dialog.close();
 dialog.onclick=event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close()}};
 if(!dialog.open)dialog.showModal();
}

function shoppingView(){const active=shopping.filter(item=>!item.checked),done=shopping.filter(item=>item.checked);$('#shopping-view').innerHTML=`<div class="page-head"><div><p class="eyebrow">SMART LIST</p><h1>Shopping list</h1><p>${active.length} items left · food and everyday essentials</p></div><button class="primary-btn" data-action="manual-item">＋ Add item</button></div><div class="shopping-options"><label><input type="checkbox" data-show-sources ${showShoppingSources?'checked':''}> Show recipe labels</label><p class="shopping-guidance">Add checked food items to inventory when you’re ready. Shopping-only items stay on this list.</p></div><div class="shopping-layout"><div class="shopping-card"><div class="shop-progress"><span><b>${done.length}</b> of ${shopping.length} picked up</span><div><i style="width:${shopping.length?done.length/shopping.length*100:0}%"></i></div></div>${[...new Set(active.map(shoppingCategory))].map(category=>`<div class="shop-group"><h3>${escapeHtml(category)}</h3>${shopping.map((item,index)=>!item.checked&&shoppingCategory(item)===category?shopRow(item,index):'').join('')}</div>`).join('')}${done.length?`<div class="shop-group complete"><h3>Completed</h3>${shopping.map((item,index)=>item.checked?shopRow(item,index):'').join('')}</div>`:''}<button class="primary-btn transfer-shopping" data-transfer-shopping ${shopping.some(item=>item.checked&&!item.receivedPurchase&&item.inventoryMode!=='skip')?'':'disabled'}>Add all checked items to inventory</button><div class="shopping-list-actions"><button class="clear-btn danger-action" data-action="clear-completed">Clear completed</button><button type="button" class="clear-btn danger-action" data-clear-shopping ${shopping.length?'':'disabled'}>Clear whole list</button></div></div><aside class="shop-aside often-bought-panel" id="often-bought-panel">${oftenBoughtMarkup()}</aside></div>`}

function substitutionControl(row,context){
 if(!row.alternatives?.length)return row.invalidChoice?'<p class="substitution-choice">Your selected alternative is no longer available. Review this ingredient before cooking.</p>':'';
 return `<div class="substitution-choice"><label>For ${escapeHtml(row.originalName)}<select data-substitution="${escapeHtml(row.choiceKey)}" data-substitution-context="${context}"><option value="">Use ${escapeHtml(row.originalName)} as written</option>${row.alternatives.map(item=>`<option value="${escapeHtml(item.id)}" ${row.substituted&&row.ingredientId===item.id?'selected':''} ${item.available?'':'disabled'}>Use ${escapeHtml(item.name)} instead · ${escapeHtml(quantityLabel(item.qty,item.unit))}${item.reason?` · ${escapeHtml(item.reason)}`:''}</option>`).join('')}</select></label><small>${row.substituted?'Your choice applies to this meal. The recipe stays as written.':'You have an alternative. Choose it to use it for this meal.'}</small></div>`;
}
document.addEventListener('click',event=>{const button=event.target.closest('[data-measurement]');if(!button||!currentRecipe)return;const system=button.dataset.measurement;if(!saveMeasurementPreference(localStorage,activeUserId,system)){toast('Could not remember measurement preference');return}document.querySelectorAll('[data-measurement]').forEach(control=>control.setAttribute('aria-pressed',String(control.dataset.measurement===system)));const servings=Number($('#servings')?.value);$('#ingredient-checks').innerHTML=ingredientRows(currentRecipe,Number.isFinite(servings)&&servings>=1?servings:currentRecipe.servings);});
function ingredientRows(r,s=r.servings){return checks(r,s,detailChoices[r.id]||{}).map((row,index)=>`<div class="ingredient-with-choice"><div class="ingredient-row"><label class="recipe-presence-check"><input type="checkbox" data-recipe-stock="${index}" data-stock-recipe="${escapeHtml(r.id)}" ${hasIngredientStock(row)?'checked':''} aria-label="I have ${escapeHtml(row.name)}"><span class="sr-only">I have ${escapeHtml(row.name)}</span></label><span><strong>${ingredientDot(categories[row.name]||'Other')}${escapeHtml(row.name)}</strong><small>${escapeHtml(row.note||categories[row.name]||'')}</small></span><b>${escapeHtml(measuredLabel(row))}</b><small class="have">${row.quantityUnknown?'In inventory · amount not specified':row.isFlexible?(row.item&&(row.item.qty===null||row.item.qty>0)?'In your inventory · use as you like':'Not in inventory'):!row.compatible&&row.item?'Check inventory unit':row.missing?`Have ${fmt(row.have)} · Missing ${fmt(row.missing)}`:`Have ${fmt(row.have)}`}</small></div>${substitutionControl(row,'detail')}</div>`).join('')}
async function setRecipeIngredientPresence(recipeId,index,present){
 const version=sessionVersion,user=await currentUser();if(version!==sessionVersion||user.id!==activeUserId)throw new Error('Please sign in again.');
 const recipe=recipes.find(recipe=>recipe.id===recipeId)||(currentRecipe?.id===recipeId?currentRecipe:null);if(!recipe)throw new Error('Recipe no longer available.');
 const servings=Number($('#servings')?.value)||recipe.servings,row=checks(recipe,servings,detailChoices[recipeId]||{})[index];if(!row)throw new Error('Ingredient no longer available.');
 const item=ingredientPresenceStock(row,present),saved=await upsertInventory(row.name,item,user.id);if(version!==sessionVersion)return;
 inventory[row.inventoryKey||row.name]=saved;categories[row.name]=saved.category||categories[row.name]||'Other';home();
 if($('#detail-view.active')&&currentRecipe?.id===recipeId)$('#ingredient-checks').innerHTML=ingredientRows(recipe,servings);
}
document.addEventListener('change',async event=>{
 const control=event.target.closest('[data-recipe-stock]');if(!control)return;const version=sessionVersion,previous=!control.checked;control.disabled=true;
 try{await setRecipeIngredientPresence(control.dataset.stockRecipe,Number(control.dataset.recipeStock),control.checked);if(version===sessionVersion)toast(control.checked?'Ingredient marked in stock':'Ingredient marked out of stock')}
 catch(error){if(version===sessionVersion){control.checked=previous;toast(`Could not update stock: ${error.message}`)}}finally{if(control.isConnected)control.disabled=false}
});



async function detail(id,origin='recipes'){
 const version=sessionVersion,request=++detailRequest;let cached=recipes.find(x=>x.id===id),r=cached;
 if(!cached||!ownsRecipe(cached)){
 const byCode=/^[A-Z2-9]{6}$/i.test(id);const {data,error}=await supabase.rpc(byCode?'get_recipe_by_code':'get_visible_recipe',byCode?{p_code:id}:{p_id:id});if(version!==sessionVersion||request!==detailRequest)return;
 if(error||!data){recipes=recipes.filter(recipe=>recipe.id!==id);visitorRecipe=null;currentRecipe=null;$('#detail-view').innerHTML='<div class="panel"><h1>Recipe unavailable</h1><p>This recipe may be private or deleted.</p><button data-view="recipes" class="secondary-btn">My Recipes</button></div>';show('detail');return}
 const [row]=await hydrateCovers([data]);if(version!==sessionVersion||request!==detailRequest)return;r=mapRecipe(row);r.temporary=!savedIds.has(r.id)&&!ownsRecipe(r);visitorRecipe=r;recipes=recipes.filter(recipe=>recipe.id!==r.id);recipes.push(r);
 }else{visitorRecipe=null;const [ratingRow]=await hydrateRecipeRatings([{id:r.id}]);if(version!==sessionVersion||request!==detailRequest)return;if(ratingRow)Object.assign(r,{rating:Number(ratingRow.personal_rating)||0,contributeToCommunity:ratingRow.contribute_to_community===true,communityAverage:ratingRow.community_average==null?null:Number(ratingRow.community_average),communityCount:Number(ratingRow.community_count)||0});}
 if(!r)return;const factors=await loadMeasurementIngredients(r.ingredients.map(row=>row[4]));if(version!==sessionVersion||request!==detailRequest)return;measurementIngredients=factors;detailReturn=origin;currentRecipe=r;$('#detail-view').style.setProperty('--recipe-color',recipeColour(r));$('#detail-view').innerHTML=`<div class="recipe-overview" data-recipe-tone="${recipeColour(r)==='#e5ed66'?'lime':recipeColour(r)==='#f5cce1'?'pink':'lavender'}" style="--recipe-color:${recipeColour(r)}"><button type="button" class="back-btn" data-view="${detailReturn}">← Back to ${detailReturn==='planner'?'meal planner':detailReturn==='discover'?'Discover':detailReturn==='home'?'Home':detailReturn==='tags'?'tag recipes':'recipes'}</button><div class="detail-hero"><div class="detail-photo-frame"><div class="detail-image" style="background:${recipeColour(r)}">${recipeVisual(r)}</div></div><div class="detail-editorial-copy"><p class="recipe-editorial-label">In the kitchen</p>${recipeTagsMarkup(r)}<div class="recipe-title-line"><h1>${escapeHtml(r.name)}</h1></div><div class="detail-shareline recipe-meta-line">${creatorAttribution(r)}<span class="recipe-privacy-badge" title="${r.visibility==='public'?'Public recipe (subject to profile privacy)':'Private recipe — its code cannot be found by others.'}">${icon(r.visibility==='public'?'globe':'lock')}<span>${r.visibility==='public'?'Public':'Private'}</span></span>${r.shareCode?`<button type="button" class="secondary-btn share-code" data-copy-recipe-code="${escapeHtml(r.shareCode)}" aria-label="Copy recipe code ${escapeHtml(r.shareCode)}">${escapeHtml(r.shareCode)} · Copy</button>`:''}</div><p class="recipe-source detail-source">Source: ${recipeSourceMarkup(r.source)}</p><div class="facts"><span><b>${r.time}</b> min total</span>${r.prep?`<span><b>${r.prep}</b> min prep</span>`:''}${r.cook?`<span><b>${r.cook}</b> min ${r.cookTimeType==='baking'?'baking':'cooking'}</span>`:''}<span><b>${escapeHtml(r.difficulty)}</b> difficulty</span><span class="recipe-yield"><b id="recipe-yield-fact">${r.servings}</b> servings</span><span><b id="recipe-rating-fact">${r.rating?`★ ${r.rating}`:'Not rated'}</b> your rating</span>${communityRatingMarkup(r)}</div><div class="detail-actions"><button class="primary-btn" data-start="${r.id}">Start cooking</button><button type="button" class="secondary-btn" data-made-recipe="${escapeHtml(r.id)}" aria-pressed="${!!r.lastCookedAt}">${icon(r.lastCookedAt?'check':'utensils')} ${r.lastCookedAt?'Made it':'Made it?'}</button><button class="secondary-btn" data-plan="${r.id}">＋ Add to meal plan</button><button class="secondary-btn" data-recipe-shopping="${escapeHtml(r.id)}">Add ingredients to shopping list</button>${cookbookAction(r.id,escapeHtml)}${ownsRecipe(r)?`<button class="secondary-btn" data-edit-recipe="${escapeHtml(r.id)}">Edit recipe</button><details class="recipe-options"><summary>Recipe options</summary><div><button type="button" class="text-btn" data-delete-recipe="${escapeHtml(r.id)}">Delete recipe</button></div></details>`:bookmarkMarkup(r)}</div></div></div></div><div class="detail-grid"><section class="panel"><div class="section-heading"><div><h2>Ingredients</h2></div><div class="ingredient-controls"><label class="servings">Servings <input type="number" id="servings" min="1" value="${r.servings}"></label><div class="measurement-toggle" role="group" aria-label="Ingredient measurement system">${['metric','us'].map(system=>`<button type="button" data-measurement="${system}" aria-pressed="${measurementPreference(localStorage,activeUserId)===system}">${system==='us'?'US':'Metric'}</button>`).join('')}</div></div></div><p class="recipe-presence-help">Tick what you have. Changes update your inventory; new stock is marked as amount unknown.</p><div id="ingredient-checks">${ingredientRows(r)}</div></section><section class="panel instructions"><h2>Directions</h2>${r.steps.map((s,i)=>`<div class="instruction"><b>${i+1}</b><p>${escapeHtml(s)}</p></div>`).join('')}</section></div><div class="recipe-feedback-grid" style="${recipeFeedbackColours(r)}"><section class="panel personal-feedback"><h2>Your rating & personal notes</h2><p class="quantity-hint">Only you can see your cooking notes.</p><form id="recipe-feedback-form">${recipeFeedbackFields(r)}<button class="secondary-btn">Save rating & private note</button><p role="status" data-feedback-status></p></form><div class="recipe-note-feed" data-note-recipe="${escapeHtml(r.id)}">${recipeNotesMarkup(r)}</div></section>${recipeCommentsSection(r)}</div>`;show('detail');loadRecipeNotePosts(r.id);loadRecipeComments(r.id)}
function cooking(id,servings,planId){if(planId&&plans.find(p=>String(p.id)===String(planId))?.isLeftover)return detail(id,'planner');if($('#planner-view.active'))detailReturn='planner';currentRecipe=recipes.find(x=>x.id===id)||(visitorRecipe?.id===id?visitorRecipe:null);if(!currentRecipe)return;let selected=$('#detail-view.active #servings')?.value;cookingServings=Number(servings||selected||currentRecipe.servings);if(!Number.isFinite(cookingServings)||cookingServings<1)return toast('Choose at least one serving');cookingChoices={...(planId?plans.find(p=>String(p.id)===String(planId))?.substitutions:detailChoices[id])};cookingLog={recipeId:id,userId:activeUserId,version:sessionVersion,promise:null};cookStep=0;renderCook()}
function moveCookingStep(direction){
 if(!currentRecipe||cookStep>=currentRecipe.steps.length)return;
 const next=Math.max(0,cookStep+direction);if(next===cookStep)return;cookStep=next;renderCook();
}

function renderCook(){let r=currentRecipe;if(cookStep>=r.steps.length){reconcile();scrollTo(0,0);openPostCookFeedback();return}
 const root=$('#cooking-view');
 if(root.classList.contains('active')&&root.dataset.cookingRecipe===String(r.id)&&root.querySelector('.cook-body')){
  const x=scrollX,y=scrollY;
  root.querySelector('.cook-top>span:last-child').textContent=`${cookStep+1} / ${r.steps.length}`;
  root.querySelector('.progress i').style.width=`${(cookStep+1)/r.steps.length*100}%`;
  root.querySelector('.cook-body>section>.eyebrow').textContent=`STEP ${cookStep+1} OF ${r.steps.length}`;
  root.querySelector('.cook-body h1').textContent=r.steps[cookStep];
  root.querySelector('[data-action="prev-step"]').disabled=cookStep===0;
  root.querySelector('[data-action="next-step"]').textContent=cookStep===r.steps.length-1?'Finish cooking':'Next step →';
  scrollTo({left:x,top:y,behavior:'instant'});return;
 }
 root.dataset.cookingRecipe=String(r.id);root.innerHTML=`<div class="cook-top"><button data-action="exit-cook">× Exit</button><span>Cooking mode</span><span>${cookStep+1} / ${r.steps.length}</span></div><div class="cook-body"><aside><div class="cook-art" style="background:${r.bg}">${recipeVisual(r)}</div><p class="eyebrow">INGREDIENTS</p>${checks(r,cookingServings,cookingChoices).map(row=>`<div class="cook-ingredient"><span>○</span><b>${escapeHtml(row.name)}${row.substituted?`<small>instead of ${escapeHtml(row.originalName)}</small>`:''}</b><em>${escapeHtml(quantityLabel(row.need,row.unit))}</em></div>`).join('')}</aside><section><div class="progress"><i style="width:${(cookStep+1)/r.steps.length*100}%"></i></div><p class="eyebrow">STEP ${cookStep+1} OF ${r.steps.length}</p><h1>${escapeHtml(r.steps[cookStep])}</h1><p class="cook-tip">Take your time. Use ← and → on your keyboard to move between steps.</p><div class="cook-nav"><button class="secondary-btn" data-action="prev-step" ${cookStep===0?'disabled':''}>← Previous</button><button class="primary-btn" data-action="next-step">${cookStep===r.steps.length-1?'Finish cooking':'Next step →'}</button></div></section></div>`;show('cooking')}
document.addEventListener('keydown',event=>{
 if(!['ArrowLeft','ArrowRight'].includes(event.key)||event.defaultPrevented||event.repeat||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
 if(!$('#cooking-view.active .cook-body')||document.querySelector('dialog[open],#modal-root .modal-backdrop,.noms-select-menu'))return;
 if(event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="combobox"],[role="slider"]'))return;
 event.preventDefault();moveCookingStep(event.key==='ArrowRight'?1:-1);
});
function reconcile(){
 const r=currentRecipe,rows=checks(r,cookingServings,cookingChoices);
 $('#cooking-view').innerHTML=`<div class="reconcile"><p class="eyebrow">DINNER IS READY</p><h1>Did you finish any ingredients?</h1><p>Keep the suggested amounts, mark what you used up, or stop tracking ingredients you finished.</p><div class="panel reconcile-list">${rows.map((row,index)=>{
  const update=remainingInventory(row);
  if(!row.item||row.invalidChoice)return `<div><strong>${escapeHtml(row.name)}</strong><p>${row.invalidChoice?'Your selected alternative is no longer available. Stock stays unchanged; review this ingredient.':'Not currently tracked. No stock will be changed.'}</p></div>`;
  const current=row.item.qty===null?'Amount not specified':`${row.item.qty} ${row.item.unit}`;
  return `<div data-stock-row="${index}" class="stock-check-row"><div><strong>${escapeHtml(row.name)}</strong><small style="display:block">Current: ${escapeHtml(current)}</small></div><label>After cooking<select data-stock-choice="${index}"><option value="unchanged">Leave unchanged</option><option value="unknown">Still have some — amount unknown</option><option value="empty">Used it up — keep active</option><option value="inactive">Used it up — mark inactive</option><option value="exact" ${update?'selected':''}>Set exact amount</option></select></label><div data-remaining-wrap ${update?'':'hidden'}><label>Amount left<input type="number" min="0" step="any" value="${update?.after??''}" data-remaining="${index}" ${update?'':'disabled'}></label><b>${escapeHtml(row.item.unit)}</b></div></div>`;
 }).join('')}</div><div class="detail-actions"><button class="primary-btn" data-action="confirm-deduction">Save stock updates</button><button class="secondary-btn" data-action="leave-unchanged">Skip check-in</button></div></div>`;
}
async function confirmDeduction(button){
 if(button.disabled)return;
 const version=sessionVersion,userId=activeUserId,rows=checks(currentRecipe,cookingServings,cookingChoices),updates=[];
 try{
  for(const choice of $$('[data-stock-choice]')){
   const row=rows[Number(choice.dataset.stockChoice)];
   if(!row?.item||row.invalidChoice)continue;
   const value=postCookQuantity(choice.value,choice.closest('[data-stock-row]').querySelector('[data-remaining]').value);
   if(value!==undefined)updates.push({key:row.inventoryKey,item:{...row.item,qty:value,stockStatus:null,isActive:choice.value==='inactive'?false:value===0?row.item.isActive!==false:true}});
  }
 }catch(error){return toast(error.message)}
 button.disabled=true;
 try{
  const results=await Promise.allSettled(updates.map(async update=>({key:update.key,item:await upsertInventory(update.key,update.item,userId,{isActive:update.item.isActive!==false})})));
  if(version!==sessionVersion||userId!==activeUserId)return;
  results.forEach(result=>{if(result.status==='fulfilled')inventory[result.value.key]=result.value.item});
  const failed=results.filter(result=>result.status==='rejected');
  if(failed.length){toast('Some updates failed. Saved amounts are kept; review before retrying.');return}
    show('home');toast('Inventory updated');openPostCookFeedback();
 }catch(error){if(version===sessionVersion)toast(`Inventory update failed: ${error.message}`)}finally{button.disabled=false}
}
document.addEventListener('change',event=>{
 if(!event.target.matches('[data-stock-choice]'))return;
 const row=event.target.closest('[data-stock-row]'),input=row.querySelector('[data-remaining]'),exact=event.target.value==='exact';
 row.querySelector('[data-remaining-wrap]').hidden=!exact;input.disabled=!exact;
});
function modal(title,body,action='Save'){$('#modal-root').innerHTML=`<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true"><div class="modal-head"><h2>${title}</h2><button data-action="close-modal">×</button></div><form id="modal-form">${body}<div class="modal-actions"><button type="button" class="secondary-btn" data-action="close-modal">Cancel</button><button class="primary-btn ${/^(Delete|Remove|Clear)/i.test(action)?'danger-action':''}">${action}</button></div></form></div></div>`;const form=document.querySelector('#modal-form'),root=form?.querySelector('.recipe-form');if(!root)return;const official=activeProfile?.profile_type==='official'||activeProfile?.profile_type==='brand',editing=title==='Edit recipe';const notice=document.createElement('p');notice.className='recipe-acting-as';notice.innerHTML=`${editing?'Editing as':'Creating as'} <strong>@${escapeHtml(activeProfile?.username||activeProfile?.display_name||'profile')}</strong> · ${official?'Official':'Personal'}`;root.querySelector('.recipe-basics')?.prepend(notice);if(!editing&&title==='Add recipe'&&official)form.elements['recipe-visibility'].value='public'}
function planModal(id,day='Monday',planId=null,copy=null){
 const existing=planId===null?null:plans.find(p=>String(p.id)===String(planId));
 if(planId!==null&&!existing)return toast('This meal is no longer in your plan');
 const recipe=recipes.find(r=>r.id===(existing?.recipe||id))||(!id&&!existing?recipes[0]:null);if(!recipe)return toast(id||existing?'Recipe no longer available':'Add a recipe first');
 const nextDate=copy?parseDate(copy.source.date):null;if(nextDate)nextDate.setDate(nextDate.getDate()+1);
 const date=existing?.date||(nextDate?dateKey(nextDate):dateForDay(day,plannerMonday)),slot=existing?.slot||copy?.source.slot||'Dinner',leftover=existing?.isLeftover||copy?.leftover||false;
 modal(existing?'Edit planned meal':copy?.leftover?'Plan leftovers':copy?'Duplicate meal':'Plan a meal',`${existing?`<input type="hidden" name="plan-id" value="${escapeHtml(existing.id)}">`:''}<input type="hidden" name="recipe" value="${escapeHtml(recipe.id)}"><div class="selected-plan-recipe" id="selected-plan-recipe">${planRecipePhoto(recipe)}<strong>${escapeHtml(recipe.name)}</strong></div><button type="button" class="text-btn" data-change-plan-recipe>Change recipe</button><div class="form-grid"><label>Date<input type="date" name="date" required value="${date}"></label><label>Meal<select name="slot">${['Breakfast','Brunch','Lunch','Dinner','Snack'].map(value=>`<option ${value===slot?'selected':''}>${value}</option>`).join('')}</select></label></div><label>Servings<input name="servings" type="number" min="1" step="1" required value="${existing?.servings||copy?.source.servings||recipe.servings}"></label><label class="leftover-toggle"><input type="checkbox" name="is-leftover" ${leftover?'checked':''}> This meal is leftovers (already cooked)</label><div id="plan-missing-review"></div>${existing?`<button type="button" class="clear-btn" data-remove-plan="${escapeHtml(existing.id)}">Remove meal</button>`:''}`,existing?'Save changes':'Add to meal plan');
 document.querySelector('.modal').classList.add('plan-modal');$('#modal-form')._leftoverOf=existing?.leftoverOf||(copy?.leftover?copy.source.id:null);$('#modal-form')._substitutions={...(existing?.substitutions||copy?.source.substitutions||detailChoices[recipe.id]||{})};refreshPlanMissing();
}
function refreshPlanMissing(){
 const form=$('#modal-form'),review=$('#plan-missing-review');if(!review)return;
 if(form.elements['is-leftover']?.checked){review.innerHTML='<p class="leftover-note">Already cooked. No ingredients will be added to shopping and no inventory will be deducted for this meal.</p>';return}
 const recipe=recipes.find(r=>r.id===form.elements.recipe.value),servings=Number(form.elements.servings.value);
 if(!recipe||!Number.isInteger(servings)||servings<1){review.textContent='Choose at least one whole serving.';return}
 if(form._reviewRecipe!==recipe.id){if(form._reviewRecipe)form._substitutions={};form._reviewRecipe=recipe.id;form._purchaseOverrides=new Map()}
 const rows=checks(recipe,servings,form._substitutions||{});
 const rowMarkup=(row,index)=>{const key=row.ingredientId||row.name,coverage=cartCoverage(row,shopping),onList=row.isFlexible?shopping.some(item=>cartMatches(row,item)):coverage>0,checked=form._purchaseOverrides.has(key)?form._purchaseOverrides.get(key):needsPurchase(row);return `<div class="purchase-entry"><label class="purchase-row ${onList?'already-shopping':''}"><input type="checkbox" name="missing" value="${index}" data-purchase-key="${escapeHtml(key)}" ${checked?'checked':''}><span><strong>${escapeHtml(row.name)}</strong><small>${row.quantityUnknown?'In inventory · amount not specified':row.isFlexible?`${escapeHtml(quantityLabel(null,row.unit))} · ${needsPurchase(row)?'Not in inventory':'In your inventory'}`:row.missing>0?`Need ${fmt(row.missing)} ${escapeHtml(row.unit)} more`:`Have ${fmt(row.have)} ${escapeHtml(row.unit)} · Need ${fmt(row.need)}`}${row.compatible===false?' · Check inventory unit':''}</small>${onList?`<span class="on-list">On shopping list${row.isFlexible?'':` · ${fmt(coverage)} ${escapeHtml(row.unit)}`}</span>`:''}</span></label>${substitutionControl(row,'plan')}</div>`};
 review.innerHTML=`<div class="purchase-selection-toolbar"><p class="purchase-intro">Missing ingredients start checked. Change any selection in either list.</p><button type="button" class="text-btn" data-toggle-purchases>Select all</button></div><div class="purchase-columns"><section><h3>Missing <span>${rows.filter(needsPurchase).length}</span></h3>${rows.map((row,index)=>needsPurchase(row)?rowMarkup(row,index):'').join('')||'<p>Nothing missing. Lovely.</p>'}</section><section><h3>Already have <span>${rows.filter(row=>!needsPurchase(row)).length}</span></h3>${rows.map((row,index)=>!needsPurchase(row)?rowMarkup(row,index):'').join('')||'<p>No stocked ingredients for this recipe yet.</p>'}</section></div>${form.elements['shopping-only']?'':'<button type="button" class="secondary-btn add-plan-shopping" data-action="add-plan-shopping">Add missing items to shopping list</button>'}<p id="plan-shopping-status" role="status"></p>`;syncPurchaseToggle();
}
function addPlanShopping(){
 const form=$('#modal-form');if(form.elements['is-leftover']?.checked)return;const data=new FormData(form),recipe=recipes.find(r=>r.id===data.get('recipe')),servings=Number(data.get('servings'));
 if(!recipe||!Number.isInteger(servings)||servings<1)return toast('Choose a recipe and at least one whole serving');
 if(!data.getAll('missing').length){$('#plan-shopping-status').textContent='Select an ingredient to add to shopping.';return}
 const before=shopping;shopping=addSelectedIngredients(shopping,checks(recipe,servings,form._substitutions||{}),data.getAll('missing'),recipe,recipes);
 if(!saveState()){shopping=before;return}
 refreshPlanMissing();$('#plan-shopping-status').textContent='Selected items are on your shopping list. Existing amounts were topped up only where needed.';
}
function recipeShoppingModal(id){
 const recipe=recipes.find(recipe=>recipe.id===id);if(!recipe)return;
 const servings=Number($('#detail-view.active #servings')?.value)||recipe.servings;
 modal('Shop for '+recipe.name,`<input type="hidden" name="shopping-only" value="true"><input type="hidden" name="recipe" value="${escapeHtml(id)}"><label>Servings<input name="servings" type="number" min="1" step="1" required value="${servings}"></label><div id="plan-missing-review"></div>`,'Add selected ingredients');
 document.querySelector('.modal').classList.add('plan-modal');$('#modal-form')._substitutions={...(detailChoices[id]||{})};refreshPlanMissing();
}
function saveRecipeShopping(data){
 const recipe=recipes.find(recipe=>recipe.id===data.get('recipe')),servings=Number(data.get('servings'));
 if(!recipe||!Number.isInteger(servings)||servings<1)throw new Error('Choose at least one whole serving.');
 if(!data.getAll('missing').length)throw new Error('Select an ingredient to add.');
 const before=shopping;shopping=addSelectedIngredients(shopping,checks(recipe,servings,plannedSubstitutions()),data.getAll('missing'),recipe,recipes);
 if(!saveState()){shopping=before;throw new Error('Could not save your shopping list.');}
}
function plannedLeftoverSource(){return $('#modal-form')?._leftoverOf||null}
function plannedSubstitutions(){return {...($('#modal-form')?._substitutions||{})}}
function savePlannedMeal(data){
 const recipe=recipes.find(r=>r.id===data.get('recipe')),servings=Number(data.get('servings'));
 const date=data.get('date')||dateForDay(data.get('day'),plannerMonday),parsed=parseDate(date),day=weekdays[(parsed.getDay()+6)%7],slot=data.get('slot'),planId=data.get('plan-id');
 if(!recipe||!Number.isInteger(servings)||servings<1)throw new Error('Choose a recipe and at least one whole serving.');
 if(!['Breakfast','Brunch','Lunch','Dinner','Snack'].includes(slot))throw new Error('Choose a valid meal.');
 const index=planId===null?-1:plans.findIndex(p=>String(p.id)===planId);if(planId!==null&&index<0)throw new Error('This meal is no longer in your plan.');
 const oldPlans=plans,oldShopping=shopping;plans=plans.map(p=>({...p}));
 const substitutions=plannedSubstitutions();
 const isLeftover=data.get('is-leftover')!==null;
 const meal={substitutions,isLeftover,leftoverOf:isLeftover?plannedLeftoverSource():null,id:index<0?crypto.randomUUID():plans[index].id,date,day,slot,servings,recipe:recipe.id};
 if(index<0)plans.push(meal);else{const previous=plans[index].recipe;plans[index]=meal;if(previous!==recipe.id&&!plans.some(p=>p.recipe===previous))shopping=detachRecipeSources(shopping,previous,recipes)}
 if(!isLeftover)shopping=addSelectedIngredients(shopping,checks(recipe,servings,substitutions),data.getAll('missing'),recipe,recipes);
 if(!saveState()){plans=oldPlans;shopping=oldShopping;throw new Error('Meal changes could not be saved. Try again.');}
}
function removePlannedMeal(id){
 const before=plans,previousShopping=shopping,removed=plans.find(p=>String(p.id)===String(id));plans=plans.filter(p=>String(p.id)!==String(id));
 if(removed&&!plans.some(p=>p.recipe===removed.recipe))shopping=detachRecipeSources(shopping,removed.recipe,recipes);
 if(!saveState()){plans=before;shopping=previousShopping;throw new Error('Meal could not be removed. Try again.');}
}

const recipeUnits=[...units,'as needed','to taste'];
// Keep save failures in the editor so the draft and corrective action stay visible.
function showRecipeSaveError(form,error){
 let status=form.querySelector('[data-recipe-save-error]');
 if(!status){status=document.createElement('p');status.dataset.recipeSaveError='';status.className='recipe-save-error';status.setAttribute('role','alert');form.querySelector('.modal-actions').before(status)}
 status.textContent=error.message;
 if(error.field){error.field.setAttribute('aria-invalid','true');error.field.focus();error.field.scrollIntoView({block:'center'})}
 else status.scrollIntoView({block:'nearest'});
}
async function prepareImportedIngredients(form){
 if(!form.dataset.importedRecipe)return;
 if(Number(form.elements.servings.value)<1)return validateRecipeEditor(form);
 const version=sessionVersion,userId=activeUserId,unmatched=[];
 for(const row of form.querySelectorAll('.recipe-ingredient-input')){
  const picker=row.querySelector('.ingredient-picker'),name=picker.querySelector('input').value.trim();if(!name)continue;
  try{selectedIngredient(picker)}catch{unmatched.push({row,picker,name})}
 }
 form.querySelector('[data-import-resolve]')?.remove();
 if(!unmatched.length)return;
 const approval=JSON.stringify(unmatched.map(item=>item.name));
 if(form._approveNewIngredients!==approval){
  const panel=document.createElement('div');panel.dataset.importResolve='';panel.className='import-review-note';
  const message=document.createElement('p');message.textContent=`${unmatched.length} ingredient${unmatched.length===1?' needs':'s need'} a catalogue match. Select existing matches above, or add these names to your personal ingredient catalogue and save:`;
  const names=document.createElement('p');names.textContent=unmatched.map(item=>item.name).join(' · ');
  const confirm=document.createElement('button');confirm.type='button';confirm.className='secondary-btn';confirm.dataset.confirmImportedIngredients='';confirm.dataset.approvedIngredients=approval;confirm.textContent='Add missing ingredients & save recipe';
  panel.append(message,names,confirm);form.querySelector('.modal-actions').before(panel);
  const error=new Error('Review the unmatched ingredient names below, then choose “Add missing ingredients & save recipe”, or select existing catalogue matches.');throw error;
 }
 form._approveNewIngredients=false;
 // Creation is explicit and uses the catalogue's exact-name reuse logic. A
 // retry reuses previously added entries rather than creating duplicates.
 for(const {row,picker,name} of unmatched){
  if(version!==sessionVersion||activeUserId!==userId||!form.isConnected)throw new Error('Please sign in again.');
  const unitInput=row.querySelector('[name="ingredient-unit"]'),quantity=row.querySelector('[name="ingredient-quantity"]'),unit=unitInput.value,amount=quantity.value;
  const ingredient=await saveCatalogueIngredient({name,category:'Other',unit:units.includes(unit)?unit:'piece'});
  if(version!==sessionVersion||activeUserId!==userId||!form.isConnected)return;
  presetIngredient(picker,ingredient);unitInput.value=unit;quantity.value=amount;quantity.disabled=['as needed','to taste'].includes(unit);
 }
}
document.addEventListener('click',event=>{
 if(!event.target.closest('[data-confirm-imported-ingredients]'))return;
 const form=event.target.closest('form');if(form.querySelector('.modal-actions .primary-btn').disabled)return;
 form._approveNewIngredients=event.target.closest('[data-confirm-imported-ingredients]').dataset.approvedIngredients;form.requestSubmit(form.querySelector('.modal-actions .primary-btn'));
});
function validateRecipeEditor(form,{allowUnmatched=false}={}){
 form.querySelector('[data-recipe-save-error]')?.remove();
 form.querySelectorAll('[aria-invalid="true"]').forEach(input=>input.removeAttribute('aria-invalid'));
 const problems=[],fields=[];
 const problem=(message,field)=>{problems.push(message);fields.push(field);field?.setAttribute('aria-invalid','true')};
 const elements=form.elements;
 if(!elements['recipe-name'].value.trim())problem('Enter a recipe name.',elements['recipe-name']);
 if(!Number.isFinite(Number(elements.servings.value))||Number(elements.servings.value)<1)problem('Choose the number of servings using + or −.',form.querySelector('[data-servings="+"]'));
 if(!elements['total-time'].value.trim()||!Number.isFinite(Number(elements['total-time'].value))||Number(elements['total-time'].value)<0)problem('Enter the total time in minutes.',elements['total-time']);
 for(const name of ['prep','cook'])if(elements[name].value!==''&&(!Number.isFinite(Number(elements[name].value))||Number(elements[name].value)<0))problem('Prep and cook times must be zero or positive.',elements[name]);
 const seen=new Set();let ingredientCount=0;
 for(const [index,row] of [...form.querySelectorAll('.recipe-ingredient-input')].entries()){
  const picker=row.querySelector('.ingredient-picker'),input=picker.querySelector('input'),quantity=row.querySelector('[name="ingredient-quantity"]'),unit=row.querySelector('[name="ingredient-unit"]');
  if(!input.value.trim()&&!quantity.value.trim()&&!row.querySelector('[name="ingredient-note"]').value.trim())continue;
  ingredientCount++;
  if(!input.value.trim())problem(`Ingredient ${index+1}: enter an ingredient name.`,input);
  else{
   let selected;try{selected=selectedIngredient(picker)}catch{if(!allowUnmatched)problem(`Ingredient ${index+1} (“${input.value.trim()}”): Choose an ingredient from the catalogue suggestions.`,input)}
   if(allowUnmatched&&input.value.trim().length>100)problem(`Ingredient ${index+1}: shorten the ingredient name to 100 characters; keep preparation details in its note.`,input);
   const key=selected?.canonical_name.trim().toLowerCase()||input.value.trim().toLowerCase();
   if(seen.has(key))problem(`Ingredient ${index+1} (“${input.value.trim()}”) appears more than once. Combine duplicate rows.`,input);seen.add(key);
  }
  try{parseRecipeQuantity(quantity.value,unit.value)}catch{problem(`Ingredient ${index+1}: enter a positive quantity or leave it blank for As needed.`,quantity)}
 }
 if(!ingredientCount)problem('Add at least one ingredient.',form.querySelector('.ingredient-picker>input'));
 if(![...form.querySelectorAll('[name="recipe-step"]')].some(input=>input.value.trim()))problem('Add at least one instruction step.',form.querySelector('[name="recipe-step"]'));
 if(problems.length){const error=new Error('Please complete the required recipe details:\n'+problems.map(message=>'• '+message).join('\n'));error.field=fields.find(Boolean);throw error}
}
document.addEventListener('invalid',event=>{
 const form=event.target.closest('#modal-form');if(!form?.querySelector('[name="recipe-name"]'))return;
 const label=event.target.name==='total-time'?'Total time':event.target.name==='recipe-name'?'Recipe name':event.target.getAttribute('aria-label')||'This field';
 showRecipeSaveError(form,new Error(`${label}: ${event.target.validationMessage}`));
},true);
function ingredientInputRow(){return `<div class="recipe-ingredient-input">${ingredientPicker("ingredient-name",false)}<input name="ingredient-quantity" type="text" inputmode="decimal" placeholder="Optional qty" aria-label="Quantity (optional)"><select name="ingredient-unit">${recipeUnits.map(x=>`<option>${x}</option>`).join('')}</select><input name="ingredient-note" placeholder="Optional note"><button type="button" class="row-remove" data-action="remove-recipe-row" aria-label="Remove ingredient">×</button></div>`}
function instructionInputRow(){return `<div class="recipe-step-input"><b></b><textarea name="recipe-step" rows="2" required placeholder="Describe this step…"></textarea><button type="button" class="row-remove" data-action="remove-recipe-row" aria-label="Remove step">×</button></div>`}
async function recipeModal(editId=null,draft=null){const version=sessionVersion,draftForm=draft?$('#modal-form'):null;let result;try{result=await supabase.from('recipe_tags').select('name,category').order('name').limit(500)}catch(error){result={error}};if(version!==sessionVersion||(draft&&!draftForm?.isConnected))return;const catalogue=result.error?[]:result.data||[];let existing=editId?recipes.find(r=>r.id===editId):null;if(editId&&(!existing||!ownsRecipe(existing)))return toast('Recipe not found or access denied');let suggestions=[...new Set([...catalogue.map(tag=>tag.name),...recipes.flatMap(r=>[r.cuisine,...r.tags]).filter(Boolean)])].sort();modal(existing?'Edit recipe':draft?'Review imported recipe':'Add recipe',`<div class="recipe-form"><section class="recipe-basics"><label class="cover-upload"><input name="cover" type="file" accept="image/jpeg,image/png,image/webp"><span class="cover-preview"><b>＋</b><strong>Add cover photo</strong><small>Optional · JPG, PNG or WebP</small></span></label><label class="recipe-name-label">Recipe name<input name="recipe-name" required autofocus placeholder="Recipe name"></label><label>Visibility<select name="recipe-visibility"><option value="private">Private — Only you can see this recipe.</option><option value="public">Public — Others can discover and view this recipe, subject to your profile privacy settings.</option></select></label><div class="field-label">Tags <span>Press Enter or comma to add</span></div><div class="tag-editor" data-tag-editor><div class="tag-chips"></div><input data-tag-input placeholder="Korean, Japanese, Fusion…" list="recipe-tag-suggestions"></div><input type="hidden" name="recipe-tags"><datalist id="recipe-tag-suggestions">${suggestions.map(x=>`<option value="${escapeHtml(x)}">`).join('')}</datalist><div class="tag-catalogue">${result.error?'<p>Selectable tags need database update 013_recipe_tag_catalogue.sql. You can still type your own tags.</p>':[...new Set(catalogue.map(tag=>tag.category))].map(category=>`<div><p>${escapeHtml(category)}</p><div class="tag-options">${catalogue.filter(tag=>tag.category===category).map(tag=>`<button type="button" data-tag-option="${escapeHtml(tag.name)}">＋ ${escapeHtml(tag.name)}</button>`).join('')}</div></div>`).join('')}</div></section><section><p class="form-section-title">Time & details</p><div class="details-grid"><fieldset><legend>Difficulty</legend><div class="choice-chips">${['Easy','Medium','Hard'].map((x,i)=>`<label><input type="radio" name="difficulty" value="${x}" ${i?'':'checked'}><span>${x}</span></label>`).join('')}</div></fieldset><fieldset><legend>Servings</legend><div class="servings-stepper"><button type="button" data-servings="-" aria-label="Decrease servings">−</button><output>2</output><input name="servings" type="hidden" value="2"><button type="button" data-servings="+" aria-label="Increase servings">＋</button></div></fieldset></div><div class="time-grid"><label class="total-time">Total time<span class="time-input"><input name="total-time" aria-label="Total time in minutes" type="number" min="0" required placeholder="35"><span class="time-unit" aria-hidden="true">min</span></span></label><div class="optional-times"><span>Optional breakdown</span><label>Prep<span class="time-input"><input name="prep" aria-label="Prep time in minutes" type="number" min="0" placeholder="10"><span class="time-unit" aria-hidden="true">min</span></span></label><label><select name="cook-time-type" aria-label="Cooking or baking time"><option value="cooking">Cooking time</option><option value="baking">Baking time</option></select><span class="time-input"><input name="cook" aria-label="Cooking or baking time in minutes" type="number" min="0" placeholder="25"><span class="time-unit" aria-hidden="true">min</span></span></label></div></div><p class="time-suggestion" aria-live="polite"></p></section><section><p class="form-section-title">Ingredients</p><p class="quantity-hint">Leave quantity blank for As needed, or choose To taste from the measurement menu.</p><div id="recipe-ingredient-inputs">${ingredientInputRow()}${ingredientInputRow()}</div><button type="button" class="add-row-btn" data-action="add-recipe-ingredient">＋ Add ingredient</button></section><section><p class="form-section-title">Instructions</p><div id="recipe-step-inputs">${instructionInputRow()}${instructionInputRow()}</div><button type="button" class="add-row-btn" data-action="add-recipe-step">＋ Add step</button></section><section><p class="form-section-title">Source</p><label>Source <span class="optional">Optional</span><input name="source" placeholder="Recipe website, TikTok, Instagram, cookbook, etc."></label></section></div>`,'Save recipe');document.querySelector('.modal')?.classList.add('recipe-modal');if(existing)populateRecipeEditor(existing);else if(draft)populateRecipeEditor(draft,true);initCoverEditor($('#modal-form'),existing||draft||{})}
function populateRecipeEditor(recipe,draft=false){
 const form=$('#modal-form');
 const id=document.createElement('input');id.type='hidden';id.name='edit-recipe-id';id.value=recipe.id;if(!draft)form.append(id);
 for(const [name,value] of Object.entries({'recipe-visibility':recipe.visibility||'private','recipe-name':recipe.name,'total-time':recipe.time??'',prep:recipe.prep||'',cook:recipe.cook||'','cook-time-type':recipe.cookTimeType||'cooking',source:recipe.source,servings:recipe.servings}))form.elements[name].value=value;
 form.elements['total-time'].dataset.manual='true';
 form.querySelector('.servings-stepper output').textContent=recipe.servings;
 const difficulty=[...form.querySelectorAll('[name="difficulty"]')].find(input=>input.value===recipe.difficulty);if(difficulty)difficulty.checked=true;
 recipe.tags.forEach(tag=>addRecipeTag(tag,false));
 const ingredients=$('#recipe-ingredient-inputs');ingredients.innerHTML=recipe.ingredients.map(()=>ingredientInputRow()).join('');
 [...ingredients.children].forEach((row,i)=>{
  const [name,quantity,unit,note,ingredientId]=recipe.ingredients[i];
  if(ingredientId)presetIngredient(row.querySelector('.ingredient-picker'),{id:ingredientId,canonical_name:name,default_unit:unit});
  else{row.querySelector('.ingredient-picker>input').value=name;row.querySelector('[role="status"]').textContent='Choose a catalogue match before saving.'}
  const unitSelect=row.querySelector('[name="ingredient-unit"]');if(![...unitSelect.options].some(option=>option.value===unit))unitSelect.add(new Option(unit,unit));unitSelect.value=unit;
  row.querySelector('[name="ingredient-quantity"]').value=quantity??'';row.querySelector('[name="ingredient-quantity"]').disabled=['as needed','to taste'].includes(unit);
  row.querySelector('[name="ingredient-note"]').value=note||'';
 });
 const steps=$('#recipe-step-inputs');steps.innerHTML=recipe.steps.map(()=>instructionInputRow()).join('');
 [...steps.querySelectorAll('textarea')].forEach((input,i)=>input.value=recipe.steps[i]);
 if(recipe.imageUrl){const preview=form.querySelector('.cover-preview');preview.style.backgroundImage=`url(${JSON.stringify(recipe.imageUrl)})`;preview.classList.add('has-image');preview.querySelector('strong').textContent='Change cover photo'}
 if(draft){form.dataset.importedRecipe='true';const note=document.createElement('p');note.className='import-review-note';note.textContent='Review every field and confirm each ingredient match. Original ingredient lines are kept in the notes. Nothing is saved until you choose Save recipe. Imported recipes start private.'+(recipe.servings?'':` Source yield: ${recipe.yieldText||'not supplied'}. Choose the number of servings.`);form.prepend(note);if(!recipe.servings){form.elements.servings.value='';form.querySelector('.servings-stepper output').textContent='?'}}
 form.elements['recipe-name'].focus();
}

function show(v,preserveRoute=false){$('#recipe-view-controls').hidden=libraryTab==='cookbooks';$('#recipe-page-navigation').hidden=v!=='recipes';for(const link of $$('[data-recipe-page]')){if(link.dataset.recipePage===libraryTab)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current')}$('#meal-plan-navigation').hidden=!['planner','shopping'].includes(v);for(const link of $$('[data-meal-page]')){if(link.dataset.mealPage===v)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current')}if(v!=='detail'){detailRequest++;if(!preserveRoute){const route={home:'#/home',discover:'#/discover',recipes:'#/recipes/'+libraryTab,planner:'#/meal-plan/weekly',shopping:'#/meal-plan/shopping',inventory:'#/inventory',profile:'#/profile',catalogue:'#/inventory/catalogue',tags:'#/tags/'+encodeURIComponent(typeof activeRecipeTag==='string'?activeRecipeTag:'')}[v]||'';if(location.hash!==route)history.pushState(null,'',location.pathname+location.search+route)}}$$('.view').forEach(x=>x.classList.remove('active'));$('#'+v+'-view').classList.add('active');$$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===(v==='shopping'?'planner':v==='tags'?'recipes':v)));scrollTo(0,0);if(v==='home')home();if(v==='discover')discoverView();if(v==='tags')tagRecipesView();if(v==='recipes'){recipesView();const version=sessionVersion;refreshLibrary().then(()=>{if(version===sessionVersion&&libraryTab!=='cookbooks'&&$('#recipes-view.active'))recipesView()}).catch(error=>{if(version===sessionVersion)toast(error.message)})}if(v==='inventory')inventoryView();if(v==='catalogue')catalogueView();if(v==='planner')plannerView();if(v==='shopping')shoppingView();if(v==='profile'){window.miseOwnedRecipes=createdRecipes();window.miseProfileStats={recipes:createdRecipes().length,ingredients:Object.keys(inventory).length};window.dispatchEvent(new CustomEvent('mise-profile-open'))}}
function toast(t){let e=$('#toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1800)}
function addShop(name,qty,unit,sources=[]){let x=shopping.find(i=>i.name===name&&!i.checked&&i.inventoryMode!=='skip'&&!i.receivedPurchase&&!i.pendingPurchase&&i.unit===unit);if(x){x.qty=x.qty===null||qty===null?null:x.qty+qty;x.sources=[...new Set([...x.sources,...sources])]}else shopping.push({name,qty,unit,checked:false,sources})}
document.addEventListener('click',async e=>{if(e.composedPath().some(node=>node.matches?.('.recipe-card-actions')))return;let peek=e.target.closest('[data-preview-recipe]');if(peek)return previewRecipe(peek.dataset.previewRecipe);let nav=e.target.closest('[data-view]');if(nav){e.preventDefault();if(nav.dataset.recipePage){libraryTab=nav.dataset.recipePage;if(libraryTab==='cookbooks')cookbooks.route('')}return show(nav.dataset.view)}let rc=e.target.closest('[data-recipe]');if(rc&&!rc.dataset.discoverRecipe&&!e.target.closest('button,details,[data-visit-recipe],[data-browse-tag]')){const planCard=rc.closest('#planner-view [data-plan-card]');return planCard?previewRecipe(rc.dataset.recipe,'planner',planCard.dataset.planCard):rc.closest('#planner-view')?previewRecipe(rc.dataset.recipe,'planner'):rc.closest('#tags-view')?detail(rc.dataset.recipe,'tags'):detail(rc.dataset.recipe)}let openRecipe=e.target.closest('[data-open-recipe]');if(openRecipe)return openRecipe.closest('#planner-view')?previewRecipe(openRecipe.dataset.openRecipe,'planner'):detail(openRecipe.dataset.openRecipe,recipeOpenOrigin(openRecipe));let start=e.target.closest('[data-start]');if(start)return cooking(start.dataset.start,start.dataset.servings,start.dataset.cookPlan);let recipeEdit=e.target.closest('[data-edit-recipe]');if(recipeEdit)return recipeModal(recipeEdit.dataset.editRecipe);let recipeDelete=e.target.closest('[data-delete-recipe]');if(recipeDelete){const recipe=recipes.find(r=>r.id===recipeDelete.dataset.deleteRecipe);if(!recipe)return;modal('Delete recipe?',`<p>Delete <strong>${escapeHtml(recipe.name)}</strong> and remove it from your meal plan? This cannot be undone. Your inventory and shopping quantities stay as they are.</p><input type="hidden" name="delete-recipe-id" value="${escapeHtml(recipe.id)}">`,'Delete recipe');return}let week=e.target.closest('[data-week]');if(week){plannerMonday=week.dataset.week==='today'?dateKey(currentWeek()[0]):shiftWeek(plannerMonday,Number(week.dataset.week));return plannerView()}let edit=e.target.closest('[data-edit-plan]');if(edit)return planModal(null,'Monday',edit.dataset.editPlan);let remove=e.target.closest('[data-remove-plan]');if(remove){modal('Remove planned meal?',`<p>This removes the meal from your weekly plan. Your shopping quantities stay as they are. Recipe labels clear when this is its last planned meal.</p><input type="hidden" name="remove-plan-id" value="${escapeHtml(remove.dataset.removePlan)}">`,'Remove meal');return}let plan=e.target.closest('[data-plan]');if(plan)return planModal(plan.dataset.plan);let q=e.target.closest('[data-qty]');if(q){let name=q.dataset.name,x=inventory[name],before=x.qty,d=['g','ml'].includes(x.unit)?50:1;x.qty=Math.max(0,x.qty+(q.dataset.qty==='+'?d:-d));inventoryView();home();try{inventory[name]=await upsertInventory(name,x);toast('Inventory updated')}catch(error){x.qty=before;inventoryView();home();toast(`Inventory update failed: ${error.message}`)}return}let day=e.target.closest('[data-day]');if(day)return recipes.length?openPlannerGallery({date:dateForDay(day.dataset.day,plannerMonday)}):toast('Add a recipe first');let a=e.target.closest('[data-action]')?.dataset.action;if(a==='add-plan-shopping')return addPlanShopping();if(a==='cook-now'){show('recipes');setTimeout(()=>document.querySelector('[data-filter="ready"]')?.click(),0)}if(a==='add-low'){Object.entries(inventory).filter(([,v])=>v.isActive!==false&&['low','out'].includes(stockStatus(v))).forEach(([n,v])=>addShop(n,v.qty===null?null:Math.max(v.threshold-v.qty,['g','ml'].includes(v.unit)?100:1),v.unit));saveState();toast('Low-stock items added')}if(a==='plan-meal'){if(recipes.length)openPlannerGallery();else toast('Add a recipe first')}if(a==='manual-item')shoppingEntryModal();if(a==='add-inventory')addInventoryModal();if(a==='add-recipe')recipeModal();if(a==='clear-completed'){shopping=shopping.filter(x=>!x.checked);saveState();shoppingView();toast('Completed items cleared')}if(a==='close-modal')closeModal();if(a==='next-step')moveCookingStep(1);if(a==='prev-step')moveCookingStep(-1);if(a==='exit-cook')detail(currentRecipe.id,detailReturn);if(a==='confirm-deduction')await confirmDeduction(e.target.closest('button'));if(a==='leave-unchanged')show('home')});
document.addEventListener('change',e=>{if(e.target.matches('[data-show-sources]')){showShoppingSources=e.target.checked;try{if(activeUserId)localStorage.setItem('mise-meal-sources-'+activeUserId,String(showShoppingSources))}catch(error){console.warn(error)}shoppingView();return}if(e.target.matches('[data-purchase-key]')){const form=$('#modal-form');form._purchaseOverrides.set(e.target.dataset.purchaseKey,e.target.checked);syncPurchaseToggle()}if(e.target.matches('[data-shop]')){handleShoppingCheck(Number(e.target.dataset.shop),e.target)}if(e.target.id==='servings'&&Number.isFinite(+e.target.value)&&+e.target.value>=1)$('#ingredient-checks').innerHTML=ingredientRows(currentRecipe,+e.target.value)});

function syncRecipeTags(){$$('[data-tag-option]').forEach(button=>button.setAttribute('aria-pressed',String($$('.tag-chip').some(chip=>chip.dataset.tag.toLowerCase()===button.dataset.tagOption.toLowerCase()))));let hidden=document.querySelector('[name="recipe-tags"]');if(hidden)hidden.value=$$('.tag-chip').map(x=>x.dataset.tag).join('|')}
async function addRecipeTagToCatalogue(name){
 try{
  const normalized=name.trim().replace(/\s+/g,' '),pattern=normalized.replace(/[\\%_]/g,'\\$&');
  const {data,error}=await supabase.from('recipe_tags').select('name').ilike('name',pattern).limit(1);
  if(error){toast(`Could not check the tag catalogue: ${error.message}`);return}
  if(data?.length)return;
  const {error:insertError}=await supabase.from('recipe_tags').insert({name:normalized,category:'Other'});
  if(insertError){if(insertError.code!=='23505')toast(insertError.code==='42501'?'Custom tags need database update 014_contribute_recipe_tags.sql.':`Could not add tag to catalogue: ${insertError.message}`);return}
  const catalogue=$('.tag-catalogue');if(!catalogue)return;
  let section=[...catalogue.querySelectorAll(':scope > div')].find(item=>item.querySelector('p')?.textContent==='Other');
  if(!section){section=document.createElement('div');const heading=document.createElement('p'),options=document.createElement('div');heading.textContent='Other';options.className='tag-options';section.append(heading,options);catalogue.append(section)}
  const options=section.querySelector('.tag-options'),button=document.createElement('button');button.type='button';button.dataset.tagOption=normalized;button.textContent=`＋ ${normalized}`;options.append(button);
 }catch(error){toast(`Could not add tag to catalogue: ${error.message}`)}
}
function addRecipeTag(value,contribute=true){let tag=value.trim().replace(/\s+/g,' ').replace(/^,+|,+$/g,'').trim();if(!tag||$$('.tag-chip').some(x=>x.dataset.tag.toLowerCase()===tag.toLowerCase()))return;if(tag.length>80)return toast('Tags must be 80 characters or fewer.');let inCatalogue=$$('[data-tag-option]').some(button=>button.dataset.tagOption.toLowerCase()===tag.toLowerCase());let chip=document.createElement('span');chip.className='tag-chip';chip.dataset.tag=tag;chip.innerHTML=`${escapeHtml(tag)}<button type="button" aria-label="Remove ${escapeHtml(tag)}">×</button>`;document.querySelector('.tag-chips')?.append(chip);syncRecipeTags();if(contribute&&!inCatalogue)addRecipeTagToCatalogue(tag)}
document.addEventListener('keydown',e=>{if(!e.target.matches('[data-tag-input]')||(!['Enter',','].includes(e.key)))return;e.preventDefault();addRecipeTag(e.target.value);e.target.value=''})
document.addEventListener('blur',e=>{if(e.target.matches('[data-tag-input]')&&e.target.value.trim()){addRecipeTag(e.target.value);e.target.value=''}},true)
document.addEventListener('change',event=>{if(event.target.name==='cook-time-type')document.querySelector('#modal-form [name="cook"]')?.dispatchEvent(new Event('input',{bubbles:true}))});
document.addEventListener('input',e=>{if(e.target.matches('[name="prep"],[name="cook"]')){let prep=document.querySelector('[name="prep"]'),cook=document.querySelector('[name="cook"]'),total=document.querySelector('[name="total-time"]'),note=document.querySelector('.time-suggestion');if(prep?.value!==''&&cook?.value!==''){let sum=+prep.value + +cook.value;note.textContent=`Prep + ${document.querySelector('[name="cook-time-type"]')?.value==='baking'?'baking':'cooking'} = ${sum} min`;if(!total.dataset.manual)total.value=sum}}if(e.target.matches('[name="total-time"]')&&e.isTrusted)e.target.dataset.manual='true'})

document.addEventListener('click',e=>{let tagRemove=e.target.closest('.tag-chip button');if(tagRemove){tagRemove.parentElement.remove();syncRecipeTags();return}let servings=e.target.closest('.servings-stepper [data-servings]');if(servings){let input=document.querySelector('[name="servings"]'),output=document.querySelector('.servings-stepper output'),next=Math.max(1,+input.value+(servings.dataset.servings==='+'?1:-1));input.value=next;output.textContent=next;return}let action=e.target.closest('[data-action]')?.dataset.action;if(action==='add-recipe-ingredient')document.querySelector('#recipe-ingredient-inputs')?.insertAdjacentHTML('beforeend',ingredientInputRow());if(action==='add-recipe-step')document.querySelector('#recipe-step-inputs')?.insertAdjacentHTML('beforeend',instructionInputRow());if(action==='remove-recipe-row'){let row=e.target.closest('.recipe-ingredient-input,.recipe-step-input'),container=row?.parentElement;if(container?.children.length>1)row.remove();else row.querySelectorAll('input,textarea').forEach(x=>x.value='')}})
document.addEventListener('submit',async e=>{if(e.target.id!=='modal-form')return;e.preventDefault();let submitVersion=sessionVersion,form=e.target,button=form.querySelector('.primary-btn'),d=new FormData(form),view=null,message='Saved';button.disabled=true;try{if(d.has('edit-shopping-id')){saveShoppingEdit(d);view='shopping';message='Shopping item updated'}else if(d.has('receive-shopping-id')){await submitShoppingReceipt(d);view='shopping';message='Purchase added to inventory';setTimeout(transferCheckedItems,0)}else if(d.has('edit-inventory-id')){await saveInventoryEdit(d);view='inventory';message='Inventory updated'}else if(d.has('delete-recipe-id')){await deleteRecipe(d.get('delete-recipe-id'));if(form.isConnected)$('#modal-root').innerHTML='';return}if(d.has('remove-plan-id')){removePlannedMeal(d.get('remove-plan-id'));view='planner';message='Meal removed'}else if(d.has('shopping-entry')){saveShoppingEntry(d);message='Item added to shopping list';view='shopping'}else if(d.has('independent-shopping')){saveIndependentShopping(d);message='Ingredient added to shopping list';view=document.querySelector('#shopping-view.active')?'shopping':null}else if(d.has('recipe')){message=savePlannedMeal(d);view='planner'}else if(d.has('item')){addShop(d.get('item').trim(),+d.get('qty'),d.get('unit'));view='shopping';message='Shopping item saved'}else if(d.has('ingredient')){let ingredient=selectedIngredient(form.querySelector('.ingredient-picker')),n=ingredient.canonical_name,item={ingredientId:ingredient.id,...stockDraft(d,{quantity:'qty',unit:'unit',threshold:'threshold'}),location:d.get('location')};categories[n]=ingredient.category||'Other';inventory[n]=await upsertInventory(n,item);inventoryFilters.tracking='active';inventoryFilters.status='all';view='inventory';message='Ingredient saved'}else if(d.has('recipe-name')){validateRecipeEditor(form,{allowUnmatched:!!form.dataset.importedRecipe});await prepareImportedIngredients(form);if(submitVersion!==sessionVersion||!form.isConnected)return;validateRecipeEditor(form);const coverFile=await prepareCoverUpload(form);if(submitVersion!==sessionVersion||!form.isConnected)return;let version=sessionVersion,existing=d.has('edit-recipe-id')?recipes.find(r=>r.id===d.get('edit-recipe-id')):null;if(d.has('edit-recipe-id')&&!existing)throw new Error('Recipe no longer exists.');let quantities=[...form.querySelectorAll('[name="ingredient-quantity"]')].map(input=>input.value),units=d.getAll('ingredient-unit'),notes=d.getAll('ingredient-note'),ingredients=[...form.querySelectorAll('.recipe-ingredient-input')].map((row,i)=>{if(!row.querySelector('.ingredient-picker>input').value.trim()&&!quantities[i].trim()&&!notes[i].trim())return null;let ingredient=selectedIngredient(row.querySelector('.ingredient-picker'));return[ingredient.canonical_name,parseRecipeQuantity(quantities[i],units[i]),units[i],notes[i].trim(),ingredient.id]}).filter(Boolean),steps=d.getAll('recipe-step').map(x=>x.trim()).filter(Boolean),tags=(d.get('recipe-tags')||'').split('|').filter(Boolean);if(!ingredients.length||!steps.length)throw new Error('Add at least one ingredient and instruction step');if(new Set(ingredients.map(x=>x[4])).size!==ingredients.length)throw new Error('Each ingredient can appear once per recipe. Combine duplicate rows.');if(!Number.isFinite(+d.get('servings'))||+d.get('servings')<1)throw new Error('Choose the recipe servings before saving.');let prep=d.get('prep')===''?null:+d.get('prep'),cook=d.get('cook')===''?null:+d.get('cook'),record={imageFraming:readCoverFraming(form),visibility:d.get('recipe-visibility')||'private',imagePath:existing?.imagePath,name:d.get('recipe-name').trim(),cuisine:tags[0]||'Other',tags,prep,cook,cookTimeType:d.get('cook-time-type')||'cooking',time:+d.get('total-time'),difficulty:d.get('difficulty'),rating:existing?.rating||0,emoji:existing?.emoji||'🍽️',bg:existing?.bg||'#dce8df',imageUrl:existing?.imageUrl||'',servings:+d.get('servings'),source:d.get('source').trim(),ingredients,steps};ingredients.forEach(([name])=>{if(!categories[name])categories[name]='Other'});let saved=existing?await updateRecipe(existing.id,record,coverFile):await createRecipe(record,coverFile);if(version!==sessionVersion)return;if(existing)recipes=recipes.map(r=>r.id===existing.id?saved:r);else{recipes.push(saved);libraryTab='created';recipeFilters={search:'',ready:false,difficulty:'',tag:'',sort:'az'}}shopping=shopping.map(item=>cleanRecipeSources(item,recipes));view=existing?'detail':'recipes';if(existing)currentRecipe=saved;message=existing?'Recipe updated':'Recipe saved'}if(submitVersion!==sessionVersion)return;if(!d.has('recipe')&&!d.has('remove-plan-id'))saveState();$('#modal-root').innerHTML='';home();if(view==='detail')detail(currentRecipe.id,detailReturn);else if(view)show(view);toast(message)}catch(error){console.error(error);button.disabled=false;if(d.has('recipe-name')&&form.isConnected)showRecipeSaveError(form,error);else toast(`Save failed: ${error.message}`)}});
document.addEventListener('click',event=>{const filter=event.target.closest('[data-filter]');if(filter){recipeFilters.ready=filter.dataset.filter==='ready';$$('#recipes-view [data-filter]').forEach(button=>button.classList.toggle('active',button.dataset.filter===(recipeFilters.ready?'ready':'all')));applyRecipeFilters()}const location=event.target.closest('[data-location]');if(location){inventoryFilters.location=location.dataset.location;$$('[data-location]').forEach(button=>button.classList.toggle('active',button===location));applyInventoryFilters()}});
document.addEventListener('click',event=>{const edit=event.target.closest('[data-edit-inventory]');if(edit)editInventoryModal(edit.dataset.editInventory)});
async function setInventoryActive(id,isActive){
 const entry=Object.entries(inventory).find(([,item])=>item.ingredientId===id);if(!entry)throw new Error('Ingredient no longer exists.');
 if(!isActive&&stockStatus(entry[1])!=='out')throw new Error('Only out-of-stock ingredients can be marked inactive. Your stock has been kept.');
 const version=sessionVersion,user=await currentUser();if(version!==sessionVersion||user.id!==activeUserId)throw new Error('Please sign in again.');
 let query=supabase.from('inventory').update({is_active:isActive}).eq('user_id',user.id).eq('ingredient_id',id);if(!isActive)query=query.eq('quantity',0);
 const {data,error}=await query.select('id');if(error)throw new Error(/is_active/.test(error.message)?'Pantry tracking needs database update 019_inventory_tracking.sql.':error.message);
 if(!data?.length)throw new Error('Stock changed or the ingredient is unavailable. Refresh and try again.');
 if(version!==sessionVersion)return false;inventory[entry[0]]={...entry[1],isActive};return true;
}
document.addEventListener('click',async event=>{
 const filter=event.target.closest('[data-inventory-status]');if(filter){inventoryFilters.status=inventoryFilters.status===filter.dataset.inventoryStatus?'all':filter.dataset.inventoryStatus;for(const button of $$('[data-inventory-status]'))button.setAttribute('aria-pressed',String(button.dataset.inventoryStatus===inventoryFilters.status));applyInventoryFilters();return}
 const action=event.target.closest('[data-set-inventory-active]');if(!action||action.disabled)return;
 const form=action.closest('form');if(form.querySelector('.primary-btn').disabled)return;
 form.elements['inventory-active'].value=action.dataset.nextActive;syncInventoryTracking(form);
});
document.addEventListener('change',event=>{if(!event.target.matches('[data-inventory-tracking-filter]'))return;inventoryFilters.tracking=event.target.value;inventoryFilters.status='all';inventoryView()});

async function shoppingIngredient(item){
 const entry=Object.entries(inventory).find(([name,stock])=>item.ingredientId?stock.ingredientId===item.ingredientId:name.trim().toLowerCase()===item.name.trim().toLowerCase());
 if(entry)return {id:entry[1].ingredientId,canonical_name:entry[0],category:entry[1].category||categories[entry[0]],default_unit:entry[1].unit};
 let query=supabase.from('ingredients').select('id,canonical_name,category,default_unit');
 const result=item.ingredientId?await query.eq('id',item.ingredientId).limit(2):await query.eq('normalized_name',item.name.trim().replace(/\s+/g,' ').toLowerCase()).limit(2);
 if(result.error)throw new Error(result.error.message);return result.data?.length===1?result.data[0]:null;
}
async function handleShoppingCheck(index,input){
 const item=shopping[index];if(!item)return;const previous=item.checked;item.checked=input.checked;if(!saveState())item.checked=previous;shoppingView();
}
let transferringShopping=false;
async function transferCheckedItems(){
 if(transferringShopping)return;transferringShopping=true;const version=sessionVersion;let count=0;
 const button=document.querySelector('[data-transfer-shopping]');if(button)button.disabled=true;
 try{
  for(const item of shopping.filter(item=>item.checked&&!item.receivedPurchase&&item.inventoryMode!=='skip')){
   if(version!==sessionVersion)return;
   if(!shopping.includes(item))continue;
   if(!item.receiptId){item.receiptId=crypto.randomUUID();if(!saveState()){delete item.receiptId;throw new Error('Could not save the purchase.');}}
   const pending=item.pendingPurchase;
   if(pending){await receiveShoppingPurchase(item,{id:pending.ingredientId,canonical_name:pending.name},pending.quantity,pending.unit,pending.location);count++;continue}
   const ingredient=await shoppingIngredient(item);if(version!==sessionVersion)return;if(!shopping.includes(item))continue;
   const stock=ingredient?Object.values(inventory).find(stock=>stock.ingredientId===ingredient.id):null;
   if(!ingredient||(item.qty!==null&&stock?.qty>0&&convertQuantity(item.qty,item.unit,stock.unit)===null)||!units.includes(item.unit)||item.unit==='other'){receiveShoppingModal(item,ingredient,stock);return}
   await receiveShoppingPurchase(item,ingredient,item.qty??null,item.unit,stock?.location||'Pantry');count++;
  }
  if(version===sessionVersion)toast(count?`${count} bought items added to inventory`:'No checked food items to add');
 }catch(error){if(version===sessionVersion)toast(`Could not finish adding items: ${error.message}`)}finally{transferringShopping=false;if(version===sessionVersion)shoppingView()}
}
function receiveShoppingModal(item,ingredient,stock){
 const incompatible=stock?.qty>0&&convertQuantity(item.qty,item.unit,stock.unit)===null,unit=incompatible?stock.unit:units.includes(item.unit)?item.unit:ingredient?.default_unit||'pcs';
 modal('Put '+item.name+' away',`<input type="hidden" name="receive-shopping-id" value="${item.receiptId}"><p>${incompatible?`Your inventory uses ${escapeHtml(stock.unit)}. Enter the actual purchased amount in that unit.`:'Confirm the ingredient. Leave quantity blank if you don’t need to track the amount.'}</p>${ingredientPicker('purchase-ingredient')}<div class="form-grid"><label>Quantity purchased (optional)<input name="purchase-quantity" type="number" min="0.001" step="any" placeholder="Not specified" value="${!incompatible&&item.qty>0?item.qty:''}"></label><label>Unit<select name="purchase-unit">${[...new Set([...units,unit])].filter(Boolean).map(value=>`<option ${value===unit?'selected':''}>${escapeHtml(value)}</option>`).join('')}</select></label></div><label>Location<select name="purchase-location">${['Fridge','Freezer','Pantry'].map(location=>`<option ${location===(stock?.location||'Pantry')?'selected':''}>${location}</option>`).join('')}</select></label><button type="button" class="text-btn" data-skip-purchase-inventory="${item.receiptId}">Just mark purchased — don’t add to food inventory</button>`,'Add to inventory');
 const picker=$('#modal-form .ingredient-picker');if(ingredient){presetIngredient(picker,ingredient);$('#modal-form [name="purchase-unit"]').value=unit}else{picker.querySelector('input').value=item.name;picker.querySelector('input').dispatchEvent(new Event('input',{bubbles:true}))}
}
async function submitShoppingReceipt(data){const form=$('#modal-form'),item=shopping.find(item=>item.receiptId===data.get('receive-shopping-id'));if(!item)throw new Error('Shopping item no longer exists.');const ingredient=selectedIngredient(form.querySelector('.ingredient-picker')),quantity=parseRecipeQuantity(data.get('purchase-quantity'),data.get('purchase-unit'));await receiveShoppingPurchase(item,ingredient,quantity,data.get('purchase-unit'),data.get('purchase-location'))}
async function receiveShoppingPurchase(item,ingredient,quantity,unit,location){
 if(purchasePending.has(item.receiptId))throw new Error('This purchase is already being saved.');
 const version=sessionVersion,user=await currentUser();if(version!==sessionVersion||user.id!==activeUserId)throw new Error('Please sign in again.');if(quantity!==null&&(!Number.isFinite(quantity)||quantity<=0))throw new Error('Enter zero or a positive quantity, or leave it blank.');
 item.pendingPurchase={ingredientId:ingredient.id,name:ingredient.canonical_name,quantity,unit,location};if(!saveState())throw new Error('Could not save the pending purchase.');
 purchasePending.add(item.receiptId);
 try{
  const {data,error}=await supabase.rpc('receive_shopping_item',{p_receipt_id:item.receiptId,p_ingredient_id:ingredient.id,p_quantity:quantity,p_unit:unit,p_location:location});
  if(error){if(error.code&&version===sessionVersion){delete item.pendingPurchase;saveState()}throw new Error(['PGRST202','42P01','42703','PGRST204'].includes(error.code)?'Inventory transfers need database update 012_optional_stock_quantities.sql in Supabase.':error.message)}
  if(version!==sessionVersion)return;if(!data?.inventory)throw new Error('Could not confirm the inventory update.');
  const row=data.inventory,name=data.ingredient.canonical_name,category=row.category_override||data.ingredient.category||'Other';
  const previousName=Object.keys(inventory).find(name=>inventory[name].ingredientId===ingredient.id);if(previousName&&previousName!==name)delete inventory[previousName];
  inventory[name]={id:row.id,ingredientId:ingredient.id,qty:row.quantity===null?null:Number(row.quantity),unit:row.unit,location:row.storage_location,stockStatus:row.stock_status??null,isActive:row.is_active!==false,threshold:Number(row.low_stock_threshold),category,categoryOverride:row.category_override||null};categories[name]=category;
  const current=shopping.find(entry=>entry.receiptId===item.receiptId)||item;delete item.pendingPurchase;delete current.pendingPurchase;Object.assign(current,{name,ingredientId:ingredient.id,qty:quantity,unit,checked:current.checked,receivedPurchase:true});Object.assign(item,current);
  if(!saveState()){throw new Error('Inventory was updated, but the shopping check could not be saved. Retry the same item safely.');}
  home();toast('Purchase added to inventory');
 }finally{purchasePending.delete(item.receiptId)}
}

function shoppingCategory(item){return item.inventoryMode==='skip'?'Other items':categories[item.name]||'Other'}
function shoppingEntryModal(){
 modal('Add to your shopping list',`<input type="hidden" name="shopping-entry" value="true"><input type="hidden" name="entry-kind" value="item"><div class="shopping-entry-tabs" role="group" aria-label="Item type"><button type="button" data-shopping-entry-mode="item" aria-pressed="true">Type any item</button><button type="button" data-shopping-entry-mode="ingredient" aria-pressed="false">Find an ingredient</button></div><div data-entry-panel="item"><label>Item<input name="free-item" required maxlength="150" placeholder="Milk, dish soap, batteries…"></label><label class="leftover-toggle"><input type="checkbox" name="track-inventory"> Include in inventory transfer</label></div><div data-entry-panel="ingredient" hidden>${ingredientPicker('shopping-catalogue',false)}</div><div class="form-grid"><label>Quantity (optional)<input name="entry-quantity" type="number" min="0.001" step="any" value="1" placeholder="As needed"></label><label>Unit<select name="unit">${units.map(unit=>`<option ${unit==='pcs'?'selected':''}>${unit}</option>`).join('')}</select></label></div>`,'Add item');
 $('#modal-form [name="shopping-catalogue"]').disabled=true;
}
function saveShoppingEntry(data){
 const form=$('#modal-form'),quantity=parseRecipeQuantity(data.get('entry-quantity'),data.get('unit')),before=shopping;
 if(data.get('entry-kind')==='ingredient'){const ingredient=selectedIngredient(form.querySelector('.ingredient-picker'));shopping=addIndependentIngredient(shopping,ingredient,quantity,data.get('unit'));categories[ingredient.canonical_name]=Object.values(inventory).find(stock=>stock.ingredientId===ingredient.id)?.category||ingredient.category||'Other'}
 else shopping=addFreeShoppingItem(shopping,{name:data.get('free-item')||'',quantity,unit:data.get('unit'),trackInventory:data.has('track-inventory')});
 if(!saveState()){shopping=before;throw new Error('Could not save your shopping list.');}
}
document.addEventListener('click',event=>{
 const mode=event.target.closest('[data-shopping-entry-mode]');if(mode){const form=$('#modal-form'),kind=mode.dataset.shoppingEntryMode;form._entryUnits||={item:'pcs',ingredient:'piece'};form._entryUnits[form.elements['entry-kind'].value]=form.elements.unit.value;form.elements['entry-kind'].value=kind;form.elements.unit.value=form._entryUnits[kind];form.querySelectorAll('[data-entry-panel]').forEach(panel=>{const active=panel.dataset.entryPanel===kind;panel.hidden=!active;panel.querySelectorAll('input,select,button').forEach(control=>control.disabled=!active)});form.querySelectorAll('[data-shopping-entry-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button===mode)));form.querySelector(`[data-entry-panel="${kind}"] input`).focus();return}
 const skip=event.target.closest('[data-skip-purchase-inventory]');if(skip){const item=shopping.find(item=>item.receiptId===skip.dataset.skipPurchaseInventory);if(!item)return;const before={...item};item.checked=true;item.inventoryMode='skip';if(!saveState()){Object.assign(item,before);if(before.inventoryMode===undefined)delete item.inventoryMode;return}$('#modal-root').innerHTML='';shoppingView();toast('Item kept on shopping list');setTimeout(transferCheckedItems,0)}
});
renderIcons();
home();
function handleDatabaseLoad(session){return loadDatabase(session).catch(error=>toast(`Could not load profiles: ${error.message}`))}
window.addEventListener('mise-auth-change',event=>handleDatabaseLoad(event.detail.session));
supabase.auth.getSession().then(({data,error})=>{if(error)toast(`Could not restore kitchen: ${error.message}`);else handleDatabaseLoad(data.session)});

// Refresh calendar labels when returning after a day or week boundary.
document.addEventListener('visibilitychange',()=>{if(document.hidden)return;highlightPlannerToday();home();if(document.querySelector('#planner-view.active'))plannerView()});

document.addEventListener('input',event=>{if(event.target.matches('#modal-form [name="servings"]'))refreshPlanMissing()});
document.addEventListener('change',event=>{if(event.target.matches('#modal-form [name="recipe"]'))refreshPlanMissing()});

window.addEventListener('mise-substitutions-updated',()=>{detailChoices={};home()});
window.addEventListener('mise-catalogue-updated',()=>{loadedUserId=null;if(activeUserId)handleDatabaseLoad({user:{id:activeUserId}})});

document.addEventListener('keydown',event=>{const card=event.target.closest('.recipe-card');if(card&&event.target===card&&['Enter',' '].includes(event.key)){event.preventDefault();if(!card.dataset.discoverRecipe)detail(card.dataset.recipe,card.closest('#tags-view')?'tags':'recipes')}});

document.addEventListener('change',event=>{if(event.target.matches('[name="ingredient-unit"]')){const row=event.target.closest('.recipe-ingredient-input'),quantity=row.querySelector('[name="ingredient-quantity"]');quantity.disabled=['as needed','to taste'].includes(event.target.value);if(quantity.disabled)quantity.value=''}});

document.addEventListener('change',event=>{
 const control=event.target.closest('[data-substitution]');if(!control)return;
 const key=control.dataset.substitution,value=control.value;
 if(control.dataset.substitutionContext==='plan'){
  const form=$('#modal-form');form._substitutions||={};const previous=form._substitutions[key];if(value)form._substitutions[key]=value;else delete form._substitutions[key];
  for(const id of [key,previous,value])form._purchaseOverrides?.delete(id);refreshPlanMissing();
 }else if(currentRecipe){
  const choices=detailChoices[currentRecipe.id]||={};if(value)choices[key]=value;else delete choices[key];
  $('#ingredient-checks').innerHTML=ingredientRows(currentRecipe,Number($('#servings').value));
 }
});

document.addEventListener('change',event=>{
 if(event.target.matches('[data-planner-slots]')){const previous=plannerSlots;plannerSlots=event.target.checked;try{if(activeUserId)localStorage.setItem('mise-meal-planner-slots-'+activeUserId,String(plannerSlots));plannerView()}catch(error){plannerSlots=previous;event.target.checked=previous;toast('Could not save your planner view.')}}
 if(event.target.matches('#modal-form [name="is-leftover"]'))refreshPlanMissing();
});
document.addEventListener('click',event=>{
 const duplicate=event.target.closest('[data-duplicate-plan],[data-leftover-plan]');if(duplicate)return duplicatePlanModal(duplicate.dataset.duplicatePlan||duplicate.dataset.leftoverPlan,!!duplicate.dataset.leftoverPlan);
 const add=event.target.closest('[data-add-date]');if(add){if(!recipes.length)return toast('Add a recipe first');openPlannerGallery({date:add.dataset.addDate,slot:add.dataset.addMealSlot})}
});
document.addEventListener('dragstart',event=>{
 const card=event.target.closest('[data-plan-card]');if(!card)return;
 if(event.target.closest('button,summary'))return event.preventDefault();
 draggedMealId=card.dataset.planCard;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('application/x-mise-meal',draggedMealId);card.classList.add('dragging');
});
document.addEventListener('dragover',event=>{
 if(!draggedMealId)return;const target=event.target.closest('[data-drop-date],[data-drop-week]');if(!target)return;
 event.preventDefault();event.dataTransfer.dropEffect='move';$$('.drop-target').forEach(node=>{if(node!==target)node.classList.remove('drop-target')});target.classList.add('drop-target');
});
document.addEventListener('dragleave',event=>{const target=event.target.closest('[data-drop-date],[data-drop-week]');if(target&&!target.contains(event.relatedTarget))target.classList.remove('drop-target')});
document.addEventListener('drop',event=>{
 const target=event.target.closest('[data-drop-date],[data-drop-week]');if(!draggedMealId||!target)return;
 event.preventDefault();const id=draggedMealId,meal=plans.find(plan=>String(plan.id)===String(id));draggedMealId=null;$$('.drop-target,.dragging').forEach(node=>node.classList.remove('drop-target','dragging'));if(!meal)return;
 const date=target.dataset.dropDate||shiftWeek(meal.date,Number(target.dataset.dropWeek));movePlannedMeal(id,date,target.dataset.dropSlot);
});
document.addEventListener('dragend',()=>{draggedMealId=null;$$('.drop-target,.dragging').forEach(node=>node.classList.remove('drop-target','dragging'))});

document.addEventListener('input',event=>{if(event.target.matches('[data-gallery-search]'))renderPlannerGallery()});
document.addEventListener('change',event=>{if(event.target.matches('[data-gallery-filter],[data-gallery-tag]'))renderPlannerGallery()});
document.addEventListener('click',event=>{
 const selected=event.target.closest('[data-select-plan-recipe]');if(selected)return selectPlannerRecipe(selected.dataset.selectPlanRecipe);
 if(event.target.closest('[data-change-plan-recipe]'))openPlannerGallery({change:true});
});

function recipeFeedbackFields(recipe,postCook=false){
 const rating=postCook?'':(recipe.rating||'');
 return `<input type="hidden" name="feedback-recipe" value="${escapeHtml(recipe.id)}"><fieldset class="feedback-rating"><legend>Your rating (optional)</legend><input type="hidden" name="rating" value="${rating}"><div class="rating-buttons">${[1,2,3,4,5].map(value=>`<button type="button" data-rating-value="${value}" aria-label="Rate ${value} out of 5" aria-pressed="${Number(rating)===value}" class="${Number(rating)>=value?'filled':''}">★</button>`).join('')}<button type="button" class="rating-clear" data-rating-value="" aria-label="Clear rating selection">Clear</button></div><small data-rating-label>${rating?`${rating} / 5`:postCook&&recipe.rating?`No new rating · current: ${recipe.rating} / 5`:'Not rated'}</small>${recipe.visibility==='public'?`<label class="rating-community-choice"><input type="checkbox" name="contribute-to-community" ${recipe.contributeToCommunity?'checked':''}> <span>Contribute to community rating</span></label><small>Your rating is private unless you choose to contribute.</small>`:'<small>Private recipe · your rating stays private.</small>'}</fieldset><label class="feedback-notes">${postCook?'Add a personal note (optional)':'New personal note (optional)'}<textarea name="comments" rows="4" maxlength="5000" placeholder="What worked? What would you change?"></textarea></label>`;
}
function openRecipeCheckin(recipe,fromCooking=false){
 let dialog=$('#post-cook-feedback');if(!dialog){dialog=document.createElement('dialog');dialog.id='post-cook-feedback';dialog.className='post-cook-feedback';document.body.append(dialog)}
 dialog.innerHTML=`<div class="feedback-heading"><div><h2>${fromCooking?'How was it?':'Made it'}</h2><p>${escapeHtml(recipe.name)}</p></div><button type="button" class="round-btn" data-skip-feedback aria-label="Close check-in">×</button></div><form id="post-cook-feedback-form"><label class="made-checkin"><input type="checkbox" name="made-it" ${fromCooking?(recipe.lastCookedAt?'checked':''):'checked'}> <span>Mark as made it</span></label><p class="quantity-hint">Only checked recipes appear in What I made. Uncheck to remove a previous mark.</p>${recipeFeedbackFields(recipe,true)}${recipe.visibility==='public'?'<label class="feedback-notes">Public comment (optional)<textarea name="public-comment" rows="3" maxlength="2000" placeholder="Share a tip or how it went…"></textarea><small>Visible to others. Personal notes stay private.</small></label>':''}<p class="quantity-hint">Rating, comment and personal note are all optional.</p><p role="status" data-feedback-status></p><div class="modal-actions"><button type="button" class="secondary-btn" data-skip-feedback>Cancel</button><button class="primary-btn">Save check-in</button></div></form>`;
 dialog.querySelectorAll('[data-skip-feedback]').forEach(button=>button.onclick=()=>dialog.close());dialog.showModal();
}
function openPostCookFeedback(){
 const log=cookingLog;if($('#cooking-view.active')||!log||log.feedbackShown||log.version!==sessionVersion)return;log.feedbackShown=true;
 const recipe=recipes.find(recipe=>recipe.id===log.recipeId);if(recipe)openRecipeCheckin(recipe,true);
}
function syncMadeButtons(recipe){for(const button of $$('[data-made-recipe]'))if(button.dataset.madeRecipe===recipe.id){button.setAttribute('aria-pressed',String(!!recipe.lastCookedAt));button.innerHTML=`${icon(recipe.lastCookedAt?'check':'utensils')} ${recipe.lastCookedAt?'Made it':'Made it?'}`;}}
document.addEventListener('click',event=>{const button=event.target.closest('[data-made-recipe]');if(button){const recipe=recipes.find(recipe=>recipe.id===button.dataset.madeRecipe);if(recipe)openRecipeCheckin(recipe);}});
async function saveRecipeCheckin(id,values){
 const version=sessionVersion,user=await currentUser();if(version!==sessionVersion||user.id!==activeUserId)throw new Error('Please sign in again.');
 const recipe=recipes.find(recipe=>recipe.id===id);if(!recipe)throw new Error('Recipe no longer available.');
 const patch=feedbackPatch(recipe,{...values,append:true}),comment=String(values.comment||'').trim();
 if(comment.length>2000)throw new Error('Keep public comments under 2,000 characters.');
 const {data,error}=await supabase.rpc('save_recipe_checkin',{p_id:id,p_made:values.made===true,p_set_rating:patch.rating!==undefined,p_rating:patch.rating??null,p_note:patch.note||null,p_note_id:values.noteId,p_contribute:recipe.visibility==='public'?values.contributeToCommunity:false,p_comment:comment||null,p_comment_id:values.commentId});
 if(error)throw new Error(['PGRST202','42P01','PGRST205'].includes(error.code)?'Check-ins need database update 035_recipe_made_checkins.sql.':error.message);
 if(!data)throw new Error('Recipe not found or access denied.');if(version!==sessionVersion)return null;
 const latest=recipes.find(recipe=>recipe.id===id)||recipe,saved={...latest,lastCookedAt:data.made_at||null,rating:Number(data.rating)||0,contributeToCommunity:data.contribute_to_community===true,communityAverage:data.community_average==null?null:Number(data.community_average),communityCount:Number(data.community_count)||0,notePosts:data.posts||[],noteIssue:'',_noteLoad:(latest._noteLoad||0)+1};
 recipes=recipes.map(row=>row.id===id?saved:row);if(currentRecipe?.id===id)currentRecipe=saved;syncMadeButtons(saved);renderRecipeNoteFeed(saved);
 if(comment&&$('#detail-view.active'))loadRecipeComments(id);
 if(cookingLog?.recipeId===id)cookingLog.feedbackShown=true;window.dispatchEvent(new CustomEvent('noms-made-changed'));return saved;
}
document.addEventListener('click',event=>{if(event.target.closest('[data-action="leave-unchanged"]'))openPostCookFeedback()});
async function saveRecipeFeedback(id,values){
 const version=sessionVersion,user=await currentUser();if(version!==sessionVersion||user.id!==activeUserId)throw new Error('Please sign in again.');
 const recipe=recipes.find(recipe=>recipe.id===id);if(!recipe)throw new Error('Recipe no longer exists.');
 const patch=feedbackPatch(recipe,values);if(!Object.keys(patch).length&&values.contributeToCommunity===undefined)return recipe;
 const {data,error}=await supabase.rpc('save_recipe_rating_feedback',{p_id:id,p_set_rating:patch.rating!==undefined,p_rating:patch.rating??null,p_note:patch.note||null,p_note_id:values.noteId||crypto.randomUUID(),p_contribute:recipe.visibility==='public'?(values.contributeToCommunity??null):false});
 if(error)throw new Error(['PGRST202','42P01','PGRST205'].includes(error.code)?'Feedback needs database update 032_personal_community_ratings.sql in Supabase.':error.message);
 if(!data)throw new Error('Recipe not found or access denied.');if(version!==sessionVersion)return null;
 const latest=recipes.find(recipe=>recipe.id===id)||recipe;const saved={...latest,rating:Number(data.rating)||0,contributeToCommunity:data.contribute_to_community===true,communityAverage:data.community_average==null?null:Number(data.community_average),communityCount:Number(data.community_count)||0,notePosts:data.posts||[],noteIssue:'',_noteLoad:(latest._noteLoad||0)+1};
 recipes=recipes.map(recipe=>recipe.id===id?saved:recipe);if(currentRecipe?.id===id)currentRecipe=saved;return saved;
}
document.addEventListener('click',event=>{
 const shoppingButton=event.target.closest('[data-recipe-shopping]');if(shoppingButton)return recipeShoppingModal(shoppingButton.dataset.recipeShopping);
 const rating=event.target.closest('[data-rating-value]');if(!rating)return;
 const fieldset=rating.closest('.feedback-rating'),value=rating.dataset.ratingValue;fieldset.querySelector('[name="rating"]').value=value;
 fieldset.querySelectorAll('[data-rating-value]:not(.rating-clear)').forEach(button=>{button.classList.toggle('filled',Number(button.dataset.ratingValue)<=Number(value));button.setAttribute('aria-pressed',String(button.dataset.ratingValue===value))});
 if(!value){const sharing=fieldset.querySelector('[name="contribute-to-community"]');if(sharing)sharing.checked=false;}
 fieldset.querySelector('[data-rating-label]').textContent=value?`${value} / 5`:'No rating selected';
});
document.addEventListener('submit',async event=>{
 if(!['recipe-feedback-form','post-cook-feedback-form'].includes(event.target.id))return;
 event.preventDefault();const form=event.target,postCook=form.id==='post-cook-feedback-form',button=form.querySelector('button:not([type="button"])'),status=form.querySelector('[data-feedback-status]');if(button.disabled)return;button.disabled=true;status.textContent='Saving…';
 const data=new FormData(form);
 try{
  const values={rating:data.get('rating'),contributeToCommunity:data.has('contribute-to-community'),notes:data.get('comments'),append:postCook,noteId:form._noteId||=(crypto.randomUUID())};
  const saved=postCook?await saveRecipeCheckin(data.get('feedback-recipe'),{...values,made:data.has('made-it'),comment:data.get('public-comment'),commentId:form._commentId||=(crypto.randomUUID())}):await saveRecipeFeedback(data.get('feedback-recipe'),values);
  if(!saved||!form.isConnected)return;
  if(postCook){$('#post-cook-feedback').close();if(currentRecipe?.id===saved.id&&$('#recipe-rating-fact'))$('#recipe-rating-fact').textContent=saved.rating?`★ ${saved.rating}`:'Not rated';}else{form.querySelector('[name="comments"]').value='';const sharing=form.querySelector('[name="contribute-to-community"]');if(sharing)sharing.checked=saved.contributeToCommunity;form._noteId=null;status.textContent='Saved';renderRecipeNoteFeed(saved);if(currentRecipe?.id===saved.id&&$('#recipe-rating-fact'))$('#recipe-rating-fact').textContent=saved.rating?`★ ${saved.rating}`:'Not rated'}for(const node of $$('[data-community-rating]'))if(node.dataset.communityRating===saved.id)node.outerHTML=communityRatingMarkup(saved);home();
 }catch(error){if(form.isConnected)status.textContent=`Could not save: ${error.message}`}finally{button.disabled=false}
});

document.addEventListener('input',event=>{if(event.target.matches('#recipe-feedback-form [name="comments"],#post-cook-feedback-form [name="comments"]'))event.target.form._noteId=null});

function syncPurchaseToggle(){const form=$('#modal-form'),button=form?.querySelector('[data-toggle-purchases]');if(!button)return;const inputs=[...form.querySelectorAll('[name="missing"]')];button.disabled=!inputs.length;button.textContent=inputs.length&&inputs.every(input=>input.checked)?'Unselect all':'Select all'}
function oftenBoughtMarkup(){return `<h2>Often bought</h2><p>Pin your staples. Add them whenever you need.</p><form id="often-bought-form">${ingredientPicker('highlight-ingredient')}<button class="secondary-btn">Pin ingredient</button><p role="status" data-often-status></p></form><div class="often-bought-items">${oftenBought.map(item=>`<div class="often-bought-item"><strong>${ingredientDot(categories[item.name]||item.category||'Other')}${escapeHtml(item.name)}</strong><button type="button" class="icon-cart-btn" data-pin-shopping="${escapeHtml(item.ingredientId)}" aria-label="Add ${escapeHtml(item.name)} to shopping list">${icon('cartPlus')}</button><button type="button" class="text-btn" data-unpin-ingredient="${escapeHtml(item.ingredientId)}" aria-label="Unpin ${escapeHtml(item.name)}">×</button></div>`).join('')||'<p class="quantity-hint">Search above to pin an ingredient.</p>'}</div>`}
function independentShoppingModal(ingredient){
 modal('Add '+ingredient.canonical_name,`<input type="hidden" name="independent-shopping" value="true"><div class="form-grid"><label>Quantity (optional)<input type="number" name="independent-quantity" min="0.001" step="any" placeholder="As needed"></label><label>Unit<select name="independent-unit">${units.map(unit=>`<option ${unit===ingredient.default_unit?'selected':''}>${unit}</option>`).join('')}</select></label></div>`,'Add to shopping list');
 $('#modal-form')._shoppingIngredient=ingredient;
}
function saveIndependentShopping(data){const form=$('#modal-form'),ingredient=form._shoppingIngredient,unit=data.get('independent-unit'),quantity=parseRecipeQuantity(data.get('independent-quantity'),unit);if(!ingredient)throw new Error('Choose an ingredient.');const before=shopping;shopping=addIndependentIngredient(shopping,ingredient,quantity,unit);if(!saveState()){shopping=before;throw new Error('Could not save your shopping list.')}categories[ingredient.canonical_name]=Object.values(inventory).find(stock=>stock.ingredientId===ingredient.id)?.category||ingredient.category||'Other'}
document.addEventListener('submit',event=>{
 if(event.target.id!=='often-bought-form')return;event.preventDefault();const form=event.target;
 try{const ingredient=selectedIngredient(form.querySelector('.ingredient-picker')),next=pinIngredient(oftenBought,ingredient);writeOftenBought(localStorage,activeUserId,next);oftenBought=next;$('#often-bought-panel').innerHTML=oftenBoughtMarkup()}
 catch(error){form.querySelector('[data-often-status]').textContent=error.message}
});
document.addEventListener('click',event=>{
 if(event.target.closest('[data-toggle-purchases]')){const form=$('#modal-form'),inputs=[...form.querySelectorAll('[name="missing"]')],checked=!inputs.every(input=>input.checked);for(const input of inputs){input.checked=checked;form._purchaseOverrides.set(input.dataset.purchaseKey,checked)}syncPurchaseToggle();return}
 const unpin=event.target.closest('[data-unpin-ingredient]');if(unpin){try{const next=oftenBought.filter(item=>item.ingredientId!==unpin.dataset.unpinIngredient);writeOftenBought(localStorage,activeUserId,next);oftenBought=next;$('#often-bought-panel').innerHTML=oftenBoughtMarkup()}catch(error){toast('Could not save pinned ingredients.')}return}
 const pin=event.target.closest('[data-pin-shopping]');if(pin){const item=oftenBought.find(item=>item.ingredientId===pin.dataset.pinShopping);if(item)independentShoppingModal({id:item.ingredientId,canonical_name:item.name,default_unit:item.unit,category:item.category});return}
 const inventoryButton=event.target.closest('[data-inventory-shopping]');if(inventoryButton){const entry=Object.entries(inventory).find(([,item])=>item.ingredientId===inventoryButton.dataset.inventoryShopping);if(entry)independentShoppingModal({id:entry[1].ingredientId,canonical_name:entry[0],default_unit:entry[1].unit,category:categories[entry[0]]});return}
});
function recipeNotesMarkup(recipe){
 const posts=recipe.notePosts??(recipe.notes?[{id:'legacy',body:recipe.notes,created_at:null,is_legacy:true}]:[]);
 return `${recipe.noteIssue?`<p role="status">${escapeHtml(recipe.noteIssue)}</p>`:''}${posts.map(post=>`<article class="personal-note-post"><div class="note-post-heading"><time ${post.created_at?`datetime="${escapeHtml(post.created_at)}" title="${escapeHtml(new Date(post.created_at).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'}))}"`:''}>${escapeHtml(noteTimeLabel(post.created_at))}</time>${post.id==='legacy'?'':`<button type="button" class="text-btn feedback-delete" aria-label="Delete personal note" title="Delete personal note" data-delete-note="${escapeHtml(post.id)}" data-note-owner-recipe="${escapeHtml(recipe.id)}">${icon('trash2')}</button>`}</div><p>${escapeHtml(post.body)}</p></article>`).join('')||'<p class="quantity-hint">No personal notes yet.</p>'}`;
}
function renderRecipeNoteFeed(recipe){for(const feed of $$('.recipe-note-feed'))if(feed.dataset.noteRecipe===recipe.id)feed.innerHTML=recipeNotesMarkup(recipe)}
async function loadRecipeNotePosts(id){
 const version=sessionVersion,userId=activeUserId,initial=recipes.find(recipe=>recipe.id===id);if(!userId||!initial)return;
 const request=initial._noteLoad=(initial._noteLoad||0)+1;
 try{
  const {data,error}=await supabase.from('recipe_notes').select('id,body,created_at,is_legacy').eq('recipe_id',id).eq('user_id',userId).order('created_at',{ascending:false,nullsFirst:false});
  if(version!==sessionVersion)return;const recipe=recipes.find(recipe=>recipe.id===id);if(!recipe||recipe._noteLoad!==request)return;
  if(error)throw error;recipe.notePosts=data||[];recipe.noteIssue='';renderRecipeNoteFeed(recipe);

 }catch(error){if(version!==sessionVersion)return;const recipe=recipes.find(recipe=>recipe.id===id);if(!recipe||recipe._noteLoad!==request)return;recipe.noteIssue=['42P01','PGRST205'].includes(error.code)?'Personal note posts need database update 010_recipe_note_posts.sql in Supabase.':`Could not load notes: ${error.message}`;renderRecipeNoteFeed(recipe)}
}
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-delete-note]');if(!button||button.disabled)return;const version=sessionVersion,userId=activeUserId,recipeId=button.dataset.noteOwnerRecipe,noteId=button.dataset.deleteNote;button.disabled=true;
 try{const {data,error}=await supabase.from('recipe_notes').delete().eq('id',noteId).eq('recipe_id',recipeId).eq('user_id',userId).select('id');if(version!==sessionVersion)return;if(error)throw error;if(!data?.length)throw new Error('Note not found or access denied.');const recipe=recipes.find(recipe=>recipe.id===recipeId);if(recipe){recipe._noteLoad=(recipe._noteLoad||0)+1;recipe.notePosts=(recipe.notePosts||[]).filter(post=>post.id!==noteId);renderRecipeNoteFeed(recipe)}}catch(error){if(version===sessionVersion)toast(`Could not delete note: ${error.message}`)}finally{button.disabled=false}
});
function refreshNoteTimes(){for(const time of $$('.recipe-note-feed time[datetime]'))time.textContent=noteTimeLabel(time.dateTime)}
setInterval(()=>{if(!document.hidden)refreshNoteTimes()},60000);

document.addEventListener('input',event=>{if(event.target.id==='recipe-search'){recipeFilters.search=event.target.value;applyRecipeFilters()}if(event.target.id==='inventory-search'){inventoryFilters.search=event.target.value;applyInventoryFilters()}});
document.addEventListener('change',event=>{if(event.target.matches('[data-recipe-difficulty]'))recipeFilters.difficulty=event.target.value;else if(event.target.matches('[data-recipe-tag]'))recipeFilters.tag=event.target.value;else if(event.target.matches('[data-recipe-sort]'))recipeFilters.sort=event.target.value;else if(event.target.matches('[data-inventory-sort]')){inventoryFilters.sort=event.target.value;applyInventoryFilters();return}else return;applyRecipeFilters()});

function optionalStockQuantity(value){if(String(value??'').trim()==='')return null;const quantity=Number(value);if(!Number.isFinite(quantity)||quantity<0)throw new Error('Enter zero or a positive quantity, or leave it blank.');return quantity}
function quantityFields(qty,unit,quantityName,unitName){return `<div class="form-grid"><label>Quantity (optional)<input name="${quantityName}" type="number" min="${quantityName==='shopping-quantity'?'0.001':'0'}" step="any" value="${qty??''}" placeholder="Not specified"></label><label>Unit<select name="${unitName}">${[...new Set([...units,unit])].filter(value=>value&&!['as needed','to taste'].includes(value)).map(value=>`<option ${value===unit?'selected':''}>${escapeHtml(value)}</option>`).join('')}</select></label></div>`}
function editShoppingModal(index){const item=shopping[index];if(!item)return;if(item.pendingPurchase)return toast('Retry this inventory transfer before changing its quantity.');if(!item.id){item.id=crypto.randomUUID();if(!saveState())return}modal('Edit '+item.name,`<input type="hidden" name="edit-shopping-id" value="${escapeHtml(item.id)}">${item.receivedPurchase?'<p>Already added to inventory. This edits your shopping list only.</p>':''}${quantityFields(item.qty,item.unit,'shopping-quantity','shopping-unit')}`,'Save changes')}
function saveShoppingEdit(data){const item=shopping.find(item=>item.id===data.get('edit-shopping-id'));if(!item)throw new Error('Shopping item no longer exists.');const previous={...item};item.qty=parseRecipeQuantity(data.get('shopping-quantity'),data.get('shopping-unit'));item.unit=data.get('shopping-unit');if(!saveState()){Object.assign(item,previous);throw new Error('Could not save the shopping item.');}}
document.addEventListener('click',event=>{if(event.target.closest('[data-transfer-shopping]'))transferCheckedItems();const edit=event.target.closest('[data-edit-shopping]');if(edit)editShoppingModal(Number(edit.dataset.editShopping));const tag=event.target.closest('[data-tag-option]');if(tag)addRecipeTag(tag.dataset.tagOption)});

async function closeModal(){const backdrop=$('#modal-root .modal-backdrop');if(!backdrop)return;const form=backdrop.querySelector('form');const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;if(!reduced)await backdrop.animate([{opacity:1},{opacity:0}],{duration:180,easing:'ease-in',fill:'forwards'}).finished;if(form?.isConnected)backdrop.remove()}
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&$('#modal-root .modal-backdrop')&&!document.querySelector('.cover-crop-dialog[open]'))closeModal()});

function ingredientDot(category){return `<span class="category-dot" style="background:${categoryColour(category)}" aria-hidden="true"></span>`}
function placeDetailCreator(){const root=$('#detail-view'),creator=root?.querySelector('.creator-attribution');if(!creator||creator.parentElement?.classList.contains('detail-shareline'))return;const code=root.querySelector('.share-code'),line=document.createElement('div');line.className='detail-shareline';if(code){const privateNote=code.nextElementSibling?.matches('small')?code.nextElementSibling:null;code.before(line);line.append(code,creator);if(privateNote)line.append(privateNote)}else{line.append(creator);root.querySelector('.detail-hero h1')?.before(line)}}
new MutationObserver(placeDetailCreator).observe($('#detail-view'),{childList:true,subtree:true});
window.addEventListener('noms-category-colours-updated',()=>{home();if($('#inventory-view.active'))inventoryView();if($('#shopping-view.active'))shoppingView();if($('#detail-view.active')&&currentRecipe)$('#ingredient-checks').innerHTML=ingredientRows(currentRecipe,Number($('#servings')?.value)||currentRecipe.servings)});

// Shared discovery is separate from the private/saved library and is never
// counted as Created. Every open rechecks current server access.
function tagRecipesView(){
 const root=$('#tags-view'),tag=activeRecipeTag;
 root._tag=tag;root._offset=0;root._rows=taggedRecipes(recipes.filter(recipe=>!recipe.temporary),tag);
 root.innerHTML=`<button type="button" class="back-btn" data-view="recipes">← Back to recipes</button><div class="page-head"><div><p class="eyebrow">EXPLORE BY TAG</p><h1>${escapeHtml(tag)}</h1><p>Recipes with this tag from your cookbook and Discover.</p></div></div><p role="status" data-tag-status></p><div class="recipe-grid" data-tag-results></div><button type="button" class="secondary-btn" data-tag-more hidden>Load more</button>`;
 renderTagRecipes();loadTagRecipes();
}
function renderTagRecipes(){const root=$('#tags-view');root.querySelector('[data-tag-results]').innerHTML=root._rows.map(card).join('')||'<p>No matching recipes yet.</p>';root.querySelector('[data-tag-status]').textContent=`${root._rows.length} matching recipe${root._rows.length===1?'':'s'}`;}
async function loadTagRecipes(){
 const root=$('#tags-view'),version=sessionVersion,request=Symbol(),tag=root._tag,offset=root._offset;root._tagRequest=request;
 const more=root.querySelector('[data-tag-more]');more.disabled=true;
 try{const {data,error}=await supabase.rpc('discover_recipes',{p_search:tag,p_offset:offset});if(version!==sessionVersion||root._tagRequest!==request||root._tag!==tag)return;if(error)throw error;
 const rows=await hydrateCovers(data||[]);if(version!==sessionVersion||root._tagRequest!==request||root._tag!==tag)return;
 root._rows=taggedRecipes([...root._rows,...rows.map(mapRecipe)],tag);root._offset=offset+rows.length;renderTagRecipes();more.hidden=rows.length<24;
 }catch(error){if(version===sessionVersion&&root._tagRequest===request){root.querySelector('[data-tag-status]').textContent=`${root._rows.length} cookbook matches. Could not load Discover recipes. Try again.`;more.hidden=false;more.textContent='Try again';}}finally{if(root._tagRequest===request)more.disabled=false;}
}
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-browse-tag]');if(button){$('#recipe-peek')?.close();activeRecipeTag=button.dataset.browseTag;show('tags');return;}
 if(event.target.closest('[data-tag-more]'))loadTagRecipes();
});
function discoverView(){
 const root=$('#discover-view');
 root.innerHTML=`<div class="page-head"><div><p class="eyebrow">DISCOVER</p><h1 id="discover-title">Your next favourite.</h1><p>Original noms starters and recipes shared by public profiles.</p></div><button class="secondary-btn" data-import-recipe>Import from website</button></div><form id="discover-search-form" class="toolbar"><label class="search"><span class="sr-only">Search recipes or a six-character code</span><input name="query" maxlength="100" placeholder="Search recipes or enter a recipe code…"></label><button class="primary-btn">Search</button></form><p data-discover-status role="status"></p><div class="recipe-grid" data-discover-results></div><button class="secondary-btn" data-discover-more hidden>Load more</button>`;
 loadDiscovery();
}
async function loadDiscovery(more=false){
 const root=$('#discover-view'),version=sessionVersion,request=Symbol();root._request=request;
 const form=root.querySelector('form'),query=form.elements.query.value.trim(),offset=more?root._offset||0:0;
 const status=root.querySelector('[data-discover-status]'),grid=root.querySelector('[data-discover-results]'),next=root.querySelector('[data-discover-more]');
 next.disabled=true;status.textContent='Finding recipes…';
 if(!more)grid.innerHTML='';
 try{
  const {data,error}=await supabase.rpc('discover_recipes',{p_search:query,p_offset:offset});
  if(version!==sessionVersion||root._request!==request||!form.isConnected)return;
  if(error)throw new Error('Discover needs database update 020_recipe_catalog.sql. '+error.message);
  const rows=await hydrateCovers(data||[]);if(version!==sessionVersion||root._request!==request||!form.isConnected)return;
  grid.insertAdjacentHTML('beforeend',rows.map(row=>card(mapRecipe(row)).replaceAll('data-recipe=','data-discover-recipe=').replaceAll('data-open-recipe=','data-discover-recipe=')).join(''));
  root._offset=offset+rows.length;next.hidden=rows.length<24;
  status.textContent=rows.length?`${root._offset} recipes shown`:offset?'No more recipes.':'No recipes found. Try a name or a published recipe code.';
 }catch(error){if(version===sessionVersion&&root._request===request&&form.isConnected){status.textContent=error.message;next.hidden=true}}
 finally{if(root._request===request)next.disabled=false}
}
function importRecipeModal(){
 modal('Import from website','<input type="hidden" name="website-import"><p>Paste a recipe website link. You can edit the recipe and match its ingredients before saving privately to My Recipes. Video and social links are not supported yet.</p><label>Recipe URL<input name="import-url" type="url" required maxlength="2000" placeholder="https://…"></label><p data-import-status role="status"></p>','Find recipe');
}
async function reviewImportedRecipe(draft){
 const version=sessionVersion,importForm=$('#modal-form');
 const items=await Promise.all(draft.ingredients.map(async raw=>{
  const item=ingredientDraft(raw);let match;
  try{const exact=await exactIngredientMatches(item.name);if(exact.length===1)match=exact[0]}catch{/* The editor still supports manual catalogue matching and retry. */}
  return [match?.canonical_name||item.name,item.quantity,item.unit,item.raw,match?.id||null];
 }));
 if(version!==sessionVersion||!importForm?.isConnected)return;
 await recipeModal(null,{...draft,visibility:'private',ingredients:items,difficulty:'Easy'});
}
document.addEventListener('click',async event=>{
 if(event.target.closest('[data-import-recipe]')){importRecipeModal();return}
 const choose=event.target.closest('[data-import-choice]');if(choose){const form=$('#modal-form');choose.disabled=true;try{await reviewImportedRecipe(form._importChoices[Number(choose.dataset.importChoice)])}finally{choose.disabled=false}return}
 const code=event.target.closest('[data-copy-recipe-code]');if(code){try{await navigator.clipboard.writeText(code.dataset.copyRecipeCode);toast('Recipe code copied')}catch{toast('Could not copy. Select and copy the six-character code.')}return}
 const recipe=event.target.closest('[data-discover-recipe]');if(recipe&&!event.composedPath().some(node=>node.matches?.('.recipe-card-actions,[data-card-save],[data-card-plan],[data-cookbook-add]'))&&!event.target.closest('details,[data-browse-tag],[data-visit-recipe],[data-visit-profile]')){await detail(recipe.dataset.discoverRecipe,'discover');return}
 if(event.target.closest('[data-discover-more]'))loadDiscovery(true);
});
document.addEventListener('keydown',event=>{const card=event.target.closest('[data-discover-recipe]');if(card&&event.target===card&&['Enter',' '].includes(event.key)){event.preventDefault();detail(card.dataset.discoverRecipe,'discover')}});
// Capture import submission so the ordinary recipe save handler only sees the
// completed review form. No recipe/ingredient writes happen during extraction.
document.addEventListener('submit',async event=>{
 if(event.target.id==='discover-search-form'){event.preventDefault();loadDiscovery();return}
 if(event.target.id!=='modal-form'||!event.target.elements['website-import'])return;
 event.preventDefault();event.stopImmediatePropagation();
 const form=event.target,version=sessionVersion,button=form.querySelector('.primary-btn'),status=form.querySelector('[data-import-status]');
 if(button.disabled)return;button.disabled=true;status.textContent='Reading recipe data…';
 try{
  const {data,error}=await supabase.functions.invoke('recipe-import',{body:{url:form.elements['import-url'].value.trim()}});
  if(version!==sessionVersion||!form.isConnected)return;
  if(error){let message;try{message=(await error.context?.json())?.error}catch{}throw new Error(message||'Could not import. Check the website URL and that the recipe-import function is deployed. You can also add the recipe manually.')}
  if(data?.error)throw new Error(data.error);
  if(!data?.recipes?.length)throw new Error('No structured recipe found. Add this recipe manually.');
  if(data.recipes.length===1){status.textContent='Matching ingredients…';await reviewImportedRecipe(data.recipes[0])}
  else{form._importChoices=data.recipes;status.textContent='Choose the recipe you want to review.';const choices=document.createElement('div');choices.className='import-choices';for(const [index,recipe] of data.recipes.entries()){const choice=document.createElement('button');choice.type='button';choice.className='secondary-btn';choice.dataset.importChoice=index;choice.textContent=recipe.name;choices.append(choice)}form.querySelector('.import-choices')?.remove();status.after(choices)}
 }catch(error){if(version===sessionVersion&&form.isConnected)status.textContent=error.message}
 finally{if(form.isConnected)button.disabled=false}
},true);

function recipeOpenOrigin(node){return node.closest('#discover-view')?'discover':node.closest('#tags-view')?'tags':node.closest('#profile-view')?'profile':node.closest('#planner-view')?'planner':'recipes'}
function recipeCommentsSection(recipe){if(recipe.visibility!=='public')return '';return `<section class="panel public-comments"><h2>Comments</h2><p class="quantity-hint">Comments are public. Keep personal cooking notes in your private notes.</p><form id="recipe-comment-form"><input type="hidden" name="recipe-id" value="${escapeHtml(recipe.id)}"><label>Add a public comment<textarea name="body" maxlength="2000" rows="3" required placeholder="Share a tip or ask a question…"></textarea></label><button class="secondary-btn">Post comment</button><p role="status" data-comment-status></p></form><div data-recipe-comments="${escapeHtml(recipe.id)}" aria-live="polite"></div><button type="button" class="text-btn" data-more-comments="${escapeHtml(recipe.id)}" hidden>Load more comments</button></section>`}
function recipeFeedbackColours(recipe){const colours=['#f5cce1','#e5ed66','#cab7fb'].filter(colour=>colour!==recipeColour(recipe));return `--feedback-color:${colours[0]};--comments-color:${colours[1]}`}
function commentsMarkup(posts){return posts.map(post=>{
 const name=post.author||'Cook',lookup=post.username||post.user_id,initials=name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase(),avatar=/^https?:\/\//i.test(post.avatar_url||'')?post.avatar_url:'';
 return `<article class="personal-note-post public-comment"><div class="comment-avatar" aria-hidden="true">${avatar?`<img src="${escapeHtml(avatar)}" alt="" loading="lazy">`:`<span>${escapeHtml(initials||'C')}</span>`}</div><div class="comment-copy"><div class="comment-heading"><div class="comment-meta"><a class="comment-author" href="#/profile/${encodeURIComponent(lookup||'')}" data-visit-profile="${escapeHtml(lookup||'')}" aria-label="View ${escapeHtml(name)} profile">${escapeHtml(name)}</a><span class="comment-separator" aria-hidden="true">·</span><time ${post.created_at?`datetime="${escapeHtml(post.created_at)}" title="${escapeHtml(new Date(post.created_at).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'}))}"`:''}>${escapeHtml(noteTimeLabel(post.created_at))}</time></div>${post.user_id===activeUserId?`<button type="button" class="text-btn feedback-delete" aria-label="Delete comment" title="Delete comment" data-delete-comment="${escapeHtml(post.id)}" data-comment-recipe="${escapeHtml(post.recipe_id)}">${icon('trash2')}</button>`:''}</div><p>${escapeHtml(post.body)}</p></div></article>`;
 }).join('')}
async function loadRecipeComments(id,append=false){
 const version=sessionVersion,feed=document.querySelector('[data-recipe-comments]');if(!feed||feed.dataset.recipeComments!==id)return;
 const offset=append?Number(feed.dataset.count||0):0,request=feed._request=(feed._request||0)+1;
 const {data,error}=await supabase.rpc('get_recipe_comments',{p_id:id,p_offset:offset});
 if(version!==sessionVersion||!feed.isConnected||feed._request!==request)return;
 if(error){feed.textContent='Comments need database update 030_public_recipe_feedback.sql, or could not be loaded.';return}
 const posts=data||[];if(append)feed.insertAdjacentHTML('beforeend',commentsMarkup(posts));else feed.innerHTML=posts.length?commentsMarkup(posts):'<p class="quantity-hint">No comments yet. Share the first tip.</p>';
 feed.dataset.count=offset+posts.length;const more=document.querySelector('[data-more-comments]');if(more)more.hidden=posts.length<30;
}
document.addEventListener('submit',async event=>{
 if(event.target.id!=='recipe-comment-form')return;event.preventDefault();const form=event.target,button=form.querySelector('button'),status=form.querySelector('[data-comment-status]'),version=sessionVersion,data=new FormData(form);if(button.disabled)return;button.disabled=true;status.textContent='Posting…';
 try{const {error}=await supabase.rpc('post_recipe_comment',{p_id:data.get('recipe-id'),p_body:data.get('body'),p_comment_id:form._commentId||=(crypto.randomUUID())});if(version!==sessionVersion||!form.isConnected)return;if(error)throw error;form.reset();form._commentId=null;status.textContent='Comment posted';await loadRecipeComments(data.get('recipe-id'))}catch(error){if(version===sessionVersion&&form.isConnected)status.textContent=`Could not post comment: ${error.message}`}finally{button.disabled=false}
});
document.addEventListener('input',event=>{if(event.target.matches('#recipe-comment-form textarea'))event.target.form._commentId=null});
document.addEventListener('click',async event=>{
 const more=event.target.closest('[data-more-comments]');if(more){more.disabled=true;try{await loadRecipeComments(more.dataset.moreComments,true)}finally{more.disabled=false}return}
 const button=event.target.closest('[data-delete-comment]');if(!button||button.disabled)return;const version=sessionVersion;button.disabled=true;
 try{const {error}=await supabase.from('recipe_comments').delete().eq('id',button.dataset.deleteComment).eq('user_id',activeUserId);if(error)throw error;if(version===sessionVersion)await loadRecipeComments(button.dataset.commentRecipe)}catch(error){if(version===sessionVersion)toast(`Could not delete comment: ${error.message}`)}finally{button.disabled=false}
});

window.addEventListener('focus',()=>{
 if(!activeUserId)return;const version=sessionVersion,snapshot=()=>JSON.stringify(recipes.map(({imageUrl,...recipe})=>recipe)),before=snapshot();
 refreshLibrary().then(()=>{
  if(version!==sessionVersion)return;
  if(before!==snapshot()){
   if(document.querySelector('#recipes-view.active'))recipesView();
   if(document.querySelector('#home-view.active'))home();
   if(document.querySelector('#planner-view.active'))plannerView();
   if(document.querySelector('#shopping-view.active'))shoppingView();
  }
  if(document.querySelector('#detail-view.active')&&currentRecipe&&!ownsRecipe(currentRecipe))detail(currentRecipe.id,detailReturn);
  if(document.querySelector('#profile-view.active')&&!document.querySelector('#profile-form')&&/^#\/profile\//.test(location.hash))openSharedRoute();
 }).catch(error=>toast(error.message));
});

document.addEventListener('input',event=>{if(event.target.matches('#post-cook-feedback-form [name="public-comment"]'))event.target.form._commentId=null;});
