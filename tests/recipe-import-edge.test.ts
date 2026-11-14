// Run with Deno: this captures the handler and stubs Auth; no server or real
// Supabase project is contacted. Import transport is separately smoke-tested.
Deno.test('import handler authenticates before fetching and handles bounded requests',async()=>{
 const realServe=Deno.serve,realFetch=globalThis.fetch;
 const oldUrl=Deno.env.get('SUPABASE_URL'),oldKey=Deno.env.get('SUPABASE_ANON_KEY');
 let handler:((request:Request)=>Promise<Response>)|undefined,authCalls=0,authorized=true;
 const check=(value:unknown,message:string)=>{if(!value)throw new Error(message)};
 try{
  Deno.env.set('SUPABASE_URL','https://fixture.supabase.co');Deno.env.set('SUPABASE_ANON_KEY','fixture-key');
  Deno.serve=((fn:typeof handler)=>{handler=fn}) as unknown as typeof Deno.serve;
  globalThis.fetch=(async(input:RequestInfo|URL)=>{
   check(String(input).startsWith('https://fixture.supabase.co/auth/v1/user'),'Only fixture Auth may be contacted');authCalls++;
   return new Response(JSON.stringify(authorized?{id:'00000000-0000-0000-0000-000000000001',aud:'authenticated'}:{message:'Invalid JWT'}),{status:authorized?200:401,headers:{'Content-Type':'application/json'}});
  }) as typeof fetch;
  await import('../supabase/functions/recipe-import/index.ts');
  check(handler,'Handler registered');const call=handler!;
  let response=await call(new Request('https://fixture/import',{method:'OPTIONS'}));check(response.status===200,'CORS preflight');
  response=await call(new Request('https://fixture/import',{method:'POST',body:'{}'}));check(response.status===401&&authCalls===0,'Anonymous requests stop before Auth/outbound fetching');
  authorized=false;
  response=await call(new Request('https://fixture/import',{method:'POST',headers:{Authorization:'Bearer invalid'},body:'{}'}));check(response.status===401,'Invalid user token rejected');
  authorized=true;
  const request=(body:string)=>new Request('https://fixture/import',{method:'POST',headers:{Authorization:'Bearer fixture-user'},body});
  response=await call(request(JSON.stringify({url:'http://127.0.0.1/private'})));check(response.status===400,'Private/non-HTTPS URL rejected');
  response=await call(request(JSON.stringify({url:'https://instagram.com/recipe'})));check(response.status===400,'Social link rejected');
  response=await call(request('a'.repeat(5000)));check(response.status===413,'Request body bounded');
  response=await call(request('{bad json'));check(response.status===400,'Malformed body is recoverable');
  check(response.headers.get('cache-control')==='no-store','Import responses are not cached');
 }finally{
  Deno.serve=realServe;globalThis.fetch=realFetch;
  for(const [name,value] of [['SUPABASE_URL',oldUrl],['SUPABASE_ANON_KEY',oldKey]]){if(value===undefined)Deno.env.delete(name!);else Deno.env.set(name!,value)}
 }
});
