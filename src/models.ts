import { linter } from "./linter";
import type { LintRule, Severity } from "./linter.js";
import { loadText, parseCSV } from "./utils";
import { SCRIPT_TAGGING, TAGS_CSV_PATH } from "./config";

export type Axis = {
  tag: string; // Axis tag, e.g. 'wght'
  min: number; // Minimum value for the axis
  max: number; // Maximum value for the axis
  displayValue?: number; // Current value for the axis, optional
};

export type Location = Record<string, number>; // {"wght": 400, "wdth": 100} for example

export class Tag {
  name: string;
  description: string;
  superShortDescription: string;
  related: string[]; // Array of related tag names
  lowestScore: number; // Lowest score for the tag, optional
  highestScore: number; // Highest score for the tag, optional
  _exemplars?: Exemplars; // Optional exemplars, not used in constructor

  constructor(
    name: string,
    description: string,
    superShortDescription: string,
    related: string[],
    lowestScore: number,
    highestScore: number
  ) {
    this.name = name;
    this.description = description;
    this.superShortDescription = superShortDescription;
    this.related = related;
    this.lowestScore = lowestScore;
    this.highestScore = highestScore;
  }
  get friendlyName() {
    const [_, area, category] = this.name.split("/");
    if (area == "Sans" || area == "Serif" || area == "Script") {
      return `${category} ${area.toLowerCase()}`;
    }
    if (area == "Theme" || area == "Expressive" || area == "Purpose") {
      return category.toLowerCase();
    }
    if (area == "Quality") {
      return `High-Quality ${category.toLowerCase()}`;
    }
    if (area == "Seasonal" || area == "Special use") {
      return `${category} (${area.toLowerCase()})`;
    }

    return this.name;
  }
  exemplars(gf: GF): Exemplars {
    if (this._exemplars) {
      return this._exemplars; // Return cached exemplars if available
    }
    const exemplars: Exemplars = {
      high: [],
      low: [],
      medium: [],
    };
    for (const tagging of gf.allTaggings) {
      if (tagging.tag.name !== this.name) {
        continue;
      }
      // Only consider static tags for now
      if ("scores" in tagging) {
        // Variable tagging, we can skip it for now
        continue;
      }
      if (!tagging.score) {
        continue;
      }
      if (tagging.score > 80) {
        exemplars.high.push(tagging);
      } else if (tagging.score <= 20) {
        exemplars.low.push(tagging);
      } else if (
        tagging.score > 33 &&
        tagging.score < 66 &&
        exemplars.medium.length < 3
      ) {
        exemplars.medium.push(tagging);
      }
    }
    // Choose top three high
    // @ts-ignore // We know scores are not null here, we filtered them out
    exemplars.high.sort((a, b) => b.score - a.score);
    exemplars.high = exemplars.high.slice(0, 3);
    // Choose lowest three low
    // @ts-ignore
    exemplars.low.sort((a, b) => a.score - b.score);
    exemplars.low = exemplars.low.slice(0, 3);
    console.log(`Exemplars for ${this.name}:`, exemplars);
    // Cache the exemplars
    this._exemplars = exemplars;
    return exemplars;
  }
}

// Scripts are stored in the CSV as a |-delimited list, e.g. "latin|cyrillic".
// The column only exists in the scripts build; the plain build keeps the
// four-column format of families.csv.
export function scriptsToCSV(scripts: string[]): string {
  return [...scripts].sort().join("|");
}
function scriptsColumn(scripts: string[]): string {
  return SCRIPT_TAGGING ? `,${scriptsToCSV(scripts)}` : "";
}
export function scriptsFromCSV(field: string | undefined): string[] {
  if (!field) return [];
  return field.split("|").map((s) => s.trim()).filter((s) => s !== "");
}

// Split one CSV line into fields, respecting quoted values such as
// "wdth,wght@75,400"
export function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      const end = line.indexOf('"', i + 1);
      if (end === -1) { fields.push(line.slice(i + 1)); break; }
      fields.push(line.slice(i + 1, end));
      i = end + 2; // skip closing quote and comma
    } else {
      const end = line.indexOf(',', i);
      if (end === -1) { fields.push(line.slice(i)); break; }
      fields.push(line.slice(i, end));
      i = end + 1;
    }
  }
  return fields;
}

// What identifies a tagging in the CSV: its family, tag and scripts. The
// keys sort the same way the file is sorted, by family then tag.
export function taggingKey(family: string, tag: string, scripts: string[]): string {
  return `${family},${tag},${scriptsToCSV(scripts)}`;
}

// The lines of a tags CSV grouped by tagging, in file order. A variable
// tagging has one line per location.
export function groupCSVRows(csvText: string): Map<string, string[]> {
  const rows = new Map<string, string[]>();
  for (const rawLine of csvText.split("\n")) {
    const line = rawLine.trimEnd();
    if (line === "") continue;
    const [family, , tag, , scriptStr] = parseCSVLine(line);
    if (!family || !tag) continue;
    const key = taggingKey(family, tag, scriptsFromCSV(scriptStr));
    const lines = rows.get(key);
    if (lines) lines.push(line);
    else rows.set(key, [line]);
  }
  return rows;
}

// An association between a tag and a font which applies to all parts of the designspace
export class StaticTagging {
  // The font family this tagging applies to.
  // This may seem superfluous, but sometimes it's useful to pass a list of tag objects
  // and know which family they belong to.
  font: Font;
  tag: Tag;
  score: number | null;
  scripts: string[]; // Subsets this tagging applies to; empty means all
  placeholder: boolean;
  touched: boolean; // Edited in this session; shown in every panel that lists it
  constructor(font: Font, tag: Tag, score: number | null, scripts: string[] = []) {
    this.font = font;
    this.tag = tag;
    this.score = score;
    this.scripts = scripts;
    this.placeholder = false;
    this.touched = false;
  }
  toCSV(): string {
    if (this.score === null) {
      return "";
    }
    return `${this.font.name},,${this.tag.name},${this.score}${scriptsColumn(this.scripts)}\n`;
  }
}

// A tagging which has different scores for different locations in the designspace
export class VariableTagging {
  font: Font; // Optional, can be undefined if not applicable
  tag: Tag;
  scores: { location: Location; score: number }[];
  scripts: string[]; // Subsets this tagging applies to; empty means all
  placeholder: boolean;
  touched: boolean; // Edited in this session; shown in every panel that lists it
  // The static score this tagging was variated from in this session, so
  // "To static" can restore it. Null when it was variable from the start.
  staticScore: number | null;

  constructor(
    font: Font,
    tag: Tag,
    scores: { location: Location; score: number }[],
    scripts: string[] = []
  ) {
    this.font = font;
    this.tag = tag;
    this.scores = scores;
    this.scripts = scripts;
    this.placeholder = false;
    this.touched = false;
    this.staticScore = null;
  }
  // Get the score for a specific location
  scoreAt(location: Location): number | undefined {
    const scoreEntry = this.scores.find((s) => {
      // ({"wght": 400}) != ({"wght": 400}) because it's not the same object
      // EVEN THOUGH WE DID NOT ASK FOR STRICT EQUALITY WITH !==
      // JAVASCRIPT WHAT IS WRONG WITH YOU
      return JSON.stringify(s.location) == JSON.stringify(location);
    });
    return scoreEntry ? scoreEntry.score : undefined;
  }
  // Just get a score, I don't care
  get score(): number {
    console.warn(
      `Using VariableTagging.score for tag ${this.tag.name}, this is not recommended. Use scoreAt(location) instead.`
    );
    if (this.scores.length === 0) {
      return 0; // No scores available
    }
    // Return the average score for simplicity
    const totalScore = this.scores.reduce((sum, s) => sum + s.score, 0);
    return totalScore / this.scores.length;
  }

  toCSV(): string {
    let csv = "";
    for (let scoreEntry of this.scores) {
      const sortedKeys = Object.keys(scoreEntry.location).sort();
      let gfStyleLocation =
        sortedKeys.join(",") +
        "@" +
        sortedKeys.map(k => scoreEntry.location[k]).join(",");
      let quotedLocation = gfStyleLocation.includes(",") ? `"${gfStyleLocation}"` : gfStyleLocation;
      csv += `${this.font.name},${quotedLocation},${this.tag.name},${scoreEntry.score}${scriptsColumn(this.scripts)}\n`;
    }
    return csv;
  }
}
export type Tagging = StaticTagging | VariableTagging;

// Turn a static tagging into a variable one over the family's grid axes,
// every corner at the static score. Returns null when the family has no
// grid axes or the tagging has no score. The new tagging takes the old
// one's place in the family.
export function variateTagging(tagging: StaticTagging): VariableTagging | null {
  const font = tagging.font;
  const axes = font.gridAxes();
  if (axes.length === 0 || tagging.score === null) return null;
  const score = tagging.score;
  const scores = font.cornerLocations(axes).map((location) => ({ location, score }));
  const variable = new VariableTagging(font, tagging.tag, scores, [...tagging.scripts]);
  variable.placeholder = tagging.placeholder;
  variable.touched = true;
  variable.staticScore = score;
  font.replaceTagging(tagging, variable);
  return variable;
}

// The score a variable tagging gets when it goes back to static: the score
// it was variated from in this session, else its highest score.
export function staticScoreFor(tagging: VariableTagging): number {
  if (tagging.staticScore !== null) return tagging.staticScore;
  if (tagging.scores.length === 0) return 0;
  return Math.max(...tagging.scores.map((s) => s.score));
}

// Turn a variable tagging back into a static one. The new tagging takes the
// old one's place in the family.
export function staticizeTagging(tagging: VariableTagging): StaticTagging {
  const stat = new StaticTagging(tagging.font, tagging.tag, staticScoreFor(tagging), [...tagging.scripts]);
  stat.placeholder = tagging.placeholder;
  stat.touched = true;
  tagging.font.replaceTagging(tagging, stat);
  return stat;
}

export type Exemplars = {
  // For now we keep these static
  high: StaticTagging[];
  low: StaticTagging[];
  medium: StaticTagging[];
};

export class Font {
  name: string;
  axes: Axis[]; // Array of axis objects
  subsets: string[]; // Scripts the font supports, from the family metadata
  taggings: Tagging[]; // Array to hold taggings

  constructor(name: string, axes: Axis[], taggings: Tagging[] = [], subsets: string[] = []) {
    this.name = name;
    this.axes = axes;
    this.taggings = taggings;
    this.subsets = subsets;
  }

  get isVF() {
    return this.axes.length > 0;
  }

  axis(tag: string): Axis | undefined {
    return this.axes.find((axis) => axis.tag === tag);
  }

  // The axes variable tags are scored on: wght, plus wdth when present.
  gridAxes(): string[] {
    if (!this.axis("wght")) return [];
    return this.axis("wdth") ? ["wght", "wdth"] : ["wght"];
  }

  // One location per corner of the grid, each axis at its min and max.
  cornerLocations(axes: string[] = this.gridAxes()): Location[] {
    let locations: Location[] = [{}];
    for (const axisName of axes) {
      const axis = this.axis(axisName);
      if (!axis) continue;
      const next: Location[] = [];
      for (const location of locations) {
        next.push({ ...location, [axisName]: axis.min });
        next.push({ ...location, [axisName]: axis.max });
      }
      locations = next;
    }
    return locations;
  }

  cssStyle(fontSize = 32) {
    if (!this.isVF) {
      return `font-family: '${this.name}'; font-size: ${fontSize}pt;`;
    }
    let res = `font-family: '${this.name}'; font-size: ${fontSize}pt; font-variation-settings:`;
    this.axes.forEach((axis) => {
      res += ` '${axis.tag}' ${axis.min}..${axis.max},`;
    });
    return res.slice(0, -1) + ";"; // Remove trailing comma and add semicolon
  }

  hasTagging(tagName: string): boolean {
    return this.taggings.some((tagging) => {
      return tagging.tag.name === tagName;
    });
  }

  // A font can carry the same tag more than once when the taggings apply to
  // different scripts, e.g. /Expressive/Calm for latin and again for arabic.
  hasTaggingForScripts(tagName: string, scripts: string[]): boolean {
    const key = scriptsToCSV(scripts);
    return this.taggings.some((tagging) => {
      return tagging.tag.name === tagName && scriptsToCSV(tagging.scripts) === key;
    });
  }

  addTagging(tagging: Tagging) {
    if (this.hasTaggingForScripts(tagging.tag.name, tagging.scripts)) {
      console.warn(
        `Tagging for tag ${tagging.tag.name} already exists in family ${this.name}.`
      );
      return;
    }
    this.taggings.push(tagging);
  }

  removeTagging(tagging: Tagging) {
    this.taggings = this.taggings.filter((t) => t !== tagging);
  }

  // Swap one tagging for another in place, so it keeps its position in lists.
  replaceTagging(oldTagging: Tagging, newTagging: Tagging) {
    const idx = this.taggings.indexOf(oldTagging);
    if (idx === -1) {
      this.taggings.push(newTagging);
    } else {
      this.taggings.splice(idx, 1, newTagging);
    }
  }

  get url() {
    let path = `https://fonts.googleapis.com/css2?family=${this.name.replace(
      / /g,
      "+"
    )}`;
    // GF api wants the axes in sorted alphabetical order. However, axes with
    // caps are last
    const sortedUpperCaseAxes = [];
    const sortedLowerCaseAxes = [];
    for (let a of this.axes) {
      if (a.tag.toUpperCase() === a.tag) {
        sortedUpperCaseAxes.push(a);
      } else {
        sortedLowerCaseAxes.push(a);
      }
    }
    sortedLowerCaseAxes.sort((a, b) => a.tag.localeCompare(b.tag));
    sortedUpperCaseAxes.sort((a, b) => a.tag.localeCompare(b.tag));
    const sortedAxes = [...sortedLowerCaseAxes, ...sortedUpperCaseAxes];
    if (this.axes.length > 0) {
      path +=
        ":" +
        sortedAxes
          .map((a) => {
            return a.tag;
          })
          .join(",");
      path += "@";
      path += sortedAxes
        .map((axis) => {
          return `${Number(axis.min)}..${Number(axis.max)}`;
        })
        .join(",");
    }
    return path;
  }
}

export class GF {
  familyData: { [key: string]: any }; // Object to hold family metadata
  families: Font[]; // Array to hold Font objects
  loadedFamilies: Font[]; // We add families to the CSS on demand to speed up loading
  tags: { [key: string]: Tag }; // Object to hold tag definitions
  lintRules: LintRule[]; // Array to hold lint rules
  linter: any; // Linter instance
  commit: string; // Git commit hash or branch name in google/fonts for tag data
  prNumber: number | null; // PR number if loaded from a PR URL
  // Every tagging as it was loaded, keyed by taggingKey, as CSV text. Save
  // changes compares against this to find what this session changed.
  baselineRows: Map<string, string>;

  constructor() {
    this.familyData = {};
    this.families = [];
    this.tags = {};
    this.lintRules = [];
    this.linter = linter;
    this.loadedFamilies = [];
    this.commit = "refs/heads/main";
    this.prNumber = null;
    this.baselineRows = new Map();
  }
  async getFamilyData() {
    let data = await loadText("family_data.json");
    let parsedData: any = JSON.parse(data);
    let familyMeta = parsedData["familyMetadataList"];
    let styleEmbeddingsData = await loadText("embeddings.json");
    let styleEmbeddings = JSON.parse(styleEmbeddingsData);
    familyMeta.forEach((family: any) => {
      this.familyData[family.family] = family;
      if (family.family in styleEmbeddings) {
        this.familyData[family.family].style = styleEmbeddings[family.family];
      }
    });
  }
  async getLintRules() {
    let data = await loadText("tag_rules.csv");
    let csvData = parseCSV(data, "rule", "severity", "description");

    for (let item of csvData) {
      if (!item.rule || !item.severity || !item.description) {
        continue;
      }
      this.lintRules.push({
        rule: item.rule.trim(),
        description: item.description.trim(),
        severity: item.severity.trim() as Severity,
      });
    }
  }
  async getTagDefinitions() {
    let data = await loadText("tag_definitions.json");
    this.tags = JSON.parse(data);

    let tagScoreData = await loadText("tags_metadata.csv");
    let csvData = parseCSV(
      tagScoreData,
      "name",
      "lowScore",
      "highScore",
      "description"
    );

    for (let category of csvData) {
      const tagDef = this.tags[category.name];
      // TODO all categories should be listed in the .json file
      if (!category.name || !this.tags[category.name]) {
        this.tags[category.name] = new Tag(
          category.name.trim(),
          "",
          "",
          [],
          0,
          100
        );
      } else {
        this.tags[category.name] = new Tag(
          category.name.trim(),
          tagDef.description || "",
          tagDef.superShortDescription || "",
          tagDef.related || [],
          Number(category.lowScore),
          Number(category.highScore)
        );
      }
    }
  }
  get sortedTagNames(): string[] {
    return Object.keys(this.tags).sort((a, b) => {
      return a.localeCompare(b);
    });
  }
  get allTaggings(): Tagging[] {
    let taggings: Tagging[] = [];
    for (let family of this.families) {
      taggings.push(...family.taggings);
    }
    return taggings;
  }
  loadFamilies() {
    for (let familyName in this.familyData) {
      const axes = [];
      for (let axis of this.familyData[familyName].axes) {
        axes.push({
          tag: axis.tag,
          min: axis.min,
          max: axis.max,
          displayValue: axis.defaultValue, // Default to midpoint
        });
      }
      // "menu" is a subset for the GF website menu, not a script, and the
      // "-ext" subsets are extensions of a script already in the list
      const subsets: string[] = (this.familyData[familyName].subsets || []).filter(
        (s: string) => s !== "menu" && !s.endsWith("-ext")
      );
      const family = new Font(familyName, axes, [], subsets);
      this.families.push(family);
    }
  }
  family(name: string) {
    return this.families.find((family) => family.name === name);
  }
  similarFamilies(name: string, count = 10): string[] {
    const family = this.familyData[name];
    if (!family || !family.style) {
      console.warn(`Family not found (in similar): ${name}`);
      return [];
    }
    let distances: [string, number][] = Object.values(this.familyData)
      .filter(
        (f) => f.style // New fonts may not have style embeddings
      )
      .map((f) => {
        // Compute norm between the style embeddings
        let distance = family.style
          .map((value: number, index: number) => {
            return (value - (f.style[index] || 0)) ** 2;
          })
          .reduce((a: number, b: number) => a + b, 0);
        return [f.family, Math.sqrt(distance)];
      });
    distances.sort((a, b) => a[1] - b[1]);
    return distances
      .slice(0, count)
      .map((item) => item[0])
      .filter((familyName) => familyName !== name);
  }
  ensureLoaded(family: string) {
    // We could use a Set for this but Vue can't diff them
    let font = this.families.find((f) => f.name === family);
    if (font && !this.loadedFamilies.includes(font)) {
      this.loadedFamilies.push(font);
    }
  }

  uniqueTagNames(): string[] {
    return Object.keys(this.tags).sort();
  }

  clearTaggings() {
    for (const family of this.families) {
      family.taggings = [];
    }
  }

  loadTaggings(commitOrUrl?: string) {
    if (commitOrUrl === undefined) {
      commitOrUrl = "refs/heads/main";
    }

    // Check if it's a PR URL
    commitOrUrl = commitOrUrl.trim();
    const prMatch = commitOrUrl.match(/github\.com\/google\/fonts\/pull\/(\d+)/) ||
      commitOrUrl.match(/^(\d+)$/); // Also accept bare PR number
    if (prMatch) {
      this.prNumber = parseInt(prMatch[1]);
      fetch(`https://api.github.com/repos/google/fonts/pulls/${this.prNumber}`)
        .then((r) => r.json())
        .then((pr) => {
          const branch = pr.head.ref;
          this.commit = branch;
          this._loadTaggingsFromRef(branch);
        })
        .catch((error) => {
          console.error("Error fetching PR:", error);
        });
      return;
    }

    this.prNumber = null;
    this.commit = commitOrUrl;
    this._loadTaggingsFromRef(commitOrUrl);
  }

  private _loadTaggingsFromRef(ref: string) {
    this.clearTaggings();
    const tagsUrl = `https://raw.githubusercontent.com/google/fonts/${ref}/${TAGS_CSV_PATH}`;
    // TODO this approach only works for static tags for now
    fetch(tagsUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch tags: ${response.status} ${response.statusText}`);
        }
        return response.text();
      })
      .then((csvText) => {
        const lines = csvText.split("\n");
        // Collect variable tag entries keyed by "familyName,tagName"
        const variableEntries: Record<string, { family: Font; tag: Tag; scores: { location: Location; score: number }[]; scripts: string[] }> = {};
        for (let line of lines) {
          const [familyName, axisStr, tagName, scoreStr, scriptStr] = parseCSVLine(line);
          let score: number = parseFloat(scoreStr);
          const scripts = scriptsFromCSV(scriptStr);
          if (!familyName || !tagName) {
            console.warn(
              "Skipping line due to missing family name or tag name:",
              line
            );
            continue;
          }
          const family = this.family(familyName);
          if (family === undefined || family.name === undefined) {
            continue;
          }
          const tag = this.tags[tagName];
          if (!tag) {
            console.warn("Unknown tag:", tagName, "for family:", familyName);
            continue;
          }
          if (axisStr && axisStr.includes("@")) {
            const [axisNames, axisVals] = axisStr.split("@");
            const names = axisNames.split(",");
            const vals = axisVals.split(",");
            const location: Location = {};
            for (let j = 0; j < names.length; j++) {
              location[names[j]] = parseFloat(vals[j]);
            }
            const key = `${familyName},${tagName},${scriptsToCSV(scripts)}`;
            if (!variableEntries[key]) {
              variableEntries[key] = { family, tag, scores: [], scripts };
            }
            variableEntries[key].scores.push({ location, score });
          } else {
            family.taggings.push(new StaticTagging(family, tag, score, scripts));
          }
        }
        // Create VariableTaggings from grouped entries
        for (const entry of Object.values(variableEntries)) {
          entry.family.taggings.push(new VariableTagging(entry.family, entry.tag, entry.scores, entry.scripts));
        }
        this.baselineRows = this.currentRows();
      })
      .catch((error) => {
        console.error("Error loading taggings:", error);
      });
  }

  // Every tagging in memory that has a score, keyed by taggingKey, as CSV
  // text
  currentRows(): Map<string, string> {
    const rows = new Map<string, string>();
    for (const family of this.families) {
      for (const tagging of family.taggings) {
        const csv = tagging.toCSV();
        if (csv === "") continue;
        rows.set(taggingKey(family.name, tagging.tag.name, tagging.scripts), csv);
      }
    }
    return rows;
  }

  // The CSV to save: the file as it is on GitHub now, with this session's
  // edits laid over it. A tagging this session did not change keeps the
  // rows in the file, which other taggers may have changed since this page
  // loaded. A tagging this session changed, added or removed takes its
  // state from memory. Rows for families or tags the app does not know
  // are kept as they are.
  mergedCSV(latestText: string): string {
    const rows = groupCSVRows(latestText);
    const current = this.currentRows();
    const keys = new Set([...this.baselineRows.keys(), ...current.keys()]);
    for (const key of keys) {
      const before = this.baselineRows.get(key);
      const now = current.get(key);
      if (before === now) continue;
      if (now === undefined) rows.delete(key);
      else rows.set(key, now.trimEnd().split("\n"));
    }
    // Sort to match https://google.github.io/fonts/tags.html, which sorts
    // by "displayName,category" with case-sensitive string comparison
    const sortedKeys = [...rows.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return sortedKeys.map((key) => rows.get(key)!.join("\n")).join("\n") + "\n";
  }

  // The CSV of everything in memory, used when the file on GitHub cannot
  // be fetched
  fullCSV(): string {
    const current = this.currentRows();
    const sortedKeys = [...current.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return sortedKeys.map((key) => current.get(key)).join("");
  }

  // Fetch the tags CSV as it is now at this.commit
  async fetchLatestCSV(): Promise<string> {
    // The query string keeps the CDN from serving a copy cached at page load
    const url = `https://raw.githubusercontent.com/google/fonts/${this.commit}/${TAGS_CSV_PATH}?t=${Date.now()}`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to fetch tags: ${response.status} ${response.statusText}`);
    }
    return response.text();
  }

  async exportTaggings() {
    let csv: string;
    try {
      csv = this.mergedCSV(await this.fetchLatestCSV());
    } catch (error) {
      console.error("Could not fetch the latest tags, saving the in-memory copy:", error);
      alert("Could not fetch the latest tags from GitHub. The copy in the clipboard is this page's copy, and may overwrite changes other taggers made since this page loaded.");
      csv = this.fullCSV();
    }
    // Yeah, I guess this is neater than fiddling with octokit
    await navigator.clipboard.writeText(csv);
    let editUrl = `https://github.com/google/fonts/edit/${this.commit}/${TAGS_CSV_PATH}`;
    if (this.prNumber) {
      editUrl += `?pr=/google/fonts/pull/${this.prNumber}`;
    }
    if (!window.open(editUrl)) {
      alert(`The tags are in the clipboard. The browser blocked the GitHub editor window; open ${editUrl} and paste.`);
    }
  }
}
