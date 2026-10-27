"""Local speech envelope on exact frame boundaries. No model or API required."""
import argparse, array, json, math, subprocess, sys
from pathlib import Path

def envelope(samples, rate, fps):
    frames = math.ceil(len(samples)*fps/rate)
    levels = []
    for i in range(frames):
        a, b = i*rate//fps, min(len(samples), (i+1)*rate//fps)
        chunk = samples[a:b]
        rms = math.sqrt(sum(float(v)**2 for v in chunk)/max(1,len(chunk)))
        levels.append(20*math.log10(max(1e-9,rms)))
    if not levels: raise ValueError('No audio samples')
    ordered = sorted(levels)
    lo, hi = ordered[int((len(ordered)-1)*.1)]+6, ordered[int((len(ordered)-1)*.98)]
    raw = [max(0,min(1,(v-lo)/max(1e-6,hi-lo))) for v in levels]
    return [round((raw[max(0,i-1)]+2*raw[i]+raw[min(len(raw)-1,i+1)])/4,4) for i in range(len(raw))]

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('work',type=Path)
    p.add_argument('--src',default='cutz.mp4');p.add_argument('--fps',type=int,default=30)
    a=p.parse_args()
    if not 1<=a.fps<=120:p.error('fps must be 1..120')
    src=Path(a.src);src=src if src.is_absolute() else a.work/src
    data=subprocess.run(['ffmpeg','-v','error','-i',str(src),'-vn','-ac','1','-ar','16000','-f','f32le','-'],check=True,capture_output=True).stdout
    samples=array.array('f');samples.frombytes(data)
    if sys.byteorder!='little':samples.byteswap()
    result={'fps':a.fps,'values':envelope(samples,16000,a.fps)}
    (a.work/'audio-envelope.json').write_text(json.dumps(result)+'\n')
    print(f'Audio envelope: {len(result["values"])} frames at {a.fps}fps')

if __name__=='__main__':main()
