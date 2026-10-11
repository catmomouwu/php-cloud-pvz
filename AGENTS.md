# Cloud PvZ — Agent 指南

- 设计与约定见 `docs/design.md`。
- Web/UI 工作先读 `packages/ui/AGENTS.md`（@felinic/ui 设计规范），它会指向 `packages/ui/skills/` 下的页面级规范。组合组件，不手写样式与颜色。
- `main.pak` 等游戏资源绝不能进入 git、构建产物或镜像。
- 文案走 i18n（`web/src/i18n/locales/`），中英文同时维护。
- 修改后至少运行 `pnpm type-check` 与 `pnpm build`。
