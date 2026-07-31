/* ============================================================
   أداة بناء: بتجمّع كل ملفات assets/ في ملف HTML واحد
   ------------------------------------------------------------
   ليه؟ عشان النشر يبقى أسهل — ملف واحد بس ترفعه، من غير مجلدات.
   الملفات المصدرية في assets/ بتفضل هي الأصل اللي بتعدّل فيه.

   التشغيل:
     node build.js          ->  dist/index.html         (النسخة الحقيقية)
     node build.js --demo   ->  dist/index-demo.html    (عرض بمعلومات وهمية)
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const ASSETS = path.join(ROOT, 'assets');
const DIST = path.join(ROOT, 'dist');
const DEMO = process.argv.includes('--demo');

const read = f => fs.readFileSync(path.join(ASSETS, f), 'utf8');

/* ---------- 1) الشعار كـ data URI ---------- */
const logoDataUri = 'data:image/jpeg;base64,' +
  fs.readFileSync(path.join(ASSETS, 'logo.jpg')).toString('base64');

/* ---------- 2) قراءة الهيكل ----------
   بنقرا من src/shell.html عشان لو استبدلت index.html في الجذر بالنسخة
   المدمجة (للنشر بملف واحد)، البناء يفضل شغال ومايبنيش فوق نفسه. */
const SHELL = fs.existsSync(path.join(ROOT, 'src', 'shell.html'))
  ? path.join(ROOT, 'src', 'shell.html')
  : path.join(ROOT, 'index.html');

let html = fs.readFileSync(SHELL, 'utf8');

if (!/<link rel="stylesheet" href="assets\/app\.css">/.test(html)) {
  console.error('خطأ: ' + path.relative(ROOT, SHELL) + ' مش الهيكل المصدري ' +
                '(مفيهوش وسم assets/app.css). لازم يكون النسخة اللي بتشاور على assets/.');
  process.exit(1);
}

/* ---------- 3) دمج الـ CSS ---------- */
html = html.replace(
  /<link rel="stylesheet" href="assets\/app\.css">/,
  '<style>\n' + read('app.css') + '\n</style>'
);

/* ---------- 4) دمج ملفات الجافاسكريبت ---------- */
const MODULES = ['config.js', 'util.js', 'auth.js', 'data.js', 'docs.js', 'app.js'];

// نشيل كل وسوم <script src="assets/..."> ونحط مكانها الكود نفسه
MODULES.forEach(m => {
  html = html.replace(new RegExp('\\s*<script src="assets/' + m.replace('.', '\\.') + '"></script>'), '');
});

/* وسم التهيئة الموجود في الهيكل المصدري — بنتعامل معاه في مكانين تحت */
const INIT_TAG_RE =
  /\s*<script>\s*\/\/ تهيئة Firebase قبل أي وحدة بتستخدمه\s*firebase\.initializeApp\(FIREBASE_CONFIG\);\s*<\/script>/;

/* الـ try هنا مهم بعد الدمج: دلوقتي التهيئة في نفس البلوك بتاع باقي الكود،
   فلو سكريبت Firebase نفسه ما اتحمّلش (نت مقطوع / حجب) الاستثناء كان هيقتل
   الحزمة كلها وتطلع صفحة فاضية. بالشكل ده Auth.init هيمسك الحالة ويعرض
   رسالة عربية واضحة. */
const INIT_CALL =
  '/* ===== تهيئة Firebase ===== */\n' +
  'try { firebase.initializeApp(FIREBASE_CONFIG); }\n' +
  'catch (e) { console.error(\'Firebase init failed\', e); }';

/* ليه بنحقن التهيئة جوه الحزمة؟
   في الهيكل المصدري كل ملف في وسم <script> لوحده، فـ config.js بيشتغل قبل
   سطر التهيئة وكل حاجة تمام. لكن الحزمة كلها بتتحط قبل </body>، يعني بعد
   وسم التهيئة — فكان بينده FIREBASE_CONFIG قبل ما يتعرّف أصلاً ويرمي
   ReferenceError، وFirebase مايتهيّأش، وبعدين firebase.auth() يفشل و_auth
   يفضل null لحد ما تسجيل الدخول يرمي "reading 'setPersistence' of null".
   الحل: التهيئة تيجي جوه الحزمة مباشرة بعد config.js. */
const bundle = MODULES
  .map(m => {
    const code = '/* ===== ' + m + ' ===== */\n' + read(m);
    // في وضع العرض الـ DEMO_STUB بيستبدل firebase كله، فمش محتاجين التهيئة
    return (m === 'config.js' && !DEMO) ? code + '\n\n' + INIT_CALL : code;
  })
  .join('\n\n');

/* ---------- 5) وضع العرض: نستبدل Firebase بنسخة وهمية ---------- */
const SAMPLE = {
  projects: [
    { id:'p1', name:'مصنع النور للبلاستيك', clientName:'شركة النور', value:180000,
      color:'#d58a45', date:'2026-03-01', notes:'لوحات توزيع رئيسية',
      additions:[{ id:'a1', desc:'تمديد خط إضافي', amount:22000, date:'2026-05-02', created:5 }],
      manufacturing:[{ id:'m1', workshopName:'ورشة الأمل', technicianName:'محمد علي',
        agreedAmount:45000, date:'2026-03-10', notes:'تصنيع لوحات',
        payments:[{ id:'y1', amount:20000, date:'2026-04-01', time:'12:00', notes:'دفعة أولى', created:6 }] }] },
    { id:'p2', name:'ورشة السلام', clientName:'أحمد سعيد', value:70000,
      color:'#4fb883', date:'2026-04-12', additions:[], manufacturing:[] },
    { id:'p3', name:'محطة رفع الشرقية', clientName:'مقاولات الشرق', value:250000,
      color:'#6ba9df', date:'2026-05-20', additions:[], manufacturing:[] }
  ],
  clients: [
    { id:'c1', name:'شركة النور', phone:'01011112222', balance:35000, notes:'عميل دائم' },
    { id:'c2', name:'أحمد سعيد', phone:'01033334444', balance:5000, notes:'' }
  ],
  suppliers: [
    { id:'s1', name:'مورد الكابلات', phone:'01055556666', balance:18000, notes:'' },
    { id:'s2', name:'شركة العدد',   phone:'',            balance:4200,  notes:'' }
  ],
  transactions: [
    { id:'t1', type:'payment',    amount:90000,  projectId:'p1', desc:'دفعة أولى',        partyName:'شركة النور',    date:'2026-03-05', created:1 },
    { id:'t2', type:'purchase',   amount:38000,  projectId:'p1', desc:'كابلات وقواطع',    partyName:'مورد الكابلات', date:'2026-03-18', created:2 },
    { id:'t3', type:'labor',      amount:12000,  projectId:'p1', desc:'مصنعية لوحات',     partyName:'ورشة الأمل',    date:'2026-04-02', created:3 },
    { id:'t4', type:'payment',    amount:40000,  projectId:'p2', desc:'دفعة',             partyName:'أحمد سعيد',     date:'2026-04-20', created:4 },
    { id:'t5', type:'expense',    amount:5500,   projectId:'p2', desc:'مواصلات وأكل عمال', partyName:'',             date:'2026-05-01', created:5 },
    { id:'t6', type:'payment',    amount:120000, projectId:'p3', desc:'دفعة تعاقد',       partyName:'مقاولات الشرق', date:'2026-06-01', created:6 },
    { id:'t7', type:'purchase',   amount:47000,  projectId:'p3', desc:'لوحات توزيع',      partyName:'مورد الكابلات', date:'2026-06-15', created:7 },
    { id:'t8', type:'withdrawal', amount:15000,  projectId:'',   desc:'سحب شخصي',         partyName:'',             date:'2026-07-02', created:8 },
    { id:'t9', type:'payment',    amount:60000,  projectId:'p3', desc:'دفعة ثانية',       partyName:'مقاولات الشرق', date:'2026-07-20', created:9 }
  ],
  quotes: [{ id:'q1', clientName:'شركة الفجر', title:'تركيب لوحة كهرباء', date:'2026-07-10',
    items:[{ name:'قاطع 100A', qty:3, price:1200 }, { name:'كابل 16mm', qty:50, price:85 }],
    labor:4000, created:10 }],
  invoices: [{ id:'i1', number:12, clientName:'شركة النور', title:'أعمال كهرباء', date:'2026-07-15',
    items:[{ name:'لوحة توزيع', qty:2, price:8500 }, { name:'قواطع فرعية', qty:6, price:450 }], created:11 }],
  extInvoices: [{ id:'e1', clientName:'عميل خارجي', color:'#a78bda', title:'صيانة دورية', date:'2026-07-18',
    items:[{ name:'صيانة', qty:1, price:3000 }], created:12 }],
  portfolio: [],
  activity: [
    { id:'ac1', ts:Date.now() - 3600000,  kind:'create', text:'إضافة مشروع: محطة رفع الشرقية', user:'المهندس' },
    { id:'ac2', ts:Date.now() - 7200000,  kind:'update', text:'تعديل حركة: دفعة تعاقد',        user:'المهندس' },
    { id:'ac3', ts:Date.now() - 86400000, kind:'delete', text:'حذف مورد قديم',                 user:'المهندس' },
    { id:'ac4', ts:Date.now() - 90000000, kind:'auth',   text:'تسجيل دخول',                    user:'المهندس' }
  ],
  accounts: [
    { id:'ac_cib',  name:'CIB',  color:'#6ba9df', notes:'حساب جاري', created:1 },
    { id:'ac_cash', name:'كاش',  color:'#4fb883', notes:'',          created:2 }
  ],
  accountTx: [
    { id:'at1', accountId:'ac_cib',  toAccountId:'', type:'deposit',  amount:150000, date:'2026-06-01', notes:'رصيد افتتاحي', created:1 },
    { id:'at2', accountId:'ac_cib',  toAccountId:'', type:'withdraw', amount:20000,  date:'2026-06-18', notes:'مصاريف شخصية', created:2 },
    { id:'at3', accountId:'ac_cash', toAccountId:'', type:'deposit',  amount:12000,  date:'2026-07-02', notes:'',            created:3 },
    { id:'at4', accountId:'ac_cib',  toAccountId:'ac_cash', type:'transfer', amount:8000, date:'2026-07-21', notes:'تحويل للكاش', created:4 }
  ],
  users: [{ email:'accountant@smartrun.app', name:'المحاسب', role:'محاسب' }],
  nextInvoiceNumber: 13,
  settings: {}
};

const DEMO_STUB = `
/* ===== وضع العرض: Firebase وهمي — مفيش أي اتصال بالإنترنت ===== */
(function(){
  var STORE = ${JSON.stringify(SAMPLE)};
  var USER = { email:'demo@smartrun.app', displayName:'المهندس',
               metadata:{ creationTime:'2026-01-05T10:00:00Z', lastSignInTime:new Date().toISOString() },
               updateProfile:function(p){ USER.displayName = p.displayName; return Promise.resolve(); },
               reload:function(){ return Promise.resolve(); },
               reauthenticateWithCredential:function(){ return Promise.resolve(); },
               updatePassword:function(){ return Promise.resolve(); } };
  var doc = {
    get:  function(){ return Promise.resolve({ exists:true, data:function(){ return STORE; },
                                               metadata:{ hasPendingWrites:false } }); },
    set:  function(d){ STORE = d; return Promise.resolve(); },
    onSnapshot: function(){ return function(){}; }
  };
  window.firebase = {
    initializeApp: function(){},
    auth: function(){ return {
      currentUser: USER,
      onAuthStateChanged: function(cb){ setTimeout(function(){ cb(USER); }, 40); return function(){}; },
      setPersistence: function(){ return Promise.resolve(); },
      signInWithEmailAndPassword: function(){ return Promise.resolve({ user:USER }); },
      sendPasswordResetEmail: function(){ return Promise.resolve(); },
      signOut: function(){ return Promise.resolve(); }
    };},
    firestore: function(){ return { collection: function(){ return { doc: function(){ return doc; } }; } }; }
  };
  window.firebase.auth.Auth = { Persistence:{ LOCAL:'local', SESSION:'session' } };
  window.firebase.auth.EmailAuthProvider = { credential:function(){ return {}; } };
})();
`;

if (DEMO) {
  // نشيل سكريبتات Firebase الخارجية والخطوط (النسخة دي بتشتغل من غير إنترنت)
  html = html.replace(/\s*<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g, '');
  html = html.replace(/\s*<link rel="preconnect"[^>]*>/g, '');
  html = html.replace(/\s*<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^"]*">/g, '');
  html = html.replace(INIT_TAG_RE, '\n<script>' + DEMO_STUB + '</script>');
  html = html.replace(/<title>[^<]*<\/title>/,
    '<title>حسابات المهندس — نسخة عرض</title>');
} else {
  // التهيئة اتنقلت جوه الحزمة، فبنشيل الوسم من مكانه القديم
  html = html.replace(INIT_TAG_RE, '');
}

if (INIT_TAG_RE.test(html)) {
  console.error('خطأ: وسم تهيئة Firebase لسه موجود في الهيكل — تأكد إن نصه ما اتغيرش.');
  process.exit(1);
}

/* ---------- 6) حقن الحزمة ---------- */
html = html.replace('</body>', '<script>\n' + bundle + '\n</script>\n</body>');

/* ---------- 7) استبدال مسار الشعار بالصورة نفسها ---------- */
html = html.split('assets/logo.jpg').join(logoDataUri);

/* ---------- 8) الكتابة ---------- */
fs.mkdirSync(DIST, { recursive: true });
const outName = DEMO ? 'index-demo.html' : 'index.html';
const outPath = path.join(DIST, outName);
fs.writeFileSync(outPath, html, 'utf8');

/* ---------- 9) فحوصات ---------- */
const problems = [];
if (/src="assets\//.test(html) || /href="assets\//.test(html)) problems.push('لسه فيه مراجع لمجلد assets');
MODULES.forEach(m => {
  if (html.indexOf('/* ===== ' + m + ' ===== */') === -1) problems.push('الوحدة ' + m + ' مش مدموجة');
});
if (html.indexOf('<style>') === -1) problems.push('الـ CSS مش مدموج');
if (DEMO && /gstatic\.com/.test(html)) problems.push('لسه فيه اتصال خارجي في نسخة العرض');

/* الفحص ده هو اللي كان هيمسك عطل "setPersistence of null":
   لازم firebase.initializeApp ييجي بعد تعريف FIREBASE_CONFIG، وقبل auth.js. */
const iDef  = html.indexOf('const FIREBASE_CONFIG');
const iInit = html.indexOf('firebase.initializeApp(FIREBASE_CONFIG)');
const iAuth = html.indexOf('/* ===== auth.js ===== */');
if (!DEMO) {
  if (iInit === -1) problems.push('سطر تهيئة Firebase مش موجود في الناتج');
  else if (iInit < iDef)  problems.push('تهيئة Firebase بتيجي قبل تعريف FIREBASE_CONFIG');
  else if (iInit > iAuth) problems.push('تهيئة Firebase بتيجي بعد auth.js');
}

console.log('تم البناء: dist/' + outName);
console.log('الحجم    : ' + (fs.statSync(outPath).size / 1024).toFixed(0) + ' كيلوبايت');
console.log('الوحدات  : ' + MODULES.length + ' + CSS + الشعار');
if (problems.length) { problems.forEach(p => console.log('  ⚠️  ' + p)); process.exit(1); }
console.log('كل الفحوصات تمام ✅');
