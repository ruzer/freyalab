import { launch, close, DATA } from './lib.mjs'
import { join } from 'node:path'
const log = (...x) => console.log(...x)
const audit = () => page => page.evaluate(() => {
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 } }
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b) }
  const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 })
  const bgOf = el => { const stack = []; let p = el; while (p) { const c = parse(getComputedStyle(p).backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break } p = p.parentElement } let base = { r: 255, g: 255, b: 255, a: 1 }; if (!stack.length || stack[stack.length - 1].a < 1) { const rootBg = parse(getComputedStyle(document.documentElement).backgroundColor); base = rootBg && rootBg.a > 0 ? rootBg : (document.documentElement.classList.contains('dark') ? { r: 24, g: 24, b: 28, a: 1 } : base) } let out = stack.length && stack[stack.length - 1].a >= 1 ? stack.pop() : base; while (stack.length) out = blend(stack.pop(), out); return out }
  const res = []; let minFont = 99; const small = {}
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let n; while ((n = walker.nextNode())) {
    const t = n.textContent.trim(); if (!t) continue; const el = n.parentElement; if (!el || !el.offsetParent && getComputedStyle(el).position !== 'fixed') continue
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.opacity === '0') continue
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight) continue
    const fg0 = parse(cs.color); if (!fg0) continue; const bg = bgOf(el); const fg = blend({ ...fg0, a: fg0.a * (+cs.opacity) }, bg)
    const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05)
    const fs = parseFloat(cs.fontSize); const bold = +cs.fontWeight >= 700; const large = fs >= 24 || (fs >= 18.66 && bold)
    minFont = Math.min(minFont, fs); small[Math.round(fs)] = (small[Math.round(fs)] || 0) + 1
    const need = large ? 3 : 4.5; const disabled = el.closest('button:disabled, input:disabled, select:disabled, [aria-disabled=true]')
    if (ratio < need) res.push({ t: t.slice(0, 40), ratio: +ratio.toFixed(2), fs, sel: el.tagName.toLowerCase() + '.' + (el.className + '').split(' ')[0], disabled: !!disabled })
  }
  const targets = [...document.querySelectorAll('button, input[type=checkbox], select, [role=tab], [role=gridcell]')].filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, l: (e.getAttribute('aria-label') || e.innerText || e.title || '').trim().slice(0, 30) } }).filter(t => (t.w < 24 || t.h < 24) && t.w > 0)
  return { failing: res.filter(r => !r.disabled), failingDisabled: res.filter(r => r.disabled).length, minFont, fontHistogram: small, smallTargets: targets.slice(0, 12), smallTargetsCount: targets.length }
})
let page, a
for (const theme of ['light', 'dark']) {
  a = await launch({ open: [join(DATA, 'ventas.csv')], size: [1440, 900], theme }); page = a.page
  await page.waitForSelector('[role=grid] [role=gridcell]')
  const r1 = await audit()(page)
  log(`\n== ${theme} CSV: failing non-disabled text nodes: ${r1.failing.length}; disabled-failing: ${r1.failingDisabled}; minFont=${r1.minFont}; font sizes:`, JSON.stringify(r1.fontHistogram))
  const uniq = {}; for (const f of r1.failing) uniq[f.t + '|' + f.ratio] = f; log(Object.values(uniq).slice(0, 12).map(f => `   ${f.ratio}:1 ${f.fs}px "${f.t}" <${f.sel}>`).join('\n'))
  log(' small targets (<24px):', r1.smallTargetsCount, JSON.stringify(r1.smallTargets.slice(0, 8)))
  await page.getByRole('button', { name: 'Gráficos' }).click(); await page.waitForTimeout(500)
  const r2 = await audit()(page)
  log(` ${theme} charts panel: failing=${r2.failing.length}`); const u2 = {}; for (const f of r2.failing) u2[f.t + '|' + f.ratio] = f; log(Object.values(u2).slice(0, 8).map(f => `   ${f.ratio}:1 ${f.fs}px "${f.t}" <${f.sel}>`).join('\n'))
  await close(a)
}
