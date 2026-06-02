<script setup lang="ts">
import { ref } from 'vue';
import { GF, StaticTagging, VariableTagging } from '../models';
import type { Location } from '../models';

interface AxisPosition {
  axisValue: number;
  score: number;
}

interface AxisSpec {
  axisName: string;
  positions: AxisPosition[];
}

function makePositions(count: number): AxisPosition[] {
  const n = Math.max(2, Math.floor(count || 2));
  const positions: AxisPosition[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    positions.push({ axisValue: 0, score: Math.round(t * 100) });
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
    spec.positions.push({ axisValue: 0, score: 0 });
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
      return axisSpecs.value.every(spec => {
        const axis = family.axis(spec.axisName);
        if (!axis) return false;
        const axisValues = spec.positions.map(p => p.axisValue);
        const minAxis = Math.min(...axisValues);
        const maxAxis = Math.max(...axisValues);
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
      const scores: { location: Location; score: number }[] = [];
      for (const spec of axisSpecs.value) {
        for (const pos of spec.positions) {
          const inherit = inheritedDefaultScore !== null && spec.axisName === 'wght' && pos.axisValue === 400;
          scores.push({
            location: { [spec.axisName]: pos.axisValue },
            score: inherit ? inheritedDefaultScore! : pos.score
          });
        }
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
            <input type="number" v-model.number="pos.axisValue" style="width: 80px;" />
            <label>Score:</label>
            <input type="number" v-model.number="pos.score" min="0" max="100" style="width: 60px;" />
            <button v-if="spec.positions.length > 2" @click="removePosition(spec, posIdx)">Remove</button>
          </div>
        </div>
        <button @click="addAxisSpec">Add axis</button>
        <br />
        <button @click="submitVariable" :disabled="selectedCategories.length === 0 || axisSpecs.length === 0">Apply</button>
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
</style>
