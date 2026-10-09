# open-code-skills

[English](README.md) · [Русский](README.ru.md) · [Oʻzbekcha](README.uz.md)

> **Asosiy hujjat — [README.md](README.md).** Tarjimalar orqada qolishi mumkin;
> ziddiyat boʻlsa inglizcha hujjat yechim hisoblanadi. Uchalasini qoʻlda
> tahrirlashning hojati yoʻq — asosiy hujjatni oʻzgartiring, faqat oʻzgarishni
> tarjima qiling.

[OpenCode](https://opencode.ai) uchun oʻrnatiladigan plagin — tanlangan agent
koʻnikmalari toʻplami. Bir marta oʻrnatasan — har bir sessiyada mavjud boʻladi.

| | |
| --- | --- |
| Plugin ID | `open-code-skills` |
| Talab qilinadi | OpenCode `>= 1.18.0` |
| Ishga tushiruvchi muhit | Bun — Node.js kerak emas |
| Litsenziya | MIT |

## Qanday ishlaydi

Plagin yagona `config` hook ni eksport qiladi. Ishga tushganda oʻz `skills/`
palkasini tirik konfiguratsiyadagi `skills.paths` roʻyxatiga qoʻshadi va
OpenCode ning oʻz koʻnikmalarni topish mexanizmi ularni oladi. Hech narsa
global papkalarga koʻchirilmaydi.

## Koʻnikmalar

| Koʻnikma | Vazifasi |
| --- | --- |
| `powershell-windows` | PowerShell 5.1 qoidalari: zanjirlash, `$?` va `$LASTEXITCODE`, qoʻsh tirnoq, UTF-8 boʻlmagan konsol kodlash, tashqi dasturlar |
| `opencode-config-authoring` | `opencode.json` / `opencode.jsonc` yaratish va tuzatish, JSONC va shema tekshiruvchisi bilan |
| `skill-authoring` | Haqiqatan ishga tushadigan koʻnikmani yozish: karkas va tekshiruvchi |
| `self-improvement` | Biror tuzatishni unutiladigan niyat emas, doimiy artefaktga aylantirish |
| `code-discipline` | Kod standartlari va qatʼiy hajm budjeti: fayl 300/500 qator, funksiya 30/50, soʻramasdan yangi bogʻliqlik yoʻq |
| `assistant-runtime-architecture` | Uzoq muddatli assistent runtime: supervisor va bola jarayon, barqaror yetkazib berish, chiqish kontraktlari |
| `opencode-tool-output` | `opencode debug` JSONʼini regex oʻrniga tahlil qilish, va Windowsʼdagi ishga tushirish tuzoqlari: GUI binary va `opencode.cmd` shim |
| `test-first-fix` | Kodni oʻzgartirishdan oldin muammoni koʻrinadigan qilish, yaʼni tuzatish — mashina rad eta oladigan bayonot boʻlsin |
| `git-safety` | Buzuvchi buyruqdan oldin git daraxtini tekshirish va allaqachon yoʻqotilgan ishni tiklash |
| `github-repo-ops` | `gh` ni haqiqiy mavjud scopeʼlar bilan boshqarish va 403 «Resource not accessible» dan tiklanish |
| `release-checklist` | Muddat bosilganda tashlab ketiladigan chiqish tekshiruvlari — barchasi birdan yiqiladi |
| `troubleshooting-tree` | Tuzatishni taxmin qilish oʻrniga nomaʼlum sabab izohasini yarimga boʻlish |
| `long-task-continuity` | Uzoq vazifa kontekstni tozalash yoki jarayon toʻxtashidan oʻtib ketadigan barqaror nazorat nuqtasi |
| `api-doc-recall` | APIʼni eslab qolgan hujjat emas, oʻrnatilgan manba bilan tekshirish |
| `research-synthesis` | Bir necha manbani bitta javobga birlashtirib, nimaning tasdiqlangan, nimaning taxmin va nimaning nomaʼlum ekanini aniq koʻrsatish |
| `task-closure` | Vazifa tugaganini aniqlash, cheksiz takomillashtirishga kirmasdan: toʻxtash shartlari, tayyorlik testi va keyingi vazifaga qoldiriladigan narsalar roʻyxati |
| `provider-reconnect` | Modelga yuborilgan uzilgan soʻrovni ikki marta toʻlamasdan qayta yuborish: qayta yuboriladigan xatolar, jitter bilan backoff, `Idempotency-Key` va uzilib qolgan oqimlar |
| `subagent-delegation` | Ishtokni opencode subagentiga ataylab topshirish: `explore`/`general`/`scout` tanlash, toza kontekst bilan delegatsiya, parallel vazifalar va `permission.task` |
| `reference-books` | Google Drive kitob javonidan savollarga javob berish: mavzuni kitobga moslash, `fetch-book.mjs` bilan PDF yuklab olish va pdf koʻnikmasi bilan javobni oʻqish |

Har bir koʻnikma — oddiy papka: un ichida `SKILL.md` va YAML frontmatter bor,
[Agent Skills spetsifikatsiyasi](https://agentskills.io/specification) boʻyicha.
Ularni bu repositoriyadan koʻchirib, plagindan foydalanmasdan ham ishlatishingiz
mumkin.

## Oʻrnatish

`~/.config/opencode/opencode.jsonc` (global) yoki `.opencode/opencode.json`
(loyiha uchun) fayliga qoʻshing:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["github:TrueImmortal82/open-code-skills"]
}
```

Keyin OpenCode ni qayta ishga tushiring — konfiguratsiya hot reload qilinmaydi.

### Agar GitHub spetsifikatsiyasi ishlamasa

Toʻgʻridan-toʻgʻri oʻrnatish sizning OpenCode versiyangiz spetsifikatsiyani
paket oʻrnatuvchisiga topshirishi yoki yoʻqligiga bogʻliq. Agar topshirmasa,
repositoriyani klonlang va papkaga koʻrsating — barcha versiyalar buni
qoʻllaydi:

```bash
git clone https://github.com/TrueImmortal82/open-code-skills.git
```

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["C:/path/to/open-code-skills"]
}
```

Toʻgʻri chiziqdan foydalaning; Windows yoʻlini bevosita yozayotgan boʻlsangiz,
teskari chiziqlarni ekranlang.

### Tekshirish

```bash
opencode debug skill
```

Har bir koʻnikma koʻrinishi kerak, `location` esa sizning oʻrnatilgan
repositoriya nusxasi ichini koʻrsatishi kerak.

## Koʻnikmalarning bir qismi

Koʻnikmalar papka boʻyicha roʻyxatga olinadi, shuning uchun nusxadagi koʻnikma
palkasini oʻchirish uni oʻrnatishdan ham olib tashlaydi. Bitta koʻnikmada mahalliy
oʻzgarish qoldirib, qolganlarini yangilashni davom ettirmoqchi boʻlsangiz, shu
koʻnikmani `~/.config/opencode/skills/` ga koʻchiring — mahalliy koʻnikmalar ham
xuddi shu topish jarayonida ishtirok etadi.

## Rivojlantirish

```bash
git clone https://github.com/TrueImmortal82/open-code-skills.git
cd open-code-skills
npm run validate
```

`npm run validate` qoʻshilgan tekshiruvchini har bir koʻnikma boʻyicha ishga
tushiradi va frontmatter xatolari, buzilgan havolalar, haddan tashqari uzun
matnlar boʻlsa muvaffaqiyatsiz boʻladi.

```bash
node skills/skill-authoring/scripts/new-skill.mjs
node skills/skill-authoring/scripts/validate-skill.mjs skills/<your-skill>
node skills/code-discipline/scripts/check-size.mjs .   # fayl va bogʻliqlik budjeti
```

## Hissa qoʻshish

- Plagin moduli **faqat bitta** eksport sajlashi kerak — standart obyekt.
  OpenCode ning eski yuklagichi har bir nomlangan eksportni alohida plagin deb
  hisoblaydi va funksiya boʻlmagan narsaga xato beradi.
- `config` hook tirik konfiguratsiyani oladi; qaytariladigan qiymat eʼtiborsiz
  qoldiriladi, tashlangan xatolar yutiladi. Joyida oʻzgartiring va hech qachon
  xato tashlamang.
- Boshqa koʻnikma palkasining ichiga `SKILL.md` joylashtirmang: yoʻllar
  rekursiv `**/SKILL.md` globi bilan tekshiriladi, ichki fayl esa ikkinchi,
  kutilmagan koʻnikma sifatida roʻyxatga olinadi.
- Qurilmaga xos qiymatlarni — mutlaq yoʻllar, konsol kod sahifalari, uy
  papkalari — kodga yozib qoʻymang. Muhitni aniqlang.
- `SKILL.md` xatti-harakatni tasvirlaydi, fayl tuzilmasini emas: skript nima
  qilishini ayting, qaysi modulda qaysi tekshiruv borligini emas.
- `self-improvement/queue.md` — tirik jurnal, oʻz qaydlaringizni bemalol
  qoʻshing.

## Litsenziya

MIT — [LICENSE](LICENSE) fayliga qarang.
