<script setup lang="ts">
// 备份：手动快照 + 自动同步记录
import ProfileHistory from './ProfileHistory.vue'
import ProfileSnapshots from './ProfileSnapshots.vue'

defineProps<{
  localId: number
}>()
</script>

<template>
  <div class="space-y-8">
    <ProfileSnapshots :local-id="localId" />
    <ProfileHistory :local-id="localId" />
  </div>
</template>
