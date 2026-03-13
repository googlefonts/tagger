<script setup lang="ts">
import { ref } from 'vue';
import { GF, StaticTagging, VariableTagging } from '../models';
import type { Location } from '../models';

interface AxisSpec {
  axisName: string;
  minAxis: number;
  maxAxis: number;
  minScore: number;
  maxScore: number;
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
const axisSpecs = ref<AxisSpec[]>([]);

function addAxisSpec() {
  axisSpecs.value.push({ axisName: '', minAxis: 0, maxAxis: 0, minScore: 0, maxScore: 100 });
}

function removeAxisSpec(idx: number) {
  axisSpecs.value.splice(idx, 1);
}

function submitStatic() {
  for (const categoryName of selectedCategories.value) {
    const tag = props.gf.tags[categoryName];
    if (!tag) continue;
    for (const family of props.gf.families) {
      if (family.hasTagging(categoryName)) {
        if (overwriteExisting.value) {
          const existing = family.taggings.find(t => t.tag.name === categoryName);
          if (existing) family.removeTagging(existing);
        } else {
          continue;
        }
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
        return axis.min <= spec.minAxis && axis.max >= spec.maxAxis;
      });
    });

    for (const family of matchingFamilies) {
      if (family.hasTagging(categoryName)) {
        if (overwriteExisting.value) {
          const existing = family.taggings.find(t => t.tag.name === categoryName);
          if (existing) family.removeTagging(existing);
        } else {
          continue;
        }
      }
      const scores: { location: Location; score: number }[] = [];
      for (const spec of axisSpecs.value) {
        scores.push(
          { location: { [spec.axisName]: spec.minAxis }, score: spec.minScore },
          { location: { [spec.axisName]: spec.maxAxis }, score: spec.maxScore }
        );
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

      <label><input type="checkbox" v-model="overwriteExisting" /> Overwrite existing tags</label>

      <div v-if="mode === 'static'">
        <label>Placeholder score: <input type="number" v-model.number="placeholderScore" min="0" max="100" /></label>
        <br />
        <button @click="submitStatic" :disabled="selectedCategories.length === 0">Apply</button>
      </div>

      <div v-if="mode === 'variable'">
        <div v-for="(spec, idx) in axisSpecs" :key="idx" class="axis-spec-row">
          <label>Axis: <input type="text" v-model="spec.axisName" placeholder="e.g. wght" style="width: 80px;" /></label>
          <label>Min axis: <input type="number" v-model.number="spec.minAxis" style="width: 80px;" /></label>
          <label>Max axis: <input type="number" v-model.number="spec.maxAxis" style="width: 80px;" /></label>
          <label>Min score: <input type="number" v-model.number="spec.minScore" style="width: 60px;" /></label>
          <label>Max score: <input type="number" v-model.number="spec.maxScore" style="width: 60px;" /></label>
          <button @click="removeAxisSpec(idx)">Remove</button>
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

.axis-spec-row {
  margin-bottom: 8px;
}

.axis-spec-row label {
  margin-right: 8px;
}
</style>
