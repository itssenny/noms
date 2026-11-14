import {resolve4} from 'node:dns/promises';

export function websiteUrl(value){
 let url;try{url=new URL(value)}catch{throw new Error('Enter a valid recipe website URL.')}
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.hostname.length>253||!url.hostname.includes('.')||/[\[\]:]/.test(url.hostname)||/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)||/\.(?:local|localhost|internal|test|invalid)$/i.test(url.hostname))throw new Error('Use a public HTTPS recipe website with its standard port.');
 if(/(^|\.)(?:tiktok\.com|instagram\.com|facebook\.com|youtu\.be|youtube\.com)$/i.test(url.hostname))throw new Error('Video and social links are not supported yet. Use the recipe website link instead.');
 url.hash='';return url;
}
export function publicIPv4(ip){
 if(!/^\d+\.\d+\.\d+\.\d+$/.test(ip))return false;
 const [a,b,c,d]=ip.split('.').map(Number);if([a,b,c,d].some(x=>x>255))return false;
 return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0||b===2))||(a===198&&(b===18||b===19||b===51&&c===100))||(a===203&&b===0&&c===113));
}
const decoder=new TextDecoder(),MAX_BODY=2*1024*1024,MAX_WIRE=3*1024*1024,MAX_HEADERS=32768;
function headerEnd(bytes){for(let i=0;i<bytes.length-3;i++)if(bytes[i]===13&&bytes[i+1]===10&&bytes[i+2]===13&&bytes[i+3]===10)return i;return -1}
function headers(bytes){
 const end=headerEnd(bytes);if(end<0){if(bytes.length>MAX_HEADERS)throw new Error('Website headers are too large.');return null}
 if(end>MAX_HEADERS)throw new Error('Website headers are too large.');
 const lines=decoder.decode(bytes.subarray(0,end)).split('\r\n'),status=/^HTTP\/1\.[01] (\d{3})(?: |$)/.exec(lines.shift());
 if(!status)throw new Error('The website returned an invalid HTTP response.');
 const fields=Object.create(null);
 for(const line of lines){const match=/^([!#$%&'*+.^_`|~\w-]+):\s*(.*)$/.exec(line);if(!match)throw new Error('The website returned invalid headers.');const key=match[1].toLowerCase();if(fields[key]&&['content-length','transfer-encoding'].includes(key))throw new Error('The website returned ambiguous headers.');fields[key]=match[2]}
 return {status:Number(status[1]),fields,start:end+4};
}
export function parseWebsiteResponse(bytes){
 let head=headers(bytes);if(!head)throw new Error('The website returned incomplete headers.');
 // HTTP/1.1 may send early hints before its final response.
 while(head.status>=100&&head.status<200){bytes=bytes.subarray(head.start);head=headers(bytes);if(!head)throw new Error('The website returned an incomplete response.')}
 const h=head.fields;
 if([301,302,303,307,308].includes(head.status))return {redirect:h.location};
 if(head.status!==200)throw new Error('This website could not be read. Try another recipe URL or add it manually.');
 if(!/^(text\/html|application\/xhtml\+xml)(?:;|$)/i.test(h['content-type']||'')||h['content-encoding']&&!/^identity$/i.test(h['content-encoding']))throw new Error('The website did not return a readable HTML page.');
 let body=bytes.subarray(head.start);
 if(h['transfer-encoding']){
  if(h['transfer-encoding'].toLowerCase()!=='chunked'||h['content-length'])throw new Error('The website returned an unsupported transfer format.');
  const chunks=[];let offset=0,size=0;
  for(;;){
   let end=offset;while(end<body.length-1&&!(body[end]===13&&body[end+1]===10))end++;
   const line=decoder.decode(body.subarray(offset,end));if(!/^[0-9a-f]+(?:;[^\r\n]*)?$/i.test(line))throw new Error('The website returned an invalid response chunk.');
   const length=parseInt(line.split(';')[0],16);if(!Number.isSafeInteger(length))throw new Error('Invalid response size.');
   if(length===0){if(end+3>=body.length||body[body.length-2]!==13||body[body.length-1]!==10)throw new Error('The website returned an incomplete response.');break;}
   offset=end+2;size+=length;if(size>MAX_BODY)throw new Error('This recipe page is too large to import.');
   if(offset+length+2>body.length||body[offset+length]!==13||body[offset+length+1]!==10)throw new Error('The website returned an incomplete response.');
   chunks.push(body.subarray(offset,offset+length));offset+=length+2;
  }
  body=new Uint8Array(size);let position=0;for(const chunk of chunks){body.set(chunk,position);position+=chunk.length}
 }else if(h['content-length']){
  if(!/^\d+$/.test(h['content-length'])||Number(h['content-length'])!==body.length)throw new Error('The website returned an incomplete response.');
 }
 if(body.length>MAX_BODY)throw new Error('This recipe page is too large to import.');
 return {html:decoder.decode(body)};
}
// Deno's node:https client does not implement custom DNS lookup. Open TCP to
// the validated address, then use the original hostname for TLS verification.
// HTTP/1.1 + Connection: close keeps transport bounded without a browser engine.
async function get(url,address,signal){
 let connection;
 const abort=()=>{try{connection?.close()}catch{/* Already closed. */}};
 signal.addEventListener('abort',abort,{once:true});
 try{
  connection=await Deno.connect({hostname:address,port:443});
  if(signal.aborted)throw new Error('Import timed out.');
  connection=await Deno.startTls(connection,{hostname:url.hostname,alpnProtocols:['http/1.1']});
  if(signal.aborted)throw new Error('Import timed out.');
  const request=new TextEncoder().encode(`GET ${url.pathname+url.search} HTTP/1.1\r\nHost: ${url.hostname}\r\nAccept: text/html,application/xhtml+xml\r\nAccept-Encoding: identity\r\nUser-Agent: noms-recipe-import/1.0\r\nConnection: close\r\n\r\n`);
  let written=0;while(written<request.length)written+=await connection.write(request.subarray(written));
  const chunks=[];let size=0;
  for(;;){const buffer=new Uint8Array(32768),read=await connection.read(buffer);if(read===null)break;size+=read;if(size>MAX_WIRE)throw new Error('This recipe page is too large to import.');chunks.push(buffer.subarray(0,read))}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  return parseWebsiteResponse(bytes);
 }finally{signal.removeEventListener('abort',abort);abort()}
}
async function withDeadline(promise,signal){
 if(signal.aborted)throw new Error('Import timed out.');
 let abort;const deadline=new Promise((_,reject)=>{abort=()=>reject(new Error('Import timed out.'));signal.addEventListener('abort',abort,{once:true})});
 try{return await Promise.race([promise,deadline])}finally{signal.removeEventListener('abort',abort)}
}
export async function fetchWebsite(value,{resolve=resolve4,load=get,signal=AbortSignal.timeout(12000)}={}){
 let url=websiteUrl(value);
 for(let hop=0;hop<4;hop++){
  const addresses=await withDeadline(resolve(url.hostname),signal);
  if(!addresses.length||!addresses.every(publicIPv4))throw new Error('This website address is not supported.');
  const result=await withDeadline(load(url,addresses[0],signal),signal);
  if(result.html!==undefined)return {html:result.html,url:url.href};
  if(!result.redirect)throw new Error('The website returned an invalid redirect.');
  url=websiteUrl(new URL(result.redirect,url).href);
 }
 throw new Error('Too many redirects. Use the final recipe website URL.');
}
