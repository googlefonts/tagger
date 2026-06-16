<script setup lang="ts">
import { ref, computed } from 'vue';
import { GF, StaticTagging, VariableTagging } from '../models';
import type { Axis, Location } from '../models';

interface AxisPosition {
  // A number, or the keywords "min"/"max" which resolve to each font's own axis bounds.
  axisValue: number | string;
}

// Resolve a position's axis value against a specific font's axis.
// "min"/"max" map to that font's axis bounds; numeric strings are parsed.
// Returns null if the value can't be resolved to a number.
function resolveAxisValue(rawValue: number | string, axis: Axis): number | null {
  if (typeof rawValue === 'number') return rawValue;
  const v = rawValue.trim().toLowerCase();
  if (v === 'min') return axis.min;
  if (v === 'max') return axis.max;
  const n = parseFloat(rawValue);
  return isNaN(n) ? null : n;
}

interface AxisSpec {
  axisName: string;
  positions: AxisPosition[];
}

function makePositions(count: number): AxisPosition[] {
  const n = Math.max(2, Math.floor(count || 2));
  const positions: AxisPosition[] = [];
  for (let i = 0; i < n; i++) {
    // Seed the two extremes with the min/max keywords; interior positions start blank-ish.
    let axisValue: number | string = 0;
    if (i === 0) axisValue = 'min';
    else if (i === n - 1) axisValue = 'max';
    positions.push({ axisValue });
  }
  return positions;
}

const props = defineProps({
  gf: {
    type: GF,
    required: true
  }
});

const emit = defineEmits(['close']);

const mode = ref<'static' | 'variable'>('static');
const selectedCategories = ref<string[]>([]);
const placeholderScore = ref<number>(0);
const overwriteExisting = ref<boolean>(false);
const onlyReplaceExisting = ref<boolean>(false);
const axisSpecs = ref<AxisSpec[]>([]);

// Scores live at the *nodes* of the cross-product grid, not on individual axis
// positions. Keyed by a tuple of position indices, one per named axis (e.g. "0-1").
const nodeScores = ref<Record<string, number>>({});

// Only axes that have actually been named participate in the grid.
const namedSpecs = computed(() => axisSpecs.value.filter(s => s.axisName.trim() !== ''));

interface GridCell { axisName: string; axisValue: number | string; }
interface GridNode { key: string; cells: GridCell[]; }

// The Cartesian product of every named axis's positions. Each node is one full
// multi-axis location that needs its own score — e.g. (wdth=75, wght=100).
const gridNodes = computed<GridNode[]>(() => {
  const specs = namedSpecs.value;
  if (specs.length === 0) return [];
  let combos: { idxs: number[]; cells: GridCell[] }[] = [{ idxs: [], cells: [] }];
  for (const spec of specs) {
    const next: { idxs: number[]; cells: GridCell[] }[] = [];
    spec.positions.forEach((pos, posIdx) => {
      for (const combo of combos) {
        next.push({
          idxs: [...combo.idxs, posIdx],
          cells: [...combo.cells, { axisName: spec.axisName, axisValue: pos.axisValue }]
        });
      }
    });
    combos = next;
  }
  return combos.map(c => ({ key: c.idxs.join('-'), cells: c.cells }));
});

function getNodeScore(key: string): number {
  return nodeScores.value[key] ?? 0;
}

function setNodeScore(key: string, event: Event) {
  const v = (event.target as HTMLInputElement).valueAsNumber;
  nodeScores.value = { ...nodeScores.value, [key]: isNaN(v) ? 0 : v };
}

function addAxisSpec() {
  axisSpecs.value.push({ axisName: '', positions: makePositions(2) });
}

function removeAxisSpec(idx: number) {
  axisSpecs.value.splice(idx, 1);
}

function setPositionCount(spec: AxisSpec, event: Event) {
  const count = (event.target as HTMLInputElement).valueAsNumber;
  const n = Math.max(2, Math.floor(count || 2));
  while (spec.positions.length < n) {
    spec.positions.push({ axisValue: 0 });
  }
  if (spec.positions.length > n) {
    spec.positions.splice(n);
  }
}

function removePosition(spec: AxisSpec, idx: number) {
  if (spec.positions.length <= 2) return;
  spec.positions.splice(idx, 1);
}

function submitStatic() {
  for (const categoryName of selectedCategories.value) {
    const tag = props.gf.tags[categoryName];
    if (!tag) continue;
    for (const family of props.gf.families) {
      if (family.hasTagging(categoryName)) {
        if (onlyReplaceExisting.value || overwriteExisting.value) {
          const existing = family.taggings.find(t => t.tag.name === categoryName);
          if (existing) family.removeTagging(existing);
        } else {
          continue;
        }
      } else if (onlyReplaceExisting.value) {
        continue;
      }
      family.taggings.push(new StaticTagging(family, tag, placeholderScore.value));
    }
  }
  emit('close');
}

function submitVariable() {
  for (const categoryName of selectedCategories.value) {
    const tag = props.gf.tags[categoryName];
    if (!tag) continue;

    const matchingFamilies = props.gf.families.filter(family => {
      return namedSpecs.value.every(spec => {
        const axis = family.axis(spec.axisName);
        if (!axis) return false;
        // "min"/"max" always resolve within range; only explicit numbers can fall outside it.
        const axisValues = spec.positions.map(p => resolveAxisValue(p.axisValue, axis));
        if (axisValues.some(v => v === null)) return false;
        const minAxis = Math.min(...axisValues as number[]);
        const maxAxis = Math.max(...axisValues as number[]);
        return axis.min <= minAxis && axis.max >= maxAxis;
      });
    });

    for (const family of matchingFamilies) {
      // If we're replacing a static tagging, inherit its score at the default
      // location (wght=400) so the variable tagging keeps the existing value there.
      let inheritedDefaultScore: number | null = null;
      if (family.hasTagging(categoryName)) {
        if (onlyReplaceExisting.value || overwriteExisting.value) {
          const existing = family.taggings.find(t => t.tag.name === categoryName);
          if (existing) {
            if (existing instanceof StaticTagging && existing.score !== null) {
              inheritedDefaultScore = existing.score;
            }
            family.removeTagging(existing);
          }
        } else {
          continue;
        }
      } else if (onlyReplaceExisting.value) {
        continue;
      }
      // One score entry per grid node, each a full multi-axis location.
      const scores: { location: Location; score: number }[] = [];
      for (const node of gridNodes.value) {
        const location: Location = {};
        let ok = true;
        for (const cell of node.cells) {
          const axis = family.axis(cell.axisName);
          if (!axis) { ok = false; break; }
          const value = resolveAxisValue(cell.axisValue, axis);
          if (value === null) { ok = false; break; }
          location[cell.axisName] = value;
        }
        if (!ok) continue;
        const inherit = inheritedDefaultScore !== null && location['wght'] === 400;
        scores.push({
          location,
          score: inherit ? inheritedDefaultScore! : getNodeScore(node.key)
        });
      }
      family.taggings.push(new VariableTagging(family, tag, scores));
    }
  }
  emit('close');
}
</script>

<template>
  <div class="placeholder-dialog-overlay" @click.self="emit('close')">
    <div class="placeholder-dialog">
      <h3>Placeholder Tag Adder</h3>

      <div>
        <label><input type="radio" v-model="mode" value="static" /> Static</label>
        <label><input type="radio" v-model="mode" value="variable" /> Variable</label>
      </div>

      <h4>Categories</h4>
      <v-select v-model="selectedCategories" multiple :options="gf.uniqueTagNames().sort()"></v-select>

      <label><input type="checkbox" v-model="overwriteExisting" :disabled="onlyReplaceExisting" /> Overwrite existing tags</label>
      <label><input type="checkbox" v-model="onlyReplaceExisting" /> Only replace existing tags</label>

      <div v-if="mode === 'static'">
        <label>Placeholder score: <input type="number" v-model.number="placeholderScore" min="0" max="100" /></label>
        <br />
        <button @click="submitStatic" :disabled="selectedCategories.length === 0">Apply</button>
      </div>

      <div v-if="mode === 'variable'">
        <div v-for="(spec, idx) in axisSpecs" :key="idx" class="axis-spec">
          <div class="axis-spec-header">
            <label>Axis:</label>
            <input type="text" v-model="spec.axisName" placeholder="e.g. wght" style="width: 80px;" />
            <label>Positions:</label>
            <input type="number" min="2" step="1" :value="spec.positions.length"
              @input="setPositionCount(spec, $event)" style="width: 60px;" />
            <button @click="removeAxisSpec(idx)">Remove axis</button>
          </div>
          <div v-for="(pos, posIdx) in spec.positions" :key="posIdx" class="position-row">
            <label>Axis value:</label>
            <input type="text" v-model="pos.axisValue" placeholder="number, min, max" style="width: 100px;" />
            <button v-if="spec.positions.length > 2" @click="removePosition(spec, posIdx)">Remove</button>
          </div>
        </div>
        <button @click="addAxisSpec">Add axis</button>

        <div v-if="gridNodes.length" class="grid-scores">
          <h4>Scores per location ({{ gridNodes.length }})</h4>
          <div v-for="node in gridNodes" :key="node.key" class="grid-node-row">
            <span class="node-label">
              <span v-for="(cell, i) in node.cells" :key="cell.axisName">{{ i > 0 ? ', ' : '' }}{{ cell.axisName }}={{ cell.axisValue }}</span>
            </span>
            score=<input type="number" min="0" max="100" :value="getNodeScore(node.key)"
              @input="setNodeScore(node.key, $event)" style="width: 60px;" />
          </div>
        </div>
        <br />
        <button @click="submitVariable" :disabled="selectedCategories.length === 0 || gridNodes.length === 0">Apply</button>
      </div>

      <hr />
      <button @click="emit('close')">Cancel</button>
    </div>
  </div>
</template>

<style scoped>
.placeholder-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 100;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.placeholder-dialog {
  background: white;
  padding: 20px;
  border-radius: 8px;
  max-width: 600px;
  width: 100%;
  margin-top: 50px;
  max-height: 80vh;
  overflow: auto;
}

.axis-spec {
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 12px;
}

.axis-spec-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.position-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0 4px 16px;
}

.grid-scores {
  margin-top: 12px;
  border-top: 1px solid #ddd;
  padding-top: 8px;
}

.grid-scores h4 {
  margin: 0 0 8px;
}

.grid-node-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0;
}

.grid-node-row .node-label {
  min-width: 220px;
  font-family: monospace;
}
</style>
