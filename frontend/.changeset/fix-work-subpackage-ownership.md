---
"yimian-digital-card": patch
---

将编辑上传、头像处理和会员展示的分包专用模块移入 pages-work，避免小程序主包包含只被分包使用的 JS；同步启用微信组件按需注入及 WXML/WXSS 上传压缩。

开发和构建入口在 uni CLI 读取清单前完成配置生成，修复首次构建可能缓存旧 manifest.json 的问题。
