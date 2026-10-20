"""Render all 52 Drift Protocol cards (48 numbered + 4 Modules) to JPG."""
import io
import os
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent
OUT = ROOT / "jpg"
OUT.mkdir(exist_ok=True)
FONTS = ROOT / "fonts"

CHAKRA = FONTS / "fontsource-chakra-petch-5.3.0/files"
PLEX = FONTS / "fontsource-ibm-plex-mono-5.3.0/files"
FONT_CSS = f"""
@font-face{{font-family:'Chakra Petch';font-weight:500;src:url('file://{CHAKRA}/chakra-petch-latin-500-normal.woff2')}}
@font-face{{font-family:'Chakra Petch';font-weight:700;src:url('file://{CHAKRA}/chakra-petch-latin-700-normal.woff2')}}
@font-face{{font-family:'IBM Plex Mono';font-weight:400;src:url('file://{PLEX}/ibm-plex-mono-latin-400-normal.woff2')}}
@font-face{{font-family:'IBM Plex Mono';font-weight:500;src:url('file://{PLEX}/ibm-plex-mono-latin-500-normal.woff2')}}
@font-face{{font-family:'IBM Plex Mono';font-weight:600;src:url('file://{PLEX}/ibm-plex-mono-latin-600-normal.woff2')}}
"""

BOLT = "M13 2 4 14h7l-1 8 9-12h-7l1-8z"
SUITS = {
    "Power": {"color": "#F5C451", "path": BOLT, "module": "REACTOR",
              "perk": "Cascades give 2 Power instead of 1."},
    "Crew": {"color": "#FF7A6B",
             "path": "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z",
             "module": "QUARTERS", "perk": "Draw 6 at cleanup instead of 5."},
    "Data": {"color": "#5EC8F2",
             "path": "M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6z",
             "module": "NAV CORE", "perk": "You may Plot cards straight from your hand."},
    "Shields": {"color": "#7BE0A6",
                "path": "M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5z",
                "module": "SHIELD ARRAY", "perk": "Breach limit is 6 instead of 5."},
}

ACTIONS = {
    1: ("SCROUNGE", "Gain 1 of any resource.", "Gain 2 instead."),
    2: ("PATCH", "Neutralizing costs 2 less this turn.", "Also move the top Breach card to the bottom of the Yard deck."),
    3: ("SCAN", "Look at your top 3 cards. Discard any; return the rest in any order.", "Then draw 1."),
    4: ("JETTISON", "Archive 1 card from hand or discard. Gain 1 Power.", "Up to 2 cards, 1 Power each."),
    5: ("RECRUIT", "Draw 2 cards.", "Draw 3 cards instead."),
    6: ("TRACTOR BEAM", "Salvage 1 Cargo Rail card for 2 less. Put it on top of your deck.", "Put it in your hand instead."),
    7: ("DOCK", "Station a card from your hand at a Module for free.", "That Module produces right now."),
    8: ("RELAY", "Gain the previous card's resource yield again.", "Gain 1 more."),
    9: ("OVERDRIVE", "Every resource play after this one this turn yields +1.", "Also draw 1."),
    10: ("ENGINEER", "Copy the base action of another card in your Circuit.", "Copy its Sync effect instead."),
    11: ("NAVIGATOR", "Plot 1 card from your Circuit or discard pile into the Course. No Data needed.", "Plot up to 2."),
    12: ("CAPTAIN", "Draw 2. Your next card counts as Synced and Cascaded.", "Draw 3 instead."),
}


def tier(rank):
    if rank <= 4:
        return 2, 1  # cost, yield
    if rank <= 8:
        return 3, 2
    return 5, 3


def icon(path, size, fill="none", stroke=None, sw=1.4):
    st = f' stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"' if stroke else ""
    return f'<svg width="{size}" height="{size}" viewBox="0 0 24 24"><path d="{path}" fill="{fill}"{st}></path></svg>'


def page(body):
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>{FONT_CSS}
body{{margin:0;background:#0E1420}}
.card{{width:500px;height:700px;box-sizing:border-box;background:#0E1420;overflow:hidden;display:flex;flex-direction:column;font-family:'IBM Plex Mono',monospace;color:#E8EEF7}}
.disp{{font-family:'Chakra Petch',sans-serif}}
</style></head><body>{body}</body></html>"""


def name_size(name):
    if len(name) <= 8:
        return 40
    if len(name) <= 10:
        return 34
    return 30


def numbered(suit, rank):
    s = SUITS[suit]
    acc, path = s["color"], s["path"]
    cost, yld = tier(rank)
    name, base, sync = ACTIONS[rank]
    dark = "#0E1420"
    corner = f"""<div style="display:flex;flex-direction:column;align-items:center;gap:4px;width:62px">
      <div class="disp" style="font-weight:700;font-size:46px;line-height:1">{rank}</div>{icon(path, 30, fill=dark)}</div>"""
    sync_label = f"""<div style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;letter-spacing:0.18em;color:{acc}">SYNC · after {icon(path, 13, fill=acc)}</div>"""
    if rank > 1:
        casc = f"CASCADE after a {rank - 1} · +1"
        line = f"""<div style="white-space:nowrap">{casc}</div>{icon(BOLT, 18, fill='#F5C451')}<div style="white-space:nowrap;transform:rotate(180deg)">{casc}</div>"""
    else:
        line = f"""<div style="width:120px;height:1px;background:#2A3852"></div>{icon(BOLT, 18, fill='#F5C451')}<div style="width:120px;height:1px;background:#2A3852"></div>"""
    body = f"""<div class="card">
  <div style="height:335px;display:flex;flex-direction:column">
    <div style="height:140px;box-sizing:border-box;background:{acc};padding:22px 26px 22px 20px;display:flex;justify-content:space-between;align-items:flex-start;color:{dark}">
      {corner}
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">
        <div style="font-size:13px;font-weight:600;letter-spacing:0.22em">COST</div>
        <div class="disp" style="font-weight:700;font-size:68px;line-height:0.9">{cost}</div>
      </div>
    </div>
    <div style="flex:1;box-sizing:border-box;padding:6px 26px 14px;display:flex;flex-direction:column;gap:8px">
      <div style="flex:1;display:flex;align-items:center;justify-content:center;gap:18px">
        {icon(path, 56, stroke=acc, sw=1.5)}
        <div style="display:flex;align-items:baseline;gap:12px">
          <div class="disp" style="font-weight:700;font-size:60px;line-height:1;color:#fff">+{yld}</div>
          <div class="disp" style="font-weight:500;font-size:24px;letter-spacing:0.22em;color:{acc}">{suit.upper()}</div>
        </div>
      </div>
      <div style="border:1px solid {acc};border-radius:10px;padding:10px 14px;display:flex;flex-direction:column;gap:4px">
        {sync_label}
        <div style="font-size:19px;line-height:1.35;color:#fff">+1 {suit}.</div>
      </div>
    </div>
  </div>
  <div style="height:30px;display:flex;align-items:center;justify-content:center;gap:12px;padding:0 22px;font-size:12px;letter-spacing:0.04em;color:#93A1B8">{line}</div>
  <div style="height:335px;display:flex;flex-direction:column;transform:rotate(180deg)">
    <div style="height:140px;box-sizing:border-box;background:{acc};padding:22px 26px 22px 20px;display:flex;justify-content:space-between;align-items:flex-start;color:{dark}">
      {corner}
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <div style="font-size:13px;font-weight:600;letter-spacing:0.18em">ACTION</div>
        <div class="disp" style="font-weight:700;font-size:{name_size(name)}px;letter-spacing:0.06em;line-height:1;text-align:right">{name}</div>
      </div>
    </div>
    <div style="flex:1;box-sizing:border-box;padding:14px 26px 14px;display:flex;flex-direction:column;gap:10px">
      <div style="flex:1;font-size:{19 if len(base) > 60 else 21}px;line-height:1.35;color:#E8EEF7">{base}</div>
      <div style="border:1px solid {acc};border-radius:10px;padding:10px 14px;display:flex;flex-direction:column;gap:4px">
        {sync_label}
        <div style="font-size:{16 if len(sync) > 40 else 19}px;line-height:1.35;color:#fff">{sync}</div>
      </div>
    </div>
  </div>
</div>"""
    return page(body)


def module(suit):
    s = SUITS[suit]
    acc, path = s["color"], s["path"]
    nm = s["module"]
    size = 44 if len(nm) <= 8 else 36
    block = lambda label, text: f"""<div style="display:flex;flex-direction:column;gap:4px">
      <div style="font-size:12px;font-weight:600;letter-spacing:0.18em;color:{acc}">{label}</div>
      <div style="font-size:16px;line-height:1.4">{text}</div></div>"""
    body = f"""<div class="card">
  <div style="height:44px;display:flex;align-items:center;justify-content:center;border-bottom:2px dashed #3A4A68;font-size:11px;font-weight:600;letter-spacing:0.24em;color:#93A1B8">▲ STATIONED CARD SHOWS HERE ▲</div>
  <div style="height:140px;box-sizing:border-box;background:{acc};padding:22px 26px;display:flex;justify-content:space-between;align-items:center;color:#0E1420">
    {icon(path, 64, fill='#0E1420')}
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
      <div style="font-size:13px;font-weight:600;letter-spacing:0.18em">MODULE</div>
      <div class="disp" style="font-weight:700;font-size:{size}px;letter-spacing:0.06em;line-height:1">{nm}</div>
    </div>
  </div>
  <div style="flex:1;box-sizing:border-box;padding:22px 26px;display:flex;flex-direction:column;gap:16px">
    {block("STATION", "Tuck 1 card under this one so its resource half shows above. Pay its Cost in Crew.")}
    {block("PRODUCES · each turn", f"The stationed card's yield in {suit}. +1 if it is a {suit} card.")}
    {block("PERK · while staffed", s["perk"])}
    <div style="flex:1"></div>
    <div style="border:1px solid #3A4A68;border-radius:10px;padding:10px 14px;display:flex;flex-direction:column;gap:4px">
      <div style="font-size:12px;font-weight:600;letter-spacing:0.18em;color:#93A1B8">OFFLINE</div>
      <div style="font-size:14px;line-height:1.4;color:#C9D3E3">While a {suit} hazard is in the Threat zone: no production, no perk, no stationing.</div>
    </div>
  </div>
</div>"""
    return page(body)


def main():
    jobs = []
    for suit in SUITS:
        for rank in range(1, 13):
            jobs.append((f"{suit}-{rank:02d}.jpg", numbered(suit, rank)))
        jobs.append((f"Module-{SUITS[suit]['module'].title().replace(' ', '')}.jpg", module(suit)))
    with sync_playwright() as p:
        browser = p.chromium.launch()
        pg = browser.new_page(viewport={"width": 500, "height": 700}, device_scale_factor=2)
        for fname, html in jobs:
            tmp = ROOT / "tmp.html"
            tmp.write_text(html)
            pg.goto(f"file://{tmp}")
            pg.evaluate("document.fonts.ready")
            png = pg.screenshot(clip={"x": 0, "y": 0, "width": 500, "height": 700})
            Image.open(io.BytesIO(png)).convert("RGB").save(OUT / fname, "JPEG", quality=92, dpi=(400, 400))
        browser.close()
    print(len(jobs), "cards written to", OUT)


if __name__ == "__main__":
    main()
