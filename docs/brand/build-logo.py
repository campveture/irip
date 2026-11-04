"""Rebuild IRIP assets from the supplied concept; not a website dependency.

Requires Python with Pillow, numpy and opencv-python-headless.
Run from the repository root: python docs/brand/build-logo.py
"""
from pathlib import Path
import xml.etree.ElementTree as ET

import cv2
import numpy as np
from PIL import Image, ImageColor

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'client/public/images'
SOURCE = Path(__file__).with_name('irip-logo-original.png')
COLORS = {
    'midnight': '#122B39', 'evergreen': '#245448',
    'paper': '#F5F3ED', 'brass': '#C5A46D',
}
BOX = (170, 90, 1085, 1040)


def components(mask):
    return cv2.connectedComponentsWithStats(mask.astype('uint8'), 8)[1:]


def contour_path(mask):
    contours, _ = cv2.findContours(mask.astype('uint8'), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    paths = []
    for contour in contours:
        if cv2.contourArea(contour) < 12:
            continue
        points = cv2.approxPolyDP(contour, 0.45, True).reshape(-1, 2)
        paths.append('M' + 'L'.join(f'{x},{y}' for x, y in points) + 'Z')
    return ''.join(paths)


def main():
    original = Image.open(SOURCE).convert('RGB')
    gray = np.asarray(original.convert('L'))
    x0, y0, x1, y1 = BOX
    crop = gray[y0:y1, x0:x1]
    dark, _, _ = components(crop < 140)
    light, light_stats, _ = components(crop >= 140)
    # The original has two dark components: outer shield rim and inner field.
    # Light component 1 is the outside canvas; 2 is the inset shield border.
    layers = [(dark == 1, 'brass', 'shield-rim'),
              (light == 2, 'paper', 'shield-inset'),
              (dark == 2, 'midnight', 'shield-field')]
    for label, stats in enumerate(light_stats):
        if label < 3 or stats[4] < 80:
            continue
        color = {7: 'brass', 14: 'brass', 15: 'evergreen'}.get(label, 'paper')
        name = {7: 'discovery-spark', 14: 'cube-top', 15: 'cube-right', 16: 'cube-left'}.get(label, f'figure-{label}')
        layers.append((light == label, color, name))

    svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 960 960" role="img" aria-labelledby="title desc">',
           '  <title id="title">IRIP institution crest</title>',
           '  <desc id="desc">The supplied shield with a quill, three hands, a discovery spark and a cube, in midnight, warm paper, evergreen and brass.</desc>',
           '  <g transform="translate(22.5 5)">']
    for mask, color, name in layers:
        svg.append(f'    <path id="{name}" fill="{COLORS[color]}" d="{contour_path(mask)}"/>')
    svg.extend(['  </g>', '</svg>', ''])
    text = '\n'.join(svg)
    ET.fromstring(text)
    (ASSETS / 'irip-mark.svg').write_text(text, encoding='utf-8')

    # Raster downloads retain source antialiasing while removing canvas noise.
    # A filled external contour distinguishes internal paper from transparency.
    silhouette = np.zeros(crop.shape, dtype='uint8')
    contours, _ = cv2.findContours((dark == 1).astype('uint8'), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(silhouette, contours, -1, 1, cv2.FILLED)
    field = np.zeros(crop.shape, dtype='uint8')
    contours, _ = cv2.findContours((dark == 2).astype('uint8'), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(field, contours, -1, 1, cv2.FILLED)
    paper = np.array(ImageColor.getrgb(COLORS['paper']), dtype=float)
    brass = np.array(ImageColor.getrgb(COLORS['brass']), dtype=float)
    midnight = np.array(ImageColor.getrgb(COLORS['midnight']), dtype=float)
    coverage = np.clip((245.0 - crop.astype(float)) / 235.0, 0, 1)[..., None]
    rgb = paper * (1 - coverage) + midnight * coverage
    # Outer rim is brass; the inset remains paper.
    ring = (silhouette == 1) & (field == 0)
    rgb[ring] = (paper * (1 - coverage) + brass * coverage)[ring]
    for label, color in [(7, 'brass'), (14, 'brass'), (15, 'evergreen')]:
        mask = light == label
        # Include the antialias fringe without painting across the dark keyline.
        expanded = cv2.dilate(mask.astype('uint8'), np.ones((3, 3), dtype='uint8')).astype(bool)
        lightness = np.clip((crop.astype(float) - 10) / 235, 0, 1)[..., None]
        accent = np.array(ImageColor.getrgb(COLORS[color]), dtype=float)
        colored = midnight * (1 - lightness) + accent * lightness
        rgb[expanded] = colored[expanded]
    alpha = (silhouette * 255).astype('uint8')
    crest = Image.fromarray(np.dstack([rgb.astype('uint8'), alpha]), 'RGBA')
    square = Image.new('RGBA', (960, 960))
    square.alpha_composite(crest, (23, 5))
    square.save(ASSETS / 'irip-crest.png', optimize=True)
    icon = Image.new('RGBA', (1100, 1100), COLORS['paper'])
    icon.alpha_composite(square, (70, 70))
    icon.convert('RGB').resize((180, 180), Image.Resampling.LANCZOS).save(ASSETS / 'irip-apple-touch-icon.png', optimize=True)

    # Retain the supplied full-name lettering in a separate large-format lockup.
    full = Image.new('RGBA', original.size)
    full.alpha_composite(crest, (x0, y0))
    lettering = gray[1060:1220, 120:1140]
    text_alpha = np.clip((245.0 - lettering.astype(float)) / 235.0, 0, 1)
    text_rgb = np.empty((*lettering.shape, 3), dtype='uint8')
    text_rgb[:] = midnight.astype('uint8')
    full.alpha_composite(Image.fromarray(np.dstack([text_rgb, (text_alpha * 255).astype('uint8')]), 'RGBA'), (120, 1060))
    full.save(ASSETS / 'irip-logo-lockup.png', optimize=True)
    print('Generated crest SVG, transparent PNG, full-name lockup and Apple touch icon.')


if __name__ == '__main__':
    main()
