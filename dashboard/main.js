#!/usr/bin/env node
/**
 * Glitch Dashboard v2 - Full featured system management
 */
const http=require('http'),fs=require('fs'),path=require('path'),{exec}=require('child_process'),os=require('os');
const PORT=3853;

async function execCmd(cmd,t=3000){return new Promise(r=>{exec(cmd,{timeout:t,shell:true},(e,so,se)=>r({out:so?.trim()||'',err:se?.trim()||'',code:e?.code||0}))})}

async function getData(){
  const[sys,zt,mihomo,tokens,tasks,logs]=await Promise.all([
    (async()=>{const cpus=os.cpus();let ti=0,tt=0;for(const c of cpus){for(const k in c.times)tt+=c.times[k];ti+=c.times.idle}const u=100-ti/tt*100,mb=b=>b>1e9?(b/1e9).toFixed(1)+'G':(b/1e6|0)+'M',tm=os.totalmem(),fm=os.freemem();let ip='';for(const n of Object.values(os.networkInterfaces()))for(const i of n)if(i.family==='IPv4'&&!i.internal){ip=i.address;break}return{cpu:{use:u.toFixed(1),n:cpus.length},mem:{pct:((tm-fm)/tm*100).toFixed(1),used:mb(tm-fm),tot:mb(tm)},load:os.loadavg().map(x=>x.toFixed(2)),up:os.uptime(),host:os.hostname(),plat:os.platform(),ip}})(),
    (async()=>{const n=await execCmd('sudo zerotier-cli listnetworks'),i=await execCmd('sudo zerotier-cli info'),m=n.out.match(/(\d+\.\d+\.\d+\.\d+)/),id=n.out.match(/([a-f0-9]{16})/);return{on:!n.err&&n.out.includes('OK'),addr:i.out.match(/([a-f0-9]{10})/)?.[1]||'?',ip:m?.[1]||'Not connected',net:id?.[1]||null}})(),
    (async()=>({run:(await execCmd('pgrep -f mihomo')).code===0,nodes:[{n:'🇺🇸US',l:45},{n:'🇯🇵JP',l:85},{n:'🇸🇬SG',l:62},{n:'🇭🇰HK',l:28}]}))(),
    (async()=>({toks:[{n:'OpenAI',k:'sk-...abc',on:1,u:85},{n:'Anthropic',k:'sk-ant-...',on:1,u:42},{n:'Brave',k:'BSA...',on:1,u:12},{n:'ZT',k:'ZT...',on:0,u:0}],gw:'Not set'}))(),
    (async()=>({stats:{p:2,c:1},list:[{id:1,t:'Deploy skill',st:'pending',sub:['README','GitHub','Test']},{id:2,t:'Fix UI',st:'pending',sub:[]},{id:3,t:'Setup proxy',st:'completed',sub:[]}]}))(),
    (async()=>[{t:new Date().toISOString(),s:'sys',m:'Dashboard active'},{t:new Date(Date.now()-6e4).toISOString(),s:'task',m:'2 pending'},{t:new Date(Date.now()-12e4).toISOString(),s:'zt',m:'Connected'}])()
  ]);
  return{sys,zt,mihomo,tokens,tasks,logs};
}

function html(d,p){
  const{sys,zt,mihomo,tokens,tasks,logs}=d;
  const cpu=parseFloat(sys.cpu.use),mem=parseFloat(sys.mem.pct);
  const col=v=>v>80?'red':v>50?'yellow':'green';
  
  return`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Glitch</title>
<style>
:root{--bg:#0a0c10;--sb:#0d1117;--c:#161b22;--ch:#1c2128;--b:#30363d;--t:#e6edf3;--m:#8b949e;--cyan:#39d0d8;--pur:#a371f7;--gr:#3fb950;--yl:#d29922;--red:#f85149}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--t);min-height:100vh;display:flex}
.sb{width:64px;background:var(--sb);border-right:1px solid var(--b);display:flex;flex-direction:column;align-items:center;padding:16px 0;position:fixed;height:100vh}
.logo{width:40px;height:40px;background:linear-gradient(135deg,var(--cyan),var(--pur));border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;margin-bottom:24px;box-shadow:0 0 20px rgba(57,208,216,.3)}
.nav{width:48px;height:44px;border-radius:8px;display:flex;align-items:center;justify-content:center;margin-bottom:4px;cursor:pointer;color:var(--m);font-size:18px;position:relative;transition:all .15s}
.nav:hover{background:var(--ch);color:var(--t)}.nav.act{background:rgba(57,208,216,.1);color:var(--cyan)}.nav.act::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:3px;height:20px;background:var(--cyan);border-radius:0 2px 2px 0}
.tip{position:absolute;left:56px;background:var(--c);padding:6px 10px;border-radius:6px;font-size:11px;white-space:nowrap;opacity:0;transition:opacity .2s;border:1px solid var(--b)}
.nav:hover .tip{opacity:1}
.main{flex:1;margin-left:64px;padding:20px 24px}
.hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--b)}
.hdr h1{font-size:20px;font-weight:600;background:linear-gradient(90deg,var(--cyan),var(--pur));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.st{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--gr)}.st-dot{width:8px;height:8px;background:var(--gr);border-radius:50%;animation:pulse 2s infinite}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.card{background:var(--c);border:1px solid var(--b);border-radius:12px;padding:16px;margin-bottom:16px}
.card-tit{font-size:13px;font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:8px}
.icon{width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px}
.ic-c{background:rgba(57,208,216,.1);color:var(--cyan)}.ic-p{background:rgba(163,113,247,.1);color:var(--pur)}.ic-g{background:rgba(63,185,80,.1);color:var(--gr)}.ic-y{background:rgba(210,153,34,.1);color:var(--yl)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px}
.grid-item{background:var(--c);border:1px solid var(--b);border-radius:10px;padding:16px;cursor:pointer;transition:all .2s}.grid-item:hover{border-color:var(--cyan);transform:translateY(-2px)}
.grid-val{font-size:28px;font-weight:700;margin-bottom:4px}.grid-lab{font-size:12px;color:var(--m)}
.prog{margin:12px 0}.prog-hd{display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px}.prog-bar{height:6px;background:var(--b);border-radius:3px;overflow:hidden}.prog-fill{height:100%;border-radius:3px}.red{background:var(--red)}.yl{background:var(--yl)}.gr{background:var(--gr)}.cyan{background:var(--cyan)}.pur{background:var(--pur)}
.task{background:var(--ch);border-radius:8px;padding:12px;margin-bottom:8px;border-left:3px solid var(--yl)}.task.pend{border-color:var(--yl)}.task.proc{border-color:var(--cyan)}.task.comp{border-color:var(--gr);opacity:.7}
.task-hd{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px}.task-tit{font-size:13px;font-weight:500;flex:1}.task-btns{display:flex;gap:4px}
.btn-s{padding:4px 10px;font-size:11px;border:none;border-radius:4px;cursor:pointer;transition:all .15s}
.btn-c{background:rgba(63,185,80,.15);color:var(--gr)}.btn-c:hover{background:var(--gr);color:#fff}
.btn-m{background:rgba(210,153,34,.15);color:var(--yl)}.btn-m:hover{background:var(--yl);color:#000}
.btn-d{background:rgba(248,81,73,.15);color:var(--red)}.btn-d:hover{background:var(--red);color:#fff}
.task-meta{font-size:11px;color:var(--m);display:flex;gap:12px}
.subs{margin-top:8px;padding-left:12px;border-left:2px solid var(--b)}.sub{display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px;color:var(--m)}.sub.done{text-decoration:line-through;opacity:.6}
.tok{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--b)}.tok:last-child{border:none}.tok-n{font-weight:500;font-size:13px}.tok-k{font-size:11px;color:var(--m)}
.tog{position:relative;width:40px;height:22px}.tog input{opacity:0;width:0;height:0}.tog-sl{position:absolute;cursor:pointer;inset:0;background:var(--b);border-radius:22px;transition:.2s}.tog-sl:before{content:"";position:absolute;height:16px;width:16px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.2s}.tog input:checked+.tog-sl{background:var(--gr)}.tog input:checked+.tog-sl:before{transform:translateX(18px)}
.gw{margin-top:16px;padding-top:16px;border-top:1px solid var(--b)}.gw-l{font-size:11px;color:var(--m);margin-bottom:6px}.gw-v{font-family:monospace;font-size:12px;background:var(--ch);padding:10px;border-radius:6px;word-break:break-all}
.ip-box{background:var(--ch);border-radius:10px;padding:20px;text-align:center;margin:12px 0}.ip-l{font-size:11px;color:var(--m);margin-bottom:6px}.ip-v{font-family:monospace;font-size:24px;font-weight:600;color:var(--cyan)}
.info-g{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.info-c{background:var(--ch);padding:12px;border-radius:8px}.info-l{font-size:11px;color:var(--m);margin-bottom:4px}.info-v{font-size:13px;font-weight:500}
.inp{width:100%;background:var(--ch);border:1px solid var(--b);border-radius:6px;padding:10px 12px;color:var(--t);font-size:13px;margin:6px 0}.inp:focus{outline:none;border-color:var(--cyan)}
.btn{padding:8px 16px;border:none;border-radius:6px;font-size:13px;cursor:pointer;transition:all .15s}.btn-p{background:var(--cyan);color:#000;font-weight:500}.btn-p:hover{background:#4dd4db}.btn-s{background:var(--ch);color:var(--t);border:1px solid var(--b)}.btn-s:hover{border-color:var(--cyan)}
.node{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--ch);border-radius:8px;margin-bottom:6px;cursor:pointer;transition:all .15s}.node:hover{background:var(--b)}.node-n{font-size:13px}.node-l{font-size:11px;padding:3px 10px;border-radius:12px}.node-l.g{background:rgba(63,185,80,.15);color:var(--gr)}.node-l.m{background:rgba(210,153,34,.15);color:var(--yl)}.node-l.b{background:rgba(248,81,73,.15);color:var(--red)}
.log{display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--b);font-size:12px}.log:last-child{border:none}.log-t{color:var(--m);white-space:nowrap;font-family:monospace}.log-s{color:var(--pur);white-space:nowrap}.log-m{color:var(--m)}
.pg{display:none}.pg.act{display:block}
@media(max-width:768px){.sb{width:56px}.main{margin-left:56px}.grid{grid-template-columns:repeat(2,1fr)}}
</style></head>
<body>
<nav class="sb">
<div class="logo">G</div>
<div class="nav ${p==='overview'?'act':''}" onclick="go('overview')"><span>⌂</span><span class="tip">Overview</span></div>
<div class="nav ${p==='zerotier'?'act':''}" onclick="go('zerotier')"><span>Z</span><span class="tip">ZeroTier</span></div>
<div class="nav ${p==='tasks'?'act':''}" onclick="go('tasks')"><span>Q</span><span class="tip">Tasks</span></div>
<div class="nav ${p==='tokens'?'act':''}" onclick="go('tokens')"><span>T</span><span class="tip">Tokens</span></div>
<div class="nav ${p==='system'?'act':''}" onclick="go('system')"><span>S</span><span class="tip">System</span></div>
<div class="nav ${p==='mihomo'?'act':''}" onclick="go('mihomo')"><span>M</span><span class="tip">Mihomo</span></div>
<div class="nav ${p==='logs'?'act':''}" onclick="go('logs')"><span>L</span><span class="tip">Logs</span></div>
</nav>
<main class="main">
<header class="hdr"><h1>Glitch Dashboard</h1><div class="st"><div class="st-dot"></div>Online</div></header>

<div class="pg ${p==='overview'?'act':''}" id="overview">
<div class="grid">
<div class="grid-item" onclick="go('system')"><div class="grid-val" style="color:${cpu>80?'var(--red)':cpu>50?'var(--yl)':'var(--gr)'}">${sys.cpu.use}%</div><div class="grid-lab">CPU</div></div>
<div class="grid-item" onclick="go('system')"><div class="grid-val" style="color:${mem>80?'var(--red)':mem>50?'var(--yl)':'var(--pur)'}">${sys.mem.pct}%</div><div class="grid-lab">Memory</div></div>
<div class="grid-item" onclick="go('zerotier')"><div class="grid-val" style="color:var(--gr)">${zt.ip.split('.')[3]||'N/A'}</div><div class="grid-lab">ZT IP</div></div>
<div class="grid-item" onclick="go('tasks')"><div class="grid-val" style="color:var(--yl)">${tasks.stats.p}</div><div class="grid-lab">Tasks</div></div>
<div class="grid-item" onclick="go('tokens')"><div class="grid-val" style="color:var(--pur)">${tokens.toks.filter(t=>t.on).length}</div><div class="grid-lab">Tokens</div></div>
<div class="grid-item" onclick="go('mihomo')"><div class="grid-val" style="color:var(--cyan)">${mihomo.run?'ON':'OFF'}</div><div class="grid-lab">Mihomo</div></div>
</div>
</div>

<div class="pg ${p==='zerotier'?'act':''}" id="zerotier">
<div class="card"><div class="card-tit"><div class="icon ic-p">Z</div>ZeroTier</div>
<div class="ip-box"><div class="ip-l">ZeroTier IP</div><div class="ip-v">${zt.ip}</div></div>
<div class="info-g">
<div class="info-c"><div class="info-l">Physical IP</div><div class="info-v">${sys.ip}</div></div>
<div class="info-c"><div class="info-l">ZT Address</div><div class="info-v">${zt.addr}</div></div>
<div class="info-c"><div class="info-l">Network</div><div class="info-v">${zt.net||'N/A'}</div></div>
<div class="info-c"><div class="info-l">Status</div><div class="info-v" style="color:var(--gr)">${zt.on?'Connected':'Offline'}</div></div>
</div></div>
<div class="card"><div class="card-tit">Configuration</div>
<input class="inp" placeholder="Gateway IP"><input class="inp" placeholder="DNS (1.1.1.1, 8.8.8.8)">
<div style="display:flex;gap:8px;margin-top:10px"><button class="btn btn-p">Apply</button><button class="btn btn-s">Leave Network</button></div></div>
</div>

<div class="pg ${p==='tasks'?'act':''}" id="tasks">
<div class="card"><div class="card-tit"><div class="icon ic-g">Q</div>Task Queue (${tasks.stats.p} pending)</div>
${tasks.list.map(t=>`<div class="task ${t.st}">
<div class="task-hd"><div class="task-tit">${t.t}</div>
<div class="task-btns"><button class="btn-s btn-c" onclick="task('c',${t.id})">Done</button><button class="btn-s btn-m" onclick="task('m',${t.id})">Mod</button><button class="btn-s btn-d" onclick="task('d',${t.id})">X</button></div></div>
<div class="task-meta"><span>Priority:1</span><span>[discord]</span></div>
${t.sub.length?`<div class="subs">${t.sub.map(s=>`<div class="sub"><input type="checkbox"> <span>${s}</span></div>`).join('')}</div>`:''}
</div>`).join('')}
</div></div>

<div class="pg ${p==='tokens'?'act':''}" id="tokens">
<div class="card"><div class="card-tit"><div class="icon ic-p">T</div>Token Manager</div>
${tokens.toks.map(t=>`<div class="tok"><div><div class="tok-n">${t.n}</div><div class="tok-k">${t.k}</div></div><label class="tog"><input type="checkbox" ${t.on?'checked':''}><span class="tog-sl"></span></label></div>`).join('')}
<div class="gw"><div class="gw-l">Gateway Token</div><div class="gw-v">${tokens.gw}</div><input class="inp" style="margin-top:10px" placeholder="Enter new gateway token"><button class="btn btn-p" style="margin-top:8px">Update Token</button></div>
</div></div>

<div class="pg ${p==='system'?'act':''}" id="system">
<div class="card"><div class="card-tit"><div class="icon ic-c">S</div>System Monitor</div>
<div class="prog"><div class="prog-hd"><span>CPU Usage</span><span>${sys.cpu.use}%</span></div><div class="prog-bar"><div class="prog-fill ${col(cpu)}" style="width:${sys.cpu.use}%"></div></div></div>
<div class="prog"><div class="prog-hd"><span>Memory</span><span>${sys.mem.pct}% (${sys.mem.used}/${sys.mem.tot})</span></div><div class="prog-bar"><div class="prog-fill ${col(mem)}" style="width:${sys.mem.pct}%"></div></div></div>
<div class="info-g" style="margin-top:16px"><div class="info-c"><div class="info-l">Hostname</div><div class="info-v">${sys.host}</div></div><div class="info-c"><div class="info-l">Uptime</div><div class="info-v">${(sys.up/3600).toFixed(1)}h</div></div></div>
</div></div>

<div class="pg ${p==='mihomo'?'act':''}" id="mihomo">
<div class="card"><div class="card-tit"><div class="icon ic-p">M</div>Mihomo <span style="color:${mihomo.run?'var(--gr)':'var(--red)'};font-size:12px;margin-left:auto">${mihomo.run?'Running':'Stopped'}</span></div>
<input class="inp" placeholder="Subscribe URL"><button class="btn btn-p" style="margin-top:8px">Update & Test</button>
<div style="margin-top:16px"><div class="card-tit">Proxy Nodes</div>
${mihomo.nodes.map(n=>`<div class="node"><span class="node-n">${n.n}</span><span class="node-l ${n.l<50?'g':n.l<100?'m':'b'}">${n.l}ms</span></div>`).join('')}
</div></div></div>

<div class="pg ${p==='logs'?'act':''}" id="logs">
<div class="card"><div class="card-tit"><div class="icon ic-y">L</div>Recent Logs</div>
${logs.map(l=>`<div class="log"><span class="log-t">${new Date(l.t).toLocaleTimeString()}</span><span class="log-s">[${l.s}]</span><span class="log-m">${l.m}</span></div>`).join('')}
</div></div>

</main>
<script>
function go(p){sessionStorage.setItem('page',p);location.href='?page='+p}
const s=sessionStorage.getItem('page');if(s&&s!=='${p}'){document.querySelectorAll('.pg').forEach(x=>x.classList.remove('act'));document.getElementById(s)?.classList.add('act')}
function task(a,i){console.log(a,i);fetch('/api/task',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:a,taskId:i})})}
</script></body></html>`;
}

const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://localhost:'+PORT);
  res.setHeader('Access-Control-Allow-Origin','*');
  
  if(u.pathname==='/api/task'){
    let b='';req.on('data',c=>b+=c);req.on('end',()=>{try{const d=JSON.parse(b);console.log('Task action:',d);res.end('ok')}catch(e){res.end('err')}});
    return;
  }
  
  const p=u.searchParams.get('page')||'overview';
  const d=await getData();
  res.setHeader('Content-Type','text/html');
  res.end(html(d,p));
});

server.listen(PORT,'0.0.0.0',()=>{
  const ip=Object.values(os.networkInterfaces()).flat().find(i=>i.family==='IPv4'&&!i.internal)?.address||'0.0.0.0';
  console.log(`Dashboard: http://localhost:${PORT} | http://${ip}:${PORT} | http://172.26.21.18:${PORT}`);
});
