# Firebase V3: выполнено, проверено, интеграция

Дата: 2026-10-13 (Europe/Moscow). Исходные HTML и чужие design-файлы не менялись. Предыдущий `/data/game-network.md` сохранён как исторический аудит; этот файл — актуальный V3 implementation report.

## Результат

Создан `/data/backpack_network_v3.html` (≈144KB) на базе `/data/backpack_brawl_2_5d.html`. Это working offline game + интегрированный Firebase callable client. Реальный минимальный trusted backend создан в `/data/firebase-v3/functions/`. **Firebase не развернут и не проверен live.** Работоспособность протокола подтверждена локальной заглушкой в пяти независимых browser contexts. Мы НЕ выдаём mock adapter за Firebase или client code за trusted server.

Выполнено:
- Private create/join/share link для 2–4; пятый не входит, публичного players/lobby каталога нет.
- Anonymous Auth SDK lazy, не запускается при открытии или офлайн-тренировке. Конфиг взят из исходного предоставленного HTML и является публичным web config.
- Backend transaction frozen loadouts + common deterministic replay/result, server seed и version `v3.0.0`.
- Для4 rotating pairs по server round, для3 triangle и нормированные очки, для2 одна дуэль.
- Готовность блокирует UI-перемещения/покупки/продажу/обновление и keyboard actions; unready разрешён до общего старта. Сервер запрещает изменение frozen раунда.
- Shared result независимо от client timing, mirrored actor/target correct. Timeline 1× по tick/duration, simultaneous events группируются. Test-only override 1000×.
- Reconnect same anonymous UID через локальную сохранённую ссылку; replay frozen result после reload. Presence отдельно, Firebase `.info/connected` и acknowledged onDisconnect before online set.
- Explicit leave, owner transfer, next round только all active ack. Equal sandbox income +8/новый server round, local ledger idempotent против повторного snapshot/reattach.
- Отдельная офлайн-тренировка работает при Firebase CDN fail. Ошибки Auth/permissions/network видны в status и notify с действиями.
- Deny-default new-project/emulator Rules + reviewed namespace fragment, подробный ancestor-grants guard в README.

## Фактические тесты

### Pure core: 10/10 PASS
Команда: `node /data/firebase-v3/tests/core.test.cjs`. Лог `firebase-v3/tests/core-test.log`.
1. Unknown item, overlap, дробные/outside coords и duplicate UID rejected.
2. Клиентский baseHp игнорируется; server hero HP из whitelist.
3. Повтор seed даёт byte-identical duel replay.
4. Нет оружия → symmetric timeout draw.
5. 4-player rotation покрывает все6 пар за3 раунда.
6. Triangle даёт каждому2 игры и normalized points/games.
7. Fifth join / outsider ready rejected.
8. All-ready freezes, late edits/new join denied, existing UID reconnect allowed, ack idempotent.
9. Leave сбрасывает readiness, owner transfers, final leave deletes room.
10. Expired room rejects join.

### Playwright local mock: 13 PASS-сценариев
Команда: `node /data/firebase-v3/tests/browser.test.cjs`. Лог `firebase-v3/tests/browser-test.log`, summary `browser-results.json`. Chromium headless, 5 independent contexts at desktop1440×1100; separate blocked-CDN context390×844. Local HTTP server on loopback ephemeral port. All external requests intercepted/blocked. Firebase Admin/SDK/remote project не использовались.

- 4 independent contexts create/join.
- 5th join rejected с понятной ошибкой.
- Ready locks normal UI editing.
- 4 игрока получили identical server/local-core replay; browser re-computation == server result.
- Disconnect mock/reload/reconnect в frozen result возвращает тот же result.
- All-ack gates next round.
- New server round даёт +8 sandbox каждому; repeat render и reattach не дублируют income.
- 3-player triangle, обе личные дуэли, normalized games2.
- Owner leave transfer.
- Отдельный normal1× synthetic timeline: attack at1s/2s, same-timestamp events together, finish≥3s; actor0 в mirrored view = enemy, actor1 = me, LS heal +thorn metadata applied.
- Offline training доступна.
- Mock path: 0 Firebase/CDN requests, 0 pageerrors.
- Real client with blocked CDN показывает понятную ошибку и всё ещё запускает training at390px.

`node --check functions/index.cjs`, `node --check client.js` PASS. Firebase dependency coldstart не тестировался. Rules JSON синтаксически создан; Firebase Rules engine НЕ запускался.

### Visual QA
Capture helper выполнен на standalone HTML, получен `firebase-v3/offline-preview.png`. Через Playwright получены `network-desktop.png`, `network-mobile-error.png`. Все три изображения открыты и просмотрены: нет overlap/горизонтального overflow в проверенных экранах, мобильная network panel теперь single-column, error notice readable. Внешний дизайн/арт остаются исходными; main накладывает свою visual/art версию. Battle-specific визуальная QA финального 2.5D merged design остаётся main (сеть проверила timeline/hooks, не заменила дизайн).

## Что НЕ проверено / production blockers

- Anonymous Auth включённость, authorized domains, billing/Blaze, IAM, quota, живые RTDB и deployed Functions.
- Firebase Auth persistence/onDisconnect real network race, RTDB reconnect latency, background-throttled mobile tabs.
- Правила в Firebase emulator и live merged Rules. Корректность namespace isolation зависит от **всех ancestor/root grants**; child false НЕ отзывает parent allow. Не вставлять fragment без аудита, не заменять live Rules deny-default шаблоном.
- Actual Admin transaction retry/load concurrency; fifth-join проверен shared local reducer, не emulator races.
- Abuse от массовых новых anonymous UID, AppCheck provider, invite revoke, lost-create-response recovery, deadlines/kick.
- Trusted economy / item ownership: **sandbox**. Клиент может прислать любой легальный предмет каталога. Локальное золото не security. Для ranked требуется server-owned inventory и buy/sell/merge/reroll transaction.
- Симуляция новая versioned PvP, не побитовая совместимость original local training. Stun статистика булава в original combat не использовалась и в V3 не реализована. Armor, magic, crit, potion, HP bonuses, LS (effective damage) и thorns реализованы. No persistent ranked score. Normalized scoreboard относится к текущему раунду.
- Replay стартует у каждого после получения frozen snapshot; это не wall-clock lockstep. Result одинаковый, latency не меняет outcome.

## Точные integration hooks

### Для main/design merge
Самый простой путь: взять `backpack_network_v3.html` как HTML base, поверх наложить design-only patch и ITEM_ART. **Не менять ITEMS/CHARACTERS баланс** без синхронизации server `items.json`/`characters.json` и version bump.

Если вручную переносить:
1. Полностью сохранить existing login/game/backpack/shop/arena DOM и IDs, особенно `playerName`, `enterBtn`, `shopList` (**не shopGrid**), `backpack`, `itemActions`, `rerollBtn`, `battleBtn`, `battleOverlay`, `battleCloseBtn`, `battleStage`, `fighterMe`, `fighterEnemy`, `battleLog`, `hudRound`, `leaveBtn`, `notify`.
2. Заменить только disabled original friends panel body на `<section id="networkV3">…</section>` из новой версии. `opponentsList` теперь внутри неё; он один. Дополнительные обязательные IDs: `networkRoom`, `networkStatus`, `networkInvite`, `networkCreate`, `networkJoin`, `networkShare`, `networkReconnect`, `networkReady`, `networkNext`, `networkLeave`, `networkScores`.
3. Перенести `<style id="backpack-v3-network-style">` (single-column reset нужен против inherited room-controls grid positioning).
4. В конце body ПОСЛЕ original game script и existing BattleScene code перенести `<script id="backpack-v3-core">` и `<script id="backpack-v3-network">`. Core configure читает лексические `ITEMS`, `CHARACTERS` same page. Network вызывается после DOM/game init. Скрипт не использует ES modules, работает как standalone file с training.
5. Удалить original login `if(db){...players...}`, original `listenOpponents` global listener, network `saveState` writer и original leave/remove path. Оставить `const db=null` можно (не используется). `startBattle()` только offline me/bot; никаких случайных opponentsCache.
6. `saveState()` теперь:
```js
function saveState(){
  if(window.BackpackV3?.network.room) {
    window.BackpackV3.persistSandbox();
    return;
  }
  localStorage.setItem('bb_v3_training', JSON.stringify(state));
}
function listenOpponents(){
  if(window.BackpackV3) window.BackpackV3.render();
}
```
7. Network script переопределяет handlers battleBtn/leaveBtn. Original startBattle/runBattle остаются для training; **PvP их НЕ вызывает** и не получает local win rewards. Replay использует existing `buildFighter`, `renderFighters`, `addLogLine`, `BattleScene.mount/update/attack/heal/finish/unmount`.
8. `BattleScene.attack(actor, {damage,crit,magic,weapon})`, actor=`me|enemy`; target opposite. `heal(actor,amount)`. `update(me,enemy)` вызывается original renderFighters; stub/new scene должен поддержать update.
9. Ready/result UI guard capture слушает click/pointerdown/mousedown/touchstart/keydown на `#shopList,#backpack,#itemActions,#rerollBtn`. Не обходить его новыми покупка/продажа controls вне этих IDs. Snapshot на сервере независим от client mutation.
10. Убрать stale «сеть ещё не реализована / данные никогда не отправляются» descriptions; новая корректная маркировка: default offline, remote only after explicit button, deployment pending, sandbox.

### Exposed API / тестовый adapter
`window.BackpackV3 = { Core, persistSandbox, network, connect, snapshot, attach, detach, isLocked, render, replay, shareLink }`.

`network = {adapter,uid,room,roomId,token,stop,busy,seen,presence,timer,generation}`.

Тестовый injectable adapter фабрика (до network script):
```js
window.__BACKPACK_V3_ADAPTER__ = async () => ({
  uid: 'test-stable-uid',
  async call(action,data) { /* create/join/ready/ack/leave */ },
  watch(roomId,onRoom,onError) { /* returns unsubscribe */ }
});
window.__BACKPACK_V3_REPLAY_FAST__ = true; // tests only, speed1000
```
Никогда не поставлять mock adapter вместе с production artifact. `BACKPACK_V3_EMULATOR=true` исключительно local, не fallback к live; demo config instructions README.

### Backend contract
Functions region=`europe-west1`, named app=`backpack-v3`.
- `backpackV3Create({loadout})` → `{roomId,token}`.
- `backpackV3Command({roomId,action:'join',token,loadout})` → `{ok:true}`.
- `...({roomId,action:'ready',ready:boolean,loadout})`.
- `...({roomId,action:'ack'})`.
- `...({roomId,action:'leave'})`.
- `backpackV3Cleanup`: hourly TTL cleanup.
Room reads ONLY `backpack_v3/rooms/<id>`, presence ONLY `backpack_v3/presence/<id>`; no root reads.

Полный deployment порядок и guard: `firebase-v3/README.md`. Deploy всё ещё pending. Не использовать emulator firebase config для Rules в существующем live проекте.
