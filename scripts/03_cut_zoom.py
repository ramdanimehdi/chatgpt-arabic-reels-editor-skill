# -*- coding: utf-8 -*-
"""قص السكتات + زوم مختلف لكل مقطع + تدرّج دافئ.  python3 03_cut_zoom.py <workdir>"""
import json, subprocess, sys, os, math
W=os.path.abspath(sys.argv[1]); SRC=os.path.join(W,"src.mov")
k=json.load(open(os.path.join(W,"cut.json")))["keep"]
_tp=os.path.join(W,"theme.json")
THEME=json.load(open(_tp)) if os.path.exists(_tp) else {}
GRADE=THEME.get("grade",False)
CALM=str(THEME.get("pace","")).lower()=="calm"
Z=([1.00,1.00,1.04,1.00,1.00,1.06,1.00,1.03] if CALM
   else [1.00,1.08,1.00,1.06,1.00,1.12,1.04,1.14,1.00,1.08,1.00,1.05,1.10,1.00])
MINHOLD=4.0 if CALM else 0.0
ANCH=max(0.0,min(1.0,float(THEME.get("faceAnchor",0.30))))
p=subprocess.run(["ffprobe","-v","error","-select_streams","v:0","-show_entries",
   "stream=width,height","-of","csv=p=0:s=x",SRC],capture_output=True,text=True).stdout.strip()
SW,SH=[int(x) for x in p.split("x")[:2]]
def _hdr_to_sdr(src):
    """حوّل HLG/PQ قبل القص؛ لا تكتفِ بتغيير وسم اللون."""
    try:
        ct=subprocess.run(
            ["ffprobe","-v","error","-select_streams","v:0","-show_entries",
             "stream=color_transfer","-of","csv=p=0",src],
            capture_output=True,text=True
        ).stdout.strip().strip(",")
    except Exception:
        return src
    if ct not in ("arib-std-b67","smpte2084"):
        return src
    here=os.path.dirname(os.path.abspath(__file__))
    swift=os.path.join(here,"hdr2sdr.swift"); binp=os.path.join(W,"hdr2sdr")
    out=os.path.join(W,"src_sdr.mov")
    if os.path.exists(out): return out
    if sys.platform=="darwin" and os.path.exists(swift):
        if not os.path.exists(binp):
            r=subprocess.run(["swiftc","-O","-o",binp,swift],capture_output=True)
            if r.returncode!=0: binp=""
        if binp:
            print("🎨 تحويل HDR إلى SDR مع الحفاظ على مظهر الآيفون…")
            r=subprocess.run([binp,src,out])
            if r.returncode==0 and os.path.exists(out): return out
    print("🎨 تحويل HDR إلى SDR بالمسار المتوافق…")
    filters=subprocess.run(["ffmpeg","-hide_banner","-filters"],capture_output=True,text=True).stdout
    if " zscale " in filters:
        vf=("zscale=t=linear:npl=100,format=gbrpf32le,"
            "zscale=p=bt709,tonemap=tonemap=hable:desat=0,"
            "zscale=t=bt709:m=bt709:r=tv,format=yuv420p")
    else:
        vf=f"colorspace=all=bt709:iall=bt2020:itrc={ct}:fast=1,format=yuv420p"
    r=subprocess.run(["ffmpeg","-v","error","-stats","-i",src,"-vf",vf,
                      "-c:v","libx264","-crf","16","-preset","medium","-c:a","copy",
                      "-movflags","+faststart","-y",out])
    if r.returncode==0 and os.path.exists(out): return out
    if os.path.exists(out): os.remove(out)
    raise SystemExit("❌ تعذر تحويل HDR إلى SDR؛ لا يمكن متابعة التصدير بألوان غير مضمونة")

SRC=_hdr_to_sdr(SRC)
# ثبّت حدود القص على فريمات 30fps، وارفض التداخل أو المقاطع القصيرة جدًا.
aligned=[]; prev=0.0
for i,pair in enumerate(k):
    if not isinstance(pair,(list,tuple)) or len(pair)!=2:
        raise SystemExit(f"❌ مقطع القص {i+1} غير صالح")
    s,e=map(float,pair)
    if not (math.isfinite(s) and math.isfinite(e)) or s<0 or e<=s:
        raise SystemExit(f"❌ حدود القص {i+1} غير صالحة: {pair}")
    s=math.floor(s*30)/30; e=math.ceil(e*30)/30
    if s<prev: s=prev
    if e-s<0.10:
        raise SystemExit(f"❌ مقطع القص {i+1} أقصر من 0.10ث بعد محاذاة الفريم")
    aligned.append((s,e)); prev=e
k=aligned
fc=[];v=[];a=[]
zi=0; held=0.0
for i,(s,e) in enumerate(k):
    if i and (not CALM or held>=MINHOLD): zi+=1; held=0.0
    held+=(e-s)
    z=Z[zi%len(Z)]
    target=1080/1920
    if SW/SH > target:
        base_h=SH; base_w=int(base_h*target)
    else:
        base_w=SW; base_h=int(base_w/target)
    cw=max(2,int(base_w/z)//2*2); ch=max(2,int(base_h/z)//2*2)
    x=max(0,(SW-cw)//2); y=max(0,min(SH-ch,int((SH-ch)*ANCH)))
    fc.append(f"[0:v]trim=start={s:.4f}:end={e:.4f},setpts=PTS-STARTPTS,crop={cw}:{ch}:{x}:{y},"
              f"scale=1080:1920:flags=lanczos,setsar=1[v{i}]")
    d=e-s; fo=max(0,d-0.008)
    fc.append(f"[0:a]atrim=start={s:.4f}:end={e:.4f},asetpts=PTS-STARTPTS,"
              f"afade=t=in:d=0.008,afade=t=out:st={fo:.4f}:d=0.008[a{i}]")
    v.append(f"[v{i}]"); a.append(f"[a{i}]")
fc.append("".join(v)+f"concat=n={len(k)}:v=1:a=0[vc]")
fc.append("".join(a)+f"concat=n={len(k)}:v=0:a=1[ac]")
# التدرّج اللوني اختياري تماماً — الافتراضي مطفي (الفيديو يطلع بألوانه الأصلية)
_g = ("eq=brightness=0.015:saturation=0.96:contrast=1.05,"
      "colorbalance=rs=0.02:gs=0.005:bs=-0.02,") if GRADE else ""
# ⚠️ مصدر آيفون HDR يجي موسوماً bt2020/HLG — أي متصفح يحترم الوسم ويطلّع صورة برتقالية.
# setparams يعيد الوسم لـbt709 فتطلع الألوان طبيعية بكل مكان.
fc.append("[vc]fps=30," + _g +
          "setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709,format=yuv420p[vo]")
print("التدرّج اللوني:", "مفعّل" if GRADE else "مطفي (ألوان أصلية)")
print("الإيقاع:", "هادئ (زوم أخف، 4 ثوانٍ على الأقل)" if CALM else "عادي")
fc.append("[ac]afade=t=in:st=0:d=0.06,dynaudnorm=f=200:g=5:p=0.9[ao]")
sys.exit(subprocess.call(["ffmpeg","-v","error","-stats","-i",SRC,"-filter_complex",";".join(fc),
 "-map","[vo]","-map","[ao]","-c:v","libx264","-preset","medium","-crf","16",
 "-c:a","aac","-b:a","192k","-movflags","+faststart","-y",os.path.join(W,"cutz.mp4")]))
