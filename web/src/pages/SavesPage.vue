<script setup lang="ts">
import { Button, Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle, InlineLoadingRow, PageShell } from '@felinic/ui'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import PageScroll from '@/components/PageScroll.vue'
import ProfileCard from '@/components/ProfileCard.vue'
import SyncNotice from '@/components/SyncNotice.vue'
import { useLocalSaves } from '@/composables/useLocalSaves'
import { usePlayAs } from '@/composables/usePlayAs'

const { t } = useI18n()
const router = useRouter()
const playAs = usePlayAs()
const { profiles, loaded } = useLocalSaves()
</script>

<template>
  <PageScroll>
    <PageShell
      :title="t('saves.title')"
      :description="t('saves.descriptionCloud')"
      width="lg"
    >
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
          <Button
            variant="secondary"
            @click="router.push({ name: 'game' })"
          >
            {{ t('saves.goPlay') }}
          </Button>
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
          @play="playAs(profile.name)"
        />
      </div>
    </PageShell>
  </PageScroll>
</template>
