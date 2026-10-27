"""Stable per-source segment zoom; first run retains the existing rhythm."""
import math

def locked_zooms(cut, pairs, candidates, source_key):
    old = cut.get('zooms', {}) if cut.get('_zoomSource') == source_key else {}
    if not isinstance(old, dict): old = {}
    chosen = []
    for (start, _), candidate in zip(pairs, candidates):
        value = float(old.get(f'{start:.6f}', candidate))
        if not math.isfinite(value) or not 1 <= value <= 1.3:
            raise ValueError('Zoom must be finite and between 1 and 1.3')
        chosen.append(value)
    cut['zooms'] = {**old, **{f'{s:.6f}': z for (s, _), z in zip(pairs, chosen)}}
    cut['_zoomSource'] = source_key
    return chosen
