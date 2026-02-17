#!/usr/bin/env node
/**
 * Glitch Dashboard v3 - Cross-platform System Management
 * Supports: Windows, macOS, Linux
 */

const http=require('http'),fs=require('fs'),path=require('path'),{exec}=require('child_process'),os=require('os');
const PORT=process.env.GLITCH_PORT||3853;
const PLATFORM=os.platform();

const isWin=PLATFORM==='win32',isMac=PLATFORM==='darwin',isLinux=PLATFORM==='linux';

async function execCmd(cmd,t=3000){
  return new Promise(r=>{
    exec(cmd,{timeout:t,shell:true,windowsHide:isWin},(e,so,se)=>r({out:so?.trim()||'',err:se?.trim()||'',code:e?.code||0}));
  });
}

async function getData(){
  const[sys,zt,mihomo,tokens,tasks]=await Promise.all([
    (async()=>{
      const cpus=os.cpus();let ti=0,tt=0;
      for(const c of cpus){for(const k in c.times)tt+=c.times[k];ti+=c.times.idle}
      const u=100-ti/tt*100,mb=b=>b>1e9?(b/1e9).toFixed(1)+'GB':(b/1e6|0)+'MB';
      const tm=os.totalmem(),fm=os.freemem();
      let ip='';
      for(const n of Object.values(os.networkInterfaces()))
        for(const i of n)if(i.family==='IPv4'&&!i.internal){ip=i.address;break}
      return{cpu:{use:u.toFixed(1),n:cpus.length},mem:{pct:((tm-fm)/tm*100).toFixed(1),used:mb(tm-fm),tot:mb(tm)},up:os.uptime(),host:os.hostname(),plat:PLATFORM,arch:os.arch(),ip}
    })(),
    (async()=>{
      const cmd=isWin?'"C:\\Program Files (x86)\\ZeroTier\\One\\zerotier-cli.exe"':isMac?'/usr/local/bin/zerotier-cli':'zerotier-cli';
      const n=await execCmd(`${cmd} listnetworks`),i=await execCmd(`${cmd} info`);
      const m=n.out.match(/(\d+\.\d+\.\d+\.\d+)/),id=n.out.match(/([a-f0-9]{16})/);
      return{on:!n.err&&n.out.includes('OK'),addr:i.out.match(/([a-f0-9]{10})/)?.[1]||'?',ip:m?.[1]||'Not connected',net:id?.[1]||null}
    })(),
    (async()=>{
      const r=await execCmd(isWin?'tasklist /FI "IMAGENAME eq mihomo.exe"':'pgrep -f mihomo');
      return{run:isWin?r.out.includes('mihomo'):r.code===0,nodes:[{n:'🇺🇸US-West',l:45},{n:'🇯🇵JP-Tokyo',l:85},{n:'🇸🇬SG',l:62},{n:'🇭🇰HK',l:28}]}
    })(),
    (async()=>{
      let gw='Not set';
      const p=path.join(os.homedir(),'.openclaw','gateway.token');
      if(fs.existsSync(p)){const t=fs.readFileSync(p,'utf8').trim();gw=t.substring(0,8)+'...'+t.substring(t.length-4)}
      return{toks:[{n:'OpenAI',k:'sk-***',on:1,u:85},{n:'Anthropic',k:'sk-***',on:1,u:42},{n:'Brave',k:'BSA***',on:1,u:12},{n:'ZT',k:'ZT***',on:0,u:0}],gw}
    })(),
    (async()=>({stats:{p:2,c:1},list:[{id:1,t:'Deploy skill',st:'pending',pl:'discord',pr:1,sub:[{c:'README',s:1},{c:'GitHub',s:0}]},{id:2,t:'Fix UI',st:'processing',pl:'telegram',pr:2,sub:[]}]}))()
  ]);
  return{sys,zt,mihomo,tokens,tasks,plat:PLATFORM};
}

function html(d,p){
  const{sys,zt,mihomo,tokens,tasks,plat}=d;
  const col=v=>v>80?'#a06060':v>50?'#a09060':'#609060';
  
  return`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Glitch Dashboard - ${plat}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{--bg:#0c0e14;--sb:#11131a;--c:#181b24;--ch:#1e222c;--b:#2a2f3a;--t:#c4c8d0;--tm:#6c7484;--ac:#5c8cb0;--gr:#609060;--yl:#a09060;--rd:#a06060}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--t);min-height:100vh;display:flex}
.sb{width:72px;background:var(--sb);border-right:1px solid var(--b);display:flex;flex-direction:column;align-items:center;padding:20px 0;position:fixed;height:100vh}
.logo{width:44px;height:44px;background:linear-gradient(135deg,#4a6070,#5c6070);border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:18px;margin-bottom:28px}
.nav{width:52px;height:48px;border-radius:10px;display:flex;align-items:center;justify-content:center;margin-bottom:6px;cursor:pointer;color:var(--tm);font-size:18px;position:relative;transition:all .2s}
.nav:hover{background:var(--ch);color:var(--t)}.nav.act{background:rgba(92,140,176,.12);color:var(--ac)}.nav.act::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:3px;height:20px;background:var(--ac);border-radius:0 2px 2px 0}
.tip{position:absolute;left:60px;background:var(--c);padding:8px 12px;border-radius:8px;font-size:12px;white-space:nowrap;opacity:0;transition:opacity .2s;border:1px solid var(--b);box-shadow:0 4px 16px rgba(0,0,0,.4);z-index:200}
.nav:hover .tip{opacity:1}
.main{flex:1;margin-left:72px;padding:24px 32px;max-width:1400px}
.hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid var(--b)}
.hdr h1{font-size:22px;font-weight:600}
.st{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--gr)}.st-dot{width:8px;height:8px;background:var(--gr);border-radius:50%;animation:pulse 2.5s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.card{background:var(--c);border:1px solid var(--b);border-radius:12px;padding:20px;margin-bottom:16px}
.card-tit{font-size:14px;font-weight:600;margin-bottom:16px;display:flex;align-items:center;gap:10px}
.ic{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:13px}
.ic-s{background:rgba(92,140,176,.15);color:var(--ac)}.ic-n{background:rgba(92,106,160,.15);color:#5c6aa0}.ic-t{background:rgba(92,144,96,.15);color:var(--gr)}.ic-x{background:rgba(160,106,140,.15);color:#a06a8c}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}
.grid-item{background:var(--c);border:1px solid var(--b);border-radius:10px;padding:20px;cursor:pointer;transition:all .2s}.grid-item:hover{border-color:var(--ac);transform:translateY(-2px)}
.grid-val{font-size:32px;font-weight:600;font-family:'JetBrains Mono',monospace;margin-bottom:6px}
.grid-lab{font-size:13px;color:var(--tm)}
.prog{margin:14px 0}.prog-hd{display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;color:var(--tm)}.prog-bar{height:6px;background:var(--b);border-radius:3px;overflow:hidden}.prog-fill{height:100%;border-radius:3px;transition:width .3s ease}
.task{background:var(--ch);border-radius:8px;padding:14px;margin-bottom:10px;border-left:3px solid var(--yl)}.task.proc{border-left-color:var(--ac)}.task.comp{border-left-color:var(--gr);opacity:.7}
.task-hd{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px}.task-tit{font-size:14px;font-weight:500;flex:1;line-height:1.4}
.task-btns{display:flex;gap:6px}.btn-sm{padding:4px 10px;font-size:11px;border:none;border-radius:4px;cursor:pointer;transition:all .15s;background:var(--b);color:var(--tm)}.btn-sm:hover{background:var(--ac);color:#000}
.task-meta{font-size:12px;color:var(--tm);display:flex;gap:12px;margin-top:6px}
.subs{margin-top:10px;padding-left:12px;border-left:2px solid var(--b)}.sub{display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px;color:var(--tm)}.sub.done{text-decoration:line-through;opacity:.5}
.tok{display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-bottom:1px solid var(--b)}.tok:last-child{border:none}.tok-n{font-weight:500;font-size:14px}.tok-k{font-size:12px;color:var(--tm);font-family:'JetBrains Mono',monospace}
.tog{position:relative;width:44px;height:24px}.tog input{opacity:0;width:0;height:0}.tog-sl{position:absolute;cursor:pointer;inset:0;background:var(--b);border-radius:24px;transition:.25s}.tog-sl:before{content:"";position:absolute;height:18px;width:18px;left:3px;bottom:3px;background:#8c94a4;border-radius:50%;transition:.25s}.tog input:checked+.tog-sl{background:var(--gr)}.tog input:checked+.tog-sl:before{transform:translateX(20px)}
.gw{margin-top:20px;padding-top:20px;border-top:1px solid var(--b)}.gw-l{font-size:12px;color:var(--tm);margin-bottom:8px}.gw-v{font-family:'JetBrains Mono',monospace;font-size:13px;background:var(--ch);padding:12px;border-radius:8px;word-break:break-all;color:var(--ac)}
.pg{display:none}.pg.act{display:block}
@media(max-width:900px){.sb{width:60px}.main{margin-left:60px;padding:16px}.grid{grid-template-columns:repeat(2,1fr)}}
</style></head>
<body>
<nav class="sb">
<div class="logo">G</div>
<div class="nav ${p==='overview'?'act':''}" onclick="go('overview')"><span>⌂</span><span class="tip">Overview</span></div>
<div class="nav ${p==='system'?'act':''}" onclick="go('system')"><span>⚙</span><span class="tip">System</span></div>
<div class="nav ${p==='network'?'act':''}" onclick="go('network')"><span>🌐</span><span class="tip">Network</span></div>
<div class="nav ${p==='tasks'?'act':''}" onclick="go('tasks')"><span>☰</span><span class="tip">Tasks</span></div>
<div class="nav ${p==='tokens'?'act':''}" onclick="go('tokens')"><span>🔑</span><span class="tip">Tokens</span></div>
</nav>
<main class="main">
<header class="hdr"><h1>Glitch Dashboard</h1><div class="hdr-info"><span>${plat} / ${sys.arch}</span><div class="st"><div class="st-dot"></div>Online</div></div></header>

<div class="pg ${p==='overview'?'act':''}" id="overview">
<div class="grid">
<div class="grid-item" onclick="go('system')"><div class="grid-val" style="color:${col(parseFloat(sys.cpu.use))}">${sys.cpu.use}%</div><div class="grid-lab">CPU Usage</div></div>
<div class="grid-item" onclick="go('system')"><div class="grid-val" style="color:${col(parseFloat(sys.mem.pct))}">${sys.mem.pct}%</div><div class="grid-lab">Memory</div></div>
<div class="grid-item" onclick="go('network')"><div class="grid-val" style="color:var(--gr)">${tasks.stats.p}</div><div class="grid-lab">Pending Tasks</div></div>
<div class="grid-item"><div class="grid-val" style="color:var(--ac)">${tokens.toks.filter(t=>t.on).length}</div><div class="grid-lab">Active Tokens</div></div>
</div>
</div>

<div class="pg ${p==='system'?'act':''}" id="system">
<div class="card"><div class="card-tit"><div class="ic ic-s">⚙</div>System Information (${sys.plat})</div>
<div class="prog"><div class="prog-hd"><span>CPU Usage</span><span>${sys.cpu.use}% (${sys.cpu.n} cores)</span></div><div class="prog-bar"><div class="prog-fill" style="width:${sys.cpu.use}%;background:${col(parseFloat(sys.cpu.use))}"></div></div></div>
<div class="prog"><div class="prog-hd"><span>Memory Usage</span><span>${sys.mem.used} / ${sys.mem.tot}</span></div><div class="prog-bar"><div class="prog-fill" style="width:${sys.mem.pct}%;background:${col(parseFloat(sys.mem.pct))}"></div></div></div>
</div></div>

<div class="pg ${p==='network'?'act':''}" id="network">
<div class="card"><div class="card-tit"><div class="ic ic-n">🌐</div>ZeroTier Network</div>
<div style="background:var(--ch);border-radius:10px;padding:20px;text-align:center;margin:12px 0"><div style="font-size:12px;color:var(--tm);margin-bottom:8px">ZeroTier Virtual IP</div><div style="font-family:'JetBrains Mono',monospace;font-size:26px;font-weight:600;color:var(--ac)">${zt.ip}</div></div>
<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px"><div style="background:var(--ch);padding:14px;border-radius:10px"><div style="font-size:12px;color:var(--tm)">Physical IP</div><div style="font-size:14px;font-weight:500;margin-top:4px">${sys.ip}</div></div><div style="background:var(--ch);padding:14px;border-radius:10px"><div style="font-size:12px;color:var(--tm)">ZT Address</div><div style="font-family:'JetBrains Mono',monospace;font-size:13px;margin-top:4px">${zt.addr}</div></div></div>
</div></div>

<div class="pg ${p==='tasks'?'act':''}" id="tasks">
<div class="card"><div class="card-tit"><div class="ic ic-t">☰</div>Task Queue (${tasks.stats.p} pending)</div>
${tasks.list.map(t=>`<div class="task ${t.st}"><div class="task-hd"><div class="task-tit">${t.t}</div><div class="task-btns"><button class="btn-sm" onclick="task('c',${t.id})">Done</button><button class="btn-sm" onclick="task('e',${t.id})">Edit</button><button class="btn-sm" onclick="task('d',${t.id})">Del</button></div></div><div class="task-meta"><span style="color:${t.st==='pending'?var(--yl):t.st==='processing'?var(--ac):var(--gr)}">[${t.st}]</span><span>${t.pl}</span><span>P:${t.pr}</span></div>${t.sub?.length?`<div class="subs">${t.sub.map(s=>`<div class="sub ${s.s?'done':''}"><input type="checkbox" ${s.s?'checked':''} disabled> <span>${s.c}</span></div>`).join('')}</div>`:''}</div>`).join('')}
</div></div>

<div class="pg ${p==='tokens'?'act':''}" id="tokens">
<div class="card"><div class="card-tit"><div class="ic ic-x">🔑</div>Token Manager</div>
${tokens.toks.map(t=>`<div class="tok"><div><div class="tok-n">${t.n}</div><div class="tok-k">${t.k}</div></div><div style="display:flex;align-items:center;gap:16px"><div style="text-align:right"><div style="font-size:13px;font-weight:500;color:${t.u>50?var(--yl):'var(--t)'}">${t.u}%</div><div style="font-size:11px;color:var(--tm)">used</div></div><label class="tog"><input type="checkbox" ${t.on?'checked':''}><span class="tog-sl"></span></label></div></div>`).join('')}
<div class="gw"><div class="gw-l">Gateway Token</div><div class="gw-v">${tokens.gw}</div></div>
</div></div>

</main>
<script>
function go(p){sessionStorage.setItem('page',p);location.href='?page='+p}
const s=sessionStorage.getItem('page');if(s&&s!=='${p}'){document.querySelectorAll('.pg').forEach(x=>x.classList.remove('act'));document.getElementById(s)?.classList.add('act')}
function task(a,i){fetch('/api/task',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:a,taskId:i})}).then(()=>location.reload())}
</script></body></html>`;
}

const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://localhost:'+PORT);
  res.setHeader('Access-Control-Allow-Origin','*');
  if(u.pathname==='/api/task'){let b='';req.on('data',c=>b+=c);req.on('end',()=>{try{const d=JSON.parse(b);console.log('Task:',d);res.end('ok')}catch(e){res.end('err')}});return;}
  const p=u.searchParams.get('page')||'overview';
  const d=await getData();
  res.setHeader('Content-Type','text/html');
  res.end(html(d,p));
});

server.listen(PORT,'0.0.0.0',()=>{
  const ip=Object.values(os.networkInterfaces()).flat().find(i=>i.family==='IPv4'&&!i.internal)?.address||'0.0.0.0';
  console.log(`Glitch Dashboard v3.0`);
  console.log(`Platform: ${PLATFORM}`);
  console.log(`URL: http://localhost:${PORT}`);
  console.log(`Network: http://${ip}:${PORT}`);
  console.log(`ZeroTier: http://172.26.21.18:${PORT}`);
});
