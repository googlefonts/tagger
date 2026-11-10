<script setup lang="ts">
import { ref, computed } from 'vue';
import { GF, StaticTagging, VariableTagging } from '../models';
import type { Font, Location, Tagging } from '../models';

// Scripts build only. One dialog to set up a tagger for a script: every family
// that supports the script gets a 0-score placeholder for each chosen category,
// tagged for that script. Families with a wght axis get a variable placeholder
// at the wght extremes, crossed with the wdth extremes when the family has wdth.
// Everything else gets a static placeholder.

const props = defineProps({
  gf: {
    type: GF,
    required: true
  }
});

const emit = defineEmits(['close']);

// The categories a script tagger starts with. Change the prefixes to widen the set.
const DEFAULT_CATEGORY_PREFIXES = ['/Expressive/', '/Quality/'];

const script = ref<string | null>(null);
const categories = ref<string[]>(
  props.gf.uniqueTagNames().filter(name => DEFAULT_CATEGORY_PREFIXES.some(p => name.startsWith(p)))
);

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
      if (family.hasTaggingForScripts(categoryName, [script.value])) {
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
  if (!script.value) return;
  const scripts = [script.value];
  for (const family of families.value) {
    const axes = gridAxes(family);
    for (const categoryName of categories.value) {
      const tag = props.gf.tags[categoryName];
      if (!tag) continue;
      // A tagging for this script and category, even one scored 0, means a
      // person already looked at it. Leave it alone.
      if (family.hasTaggingForScripts(categoryName, scripts)) continue;
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
  emit('close');
}
</script>

<template>
  <div class="dialog-overlay" @click.self="emit('close')">
    <div class="dialog">
      <h3>Start script tagging</h3>
      <p class="hint">
        Adds a 0-score placeholder for every family that supports the script and every
        category below. Families with a wght axis get a variable placeholder at the wght
        extremes, and at the wdth extremes too when they have wdth. Families that already
        have a tagging for the script and category are skipped.
      </p>

      <h4>Script</h4>
      <v-select v-model="script" :options="scriptOptions" placeholder="Choose one script"></v-select>

      <h4>Categories</h4>
      <v-select v-model="categories" multiple :options="gf.uniqueTagNames()"></v-select>

      <div v-if="script" class="plan">
        <div><b>{{ families.length }}</b> families support {{ script }}:
          {{ plan.staticFamilies }} static, {{ plan.wghtFamilies }} with wght, {{ plan.wghtWdthFamilies }} with wght and wdth.</div>
        <div>OK adds <b>{{ plan.newTaggings }}</b> placeholders ({{ plan.newRows }} CSV rows)
          and skips {{ plan.skipped }} that already exist.</div>
      </div>

      <hr />
      <button @click="submit" :disabled="!script || categories.length === 0 || plan.newTaggings === 0">OK</button>
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
