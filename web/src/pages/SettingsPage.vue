<script setup lang="ts">
import {
  Button,
  PageShell,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SettingsRow,
  SectionGroup,
  SettingsSection,
  SurfaceCard,
  TextButton,
} from '@felinic/ui'
import { ArrowUpRight } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import PageScroll from '@/components/PageScroll.vue'
import { useAuth } from '@/composables/useAuth'
import { useSignOut } from '@/composables/useSignOut'
import { useResourceStatus } from '@/composables/useResourceStatus'
import { type ThemeMode, useTheme } from '@/composables/useTheme'
import { type Locale, LOCALES, setLocale } from '@/i18n'

const APP_VERSION = '0.1.0'
const PROJECT_URL = 'https://github.com/sheepbox8646/cloud-pvz'
const ENGINE_URL = 'https://github.com/wszqkzqk/PvZ-Portable'
const STEAM_URL = 'https://store.steampowered.com/app/3590/Plants_vs_Zombies_GOTY_Edition/'

const { t, locale } = useI18n()
const { mode } = useTheme()
const resources = useResourceStatus()
const { user } = useAuth()
const handleSignOut = useSignOut()

const LOCALE_LABELS: Record<Locale, string> = { 'zh-CN': '简体中文', 'en': 'English' }

const localeModel = computed({
  get: () => locale.value as Locale,
  set: (value: Locale) => setLocale(value),
})

const themeModel = computed({
  get: () => mode.value,
  set: (value: ThemeMode) => {
    mode.value = value
  },
})

const themeItems = computed(() => [
  { value: 'light' as const, label: t('settings.themeLight') },
  { value: 'dark' as const, label: t('settings.themeDark') },
  { value: 'system' as const, label: t('settings.themeSystem') },
])

const resourceDescription = computed(() => {
  switch (resources.state.value) {
    case 'checking': return t('settings.resourceChecking')
    case 'found': return t('settings.resourceFound', { size: `${(resources.size.value / 1024 / 1024).toFixed(1)} MB` })
    default: return t('settings.resourceMissing')
  }
})
</script>

<template>
  <PageScroll>
    <PageShell :title="t('settings.title')">
      <div class="space-y-8">
        <SettingsSection :title="t('settings.account')">
          <SettingsRow
            v-if="user"
            :label="user.email"
            :description="t('settings.accountSignedInHint')"
            stack="sm"
          >
            <Button
              variant="secondary"
              size="sm"
              @click="handleSignOut"
            >
              {{ t('account.signOut') }}
            </Button>
          </SettingsRow>
        </SettingsSection>

        <SettingsSection :title="t('settings.appearance')">
          <SettingsRow :label="t('settings.language')">
            <Select v-model="localeModel">
              <SelectTrigger class="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="item in LOCALES"
                  :key="item"
                  :value="item"
                >
                  {{ LOCALE_LABELS[item] }}
                </SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>
          <SettingsRow
            :label="t('settings.theme')"
            stack="sm"
          >
            <SegmentedControl
              v-model="themeModel"
              :items="themeItems"
              :aria-label="t('settings.theme')"
            />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection :title="t('settings.resources')">
          <SettingsRow
            :label="t('settings.resourcePak')"
            :description="resourceDescription"
          />
        </SettingsSection>

        <SettingsSection :title="t('settings.about')">
          <SettingsRow :label="t('settings.version')">
            <span class="text-body tabular-nums text-muted-foreground">{{ APP_VERSION }}</span>
          </SettingsRow>
          <SettingsRow :label="t('settings.license')">
            <span class="text-body text-muted-foreground">GPL-3.0</span>
          </SettingsRow>
          <SettingsRow :label="t('settings.project')">
            <TextButton
              as="a"
              :href="PROJECT_URL"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
              <ArrowUpRight />
            </TextButton>
          </SettingsRow>
          <SettingsRow
            label="PvZ-Portable"
            :description="t('settings.engineDescription')"
          >
            <TextButton
              as="a"
              :href="ENGINE_URL"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
              <ArrowUpRight />
            </TextButton>
          </SettingsRow>
        </SettingsSection>

        <SectionGroup
          :title="t('settings.disclaimer.title')"
          tone="muted"
        >
          <SurfaceCard>
            <ul class="list-disc space-y-2 pl-5 text-body leading-relaxed text-muted-foreground marker:text-muted-foreground">
              <i18n-t
                keypath="settings.disclaimer.engineThanks"
                tag="li"
                scope="global"
              >
                <template #engine>
                  <a
                    :href="ENGINE_URL"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-foreground underline decoration-muted-foreground underline-offset-4 hover:decoration-foreground"
                  >PvZ-Portable</a>
                </template>
              </i18n-t>
              <li>{{ t('settings.disclaimer.popcapThanks') }}</li>
              <li>{{ t('settings.disclaimer.trademark') }}</li>
              <i18n-t
                keypath="settings.disclaimer.assets"
                tag="li"
                scope="global"
              >
                <template #steam>
                  <a
                    :href="STEAM_URL"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-foreground underline decoration-muted-foreground underline-offset-4 hover:decoration-foreground"
                  >Steam</a>
                </template>
              </i18n-t>
              <li>{{ t('settings.disclaimer.noWarranty') }}</li>
            </ul>
          </SurfaceCard>
        </SectionGroup>
      </div>
    </PageShell>
  </PageScroll>
</template>
