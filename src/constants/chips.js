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
  caution_decorator: [
    ['!', 'Caution'],
    ['!!', 'Double Caution'],
    ['!!!', 'Triple Caution'],
  ],
  direction: [
    ['L', 'Left'],
    ['R', 'Right'],
    ['Keep L', 'Keep Left'],
    ['Keep R', 'Keep Right'],
    ['Keep Mid', 'Keep Middle'],
  ],
  severity: [
    // [value, audible, angle]  angle=null means not shown on compass dial
    // 6 = straightest, 1 = tightest
    ['6', null, 8],
    ['5', null, 20],
    ['4', null, 35],
    ['3', null, 63],
    ['2', null, 85],
    ['1', null, 150],
    ['Hairpin', null, null],
    ['Square', null, null],
    ['Flat', null, null],
  ],
  duration: [
    ['Short', null],
    ['Medium', null],
    ['Long', null],
    ['XL', 'Extra Long'],
  ],
  decorator: [
    ['Over Brow', null],
    ['Over Crest', null],
    ['Over Jump', null],
    ['Cut', null],
    ["Don't", null],
    ['Keep In', null],
    ['Keep Out', null],
    ['Narrows', null],
    ['Widens', null],
    ['Slippy', null],
    ['Splash', null],
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
    ['70', null],
    ['100', null],
    ['150', null],
    ['200', null],
  ],
  joiner_decorator: [
    ['Narrows', null],
    ['Widens', null],
    ['Slippy', null],
    ['Splash', null],
    ['Bumps', null],
    ['↑', 'Up'],
    ['↓', 'Down'],
    ['Maybe', null],
  ],
};
