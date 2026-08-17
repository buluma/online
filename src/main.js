import { SEED_DATA } from './data.js';

const TOTAL_DAYS=90;
const DEFAULT_DAYS=60;
const LIVE_REFRESH_MS=120000;
const STATUS_URLS={c:'https://status.claude.com',o:'https://status.openai.com'};
const STATUS_LABELS={g:'Operational',y:'Degraded',o:'Partial Outage',r:'Major Outage',b:'Maintenance'};
const STATUS_PRIORITY={r:4,o:3,y:2,b:1,g:0};
const STATUS_COLORS={g:'var(--green)',y:'var(--yellow)',o:'var(--orange)',r:'var(--red)',b:'var(--blue)'};
const STATUS_SCORE={g:1,y:0.6,o:0.3,r:0,b:0.8};
const UPTIME_SCORE={g:100,y:99.5,o:98,r:95,b:99};
const API_STATUS_MAP={operational:'g',degraded_performance:'y',partial_outage:'o',major_outage:'r',under_maintenance:'b'};
const SUPPORTS_HOVER=window.matchMedia('(hover: hover) and (pointer: fine)').matches;

const THEME_ICONS={
  dark:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
  light:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
};

const A_SM='<svg class="logo-a-sm" viewBox="0 0 46 32"><path d="M32.73 0h-6.73l-7.543 32h6.73L32.73 0ZM13.27 0 0 32h6.88l2.725-5.87h13.97l2.726 5.87h6.88L19.91 0h-6.64Zm-.524 20.67 4.383-9.44 4.382 9.44H12.746Z"/></svg>';
const O_SM='<svg class="logo-o-sm" viewBox="0 0 24 24"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073ZM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494ZM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646ZM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872v.024Zm16.597 3.855-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667Zm2.01-3.023-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66v.018ZM8.318 12.861l-2.02-1.164a.08.08 0 0 1-.038-.057V6.072a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681l-.003 6.72Zm1.096-2.365L12 8.96l2.586 1.502v2.998L12 14.968l-2.586-1.504v-2.968Z"/></svg>';

const C_NAMES=['Claude API','claude.ai','Claude Code'];
const O_NAMES=['OpenAI APIs','ChatGPT','Codex'];
const C_WEIGHTS=[3,3,2];
const O_WEIGHTS=[3,3,2];

// Mutable data — initialized from seed, replaced by live Worker data when available
let CLAUDE_DAILY={...SEED_DATA.claudeDaily};
let OPENAI_DAILY={...SEED_DATA.openaiDaily};
let UPTIME={...SEED_DATA.uptime};
let OAI_INCIDENTS={...SEED_DATA.oaiIncidents};
let CLAUDE_MINUTES={...SEED_DATA.claudeMinutes};
let CURRENT_STATUS={...SEED_DATA.currentStatus};
let CLAUDE_DETAILS={...SEED_DATA.claudeDetails};
let OPENAI_DETAILS={...SEED_DATA.openaiDetails};
let DATA_UPDATED=SEED_DATA.updated;
const RACES=[
  {title:'API',c:'Claude API',o:'OpenAI APIs'},
  {title:'CHAT',c:'claude.ai',o:'ChatGPT'},
  {title:'CODE',c:'Claude Code',o:'Codex'}
];
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_NAMES=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const CLAUDE_LIVE_COMPONENT_MAP={
  'claude.ai':'claude.ai',
  'platform.claude.com (formerly console.anthropic.com)':'platform.claude.com',
  'Claude API (api.anthropic.com)':'Claude API',
  'Claude Code':'Claude Code',
  'Claude Cowork':'Claude Cowork',
  'Claude for Government':'Claude for Government'
};
const OPENAI_LIVE_COMPONENT_GROUPS={
  'OpenAI APIs':['Fine-tuning','Embeddings','Images','Batch','Audio','Moderations','Compliance API','Codex API','Responses','Chat Completions','Realtime','Audit Logs','Ads API'],
  'ChatGPT':['Login','Conversations','Voice mode','GPTs','Image Generation','Deep Research','Agent','Connectors/Apps','App','Apps','ChatGPT Atlas','Search','File uploads','Files','Shopping Research','Feed'],
  'Codex':['Codex Web','CLI','VS Code extension'],
  'Sora':['Sora','Video viewing','Video generation'],
  'FedRAMP':[]
};
function buildDates(){
  const now=new Date();
  const today=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
  return Array.from({length:TOTAL_DAYS},function(_,index){
    const d=new Date(today);
    d.setUTCDate(d.getUTCDate()-(TOTAL_DAYS-1-index));
    return String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0');
  });
}
let DATES=Array.isArray(SEED_DATA.dates)&&SEED_DATA.dates.length===TOTAL_DAYS?SEED_DATA.dates:buildDates();

let els;
let tooltip;
let dataRows=[];
let chartIdSeed=0;
let tlDayData=null;
let currentDays=DEFAULT_DAYS;

function fmtMins(minutes){
  const hours=Math.min(minutes,1440)/60;
  return hours<1?Math.round(hours*60)+'m':hours.toFixed(1)+'h';
}

function fmtDuration(minutes){
  const hrs=Math.floor(minutes/60);
  const mins=minutes%60;
  if(!hrs)return mins+'m';
  if(!mins)return hrs+'h';
  return hrs+'h '+mins+'m';
}

function fmtDate(dateString){
  const parts=dateString.split('-');
  const monthIndex=parseInt(parts[0],10)-1;
  const day=parseInt(parts[1],10);
  const year=new Date().getFullYear();
  const date=new Date(year,monthIndex,day);
  return DAY_NAMES[date.getDay()]+', '+MONTHS[monthIndex]+' '+day+', '+year;
}

function fmtShortDate(dateString){
  const parts=dateString.split('-');
  const monthIndex=parseInt(parts[0],10)-1;
  const day=parseInt(parts[1],10);
  return MONTHS[monthIndex]+' '+day+', '+new Date().getFullYear();
}

function liveOpenAIGroupStatus(components,groupName){
  const relevant=groupName==='FedRAMP'
    ? (components||[]).filter(function(component){return /fedramp/i.test(component.name||'');})
    : (components||[]).filter(function(component){return (OPENAI_LIVE_COMPONENT_GROUPS[groupName]||[]).includes(component.name);});
  let worst='g';
  relevant.forEach(function(component){
    const code=API_STATUS_MAP[component.status]||'g';
    if((STATUS_PRIORITY[code]||0)>(STATUS_PRIORITY[worst]||0))worst=code;
  });
  return worst;
}

function getDisplayDaily(serviceName,daily){
  const value=daily||'';
  const live=CURRENT_STATUS[serviceName];
  if(!value.length||!live)return value;
  const last=value[value.length-1]||'g';
  if((STATUS_PRIORITY[live]||0)>(STATUS_PRIORITY[last]||0)){
    return value.slice(0,-1)+live;
  }
  return value;
}

function getClaudeDaily(name){
  return getDisplayDaily(name,CLAUDE_DAILY[name]||'');
}

function getOpenAIDaily(name){
  return getDisplayDaily(name,OPENAI_DAILY[name]||'');
}

function getStatusPage(side){
  return STATUS_URLS[side]||STATUS_URLS.o;
}

function getRequiredElements(){
  const nextEls={
    stars:document.getElementById('stars'),
    cards:document.getElementById('cards'),
    overview:document.getElementById('overview'),
    standings:document.getElementById('standings'),
    standingsGrid:document.getElementById('sg'),
    timestamp:document.getElementById('ts'),
    loader:document.getElementById('loader'),
    cAvg:document.getElementById('c-avg'),
    oAvg:document.getElementById('o-avg'),
    delta:document.getElementById('delta'),
    infoOpen:document.getElementById('info-open'),
    drawerClose:document.getElementById('drawer-close'),
    drawerOverlay:document.getElementById('drawer-overlay'),
    themeToggle:document.getElementById('theme-toggle'),
    dayButtons:Array.from(document.querySelectorAll('.ctrl-btn[data-days]'))
  };
  return Object.values(nextEls).every(Boolean)?nextEls:null;
}

function createStars(){
  els.stars.replaceChildren();
  for(let i=0;i<30;i++){
    const star=document.createElement('span');
    const size=Math.random()*1.2+0.4;
    Object.assign(star.style,{
      width:size+'px',
      height:size+'px',
      left:Math.random()*100+'%',
      top:Math.random()*100+'%',
      '--d':3+Math.random()*5+'s',
      '--o':0.08+Math.random()*0.18
    });
    els.stars.appendChild(star);
  }
}

function calcAvg(days){
  const skip=TOTAL_DAYS-days;
  function serviceAverage(daily){
    const slice=daily.slice(skip);
    let total=0;
    for(let i=0;i<slice.length;i++)total+=UPTIME_SCORE[slice[i]]||100;
    return total/slice.length;
  }
  const cAvg=RACES.reduce((sum,race)=>sum+serviceAverage(getClaudeDaily(race.c)),0)/RACES.length;
  const oAvg=RACES.reduce((sum,race)=>sum+serviceAverage(getOpenAIDaily(race.o)),0)/RACES.length;
  els.cAvg.textContent=cAvg.toFixed(2)+'%';
  els.oAvg.textContent=oAvg.toFixed(2)+'%';
  els.delta.textContent=(oAvg>cAvg?'OpenAI':'Claude')+' leads by '+Math.abs(cAvg-oAvg).toFixed(2)+'%';
}

function escAttr(value){
  return String(value||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}

function renderBars(data,side,serviceName){
  const padded=(data||'')+'g'.repeat(TOTAL_DAYS);
  const sourceData=((side==='c'?CLAUDE_DAILY[serviceName]:OPENAI_DAILY[serviceName])||'')+'g'.repeat(TOTAL_DAYS);
  return padded.slice(0,TOTAL_DAYS).split('').map(function(status,index){
    let incidents='';
    let duration='';
    const date=DATES[index];
    const liveOverride=index===TOTAL_DAYS-1&&status!==(sourceData[index]||'g');
    if(side==='c'){
      const detail=CLAUDE_DETAILS[serviceName]&&CLAUDE_DETAILS[serviceName][date];
      const minutes=((detail&&detail.partialMinutes)||0)+((detail&&detail.majorMinutes)||0);
      if(detail&&detail.events&&detail.events.length)incidents=detail.events.join('||');
      if(minutes>0)duration=fmtDuration(minutes);
    } else {
      const detail=OPENAI_DETAILS[serviceName]&&OPENAI_DETAILS[serviceName][date];
      if(detail&&detail.titles&&detail.titles.length)incidents=detail.titles.join('||');
    }
    return '<div class="day '+status+'" data-side="'+side+'" data-service="'+escAttr(serviceName)+'" data-date="'+date+'" data-status="'+(STATUS_LABELS[status]||'Operational')+'" data-color="'+status+'" data-incidents="'+escAttr(incidents)+'" data-duration="'+escAttr(duration)+'" data-live="'+(liveOverride?'1':'0')+'" data-href="'+getStatusPage(side)+'"></div>';
  }).join('');
}

function currentStatusCode(serviceName,data){
  return CURRENT_STATUS[serviceName]||((data||'g').slice(-1)||'g');
}

function dotCls(serviceName,data){
  const status=currentStatusCode(serviceName,data);
  return {g:'ok',y:'deg',o:'part',r:'maj',b:'ok'}[status]||'ok';
}

function statusTxt(serviceName,data){
  const status=currentStatusCode(serviceName,data);
  return STATUS_LABELS[status]||'Operational';
}

function createTooltip(){
  if(tooltip)return tooltip;
  tooltip=document.createElement('div');
  tooltip.className='tip';
  document.body.appendChild(tooltip);
  return tooltip;
}

function showCustomTip(el,html){
  var tip=createTooltip();
  tip.innerHTML=html;
  var rect=el.getBoundingClientRect();
  var left=rect.left+rect.width/2-tip.offsetWidth/2;
  var top=rect.top-tip.offsetHeight-8;
  if(top<4)top=rect.bottom+8;
  if(left<4)left=4;
  if(left+tip.offsetWidth>window.innerWidth-4)left=window.innerWidth-tip.offsetWidth-4;
  tip.style.left=left+'px';
  tip.style.top=top+'px';
  tip.classList.add('show');
}

function showTip(el){
  const tip=createTooltip();
  const date=el.dataset.date;
  const color=el.dataset.color||'g';
  let html='<div class="tip-date">'+fmtDate(date)+'</div>';

  if(el.dataset.ov){
    const services=el.dataset.svcs.split('||').map(function(entry){
      const parts=entry.split(':');
      return {name:parts[0],status:parts[1]};
    });
    services.forEach(function(service){
      html+='<div class="tip-svc"><span class="ts-dot" style="background:'+STATUS_COLORS[service.status]+'"></span>'+service.name+': '+(STATUS_LABELS[service.status]||'OK')+'</div>';
    });
  } else {
    html+='<div class="tip-status"><span class="td" style="background:'+STATUS_COLORS[color]+'"></span>'+(el.dataset.status||'Operational')+(el.dataset.duration?' • '+el.dataset.duration:'')+'</div>';
    if(el.dataset.incidents){
      html+='<div class="tip-incidents"><div class="tip-lbl">Related</div>';
      el.dataset.incidents.split('||').forEach(function(item){
        html+='<div class="tip-incident"><span style="width:4px;height:4px;border-radius:50%;background:'+STATUS_COLORS[color]+';flex-shrink:0;margin-top:3px"></span>'+item+'</div>';
      });
      html+='</div>';
    } else if(el.dataset.live==='1'){
      html+='<div style="font-size:.45rem;color:var(--muted);margin-top:.1rem">Live current status from provider summary.</div>';
    } else if(color==='g'){
      html+='<div style="font-size:.45rem;color:var(--muted);margin-top:.1rem">No incidents recorded.</div>';
    }
  }

  tip.innerHTML=html;
  const rect=el.getBoundingClientRect();
  let left=rect.left+rect.width/2-tip.offsetWidth/2;
  let top=rect.top-tip.offsetHeight-8;
  if(top<4)top=rect.bottom+8;
  if(left<4)left=4;
  if(left+tip.offsetWidth>window.innerWidth-4)left=window.innerWidth-tip.offsetWidth-4;
  tip.style.left=left+'px';
  tip.style.top=top+'px';
  tip.classList.add('show');
}

function hideTip(){
  if(tooltip)tooltip.classList.remove('show');
}

function getDayCell(target){
  return target.closest('.bars .day, .ov-bars .day');
}

function bindDayInteractions(){
  function getTimelineCell(target){return target.closest('.tl-cell');}
  function getCatRow(target){return target.closest('.cat-row');}

  function showTimelineTip(el){
    var date=el.dataset.tlDate;
    var winner=el.dataset.tlWinner;
    var score=el.dataset.tlScore;
    var idx=parseInt(el.dataset.tlIdx,10);
    var winColor=winner==='Claude'?'var(--claude)':winner==='OpenAI'?'var(--openai)':'var(--muted)';
    var html='<div class="tip-date">'+fmtDate(date)+'</div>';
    html+='<div class="tip-status"><span class="td" style="background:'+winColor+'"></span>'+winner+(winner==='Tie'?'':' wins')+'</div>';

    if(tlDayData){
      var cSvcs=tlDayData.cPerDay[idx];
      var oSvcs=tlDayData.oPerDay[idx];
      var cScore=0;var oScore=0;
      var issues=[];
      cSvcs.forEach(function(s,si){
        var sc=STATUS_SCORE[s.status]||0;
        cScore+=C_WEIGHTS[si]*sc;
        if(s.status!=='g')issues.push({name:s.name,status:s.status,side:'c'});
      });
      oSvcs.forEach(function(s,si){
        var sc=STATUS_SCORE[s.status]||0;
        oScore+=O_WEIGHTS[si]*sc;
        if(s.status!=='g')issues.push({name:s.name,status:s.status,side:'o'});
      });
      html+='<div style="display:flex;gap:.5rem;font-size:.48rem;margin-top:.2rem;color:var(--muted-lt)">';
      html+='<span><span style="color:var(--claude);font-weight:600">Claude</span> '+cScore.toFixed(1)+'/8</span>';
      html+='<span><span style="color:var(--openai);font-weight:600">OpenAI</span> '+oScore.toFixed(1)+'/8</span>';
      html+='</div>';
      if(issues.length>0){
        html+='<div style="border-top:1px solid var(--border);padding-top:.2rem;margin-top:.2rem">';
        issues.forEach(function(iss){
          var col=iss.side==='c'?'var(--claude)':'var(--openai)';
          html+='<div style="font-size:.45rem;color:var(--muted-lt);display:flex;align-items:center;gap:4px;padding:1px 0"><span style="width:4px;height:4px;border-radius:50%;background:'+STATUS_COLORS[iss.status]+';flex-shrink:0"></span>'+iss.name+': '+(STATUS_LABELS[iss.status]||'OK')+'</div>';
        });
        html+='</div>';
      } else {
        html+='<div style="font-size:.42rem;color:var(--muted);margin-top:.15rem">All services operational</div>';
      }
    }
    html+='<div style="font-size:.42rem;color:var(--muted);margin-top:.15rem">Running: '+score+'</div>';
    showCustomTip(el,html);
  }

  function showCatTip(el){
    var title=el.dataset.catTitle;
    var cw=el.dataset.catCw;
    var ow=el.dataset.catOw;
    var tie=el.dataset.catTie;
    var cpct=el.dataset.catCpct;
    var opct=el.dataset.catOpct;
    var tpct=el.dataset.catTpct;
    var leader=el.dataset.catLeader;
    var html='<div class="tip-date">'+title+'</div>';
    html+='<div style="display:flex;gap:.6rem;margin-top:.2rem">';
    html+='<div style="font-size:.5rem"><span style="color:var(--claude);font-weight:700">Claude</span><div style="font-size:.7rem;font-weight:700;color:var(--claude-lt)">'+cw+' <span style="font-size:.45rem;color:var(--muted);font-weight:400">('+cpct+'%)</span></div></div>';
    html+='<div style="font-size:.5rem"><span style="color:var(--openai);font-weight:700">OpenAI</span><div style="font-size:.7rem;font-weight:700;color:var(--openai-lt)">'+ow+' <span style="font-size:.45rem;color:var(--muted);font-weight:400">('+opct+'%)</span></div></div>';
    html+='<div style="font-size:.5rem"><span style="color:var(--muted);font-weight:600">Tied</span><div style="font-size:.7rem;font-weight:700;color:var(--muted-lt)">'+tie+' <span style="font-size:.45rem;color:var(--muted);font-weight:400">('+tpct+'%)</span></div></div>';
    html+='</div>';
    showCustomTip(el,html);
  }

  document.addEventListener('click',function(event){
    const dayCell=getDayCell(event.target);
    if(dayCell){
      if(!SUPPORTS_HOVER){
        event.preventDefault();
        showTip(dayCell);
        return;
      }
      window.open(dayCell.dataset.href||getStatusPage(dayCell.dataset.side),'_blank','noopener');
      return;
    }
    var tlCell=getTimelineCell(event.target);
    if(tlCell&&!SUPPORTS_HOVER){showTimelineTip(tlCell);return;}
    var catRow=getCatRow(event.target);
    if(catRow&&!SUPPORTS_HOVER){showCatTip(catRow);return;}
    if(!SUPPORTS_HOVER&&!event.target.closest('.tip'))hideTip();
  });

  if(!SUPPORTS_HOVER)return;

  document.addEventListener('mouseover',function(event){
    const dayCell=getDayCell(event.target);
    if(dayCell){showTip(dayCell);return;}
    var tlCell=getTimelineCell(event.target);
    if(tlCell){showTimelineTip(tlCell);return;}
    var catRow=getCatRow(event.target);
    if(catRow){showCatTip(catRow);return;}
  });

  document.addEventListener('mouseout',function(event){
    if(getDayCell(event.target)||getTimelineCell(event.target)||getCatRow(event.target))hideTip();
  });
}

function applyDays(days){
  currentDays=days;
  const skip=TOTAL_DAYS-days;
  els.dayButtons.forEach(function(button){
    button.classList.toggle('active',parseInt(button.dataset.days,10)===days);
  });
  dataRows.forEach(function(row){
    row.style.gridTemplateColumns='repeat('+days+',1fr)';
    for(let i=0;i<row.children.length;i++)row.children[i].hidden=i<skip;
  });
  calcAvg(days);
  computeAndRenderStandings(days);
}

function bindChromeInteractions(){
  els.infoOpen.addEventListener('click',function(){
    els.drawerOverlay.classList.add('open');
  });
  els.drawerClose.addEventListener('click',function(){
    els.drawerOverlay.classList.remove('open');
  });
  els.drawerOverlay.addEventListener('click',function(event){
    if(event.target===els.drawerOverlay)els.drawerOverlay.classList.remove('open');
  });
  els.dayButtons.forEach(function(button){
    button.addEventListener('click',function(){
      applyDays(parseInt(button.dataset.days,10));
    });
  });
  els.themeToggle.addEventListener('click',function(){
    const isLight=document.documentElement.classList.toggle('light');
    els.themeToggle.innerHTML=isLight?THEME_ICONS.light:THEME_ICONS.dark;
  });
}

function buildOverview(cAgg,cPerDay,oAgg,oPerDay){
  function overviewBars(agg,perDay,side){
    return agg.split('').map(function(status,index){
      const services=perDay[index].map(function(service){return service.name+':'+service.status;}).join('||');
      return '<div class="day '+status+'" data-ov="1" data-side="'+side+'" data-date="'+DATES[index]+'" data-svcs="'+services+'" data-color="'+status+'"></div>';
    }).join('');
  }

  els.overview.innerHTML=
    '<div class="ov-row"><div class="ov-label">'+A_SM+' Claude<span class="ov-tag">tracked services</span></div><div class="ov-bars">'+overviewBars(cAgg,cPerDay,'c')+'</div></div>'+
    '<div class="ov-row"><div class="ov-bars">'+overviewBars(oAgg,oPerDay,'o')+'</div><div class="ov-label">'+O_SM+' OpenAI</div></div>'+
    '<div class="ov-meta"><div class="ov-time">90 days ago</div>'+
    '<div class="ov-legend">'+
    '<div class="lg"><span class="sw" style="background:var(--green)"></span>OK</div>'+
    '<div class="lg"><span class="sw" style="background:var(--yellow)"></span>Degraded</div>'+
    '<div class="lg"><span class="sw" style="background:var(--orange)"></span>Partial</div>'+
    '<div class="lg"><span class="sw" style="background:var(--red)"></span>Major</div>'+
    '</div><div class="ov-time">Today</div></div>';
}

function buildCards(){
  els.cards.replaceChildren();
  RACES.forEach(function(race,index){
    const cData=getClaudeDaily(race.c);
    const oData=getOpenAIDaily(race.o);
    const cUptime=UPTIME[race.c];
    const oUptime=UPTIME[race.o];
    const diff=Math.abs(cUptime-oUptime);
    const winner=cUptime===oUptime?'t':(cUptime>oUptime?'c':'o');
    const winnerLabel=winner==='c'?A_SM+' Claude leads':winner==='o'?O_SM+' OpenAI leads':'Tie';
    const winnerColor=winner==='c'?'var(--claude)':winner==='o'?'var(--openai)':'var(--muted)';
    const card=document.createElement('div');

    card.className='uptime-card'+(index===0?' full':'');
    card.innerHTML=
      '<div class="card-status"><div class="left"><span class="dot" style="background:'+winnerColor+'"></span><span>'+race.title+'</span></div><div class="right">'+winnerLabel+(diff>0?' (+'+diff.toFixed(2)+'%)':'')+'</div></div>'+
      '<div class="card-bars">'+
      '<div class="brand-tag c">'+A_SM+' '+race.c+'<span style="margin-left:auto;font-size:.55rem;color:var(--muted);font-weight:400">'+cUptime.toFixed(2)+'%</span></div>'+
      '<div class="bar-row"><div class="bars">'+renderBars(cData,'c',race.c)+'</div></div>'+
      '<div class="bar-row"><div class="bars">'+renderBars(oData,'o',race.o)+'</div></div>'+
      '<div class="brand-tag o">'+O_SM+' '+race.o+'<span style="margin-left:auto;font-size:.55rem;color:var(--muted);font-weight:400">'+oUptime.toFixed(2)+'%</span></div>'+
      '</div>'+
      '<div class="card-foot"><a href="'+STATUS_URLS.c+'" target="_blank" rel="noopener"><span class="sdot '+dotCls(race.c,cData)+'"></span>'+race.c+': '+statusTxt(race.c,cData)+'</a><a href="'+STATUS_URLS.o+'" target="_blank" rel="noopener">'+race.o+': '+statusTxt(race.o,oData)+'<span class="sdot '+dotCls(race.o,oData)+'"></span></a></div>';
    els.cards.appendChild(card);
  });
}

function buildDataBlocks(dayWinners,cDaysWon,oDaysWon,tiedDays,bigGapCat,trailerBestCat,bestComeback,cStreak,oStreak,catWins,numDays){
  var days=numDays||TOTAL_DAYS;
  var skip=TOTAL_DAYS-days;
  const displayedClaude=Object.fromEntries(C_NAMES.map(function(name){return [name,getClaudeDaily(name)];}));
  const displayedOpenAI=Object.fromEntries(O_NAMES.map(function(name){return [name,getOpenAIDaily(name)];}));
  const oLeads=oDaysWon>cDaysWon;
  const leader=oLeads?'OpenAI':'Claude';
  const leaderClass=oLeads?'o-hl':'c-hl';
  const leaderWins=Math.max(cDaysWon,oDaysWon);
  const trailerWins=Math.min(cDaysWon,oDaysWon);

  // Last 7 days
  const last7=dayWinners.slice(-7);
  const o7=last7.filter(function(v){return v==='o';}).length;
  const c7=last7.filter(function(v){return v==='c';}).length;
  const t7=last7.filter(function(v){return v==='t';}).length;
  var last7Leader=c7>o7?'Claude':o7>c7?'OpenAI':'Tied';
  var last7Class=c7>o7?'c-hl':o7>c7?'o-hl':'';

  // Incident days count (non-green days)
  var cIncidentDays=0;
  var oIncidentDays=0;
  for(var i=skip;i<TOTAL_DAYS;i++){
    var cWorst='g';
    C_NAMES.forEach(function(n,idx){
      var s=displayedClaude[n][i]||'g';
      if((STATUS_PRIORITY[s]||0)>(STATUS_PRIORITY[cWorst]||0))cWorst=s;
    });
    if(cWorst!=='g')cIncidentDays++;
    var oWorst='g';
    O_NAMES.forEach(function(n,idx){
      var s=displayedOpenAI[n][i]||'g';
      if((STATUS_PRIORITY[s]||0)>(STATUS_PRIORITY[oWorst]||0))oWorst=s;
    });
    if(oWorst!=='g')oIncidentDays++;
  }

  // Total Claude downtime minutes — filter to selected range
  var rangeDates={};
  for(var di=skip;di<TOTAL_DAYS;di++)rangeDates[DATES[di]]=true;
  var cTotalMins=0;
  Object.keys(CLAUDE_MINUTES).forEach(function(k){if(rangeDates[k])cTotalMins+=CLAUDE_MINUTES[k];});
  var cTotalHrs=(cTotalMins/60).toFixed(0);

  // OAI total incident count — filter to selected range
  var oTotalIncidents=0;
  var oIncidentDayCount=0;
  Object.keys(OAI_INCIDENTS).forEach(function(k){if(rangeDates[k]){oTotalIncidents+=OAI_INCIDENTS[k].length;oIncidentDayCount++;}});

  // Win rate
  var cWinRate=((cDaysWon/days)*100).toFixed(0);
  var oWinRate=((oDaysWon/days)*100).toFixed(0);

  // Clean days (both fully operational)
  var cleanDays=0;
  for(var j=skip;j<TOTAL_DAYS;j++){
    var allClean=true;
    C_NAMES.forEach(function(n){if((displayedClaude[n][j]||'g')!=='g')allClean=false;});
    O_NAMES.forEach(function(n){if((displayedOpenAI[n][j]||'g')!=='g')allClean=false;});
    if(allClean)cleanDays++;
  }

  // Category win breakdown for the bar
  var catHtml='';
  catWins.forEach(function(cat){
    var cPct=(cat.cW/days*100).toFixed(0);
    var oPct=(cat.oW/days*100).toFixed(0);
    var tPct=(cat.tie/days*100).toFixed(0);
    var catLeader=cat.cW>cat.oW?'Claude':cat.oW>cat.cW?'OpenAI':'Tied';
    catHtml+='<div class="cat-row" data-cat-title="'+cat.title+'" data-cat-cw="'+cat.cW+'" data-cat-ow="'+cat.oW+'" data-cat-tie="'+cat.tie+'" data-cat-cpct="'+cPct+'" data-cat-opct="'+oPct+'" data-cat-tpct="'+tPct+'" data-cat-leader="'+catLeader+'">';
    catHtml+='<div style="display:flex;justify-content:space-between;font-size:.45rem;color:var(--muted-lt);margin-bottom:.15rem"><span>'+cat.title+'</span><span><span class="c-hl">'+cat.cW+'</span> – <span class="o-hl">'+cat.oW+'</span> – '+cat.tie+'</span></div>';
    catHtml+='<div class="db-bar"><div class="seg" style="flex:'+cat.cW+';background:var(--claude)"></div><div class="seg" style="flex:'+cat.tie+';background:var(--muted)"></div><div class="seg" style="flex:'+cat.oW+';background:var(--openai)"></div></div>';
    catHtml+='</div>';
  });

  // Biggest gap
  var gapWinner=bigGapCat.oW>bigGapCat.cW?'OpenAI':'Claude';
  var gapClass=bigGapCat.oW>bigGapCat.cW?'o-hl':'c-hl';
  var gapDiff=Math.abs(bigGapCat.oW-bigGapCat.cW);

  // Comeback
  var cbSide=bestComeback.droughtLen>=3?(bestComeback.side==='c'?'Claude':'OpenAI'):'';
  var cbClass=bestComeback.side==='c'?'c-hl':'o-hl';

  // Build HTML — 2 rows in a 5-col grid
  var blocks='';

  // === ROW 1: Leader | Win Rate/Streak | Last 7 | Comeback | Claude Downtime ===
  blocks+='<div class="data-block"><div class="db-label">'+days+'-Day Leader</div>';
  blocks+='<div class="db-value"><span class="'+leaderClass+'">'+leader+'</span></div>';
  blocks+='<div class="db-detail">'+leaderWins+'W – '+trailerWins+'L – '+tiedDays+'T</div></div>';

  blocks+='<div class="data-block"><div class="db-label">Win Rate / Streak</div>';
  blocks+='<div class="db-split">';
  blocks+='<div class="db-split-item"><div class="db-split-val c-hl">'+cWinRate+'%</div><div class="db-split-label">'+cStreak+'d streak</div></div>';
  blocks+='<div class="db-split-item"><div class="db-split-val o-hl">'+oWinRate+'%</div><div class="db-split-label">'+oStreak+'d streak</div></div>';
  blocks+='</div></div>';

  blocks+='<div class="data-block"><div class="db-label">Last 7 Days</div>';
  blocks+='<div class="db-value">'+(last7Class?'<span class="'+last7Class+'">'+last7Leader+'</span>':last7Leader)+'</div>';
  blocks+='<div class="db-detail"><span class="c-hl">'+c7+'</span> – <span class="o-hl">'+o7+'</span> – '+t7+'</div></div>';

  blocks+='<div class="data-block"><div class="db-label">Biggest Comeback</div>';
  if(cbSide){
    blocks+='<div class="db-value"><span class="'+cbClass+'">'+bestComeback.droughtLen+'d</span></div>';
    blocks+='<div class="db-detail"><span class="'+cbClass+'">'+cbSide+'</span> broke drought</div>';
  } else {
    blocks+='<div class="db-value">—</div><div class="db-detail">No major droughts</div>';
  }
  blocks+='</div>';

  var cDaysAffected=0;
  Object.keys(CLAUDE_MINUTES).forEach(function(k){if(rangeDates[k])cDaysAffected++;});
  blocks+='<div class="data-block"><div class="db-label">Claude Downtime</div>';
  blocks+='<div class="db-value c-hl">'+cTotalHrs+'h</div>';
  blocks+='<div class="db-detail">'+cDaysAffected+' days affected</div></div>';

  // === ROW 2: Category Breakdown (span 3) | Incidents/Clean | OpenAI Incidents ===
  blocks+='<div class="data-block span-3"><div class="db-label">Category Breakdown</div>';
  blocks+='<div style="margin-top:.1rem">'+catHtml+'</div></div>';

  blocks+='<div class="data-block"><div class="db-label">Incidents / Clean</div>';
  blocks+='<div class="db-split">';
  blocks+='<div class="db-split-item"><div class="db-split-val c-hl">'+cIncidentDays+'</div><div class="db-split-label">Claude</div></div>';
  blocks+='<div class="db-split-item"><div class="db-split-val o-hl">'+oIncidentDays+'</div><div class="db-split-label">OpenAI</div></div>';
  blocks+='<div class="db-split-item"><div class="db-split-val">'+cleanDays+'</div><div class="db-split-label">Clean</div></div>';
  blocks+='</div>';
  blocks+='<div class="db-detail" style="margin-top:.15rem"><span class="'+gapClass+'">'+gapWinner+'</span> leads '+bigGapCat.title+' by '+gapDiff+'d</div></div>';

  blocks+='<div class="data-block"><div class="db-label">OpenAI Incidents</div>';
  blocks+='<div class="db-value o-hl">'+oTotalIncidents+'</div>';
  blocks+='<div class="db-detail">'+oIncidentDayCount+' days affected</div></div>';

  return '<div class="data-grid">'+blocks+'</div>';
}

function buildTimeline(dayWinners,runDiff,cPerDay,oPerDay){
  var skip=TOTAL_DAYS-dayWinners.length;
  tlDayData={cPerDay:cPerDay,oPerDay:oPerDay,dayWinners:dayWinners};
  var cells='';
  for(var i=0;i<dayWinners.length;i++){
    var w=dayWinners[i];
    var cls=w==='c'?'tl-c':w==='o'?'tl-o':'tl-t';
    var winLabel=w==='c'?'Claude':w==='o'?'OpenAI':'Tie';
    var rd=runDiff[i];
    var scoreLabel=rd>0?'Claude +'+rd:rd<0?'OpenAI +'+Math.abs(rd):'Even';
    cells+='<div class="tl-cell '+cls+'" data-tl-idx="'+i+'" data-tl-date="'+DATES[skip+i]+'" data-tl-winner="'+winLabel+'" data-tl-score="'+scoreLabel+'"></div>';
  }
  return '<div class="timeline-strip" style="grid-template-columns:repeat('+dayWinners.length+',1fr)">'+cells+'</div>';
}

function renderStandings(dayWinners,cDaysWon,oDaysWon,tiedDays,bigGapCat,trailerBestCat,bestComeback,cStreak,oStreak,runDiff,catWins,cPerDay,oPerDay,days){
  var numDays=days||TOTAL_DAYS;
  const dataBlocks=buildDataBlocks(dayWinners,cDaysWon,oDaysWon,tiedDays,bigGapCat,trailerBestCat,bestComeback,cStreak,oStreak,catWins,numDays);
  const timeline=buildTimeline(dayWinners,runDiff,cPerDay,oPerDay);
  els.standingsGrid.innerHTML=
    dataBlocks+
    '<div class="timeline-wrap">'+
    '<div class="timeline-header"><span class="tl-label">Daily Winner Timeline</span><span class="tl-legend"><span class="tl-lg"><span class="tl-sw" style="background:var(--claude)"></span>Claude</span><span class="tl-lg"><span class="tl-sw" style="background:var(--openai)"></span>OpenAI</span><span class="tl-lg"><span class="tl-sw" style="background:var(--muted)"></span>Tie</span></span></div>'+
    timeline+
    '<div class="timeline-meta"><span class="tl-time">'+numDays+' days ago</span><span class="tl-time">Today</span></div>'+
    '</div>';
}

function computeAndRenderStandings(days){
  var numDays=days||TOTAL_DAYS;
  var skip=TOTAL_DAYS-numDays;
  const allClaude=C_NAMES.map(function(name){return getClaudeDaily(name);});
  const allOpenAI=O_NAMES.map(function(name){return getOpenAIDaily(name);});
  const cPerDay=[];
  const oPerDay=[];
  const dayWinners=[];
  let cDaysWon=0;
  let oDaysWon=0;
  let tiedDays=0;
  let cStreak=0;
  let oStreak=0;
  let cCurrent=0;
  let oCurrent=0;

  for(let i=skip;i<TOTAL_DAYS;i++){
    let cMax='g';
    let oMax='g';
    let cDayScore=0;
    let oDayScore=0;
    const cServices=[];
    const oServices=[];

    C_NAMES.forEach(function(name,index){
      const status=allClaude[index][i]||'g';
      cServices.push({name:name,status:status});
      if((STATUS_PRIORITY[status]||0)>(STATUS_PRIORITY[cMax]||0))cMax=status;
      cDayScore+=C_WEIGHTS[index]*(STATUS_SCORE[status]||0);
    });
    O_NAMES.forEach(function(name,index){
      const status=allOpenAI[index][i]||'g';
      oServices.push({name:name,status:status});
      if((STATUS_PRIORITY[status]||0)>(STATUS_PRIORITY[oMax]||0))oMax=status;
      oDayScore+=O_WEIGHTS[index]*(STATUS_SCORE[status]||0);
    });

    cPerDay.push(cServices);
    oPerDay.push(oServices);
    if(cDayScore>oDayScore){
      cDaysWon++;
      cCurrent++;
      oCurrent=0;
      if(cCurrent>cStreak)cStreak=cCurrent;
      dayWinners.push('c');
    } else if(oDayScore>cDayScore){
      oDaysWon++;
      oCurrent++;
      cCurrent=0;
      if(oCurrent>oStreak)oStreak=oCurrent;
      dayWinners.push('o');
    } else {
      tiedDays++;
      cCurrent=0;
      oCurrent=0;
      dayWinners.push('t');
    }
  }

  const catWins=RACES.map(function(race){
    let cWins=0;
    let oWins=0;
    for(let i=skip;i<TOTAL_DAYS;i++){
      const cScore=STATUS_SCORE[CLAUDE_DAILY[race.c][i]||'g']||0;
      const oScore=STATUS_SCORE[OPENAI_DAILY[race.o][i]||'g']||0;
      if(cScore>oScore)cWins++;
      else if(oScore>cScore)oWins++;
    }
    return {title:race.title,cW:cWins,oW:oWins,tie:numDays-cWins-oWins};
  });

  let bigGapCat=catWins[0];
  let trailerBestCat=catWins[0];
  catWins.forEach(function(category){
    if(Math.abs(category.oW-category.cW)>Math.abs(bigGapCat.oW-bigGapCat.cW))bigGapCat=category;
    const oLeadsOverall=oDaysWon>cDaysWon;
    const trailerWins=oLeadsOverall?category.cW:category.oW;
    const bestTrailerWins=oLeadsOverall?trailerBestCat.cW:trailerBestCat.oW;
    if(trailerWins>bestTrailerWins)trailerBestCat=category;
  });

  const bestComeback={side:'',droughtLen:0,date:''};
  let cLosing=0;
  let oLosing=0;
  for(let i=0;i<numDays;i++){
    if(dayWinners[i]==='c'){
      if(oLosing>bestComeback.droughtLen){
        bestComeback.side='c';
        bestComeback.droughtLen=oLosing;
        bestComeback.date=DATES[skip+i];
      }
      oLosing=0;
      cLosing++;
    } else if(dayWinners[i]==='o'){
      if(cLosing>bestComeback.droughtLen){
        bestComeback.side='o';
        bestComeback.droughtLen=cLosing;
        bestComeback.date=DATES[skip+i];
      }
      cLosing=0;
      oLosing++;
    } else {
      cLosing++;
      oLosing++;
    }
  }

  const runDiff=[];
  let runningDiff=0;
  for(let i=0;i<numDays;i++){
    if(dayWinners[i]==='c')runningDiff++;
    else if(dayWinners[i]==='o')runningDiff--;
    runDiff.push(runningDiff);
  }

  renderStandings(dayWinners,cDaysWon,oDaysWon,tiedDays,bigGapCat,trailerBestCat,bestComeback,cStreak,oStreak,runDiff,catWins,cPerDay,oPerDay,numDays);
}

function render(){
  // Convert per-service daily strings into aggregate category outcomes for the overview bars.
  const allClaude=C_NAMES.map(function(name){return getClaudeDaily(name);});
  const allOpenAI=O_NAMES.map(function(name){return getOpenAIDaily(name);});
  let cAgg='';
  let oAgg='';
  const cPerDay=[];
  const oPerDay=[];

  for(let i=0;i<TOTAL_DAYS;i++){
    let cMax='g';
    let oMax='g';
    const cServices=[];
    const oServices=[];

    C_NAMES.forEach(function(name,index){
      const status=allClaude[index][i]||'g';
      cServices.push({name:name,status:status});
      if((STATUS_PRIORITY[status]||0)>(STATUS_PRIORITY[cMax]||0))cMax=status;
    });
    O_NAMES.forEach(function(name,index){
      const status=allOpenAI[index][i]||'g';
      oServices.push({name:name,status:status});
      if((STATUS_PRIORITY[status]||0)>(STATUS_PRIORITY[oMax]||0))oMax=status;
    });

    cAgg+=cMax;
    oAgg+=oMax;
    cPerDay.push(cServices);
    oPerDay.push(oServices);
  }

  buildOverview(cAgg,cPerDay,oAgg,oPerDay);
  buildCards();
  computeAndRenderStandings(currentDays);
  dataRows=Array.from(document.querySelectorAll('.bars, .ov-bars'));
}

function applyLiveData(data){
  CLAUDE_DAILY={...SEED_DATA.claudeDaily,...(data.claudeDaily||{})};
  OPENAI_DAILY={...SEED_DATA.openaiDaily,...(data.openaiDaily||{})};
  UPTIME={...SEED_DATA.uptime,...(data.uptime||{})};
  OAI_INCIDENTS=data.oaiIncidents||{};
  CLAUDE_MINUTES=data.claudeMinutes||{};
  CURRENT_STATUS={...SEED_DATA.currentStatus,...(data.currentStatus||{})};
  CLAUDE_DETAILS=data.claudeDetails||{};
  OPENAI_DETAILS=data.openaiDetails||{};
  DATA_UPDATED=data.updated||SEED_DATA.updated;
  DATES=Array.isArray(data.dates)&&data.dates.length===TOTAL_DAYS?data.dates:buildDates();
}

const LS_KEY='thenines:status';

function getCachedData(){
  try{
    const raw=localStorage.getItem(LS_KEY);
    if(!raw)return null;
    return JSON.parse(raw);
  }catch(e){return null;}
}

function setCachedData(data){
  try{localStorage.setItem(LS_KEY,JSON.stringify(data));}catch(e){}
}

async function fetchJSON(url){
  const res=await fetch(url);
  if(!res.ok)throw new Error(res.status);
  return res.json();
}

async function refreshCurrentStatus(shouldRender){
  try{
    const [claudeSummary,openaiSummary]=await Promise.all([
      fetchJSON('https://status.claude.com/api/v2/summary.json'),
      fetchJSON('https://status.openai.com/api/v2/summary.json')
    ]);
    const nextStatus={...CURRENT_STATUS};
    (claudeSummary.components||[]).forEach(function(component){
      const serviceName=CLAUDE_LIVE_COMPONENT_MAP[component.name];
      if(serviceName)nextStatus[serviceName]=API_STATUS_MAP[component.status]||'g';
    });
    Object.keys(OPENAI_LIVE_COMPONENT_GROUPS).forEach(function(groupName){
      nextStatus[groupName]=liveOpenAIGroupStatus(openaiSummary.components||[],groupName);
    });

    let changed=false;
    Object.keys(nextStatus).forEach(function(name){
      if(CURRENT_STATUS[name]!==nextStatus[name])changed=true;
    });
    CURRENT_STATUS=nextStatus;

    if(changed&&shouldRender){
      render();
      updateTimestamp();
      applyDays(currentDays);
    }
  }catch(e){}
}

async function loadLiveData(){
  try{
    const res=await fetch('/data/status.json');
    if(!res.ok)throw new Error(res.status);
    const data=await res.json();
    applyLiveData(data);
    setCachedData(data);
    return true;
  }catch(e){
    const cached=getCachedData();
    if(cached){applyLiveData(cached);return true;}
    return false;
  }
}

function updateTimestamp(){
  const age=Date.now()-new Date(DATA_UPDATED).getTime();
  const stale=age>60*60*1000;
  const liveDot=document.querySelector('.hero .live');
  if(liveDot)liveDot.style.background=stale?'var(--yellow)':'';
  els.timestamp.textContent='snapshot through '+fmtShortDate(DATES[DATES.length-1])+' UTC';
}

async function start(){
  els=getRequiredElements();
  if(!els)return;
  createStars();
  createTooltip();
  bindDayInteractions();
  bindChromeInteractions();
  await loadLiveData();
  await refreshCurrentStatus(false);
  render();
  updateTimestamp();
  els.loader.classList.add('hidden');
  applyDays(DEFAULT_DAYS);
  window.setInterval(function(){void refreshCurrentStatus(true);},LIVE_REFRESH_MS);
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',start,{once:true});
} else {
start();
}
