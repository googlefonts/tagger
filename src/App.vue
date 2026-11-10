<script setup lang="ts">
import type { ComputedRef } from 'vue';
import { onBeforeMount, ref, computed, nextTick } from 'vue';
import { GF, Font } from './models';
import type { Tagging } from './models';
import type { Panel } from './components/Panel.vue';
import type { FilterSet } from './components/AddTags.vue';
import { EventBus } from './eventbus';
import { SCRIPT_TAGGING, LINT_RULES } from './config';
import { sampleTextFor } from './pangrams';

let appLoaded = ref(false);
let showUndefined = ref(false);
let showPlaceholderDialog = ref(false);
let showScriptStarter = ref(false);
let vfDisplayMode = ref<'animated' | 'list'>('animated');
let commitRef = ref('refs/heads/main');

function loadFromCommit() {
  if (gf.value) {
    gf.value.loadTaggings(commitRef.value);
  }
}
let gf = ref<GF | null>(null);
// @ts-ignore
window.gf = gf; // For debugging 
let panels = ref<Panel[]>([
  { type: 'font', font: 'Roboto' },
  { type: 'categories', categories: ['/Expressive/Loud', '/Expressive/Childlike'], }
]);

let categories: ComputedRef<string[]> = computed(() => {
  return gf.value ? gf.value.uniqueTagNames() : [];
});


function addFontPanel(font: string) {
  panels.value.push({ type: 'font', font });
}
function addTodoPanel() {
  panels.value.push({ type: 'todo' });
}
function addUntaggedPanel() {
  panels.value.push({ type: 'untagged' });
}
function addUntaggedAxesPanel() {
  panels.value.push({ type: 'untagged-axes' });
}
function addCategoriesPanel(categories: string[]) {
  panels.value.push({
    type: 'categories', categories
  });
}
function removePanel(idx: number) { panels.value.splice(idx, 1); }
// After Start script tagging: three views of the category. Panels are keyed by
// index, so clear them first to get fresh views instead of reused ones.
async function startScriptTagging({ script, category }: { script: string; category: string }) {
  panels.value = [];
  await nextTick();
  // Every preview shows Latin and the script side by side
  const sampleText = sampleTextFor([script]);
  panels.value = [
    { type: 'categories', categories: [category], sortBy: 'score', scriptFilter: [script], placeholdersOnly: true, sampleText },
    { type: 'categories', categories: [category], sortBy: 'family', scriptFilter: [script], sampleText },
    { type: 'categories', categories: [category], sortBy: 'score', sampleText },
  ];
}
function shiftLeft(idx: number) {
  if (idx > 0) {
    const panel = panels.value.splice(idx, 1)[0];
    panels.value.splice(idx - 1, 0, panel);
  }
}
function shiftRight(idx: number) {
  if (idx < panels.value.length - 1) {
    const panel = panels.value.splice(idx, 1)[0];
    panels.value.splice(idx + 1, 0, panel);
  }
}
function removeTag(tag: Tagging) {
  // const index = tags.value!.items.indexOf(tag);
  // if (index !== -1) {
  //   tags.value!.items.splice(index, 1);
  // }
}
function updateTags(newTags: any) {
  // tags.value = newTags;
}

onBeforeMount(async () => {
  gf.value = new GF();
  await gf.value.getFamilyData();
  if (LINT_RULES) await gf.value.getLintRules();
  await gf.value.getTagDefinitions();
  gf.value.loadFamilies();
  gf.value.loadTaggings();

  // Subscribe to events
  EventBus.$on('ensure-loaded', (family: string) => {
    gf.value?.ensureLoaded(family);
  });

  EventBus.$on('add-font-panel', addFontPanel);
  EventBus.$on('remove-tag', removeTag);
  EventBus.$on('update:tags', updateTags);

  appLoaded.value = true;

});


</script>


<template>
  <div id="app">
    <div id="fonts" :key="gf?.loadedFamilies.length">
      <link v-for="family in gf?.loadedFamilies" :href="family.url" rel="stylesheet">
    </div>
    <div id="content" v-if="appLoaded">
      <button @click="addFontPanel('Maven Pro')">Tags in font</button>
      <button @click="addCategoriesPanel(['/Expressive/Loud'])">Tags in category</button>
      <button @click="addTodoPanel()">Todo List</button>
      <button @click="addUntaggedPanel()">Untagged families</button>
      <button @click="addUntaggedAxesPanel()">Untagged axes</button>
      <button @click="gf?.exportTaggings()">Save changes</button>
      <button @click="showPlaceholderDialog = true">Placeholder Tags</button>
      <button v-if="SCRIPT_TAGGING" @click="showScriptStarter = true">Start script tagging</button>
      <input type="checkbox" v-model="showUndefined">Show all</input>
      <button @click="vfDisplayMode = vfDisplayMode === 'animated' ? 'list' : 'animated'">
        VF: {{ vfDisplayMode === 'animated' ? 'Animated' : 'List' }}
      </button>
      <label>Commit: <input type="text" v-model.lazy="commitRef" @change="loadFromCommit"
        style="width: 280px; font-family: monospace;" /></label>
      <span v-if="SCRIPT_TAGGING" class="script-mode">Script tagging: saves to families-scripts.csv</span>
      <placeholder-tag-adder v-if="showPlaceholderDialog" :gf="gf" @close="showPlaceholderDialog = false" />
      <script-starter v-if="showScriptStarter" :gf="gf" @start="startScriptTagging" @close="showScriptStarter = false" />
      <div style="display: flex; flex-direction: row; width: 100vw; min-height: 100vh;">
        <div v-for="(panel, idx) in panels" :key="idx"
          :style="{ flex: '1 1 0', minWidth: 0, borderRight: idx < panels.length - 1 ? '1px solid #eee' : 'none', height: '100vh', overflow: 'auto' }">
          <panel :panel="panel" :gf="gf" :idx="idx" @remove-panel="removePanel(idx)" @shift-left="shiftLeft(idx)"
            @shift-right="shiftRight(idx)" :showUndefined="showUndefined" :vfDisplayMode="vfDisplayMode">
          </panel>
        </div>
      </div>
    </div>
    <div v-else>Loading...</div>
  </div>
</template>
