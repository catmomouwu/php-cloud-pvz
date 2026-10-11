<script setup lang="ts">
import { Toaster } from '@felinic/ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const toastHeadings = computed(() => ({
  message: t('toast.message'),
  success: t('toast.success'),
  error: t('toast.error'),
  info: t('toast.info'),
  warning: t('toast.warning'),
}))
</script>

<template>
  <RouterView />
  <Toaster :headings="toastHeadings" />
</template>
