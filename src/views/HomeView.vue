<script setup lang="ts">
import { ref } from "vue";
// import ConnectComponent from "@/components/ConnectComponent.vue";

const show = ref(false);
const onError = (error: Error) => {
  console.debug({ error });
};
</script>
<template>
  <div>
    <button @click="show = true">Open modal connect {{ show }}</button>
  </div>
  <ConnectComponent @error="onError" :chain="5553" v-model="show" />
</template>
