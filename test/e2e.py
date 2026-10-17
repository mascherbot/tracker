# Browser-Test (iPhone-Größe).
# Lokal:  python3 -m http.server 8765 &  python test/e2e.py
# Live:   python test/e2e.py https://mascherbot.github.io/tracker/ /tmp/live-shots
from playwright.sync_api import sync_playwright, expect
import sys, time, json, re, os, datetime as dt
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
SHOTS = sys.argv[2] if len(sys.argv) > 2 else 'screenshots'
os.makedirs(SHOTS, exist_ok=True)
DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True, locale='de-DE', timezone_id='Europe/Berlin')
    pg = ctx.new_page(); errors = []; answers = []; prompts = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    def on_dialog(d):
        prompts.append(d.message)
        d.accept() if (answers.pop(0) if answers else True) else d.dismiss()
    pg.on('dialog', on_dialog)
    count = lambda n: expect(pg.locator('#count')).to_have_text(f'{n} Einträge' if n != 1 else '1 Eintrag')

    # 1) Alte Daten (v1-Format, ohne Kommentar/Einstellungen) -> Migration
    pg.goto(URL)
    pg.evaluate("""() => localStorage.setItem('tracker-v1', JSON.stringify({buttons:[{id:'b1',name:'Kopfweh'}],
      entries:[{id:'o1',buttonId:'b1',ts:Date.now()-3600e3},{id:'o2',buttonId:'b1',ts:Date.now()-40*864e5}]}))""")
    pg.reload()
    pg.locator('[data-open]').first.tap(); count(1)
    pg.click('[data-period=all]'); count(2)
    pg.click('#back')

    # 2) Neuer Button, 3x tippen, Kommentar direkt über den Toast
    pg.fill('#name', 'Müde'); pg.click('#add button')
    kopf = pg.locator('.track', has_text='Kopfweh')
    for _ in range(3): kopf.tap(); time.sleep(0.25)
    expect(pg.locator('#toast-text')).to_contain_text('Gespeichert')
    time.sleep(0.5); pg.screenshot(path=f'{SHOTS}/07-toast.png')
    pg.click('#note-now'); expect(pg.locator('#editor')).to_be_visible()
    pg.fill('#edit-note', 'nach dem Sport'); pg.click('#editor button[value=save]')
    expect(pg.locator('#editor')).to_be_hidden()

    # 3) Liste: Eintrag bearbeiten (Datum + Kommentar)
    pg.locator('[data-open]').first.tap(); pg.click('[data-period=all]'); count(5)
    expect(pg.locator('#entries')).to_contain_text('nach dem Sport')
    target = dt.datetime.now() - dt.timedelta(days=5)
    exp = f"{DAYS[target.weekday()]}, {target:%d.%m.%Y}"
    pg.locator('#entries [data-edit]').last.click()   # der 40 Tage alte Eintrag
    expect(pg.locator('#editor')).to_be_visible()
    pg.fill('#edit-ts', f'{target:%Y-%m-%d}T08:15'); pg.fill('#edit-note', 'leichte Kopfschmerzen')
    time.sleep(0.3); pg.screenshot(path=f'{SHOTS}/04-edit-dialog.png')
    pg.click('#editor button[value=save]')
    texts = pg.locator('#entries [data-edit]').all_inner_texts()
    assert texts[-1].startswith(f'{exp}, 08:15') and 'leichte Kopfschmerzen' in texts[-1], texts  # neu sortiert
    pg.click('[data-period="7d"]'); count(5)   # jetzt innerhalb der letzten 7 Tage
    # Abbrechen ändert nichts
    pg.locator('#entries [data-edit]').first.click(); pg.fill('#edit-note', 'XXX'); pg.click('#editor button[value=cancel]')
    expect(pg.locator('#entries')).not_to_contain_text('XXX')
    pg.screenshot(path=f'{SHOTS}/05-list-kommentare-mit-uhrzeit.png')

    # 4) Schalter Uhrzeit aus, Persistenz nach Reload
    expect(pg.locator('#showtime')).to_be_checked()
    pg.click('#showtime'); expect(pg.locator('#showtime')).not_to_be_checked(); time.sleep(0.4)
    dates = pg.locator('#entries [data-edit] span').all_inner_texts()
    assert all(re.fullmatch(r'\w\w, \d\d\.\d\d\.\d{4}', d) for d in dates), dates
    pg.screenshot(path=f'{SHOTS}/06-list-ohne-uhrzeit.png')
    pg.reload(); pg.locator('[data-open]').first.tap()
    expect(pg.locator('#showtime')).not_to_be_checked()
    assert ':' not in pg.locator('#entries [data-edit] span').first.inner_text()
    pg.click('#showtime'); expect(pg.locator('#entries [data-edit] span').first).to_contain_text(':')
    pg.reload(); pg.locator('[data-open]').first.tap(); expect(pg.locator('#showtime')).to_be_checked()
    pg.click('[data-period=all]'); count(5)
    expect(pg.locator('#entries')).to_contain_text('nach dem Sport')  # Kommentar überlebt Reload

    # 5) Eintrag im Dialog löschen
    pg.locator('#entries [data-edit]').first.click(); answers[:] = [True]; pg.click('#edit-delete')
    expect(pg.locator('#editor')).to_be_hidden(); count(4)

    # 6) Button löschen: zwei Bestätigungen
    pg.click('#back'); pg.locator('[data-open]').nth(1).tap()
    prompts.clear(); answers[:] = [True, False]; pg.click('#remove')
    assert prompts == ['Button „Müde“ löschen?', 'Möchten Sie den Button inkl. aller Einträge löschen?'], prompts
    expect(pg.locator('#title')).to_have_text('Müde')   # Abbruch bei 2. Frage -> bleibt
    prompts.clear(); answers[:] = [False]; pg.click('#remove')
    assert len(prompts) == 1; expect(pg.locator('#title')).to_have_text('Müde')
    prompts.clear(); answers[:] = [True, True]; pg.click('#remove')
    assert len(prompts) == 2; expect(pg.locator('.track')).to_have_count(1)
    pg.reload(); expect(pg.locator('.track')).to_have_count(1)

    # 7) Offline über Service Worker
    pg.evaluate("navigator.serviceWorker.ready.then(() => caches.keys())") 
    print('Caches:', pg.evaluate("caches.keys()"))
    pg.reload(); time.sleep(0.5)
    ctx.set_offline(True); pg.reload(); expect(pg.locator('.track')).to_have_count(1)
    ctx.set_offline(False)
    assert not errors, errors
    print('E2E OK', URL)
    b.close()
