import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";

class FakeD1 {
  constructor(){this.challenges=new Map();this.sessions=new Map();this.rates=new Map();}
  prepare(sql){
    const db=this;
    return {bind(...values){
      const [a,b,c]=values;
      return {
        async first(){
          if(sql.startsWith("INSERT INTO rate_limits")){
            const old=db.rates.get(a);const count=!old||old.reset<=c?1:old.count+1;
            db.rates.set(a,{count,reset:!old||old.reset<=c?b:old.reset});
            return {count};
          }
          if(sql.startsWith("UPDATE challenges SET attempts")){
            const item=db.challenges.get(a);
            if(!item||item.expires<=b||item.attempts>=5)return null;
            item.attempts++;
            return {code_hash:item.hash,attempts:item.attempts};
          }
          if(sql.startsWith("SELECT expires_at FROM sessions")){
            const item=db.sessions.get(a);return item?{expires_at:item}:null;
          }
          throw new Error("Unexpected first SQL:"+sql);
        },
        async run(){
          if(sql.startsWith("INSERT INTO challenges")){
            db.challenges.set(a,{hash:b,expires:c,attempts:0});return{};
          }
          if(sql.startsWith("DELETE FROM challenges")){
            db.challenges.delete(a);return{};
          }
          if(sql.startsWith("INSERT INTO sessions")){
            db.sessions.set(a,b);return{};
          }
          if(sql.startsWith("DELETE FROM sessions")){
            db.sessions.delete(a);return{};
          }
          throw new Error("Unexpected run SQL:"+sql);
        }
      };
    }};
  }
}
const origin="https://private-admin.example.test";
const request=(path,method="GET",data=null,cookies="")=>new Request(origin+path,{
  method,headers:{"Origin":origin,...(method==="POST"?{"Content-Type":"application/json"}:{}),...(cookies?{"Cookie":cookies}:{})},
  ...(method==="POST"?{body:JSON.stringify(data??{})}:{})
});
const fixture=()=>({
  DB:new FakeD1(), ADMIN_EMAIL:"secret-admin@example.org", OTP_SECRET:"replace-this-long-secret-in-production",
  RESEND_API_KEY:"test_key", RESEND_FROM:"no-reply@example.org",
  ASSETS:{fetch:async()=>new Response("CONFIDENTIAL ADMIN UI",{status:200,headers:{"Content-Type":"text/html"}})}
});

test("unauthenticated users never receive dashboard, script or app data",async()=>{
  const env=fixture();
  for(const path of ["/","/app.js","/styles.css"]){
    const response=await worker.fetch(request(path),env);
    assert.equal(response.status,303);
    assert.equal(response.headers.get("Location"),"/signin");
    assert.equal(response.headers.get("Cache-Control").includes("no-store"),true);
  }
});

test("sign-in page never reveals administrator email",async()=>{
  const env=fixture();
  const response=await worker.fetch(request("/signin"),env);
  assert.equal(response.status,200);
  const html=await response.text();
  assert.ok(html.includes("إيميل الأدمن"));
  assert.equal(html.includes(env.ADMIN_EMAIL),false);
});

test("server sends OTP only to secret email and authenticates a short-lived session",async()=>{
  const env=fixture();
  const originalFetch=globalThis.fetch;
  let sent=null;
  try {
    globalThis.fetch=async(url,init)=>{
      assert.equal(url,"https://api.resend.com/emails");
      sent=JSON.parse(init.body);
      return new Response('{"id":"sent"}',{status:200,headers:{"Content-Type":"application/json"}});
    };
    const start=await worker.fetch(request("/auth/request","POST",{}),env);
    assert.equal(start.status,200);
    assert.deepEqual(sent.to,[env.ADMIN_EMAIL]);
    assert.equal((await start.text()).includes(env.ADMIN_EMAIL),false);
    const challengeCookie=start.headers.get("set-cookie").split(";")[0];
    assert.ok(challengeCookie.startsWith("amaryt_challenge="));
    const wrong=await worker.fetch(request("/auth/verify","POST",{code:"999999"},challengeCookie),env);
    assert.equal(wrong.status,401);
    const code=sent.text.match(/[0-9]{6}/)[0];
    const confirmed=await worker.fetch(request("/auth/verify","POST",{code},challengeCookie),env);
    assert.equal(confirmed.status,200);
    const sessionCookie=confirmed.headers.getSetCookie().find(x=>x.startsWith("amaryt_session=")).split(";")[0];
    assert.ok(sessionCookie);
    const panel=await worker.fetch(request("/app.js","GET",null,sessionCookie),env);
    assert.equal(panel.status,200);
    assert.equal(await panel.text(),"CONFIDENTIAL ADMIN UI");
    const logout=await worker.fetch(request("/auth/logout","POST",{},sessionCookie),env);
    assert.equal(logout.status,303);
    const invalid=await worker.fetch(request("/app.js","GET",null,sessionCookie),env);
    assert.equal(invalid.status,303);
  }finally {globalThis.fetch=originalFetch;}
});

test("invalid origin and missing email provider are rejected",async()=>{
  const env=fixture(); env.RESEND_API_KEY="";
  const start=await worker.fetch(request("/auth/request","POST",{}),env);
  assert.equal(start.status,503);
  const other=new Request(origin+"/auth/request",{method:"POST",headers:{
    "Origin":"https://attacker.example","Content-Type":"application/json"},body:"{}"});
  const rejected=await worker.fetch(other,env);
  assert.equal(rejected.status,400);
});
