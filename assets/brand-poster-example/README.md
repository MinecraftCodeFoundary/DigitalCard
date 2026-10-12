# 瑞植医疗品牌海报名片示例

这是当前数字名片项目里的可编辑示例。品牌、人物身份和联系方式为虚构演示内容。
姓名、文案、三列主营业务和服务介绍由现有 Vue / uni-app 组件渲染，图片只是单独的配图素材。

## 当前预览

http://localhost:9000/#/pages/card/card?id=bb81533dc919120d07b7f045

页面中的「编辑我的名片」可继续修改内容、替换图片和调整排版。
留言继续沿用项目现有权限，仅名片主人可查看。

## 文件

- `card.template.json`：可复用的完整文案与排版，图片文件名是占位符。
- `card.saved.json`：当前已经保存的名片数据，图片引用本机后端媒体接口。
- `portrait.png`：透明背景的西装人物半身照。
- `business-materials.png`、`business-implant.png`、`business-channel.png`：统一风格的主营业务配图。
- `prompts.json`：内置 image_gen 的素材生成与人物裁剪提示词。

这些素材存放在项目根目录，不会被打入小程序包。应用示例时，经项目正常上传接口存入后端媒体目录。

## 本地应用与恢复

仅用于当前开发环境的体验账号。每次应用或恢复前，脚本会将旧名片完整保存到 `artifacts/brand-poster-backups`，不删除旧媒体或留言。

```powershell
node backend/scripts/apply-brand-poster-example.mjs --card bb81533dc919120d07b7f045
```

恢复本次编辑前的 UNFOLD 名片：

```powershell
node backend/scripts/apply-brand-poster-example.mjs --card bb81533dc919120d07b7f045 --restore artifacts/brand-poster-backups/bb81533dc919120d07b7f045-2026-10-10T09-53-44-023Z.json
```

换用其他本地体验名片时，替换 `--card` 的编号。脚本不更新正式微信账号，也不改变名片原有的公开设置。
