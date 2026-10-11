import { createApp } from 'vue'
import '@fontsource-variable/inter'
import './style.css'
import App from './App.vue'
import './composables/useTheme'
import { i18n } from './i18n'
import { router } from './router'

createApp(App).use(i18n).use(router).mount('#app')
