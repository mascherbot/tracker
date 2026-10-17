# Browser-Test (iPhone-Größe). Start: python3 -m http.server 8765 & python test/e2e.py
from playwright.sync_api import sync_playwright, expect
import time, json
URL = 'http://localhost:8765/'
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True, locale='de-DE', timezone_id='Europe/Berlin')
    pg = ctx.new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    pg.on('dialog', lambda d: d.accept())
    pg.goto(URL)
    for name in ['Kopfweh', 'Müde']:
        pg.fill('#name', name); pg.click('#add button')
    kopf = pg.locator('.track', has_text='Kopfweh')
    pg.locator('.track', has_text='Müde').tap()
    pg.click('#undo')  # Müde-Eintrag rückgängig
    for _ in range(3): kopf.tap(); time.sleep(0.25)
    expect(pg.locator('#toast-text')).to_contain_text('Gespeichert')
    time.sleep(0.5)
    pg.screenshot(path='screenshots/01-main.png')
    # Alten Eintrag (40 Tage) einschleusen, dann Reload = Persistenz-Check
    pg.evaluate("""() => { const s = JSON.parse(localStorage.getItem('tracker-v1'));
      const id = s.buttons[0].id; s.entries.push({id:'old', buttonId:id, ts: Date.now()-40*864e5});
      localStorage.setItem('tracker-v1', JSON.stringify(s)); }""")
    pg.reload()
    expect(pg.locator('.track')).to_have_count(2)
    pg.locator('[data-open]').first.tap()
    expect(pg.locator('#count')).to_have_text('3 Einträge')  # 7 Tage
    pg.screenshot(path='screenshots/02-list-7tage.png')
    pg.click('[data-period=year]'); expect(pg.locator('#count')).to_have_text('4 Einträge')
    pg.click('[data-period=month]'); expect(pg.locator('#count')).to_have_text('3 Einträge')
    pg.click('[data-period=all]'); expect(pg.locator('#count')).to_have_text('4 Einträge')
    pg.screenshot(path='screenshots/03-list-alles.png')
    pg.locator('[data-del]').first.click(); expect(pg.locator('#count')).to_have_text('3 Einträge')
    print('Erster Listeneintrag:', pg.locator('#entries li span').first.inner_text())
    st = json.loads(pg.evaluate("localStorage.getItem('tracker-v1')"))
    assert len([e for e in st['entries']]) == 3, st  # Müde-Undo hat geklappt
    pg.reload(); pg.locator('[data-open]').nth(1).tap(); pg.click('#remove')
    expect(pg.locator('.track')).to_have_count(1)
    # Offline über Service Worker
    pg.evaluate("navigator.serviceWorker.ready"); pg.reload(); time.sleep(0.5)
    ctx.set_offline(True); pg.reload(); expect(pg.locator('.track')).to_have_count(1)
    ctx.set_offline(False)
    assert not errors, errors
    print('E2E OK')
    b.close()
