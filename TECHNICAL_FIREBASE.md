# Backpack V3 — частные PvP-комнаты и минимальный trusted backend

## Статус
Код backend и интеграция созданы, **не развернуты**. Все выполненные сетевые тесты — локальная HTTP-заглушка с общим pure reducer. Реальную Firebase, Auth, Rules, callable Functions и latency НЕ проверяли. Не выполнялись remote reads, writes, Admin login, Rules changes, deployment. Включение anonymous Auth/Blaze пользователем ещё не подтверждено.

`/data/backpack_network_v3.html` — автономный offline training + ленивое сетевое подключение. Офлайн: открыть HTML, выбрать героя, начать тренировку. Ни Firebase SDK, ни Firebase запросы до нажатия сетевой кнопки не запускаются. CDN failure не мешает тренировке.

## Реализованная модель доверия
Это НЕ клиент, выдающий себя за trusted server. Продакшн-путь: Firebase Anonymous Auth → callable Functions → Admin RTDB transaction → общий server-computed deterministic результат. Клиент не может писать комнаты, готовность, seed или результат при корректных Rules. В browser mock только тестовый reducer, его UID не security; он не production transport.

**Экономика sandbox.** Сервер проверяет героя из whitelist, имя 1–24, массив ≤30, UID, размеры, координаты 6×5 и отсутствие наложений. Но законность владения/покупки предметов не проверяет: клиент может прислать любой предмет каталога, а локальные золото/магазин редактируемы. Это friends-only sandbox, не ranked/anti-cheat. HP сервер выбирает из каталога, не из клиента. Все получают +8 sandbox золота за каждый переход server round. Local ledger `UID+roomId` с `paidThrough` предотвращает обычное двойное начисление при snapshot/reload, но это НЕ защищённая валюта. Для ranked нужны серверные buy/sell/merge/reroll, inventory ownership и economy transaction.

## Протокол
- Новый namespace `/backpack_v3`. Никакого `/players`, глобального поиска/списка игроков.
- Create: 128-bit случайные roomId и invite token; в RTDB только SHA-256 token hash, исходный token возвращается создателю. Полная ссылка хранит token в fragment, не URL query. Не публикуйте приглашение. Members могут пересылать известную ссылку; revoke token UI пока нет.
- Join: callable проверяет token и transaction cap4. Новые joins только `preparing`; existing UID может reconnect при любой фазе. Join/leave сбрасывают readiness в сборке.
- Ready: callable валидирует loadout, сохраняет snapshot. Готовый участник не редактирует сборку без unready. All-ready ≥2 → atomic freeze, deterministic seed, result. Позднее изменение frozen запрещено. Никакого host browser authority.
- Два игрока: одна дуэль. Четыре: 2 параллельные дуэли; pairing вращается по 3 server round: AB/CD, AC/BD, AD/BC, весь набор 6 пар за 3 раунда. Три: AB, BC, AC каждый round; по 2 дуэли на игрока. Victory=1, draw=0.5, defeat=0; normalized=points/games.
- Клиент показывает свои дуэли последовательно, общий результат у всех один. Tick=10ms, simulation step=50ms, max90s; replay ×1 использует timestamps, одновременные события группируются, finish строго по duration. UI clocks не меняют server outcome.
- Ack всех активных игроков → preparing, server round++, ready reset. Ack повторный idempotent. При result leave сохраняет frozen roster, удаляет active member; уход владельца передаёт роль, уход последнего удаляет room. Explicit leave теряет доступ к room. Disconnect не удаляет membership; ready/result сохраняются; .info/connected и onDisconnect для отдельного presence. Reconnect того же anonymous UID по localStorage-ссылке. Очистка auth storage/инкогнито → новый UID, восстановление не гарантировано; max4 учитывает disconnected места.
- TTL24h; scheduled cleanup раз в час, до100 expired rooms/запуск. Нет автоматического kick отсутствующих и deadline ready/ack: оставшиеся могут выйти и создать новую комнату. Нет сезонного рейтинга, длительного турнира/кумулятивной таблицы, spectator mode и revoke invitation.

## Критический guard для Rules существующего проекта
**Не вставлять fragment вслепую.** RTDB `allow` на родительском/root пути каскадирует. Если существующее `.read:true` или `.write:true` разрешает доступ к `/backpack_v3` на любом предке, дочернее `false` это НЕ отменит. `database.rules.namespace-fragment.json` безопасен лишь после аудита ancestor grants и всех релевантных auth-условий. Неизвестные текущие Rules → production deployment blocked до проверки владельцем. Нельзя обещать namespace isolation одним fragment.

- `database.rules.new-project-only.json` — deny-default шаблон ТОЛЬКО нового пустого проекта или emulator. Не заменять им live Rules: это может закрыть текущие приложения.
- `database.rules.namespace-fragment.json` — только новый child для **reviewed** Rules. Preserve остальное дерево. Нет публичных room catalogs. Members read только свой room, writes только own presence. Private `owned`/`limits` client deny.
- Admin bypasses Rules — его callable code и IAM доверенные. Member read room включает hash приглашения; hash не secret token и не принимается вместо token.
- До merge: забрать текущие Rules штатным владельческим способом, проверить root/ancestors grants; согласовать изменения с владельцем; запуск security Rules tests против фактически merged файла. Если родительский grant нельзя безопасно закрыть, новый выделенный RTDB instance/project вместо unsafe fragment.

## Локальный запуск и тесты
Из `/data`:
```bash
python firebase-v3/build.py
node firebase-v3/tests/core.test.cjs
node firebase-v3/tests/browser.test.cjs
```
Playwright uses installed `chromium`. Browser tests стартуют local HTTP server на случайном loopback порту, 5 независимых contexts, подставляют `window.__BACKPACK_V3_ADAPTER__`. Это не Firebase emulator и не проверка Firebase security. Внешние запросы блокируются. Never ship injected mock adapter.

## Firebase emulator (не запускался)
Node22+ и Firebase CLI + Java нужны отдельно. Только demo project:
```bash
cd /data/firebase-v3/functions
npm install
cd ..
firebase emulators:start --config firebase.emulator.json --project demo-backpack-v3
```
Для emulator client использовать отдельную копию HTML: перед network script вставить `window.BACKPACK_V3_EMULATOR=true` и Firebase config projectId/authDomain/databaseURL заменить на demo-backpack-v3. Не включать emulator флаг на публичном hosted build. SDK CDN нужен для Firebase emulator browser adapter; тренировка не зависит от него.

## Production deployment — владельцем, только после согласования
1. Подтвердить Firebase-проект `dnd-gay`, authorized web domain, anonymous Auth и billing Blaze для Functions. Public web config не secret; private Admin credentials не нужны в клиенте.
2. Провести Rules guard audit выше; не пользоваться emulator config для live Rules deploy. Создать reviewed deployment config с functions codebase `backpack-v3` и только согласованным merged Rules файлом. Firebase CLI credentials используются владельцем локально; не отправлять ключи/токены в чат или HTML.
3. `npm install` в `functions`. Сохранить package-lock, проверить audit. Region `europe-west1`, Node22 runtime. Source `index.cjs`, exports `backpackV3Create`, `backpackV3Command`, `backpackV3Cleanup`.
4. Deployment commands после разрешения, не выполнялись здесь:
```bash
firebase deploy --project dnd-gay --config firebase.production.reviewed.json --only functions:backpack-v3
# Rules отдельно только после review, явного разрешения и emulator regression:
firebase deploy --project dnd-gay --config firebase.production.reviewed.json --only database
```
5. Сначала staging smoke tests with Auth and deployed Rules: unauthorized/root list denied; own/foreign presence; forged result writes denied; invalid/full invite; all-ready freeze; fifth-join race; reconnect UID; expiration; Functions errors.
6. Host HTML по HTTPS (localhost для разработки). Firebase config уже исходного проекта. Callable endpoint names/region совпадают. Hosted UI начинает реальное подключение только после сетевой кнопки.
7. Для публичного релиза: подключить App Check (client provider ещё отсутствует), затем `BACKPACK_V3_ENFORCE_APP_CHECK=true` server env после отдельного теста. Есть per-UID throttle/1 owned active room/maxInstances10, но anonymous UID churn обходится; нужны global abuse budgets, rate limiting/AppCheck, monitoring и quotas. Client AppCheck нельзя просто включить server flag без provider.
8. Добавить trusted economy commands, версионирование catalog и миграцию rooms, idempotent create requestId, server ack deadline/abandon flow, invitation revoke, data retention/audit. Create потерянный ответ может оставить owned room без token; текущий UX требует сохранённую ссылку или TTL24h — production должен добавить recover/revoke endpoint.

## Integration hooks для main/design
Смотри `/data/firebase-v3-report.md`. Build script модифицирует только NEW HTML, исходный дизайн/игра сохранены. Если final design другой, не перезапускать build.py после merge без переноса дизайна: он строит из original 2_5d.
