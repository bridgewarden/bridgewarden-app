import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export const expectNoSeriousA11yViolations = async (page: Page, surface: string) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
    .analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );

  expect(
    serious.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.map((node) => ({
        target: node.target,
        summary: node.failureSummary,
      })),
    })),
    `${surface} has critical or serious accessibility violations`,
  ).toEqual([]);
};
