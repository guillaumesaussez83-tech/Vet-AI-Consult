import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Chantier 6 — a11y automatisé
// Tag @a11y : permet de lancer uniquement ces specs via `pnpm test:a11y`
// (voir package.json script ajouté par le kit-final).
//
// Stratégie de rollout :
//   1. `expect.soft` — visibilité sans bloquer la CI
//   2. Corriger violation par violation
//   3. Passer à `expect(...).toEqual([])` strict quand clean

const pages = [
  { name: '@a11y landing', path: '/' },
  { name: '@a11y login',   path: '/sign-in' },
  { name: '@a11y app',     path: '/app' },
]

for (const p of pages) {
  test(p.name, async ({ page }) => {
    await page.goto(p.path)
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules([
        // Faux positifs connus (à documenter au cas par cas si activés)
        // 'color-contrast',
      ])
      .analyze()

    if (results.violations.length > 0) {
      console.log('\n=== Violations a11y ===\n')
      for (const v of results.violations) {
        console.log(`[${v.impact}] ${v.id} — ${v.help}`)
        console.log(`  ${v.helpUrl}`)
        v.nodes.forEach((n) => console.log(`  → ${n.target.join(' ')}`))
      }
    }

    expect.soft(results.violations, `A11y violations on ${p.path}`).toEqual([])
  })
}
