#!/bin/bash
# End-to-end run of the game in a real browser: build server + playwright-cli session.
# Usage: bash tools/e2e.sh [port]
set -u
PORT="${1:-3112}"
cd "$(dirname "$0")/.." || exit 1
OUT="e2e-artifacts"
mkdir -p "$OUT"
LOG="$OUT/run.log"
exec > >(tee -a "$LOG") 2>&1

ev() { playwright-cli --raw eval "$1" 2>/dev/null | tail -1; }
label() { ev "document.querySelector('.phase-label')?.textContent ?? 'no-hud'"; }
phase() { ev "window.__fishing?.sim.state.phase ?? 'no-engine'"; }
shot() { playwright-cli screenshot --filename="$OUT/$1" >/dev/null 2>&1; }
clicktext() { ev "[...document.querySelectorAll('button')].find(b=>b.textContent.includes('$1'))?.click() ?? 'missing: $1'"; }

echo "== start server on $PORT =="
(nohup npx next start -p "$PORT" > "$OUT/server.log" 2>&1 &)
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/")
  [ "$code" = "200" ] && break
  sleep 1
done
echo "server http: $code"

playwright-cli close >/dev/null 2>&1
echo "== open page =="
playwright-cli open "http://localhost:$PORT/" --browser=chrome 2>&1 | tail -3
playwright-cli resize 1440 900 >/dev/null 2>&1
sleep 3
echo "boot check: canvas=$(ev "!!document.querySelector('canvas')") hud=$(ev "!!document.querySelector('.hud')")"
echo "webgl: $(ev "(()=>{const c=document.createElement('canvas');const g=c.getContext('webgl2');return g?g.getParameter(g.VERSION):'none'})()")"
echo "phase at start: $(phase) / label: $(label)"
shot 01-initial.png

echo "== console output =="
playwright-cli console 2>/dev/null | tail -25

echo "== cast: charge with the mouse and release =="
playwright-cli mousemove 700 470 >/dev/null 2>&1
playwright-cli mousedown >/dev/null 2>&1
sleep 0.5
echo "while charging: phase=$(phase) power=$(ev "Math.round(window.__fishing.sim.state.power*100)") target=$(ev "window.__fishing.sim.state.target?.distance?.toFixed(1)") land=$(ev "window.__fishing.sim.state.target?.onLand")"
shot 02-charging.png
playwright-cli mouseup >/dev/null 2>&1
sleep 0.4
echo "after release: phase=$(phase) rig=$(ev "window.__fishing.sim.state.rig?.distance?.toFixed(1)") zone=$(ev "window.__fishing.sim.state.rig?.zoneName")"
shot 03-waiting.png

echo "== wait for the bite window, then hook up =="
BITED=0
for i in $(seq 1 150); do
  p=$(phase)
  if [ "$p" = "strike" ]; then
    playwright-cli mousedown >/dev/null 2>&1
    playwright-cli mouseup >/dev/null 2>&1
    sleep 0.1
    echo "strike taken at $i steps -> phase=$(phase)"
    BITED=1
    break
  fi
  if [ "$p" = "investigating" ] && [ $((i % 20)) -eq 0 ]; then shot 04-bite.png; fi
  sleep 0.35
done
echo "bite reached: $BITED ; phase=$(phase)"

echo "== fight: reel while the tension is safe =="
LANDED=0
for i in $(seq 1 200); do
  p=$(phase)
  if [ "$p" != "fighting" ]; then
    if [ "$p" = "result" ]; then LANDED=1; fi
    break
  fi
  t=$(ev "Math.round(window.__fishing.sim.state.tension)")
  d=$(ev "window.__fishing.sim.state.fish?.distance?.toFixed(1)")
  st=$(ev "Math.round((window.__fishing.sim.state.fish?.stamina ?? 0)*100)")
  if [ "$i" -eq 6 ]; then shot 05-fight.png; fi
  if [ "$t" -lt 72 ]; then
    ev "window.__fishing.sim.setReeling(true)" >/dev/null
  else
    ev "window.__fishing.sim.setReeling(false)" >/dev/null
  fi
  sleep 0.25
done
echo "fight over: phase=$(phase) landed=$LANDED result=$(ev "JSON.stringify(window.__fishing.sim.state.result && {sp:window.__fishing.sim.state.result.species, w:window.__fishing.sim.state.result.weight, l:window.__fishing.sim.state.result.length, v:window.__fishing.sim.state.result.value})")"
shot 06-result.png

echo "== result panel: keep the fish =="
echo "panel visible: $(ev "!!document.querySelector('canvas.fish-preview')") weight text: $(ev "document.querySelector('.big-weight')?.textContent")"
clicktext "Оставить"
sleep 0.6
echo "after keep: net=$(ev "window.__fishing.sim.save.keepnet.length") phase=$(phase) hudNet=$(label)"
echo "hud chip: $(ev "[...document.querySelectorAll('.chip')].map(c=>c.textContent).join(' | ')")"

echo "== second cast: bait count decreases by one =="
BEFORE=$(ev "window.__fishing.sim.baitLeft")
playwright-cli mousemove 700 470 >/dev/null 2>&1
playwright-cli mousedown >/dev/null 2>&1
sleep 0.7
playwright-cli mouseup >/dev/null 2>&1
AFTER=$(ev "window.__fishing.sim.baitLeft")
echo "bait before=$BEFORE after=$AFTER phase=$(phase)"

echo "== retrieve the rig (button) =="
clicktext "Садок"
sleep 0.5
shot 07-keepnet.png
echo "keepnet panel: $(ev "document.querySelector('.panel h2')?.textContent") rows=$(ev "document.querySelectorAll('.panel .row').length")"
clicktext "Продать всё"
sleep 0.5
echo "after sell: money=$(ev "window.__fishing.sim.save.money") net=$(ev "window.__fishing.sim.save.keepnet.length")"
clicktext "Закрыть"

echo "== panels =="
for name in "Наживка" "Магазин" "Рекорды" "Настройки"; do
  clicktext "$name"
  sleep 0.45
  shot "panel-$name.png"
  echo "$name -> $(ev "document.querySelector('.panel h2')?.textContent")"
  clicktext "Закрыть"
  sleep 0.2
done

echo "== shop purchase works (give money first) =="
ev "window.__fishing.sim.save.money = 9000; window.__fishing.sim.save.xp = 900;" >/dev/null
clicktext "Магазин"
sleep 0.4
clicktext "Леска 0,35"
sleep 0.3
echo "line after buy: $(ev "window.__fishing.sim.save.lineId") money=$(ev "window.__fishing.sim.save.money")"
clicktext "Закрыть"

echo "== settings: quality + sound =="
clicktext "Настройки"
sleep 0.4
clicktext "Высокое"
sleep 1.2
echo "quality=$(ev "window.__fishing.sim.save.settings.quality") pixelRatio=$(ev "window.__fishing.renderer.getPixelRatio()")"
shot 08-quality-high.png
clicktext "Закрыть"

echo "== pause with Escape =="
playwright-cli press Escape >/dev/null 2>&1
sleep 0.4
echo "paused=$(ev "window.__fishing.paused") panel=$(ev "document.querySelector('.panel h2')?.textContent")"
shot 09-pause.png
playwright-cli press Escape >/dev/null 2>&1

echo "== persistence after reload =="
SAVE=$(ev "localStorage.getItem('prudok.fishing.save.v1')?.length ?? 0")
echo "localStorage bytes: $SAVE"
playwright-cli reload >/dev/null 2>&1
sleep 4
echo "after reload: phase=$(phase) money=$(ev "window.__fishing?.sim.save.money") line=$(ev "window.__fishing?.sim.save.lineId") quality=$(ev "window.__fishing?.sim.save.settings.quality")"
shot 10-reloaded.png

echo "== resize behaviour =="
playwright-cli resize 480 860 >/dev/null 2>&1
sleep 1.5
echo "small canvas: $(ev "document.querySelector('canvas').clientWidth + 'x' + document.querySelector('canvas').clientHeight")"
shot 11-mobile.png
playwright-cli resize 1280 720 >/dev/null 2>&1
sleep 1.5
shot 12-wide.png

echo "== console errors summary =="
playwright-cli console error 2>/dev/null | tail -20
echo "== final page errors recorded by the engine =="
ev "JSON.stringify({errors: (window.__err||[]).slice(0,5)})"

playwright-cli close >/dev/null 2>&1
pkill -f "next start -p $PORT" 2>/dev/null
pkill -f "next-server" 2>/dev/null
echo "== done =="
