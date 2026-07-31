"""
خادم تطوير محلي لتصفح التطبيق أثناء التعديل.

للتشغيل:
    python server.py
ثم افتح:  http://127.0.0.1:5500/index.html

ملاحظات أمنية (تغيّرت عن النسخة السابقة):
  • كان الخادم بيسمع على 0.0.0.0 يعني متاح لأي جهاز على نفس الشبكة.
    دلوقتي بيسمع على 127.0.0.1 (هذا الجهاز فقط).
  • كان فيه مسار PUT /data.json بيكتب على القرص من غير أي مصادقة —
    يعني أي حد على الشبكة كان يقدر يستبدل الملف. المسار ده اتشال
    لأن التطبيق بقى بيخزن بياناته في Firestore ومابيستخدمش data.json.
  • كان بيرسل Access-Control-Allow-Origin: * على كل استجابة. اتشال
    لأنه مش محتاج ومابيفتحش الملفات لمواقع تانية من غير داعي.
"""

from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HOST = '127.0.0.1'
PORT = 5500


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        # أثناء التطوير عايزين المتصفح ياخد آخر نسخة من الملفات دايماً
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        # حماية أساسية حتى في بيئة التطوير
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        super().end_headers()

    def log_message(self, fmt, *args):
        # سجل مختصر بدل الضجيج الافتراضي
        print('%s - %s' % (self.address_string(), fmt % args))


if __name__ == '__main__':
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print('Serving %s at http://%s:%d/index.html' % (ROOT, HOST, PORT))
    print('Press Ctrl+C to stop.')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nStopped.')
        server.server_close()
