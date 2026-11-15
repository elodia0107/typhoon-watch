const el = id => document.getElementById(id);
let snapshot;
let loadFailed = false;
const text = (node, value) => { node.textContent = value; };
const value = x => x === undefined || x === null || String(x).trim() === '' ? '暂无' : x;
function banner() {
  if (loadFailed) return;
  const age = Date.now() - Date.parse(snapshot.fetchedAt);
  const stale = !Number.isFinite(age) || age > 45 * 60 * 1000;
  el('status').textContent = `${stale ? '抓取数据已超过45分钟未更新，请核对官方信息。' : '真实来源快照 · 非即时观测推送。'} ${snapshot.activeCount ? `源站标记 ${snapshot.activeCount} 个活跃台风。` : '源站当前未标记活跃台风；下方仅展示历史记录。'} 抓取时间：${new Date(snapshot.fetchedAt).toLocaleString('zh-CN', {timeZone:'Asia/Shanghai',hour12:false})}（北京时间）`;
}
function pointText(p, forecast = false) {
  const node = el('pathinfo');
  node.textContent = `${forecast ? '预报点（中国）' : '实况记录'} · ${p.time}（北京时间）｜北纬 ${p.lat}°、东经 ${p.lng}°｜最大风力 ${value(p.power)} 级，风速 ${value(p.speed)} 米/秒`;
}
function render() {
  const storm = snapshot.storms[Number(el('stormSelect').value)];
  if (!storm) { el('stormTitle').textContent = '暂无台风记录'; el('observation').textContent = '源站没有返回可展示的台风。'; return; }
  const p = storm.points.at(-1);
  const active = storm.isactive === '1';
  el('stormTitle').textContent = `${storm.name} ${storm.enname} · ${storm.tfid}`;
  el('stormState').textContent = active ? '源站标记活跃' : '历史台风 · 已结束';
  const hours = (Date.now() - Date.parse(p.time.replace(' ', 'T') + '+08:00')) / 3600000;
  el('observation').textContent = `观测时间：${p.time}（北京时间）${active && hours > 6 ? ' · 观测已超过6小时，请核对源站' : ''}${active ? '' : ' · 历史记录，不代表当前实况'}`;
  const fields = [ [`${p.lat}°N`, `东经 ${p.lng}°E`], [value(p.movedirection), `移动速度 ${value(p.movespeed)} 公里/小时`], [`${value(p.power)} 级`, `最大风速 ${value(p.speed)} 米/秒`], [value(p.strong), '中心风力 ≠ 本地风力'] ];
  document.querySelectorAll('.metric').forEach((m,i) => {text(m.querySelector('.value'), fields[i][0]); text(m.querySelector('small'), fields[i][1]);});
  const forecast = active ? (p.forecast || []).find(f => f.tm === '中国')?.forecastpoints?.filter(f => f.time > p.time) || [] : [];
  draw(storm.points, forecast);
  pointText(p);
}
function draw(points, forecast) {
  const svg = el('track');
  svg.replaceChildren();
  const ns = 'http://www.w3.org/2000/svg';
  function add(tag, attrs, content) {const n = document.createElementNS(ns, tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(content)n.textContent=content;svg.append(n);return n;}
  const all = [...points, ...forecast];
  let minX = Math.min(...all.map(p=>+p.lng))-2, maxX = Math.max(...all.map(p=>+p.lng))+2;
  let minY = Math.min(...all.map(p=>+p.lat))-2, maxY = Math.max(...all.map(p=>+p.lat))+2;
  const scale = Math.min(680/(maxX-minX),350/(maxY-minY));
  const x = p=>400+(+p.lng-(minX+maxX)/2)*scale;
  const y = p=>235- (+p.lat-(minY+maxY)/2)*scale;
  add('title',{},'真实坐标台风轨迹图；经纬度平面示意，无地理底图');
  for(let i=0;i<=5;i++) {const a=minX+(maxX-minX)*i/5,b=minY+(maxY-minY)*i/5;const xx=x({lng:a}),yy=y({lat:b});add('line',{x1:xx,y1:35,x2:xx,y2:425,stroke:'#c5dce0'});add('text',{x:xx,y:452,fill:'#5d7f89','font-size':12,'text-anchor':'middle'},a.toFixed(1)+'°E');add('line',{x1:45,y1:yy,x2:755,y2:yy,stroke:'#c5dce0'});add('text',{x:5,y:yy,fill:'#5d7f89','font-size':11},b.toFixed(1)+'°N');}
  const line = list=>list.map(p=>`${x(p)},${y(p)}`).join(' ');
  add('polyline',{points:line(points),fill:'none',stroke:'#148b8c','stroke-width':3});
  if(forecast.length) add('polyline',{points:line([points.at(-1),...forecast]),fill:'none',stroke:'#d58d3c','stroke-width':3,'stroke-dasharray':'8 7'});
  all.forEach((p,i)=>{const future=i>=points.length;const n=add('circle',{cx:x(p),cy:y(p),r:i===points.length-1?9:5,fill:future?'#fff':'#148b8c',stroke:future?'#c57d29':'#fff','stroke-width':2,tabindex:0,role:'button','aria-label':`${p.time} ${future?'预报':'实况'}点`,class:'point'});n.addEventListener('click',()=>pointText(p,future));n.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pointText(p,future);}});});
}
async function load() {
  try {
    const r = await fetch(`data/typhoons.json?t=${Date.now()}`, {cache:'no-store'});
    if(!r.ok) throw Error('HTTP '+r.status);
    const data = await r.json();
    if(data.schemaVersion!==1 || !Array.isArray(data.storms) || !Number.isFinite(Date.parse(data.fetchedAt))) throw Error('数据格式无效');
    const old=el('stormSelect').value;
    snapshot=data;
    loadFailed=false;
    el('stormSelect').replaceChildren(...data.storms.map((s,i)=>new Option(`${s.name} · ${s.tfid}${s.isactive==='1'?'':'（历史）'}`,i)));
    if (el('stormSelect').options[old]) el('stormSelect').value=old;
    banner();render();
  } catch(error) {
    loadFailed=true;
    el('status').textContent='数据加载失败。请查看浙江台风源站；本页不能据此判断无台风或无预警。'+(snapshot?' 下方保留上一次记录。':'');
    if(!snapshot) el('stormTitle').textContent='暂时无法加载台风数据';
  }
}
el('stormSelect').addEventListener('change', render);
load();setInterval(load, 5*60*1000);
setInterval(()=>{if(snapshot)banner();},60*1000);
