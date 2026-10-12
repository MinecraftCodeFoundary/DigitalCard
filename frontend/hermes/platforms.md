# 平台适配手册

## 1. 差异处理决策树

```
这个差异编译期就能确定吗?
├── 能  → 条件编译(#ifdef / #ifndef)
└── 不能 → 运行时 API 判断(uni.getSystemInfoSync().uniPlatform)
```

- 构建脚本/插件层面:`process.env.UNI_PLATFORM`(仅 vite.config.ts、构建脚本内可用)
- 禁止:用 UA 嗅探替代条件编译;在能编译期剔除的代码里留运行时 if

## 2. 条件编译速查

```vue
<script setup lang="ts">
// #ifdef H5
import { h5Api } from '@/utils/h5'
// #endif
// #ifndef MP-WEIXIN
// 所有平台生效,除微信小程序
// #endif
</script>

<template>
  <!-- #ifdef APP-PLUS -->
  <view>仅 APP</view>
  <!-- #endif -->
</template>
```

常用平台标识:`H5`、`MP-WEIXIN`、`MP-ALIPAY`、`MP-BAIDU`、`MP-TOUTIAO`、`MP-LARK`、`MP-QQ`、`MP-KUAISHOU`、`MP-JD`、`MP-XHS`、`APP-PLUS`(app-android / app-ios 可再细分)、`MP`(`%MP%` 或 `MP` 泛小程序)。

## 3. 本项目已存在的平台差异(改动时别破坏)

| 差异点 | 位置 | 规则 |
|--------|------|------|
| devServer 代理(`VITE_APP_PROXY_*`) | src/http/interceptor.ts | 仅 H5 dev 生效;非 H5 端 dev 也是 build command,无代理 |
| `responseType: 'json'` | src/http/http.ts | 用 `#ifndef MP-WEIXIN` 包裹,微信小程序不支持 |
| eruda 调试面板 | vite.config.ts | 仅 H5 development |
| 打包分析 visualizer | vite.config.ts | 仅 H5 production,产物在 `node_modules/.cache/visualizer/stats.html` |
| 自动打开开发者工具 | scripts/open-dev-tools.js | mp-weixin / mp-alipay / mp-lark 构建后自动打开对应工具;上传脚本用 `SKIP_OPEN_DEVTOOLS=true` 跳过 |
| 小程序分包优化 | manifest.config.ts、src/pages-work | 启用原生 optimization.subPackages；仅分包使用的源码放在所属分包目录，共享代码留在主包 |
| 原生插件资源复制 | vite.config.ts | 仅 app 平台且 `VITE_COPY_NATIVE_RES_ENABLE=true` |
| 名片模块拖拽排序 | pages-work/edit/components/ModuleEditor.vue | H5 显示原生拖拽手柄；手机和小程序使用所有平台共有的上移、下移按钮 |
| 媒体模块与链接按钮 | components/SectionMedia.vue | 图片使用 uni.previewImage，视频使用 uni video；H5 链接打开新标签页，小程序复制链接。小程序视频建议使用 MP4 |
| 人物主页的顶部安全区 | components/AppShell.vue、components/CardHomepage.vue | 访客人物主页隐藏品牌栏；微信端通过条件编译读取状态栏高度，给返回按钮及内容页标题留出空间；H5 从页面顶部展示 |
| 小程序导航与移动布局 | components/AppShell.vue | 微信端按胶囊位置计算顶部留白及右侧避让；底部导航和编辑/分享操作栏保留安全区。各页面均为移动单栏，H5 以最大 480px 宽度预览小程序布局 |
| 云开发请求与上传 | App.vue、http/cloud.ts、http/index.ts、pages-work/http/upload.ts | 微信端用条件编译调用 wx.cloud；H5 使用云网关 HTTP。初始化仅一次、明确指定环境。微信身份来自云函数上下文 |
| 微信注册与登录 | hooks/useSession.ts、pages-work/account/account.vue | 微信端主动授权，云模式通过云函数上下文识别身份，HTTP 模式通过 uni.login 的 code；首次自动注册、后续恢复账号。H5 仅显示微信入口与小程序操作提示，不提供密码登录 |

## 4. 多端请求地址

`env/.env` 支持按微信开发者工具 envVersion 覆写(不配则回退 `VITE_SERVER_BASEURL`):

```ini
VITE_SERVER_BASEURL = 'https://api.example.com'
VITE_SERVER_BASEURL__WEIXIN_DEVELOP = 'https://dev.xxx.com'   # 开发版
VITE_SERVER_BASEURL__WEIXIN_TRIAL  = 'https://trial.xxx.com'  # 体验版
VITE_SERVER_BASEURL__WEIXIN_RELEASE = 'https://prod.xxx.com'  # 正式版
```

## 5. 平台命令

```bash
pnpm dev            # H5
pnpm dev:mp         # 微信小程序(其余 dev:mp-alipay / mp-baidu / mp-jd / mp-kuaishou / mp-lark / mp-qq / mp-toutiao / mp-xhs 同理)
pnpm dev:app        # APP(app-android / app-ios 可细分)
pnpm build:mp       # 微信小程序生产构建
```

新增平台特定行为时,同步更新本文第 3 节的差异点表。
