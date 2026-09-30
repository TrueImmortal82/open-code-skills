# open-code-skills

**Русский** | **English** | **Oʻzbekcha**

Готовый набор агентских скилов в виде устанавливаемого плагина для [OpenCode](https://opencode.ai).

An installable [OpenCode](https://opencode.ai) plugin that ships a curated set of agent skills.

OpenCode uchun oʻrnatiladigan plagin — tanlangan agent koʻnikmalari toʻplami.

| | |
| --- | --- |
| **Plugin ID** | `open-code-skills` |
| **Requires** | OpenCode `>= 1.18.0` |
| **Runtime** | Bun (no Node.js required) |
| **License** | MIT |
| **Plugin shape** | single default export `{ id, server }` |

---

## Русский

### Что это

Плагин, который добавляет в OpenCode набор скилов. Установил — и они доступны в каждой сессии. Ничего не копируется в глобальные каталоги, ничего не прописывается вручную.

Плагин экспортирует единственный хук `config`. При старте он добавляет свою папку `skills/` в `skills.paths` живой конфигурации, и штатный механизм обнаружения скилов OpenCode подхватывает их оттуда.

### Состав

| Скил | Назначение |
| --- | --- |
| `powershell-windows` | Правила работы в Windows PowerShell 5.1 — цепочки команд, `$?` против `$LASTEXITCODE`, кавычки, не-UTF-8 кодировка консоли, запуск внешних exe |
| `opencode-config-authoring` | Создание и починка `opencode.json` / `opencode.jsonc` плюс валидатор JSONC и JSON Schema |
| `skill-authoring` | Как написать агентский скил, который действительно срабатывает: каркас и валидатор |
| `self-improvement` | Цикл, превращающий замечание в постоянный артефакт, а не в забытое намерение |
| `assistant-runtime-architecture` | Архитектура долгоживущего ассистент-рантайма — supervisor и дочерний процесс, надёжная доставка, контракты вывода |

Каждый скил — обычный каталог с `SKILL.md` и YAML-фронтматтером по [спецификации Agent Skills](https://agentskills.io/specification). Их можно скопировать из репозитория и использовать вообще без плагина.

### Установка

Добавь плагин в `~/.config/opencode/opencode.jsonc` (глобально) или `.opencode/opencode.json` (для одного проекта):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["github:TrueImmortal82/open-code-skills"]
}
```

После изменения конфигурации перезапусти OpenCode — горячей перезагрузки нет.

### Проверка установки

```bash
opencode debug skill
```

Каждый скил должен появиться в выводе, а поле `location` должно указывать внутрь установленной копии репозитория. Если у тебя есть виртуальное окружение, его тоже имеет смысл прогнать: `opencode debug skill` выводит пути, по которым видно, каким именно источником подхватился скил.

### Если спецификация с GitHub не сработала

Прямая установка с GitHub зависит от того, умеет ли твоя версия OpenCode передавать спецификацию в установщик пакетов. Если нет — склонируй репозиторий и укажи плагин на локальный каталог, это поддерживается всеми версиями:

```bash
git clone https://github.com/TrueImmortal82/open-code-skills.git
```

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["C:/path/to/open-code-skills"]
}
```

В пути используй прямые слэши. Если записываешь путь Windows буквально, обратные слэши нужно экранировать.

### Часть скилов вместо всех

Скилы регистрируются по каталогам, поэтому удаление каталога скила из своей копии убирает его из установки. Если хочешь сохранить локальную правку одного скила и при этом обновлять остальные, скопируй этот скил в `~/.config/opencode/skills/` — локальные скилы участвуют в том же проходе обнаружения.

### Разработка

```bash
git clone https://github.com/TrueImmortal82/open-code-skills.git
cd open-code-skills
npm run validate
```

`npm run validate` прогоняет встроенный валидатор по каждому скилу и падает на ошибках фронтматтера, битых внутренних ссылках и слишком длинных телах. Запускай перед открытием pull request.

Каркас нового скила:

```bash
node skills/skill-authoring/scripts/new-skill.mjs
node skills/skill-authoring/scripts/validate-skill.mjs skills/<your-skill>
```

### Замечания для контрибьюторов

- В модуле плагина должен быть **ровно один** экспорт — объект по умолчанию. Устаревший загрузчик OpenCode считает каждый именованный экспорт отдельным плагином и падает на всём, что не является функцией.
- Хук `config` получает живой объект конфигурации; возвращаемое значение игнорируется, а брошенные ошибки проглатываются. Мутируй на месте и никогда не бросай исключения.
- Не вкладывай `SKILL.md` внутрь каталога другого скила. Пути скилов сканируются рекурсивным глобом `**/SKILL.md`, поэтому вложенный файл зарегистрируется как второй, нежелательный скил.
- Не вшивай машинно-специфичные значения — абсолютные пути, кодовые страницы консоли, домашние каталоги. Вынеси определение окружения в сам скил, как это сделано в `powershell-windows`.
- `self-improvement/queue.md` — это живой журнал. Свои записи добавляй смело, они осмысленны и для других.

### Лицензия

MIT — см. [LICENSE](LICENSE).

---

## English

### What this is

A plugin that adds a set of skills to OpenCode. Install it once and they are available in every session. Nothing is copied into global directories and nothing has to be wired up by hand.

The plugin exposes a single `config` hook. At startup it appends its bundled `skills/` directory to `skills.paths` in the live config, and OpenCode's own skill discovery picks the skills up from there.

### What is included

| Skill | Purpose |
| --- | --- |
| `powershell-windows` | Windows PowerShell 5.1 execution rules — command chaining, `$?` vs `$LASTEXITCODE`, quoting, non-UTF-8 console encoding, invoking native executables |
| `opencode-config-authoring` | Authoring and repairing `opencode.json` / `opencode.jsonc`, plus a JSONC and JSON Schema validator |
| `skill-authoring` | How to write an agent skill that actually triggers, with a scaffolder and a validator |
| `self-improvement` | The loop that turns a correction into a durable artifact instead of a forgotten intention |
| `assistant-runtime-architecture` | Architecture for a long-lived assistant runtime — supervisor and child process, durable delivery, output contracts |

Each skill is a plain directory with a `SKILL.md` and YAML frontmatter, following the [Agent Skills specification](https://agentskills.io/specification). You can copy any of them out of this repository and use them without the plugin at all.

### Installation

Add the plugin to `~/.config/opencode/opencode.jsonc` (global) or `.opencode/opencode.json` (per project):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["github:TrueImmortal82/open-code-skills"]
}
```

Restart OpenCode afterwards. Config is not hot-reloaded.

### Verifying the install

```bash
opencode debug skill
```

Every skill should appear in the output, and its `location` field should point inside your installed copy of this repository. If you work in a virtual environment, run it there too: `opencode debug skill` prints the resolved paths, which show exactly which source a skill was picked up from.

### If the GitHub spec does not resolve

Direct GitHub install depends on whether your OpenCode version hands the spec to its package installer. If it does not, clone the repository and point the plugin at the local directory — that is supported by every version:

```bash
git clone https://github.com/TrueImmortal82/open-code-skills.git
```

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["C:/path/to/open-code-skills"]
}
```

Use forward slashes in the path. If you write a Windows path literally, its backslashes need escaping.

### Using a subset of the skills

Skills are registered per directory, so deleting a skill directory from your checkout removes it from the install. If you want to keep a local edit to one skill while still updating the rest, copy that skill into `~/.config/opencode/skills/` — locally installed skills take part in the same discovery pass.

### Development

```bash
git clone https://github.com/TrueImmortal82/open-code-skills.git
cd open-code-skills
npm run validate
```

`npm run validate` runs the bundled validator across every skill and fails on frontmatter errors, broken internal links, and over-long bodies. Run it before opening a pull request.

To scaffold a new skill:

```bash
node skills/skill-authoring/scripts/new-skill.mjs
node skills/skill-authoring/scripts/validate-skill.mjs skills/<your-skill>
```

### Notes for contributors

- The plugin module must keep **exactly one** export, the default object. OpenCode's legacy plugin loader treats every named export as a separate plugin and throws on anything that is not a function.
- The `config` hook receives the live config object; its return value is discarded and thrown errors are swallowed. Mutate in place, and never throw.
- Do not nest a `SKILL.md` inside another skill directory. Skill paths are scanned with a recursive `**/SKILL.md` glob, so a nested file registers as a second, unintended skill.
- Do not hardcode machine-specific values — absolute paths, console codepages, home directories. Put environment discovery in the skill itself, the way `powershell-windows` does.
- `self-improvement/queue.md` is a live log. Feel free to add your own entries; they are useful to other people too.

### License

MIT — see [LICENSE](LICENSE).

---

## Oʻzbekcha

### Bu nima

OpenCode ga koʻnikmalar toʻplamini qoʻshadigan plagin. Bir marta oʻrnatasan — har bir sessiyada mavjud boʻladi. Hech narsa global papkalarga koʻchirilmaydi va hech narsani qoʻlda ulash shart emas.

Plagin yagona `config` hook ni eksport qiladi. Ishga tushganda oʻz `skills/` papkasini tirik konfiguratsiyadagi `skills.paths` roʻyxatiga qoʻshadi va OpenCode ning oʻz koʻnikmalarni topish mexanizmi ularni shu yerdan oladi.

### Nima kiritilgan

| Koʻnikma | Vazifasi |
| --- | --- |
| `powershell-windows` | Windows PowerShell 5.1 bajarish qoidalari — buyruqlarni zanjirash, `$?` va `$LASTEXITCODE`, qoʻsh tirnoq, UTF-8 boʻlmagan konsol kodlash, tashqi dasturlarni ishga tushirish |
| `opencode-config-authoring` | `opencode.json` / `opencode.jsonc` yaratish va tuzatish, shu bilan birga JSONC va JSON Schema tekshiruvchisi |
| `skill-authoring` | Haqiqatan ishga tushadigan agent koʻnikmasini qanday yozish kerak: karkas va tekshiruvchi |
| `self-improvement` | Biror tuzatishni unutiladigan niyat emas, doimiy artefaktga aylantiruvchi sikl |
| `assistant-runtime-architecture` | Uzoq muddatli assistent runtime arxitekturasi — supervisor va bola jarayon, barqaror yetkazib berish, chiqish kontraktlari |

Har bir koʻnikma — oddiy papka: un ichida `SKILL.md` va YAML frontmatter bor, [Agent Skills spetsifikatsiyasi](https://agentskills.io/specification) boʻyicha. Ularni bu repositoriyadan koʻchirib, plagindan foydalanmasdan ham ishlatishingiz mumkin.

### Oʻrnatish

Plaginni `~/.config/opencode/opencode.jsonc` (global) yoki `.opencode/opencode.json` (loyiha uchun) fayliga qoʻshing:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["github:TrueImmortal82/open-code-skills"]
}
```

Keyin OpenCode ni qayta ishga tushiring — konfiguratsiya hot reload qilinmaydi.

### Oʻrnatishni tekshirish

```bash
opencode debug skill
```

Chiqishda har bir koʻnikma koʻrinishi kerak, `location` maydoni esa sizning oʻrnatilgan repositoriya nusxasi ichini koʻrsatishi kerak. Virtual muhitda ishlayotgan boʻlsangiz, uni ham shu yerga ishga tushiring: `opencode debug skill` tayinlangan yoʻllarni chiqaradi va koʻnikma qaysi manbadan olinganini aniq koʻrsatadi.

### Agar GitHub spetsifikatsiyasi ishlamasa

Toʻgʻridan-toʻgʻri GitHub dan oʻrnatish sizning OpenCode versiyangiz spetsifikatsiyani paket oʻrnatuvchisiga topshirishi yoki yoʻqligiga bogʻliq. Agar topshirmasa, repositoriyani klonlang va plaginni mahalliy papkaga koʻrsating — barcha versiyalar buni qoʻllaydi:

```bash
git clone https://github.com/TrueImmortal82/open-code-skills.git
```

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["C:/path/to/open-code-skills"]
}
```

Yoʻlda toʻgʻri chiziq ishlating. Windows yoʻlini bevosita yozayotgan boʻlsangiz, teskari chiziqlarni ekranlash kerak.

### Koʻnikmalarning bir qismini ishlatish

Koʻnikmalar papka boʻyicha roʻyxatga olinadi, shuning uchun nusxadagi koʻnikma papkasini oʻchirish uni oʻrnatishdan ham olib tashlaydi. Bitta koʻnikmada mahalliy oʻzgarish qoldirib, qolganlarini yangilashni davom ettirmoqchi boʻlsangiz, shu koʻnikmani `~/.config/opencode/skills/` ga koʻchiring — mahalliy koʻnikmalar ham xuddi shu topish jarayonida ishtirok etadi.

### Rivojlantirish

```bash
git clone https://github.com/TrueImmortal82/open-code-skills.git
cd open-code-skills
npm run validate
```

`npm run validate` qoʻshilgan tekshiruvchini har bir koʻnikma boʻyicha ishga tushiradi va frontmatter xatolari, buzilgan ichki havolalar, haddan tashqari uzun matnlar boʻlsa muvaffaqiyatsiz boʻladi. Pull request ochishdan oldin ishga tushiring.

Yangi koʻnikma karkasini yaratish:

```bash
node skills/skill-authoring/scripts/new-skill.mjs
node skills/skill-authoring/scripts/validate-skill.mjs skills/<your-skill>
```

### Hissa qoʻshuvchilar uchun

- Plagin moduli **faqat bitta** eksport saqlashi kerak — standart obyekt. OpenCode ning eski yuklagichi har bir nomlangan eksportni alohida plagin deb hisoblaydi va funksiya boʻlmagan narsaga xato beradi.
- `config` hook tirik konfiguratsiya obyektini oladi; qaytariladigan qiymat e'tiborsiz qoldiriladi, tashlangan xatolar yutiladi. Joyida oʻzgartiring va hech qachon xato tashlamang.
- Boshqa koʻnikma papkasining ichiga `SKILL.md` joylashtirmang. Koʻnikma yoʻllari rekursiv `**/SKILL.md` globi bilan tekshiriladi, shuning uchun ichki fayl ikkinchi, kutilmagan koʻnikma sifatida roʻyxatga olinadi.
- Qurilmaga xos qiymatlarni — mutlaq yoʻllar, konsol kod sahifalari, uy papkalari — kodga yozib qoʻymang. Muhitni aniqlashni oʻziga xos shu koʻnikmaga qoʻying, aynan `powershell-windows` qanday qilgani kabi.
- `self-improvement/queue.md` — tirik jurnal. Oʻz qaydlaringizni qoʻshishingiz mumkin, ular boshqalar uchun ham foydali.

### Litsenziya

MIT — [LICENSE](LICENSE) fayliga qarang.
