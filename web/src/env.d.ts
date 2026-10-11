/// <reference types="vite/client" />

// 纯 CSS 包，没有类型声明
declare module '@fontsource-variable/inter'

/** package.json 的 version，构建时由 vite.config.ts 注入 */
declare const __APP_VERSION__: string
