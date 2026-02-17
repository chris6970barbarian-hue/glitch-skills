#!/usr/bin/env node
/**
 * Glitch Dashboard v3 - Refined UI with softer colors
 */
const http=require('http'),fs=require('fs'),path=require('path'),{exec}=require('child_process'),os=require('os');
const PORT=3853;

async function execCmd(cmd,t=3000){return new Promise(r=>{exec(cmd,{timeout:t,shell:true},(e,so,se)=>r({out:so?.trim()||'',err:se?.trim()||'',code:e?.code||0}))})}

async function getData(){
  const[sys,zt,mihomo,tokens,tasks,logs]=await Promise.all([
    (async()=>{const cpus=os.cpus();let ti=0,tt=0;for(const c of cpus){for(const k in c.times)tt+=c.times[k];ti+=c.times.idle}const u=100-ti/tt*100,mb=b=>b>1e9?(b/1e9).toFixed(1)+'GB':(b/1e6|0)+'MB',tm=os.totalmem(),fm=os.freemem();let ip='';for(const n of Object.values(os.networkInterfaces()))for(const i of n)if(i.family==='IPv4'&&!i.internal){ip=i.address;break}return{cpu:{use:u.toFixed(1),n:cpus.length},mem:{pct:((tm-fm)/tm*100).toFixed(1),used:mb(tm-fm),tot:mb(tm)},load:os.loadavg().map(x=>x.toFixed(2)),up:os.uptime(),host:os.hostname(),plat:os.platform(),ip}})(),
    (async()=>{const n=await execCmd('sudo zerotier-cli listnetworks'),i=await execCmd('sudo zerotier-cli info'),m=n.out.match(/(\d+\.\d+\.\d+\.\d+)/),id=n.out.match(/([a-f0-9]{16})/);return{on:!n.err&&n.out.includes('OK'),addr:i.out.match(/([a-f0-9]{10})/)?.[1]||'?',ip:m?.[1]||'Not connected',net:id?.[1]||null}})(),
    (async()=>({run:(await execCmd('pgrep -f mihomo')).code===0,nodes:[{n:'🇺🇸 US-West-01',l:45,st:'active'},{n:'🇯🇵 JP-Tokyo-01',l:85,st:'standby'},{n:'🇸🇬 SG-Singapore-01',l:62,st:'standby'},{n:'🇭🇰 HK-HongKong-01',l:28,st:'active'},{n:'🇹🇼 TW-Taipei-01',l:35,st:'standby'},{n:'🇰🇷 KR-Seoul-01',l:72,st:'standby'}]}))(),
    (async()=>({toks:[{n:'OpenAI',k:'sk-***abc123',on:1,u:85,m:'$12.40'},{n:'Anthropic',k:'sk-ant-***xyz',on:1,u:42,m:'$8.20'},{n:'Brave Search',k:'BSA***',on:1,u:12,m:'$0.50'},{n:'ZeroTier',k:'ZT***',on:0,u:0,m:'$0.00'}],gw:'gla_***a8f2...e91c'}))(),
    (async()=>({stats:{p:2,c:1},list:[
      {id:1,t:'Deploy new skill to production environment with CI/CD pipeline',st:'pending',pl:'discord',pr:1,sub:[{c:'Update documentation',s:1},{c:'Push to repository',s:0},{c:'Run tests',s:0}]},
      {id:2,t:'Fix dashboard responsive layout for mobile devices',st:'pending',pl:'telegram',pr:2,sub:[]},
      {id:3,t:'Configure Mihomo proxy nodes and DNS',st:'processing',pl:'lark',pr:1,sub:[{c:'Test latency',s:1},{c:'Verify connectivity',s:1}]},
      {id:4,t:'Update system dependencies and security patches',st:'completed',pl:'discord',pr:2,sub:[]}
    ]}))(),
    (async()=>[
      {t:new Date().toISOString(),s:'system',m:'Dashboard server running on port 3853'},
      {t:new Date(Date.now()-1e4).toISOString(),s:'task',m:'Task #3 processing: Configure proxy'},
      {t:new Date(Date.now()-5e4).toISOString(),s:'zt',m:'ZeroTier heartbeat: OK (latency 2ms)'},
      {t:new Date(Date.now()-12e4).toISOString(),s:'token',m:'Token usage: OpenAI $12.40, Anthropic $8.20'},
      {t:new Date(Date.now()-18e4).toISOString(),s:'mihomo',m:'Node HK selected: 28ms latency'},
      {t:new Date(Date.now()-30e4).toISOString(),s:'system',m:'Auto-refresh: 30 seconds'}
    ])()
  ]);
  return{sys,zt,mihomo,tokens,tasks,logs};
}

function html(d,p){
  const{sys,zt,mihomo,tokens,tasks,logs}=d;
  const cpu=parseFloat(sys.cpu.use),mem=parseFloat(sys.mem.pct);
  const col=v=>v>80?'#c45c5c':v>50?'#b8952d':'#4a8c5c';
  const colT=s=>s==='completed'?'#4a8c5c':s==='processing'?'#5c8cc4':s==='active'?'#5ca88c':'#8c7c5c';
  
  return`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Glitch Dashboard</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{--bg:#0d0f14;--sb:#12151a;--c:#181b22;--ch:#1e222a;--b:#2a2f3a;--t:#c8cdd6;--tl:#8c94a4;--td:#5c6474;--cyan:#5c9cb8;--pur:#8c6ab8;--gr:#5c9c6a;--yl:#b8a65c;--rd:#b85c5c;--pk:#b86a9c}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'IBM Plex Sans',-apple-system,BlinkMacSystemFont,sans-serif;background:var(--bg);color:var(--t);min-height:100vh;display:flex}
.sb{width:68px;background:var(--sb);border-right:1px solid var(--b);display:flex;flex-direction:column;align-items:center;padding:18px 0;position:fixed;height:100vh}
.logo{width:44px;height:44px;background:linear-gradient(135deg,#4a6070,#5c6070);border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:18px;color:#c8cdd6;margin-bottom:28px;box-shadow:0 4px 12px rgba(0,0,0,0.3)}
.nav{width:52px;height:48px;border-radius:10px;display:flex;align-items:center;justify-content:center;margin-bottom:6px;cursor:pointer;color:var(--tl);font-size:16px;position:relative;transition:all .2s}
.nav:hover{background:var(--ch);color:var(--t)}.nav.act{background:rgba(92,156,184,0.12);color:var(--cyan)}.nav.act::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:3px;height:22px;background:var(--cyan);border-radius:0 3px 3px 0}
.tip{position:absolute;left:60px;background:var(--c);padding:8px 12px;border-radius:8px;font-size:12px;white-space:nowrap;opacity:0;transition:opacity .2s;border:1px solid var(--b);box-shadow:0 4px 16px rgba(0,0,0,0.4);z-index:200}
.nav:hover .tip{opacity:1}
.main{flex:1;margin-left:68px;padding:24px 32px;max-width:1400px}
.hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding-bottom:18px;border-bottom:1px solid var(--b)}
.hdr h1{font-size:22px;font-weight:600;font-family:'IBM Plex Sans';color:var(--t)}
.st{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--gr)}.st-dot{width:8px;height:8px;background:var(--gr);border-radius:50%;animation:pulse 2.5s infinite}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
.card{background:var(--c);border:1px solid var(--b);border-radius:14px;padding:20px;margin-bottom:20px}
.card-tit{font-size:14px;font-weight:600;margin-bottom:16px;display:flex;align-items:center;gap:10px;color:var(--t)}
.icon{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:13px}
.ic-c{background:rgba(92,156,184,0.15);color:var(--cyan)}.ic-p{background:rgba(140,106,184,0.15);color:var(--pur)}.ic-g{background:rgba(92,156,106,0.15);color:var(--gr)}.ic-y{background:rgba(184,166,92,0.15);color:var(--yl)}.ic-rd{background:rgba(184,92,92,0.15);color:var(--rd)}.ic-pk{background:rgba(184,106,156,0.15);color:var(--pk)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px}
.grid-item{background:var(--c);border:1px solid var(--b);border-radius:12px;padding:18px;cursor:pointer;transition:all .2s}
.grid-item:hover{border-color:var(--cyan);transform:translateY(-2px)}
.grid-val{font-size:32px;font-weight:600;font-family:'IBM Plex Mono';margin-bottom:6px}
.grid-lab{font-size:13px;color:var(--tl)}
.prog{margin:14px 0}.prog-hd{display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px;color:var(--tl)}.prog-bar{height:8px;background:var(--b);border-radius:4px;overflow:hidden}.prog-fill{height:100%;border-radius:4px;transition:width .4s ease}
.task{background:var(--ch);border-radius:10px;padding:14px;margin-bottom:10px;border-left:4px solid var(--yl)}.task.proc{border-left-color:var(--cyan)}.task.comp{border-left-color:var(--gr)}
.task-hd{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px}.task-tit{font-size:14px;font-weight:500;flex:1;line-height:1.5}
.task-btns{display:flex;gap:6px}
.btn-s{padding:5px 12px;font-size:12px;border:none;border-radius:6px;cursor:pointer;transition:all .15s;background:var(--b);color:var(--tl)}
.btn-c{background:rgba(92,156,106,0.2);color:var(--gr)}.btn-c:hover{background:var(--gr);color:#fff}
.btn-m{background:rgba(184,166,92,0.2);color:var(--yl)}.btn-m:hover{background:var(--yl);color:#000}
.btn-d{background:rgba(184,92,92,0.2);color:var(--rd)}.btn-d:hover{background:var(--rd);color:#fff}
.task-meta{font-size:12px;color:var(--td);display:flex;gap:14px;margin-top:8px}
.subs{margin-top:10px;padding-left:14px;border-left:2px solid var(--b)}.sub{display:flex;align-items:center;gap:10px;padding:6px 0;font-size:13px;color:var(--tl)}.sub.done{text-decoration:line-through;opacity:0.5}
.tok{display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-bottom:1px solid var(--b)}.tok:last-child{border:none}.tok-info{flex:1}.tok-n{font-weight:500;font-size:14px}.tok-k{font-size:12px;color:var(--td);font-family:'IBM Plex Mono'}.tok-usage{text-align:right;margin-right:16px}.tok-u{font-size:13px;font-weight:500}.tok-c{font-size:11px;color:var(--td)}
.tog{position:relative;width:44px;height:24px}.tog input{opacity:0;width:0;height:0}.tog-sl{position:absolute;cursor:pointer;inset:0;background:var(--b);border-radius:24px;transition:.25s}.tog-sl:before{content:"";position:absolute;height:18px;width:18px;left:3px;bottom:3px;background:#8c94a4;border-radius:50%;transition:.25s}.tog input:checked+.tog-sl{background:var(--gr)}.tog input:checked+.tog-sl:before{transform:translateX(20px)}
.gw{margin-top:20px;padding-top:20px;border-top:1px solid var(--b)}.gw-l{font-size:12px;color:var(--td);margin-bottom:8px}.gw-v{font-family:'IBM Plex Mono';font-size:13px;background:var(--ch);padding:12px;border-radius:8px;word-break:break-all;color:var(--cyan)}
.inp{width:100%;background:var(--ch);border:1px solid var(--b);border-radius:8px;padding:12px 14px;color:var(--t);font-size:14px;margin:8px 0;font-family:inherit}.inp:focus{outline:none;border-color:var(--cyan)}
.btn{padding:10px 20px;border:none;border-radius:8px;font-size:14px;cursor:pointer;transition:all .15s;font-weight:500}
.btn-p{background:var(--cyan);color:#0d0f14}.btn-p:hover{background:#6caccc}.btn-s{background:var(--ch);color:var(--t);border:1px solid var(--b)}.btn-s:hover{border-color:var(--cyan)}
.ip-box{background:var(--ch);border-radius:12px;padding:24px;text-align:center;margin:14px 0}.ip-l{font-size:12px;color:var(--td);margin-bottom:8px}.ip-v{font-family:'IBM Plex Mono';font-size:28px;font-weight:600;color:var(--cyan)}
.info-g{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.info-c{background:var(--ch);padding:14px;border-radius:10px}.info-l{font-size:12px;color:var(--td);margin-bottom:6px}.info-v{font-size:14px;font-weight:500}
.node{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:var(--ch);border-radius:10px;margin-bottom:8px;cursor:pointer;transition:all .15s;border:1px solid transparent}.node:hover{border-color:var(--cyan)}.node.sel{border-color:var(--gr);background:rgba(92,156,106,0.1)}
.node-n{font-size:14px}.node-s{display:flex;align-items:center;gap:12px}.node-l{font-size:12px;padding:4px 12px;border-radius:12px;background:rgba(92,156,106,0.15);color:var(--gr)}.node-l.med{background:rgba(184,166,92,0.15);color:var(--yl)}.node-l.bad{background:rgba(184,92,92,0.15);color:var(--rd)}
.log{display:flex;gap:14px;padding:10px 0;border-bottom:1px solid var(--b);font-size:13px}.log:last-child{border:none}.log-t{color:var(--td);white-space:nowrap;font-family:'IBM Plex Mono';font-size:12px}.log-s{color:var(--pur);white-space:nowrap}.log-m{color:var(--tl)}
.pg{display:none}.pg.act{display:block}
@media(max-width:900px){.sb{width:60px}.main{margin-left:60px;padding:20px}.grid{grid-template-columns:repeat(2,1fr)}.info-g{grid-template-columns:repeat(2,1fr)}}
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
<header class="hdr"><h1>Glitch Dashboard</h1><div class="st"><div class="st-dot"></div>System Online</div></header>

<div class="pg ${p==='overview'?'act':''}" id="overview">
<div class="grid">
<div class="grid-item" onclick="go('system')"><div class="grid-val" style="color:${col(cpu)}">${sys.cpu.use}%</div><div class="grid-lab">CPU Usage</div></div>
<div class="grid-item" onclick="go('system')"><div class="grid-val" style="color:${col(mem)}">${sys.mem.pct}%</div><div class="grid-lab">Memory</div></div>
<div class="grid-item" onclick="go('zerotier')"><div class="grid-val" style="color:var(--gr)">${zt.ip.split('.')[3]||'--'}</div><div class="grid-lab">ZeroTier IP</div></div>
<div class="grid-item" onclick="go('tasks')"><div class="grid-val" style="color:var(--yl)">${tasks.stats.p}</div><div class="grid-lab">Pending Tasks</div></div>
<div class="grid-item" onclick="go('tokens')"><div class="grid-val" style="color:var(--pur)">${tokens.toks.filter(t=>t.on).length}</div><div class="grid-lab">Active Tokens</div></div>
<div class="grid-item" onclick="go('mihomo')"><div class="grid-val" style="color:${mihomo.run?col(20):'var(--rd)'}">${mihomo.run?'ON':'OFF'}</div><div class="grid-lab">Mihomo</div></div>
</div>
<div class="card" style="margin-top:20px"><div class="card-tit"><div class="icon ic-c">S</div>Quick Overview</div>
<div class="info-g">
<div class="info-c"><div class="info-l">Hostname</div><div class="info-v">${sys.host}</div></div>
<div class="info-c"><div class="info-l">Uptime</div><div class="info-v">${(sys.up/3600).toFixed(1)} hours</div></div>
<div class="info-c"><div class="info-l">Current Task</div><div class="info-v" style="color:var(--yl)">${tasks.list.find(t=>t.st==='processing')?.t?.substring(0,25)||'None'}...</div></div>
</div></div>
</div>

<div class="pg ${p==='zerotier'?'act':''}" id="zerotier">
<div class="card"><div class="card-tit"><div class="icon ic-p">Z</div>ZeroTier Network</div>
<div class="ip-box"><div class="ip-l">ZeroTier Virtual IP</div><div class="ip-v">${zt.ip}</div></div>
<div class="info-g">
<div class="info-c"><div class="info-l">Physical IP</div><div class="info-v">${sys.ip}</div></div>
<div class="info-c"><div class="info-l">Node Address</div><div class="info-v" style="font-family:'IBM Plex Mono'">${zt.addr}</div></div>
<div class="info-c"><div class="info-l">Network ID</div><div class="info-v" style="font-family:'IBM Plex Mono';font-size:12px">${zt.net||'Not connected'}</div></div>
</div></div>
<div class="card"><div class="card-tit">Network Configuration</div>
<input class="inp" placeholder="Gateway IP (e.g., 192.168.192.1)"><input class="inp" placeholder="DNS Servers (1.1.1.1, 8.8.8.8)">
<div style="display:flex;gap:12px;margin-top:12px"><button class="btn btn-p">Apply Configuration</button><button class="btn btn-s">Leave Network</button></div></div>
</div>

<div class="pg ${p==='tasks'?'act':''}" id="tasks">
<div class="card"><div class="card-tit"><div class="icon ic-g">Q</div>Task Queue - ${tasks.stats.p} Pending, ${tasks.stats.c} Completed</div>
${tasks.list.map(t=>`<div class="task ${t.st}">
<div class="task-hd"><div class="task-tit">${t.t}</div>
<div class="task-btns"><button class="btn-s btn-c" onclick="task('c',${t.id})">Done</button><button class="btn-s btn-m" onclick="task('m',${t.id})">Edit</button><button class="btn-s btn-d" onclick="task('d',${t.id})">Delete</button></div></div>
<div class="task-meta"><span style="color:${colT(t.st)}">[${t.st}]</span><span>Platform: ${t.pl}</span><span>Priority: ${t.pr}</span></div>
${t.sub?.length?`<div class="subs">${t.sub.map(s=>`<div class="sub ${s.s?'done':''}"><input type="checkbox" ${s.s?'checked':''} disabled> <span>${s.c}</span></div>`).join('')}</div>`:''}
</div>`).join('')}
</div></div>

<div class="pg ${p==='tokens'?'act':''}" id="tokens">
<div class="card"><div class="card-tit"><div class="icon ic-pk">T</div>Token Manager</div>
${tokens.toks.map(t=>`<div class="tok"><div class="tok-info"><div class="tok-n">${t.n}</div><div class="tok-k">${t.k}</div></div><div class="tok-usage"><div class="tok-u" style="color:${t.u>50?var(--yl):'var(--t)'}">${t.u}%</div><div class="tok-c">${t.m}</div></div><label class="tog"><input type="checkbox" ${t.on?'checked':''}><span class="tog-sl"></span></label></div>`).join('')}
<div class="gw"><div class="gw-l">Gateway Token</div><div class="gw-v">${tokens.gw}</div>
<input class="inp" placeholder="Enter new gateway token"><button class="btn btn-p" style="margin-top:10px">Update Token</button></div></div></div>

<div class="pg ${p==='system'?'act':''}" id="system">
<div class="card"><div class="card-tit"><div class="icon ic-c">S</div>System Monitor</div>
<div class="prog"><div class="prog-hd"><span>CPU Usage</span><span>${sys.cpu.use}% (${sys.cpu.n} cores)</span></div><div class="prog-bar"><div class="prog-fill" style="width:${sys.cpu.use}%;background:${col(cpu)}"></div></div></div>
<div class="prog"><div class="prog-hd"><span>Memory Usage</span><span>${sys.mem.used} / ${sys.mem.tot}</span></div><div class="prog-bar"><div class="prog-fill" style="width:${sys.mem.pct}%;background:${col(mem)}"></div></div></div>
<div class="info-g" style="margin-top:20px">
<div class="info-c"><div class="info-l">Load Average</div><div class="info-v">${sys.load[0]} | ${sys.load[1]} | ${sys.load[2]}</div></div>
<div class="info-c"><div class="info-l">Uptime</div><div class="info-v">${(sys.up/86400).toFixed(0)}d ${(sys.up%86400/3600).toFixed(0)}h</div></div>
<div class="info-c"><div class="info-l">Platform</div><div class="info-v">${sys.plat}</div></div>
</div></div></div>

<div class="pg ${p==='mihomo'?'act':''}" id="mihomo">
<div class="card"><div class="card-tit"><div class="icon ic-p">M</div>Mihomo Proxy <span style="margin-left:auto;font-size:13px;color:${mihomo.run?'var(--gr)':'var(--rd)'}">${mihomo.run?'Running':'Stopped'}</span></div>
<input class="inp" placeholder="Subscribe URL ( Clash / Quantumult / Surge )"><button class="btn btn-p" style="margin-top:8px">Update Subscribe</button>
<div style="margin-top:20px"><div class="card-tit">Available Nodes (${mihomo.nodes.length})</div>
${mihomo.nodes.map(n=>`<div class="node ${n.st==='active'?'sel':''}"><span class="node-n">${n.n}</span><div class="node-s"><span class="node-l ${n.l<50?'':n.l<100?'med':'bad'}">${n.l}ms</span></div></div>`).join('')}
</div></div></div>

<div class="pg ${p==='logs'?'act':''}" id="logs">
<div class="card"><div class="card-tit"><div class="icon ic-y">L</div>System Logs</div>
${logs.map(l=>`<div class="log"><span class="log-t">${new Date(l.t).toLocaleString()}</span><span class="log-s">[${l.s}]</span><span class="log-m">${l.m}</span></div>`).join('')}
</div></div>

</main>
<script>
function go(p){sessionStorage.setItem('page',p);location.href='?page='+p}
const s=sessionStorage.getItem('page');if(s&&s!=='${p}'){document.querySelectorAll('.pg').forEach(x=>x.classList.remove('act'));document.getElementById(s)?.classList.add('act')}
function task(a,i){console.log(a,i);fetch('/api/task',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:a,taskId:i})}).then(()=>location.reload())}
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
server.listen(PORT,'0.0.0.0',()=>{const ip=Object.values(os.networkInterfaces()).flat().find(i=>i.family==='IPv4'&&!i.internal)?.address||'0.0.0.0';console.log(`Dashboard: http://localhost:${PORT} | http://${ip}:${PORT} | http://172.26.21.18:${PORT}`)});
