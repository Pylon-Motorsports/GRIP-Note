/**
 * @module chips
 * Default chip seed data for new rallies.
 * Used by {@link module:rallyChips~seedDefaultChips} to populate the rally_chips table.
 * Runtime chip lists come from the DB — these are only used on initial rally creation.
 */

/**
 * Default chips seeded into each new rally, keyed by {@link import('../types').ChipCategory}.
 *
 * Entry format per category:
 * - Most categories: `[value, audible | null]` — audible is the TTS override
 * - Severity: `[value, audible, angle | null]` — angle is the compass dial position in degrees
 *
 * @type {Object<import('../types').ChipCategory, Array<[string, string|null]|[string, string|null, number|null]>>}
 */
export const DEFAULT_CHIP_SEEDS = {
  direction: [
    ['L', 'Left'],
    ['R', 'Right'],
    ['Keep L', 'Keep Left'],
    ['Keep R', 'Keep Right'],
    ['Keep Mid', 'Keep Middle'],
  ],
  severity: [
    // [value, audible, angle]  angle=null means not shown on compass dial
    // 9 = straightest, 1 = tightest
    ['9', null, 5],
    ['8', null, 10],
    ['7', null, 20],
    ['6', null, 30],
    ['5', null, 40],
    ['4', null, 50],
    ['3', null, 60],
    ['2', null, 70],
    ['1', null, 80],
    ['Hairpin', null, null],
    ['Square', null, null],
    ['Flat', null, null],
  ],
  duration: [
    ['Short', null],
    ['Medium', null],
    ['Long', null],
    ['XL', 'Extra Long'],
    ['XXL', 'Extra Extra Long'],
  ],
  caution_decorator: [
    ['!', 'Caution'],
    ['!!', 'Double Caution'],
    ['!!!', 'Triple Caution'],
    ['Care', null],
  ],
  decorator: [
    ['Brow', null],
    ['Opens', null],
    ['Over Crest', null],
    ['Jump', null],
    ['Cut', null],
    ["Don't", null],
    ['Keep In', null],
    ['Keep Out', null],
    ['Narrows', null],
    ['Widens', null],
    ['Slippy', null],
    ['Bumps', null],
    ['↑', 'Up'],
    ['↓', 'Down'],
    ['Maybe', null],
  ],
  joiner: [
    ['→', 'Into'],
    ['+', 'And'],
    ['>', 'Tightens'],
    ['<', 'Opens'],
    ['Over', null],
    ['10', null],
    ['20', null],
    ['30', null],
    ['50', null],
    ['100', null],
    ['150', null],
    ['200', null],
  ],
  joiner_decorator: [
    ['!', 'Caution'],
    ['!!', 'Double Caution'],
    ['!!!', 'Triple Caution'],
    ['Care', null],
    ['Brow', null],
    ['Opens', null],
    ['Over Crest', null],
    ['Narrows', null],
    ['Widens', null],
    ['Slippy', null],
    ['Bumps', null],
    ['↑', 'Up'],
    ['↓', 'Down'],
    ['Keep L', 'Keep Left'],
    ['Keep R', 'Keep Right'],
    ['Maybe', null],
  ],
};
