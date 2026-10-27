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
  const kinds=new Set(['grid-title','blueprint-flow','pictogram-delivery','highlight','checklist','notifications','compare','voice-wave']);
  const western=s=>String(s).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776));
  function validatePlan(plan,total=Infinity){
    if(!plan||!Array.isArray(plan.scenes)) throw new Error('motion-scenes.json requires scenes[]');
    const sorted=[...plan.scenes].sort((a,b)=>a.start-b.start);
    sorted.forEach((s,i)=>{
      if(!Number.isFinite(s.start)||!Number.isFinite(s.end)||s.start<0||s.end>total||s.end-s.start<2.2)
        throw new Error('Motion scene requires valid times and at least 2.2 seconds');
      if(!kinds.has(s.kind)) throw new Error('Unknown motion kind: '+s.kind);
      if(typeof s.title!=='string'||!s.title.trim()||s.title.length>70) throw new Error('Use a short title');
      const count=s.kind==='compare'?2:3;
      if(!['grid-title','highlight','voice-wave'].includes(s.kind)&&(!Array.isArray(s.labels)||s.labels.length!==count||s.labels.some(x=>typeof x!=='string'||!x.trim()||x.length>22)))
        throw new Error('Use '+count+' short labels for '+s.kind);
      if(s.surface&&!['clean','paper','blueprint'].includes(s.surface))throw new Error('Unknown motion surface');
      if(s.kind==='voice-wave'&&(!plan.envelope||!Number.isFinite(plan.envelope.fps)||plan.envelope.fps<=0||!Array.isArray(plan.envelope.values)||plan.envelope.values.some(v=>!Number.isFinite(v)||v<0||v>1)))
        throw new Error('Generate audio-envelope.json from the clean audio before using voice-wave');
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
    // Deterministic surface details; retain the current brand palette and font.
    if(s.surface==='paper'){
      ctx.save();ctx.strokeStyle=ink;ctx.globalAlpha*=.12;ctx.setLineDash([9,7]);ctx.lineWidth=2;ctx.strokeRect(r.x+9,r.y+9,r.w-18,r.h-18);ctx.restore();
    }else if(s.surface==='blueprint'){
      ctx.save();ctx.strokeStyle=ink;ctx.globalAlpha*=.07;ctx.lineWidth=1;
      for(let x=r.x+20;x<r.x+r.w;x+=40){ctx.beginPath();ctx.moveTo(x,r.y+10);ctx.lineTo(x,r.y+r.h-10);ctx.stroke();}
      for(let y=r.y+20;y<r.y+r.h;y+=40){ctx.beginPath();ctx.moveTo(r.x+10,y);ctx.lineTo(r.x+r.w-10,y);ctx.stroke();}ctx.restore();
    }
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
    }else if(s.kind==='highlight'){
      const k=ease(progress(lt,.15,.65));ctx.fillStyle=acc;
      ctx.fillRect(r.x+40+r.w*.82*(1-k),r.y+r.h*.6,r.w*.82*k,14);
      text(s.title,r.x+r.w/2,r.y+r.h*.45,64,r.w-90);
    }else if(s.kind==='voice-wave'){
      text(s.title,r.x+r.w/2,r.y+58,42,r.w-70);
      const env=plan.envelope,idx=Math.floor(t*env.fps),at=i=>env.values[Math.max(0,Math.min(env.values.length-1,i))]||0;
      ctx.fillStyle=acc;
      for(let i=0;i<35;i++){const h=8+Math.min(135,at(idx-Math.abs(i-17))*135),x=r.x+55+i*(r.w-110)/34;ctx.fillRect(x-5,r.y+r.h*.6-h/2,10,h);}
    }else if(s.kind==='checklist'||s.kind==='notifications'){
      text(s.title,r.x+r.w/2,r.y+48,40,r.w-70);
      s.labels.forEach((label,i)=>{
        const k=ease(progress(lt,.15+i*.2,.5+i*.2));ctx.save();ctx.globalAlpha*=k;
        const y=r.y+115+i*77,dx=s.kind==='notifications'?(1-k)*70:0;
        ctx.translate(dx,0);ctx.strokeStyle=acc;ctx.lineWidth=3;
        if(s.kind==='notifications'){ctx.beginPath();ctx.roundRect(r.x+45,y-29,r.w-90,61,12);ctx.stroke();}
        else{ctx.beginPath();ctx.moveTo(r.x+r.w-86,y);ctx.lineTo(r.x+r.w-77,y+10);ctx.lineTo(r.x+r.w-60,y-12);ctx.stroke();}
        text(label,r.x+r.w/2-(s.kind==='checklist'?20:0),y,34,r.w-190);ctx.restore();
      });
    }else if(s.kind==='compare'){
      text(s.title,r.x+r.w/2,r.y+55,42,r.w-70);
      const k=ease(progress(lt,.25,.85));
      ctx.strokeStyle=acc;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(r.x+r.w/2,r.y+105);ctx.lineTo(r.x+r.w/2,r.y+105+(r.h-145)*k);ctx.stroke();
      s.labels.forEach((label,i)=>{const x=r.x+r.w*(i===0?.75:.25);text(label,x,r.y+r.h*.58,42,r.w*.4);});
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
