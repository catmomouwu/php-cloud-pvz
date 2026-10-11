<script setup lang="ts">
import { Button, Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle, InlineLoadingRow, PageShell } from '@felinic/ui'
import { Upload } from 'lucide-vue-next'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import ImportSavesDialog from '@/components/ImportSavesDialog.vue'
import PageScroll from '@/components/PageScroll.vue'
import ProfileCard from '@/components/ProfileCard.vue'
import SyncNotice from '@/components/SyncNotice.vue'
import { useLocalSaves } from '@/composables/useLocalSaves'

const { t } = useI18n()
const router = useRouter()
const { profiles, loaded } = useLocalSaves()
const importOpen = ref(false)
</script>

<template>
  <PageScroll>
    <PageShell
      :title="t('saves.title')"
    >
      <template #actions>
        <Button
          variant="secondary"
          size="sm"
          @click="importOpen = true"
        >
          <Upload />
          {{ t('saves.import.action') }}
        </Button>
      </template>

      <SyncNotice class="mb-6" />

      <InlineLoadingRow v-if="!loaded">
        {{ t('saves.loading') }}
      </InlineLoadingRow>

      <Empty
        v-else-if="profiles.length === 0"
        class="border"
      >
        <EmptyHeader>
          <EmptyTitle>{{ t('saves.emptyTitle') }}</EmptyTitle>
          <EmptyDescription>{{ t('saves.emptyDescription') }}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div class="flex flex-wrap justify-center gap-2">
            <Button
              variant="secondary"
              @click="router.push({ name: 'game' })"
            >
              {{ t('saves.goPlay') }}
            </Button>
            <Button
              variant="secondary"
              @click="importOpen = true"
            >
              <Upload />
              {{ t('saves.import.action') }}
            </Button>
          </div>
        </EmptyContent>
      </Empty>

      <div
        v-else
        class="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <ProfileCard
          v-for="profile in profiles"
          :key="profile.id"
          :profile="profile"
        />
      </div>
    </PageShell>
    <ImportSavesDialog v-model:open="importOpen" />
  </PageScroll>
</template>
