/* Conservative frame cache. Inspired by video-ad-editor; keeps current renderer. */
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const numericFrame=/^\d{5,}\.jpg$/;
const excluded=new Set(['out','prev','vfr','bt','node_modules','.git']);
const outputs=new Set(['motion-metadata.json','motion-preview-times.json','render-manifest.json','motion-choice.json','scopes.json']);
function fingerprint(work,runtimeFiles=[]){
  const h=crypto.createHash('sha256');const visited=new Set();
  function visit(f,deep=false){
    f=path.resolve(f);if(visited.has(f))return;visited.add(f);
    if(!fs.existsSync(f)){h.update(f+':missing');return;}
    const st=fs.statSync(f);
    if(st.isDirectory()){
      for(const name of fs.readdirSync(f).sort()){
        if(excluded.has(name)||outputs.has(name)||name.startsWith('.'))continue;
        const child=path.join(f,name);
        if(fs.statSync(child).isDirectory())visit(child,true);
        else if(/\.(json|js|html|css|svg|png|jpe?g|webp|woff2?|ttf|otf)$/i.test(name))visit(child,true);
      }
      return;
    }
    h.update(f);
    if(st.size<16*1024*1024)h.update(fs.readFileSync(f));
    else h.update(st.size+':'+st.mtimeMs);
    // Include linked local dependencies outside the work folder.
    if(/\.(html|css)$/i.test(f)){
      const text=fs.readFileSync(f,'utf8');
      for(const m of text.matchAll(/(?:src|href)=["']([^"']+)["']/g)){
        if(!/^(https?:|data:|#)/.test(m[1]))visit(path.resolve(path.dirname(f),m[1]));
      }
    }
  }
  visit(work,true);for(const f of runtimeFiles)visit(f,true);
  // Generated source/mask frames also change the image, but hashing media every
  // time is expensive. Their sorted names, sizes and mtimes invalidate reuse.
  for(const folder of ['vfr','bt']){
    const walk=dir=>{if(!fs.existsSync(dir))return;for(const n of fs.readdirSync(dir).sort()){
      const f=path.join(dir,n),s=fs.statSync(f);if(s.isDirectory())walk(f);else h.update(f+':'+s.size+':'+s.mtimeMs);
    }};walk(path.join(work,folder));
  }
  return h.digest('hex');
}
function prepare(work,mode,totalFrames,runtimeFiles=[],force=false){
  if(!Number.isInteger(totalFrames)||totalFrames<1)throw new Error('Invalid frame count');
  const dir=path.join(work,'out'),manifest=path.join(dir,'.render-state.json');
  fs.mkdirSync(dir,{recursive:true});
  const hash=fingerprint(work,runtimeFiles);let old=null;
  try{old=JSON.parse(fs.readFileSync(manifest,'utf8'));}catch{}
  const changed=!old||old.hash!==hash||old.frames!==totalFrames;
  if(mode==='range'&&changed)throw new Error('Design changed: render all before using range; old frames cannot be reused safely');
  const invalidated=(mode==='all')&&(changed||force);
  if(invalidated)for(const f of fs.readdirSync(dir))if(numericFrame.test(f))fs.unlinkSync(path.join(dir,f));
  if(mode==='all')fs.writeFileSync(manifest,JSON.stringify({version:1,hash,frames:totalFrames}));
  return {invalidated,hash};
}
module.exports={fingerprint,prepare};
