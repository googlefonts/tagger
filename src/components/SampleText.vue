<script setup lang="ts">
import { Font } from '@/models';
import { computed } from 'vue';

const props = defineProps({
  font: {
    type: Font,
    required: true
  },
  fontSize: {
    type: Number,
    default: 32
  }
})

const cssStyle = computed(() => {
  if (!props.font) return '';
  let res = `font-family: '${props.font.name}'; font-size: ${props.fontSize}pt;`;
  if (props.font.isVF) {
    res += ' font-variation-settings:';
  }
  props.font.axes.forEach(axis => {
    res += ` '${axis.tag}' ${axis.displayValue},`;
  });
  return res.slice(0, -1) + ';'; // Remove trailing comma and add semicolon
});



</script>
<template>
  <div>
    <div contenteditable="true" :style="cssStyle" style="border: 1px solid #ccc; padding: 1em;">
      Grumpy wizards make toxic brew for the evil Queen and Jack.
    </div>
    <div v-for="axis in props.font?.axes" :key="axis.tag">
      <label>{{ axis.tag }}: {{ axis.displayValue }}</label>
      <input type="range" v-model="axis.displayValue" :min="axis.min" :max="axis.max" />
    </div>
  </div>
</template>
