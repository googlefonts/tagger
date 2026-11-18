<script setup lang="ts">
import { ref, computed } from 'vue';
import { GF, StaticTagging, VariableTagging } from '../models';
import type { Font, Location, Tagging } from '../models';

// Scripts build only. One dialog to set up a tagger for a script and category:
// every family that supports the script gets a 0-score placeholder for the
// category, tagged for that script, and the view changes to three category
// panels for the work. Families with a wght axis get a variable placeholder
// at the wght extremes, crossed with the wdth extremes when the family has wdth.
// Everything else gets a static placeholder. A family that already has any
// tagging for the category, for all scripts or for this one, gets nothing: the
// tagger reviews those on a second pass and uses Duplicate where the script
// needs its own scores.

const props = defineProps({
  gf: {
    type: GF,
    required: true
  }
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'start', payload: { script: string; category: string }): void;
}>();

const script = ref<string | null>(null);
const category = ref<string | null>(null);
// One category at a time, so the three panels opened by OK have one focus.
const categories = computed<string[]>(() => category.value ? [category.value] : []);

const scriptOptions = computed(() => {
  const all = new Set<string>();
  for (const family of props.gf.families) {
    for (const s of family.subsets) all.add(s);
  }
  return [...all].sort();
});

const families = computed<Font[]>(() => {
  if (!script.value) return [];
  return props.gf.families.filter(f => f.subsets.includes(script.value!));
});

// The grid axes a family is scored on: wght, plus wdth when present.
function gridAxes(family: Font): string[] {
  if (!family.axis('wght')) return [];
  return family.axis('wdth') ? ['wght', 'wdth'] : ['wght'];
}

// One location per corner of the grid, each axis at its min and max.
function cornerLocations(family: Font, axes: string[]): Location[] {
  let locations: Location[] = [{}];
  for (const axisName of axes) {
    const axis = family.axis(axisName)!;
    const next: Location[] = [];
    for (const location of locations) {
      next.push({ ...location, [axisName]: axis.min });
      next.push({ ...location, [axisName]: axis.max });
    }
    locations = next;
  }
  return locations;
}

interface Plan {
  staticFamilies: number;
  wghtFamilies: number;
  wghtWdthFamilies: number;
  newTaggings: number;
  newRows: number;
  skipped: number;
}

// What OK will do, so the tagger can see the size of it first.
const plan = computed<Plan>(() => {
  const p: Plan = { staticFamilies: 0, wghtFamilies: 0, wghtWdthFamilies: 0, newTaggings: 0, newRows: 0, skipped: 0 };
  if (!script.value) return p;
  for (const family of families.value) {
    const axes = gridAxes(family);
    if (axes.length === 0) p.staticFamilies++;
    else if (axes.length === 1) p.wghtFamilies++;
    else p.wghtWdthFamilies++;
    const rows = axes.length === 0 ? 1 : 2 ** axes.length;
    for (const categoryName of categories.value) {
      if (family.hasTagging(categoryName)) {
        p.skipped++;
      } else {
        p.newTaggings++;
        p.newRows += rows;
      }
    }
  }
  return p;
});

function submit() {
  if (!script.value || !category.value) return;
  const scripts = [script.value];
  for (const family of families.value) {
    const axes = gridAxes(family);
    for (const categoryName of categories.value) {
      const tag = props.gf.tags[categoryName];
      if (!tag) continue;
      // Any tagging for the category, even one scored 0, means a person already
      // looked at it. Leave it alone.
      if (family.hasTagging(categoryName)) continue;
      let tagging: Tagging;
      if (axes.length === 0) {
        tagging = new StaticTagging(family, tag, 0, [...scripts]);
      } else {
        const scores = cornerLocations(family, axes).map(location => ({ location, score: 0 }));
        tagging = new VariableTagging(family, tag, scores, [...scripts]);
      }
      tagging.placeholder = true;
      family.taggings.push(tagging);
    }
  }
  emit('start', { script: script.value, category: category.value });
  emit('close');
}
</script>

<template>
  <div class="dialog-overlay" @click.self="emit('close')">
    <div class="dialog">
      <h3>Start script tagging</h3>
      <p class="hint">
        Adds a 0-score placeholder for the category to every family that supports the script.
        Families with a wght axis get a variable placeholder at the wght extremes, and at the
        wdth extremes too when they have wdth. Families that already have any tagging for the
        category, for all scripts or for this script, are skipped. OK then opens three panels
        for the category: the new placeholders, every tagging for the script, and every tagging.
      </p>

      <h4>Script</h4>
      <v-select v-model="script" :options="scriptOptions" placeholder="Choose one script"></v-select>

      <h4>Category</h4>
      <v-select v-model="category" :options="gf.uniqueTagNames()" placeholder="Choose one category"></v-select>

      <div v-if="script" class="plan">
        <div><b>{{ families.length }}</b> families support {{ script }}:
          {{ plan.staticFamilies }} static, {{ plan.wghtFamilies }} with wght, {{ plan.wghtWdthFamilies }} with wght and wdth.</div>
        <div>OK adds <b>{{ plan.newTaggings }}</b> placeholders ({{ plan.newRows }} CSV rows)
          and skips {{ plan.skipped }} that already exist.</div>
      </div>

      <hr />
      <button @click="submit" :disabled="!script || !category">OK</button>
      <button @click="emit('close')">Cancel</button>
    </div>
  </div>
</template>

<style scoped>
.dialog-overlay {
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

.dialog {
  background: white;
  padding: 20px;
  border-radius: 8px;
  max-width: 600px;
  width: 100%;
  margin-top: 50px;
  max-height: 80vh;
  overflow: auto;
}

.hint {
  margin: 4px 0 8px;
  font-size: 0.85em;
  color: #555;
}

.plan {
  margin-top: 12px;
  padding: 8px 12px;
  background: #f3f4f6;
  border-radius: 6px;
}
</style>
