/**
 * @module types
 * Shared JSDoc typedefs for the GRIP codebase.
 * No runtime code — import this file for VS Code intellisense only.
 */

/**
 * A rally event (top-level container for stages).
 * @typedef {Object} Rally
 * @property {string}  id
 * @property {string}  name
 * @property {string}  date           — ISO date string (YYYY-MM-DD)
 * @property {string|null} driver
 * @property {DisplayOrder} display_order
 * @property {OdoUnit} odo_unit
 * @property {number}  straight_angle — dead-zone angle (degrees) below which direction is null
 * @property {string}  created_at
 * @property {string}  updated_at
 */

/**
 * A stage within a rally.
 * @typedef {Object} Stage
 * @property {string} id
 * @property {string} rally_id
 * @property {string} name
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * A versioned set of pace notes for a stage.
 * @typedef {Object} NoteSet
 * @property {string}  set_id
 * @property {string}  stage_id
 * @property {number}  version      — auto-incremented per stage
 * @property {string|null} recce_date — ISO date string
 * @property {number}  is_active    — 1 = active, 0 = archived
 * @property {string|null} driver
 * @property {string}  created_at
 * @property {string}  updated_at
 */

/**
 * A single pace note within a note set.
 * @typedef {Object} PaceNote
 * @property {string}      set_id
 * @property {number}      seq              — sequence position (1-based)
 * @property {number|null} index_odo        — odometer reading in metres
 * @property {string|null} index_landmark
 * @property {number|null} index_sequence
 * @property {string|null} direction        — e.g. 'L', 'R', 'Keep L'
 * @property {string|null} severity         — e.g. '1'–'9', 'Hairpin', 'Square', 'Flat'
 * @property {string|null} duration         — e.g. 'Short', 'Long', 'XL'
 * @property {string[]|string|null} decorators       — JSON string in DB, array after parseNote()
 * @property {string|null} joiner           — e.g. '→', '+', '100'
 * @property {string[]|string|null} joiner_decorators — JSON string in DB, array after parseNote()
 * @property {string|null} notes            — freetext
 * @property {string|null} joiner_notes     — freetext attached to joiner
 * @property {string|null} recce_at
 * @property {string}      updated_at
 */

/**
 * A configurable chip (tappable selection element) for a rally.
 * Stored in rally_chips table; used in Writing/Reading/Drive UIs.
 * @typedef {Object} RallyChip
 * @property {number}      id
 * @property {string}      rally_id
 * @property {ChipCategory} category
 * @property {string}      value       — display label (e.g. 'L', '3', 'Short')
 * @property {string|null} audible     — TTS override (e.g. 'Left' for 'L'); null = same as value
 * @property {number}      sort_order
 * @property {number|null} angle       — severity chips only: tilt angle in degrees for Drive mode
 */

/**
 * Chip category identifier.
 * @typedef {'direction'|'severity'|'duration'|'caution_decorator'|'decorator'|'joiner'|'joiner_decorator'} ChipCategory
 */

/**
 * Note display order preference.
 * @typedef {'direction_first'|'severity_first'} DisplayOrder
 */

/**
 * Odometer display unit.
 * @typedef {'metres'|'km'} OdoUnit
 */

/**
 * Audible map for TTS — maps chip value to spoken text.
 * Only includes entries where audible differs from value.
 * @typedef {Object<string, string>} AudibleMap
 */

/**
 * Angle map for Drive mode — maps severity chip value to tilt angle in degrees.
 * @typedef {Object<string, number>} AngleMap
 */
