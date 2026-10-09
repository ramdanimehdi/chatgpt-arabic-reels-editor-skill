/* Local Canvas2D motion; no services, keys, wall clock or external dependencies. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.CFSMotion=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const clamp=x=>Math.max(0,Math.min(1,x));
  const progress=(t,a,b)=>clamp((t-a)/(b-a));
  const ease=x=>1-Math.pow(1-clamp(x),3);
  const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
  const kinds=new Set(['grid-title','blueprint-flow','pictogram-delivery']);
  const western=s=>String(s).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776));
  function validatePlan(plan,total=Infinity){
    if(!plan||!Array.isArray(plan.scenes)) throw new Error('motion-scenes.json requires scenes[]');
    const sorted=[...plan.scenes].sort((a,b)=>a.start-b.start);
    sorted.forEach((s,i)=>{
      if(!Number.isFinite(s.start)||!Number.isFinite(s.end)||s.start<0||s.end>total||s.end-s.start<2.2)
        throw new Error('Motion scene requires valid times and at least 2.2 seconds');
      if(!kinds.has(s.kind)) throw new Error('Unknown motion kind: '+s.kind);
      if(typeof s.title!=='string'||!s.title.trim()||s.title.length>70) throw new Error('Use a short title');
      if(s.kind!=='grid-title'&&(!Array.isArray(s.labels)||s.labels.length!==3||s.labels.some(x=>typeof x!=='string'||!x.trim()||x.length>22)))
        throw new Error('Flow and delivery require exactly three short labels');
      if(i&&s.start<sorted[i-1].end) throw new Error('Motion scenes overlap');
      const r=s.box||{x:70,y:1110,w:820,h:360};
      if(![r.x,r.y,r.w,r.h].every(Number.isFinite)||r.w<600||r.h<300||r.x<40||r.y<150||r.x+r.w>900||r.y+r.h>1620)
        throw new Error('Motion panel is outside the 1080x1920 safe area');
    });
    return plan;
  }
  function activeScene(plan,t){return (plan?.scenes||[]).find(s=>t>=s.start&&t<s.end);}
  function sampleTimes(plan,total){
    validatePlan(plan,total);
    const times=new Set();
    for(const s of plan.scenes){
      for(const boundary of [s.start,s.start+.7,s.end-.18,s.end])
        for(const offset of [-.2,0,.2]){const t=Math.round((boundary+offset)*30)/30;if(t>=0&&t<total)times.add(t);}
      times.add(Math.round((s.start+s.end)/2*30)/30);
    }
    return [...times].sort((a,b)=>a-b);
  }
  function draw(ctx,plan,t,theme={}){
    const s=activeScene(plan,t),meta={texts:[],hideCaptions:!!s,scene:s?.id||s?.kind||null};
    if(!s) return meta;
    const r=s.box||{x:70,y:1110,w:820,h:360};
    const bg=theme.bg||'#1A2A4A',ink=theme.ink||'#FFFFFF',acc=theme.acc||'#E8610A',font=theme.font||'Cairo';
    const lt=t-s.start;
    const alpha=ease(progress(lt,0,.22))*progress(s.end-t,0,.18);
    ctx.save();ctx.globalAlpha*=alpha;ctx.direction='rtl';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle=bg;ctx.beginPath();ctx.roundRect(r.x,r.y,r.w,r.h,28);ctx.fill();
    ctx.save();ctx.beginPath();ctx.rect(r.x+16,r.y+16,r.w-32,r.h-32);ctx.clip();
    const text=(value,x,y,size,maxw)=>{
      value=western(value);ctx.font='800 '+size+'px '+font;
      while(ctx.measureText(value).width>maxw&&size>26){size-=1;ctx.font='800 '+size+'px '+font;}
      const w=ctx.measureText(value).width;if(w>maxw)throw new Error('Shorten motion label: '+value);ctx.fillStyle=ink;ctx.fillText(value,x,y);
      meta.texts.push({text:value,x:x-w/2,y:y-size*.7,w,h:size*1.4,size,font,direction:'rtl',scene:meta.scene});
    };
    if(s.kind==='grid-title'){
      const k=ease(progress(lt,.1,.55));
      ctx.save();ctx.beginPath();ctx.rect(r.x+r.w*(1-k),r.y,r.w*k,r.h);ctx.clip();
      text(s.title,r.x+r.w/2,r.y+r.h/2,70,r.w-90);ctx.restore();
      ctx.fillStyle=acc;ctx.fillRect(r.x+r.w-40,r.y+36,7,(r.h-72)*k);
    }else{
      text(s.title,r.x+r.w/2,r.y+54,42,r.w-70);
      const nodeY=r.y+r.h*.52,step=(r.w-170)/2,xs=[r.x+r.w-85,r.x+r.w-85-step,r.x+85];
      for(let i=0;i<2;i++){
        const k=ease(progress(lt,.32+i*.15,.66+i*.15));
        ctx.strokeStyle=acc;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(xs[i]-42,nodeY);ctx.lineTo(xs[i]-42+(xs[i+1]+42-xs[i]+42)*k,nodeY);ctx.stroke();
      }
      for(let i=0;i<3;i++){
        const k=ease(progress(lt,.12+i*.13,.48+i*.13));
        ctx.save();ctx.globalAlpha*=k;ctx.translate(xs[i],nodeY+(1-k)*18);ctx.strokeStyle=ink;ctx.lineWidth=4;
        if(s.kind==='blueprint-flow'){ctx.beginPath();ctx.roundRect(-40,-32,80,64,10);ctx.stroke();}
        else if(i===0){ctx.strokeRect(-27,-35,54,70);ctx.beginPath();ctx.moveTo(-15,-10);ctx.lineTo(15,-10);ctx.moveTo(-15,5);ctx.lineTo(10,5);ctx.stroke();}
        else if(i===1){ctx.strokeRect(-34,-23,68,46);ctx.beginPath();ctx.moveTo(-34,-23);ctx.lineTo(0,3);ctx.lineTo(34,-23);ctx.stroke();}
        else{ctx.beginPath();ctx.arc(0,0,33,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(-15,0);ctx.lineTo(-3,12);ctx.lineTo(17,-13);ctx.stroke();}
        ctx.restore();
        text(s.labels[i],xs[i],nodeY+83,32,step-30);
      }
      // A single token carries meaning across the same RTL path, then settles.
      const k=smooth(progress(lt,.65,1.25)),segment=Math.min(1,Math.floor(k*2)),part=k*2-segment;
      const x=xs[segment]+(xs[segment+1]-xs[segment])*part;
      ctx.fillStyle=acc;ctx.beginPath();ctx.arc(x,nodeY,8,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();ctx.restore();return meta;
  }
  return {validatePlan,activeScene,sampleTimes,draw};
});
