import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import {extractRecipes} from '../_shared/recipe-import.mjs';
import {fetchWebsite} from '../_shared/website-fetch.mjs';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
Deno.serve(async request=>{
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(request.method==='OPTIONS')return new Response(null,{headers:cors});
 if(request.method!=='POST')return reply({error:'Use POST.'},405);
 const token=request.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');
 if(!token)return reply({error:'Please sign in again.'},401);
 const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')||Object.values(JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}'))[0] as string,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const {data,error}=await client.auth.getUser(token);
 if(error||!data.user)return reply({error:'Please sign in again.'},401);
 try{
  // Read the request with a bound, including requests without Content-Length.
  const reader=request.body?.getReader();if(!reader)return reply({error:'Enter a recipe URL.'},400);
  let bytes=0,body='';const decoder=new TextDecoder();
  for(;;){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>4096){await reader.cancel();return reply({error:'Request too large.'},413)}body+=decoder.decode(value,{stream:true})}
  body+=decoder.decode();const input=JSON.parse(body);
  if(typeof input.url!=='string'||input.url.length>2000)return reply({error:'Enter a recipe URL.'},400);
  const page=await fetchWebsite(input.url);
  const recipes=extractRecipes(page.html,page.url);
  if(!recipes.length)return reply({error:'No complete structured recipe was found. This site may block imports or omit recipe data. You can add the recipe manually.'},422);
  return reply({recipes});
 }catch(error){return reply({error:error instanceof Error?error.message:'Could not import this website.'},400)}
});
