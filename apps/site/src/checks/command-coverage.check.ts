/**
 * Checks that the command palette can reach every setting.
 *
 * Run from `apps/site`:
 *   node --experimental-strip-types src/checks/command-coverage.check.ts
 *
 * The settings grid and the palette are built from the same declarative array,
 * and `assertCommandCoverage` reports any preference key no command controls.
 * A new setting therefore cannot ship without a command.
 */

import { DEFAULT_PREFERENCES, PREFERENCE_KEYS } from "@material-tax-reporting/surface-kernel";
import { SETTING_DESCRIPTORS, buildCommandRegistry, uncoveredPreferenceKeys } from "../../app/data/commands.ts";

const registry = buildCommandRegistry({
  preferences: DEFAULT_PREFERENCES,
  documentation: [],
  changelogAreas: [],
  appearanceElements: [],
});

const failures: string[] = [];

const uncovered = uncoveredPreferenceKeys(registry);
if (uncovered.length > 0) {
  failures.push(`These preference keys have no command: ${uncovered.join(", ")}.`);
}

const describedKeys = new Set(SETTING_DESCRIPTORS.map((descriptor) => descriptor.preferenceKey));
for (const key of PREFERENCE_KEYS) {
  if (!describedKeys.has(key)) failures.push(`The preference key "${key}" has no settings descriptor.`);
}

const targets = new Set<string>();
for (const command of registry.list()) {
  if (targets.has(command.target) && command.kind === "control") {
    failures.push(`Two control commands teleport to the same element "${command.target}".`);
  }
  targets.add(command.target);
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `PASS command-coverage: ${registry.list().length} commands cover all ${PREFERENCE_KEYS.length} preference keys.`,
  );
}
