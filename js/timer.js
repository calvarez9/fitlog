// ---------- Rest timer ----------
import { getSettings } from "./db.js";

let remaining = 0;
let running = false;
let intervalId = null;
let onTick = () => {};
let onDone = () => {};

function fmt(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function initTimer({ display, startPauseBtn, plusBtn, minusBtn, resetBtn }) {
  remaining = getSettings().restTimerDefault || 90;
  display.textContent = fmt(remaining);

  function render() {
    display.textContent = fmt(remaining);
    startPauseBtn.textContent = running ? "Pause" : remaining === 0 ? "Restart" : "Start";
  }

  function tick() {
    remaining -= 1;
    if (remaining <= 0) {
      remaining = 0;
      stop();
      onDone();
      if (navigator.vibrate) navigator.vibrate([200, 80, 200]);
    }
    render();
  }

  function start() {
    if (running) return;
    if (remaining === 0) remaining = getSettings().restTimerDefault || 90;
    running = true;
    intervalId = setInterval(tick, 1000);
    render();
  }

  function stop() {
    running = false;
    clearInterval(intervalId);
    render();
  }

  startPauseBtn.addEventListener("click", () => (running ? stop() : start()));
  plusBtn.addEventListener("click", () => {
    remaining += 15;
    render();
  });
  minusBtn.addEventListener("click", () => {
    remaining = Math.max(0, remaining - 15);
    render();
  });
  resetBtn.addEventListener("click", () => {
    stop();
    remaining = getSettings().restTimerDefault || 90;
    render();
  });

  render();

  return {
    restart(seconds) {
      stop();
      remaining = seconds != null ? seconds : getSettings().restTimerDefault || 90;
      render();
      start();
    },
  };
}
