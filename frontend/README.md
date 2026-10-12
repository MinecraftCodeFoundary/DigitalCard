# 一面前端

基于 unibest 4.4.1 官方模板开发，保留 Vue 3、TypeScript、UnoCSS、Pinia、约定式路由和配置生成流程。

完整启动、微信接入、部署及测试说明见 [项目 README](../README.md)。

```powershell
pnpm install
pnpm dev:h5
pnpm dev:mp
pnpm build:h5
pnpm build:mp
pnpm type-check
pnpm lint
pnpm test:run
```

修改环境变量请使用 `env/.env.local` 或 `env/.env.production.local`。页面通过 `definePage` 自动注册，编辑、分享与设置放在 `src/pages-work` 分包；不手动改 `src/pages.json` 和 `src/manifest.json`。
