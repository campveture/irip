"""Approved crop and proportional UI export. No tracing, tinting or redesign.

Requires Pillow; run from the repository root. The full lockup is copied
unchanged. The header crop was explicitly approved by the user in this session.
"""
from pathlib import Path
import shutil
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
SOURCE = Path(__file__).with_name('IRIP indigo shield logo with ivory falcons.png')
ASSETS = ROOT / 'client/public/images'
shutil.copyfile(SOURCE, ASSETS / 'irip-falcon-lockup.png')
image = Image.open(SOURCE)
assert image.size == (1254, 1254) and image.mode == 'RGBA'
# Ten source pixels of clear space around the visible crest. Only the supplied
# name/outer canvas are omitted; pixels inside this box are unchanged.
box = (183, 102, 1071, 1034)
crest = image.crop(box)
assert crest.size == (888, 932)
crest.save(ASSETS / 'irip-falcon-crest.png', optimize=True)
# Standard proportional raster export for compact UI, not a new crest design.
# Keep the full-resolution crop above for downloads and larger placements.
compact = crest.copy()
compact.thumbnail((192, 192), Image.Resampling.LANCZOS)
assert compact.size == (183, 192)
compact.save(ASSETS / 'irip-falcon-crest-192.png', optimize=True)
print('Copied approved lockup unchanged; saved approved crop and proportional UI export.')
