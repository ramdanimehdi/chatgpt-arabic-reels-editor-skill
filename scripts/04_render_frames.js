/* يركّب الفيديو + الموشن قرافيكس ويطلع فريمات.
   node 04_render_frames.js <workdir> all                       ← يكمّل من وين وقف (يتخطّى الموجود)
   node 04_render_frames.js <workdir> all --force               ← يعيد الرسم من الصفر
   node 04_render_frames.js <workdir> range 12.0 18.5           ← يعيد رسم نافذة وحدة بس (بعد تعديل مشهد)
   node 04_render_frames.js <workdir> preview 4.6 12.3 31.0     */
const path=require('path'), fs=require('fs');
const W=path.resolve(process.argv[2])+path.sep;
const CFG=JSON.parse(fs.readFileSync(W+'sfx.json','utf8'));       // فيه outro
const THEME=fs.existsSync(W+'theme.json')?JSON.parse(fs.readFileSync(W+'theme.json','utf8')):{};
const BEHIND=fs.existsSync(W+'behind.json')?JSON.parse(fs.readFileSync(W+'behind.json','utf8')):null;  // الكلام ورا الشخص
const OUT_COPY=fs.existsSync(W+'outro.json')?JSON.parse(fs.readFileSync(W+'outro.json','utf8')):{};
const STAGE=fs.existsSync(W+'stage.json')?JSON.parse(fs.readFileSync(W+'stage.json','utf8')):[{s:0,e:9999,m:'FULL'}];
const MOTION=fs.existsSync(W+'motion-scenes.json')?JSON.parse(fs.readFileSync(W+'motion-scenes.json','utf8')):null;
if(MOTION&&fs.existsSync(W+'audio-envelope.json'))MOTION.envelope=JSON.parse(fs.readFileSync(W+'audio-envelope.json','utf8'));
const MOTION_META=[];
const OUT_D=Number(CFG.outro??0), FPS=30;
if(!Number.isFinite(OUT_D)||OUT_D<0)throw new Error('Invalid outro duration');
function resolvePuppeteer(){
  for(const p of [process.env.PUPPETEER_PATH,'puppeteer-core','puppeteer',
      path.join(__dirname,'node_modules/puppeteer-core'),
      path.join(process.cwd(),'node_modules/puppeteer-core')]) {
    if(!p) continue; try{ return require(p); }catch(e){}
  }
  throw new Error('ما لقيت puppeteer-core — ثبّته: npm i puppeteer-core');
}
function resolveChrome(puppeteer){
  const c=[process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser',
    '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
    '/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe'];
  try{c.push(puppeteer.executablePath());}catch(e){}
  const hit=c.find(p=>p&&fs.existsSync(p));
  if(!hit) throw new Error('ما لقيت Chrome أو Chromium — ثبّته أو حدّد CHROME_PATH');
  return hit;
}
(async()=>{
  const puppeteer=resolvePuppeteer();
  const CHROME=resolveChrome(puppeteer);
  const mode=process.argv[3]||'all';
  const caps=JSON.parse(fs.readFileSync(W+'caps.json','utf8'));
  const NVF=fs.readdirSync(W+'vfr').filter(f=>f.endsWith('.jpg')).length;
  const dur=Number(caps.total)+OUT_D;
  if(!Number.isFinite(dur)||dur<=0||NVF<1)throw new Error('Invalid duration or missing source frames');
  const b=await puppeteer.launch({executablePath:CHROME,headless:'new',
    args:['--no-sandbox','--allow-file-access-from-files','--font-render-hinting=none','--force-color-profile=srgb']});
  try {
  const p=await b.newPage();
  p.on('pageerror',e=>console.log('PAGEERR',e.message));
  await p.setViewport({width:1080,height:1920,deviceScaleFactor:1});
  await p.setCacheEnabled(false);   // لا تقرأ نسخة مخبّأة من compose.html
  await p.goto('file://'+W+'compose.html',{waitUntil:'networkidle0'});
  if(MOTION){
    require('./18_motion_library.js').validatePlan(MOTION,caps.total);
    await p.addScriptTag({path:path.join(__dirname,'18_motion_library.js')});
  }
  await p.evaluate((c,o,t,b,oc,st,m)=>window.init({cards:c.cards,total:c.total,outro:o,theme:t,behind:b,outroCopy:oc,stage:st,motion:m}),caps,OUT_D,THEME,BEHIND,OUT_COPY,STAGE,MOTION);
  const FF=THEME.font||'Cairo';
  const fontOK=await p.evaluate(async f=>{
    const weights=['400','600','700','800','900'];
    await Promise.all(weights.map(w=>document.fonts.load(w+' 60px '+f,'عربي ـ 123')));
    await document.fonts.ready;
    return (await document.fonts.load('800 60px '+f,'عربي')).length>0&&weights.every(w=>document.fonts.check(w+' 60px '+f,'عربي'));
  },FF);
  if(!fontOK)throw new Error('Arabic font did not load; export stopped to avoid fallback text');
  await p.evaluate(()=>new Promise(r=>{const l=document.getElementById('LOGO');if(l.complete)return r();l.onload=r;l.onerror=r;}));
  const grab=async(t,file,q)=>{
    const i=Math.min(NVF,Math.max(1,Math.round(t*FPS)+1));
    const id=String(i).padStart(5,'0');
    await p.evaluate(s=>window.setFrame(s),'file://'+W+'vfr/'+id+'.jpg');
    if(BEHIND){                                   // صورة الشخص المقصوص لهالفريم (إن وُجدت)
      const inR=BEHIND.ranges.some(r=>i>=r[0]&&i<=r[1]);
      const pf=W+'bt/person/'+id+'.png';
      const ok=inR&&fs.existsSync(pf);
      await p.evaluate((s,f)=>window.setPerson(s,f), ok?('file://'+pf):null, (BEHIND.faces&&BEHIND.faces[i])||null);
    }
    const d=await p.evaluate((t,q)=>{window.draw(t);return window.shot(q);},t,q);
    fs.writeFileSync(file,Buffer.from(d.split(',')[1],'base64'));
    if(MOTION)MOTION_META.push({time:t,...await p.evaluate(()=>window.CFSMotionMetadata||{texts:[]})});
  };
  if(mode==='preview'){
    fs.mkdirSync(W+'prev',{recursive:true});
    for(const t of process.argv.slice(4).map(Number)){await grab(t,W+'prev/t'+t.toFixed(2)+'.jpg',0.9);console.log('معاينة',t);}
  }else{
    fs.mkdirSync(W+'out',{recursive:true});
    const n=Math.round(dur*FPS);
    const force=process.argv.includes('--force');
    const cache=require('./21_render_cache.js').prepare(W,mode,n,[__filename,path.join(__dirname,'18_motion_library.js')],force);
    if(cache.invalidated)console.log('Design changed: refreshing cached output frames');
    let i0=0,i1=n;                       // نافذة زمنية اختيارية — تُعاد كتابتها دائماً
    if(mode==='range'){
      const a=Number(process.argv[4]), b=Number(process.argv[5]);
      if(!isFinite(a)||!isFinite(b)) throw new Error('range يحتاج وقتين: <من> <إلى>');
      i0=Math.max(0,Math.floor(a*FPS)); i1=Math.min(n,Math.ceil(b*FPS)+1);
    }
    const done=f=>{try{return fs.statSync(f).size>2000;}catch(e){return false;}};
    let skipped=0,drawn=0;
    for(let i=i0;i<i1;i++){
      const f=W+'out/'+String(i).padStart(5,'0')+'.jpg';
      if(mode==='all'&&!force&&done(f)){skipped++;continue;}
      await grab(i/FPS,f,0.95); drawn++;
      if(drawn%150===1)console.log('فريم',i,'/',i1);
    }
    if(skipped)console.log('تخطّى',skipped,'فريماً جاهزاً (استئناف) — --force يعيد الكل');
    console.log('تم',drawn,'فريم مرسوم من',n,'— المدة',dur.toFixed(3));
    if(mode!=='range'){                  // ناقص فريم = تجميع مكسور، لازم ينكشف الحين
      let miss=0; for(let i=0;i<n;i++) if(!done(W+'out/'+String(i).padStart(5,'0')+'.jpg')) miss++;
      if(miss||drawn+skipped===0)throw new Error('Incomplete export: '+miss+' missing frames');
    }
  }
  if(MOTION)fs.writeFileSync(W+'motion-metadata.json',JSON.stringify(MOTION_META));
  } finally { await b.close(); }
  // اخرج بوضوح بعد إغلاق Chromium حتى لا يبقى الراسم معلقاً بسبب مؤقتات الصفحة.
  setTimeout(()=>process.exit(0),300);
})().catch(e=>{console.error(e.message);process.exit(1);});

