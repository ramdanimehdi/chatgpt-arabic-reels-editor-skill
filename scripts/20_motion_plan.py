"""Choose installed motion scenes by meaning; retain variety across projects.
Usage: python3 20_motion_plan.py WORK --title TITLE --cues steps,delivery [--dry-run]
"""
import argparse, hashlib, json
from pathlib import Path

KINDS = {
    'grid-title': {'cues': {'emphasis', 'hook'}, 'name': 'عنوان'},
    'highlight': {'cues': {'emphasis', 'hook'}, 'name': 'تحديد'},
    'blueprint-flow': {'cues': {'steps', 'automation'}, 'name': 'مسار'},
    'checklist': {'cues': {'steps', 'list'}, 'name': 'قائمة خطوات'},
    'pictogram-delivery': {'cues': {'delivery'}, 'name': 'تسليم'},
    'notifications': {'cues': {'notification', 'automation'}, 'name': 'إشعارات'},
    'compare': {'cues': {'contrast'}, 'name': 'مقارنة'},
    'voice-wave': {'cues': {'voice'}, 'name': 'موجة الصوت'},
}

def choose(title, cues, history, excluded=()):
    recent = [k for row in history[-3:] for k in row.get('kinds', [])]
    eligible = [k for k, data in KINDS.items() if data['cues'] & set(cues) and k not in excluded]
    def score(k):
        tie = hashlib.sha256((title + k).encode()).hexdigest()
        return (-len(KINDS[k]['cues'] & set(cues)), recent.count(k), tie)
    ranked = sorted(eligible, key=score)
    selected = []
    covered = set()
    for k in ranked:
        meaning = KINDS[k]['cues'] & set(cues)
        if meaning - covered:
            selected.append(k); covered |= meaning
        if len(selected) == 3:
            break
    # Never rotate into an unrelated meaning just to avoid repeating a move.
    style_recent = [r.get('surface') for r in history[-3:]]
    surfaces = ['clean', 'paper', 'blueprint']
    surface = min(surfaces, key=lambda x: (style_recent.count(x), hashlib.sha256((title+x).encode()).hexdigest()))
    return {'title': title, 'kinds': selected, 'surface': surface, 'cues': sorted(set(cues)),
            'note': 'اقتراح فقط؛ خذ المحتوى والتوقيت من الكلام، ولا تحوّل كل اختيار إلى مشهد إلزامي.'}

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('work', type=Path); p.add_argument('--title', required=True)
    p.add_argument('--cues', default='emphasis'); p.add_argument('--exclude', default='')
    p.add_argument('--history', type=Path); p.add_argument('--dry-run', action='store_true')
    a = p.parse_args()
    history_path = a.history or a.work.parent / 'cfs-motion-history.json'
    hist = json.loads(history_path.read_text()) if history_path.exists() else []
    if not isinstance(hist, list): p.error('history must be an array')
    result = choose(a.title, a.cues.split(','), hist, a.exclude.split(','))
    if not a.dry_run:
        a.work.mkdir(parents=True, exist_ok=True)
        (a.work/'motion-choice.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
        history_path.parent.mkdir(parents=True, exist_ok=True)
        tmp = history_path.with_suffix('.tmp')
        tmp.write_text(json.dumps((hist+[result])[-50:], ensure_ascii=False, indent=2)+'\n')
        tmp.replace(history_path)
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == '__main__': main()
