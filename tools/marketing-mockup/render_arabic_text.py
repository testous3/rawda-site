#!/usr/bin/env python3
"""Render word-wrapped Arabic text to a transparent PNG, right-aligned, RTL-correct.

Used by rawda_build_widget.js for the dua/affirmation text inside the fake widget
card. Needed because sharp/librsvg in this environment has no HarfHuzz-backed text
shaping (no fontconfig + pango complex-text stack), so <text> in an SVG renders
Arabic glyphs unjoined/overlapping. Pillow + arabic_reshaper + python-bidi do the
reshaping (presentation-form substitution) and visual reordering by hand instead.

Usage:
  python3 render_arabic_text.py <text> <out.png> \
      [--font path/to/font.ttf] [--font-size 46] [--max-width 1108] \
      [--line-height 62] [--color 18140F]
"""
import argparse
import os

import arabic_reshaper
from bidi.algorithm import get_display
from PIL import Image, ImageDraw, ImageFont

DEFAULT_FONT = os.path.join(os.path.dirname(__file__), 'fonts', 'NotoNaskhArabic_600SemiBold.ttf')


def hex_to_rgba(hex_color):
    hex_color = hex_color.lstrip('#')
    r, g, b = (int(hex_color[i:i + 2], 16) for i in (0, 2, 4))
    return (r, g, b, 255)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('text')
    parser.add_argument('out')
    parser.add_argument('--font', default=DEFAULT_FONT)
    parser.add_argument('--font-size', type=int, default=46)
    parser.add_argument('--max-width', type=int, default=1108)
    parser.add_argument('--line-height', type=int, default=62)
    parser.add_argument('--color', default='18140F')
    args = parser.parse_args()

    font = ImageFont.truetype(args.font, args.font_size)
    color = hex_to_rgba(args.color)

    tmp_img = Image.new('RGBA', (10, 10))
    tmp_draw = ImageDraw.Draw(tmp_img)

    def measure(s):
        display = get_display(arabic_reshaper.reshape(s))
        bbox = tmp_draw.textbbox((0, 0), display, font=font)
        return bbox[2] - bbox[0]

    words = args.text.split(' ')
    lines = []
    current = []
    for w in words:
        trial = current + [w]
        if measure(' '.join(trial)) <= args.max_width or not current:
            current = trial
        else:
            lines.append(' '.join(current))
            current = [w]
    if current:
        lines.append(' '.join(current))

    canvas_w = args.max_width + 20
    canvas_h = args.line_height * len(lines) + 20
    img = Image.new('RGBA', (canvas_w, canvas_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    for i, line in enumerate(lines):
        display = get_display(arabic_reshaper.reshape(line))
        bbox = draw.textbbox((0, 0), display, font=font)
        w = bbox[2] - bbox[0]
        x = canvas_w - 10 - w
        y = 10 + i * args.line_height
        draw.text((x, y), display, font=font, fill=color)

    img.save(args.out)


if __name__ == '__main__':
    main()
