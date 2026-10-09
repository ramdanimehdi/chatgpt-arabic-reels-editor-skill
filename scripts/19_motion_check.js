/* Usage: node 19_motion_check.js <work>. Metadata checks complement visual QA. */
const fs=require('fs'),path=require('path'),motion=require('./18_motion_library.js');
const work=path.resolve(process.argv[2]||'.');
const plan=JSON.parse(fs.readFileSync(path.join(work,'motion-scenes.json'),'utf8'));
const total=JSON.parse(fs.readFileSync(path.join(work,'caps.json'),'utf8')).total;
motion.validatePlan(plan,total);
const times=motion.sampleTimes(plan,total);
fs.writeFileSync(path.join(work,'motion-preview-times.json'),JSON.stringify(times,null,2));
const metaFile=path.join(work,'motion-metadata.json');
if(fs.existsSync(metaFile)){
  const frames=JSON.parse(fs.readFileSync(metaFile,'utf8'));
  for(const frame of frames) for(const b of frame.texts||[]){
    if(![b.x,b.y,b.w,b.h,b.size].every(Number.isFinite)||b.size<26||b.x<40||b.y<150||b.x+b.w>900||b.y+b.h>1620)
      throw new Error('Unsafe or unreadable motion text at '+frame.time+': '+b.text);
    if(b.direction!=='rtl'||b.font!=='Cairo')throw new Error('Arabic motion requires Cairo and RTL');
  }
}
console.log(JSON.stringify({scenes:plan.scenes.length,previewTimes:times,layoutChecked:fs.existsSync(metaFile)}));
