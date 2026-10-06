"""Browser checks with controlled API responses; no AI services or DB required.

Run: python -m unittest discover -s tests -p test_robot_ui.py
Requires playwright and an installed Edge or Playwright Chromium browser.
"""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import tempfile
import threading
import unittest

from playwright.sync_api import sync_playwright, expect


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


class RobotUITest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        root = Path(__file__).resolve().parents[1] / 'frontend'
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(root)))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.pw = sync_playwright().start()
        edge = Path(os.environ.get('PROGRAMFILES(X86)', '')) / 'Microsoft/Edge/Application/msedge.exe'
        cls.browser = cls.pw.chromium.launch(executable_path=str(edge) if edge.is_file() else None, headless=True)
        cls.url = f'http://127.0.0.1:{cls.server.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1280, 'height': 900})
        self.page = self.context.new_page()
        self.errors = []
        self.pending = {}
        self.calls = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.route('**/api/**', self.api)

    def tearDown(self):
        self.context.close()

    def api(self, route):
        path = route.request.url.split('/api/')[1]
        self.calls.append(path)
        if path in ('generate/prompt', 'generate/image', 'polaroid/create'):
            self.pending[path] = route
            return
        body = {'session_id': 'robot-test'} if path == 'session/start' else {'waiting_play': []}
        route.fulfill(json=body)

    def reply(self, path, body=None, status=200):
        self.page.wait_for_function('true')  # Process queued route callbacks.
        self.pending.pop(path).fulfill(status=status, content_type='application/json', body=json.dumps(body or {}))

    def enter_generation(self):
        self.page.goto(self.url)
        self.page.locator('#btn-start').click()
        self.page.locator('#btn-skip-study').click()
        self.page.locator('#robot-intro-skip').click()
        expect(self.page.locator('#step-cause .mascot-img')).to_be_visible()
        expect(self.page.locator('#step-cause .mascot-img')).to_have_attribute('src', '/static/img/robot/RobotWaving.png')
        self.page.locator('.cause-card-ui').first.click()
        expect(self.page.locator('#step-cause .mascot-img')).to_have_attribute('data-pose', 'heart')
        self.page.locator('.idea-card').first.click()
        expect(self.page.locator('#step-idea .mascot-img')).to_have_attribute('data-pose', 'inspired')
        self.page.locator('.style-thumb').first.click()
        expect(self.page.locator('#step-phrase .mascot-img')).to_have_attribute('data-pose', 'heart')
        self.page.locator('#btn-skip-phrase').click()
        self.page.locator('#input-name').fill('Teste Robot')
        self.page.locator('#btn-next-name').click()
        expect(self.page.locator('#step-generating')).to_have_class('step active')

    def complete(self):
        self.reply('generate/image')
        expect(self.page.locator('[data-robot-stage]').nth(2)).to_have_attribute('aria-current', 'step')
        # The next API call is issued after the stage changes.
        self.page.wait_for_timeout(100)
        self.reply('polaroid/create', {
            'polaroid_url': '/static/img/robot/RobotFrontHappy.png',
            'polaroid_sketch_url': '/static/img/robot/RobotSideLooking.png',
        })
        expect(self.page.locator('#step-result')).to_have_class(re.compile(r'\bactive\b'))
        expect(self.page.locator('.result-robot .mascot-img')).to_have_attribute('data-pose', 'victory')
        self.page.wait_for_function("document.querySelector('.result-robot .mascot-img').naturalWidth > 0")
        self.assertEqual([], self.errors)

    def test_stages_game_pause_and_success(self):
        self.enter_generation()
        expect(self.page.locator('#gen-robot-frame')).to_have_attribute('data-pose', 'thinking')
        self.page.wait_for_timeout(4300)
        expect(self.page.locator('[data-robot-stage]').first).to_have_attribute('aria-current', 'step')
        self.reply('generate/prompt')
        expect(self.page.locator('#gen-robot-frame')).to_have_attribute('data-pose', 'painting')
        self.page.locator('#robot-motion-toggle').click()
        frame = self.page.locator('#gen-robot-frame').get_attribute('src')
        self.page.wait_for_timeout(450)
        self.assertEqual(frame, self.page.locator('#gen-robot-frame').get_attribute('src'))
        self.page.locator('#robot-motion-toggle').click()
        sparks = self.page.locator('[data-spark]')
        sparks.first.focus()
        self.page.keyboard.press('Enter')
        expect(self.page.locator('#gen-robot-frame')).to_have_attribute('data-pose', 'inspired')
        self.page.keyboard.press('Enter')
        expect(self.page.locator('#spark-feedback')).to_contain_text('1 de 5')
        for i in range(1, 5):
            sparks.nth(i).click()
            expected_pose = 'victory' if i == 4 else 'heart' if i % 2 else 'inspired'
            expect(self.page.locator('#gen-robot-frame')).to_have_attribute('data-pose', expected_pose)
        expect(self.page.locator('#robot-game')).to_have_class('robot-game is-complete')
        expect(self.page.locator('#gen-robot-frame')).to_have_attribute('data-pose', 'victory')
        expect(self.page.locator('[data-robot-stage]').nth(1)).to_have_attribute('aria-current', 'step')
        self.page.screenshot(path=str(Path(tempfile.gettempdir()) / 'robot-desktop.png'), full_page=True)
        self.complete()
        self.assertEqual(1, self.calls.count('generate/image'))

    def test_early_error_retry_mobile_and_reduced_motion(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.page.emulate_media(reduced_motion='reduce')
        self.page.goto(self.url)
        self.page.locator('#btn-start').click()
        self.page.locator('#btn-skip-study').click()
        expect(self.page.locator('#robot-intro')).to_have_attribute('data-phase', 'inviting')
        self.page.screenshot(path=str(Path(tempfile.gettempdir()) / 'robot-story-intro-mobile.png'), full_page=True)
        self.page.locator('#robot-intro-choose').click()
        expect(self.page.locator('#step-cause .mascot-img')).to_be_visible()
        quest_box = self.page.locator('#robot-quest').bounding_box()
        heading_box = self.page.locator('#step-cause h2').bounding_box()
        self.assertLess(quest_box['y'] + quest_box['height'], heading_box['y'])
        self.page.screenshot(path=str(Path(tempfile.gettempdir()) / 'robot-mobile-cause.png'), full_page=True)
        self.page.locator('.cause-card-ui').first.click()
        self.page.locator('.idea-card').first.click()
        self.page.locator('.style-thumb').first.click()
        expect(self.page.locator('#btn-skip-phrase')).to_be_visible()
        self.reply('generate/prompt', {'detail': 'Falha simulada'}, 503)
        self.page.wait_for_timeout(200)
        self.assertEqual([], self.errors, 'Early background failures must be handled')
        self.page.locator('#btn-skip-phrase').click()
        self.page.locator('#btn-next-name').click()
        expect(self.page.locator('#gen-error')).to_be_visible()
        expect(self.page.locator('#gen-robot-frame')).to_have_attribute('data-pose', 'question')
        expect(self.page.locator('#robot-game')).to_be_hidden()
        self.page.locator('#btn-retry').click()
        expect(self.page.locator('#gen-error')).to_be_hidden()
        expect(self.page.locator('#robot-game')).to_be_visible()
        self.reply('generate/prompt')
        expect(self.page.locator('[data-robot-stage]').nth(1)).to_have_attribute('aria-current', 'step')
        expect(self.page.locator('#robot-motion-toggle')).to_be_disabled()
        frame = self.page.locator('#gen-robot-frame').get_attribute('src')
        self.page.wait_for_timeout(400)
        self.assertEqual(frame, self.page.locator('#gen-robot-frame').get_attribute('src'))
        self.page.screenshot(path=str(Path(tempfile.gettempdir()) / 'robot-mobile.png'), full_page=True)
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), 390)
        self.complete()  # Completion does not require playing the game.

    def test_character_entrance_dialogue_voice_and_mission(self):
        self.page.add_init_script("""
          window.robotSpeech = [];
          Object.defineProperty(window, 'speechSynthesis', { value: {
            getVoices: () => [],
            speak: utterance => window.robotSpeech.push(utterance.text),
            cancel: () => window.robotSpeech.push('[cancel]')
          }});
        """)
        self.page.goto(self.url)
        self.page.evaluate("""() => {
          window.entranceFrames = [];
          const intro = document.getElementById('robot-intro');
          new MutationObserver(() => {
            const img = document.getElementById('robot-intro-img');
            window.entranceFrames.push({phase: intro.dataset.phase,
              src: img.getAttribute('src'), loaded: img.complete && img.naturalWidth > 0});
          }).observe(intro, {attributes: true, attributeFilter: ['data-phase']});
        }""")
        self.page.locator('#btn-start').click()
        self.page.locator('#btn-skip-study').click()
        intro = self.page.locator('#robot-intro')
        expect(intro).to_be_visible()
        expect(intro).to_have_attribute('data-phase', 'falling')
        self.assertFalse(self.page.evaluate('window.robotSpeech.some(text => text !== "[cancel]")'))
        expect(intro).to_have_attribute('data-phase', 'landed')
        expect(self.page.locator('#robot-intro-img')).to_have_attribute('src', '/static/img/robot/RobotLanded.png')
        expect(intro.locator('.robot-dialogue-live')).to_contain_text('errei o pouso')
        self.page.screenshot(path=str(Path(tempfile.gettempdir()) / 'robot-landing-frame.png'), full_page=True)
        expect(intro).to_have_attribute('data-phase', 'rising')
        expect(self.page.locator('#robot-intro-img')).to_have_attribute('src', '/static/img/robot/RobotGettingUp.png')
        expect(intro).to_have_attribute('data-phase', 'inviting')
        frames = self.page.evaluate('window.entranceFrames')
        expected = [('falling', 'RobotFalling.png'), ('bracing', 'RobotBracing.png'),
                    ('landed', 'RobotLanded.png'), ('rising', 'RobotGettingUp.png')]
        actual = [(frame['phase'], frame['src'].split('/')[-1]) for frame in frames if frame['phase'] in dict(expected)]
        self.assertEqual(expected, actual)
        self.assertTrue(all(frame['loaded'] for frame in frames if frame['phase'] in dict(expected)))
        expect(intro.locator('.robot-dialogue-text')).to_contain_text('escolha uma causa')
        intro.locator('[data-robot-voice]').click()
        self.assertIn('escolha uma causa', self.page.evaluate('window.robotSpeech.at(-1)'))
        self.page.screenshot(path=str(Path(tempfile.gettempdir()) / 'robot-story-desktop.png'), full_page=True)
        self.page.locator('#robot-intro-choose').click()
        expect(intro).to_be_hidden()
        expect(self.page.locator('.cause-card-ui').first).to_be_focused()
        self.page.keyboard.press('Enter')
        expect(self.page.locator('#step-idea')).to_have_class('step active')
        expect(self.page.locator('#robot-quest .is-done')).to_have_count(1)
        expect(self.page.locator('#step-idea .robot-dialogue-live')).to_contain_text('Primeira missão cumprida')
        expect(self.page.locator('#robot-quest [aria-current="step"]')).to_contain_text('Ideia')
        self.page.locator('.robot-voice-global').click()
        self.assertEqual('[cancel]', self.page.evaluate('window.robotSpeech.at(-1)'))
        self.assertEqual([], self.errors)

    def test_missing_fall_image_keeps_invitation_usable(self):
        self.page.route('**/RobotBracing.png', lambda route: route.abort())
        self.page.goto(self.url)
        self.page.locator('#btn-start').click()
        self.page.locator('#btn-skip-study').click()
        expect(self.page.locator('#robot-intro')).to_have_attribute('data-phase', 'inviting')
        expect(self.page.locator('#robot-intro-img')).to_have_attribute('src', '/static/img/robot/RobotWaving.png')
        self.page.locator('#robot-intro-choose').click()
        expect(self.page.locator('#robot-intro')).to_be_hidden()
        self.page.keyboard.press('Enter')
        expect(self.page.locator('#step-idea')).to_have_class('step active')
        self.assertEqual([], self.errors)

    def test_consistent_layout_fits_desktop_and_mobile_viewports(self):
        self.page.emulate_media(reduced_motion='reduce')
        self.page.goto(self.url)
        self.page.locator('#btn-start').click()
        self.page.locator('#btn-skip-study').click()
        self.page.locator('#robot-intro-choose').click()
        self.page.locator('.cause-card-ui').first.click()
        expect(self.page.locator('#step-idea')).to_have_class('step active')
        self.page.evaluate("""() => {
          for (const id of ['polaroid-image', 'polaroid-sketch-image']) {
            document.getElementById(id).src = '/static/img/robot/RobotHeart.png';
          }
        }""")
        steps = ['welcome', 'cause', 'idea', 'style', 'phrase', 'name', 'generating', 'result']
        for width, height in [(1366, 768), (1920, 1080), (390, 844), (375, 667)]:
            self.page.set_viewport_size({'width': width, 'height': height})
            for step in steps:
                with self.subTest(viewport=(width, height), step=step):
                    self.page.evaluate("async id => (await import('/static/js/ui.js')).showStep(id)", 'step-' + step)
                    metrics = self.page.evaluate("""() => {
                      const stage = document.querySelector('.step.active .scene');
                      const rect = stage.getBoundingClientRect();
                      return {pageWidth: document.documentElement.scrollWidth,
                        pageHeight: document.documentElement.scrollHeight,
                        stageWidth: stage.clientWidth, contentWidth: stage.scrollWidth,
                        stageHeight: stage.clientHeight, contentHeight: stage.scrollHeight,
                        bottom: rect.bottom};
                    }""")
                    self.assertLessEqual(metrics['pageWidth'], width)
                    self.assertLessEqual(metrics['pageHeight'], height)
                    self.assertLessEqual(metrics['contentWidth'], metrics['stageWidth'] + 1)
                    self.assertLessEqual(metrics['contentHeight'], metrics['stageHeight'] + 1, metrics)
                    for control in self.page.locator('.step.active button, .step.active input, .step.active textarea').all():
                        if control.is_visible():
                            box = control.bounding_box()
                            self.assertGreaterEqual(box['y'], 0)
                            self.assertLessEqual(box['y'] + box['height'], metrics['bottom'] + 1)
                    if width in (1366, 390) and step in ('welcome', 'cause', 'idea', 'result'):
                        self.page.screenshot(path=str(Path(tempfile.gettempdir()) / f'experience-{width}-{step}.png'))
        # When zoom/a keyboard makes the viewport exceptionally small, content
        # remains reachable inside the stage without scrolling the document.
        self.page.set_viewport_size({'width': 320, 'height': 480})
        self.page.evaluate("async () => (await import('/static/js/ui.js')).showStep('step-idea')")
        self.page.locator('#btn-next-idea').scroll_into_view_if_needed()
        box = self.page.locator('#btn-next-idea').bounding_box()
        self.assertLess(box['y'] + box['height'], 480)
        self.assertEqual(480, self.page.evaluate('document.documentElement.scrollHeight'))
        self.assertEqual([], self.errors)

    def test_skip_entrance_cancels_delayed_lines_and_mobile_layout(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.page.goto(self.url)
        self.page.locator('#btn-start').click()
        self.page.locator('#btn-skip-study').click()
        expect(self.page.locator('#robot-intro')).to_be_visible()
        self.page.keyboard.press('Escape')
        expect(self.page.locator('#robot-intro')).to_be_hidden()
        self.page.keyboard.press('Enter')
        expect(self.page.locator('#step-idea')).to_have_class('step active')
        self.page.wait_for_timeout(4300)
        expect(self.page.locator('#step-idea .robot-dialogue-text')).to_contain_text('que história vamos desenhar')
        expect(self.page.locator('#robot-intro')).to_be_hidden()
        self.assertFalse(self.page.evaluate('document.documentElement.classList.contains("robot-intro-open")'))
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), 390)
        self.page.screenshot(path=str(Path(tempfile.gettempdir()) / 'robot-story-mobile.png'), full_page=True)
        self.assertEqual([], self.errors)


if __name__ == '__main__':
    unittest.main()
