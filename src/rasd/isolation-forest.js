// @ts-nocheck
/**
 * Isolation Forest (Liu, Ting, Zhou 2008) — نموذج شذوذ متعدد المتغيرات يعمل محليًا بلا مكتبات ولا خدمة خارجية.
 *
 * الفكرة: الحالات الشاذة قليلة ومختلفة، فتُعزل بعدد أقل من الانقسامات العشوائية في أشجار عشوائية.
 * درجة الشذوذ s = 2^(-E[h(x)] / c(ψ)) حيث E[h] متوسط طول المسار عبر الأشجار و c(ψ) متوسط طول المسار لعينة بحجم ψ.
 * قرابة 0.5 = عادي، وكلما اقتربت من 1 زاد الشذوذ.
 *
 * حتمي: البذرة ثابتة افتراضيًا، فتعطي البيانات نفسها النتائج نفسها في كل تشغيل (شرط لازم لتقرير تدقيق قابل للمراجعة).
 */

/** مولّد أعداد شبه عشوائية حتمي (mulberry32). */
export function makeRng(seed = 20260101) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EULER = 0.5772156649015329;
/** متوسط طول المسار في شجرة بحث ثنائية غير ناجحة لـ n عنصرًا. */
export function avgPathLength(n) {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  return 2 * (Math.log(n - 1) + EULER) - (2 * (n - 1)) / n;
}

function sampleIndices(n, size, rng) {
  if (size >= n) return Array.from({ length: n }, (_, i) => i);
  // اختيار بلا إعادة (Fisher–Yates جزئي)
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = 0; i < size; i++) {
    const j = i + Math.floor(rng() * (n - i));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, size);
}

function buildTree(X, rows, depth, maxDepth, rng) {
  const n = rows.length;
  if (depth >= maxDepth || n <= 1) return { size: n };
  const d = X[rows[0]].length;
  // نختار سمة لها مدى فعلي؛ نجرّب عددًا محدودًا من المحاولات
  for (let attempt = 0; attempt < d * 2; attempt++) {
    const f = Math.floor(rng() * d);
    let lo = Infinity;
    let hi = -Infinity;
    for (const r of rows) {
      const v = X[r][f];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    if (!(hi > lo)) continue;
    const cut = lo + rng() * (hi - lo);
    const left = [];
    const right = [];
    for (const r of rows) (X[r][f] < cut ? left : right).push(r);
    if (!left.length || !right.length) continue;
    return {
      f,
      cut,
      l: buildTree(X, left, depth + 1, maxDepth, rng),
      r: buildTree(X, right, depth + 1, maxDepth, rng),
    };
  }
  return { size: n };
}

function pathLength(node, x, depth = 0, used = null) {
  while (node.l) {
    if (used) used.push(node.f);
    node = x[node.f] < node.cut ? node.l : node.r;
    depth++;
  }
  return depth + avgPathLength(node.size);
}

/**
 * يدرّب الغابة على مصفوفة X (صفوف × سمات، أرقام فقط).
 * options: { trees = 100, sampleSize = 256, seed }
 */
export function fitIsolationForest(X, { trees = 100, sampleSize = 256, seed = 20260101 } = {}) {
  const n = X.length;
  if (n < 2) return { trees: [], psi: n, n, c: 1 };
  const rng = makeRng(seed);
  const psi = Math.min(sampleSize, n);
  const maxDepth = Math.ceil(Math.log2(Math.max(psi, 2)));
  const forest = [];
  for (let t = 0; t < trees; t++) forest.push(buildTree(X, sampleIndices(n, psi, rng), 0, maxDepth, rng));
  return { trees: forest, psi, n, c: avgPathLength(psi) || 1 };
}

/** درجة الشذوذ (0..1) لكل صف، وعند `explain` أيضًا السمات الأكثر استعمالًا في عزل الصف. */
export function scoreIsolationForest(model, X, { explain = false } = {}) {
  return X.map((x) => {
    if (!model.trees.length) return explain ? { score: 0.5, used: [] } : 0.5;
    let total = 0;
    const used = explain ? [] : null;
    for (const t of model.trees) total += pathLength(t, x, 0, used);
    const score = 2 ** (-(total / model.trees.length) / model.c);
    return explain ? { score, used } : score;
  });
}

/* ------------------------------ أدوات إحصائية مساعدة ------------------------------ */

export const median = (a) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** مقياس متين لكل عمود: الوسيط و MAD (وبديل IQR ثم الانحراف المعياري إن كان MAD صفرًا). */
export function robustColumnStats(X) {
  const d = X[0]?.length ?? 0;
  const out = [];
  for (let j = 0; j < d; j++) {
    const col = X.map((r) => r[j]);
    const med = median(col);
    let scale = median(col.map((v) => Math.abs(v - med))) / 0.6745;
    if (!(scale > 1e-12)) {
      const s = [...col].sort((a, b) => a - b);
      const q = (p) => s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))];
      scale = (q(0.75) - q(0.25)) / 1.349;
    }
    if (!(scale > 1e-12)) {
      const mean = col.reduce((a, b) => a + b, 0) / col.length;
      scale = Math.sqrt(col.reduce((a, b) => a + (b - mean) ** 2, 0) / col.length);
    }
    out.push({ median: med, scale: scale > 1e-12 ? scale : 0 });
  }
  return out;
}

/** z متين لقيمة في عمود (0 إن لم يكن للعمود تباين). */
export const robustZ = (v, st) => (st.scale > 0 ? (v - st.median) / st.scale : 0);
