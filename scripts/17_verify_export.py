#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""فحص ملف ريل نهائي: المدة، المسارات، اكتمال الفك، الصوت، وتجمّد الصورة."""
import argparse, json, math, os, re, subprocess, sys

def run(cmd, binary=False):
    p=subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                     text=not binary)
    if p.returncode:
        err=p.stderr.decode("utf-8","replace") if binary else p.stderr
        raise RuntimeError(err.strip() or "فشل الأمر")
    return p.stdout

def probe(path):
    return json.loads(run(["ffprobe","-v","error","-show_streams","-show_format",
                           "-of","json",path]))

def duration(info):
    vals=[info.get("format",{}).get("duration")]
    vals += [s.get("duration") for s in info.get("streams",[])]
    nums=[]
    for x in vals:
        try: nums.append(float(x))
        except (TypeError,ValueError): pass
    return max(nums) if nums else 0.0

def expected_from_work(work):
    if not work: return None, 0.0
    total=None; tail=0.0
    try:
        with open(os.path.join(work,"caps.json"),encoding="utf-8") as f:
            total=float(json.load(f)["total"])
    except Exception: pass
    try:
        with open(os.path.join(work,"sfx.json"),encoding="utf-8") as f:
            tail=float(json.load(f).get("outro",0) or 0)
    except Exception: pass
    return ((total+tail) if total is not None else None), tail

def silent(path):
    p=subprocess.run(["ffmpeg","-hide_banner","-nostats","-i",path,"-map","0:a:0",
                      "-af","volumedetect","-f","null","-"],stdout=subprocess.PIPE,
                     stderr=subprocess.PIPE,text=True)
    text=p.stdout+p.stderr
    m=re.search(r"max_volume:\s*(-?(?:inf|\d+(?:\.\d+)?))\s*dB",text,re.I)
    if not m: return True, None
    v=float("-inf") if m.group(1).lower()=="inf" else float(m.group(1))
    return v < -55.0, v

def frozen_runs(path, dur, ignore_tail):
    fps=5; w,h=64,114; frame=w*h
    data=run(["ffmpeg","-v","error","-i",path,"-vf",f"fps={fps},scale={w}:{h},format=gray",
              "-an","-f","rawvideo","-pix_fmt","gray","-"],binary=True)
    if len(data)<frame*2: return [(0.0,dur)]
    frames=[data[i:i+frame] for i in range(0,len(data)-frame+1,frame)]
    runs=[]; start=None
    cutoff=max(0.0,dur-ignore_tail)
    for i in range(1,len(frames)):
        t=i/fps
        if t>=cutoff: break
        a,b=frames[i-1],frames[i]
        mad=sum(abs(x-y) for x,y in zip(a,b))/frame
        still=mad < 0.10
        if still and start is None: start=(i-1)/fps
        if not still and start is not None:
            if t-start>=1.8: runs.append((start,t))
            start=None
    if start is not None and cutoff-start>=1.8: runs.append((start,cutoff))
    return runs

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--work")
    ap.add_argument("--expected",type=float)
    ap.add_argument("--allow-static-tail",type=float)
    args=ap.parse_args()
    video=os.path.abspath(args.video)
    if not os.path.isfile(video): sys.exit(f"❌ الملف غير موجود: {video}")
    info=probe(video); streams=info.get("streams",[])
    vs=[s for s in streams if s.get("codec_type")=="video"]
    au=[s for s in streams if s.get("codec_type")=="audio"]
    errors=[]
    if not vs: errors.append("لا يوجد مسار صورة")
    if not au: errors.append("لا يوجد مسار صوت")
    dur=duration(info)
    expected, outro=expected_from_work(os.path.abspath(args.work) if args.work else None)
    if args.expected is not None: expected=args.expected
    if expected is not None and abs(dur-expected)>0.45:
        errors.append(f"المدة {dur:.2f}ث لا تطابق المتوقعة {expected:.2f}ث")
    if vs:
        v=vs[0]
        if (v.get("width"),v.get("height"))!=(1080,1920):
            errors.append(f"المقاس {v.get('width')}×{v.get('height')} وليس 1080×1920")
        try:
            run(["ffmpeg","-v","error","-i",video,"-map","0:v:0","-f","null","-"])
        except RuntimeError as e: errors.append("مسار الصورة لا يُفك كاملًا: "+str(e)[:180])
    if au:
        try:
            is_silent, peak=silent(video)
            if is_silent: errors.append("مسار الصوت صامت أو شبه صامت")
        except Exception as e: errors.append("تعذر فحص الصوت: "+str(e)[:160]); peak=None
    else: peak=None
    tail=args.allow_static_tail if args.allow_static_tail is not None else max(1.6,outro)
    stalls=[]
    if vs and dur>2:
        try: stalls=frozen_runs(video,dur,tail)
        except Exception as e: errors.append("تعذر فحص تجمّد الصورة: "+str(e)[:160])
    if stalls:
        errors.append("تجمّد صورة طويل: "+", ".join(f"{a:.1f}–{b:.1f}ث" for a,b in stalls))
    if errors:
        print("❌ فشل فحص التصدير")
        for e in errors: print(" - "+e)
        return 1
    print(f"✅ التصدير سليم: {dur:.2f}ث · 1080×1920 · الصورة والصوت قابلان للفك")
    if peak is not None: print(f"   ذروة الصوت: {peak:.1f} dB")
    print("   لا يوجد تجمّد طويل قبل كرت النهاية")
    return 0

if __name__=="__main__":
    raise SystemExit(main())
