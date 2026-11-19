// AMARYT Admin — email OTP gateway for Cloudflare Workers.
// No administrator email, access token or API key is embedded in these assets.
// Requires D1 database + four Worker secrets, see README.md.

const SESSION_TTL = 4 * 60 * 60;
const OTP_TTL = 5 * 60;
const COOKIE_SESSION = "amaryt_session";
const COOKIE_CHALLENGE = "amaryt_challenge";
const encoder = new TextEncoder();

const LOGIN_HTML = String.raw`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AMARYT Admin | دخول محمي</title><meta name="robots" content="noindex,nofollow"><style>
:root{color-scheme:dark;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,Arial,sans-serif}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(ellipse at 50% 0%,#1d3d5c 0%,#08101e 60%,#050b15);color:#eff9ff;padding:20px}
main{width:min(450px,100%);padding:35px 28px;border-radius:23px;background:#101f32;border:1px solid #38526a;box-shadow:0 20px 70px #0006}
h1{margin:0 0 9px;font-size:28px}p{color:#9bb3c8;font-size:15px;line-height:1.9}.logo{display:grid;place-items:center;margin-bottom:24px;background:linear-gradient(125deg,#50e2d4,#639bee);width:55px;height:55px;border-radius:17px;color:#092131;font-size:34px;font-weight:900}
button,input{font:inherit;width:100%;padding:14px 15px;border-radius:13px}button{border:0;background:linear-gradient(120deg,#48dacc,#69a6ee);color:#061a29;font-weight:800;cursor:pointer;margin-top:13px}button:disabled{opacity:.5;cursor:wait}input{color:#fff;background:#0b1525;border:1px solid #35526c;direction:ltr;text-align:center;letter-spacing:10px;font-size:23px}input:focus{outline:2px solid #42d8c6}
#verifyForm{margin-top:23px}#feedback{min-height:30px;font-size:13px;margin-top:12px;color:#a7efda}.meta{font-size:12px;color:#788ba0;margin-top:20px}.hidden{display:none}
</style><script src="/signin.js" defer></script></head><body><main><div class="logo">A</div><h1>لوحة AMARYT محمية</h1><p>الدخول مقتصر على مدير المتجر. اضغط لإرسال رمز تحقق إلى إيميل الأدمن المسجّل. لن نعرض عنوان البريد الإلكتروني.</p><form id="sendForm"><button type="submit" id="sendBtn">إرسال الرمز إلى إيميل الأدمن</button></form><form id="verifyForm" class="hidden"><label for="code">أدخل الرمز المكوّن من 6 أرقام</label><input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required><button type="submit" id="verifyBtn">تأكيد الرمز والدخول</button></form><div id="feedback" role="status" aria-live="polite"></div><div class="meta">🔐 رمز مؤقت، جلسة آمنة، ومحاولات دخول محدودة</div></main></body></html>`;

const SIGNIN_JS = String.raw`const sendForm=document.getElementById('sendForm');
const verifyForm=document.getElementById('verifyForm');
const feedback=document.getElementById('feedback');
const sendBtn=document.getElementById('sendBtn');
const verifyBtn=document.getElementById('verifyBtn');
const code=document.getElementById('code');
async function post(path,body){
  const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(body)});
  let data={};try{data=await response.json()}catch{}
  if(!response.ok)throw new Error(data.message||'تعذر تنفيذ العملية. حاول مجددًا.');
  return data;
}
sendForm.addEventListener('submit',async(event)=>{
 event.preventDefault();sendBtn.disabled=true;feedback.textContent='جارٍ إرسال الرمز…';
 try{await post('/auth/request',{});feedback.textContent='تم إرسال كود إلى إيميل الأدمن. أدخله للمتابعة.';verifyForm.classList.remove('hidden');code.focus()}
 catch(err){feedback.textContent=err.message}
 finally{sendBtn.disabled=false}
});
verifyForm.addEventListener('submit',async(event)=>{
 event.preventDefault();verifyBtn.disabled=true;feedback.textContent='جارٍ التحقق…';
 try{await post('/auth/verify',{code:code.value});feedback.textContent='تم التحقق. جاري فتح لوحة الإدارة…';window.location.replace('/')}
 catch(err){feedback.textContent=err.message;code.value='';code.focus()}
 finally{verifyBtn.disabled=false}
});`;

function randomID(length = 32) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, "0")).join("");
}
function currentTime() { return Math.floor(Date.now() / 1000); }
function parseCookies(request) {
  const result = new Map();
  for (const chunk of (request.headers.get("Cookie") || "").split(";")) {
    const index = chunk.indexOf("=");
    if (index > 0) result.set(chunk.slice(0, index).trim(), chunk.slice(index + 1).trim());
  }
  return result;
}
function cookie(name, value, seconds) {
  return name + "=" + value + "; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=" + seconds;
}
function withHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://raw.githubusercontent.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  return new Response(response.body, {status: response.status, headers});
}
function responseText(text, status = 200, type = "text/html; charset=utf-8") {
  return withHeaders(new Response(text, {status, headers: {"Content-Type": type}}));
}
function responseJSON(data, status = 200, extraHeaders = {}) {
  return withHeaders(new Response(JSON.stringify(data), {
    status, headers: {"Content-Type": "application/json; charset=utf-8", ...extraHeaders}
  }));
}
function redirect(path, headers = {}) {
  return withHeaders(new Response(null, {status: 303, headers: {Location: path, ...headers}}));
}
async function hmac(env, value) {
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(env.OTP_SECRET), {name: "HMAC", hash: "SHA-256"}, false, ["sign"]
  );
  const signed = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
  return Array.from(signed, b => b.toString(16).padStart(2, "0")).join("");
}
function safeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function realIP(request) {
  // CF-Connecting-IP is inserted by the Cloudflare edge. Ignore browser IP headers.
  return request.headers.get("CF-Connecting-IP") || "unknown";
}
async function throttle(db, key, max, period, now) {
  const row = await db.prepare(
    "INSERT INTO rate_limits (key, count, reset_at) VALUES (?1, 1, ?2) " +
    "ON CONFLICT(key) DO UPDATE SET count = CASE WHEN rate_limits.reset_at <= ?3 THEN 1 ELSE rate_limits.count+1 END, " +
    "reset_at = CASE WHEN rate_limits.reset_at <= ?3 THEN ?2 ELSE rate_limits.reset_at END " +
    "RETURNING count"
  ).bind(key, now + period, now).first();
  return row && Number(row.count) <= max;
}
async function activeSession(request, env) {
  const token = parseCookies(request).get(COOKIE_SESSION);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const digest = await hmac(env, "session:" + token);
  const row = await env.DB.prepare("SELECT expires_at FROM sessions WHERE id = ?").bind(digest).first();
  return !!row && Number(row.expires_at) > currentTime();
}
async function postJSON(request) {
  if (request.headers.get("Origin") !== new URL(request.url).origin) throw new Error("origin");
  if (!(request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json")) throw new Error("content");
  if (Number(request.headers.get("Content-Length") || 0) > 4096) throw new Error("size");
  const text = await request.text();
  if (text.length > 4096) throw new Error("size");
  return JSON.parse(text);
}
async function sendCode(request, env) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM || !env.ADMIN_EMAIL || !env.OTP_SECRET || !env.DB)
    return responseJSON({message:"خدمة التحقق غير مهيأة بعد."},503);
  const now = currentTime();
  const ipKey = await hmac(env, "ip:" + realIP(request));
  const allowedIP = await throttle(env.DB, "send:" + ipKey, 3, 600, now);
  const allowedGlobal = await throttle(env.DB, "send:global", 25, 3600, now);
  if (!allowedIP || !allowedGlobal) return responseJSON({message:"طلبات كثيرة. حاول بعد عدة دقائق."},429);
  const id = randomID(16);
  const number = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  const code = String(number).padStart(6, "0");
  const hash = await hmac(env, "otp:" + id + ":" + code);
  await env.DB.prepare(
    "INSERT INTO challenges (id, code_hash, expires_at, attempts) VALUES (?1,?2,?3,0)"
  ).bind(id, hash, now + OTP_TTL).run();

  const mail = await fetch("https://api.resend.com/emails", {
    method:"POST",
    headers:{"Authorization":"Bearer " + env.RESEND_API_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({
      from:env.RESEND_FROM, to:[env.ADMIN_EMAIL],
      subject:"رمز دخول AMARYT Admin",
      text:"رمز الدخول المؤقت إلى AMARYT Admin: " + code +
           "
صالح لمدة خمس دقائق. إذا لم تطلبه، تجاهل الرسالة."
    })
  }).catch(() => null);
  if (!mail || !mail.ok) {
    await env.DB.prepare("DELETE FROM challenges WHERE id = ?").bind(id).run();
    return responseJSON({message:"تعذر إرسال الرمز حاليًا. تحقق من إعدادات البريد."},503);
  }
  return responseJSON({message:"تم إرسال الرمز إلى بريد الأدمن."},200,{
    "Set-Cookie": cookie(COOKIE_CHALLENGE,id,OTP_TTL)
  });
}
async function verifyCode(request, env, data) {
  const now=currentTime();
  const ipKey=await hmac(env,"ip:"+realIP(request));
  if (!await throttle(env.DB,"verify:"+ipKey,12,600,now))
    return responseJSON({message:"محاولات كثيرة. حاول لاحقًا."},429);
  const code=data && data.code;
  const id=parseCookies(request).get(COOKIE_CHALLENGE);
  if (typeof code!=="string" || !/^[0-9]{6}$/.test(code) || !id || !/^[a-f0-9]{32}$/.test(id))
    return responseJSON({message:"رمز غير صالح أو انتهت صلاحية الطلب."},400);
  const row=await env.DB.prepare(
    "UPDATE challenges SET attempts=attempts+1 WHERE id=?1 AND expires_at>?2 AND attempts<5 " +
    "RETURNING code_hash,attempts"
  ).bind(id,now).first();
  if (!row) return responseJSON({message:"انتهت صلاحية الرمز أو تجاوزت المحاولات."},400);
  const suppliedHash=await hmac(env,"otp:"+id+":"+code);
  if (!safeCompare(row.code_hash,suppliedHash))
    return responseJSON({message:"الرمز غير صحيح."},401);
  await env.DB.prepare("DELETE FROM challenges WHERE id=?").bind(id).run();
  const sessionToken=randomID(32);
  const sessionDigest=await hmac(env,"session:"+sessionToken);
  await env.DB.prepare("INSERT INTO sessions (id,expires_at) VALUES (?1,?2)")
    .bind(sessionDigest,now+SESSION_TTL).run();
  const headers=new Headers({"Content-Type":"application/json"});
  headers.append("Set-Cookie",cookie(COOKIE_SESSION,sessionToken,SESSION_TTL));
  headers.append("Set-Cookie",cookie(COOKIE_CHALLENGE,"",0));
  return withHeaders(new Response(JSON.stringify({ok:true}),{status:200,headers}));
}
async function logout(request, env) {
  const token=parseCookies(request).get(COOKIE_SESSION);
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    await env.DB.prepare("DELETE FROM sessions WHERE id=?")
      .bind(await hmac(env,"session:"+token)).run();
  }
  return redirect("/signin",{"Set-Cookie":cookie(COOKIE_SESSION,"",0)});
}

export default {
  async fetch(request, env) {
    try {
      const url=new URL(request.url);
      const path=url.pathname;
      if (request.method==="GET" && path==="/signin") {
        if (await activeSession(request,env)) return redirect("/");
        return responseText(LOGIN_HTML);
      }
      if (request.method==="GET" && path==="/signin.js")
        return responseText(SIGNIN_JS,200,"text/javascript; charset=utf-8");
      if (request.method==="POST" && (path==="/auth/request" || path==="/auth/verify" || path==="/auth/logout")) {
        let data;
        try { data=await postJSON(request); } catch {
          return responseJSON({message:"طلب غير صالح."},400);
        }
        if (path==="/auth/request") return await sendCode(request,env);
        if (path==="/auth/verify") return await verifyCode(request,env,data);
        return await logout(request,env);
      }
      if (!await activeSession(request,env)) {
        if (request.method==="GET" || request.method==="HEAD") return redirect("/signin");
        return responseJSON({message:"الجلسة غير مصرح بها."},401);
      }
      if (request.method!=="GET" && request.method!=="HEAD")
        return responseJSON({message:"غير مسموح."},405);
      const asset=await env.ASSETS.fetch(request);
      return withHeaders(asset);
    } catch (err) {
      console.error("AMARYT authentication error",err && err.name);
      return responseJSON({message:"حدث خطأ داخلي. حاول لاحقًا."},500);
    }
  }
};
