// ---------- Front/back body silhouette, colorable by muscle volume ----------
// Stylized (not anatomical) capsule-shaped regions, tagged data-muscle so
// they can be filled by js/volume.js output. Shared shapes (hands, feet,
// head) stay neutral — they're not tracked muscles, just body context.

const NEUTRAL = `class="bm-neutral"`;

function frontMarkup() {
  return `
    <circle cx="80" cy="20" r="14" ${NEUTRAL}/>
    <rect x="72" y="32" width="16" height="10" rx="4" ${NEUTRAL}/>
    <rect x="54" y="42" width="52" height="150" rx="16" ${NEUTRAL}/>

    <g data-muscle="frontDelts">
      <circle cx="46" cy="46" r="14"/>
      <circle cx="114" cy="46" r="14"/>
    </g>
    <g data-muscle="chest">
      <rect x="58" y="44" width="44" height="55" rx="14"/>
    </g>
    <g data-muscle="biceps">
      <rect x="32" y="50" width="16" height="70" rx="8"/>
      <rect x="112" y="50" width="16" height="70" rx="8"/>
    </g>
    <g data-muscle="forearms">
      <rect x="28" y="120" width="16" height="75" rx="8"/>
      <rect x="116" y="120" width="16" height="75" rx="8"/>
    </g>
    <circle cx="36" cy="200" r="9" ${NEUTRAL}/>
    <circle cx="124" cy="200" r="9" ${NEUTRAL}/>
    <g data-muscle="abs">
      <rect x="64" y="101" width="32" height="70" rx="12"/>
    </g>
    <rect x="58" y="190" width="44" height="30" rx="10" ${NEUTRAL}/>
    <g data-muscle="quadriceps">
      <rect x="56" y="215" width="20" height="95" rx="10"/>
      <rect x="84" y="215" width="20" height="95" rx="10"/>
    </g>
    <g data-muscle="calves">
      <rect x="57" y="315" width="18" height="70" rx="9"/>
      <rect x="85" y="315" width="18" height="70" rx="9"/>
    </g>
    <ellipse cx="66" cy="392" rx="10" ry="6" ${NEUTRAL}/>
    <ellipse cx="94" cy="392" rx="10" ry="6" ${NEUTRAL}/>
  `;
}

function backMarkup() {
  return `
    <circle cx="80" cy="20" r="14" ${NEUTRAL}/>
    <rect x="72" y="32" width="16" height="10" rx="4" ${NEUTRAL}/>
    <rect x="54" y="42" width="52" height="150" rx="16" ${NEUTRAL}/>

    <g data-muscle="traps">
      <path d="M72,34 L88,34 L108,58 L52,58 Z"/>
    </g>
    <g data-muscle="rearDelts">
      <circle cx="46" cy="50" r="13"/>
      <circle cx="114" cy="50" r="13"/>
    </g>
    <g data-muscle="middleDelts">
      <circle cx="37" cy="50" r="7"/>
      <circle cx="123" cy="50" r="7"/>
    </g>
    <g data-muscle="upperBack">
      <rect x="60" y="60" width="40" height="55" rx="14"/>
    </g>
    <g data-muscle="triceps">
      <rect x="32" y="50" width="16" height="70" rx="8"/>
      <rect x="112" y="50" width="16" height="70" rx="8"/>
    </g>
    <g data-muscle="forearms">
      <rect x="28" y="120" width="16" height="75" rx="8"/>
      <rect x="116" y="120" width="16" height="75" rx="8"/>
    </g>
    <circle cx="36" cy="200" r="9" ${NEUTRAL}/>
    <circle cx="124" cy="200" r="9" ${NEUTRAL}/>
    <g data-muscle="lats">
      <path d="M58,110 L78,110 L70,175 L50,150 Z"/>
      <path d="M102,110 L82,110 L90,175 L110,150 Z"/>
    </g>
    <g data-muscle="lowerBack">
      <rect x="66" y="175" width="28" height="25" rx="8"/>
    </g>
    <g data-muscle="glutes">
      <rect x="58" y="195" width="44" height="35" rx="14"/>
    </g>
    <g data-muscle="hamstrings">
      <rect x="56" y="228" width="20" height="85" rx="10"/>
      <rect x="84" y="228" width="20" height="85" rx="10"/>
    </g>
    <g data-muscle="calves">
      <rect x="57" y="315" width="18" height="70" rx="9"/>
      <rect x="85" y="315" width="18" height="70" rx="9"/>
    </g>
    <ellipse cx="66" cy="392" rx="10" ry="6" ${NEUTRAL}/>
    <ellipse cx="94" cy="392" rx="10" ry="6" ${NEUTRAL}/>
  `;
}

export function renderBodyMaps(frontSvg, backSvg) {
  frontSvg.setAttribute("viewBox", "0 0 160 400");
  backSvg.setAttribute("viewBox", "0 0 160 400");
  frontSvg.innerHTML = frontMarkup();
  backSvg.innerHTML = backMarkup();
}

// muscleTotals: { muscleKey: sets }. Colors each [data-muscle] group by its
// share of the period's max muscle volume (sequential encoding via opacity).
export function applyVolumeColors(frontSvg, backSvg, muscleTotals) {
  const max = Math.max(0, ...Object.values(muscleTotals));
  [frontSvg, backSvg].forEach((svg) => {
    svg.querySelectorAll("[data-muscle]").forEach((g) => {
      const val = muscleTotals[g.dataset.muscle] || 0;
      if (val <= 0 || max === 0) {
        g.setAttribute("class", "bm-region bm-zero");
        g.style.removeProperty("--bm-opacity");
      } else {
        const opacity = 0.28 + 0.72 * (val / max);
        g.setAttribute("class", "bm-region bm-active");
        g.style.setProperty("--bm-opacity", opacity.toFixed(2));
      }
    });
  });
}
