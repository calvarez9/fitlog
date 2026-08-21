// ---------- Progress line chart (plain SVG, no deps) ----------
const NS = "http://www.w3.org/2000/svg";

function el(tag, attrs = {}) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

// points: [{ date: Date, value: number, isPR: bool, label: string }]
export function renderProgressChart(svg, points, { yLabel = "" } = {}) {
  svg.innerHTML = "";
  const W = 600, H = 260;
  const padL = 40, padR = 16, padT = 16, padB = 28;

  if (!points.length) return;

  const values = points.map((p) => p.value);
  let minV = Math.min(...values);
  let maxV = Math.max(...values);
  if (minV === maxV) {
    minV -= 1;
    maxV += 1;
  }
  const pad = (maxV - minV) * 0.12;
  minV = Math.max(0, minV - pad);
  maxV += pad;

  const x = (i) => padL + (points.length === 1 ? (W - padL - padR) / 2 : (i * (W - padL - padR)) / (points.length - 1));
  const y = (v) => H - padB - ((v - minV) / (maxV - minV)) * (H - padT - padB);

  // gridlines (4 horizontal)
  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const v = minV + ((maxV - minV) * i) / gridSteps;
    const gy = y(v);
    svg.appendChild(el("line", { class: "grid-line", x1: padL, x2: W - padR, y1: gy, y2: gy }));
    const label = el("text", { x: padL - 8, y: gy + 3, "text-anchor": "end" });
    label.textContent = Math.round(v).toLocaleString();
    svg.appendChild(label);
  }

  // baseline (x axis)
  svg.appendChild(el("line", { class: "baseline", x1: padL, x2: W - padR, y1: H - padB, y2: H - padB }));

  // x labels: first, middle, last
  const labelIdxs = points.length <= 2 ? points.map((_, i) => i) : [0, Math.floor((points.length - 1) / 2), points.length - 1];
  [...new Set(labelIdxs)].forEach((i) => {
    const t = el("text", { x: x(i), y: H - 8, "text-anchor": i === 0 ? "start" : i === points.length - 1 ? "end" : "middle" });
    t.textContent = points[i].label;
    svg.appendChild(t);
  });

  // trend line
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.value)}`).join(" ");
  svg.appendChild(el("path", { class: "trend-line", d: pathD }));

  // points (+ tap tooltip)
  const tooltip = el("g", { style: "display:none" });
  const tooltipBg = el("rect", { class: "tooltip-bg", rx: 6, ry: 6, width: 90, height: 34 });
  const tooltipText1 = el("text", { class: "tooltip-text", x: 8, y: 14 });
  const tooltipText2 = el("text", { class: "tooltip-text", x: 8, y: 28, style: "font-weight:400" });
  tooltip.append(tooltipBg, tooltipText1, tooltipText2);

  points.forEach((p, i) => {
    const c = el("circle", {
      class: "trend-point" + (p.isPR ? " pr" : ""),
      cx: x(i),
      cy: y(p.value),
      r: p.isPR ? 6 : 4,
    });
    c.addEventListener("click", () => {
      tooltipText1.textContent = p.label;
      tooltipText2.textContent = `${p.value.toLocaleString()} ${yLabel}${p.isPR ? " · PR" : ""}`;
      let tx = x(i) - 45;
      tx = Math.max(4, Math.min(W - 94, tx));
      let ty = y(p.value) - 44;
      if (ty < 0) ty = y(p.value) + 12;
      tooltip.setAttribute("transform", `translate(${tx}, ${ty})`);
      tooltip.style.display = "block";
    });
    svg.appendChild(c);
  });

  svg.appendChild(tooltip);
  svg.addEventListener(
    "click",
    (e) => {
      if (e.target.tagName !== "circle") tooltip.style.display = "none";
    },
    { once: false }
  );
}
