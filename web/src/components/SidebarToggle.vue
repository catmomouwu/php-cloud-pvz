<script setup lang="ts">
import { Button, useSidebar } from '@felinic/ui'
import { PanelLeft } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const { toggleSidebar } = useSidebar()
</script>

<template>
  <Button
    variant="ghost"
    size="icon-sm"
    tone="muted"
    :aria-label="t('nav.toggleSidebar')"
    @click="toggleSidebar"
  >
    <PanelLeft />
  </Button>
</template>
