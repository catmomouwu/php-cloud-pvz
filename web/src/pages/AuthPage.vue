<script setup lang="ts">
import { Button, CalloutBanner, FieldStack, FormStack, Input, PageHeader, SurfaceCard, TextButton, toast } from '@felinic/ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AppLogo from '@/components/AppLogo.vue'
import { waitForUser } from '@/composables/useAuth'
import { authClient } from '@/lib/auth-client'

const props = defineProps<{
  mode: 'login' | 'register'
}>()

const { t, te } = useI18n()

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const submitting = ref(false)
const mismatch = ref(false)

const isRegister = computed(() => props.mode === 'register')

watch(() => props.mode, () => {
  password.value = ''
  confirmPassword.value = ''
  mismatch.value = false
})

const router = useRouter()
const route = useRoute()

function errorMessage(code: string | undefined): string {
  const key = `auth.errors.${code}`
  return code && te(key) ? t(key) : t('auth.requestFailed')
}

async function submit() {
  mismatch.value = isRegister.value && password.value !== confirmPassword.value
  if (mismatch.value) return

  submitting.value = true
  try {
    const { error } = isRegister.value
      ? await authClient.signUp.email({ email: email.value, password: password.value, name: email.value.split('@')[0] ?? email.value })
      : await authClient.signIn.email({ email: email.value, password: password.value })
    if (error) {
      toast.error(errorMessage(error.code))
      return
    }
    await waitForUser()
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : '/'
    void router.push(redirect)
  }
  catch {
    toast.error(t('auth.requestFailed'))
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-center gap-2">
      <AppLogo class="size-5 text-foreground" />
      <span class="text-title font-semibold text-foreground">{{ t('app.name') }}</span>
    </div>

    <SurfaceCard class="space-y-6">
      <PageHeader
        :title="isRegister ? t('auth.registerTitle') : t('auth.signInTitle')"
        :description="isRegister ? t('auth.registerDescription') : t('auth.signInDescription')"
        :inset="false"
      />
      <form
        class="space-y-6"
        @submit.prevent="submit"
      >
        <FormStack>
          <FieldStack
            :label="t('auth.email')"
            for="auth-email"
          >
            <Input
              id="auth-email"
              v-model="email"
              type="email"
              autocomplete="email"
              required
            />
          </FieldStack>
          <FieldStack
            :label="t('auth.password')"
            for="auth-password"
            :help="isRegister ? t('auth.passwordHint') : ''"
          >
            <Input
              id="auth-password"
              v-model="password"
              type="password"
              :autocomplete="isRegister ? 'new-password' : 'current-password'"
              minlength="8"
              required
            />
          </FieldStack>
          <FieldStack
            v-if="isRegister"
            :label="t('auth.confirmPassword')"
            for="auth-confirm-password"
          >
            <Input
              id="auth-confirm-password"
              v-model="confirmPassword"
              type="password"
              autocomplete="new-password"
              required
            />
          </FieldStack>
        </FormStack>
        <CalloutBanner
          v-if="mismatch"
          tone="destructive"
          size="sm"
          :description="t('auth.passwordMismatch')"
        />
        <Button
          type="submit"
          block
          :loading="submitting"
        >
          {{ isRegister ? t('auth.submitRegister') : t('auth.submitSignIn') }}
        </Button>
      </form>
    </SurfaceCard>

    <div class="flex flex-col items-center gap-1 text-body text-muted-foreground">
      <p class="flex items-center gap-1">
        {{ isRegister ? t('auth.haveAccount') : t('auth.noAccount') }}
        <TextButton as-child>
          <RouterLink :to="isRegister ? '/login' : '/register'">
            {{ isRegister ? t('auth.toSignIn') : t('auth.toRegister') }}
          </RouterLink>
        </TextButton>
      </p>
    </div>
  </div>
</template>
