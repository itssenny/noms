import test from 'node:test';
import assert from 'node:assert/strict';
import {extractRecipes,ingredientDraft,minutes,plain} from '../supabase/functions/_shared/recipe-import.mjs';
import {websiteUrl,publicIPv4,fetchWebsite} from '../supabase/functions/_shared/website-fetch.mjs';
const recipe={ '@type':['Thing','Recipe'],name:'Miso &amp; rice',recipeYield:'2 servings',totalTime:'PT25M',recipeIngredient:['140 g Rice','1½ tbsp Soy sauce'],recipeInstructions:[{'@type':'HowToSection',itemListElement:[{'@type':'HowToStep',text:'<p>Cook rice.</p>'}]},{'@type':'HowToStep',text:'Serve.'}]};
const script=value=>`<script type="application/ld+json">${JSON.stringify(value)}</script>`;
test('extracts nested JSON-LD arrays/graphs and HowToSections without executing HTML',()=>{
 const result=extractRecipes('<script type="application/ld+json">bad json</script>'+script({'@graph':[recipe]})+script([recipe]),'https://recipes.example/bowl');
 assert.equal(result.length,1);assert.equal(result[0].name,'Miso & rice');assert.equal(result[0].servings,2);assert.equal(result[0].time,25);assert.deepEqual(result[0].steps,['Cook rice.','Serve.']);assert.equal(result[0].source,'https://recipes.example/bowl');
});
test('handles string instructions, multiple recipes, missing times and ambiguous yields honestly',()=>{
 const found=extractRecipes(script([{...recipe,recipeYield:'12 cookies',totalTime:undefined,recipeInstructions:'Mix.\nBake.'},{...recipe,name:'Other'}]),'https://example.com');
 assert.equal(found.length,2);assert.equal(found[0].time,null);assert.equal(found[0].servings,null);assert.equal(found[0].yieldText,'12 cookies');assert.deepEqual(found[0].steps,['Mix.','Bake.']);
 assert.deepEqual(extractRecipes(script({...recipe,recipeIngredient:[]}),''),[]);
 assert.deepEqual(extractRecipes('<script>alert(1)</script><h1>Recipe</h1>',''),[]);
 assert.equal(minutes('PT1H30M'),90);assert.equal(minutes('PT45S'),1);assert.equal(minutes('P1D'),1440);assert.equal(minutes('25 minutes'),null);
 assert.equal(plain('&#x1F35C; &quot;Rice&quot;'),'🍜 "Rice"');
});
test('ingredient parsing preserves uncertain lines instead of guessing package sizes or units',()=>{
 assert.deepEqual(ingredientDraft('140 g Rice, rinsed'),{name:'Rice',quantity:140,unit:'g',raw:'140 g Rice, rinsed'});
 assert.equal(ingredientDraft('1½ tbsp Soy sauce').quantity,1.5);
 assert.equal(ingredientDraft('1/4 cup cream').quantity,.25);
 for(const raw of ['1-2 tbsp oil','1 can (400 g) tomatoes','Salt to taste','one handful basil'])assert.equal(ingredientDraft(raw).quantity,null);
});
test('URL and address checks reject local, credentialed, non-HTTPS and social targets',()=>{
 for(const url of ['http://example.com','https://user:pass@example.com','https://127.0.0.1','https://[::1]','https://foo.local','https://example.com:8443','https://www.tiktok.com/a','https://instagram.com/a'])assert.throws(()=>websiteUrl(url));
 for(const ip of ['0.0.0.0','10.0.0.1','127.0.0.1','169.254.169.254','172.16.0.1','192.168.1.1','100.64.0.1','198.18.0.1','224.0.0.1','::ffff:127.0.0.1'])assert.equal(publicIPv4(ip),false,ip);
 assert.equal(publicIPv4('93.184.216.34'),true);
});
test('pins validated DNS addresses and validates every redirect before the next fetch',async()=>{
 const calls=[];const result=await fetchWebsite('https://recipes.example/start',{resolve:async()=>['93.184.216.34'],load:async(url,address)=>{calls.push([url.href,address]);return calls.length===1?{redirect:'/final'}:{html:'ok'}}});
 assert.deepEqual(result,{url:'https://recipes.example/final',html:'ok'});assert.equal(calls[0][1],'93.184.216.34');
 let loads=0;await assert.rejects(fetchWebsite('https://recipes.example',{resolve:async()=>['127.0.0.1'],load:async()=>{loads++}}),/not supported/);assert.equal(loads,0);
 await assert.rejects(fetchWebsite('https://recipes.example',{resolve:async()=>['93.184.216.34'],load:async()=>({redirect:'https://127.0.0.1/admin'})}),/public HTTPS/);
 await assert.rejects(fetchWebsite('https://recipes.example',{resolve:async()=>['93.184.216.34'],load:async()=>({redirect:'/loop'})}),/Too many redirects/);
});

test('bounded HTTP/1.1 decoder accepts content length, chunked UTF-8 and early hints; rejects bad/truncated bodies',async()=>{
 const {parseWebsiteResponse}=await import('../supabase/functions/_shared/website-fetch.mjs');
 const bytes=text=>new TextEncoder().encode(text);
 const header='HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n';
 assert.equal(parseWebsiteResponse(bytes(header+'Content-Length: 5\r\n\r\nHello')).html,'Hello');
 assert.equal(parseWebsiteResponse(bytes(header+'Transfer-Encoding: chunked\r\n\r\n3\r\nHi!\r\n0\r\n\r\n')).html,'Hi!');
 assert.equal(parseWebsiteResponse(bytes('HTTP/1.1 103 Early Hints\r\nLink: </x>\r\n\r\n'+header+'\r\nHello')).html,'Hello');
 assert.deepEqual(parseWebsiteResponse(bytes('HTTP/1.1 302 Found\r\nLocation: /recipe\r\n\r\n')),{redirect:'/recipe'});
 for(const response of [header+'Content-Length: 8\r\n\r\nHello',header+'Transfer-Encoding: chunked\r\n\r\n8\r\nHi!\r\n',header+'Content-Encoding: gzip\r\n\r\nzip',header+'Transfer-Encoding: chunked\r\nContent-Length: 3\r\n\r\nabc',header+'Transfer-Encoding: chunked\r\n\r\n300000\r\n', 'HTTP/1.1 403 Forbidden\r\n\r\n'])assert.throws(()=>parseWebsiteResponse(bytes(response)));
 assert.throws(()=>parseWebsiteResponse(bytes(header+'\r\n'+'a'.repeat(2*1024*1024+1))),/too large/);
});

test('imports preserve original cups, use explicit metric totals for composites and keep eggs honest',()=>{
 assert.deepEqual(ingredientDraft('2 cups + 3 Tablespoons (265g) all-purpose flour'),{name:'all-purpose flour',quantity:265,unit:'g',raw:'2 cups + 3 Tablespoons (265g) all-purpose flour'});
 assert.equal(ingredientDraft('¾ cup (180g) unsalted butter, melted and slightly cooled').name,'unsalted butter');
 assert.equal(ingredientDraft('¾ cup (135g) light brown sugar').quantity,.75);
 assert.equal(ingredientDraft('1/3 cup (70g) granulated sugar').quantity,1/3);
 assert.equal(ingredientDraft('1 cup (175g) white chocolate chips').quantity,1);
 assert.deepEqual(ingredientDraft('2 eggs'),{name:'eggs',quantity:2,unit:'piece',raw:'2 eggs'});
 assert.equal(ingredientDraft('1 large egg + 1 yolk').name,'egg');
 assert.equal(ingredientDraft('1 large egg + 1 yolk').quantity,null);
 assert.equal(ingredientDraft('1 can (400 g) tomatoes').quantity,null);
});
