# Browser-Test: Buttons per Finger am Griff (≡) verschieben. Echte Touch-Events über CDP.
# Lokal: python3 -m http.server 8765 &  python test/e2e_drag.py   |  Live: python test/e2e_drag.py <URL> <Ordner>
from playwright.sync_api import sync_playwright, expect
import sys, os, json, time
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
SHOTS = sys.argv[2] if len(sys.argv) > 2 else 'screenshots'
os.makedirs(SHOTS, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True, locale='de-DE')
    pg = ctx.new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    cdp = ctx.new_cdp_session(pg)
    touch = lambda t, x=0, y=0: cdp.send('Input.dispatchTouchEvent', {'type': t, 'touchPoints': [] if t == 'touchEnd' else [{'x': x, 'y': y}]})
    names = lambda: pg.locator('.track').all_inner_texts()
    stored = lambda: json.loads(pg.evaluate("localStorage.getItem('tracker-v1')"))

    pg.goto(URL); pg.evaluate('localStorage.clear()'); pg.reload()
    for n in ['Kopfweh', 'Müde', 'Schwindel', 'Übelkeit']:
        pg.fill('#name', n); pg.click('#add button')
    # Normalmodus: keine Griffe
    handles = pg.locator('.handle')
    expect(pg.locator('#editmode')).to_have_text('Bearbeiten')
    for i in range(4): expect(handles.nth(i)).to_be_hidden()
    pg.screenshot(path=f'{SHOTS}/08-main-normal.png')
    pg.click('#editmode'); expect(pg.locator('#editmode')).to_have_text('Fertig')
    for i in range(4): expect(handles.nth(i)).to_be_visible()
    pg.screenshot(path=f'{SHOTS}/11-main-bearbeiten.png')

    # Kopfweh am Griff nach unten zwischen Schwindel und Übelkeit ziehen
    h = pg.locator('.row', has_text='Kopfweh').locator('.handle').bounding_box()
    target = pg.locator('.row', has_text='Schwindel').bounding_box()
    x, y0 = h['x'] + h['width'] / 2, h['y'] + h['height'] / 2
    y1 = target['y'] + target['height'] / 2 + 10
    touch('touchStart', x, y0)
    for i in range(1, 21):
        touch('touchMove', x, y0 + (y1 - y0) * i / 20); time.sleep(0.02)
        if i == 14: time.sleep(0.2); pg.screenshot(path=f'{SHOTS}/09-main-beim-ziehen.png')
    time.sleep(0.2); touch('touchEnd')
    expect(pg.locator('.track')).to_have_text(['Müde', 'Schwindel', 'Kopfweh', 'Übelkeit'])
    assert [x['name'] for x in stored()['buttons']] == ['Müde', 'Schwindel', 'Kopfweh', 'Übelkeit']
    assert stored()['entries'] == [], 'Ziehen darf keinen Eintrag erzeugen'

    # Nach oben ziehen: Übelkeit an Position 1
    h = pg.locator('.row', has_text='Übelkeit').locator('.handle').bounding_box()
    first = pg.locator('.row').first.bounding_box()
    x, y0 = h['x'] + h['width'] / 2, h['y'] + h['height'] / 2
    touch('touchStart', x, y0)
    for i in range(1, 16): touch('touchMove', x, y0 + (first['y'] + 5 - y0) * i / 15); time.sleep(0.02)
    touch('touchEnd')
    expect(pg.locator('.track')).to_have_text(['Übelkeit', 'Müde', 'Schwindel', 'Kopfweh'])

    # Im Bearbeiten-Modus speichert ein Tipp nichts
    pg.locator('.track', has_text='Müde').tap(); time.sleep(0.2)
    assert stored()['entries'] == [] and pg.locator('#toast').is_hidden()
    pg.click('#editmode'); expect(pg.locator('#editmode')).to_have_text('Bearbeiten')
    for i in range(4): expect(handles.nth(i)).to_be_hidden()
    pg.click('#editmode'); pg.reload()   # Modus wird nicht gespeichert
    expect(pg.locator('#editmode')).to_have_text('Bearbeiten'); expect(handles.first).to_be_hidden()
    expect(pg.locator('.track')).to_have_text(['Übelkeit', 'Müde', 'Schwindel', 'Kopfweh'])
    assert not pg.locator('.row[style*=transform]').count()

    # Normaler Tipp auf den großen Button speichert weiterhin
    pg.locator('.track', has_text='Kopfweh').tap()
    expect(pg.locator('#toast-text')).to_contain_text('Gespeichert')
    e = stored()['entries']; kid = next(b['id'] for b in stored()['buttons'] if b['name'] == 'Kopfweh')
    assert len(e) == 1 and e[0]['buttonId'] == kid, e
    time.sleep(0.4); pg.screenshot(path=f'{SHOTS}/10-main-nach-umsortieren.png')
    assert not errors, errors
    print('DRAG E2E OK', URL)
    b.close()
