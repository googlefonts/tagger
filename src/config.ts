// Build-time switch for script tagging.
//
// The plain build at /tagger/ reads and writes tags/all/families.csv and
// hides the script selectors. The scripts build at /tagger/scripts/ reads
// and writes tags/all/families-scripts.csv, which carries a fifth column
// with the scripts a tagging applies to. Set VITE_SCRIPTS=1 to get the
// scripts build.
export const SCRIPT_TAGGING = import.meta.env.VITE_SCRIPTS === "1";
export const TAGS_CSV_PATH = SCRIPT_TAGGING
  ? "tags/all/families-scripts.csv"
  : "tags/all/families.csv";

// The tag lint rules in public/tag_rules.csv no longer parse, so they are
// off until they are fixed. Set to true to load them and show the
// Warnings section in the font view again.
export const LINT_RULES = false;
