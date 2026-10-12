# 微信云开发后端

已按[微信云开发初始化文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloud/guide/init.html)迁移。

- 小程序 AppID：`wx0ea087f9c508f86f`
- 云开发环境：`cloud1-d5g9aguo13adf0f36`
- 云函数名称：`digitalCard`
- 前端 `App.vue` 启动时执行一次 `wx.cloud.init({ env })`；接口通过 `wx.cloud.callFunction` 调用。
- 云函数独立执行 `cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })`。每次处理微信登录时读取 `cloud.getWXContext()`，不接受客户端传来的 OPENID 或用户 ID。
- H5 使用 `backend/src/gateway.mjs` 转发到同一云函数。新启动入口不读写 SQLite，不回退到本地注册。

## 首次部署

1. 在项目根目录运行 `npm run cloud:prepare`、`npm run dev:mp`。在微信开发者工具中导入 **DigitalCard 根目录**，选择上述云环境。根目录配置同时包含 `miniprogramRoot` 和 `cloudfunctionRoot`；仅导入 frontend 或编译输出目录无法管理旁边的云函数。
2. 在云数据库创建以下集合：`users`、`identities`、`usernames`、`credentials`、`sessions`、`cards`、`favorites`、`views`、`messages`、`media`、`uploads`、`rate_limits`。可以手动创建，也可配置服务端凭证后运行 `npm run cloud:setup`。
3. **每一个集合**都应用 `cloudfunctions/database.rules.json`：客户端读写均为 false。所有查询和写入经过云函数鉴权，不能把 credentials、sessions 改成「所有用户可读」。服务器 SDK 具有管理权限。
4. 云存储应用 `cloudfunctions/storage.rules.json`：客户端禁止读，只允许微信用户写自己拥有的文件。小程序上传到 `staging/<OPENID>/<随机编号>`；云函数校验真实文件格式、大小和上传凭证后复制到 `media/`。最终文件由服务端创建，客户端不能覆盖。上线前在微信工具中确认新建 staging 文件可上传、其他用户的 staging 文件及服务端 media 文件不可修改。
5. 创建查询索引（除唯一 `_id` 索引外）：

   | 集合 | 索引字段与方向 |
   | --- | --- |
   | favorites | userId 升序、createdAt 降序、_id 升序 |
   | favorites | cardId 升序 |
   | views | cardId 升序、day 升序 |
   | messages | cardId 升序、createdAt 降序、_id 升序 |

   为 `sessions.expiresOn`、`uploads.expiresOn`、`rate_limits.expiresAt` 创建 TTL 索引，过期后自动清理。即使 TTL 清理有延迟，接口仍严格检查会话和上传凭证有效期。
   TTL 只清理数据库记录；用户放弃上传可能留下 staging 文件，需要通过存储控制台定期清理过期 staging 文件。已经提交的最终 media 文件不能跟随这个清理规则删除。
6. 右键 `cloudfunctions/digitalCard` →「上传并部署：云端安装依赖」。配置 Node.js **18 或更高**、内存 **512 MB 或更高**、超时 **60 秒**。`config.json` 已声明 `wxacode.getUnlimited` 权限；不要为此函数开启匿名 HTTP 触发器。
7. 云函数环境变量：`WECHAT_APP_ID=wx0ea087f9c508f86f`、`WECHAT_ENV_VERSION=develop`，`PUBLIC_WEB_URL` 为实际 H5 地址。发布时 envVersion 改为 `release`；正式版要求 `pages/card/card` 已发布。云函数不需要 AppSecret。
8. 小程序重新编译，验证微信直接注册、同一微信直接登录、退出后不自动登录、编辑与上传、公开分享、收藏和留言；确认旧密码接口返回 403。正式构建 `npm run build:mp`；发布时修改 project.config.json 的 miniprogramRoot 为 `frontend/dist/build/mp-weixin/`，或导入该输出目录。

## 名片夹容量更新部署（2026-10-11）

02:03:06（北京时间）已将名片夹规则更新到 `cloud1-d5g9aguo13adf0f36` 的 `digitalCard`：普通用户最多收藏 10 张，有效 VIP 最多 50 张。普通用户可查看、搜索和取消收藏，VIP 到期后保留已有收藏，新增按 10 张上限校验；不可用名片提供不含正文的编号，供收藏者取消并释放容量。

此次使用 CloudBase CLI `fn code update digitalCard` 更新现有函数，状态为 Active。远端回下载的 9 个源码与配置文件全部与本地 SHA-256 一致；与部署前相比仅 `membership.mjs`、`service.mjs` 发生变化。Nodejs20.19、512 MB、60 秒、入口、环境变量、角色及触发器配置均核验未变。无需迁移数据或新增集合。

部署前完整函数备份、更新回执、远端源码与哈希验证保存在 `artifacts/favorites-deploy-2026-10-11/`。本次更新范围为云函数，小程序前端需使用包含 10/50 张容量说明与普通用户收藏入口的新版构建。

部署后真实云端验收 7/7 通过：普通用户与 VIP 均可读取名片夹；从 9/49 张分别并发添加两张时只允许一个请求成功，最终保持 10/50 张；第 11/51 张返回 403；满额重复收藏幂等；不可用收藏可取消并释放名额；VIP 到期保留已有收藏，可查看和取消，新增恢复 10 张上限。验收使用管理员创建的独立临时身份，未测试真实微信授权流程。所有临时用户、身份、名片、会话、收藏及限定范围的浏览记录均已精确清理并复查零残留，正常限流记录交由既有 TTL 清理。脱敏结果见 `favorites-20261011-8dab26d63616cbcb-report.json`。

## 此前部署记录（2026-10-11）

本轮修复已更新到 `cloud1-d5g9aguo13adf0f36` 的 `digitalCard`，函数状态 Active。回下载的 9 个源码和配置文件与本地修复版 SHA-256 完全一致；Nodejs20.19、512 MB、60 秒、环境变量和无 HTTP 触发器配置保持不变。更新前完整代码已备份到 `artifacts/cloud-release-2026-10-11/function-backup/`。

微信小程序生产构建 `frontend/dist/build/mp-weixin` 最初上传为开发版 `1.0.20261011`，随后已更新为代码质量修复版 `1.0.20261011.1`；尚未提交审核或发布正式版。

该生产构建也已在现有微信模拟器中实际运行：首页、账号页、健康检查、微信登录、账号读取、退出和数据库客户端禁读验证通过。验证临时切换了项目的 miniprogramRoot，结束后已按原始字节恢复配置并重新编译；没有修改用户存储的登录态和名片。

部署前本地 200 项测试、类型检查、lint 和两端构建通过。部署后真实云端 10 组验收通过：并发保存及重新读取、真实 PNG 上传和提交、HTTPS 签名链接下载与字节比对、公开/隐藏/私密媒体、跨账号访问拒绝、旧密码接口停用、伪造微信身份拒绝和退出会话失效。独立测试账号与其数据库记录、上传文件已精确清理并复查。微信开发者工具中的真实微信登录、账号读取、退出及客户端禁止读取 credentials 集合也已通过。

微信工具重新部署后又执行了一轮独立的真实云端验收，10/10 组通过；该轮临时记录与文件也已清理复查，原数据聚合数量不变。

**小程序码权限已修复**：真实微信调用曾返回 500，云日志定位为 `-604101 function has no permission to call this API`。`config.json` 已包含 `wxacode.getUnlimited`，但 CloudBase CLI 代码更新不会登记微信平台侧 OpenAPI 权限。微信工具完整部署返回成功后，等待约 10 分钟仍失败；检查安装工具源码发现权限请求使用默认 AppID，而旧版公开 CLI 在显式传入 `--appid` 时会先同步该身份。通过以下公开命令仅增量更新权限配置后，真实微信请求立即成功：

```powershell
& 'D:\微信web开发者工具\cli.bat' cloud functions inc-deploy --env cloud1-d5g9aguo13adf0f36 --path 'D:\WorkSpace\DigitalCard\cloudfunctions\digitalCard' --file config.json --appid wx0ea087f9c508f86f
```

01:27 的生产构建最终验收 `allChecksPassed=true`：小程序码返回成功，并通过 `wx.getImageInfo` 实际解码为 430×430；临时图片已删除、测试会话已注销、项目配置已按原始字节恢复。最终云函数为 Active，运行配置保持不变，9 个源码和配置文件哈希仍与本地一致。此次修复没有更换 SDK、修改二维码业务参数或重新创建函数。安装工具源码和执行证据保存在 `artifacts/cloud-release-2026-10-11/wechat-permission-result-review.txt` 及 `wechat-legacy-inc-deploy-summary.json`。

用户明确本轮只部署小程序，H5 不在此次发布范围内。当前环境没有 H5 网站首页、HTTP 网关路由或 Cloud Run 服务，`PUBLIC_WEB_URL` 保留原有本地地址；此次未新建计费服务。

脱敏验收结果、源码哈希、微信开发版上传结果及权限诊断保存在 `artifacts/cloud-release-2026-10-11/`。真实微信开发者工具验收不等同于手机真机验收。

后续根据主包未使用 JS 和组件按需注入两张质量截图完成修复：仅分包使用的媒体上传、头像处理和会员展示模块移入 `pages-work`，保留主包页面实际使用的 `accountApi` 并重建旧开发产物；启用 `requiredComponents` 和 WXML/WXSS 压缩。构建入口增加清单前置生成，避免 uni CLI 在配置插件执行前缓存旧 `manifest.json`。

该轮前端 99 项测试、类型检查、lint、H5 与小程序构建通过；官方代码质量扫描开发包和生产包各 11/11 通过，依赖分析无错误。微信开发者工具中 7 个页面路由加载成功，前 4 页核验可见标题，没有模块或语法错误；当前未登录，未进行选图、上传、保存或完整认证业务流程。临时生产目录切换已恢复，开发包重新编译后首页及按需注入配置正常。开发版 `1.0.20261011.1` 上传回执成功，完整记录在 `artifacts/package-check-2026-10-11/report.txt`，云函数本轮无改动。

## 历史部署记录（2026-10-10）

`digitalCard` 已部署到 `cloud1-d5g9aguo13adf0f36`，远端状态 Active，运行环境 Nodejs20.19、内存 512 MB、超时 60 秒。环境变量已配置上述 AppID、develop 和本地 H5 地址；没有 HTTP 触发器。

12 个集合已创建，全部应用客户端禁止读写的自定义规则。4 个查询索引及 sessions.expiresOn / uploads.expiresOn / rate_limits.expiresAt 的 TTL 索引已创建。

当前微信体验版拒绝自定义存储规则（OperationDenied.FreePackageDenied），因此保留基础 PRIVATE 权限：仅创建者和管理员可读写。上传 staging 的微信用户可读取自己的暂存文件；最终 media 文件由云函数创建，客户端不能覆盖。实际小程序上传、提交和尝试覆盖最终文件已经验证；客户端读取 credentials 集合也实际返回权限拒绝。未升级套餐。

当时的真实云端版本已验证注册、密码登录、密码错误拒绝、名片保存与公开读取、收藏、留言、退出会话失效、媒体格式检查、服务端复制、HTTPS 临时链接及公开名片媒体。微信模拟器通过 wx.cloud.callFunction 调用健康接口成功，并完整验证图片上传。测试数据已清理。云端代码回归测试 17 项通过。此为历史部署记录，当前代码已改为仅微信注册和登录，旧密码流程不再开放。

**当时未通过，已于 2026-10-11 修复**：微信小程序码生成。当时通过微信开发者工具部署 config.json 后小程序实际调用仍返回错误；手动云端调用记录为 INVALID_WX_ACCESS_TOKEN（-501001，手动调用没有微信客户端上下文）。后续在真实微信请求中定位到权限错误 -604101，并按上方当前部署记录修复、验证通过。网页二维码和分享链接与此独立。

H5 网关仍需要配置服务端凭证，当前本地网页未因此自动获得云端调用权限。原 SQLite 账号和资料尚未导入云端。

根目录 cloudbaserc.json 保存运行版本、资源规格和环境变量。通过腾讯 CloudBase CLI 重新创建函数后，还必须通过微信开发者工具上传一次，以应用 config.json 的微信 OpenAPI 权限。CLI 配置更新可能报告运行版本已更新，但旧函数的运行版本仍保持原值；升级版本后需读取远端配置确认。

## 首页与保存的事务冲突修复（2026-10-10）

云端日志确认首页并发请求可能在更新限流记录时触发 `DATABASE_TRANSACTION_CONFLICT`。微信 SDK 会把该错误包装成 `errCode: -501001`，导致底层按原始 `error.code` 识别的自动重试失效。仓储层现禁用底层重试，由应用在失败回滚后创建新事务，采用指数退避和随机间隔，最多重试 5 次。仅明确的事务冲突重试，鉴权、校验、权限及普通系统错误直接返回；限流额度不变。

首页合并重叠加载请求，统计失败只显示统计区域的重试提示，不阻断名片展示，也不把缺失统计显示为零。获取媒体临时链接失败时仍返回名片与 `mediaUnavailable: true`，前端提示图片暂时无法加载；已提交的保存正常返回成功。该标记只存在于响应，不保存到名片正文。事务重试耗尽返回 503「请求暂时繁忙，请稍后重试」，服务端日志记录接口路径、方法和错误码。

已通过真实云端三轮并发首页读取、名片保存与保存后读取验证；验证使用独立临时账号。云端回归测试 23 项通过，前端类型、测试、lint 与小程序构建通过。

## VIP 会员管理

会员功能需先部署最新 `digitalCard` 云函数，再发布前端。现有 `users` 集合增加 `membership:{plan,expiresAt}`，不需要新集合或放宽权限。新账号和没有会员字段的历史账号默认免费；历史高级名片资料保留在数据库，免费时只对外展示基础简约版，续期开通后恢复。

在账号页复制用户的 **账号编号**，使用已有管理员服务端凭证（`backend/.env`）执行：

```powershell
# 查看账号与会员状态
npm run cloud:membership -- status --user-id <账号编号>
# 预览长期 VIP 开通结果，不写入
npm run cloud:membership -- grant --user-id <账号编号>
# 确认目标账号后开通长期 VIP
npm run cloud:membership -- grant --user-id <账号编号> --apply
# 开通至指定时间（必须携带时区；此例为北京时间）
npm run cloud:membership -- grant --user-id <账号编号> --expires-at 2027-10-11T23:59:59+08:00 --apply
# 撤销会员，恢复免费版；名片高级内容不删除
npm run cloud:membership -- revoke --user-id <账号编号> --apply
```

脚本校验用户存在和有效期，在事务内更新会员字段。开通/撤销省略 `--apply` 时仅显示预期变更。脚本只修改会员信息，不提供支付或公开开通接口，也不修改名片资料。用户无需退出登录，进入账号页点击「刷新会员状态」，返回编辑页即可使用最新权益。会员过期按云端时间实时生效，上传预约和提交均重新校验。

免费版包含基础资料、头像、联系方式、固定简约名片及分享，名片夹最多收藏 10 张；VIP 名片夹最多收藏 50 张，另包含所有模板、图文视频、多页面编排、私密留言和数据统计。名片夹的查看、搜索与取消收藏对所有账号开放，新增收藏由云端按当前有效会员状态校验容量。会员到期或撤销不删除已有收藏，超出普通用户上限时仍可查看和取消，但需降至 10 张以下或续期后才能新增。第三方媒体直链由托管方控制；云端已签发的临时地址最多仍可访问五分钟。会员变更不删除已保存的留言或统计。

## H5 网关

```powershell
Copy-Item backend/.env.example backend/.env
```

在 **backend/.env** 填写具有当前环境访问权限的腾讯云服务端 `TCB_SECRET_ID`、`TCB_SECRET_KEY`；临时凭证还需 `TCB_SESSION_TOKEN`。这些不是小程序 AppSecret，不能写入前端。服务端托管时可用受限的临时凭证；配置 CORS 只允许实际 H5 域名。

```powershell
npm --prefix backend ci
npm run dev:api
npm run dev:web
```

H5 开发环境默认访问 `http://localhost:3000/api`，真实数据全部在云端。H5 可预览公开名片，账号注册和登录需在微信小程序中完成；网关服务端凭证不能替代用户的微信可信身份。未填写服务端凭证时数据接口明确返回 503，网页会显示配置提示。

H5 生产构建默认访问同域 `/api`。部署时通过 HTTPS 提供 H5，将 `/api/` 原路径反向代理到后端网关；例如 Nginx 的 `location /api/ { proxy_pass http://127.0.0.1:3000; }`。该代理规则需优先于前端静态文件的回退规则，不能将 API 请求回退到 `index.html`。后端仍需配置上述服务端凭证。

若前后端使用不同域名，在 `frontend/env/.env.production.local` 配置 `VITE_SERVER_BASEURL=https://实际网关域名/api`，同时将 H5 域名加入后端 CORS 配置，然后重新运行 `npm run build:web`。正式 H5 构建会拒绝 localhost、回环地址、非 HTTPS 的独立网关以及无效 API 路径，避免发布仍请求访客本机的产物；开发环境和微信小程序构建不受该检查影响。

## 已有账号和数据迁移

原 `backend/data/digital-card.sqlite` 和媒体目录保持不变。迁移前备份两者并停止旧后端写入，云端集合必须为空；不要同时开放云端注册。

```powershell
# 在项目根目录运行；默认只读预检，不需要云凭证
npm run cloud:migrate
# 首次部署已创建空集合并填写服务端凭证后，执行一次性导入
npm run cloud:migrate -- --apply
```

支持通过环境变量 DATABASE_PATH / MEDIA_DIRECTORY 指定旧文件路径。保留用户、名片、媒体编号、用户名、密码哈希、收藏、留言和统计；只迁移正式密码账号及微信账号，排除未绑定的体验账号和示例账号。用户名密码入口已停用，迁移保留历史凭证并不恢复密码登录；已关联的微信身份可继续访问原资料，纯密码账号需另行确认归属后迁移到微信身份。SQLite/JWT 登录凭证不会迁移。导入先验证所有源文件，数据库写入使用一次事务，失败时清理本次上传的文件；目标集合非空时停止，避免覆盖新数据。大量数据应另做分批迁移设计，不能无限扩大一次事务。

## 数据和权限

注册和登录仅通过微信可信上下文，微信身份映射与账户创建使用数据库事务。历史用户名和密码哈希保留，注册、密码登录、绑定和改密接口均已停用。登录 token 仅返回客户端，云数据库保存其 SHA-256 摘要。会话有效期 7 天，主动退出删除该会话；前端退出后不会自动恢复登录。体验登录持续禁用。

媒体正文仍保存 `/api/media/<编号>`，因此旧名片不用改链接。云函数验证归属或名片公开状态后返回 **5 分钟**的 HTTPS 临时链接，原始云存储 fileID 不返回访客。隐藏模块、私密名片不能取得新的链接；已签发链接在最长 5 分钟内仍可能有效。长时间停留后媒体链接到期，需要刷新页面重新取得链接。不要把临时地址作为持久资料写回名片。

云函数通过上下文 OPENID/CLIENTIP（H5 则由网关传入真实 IP）对调用频率限流，使用北京时间日期去重访客统计。数据库和存储规则需要真实环境验证，不能只依赖前端隐藏按钮。

旧 `backend/src/app.mjs` / SQLite 相关文件仅供旧接口回归测试和迁移参考，`src/server.mjs` 运行的是云网关。自动化浏览器测试保留独立示例服务器，数据在临时目录，前端测试环境显式使用 http 模式；实际项目默认 cloud 模式。

## 验证

若普通预览二维码正常，而开发者工具的“真机调试”在二维码出现前卡在“等待进程”，先检查本机开发者工具的调试运行环境。2026-10-10 本机在 2.02.2608080 上遇到此现象；清理编译缓存、重开项目和完整重启均未确认恢复，升级至官方 Nightly 2.02.2610092 后，用户确认真机调试二维码已出现。该记录只说明本次环境的处理结果；消息日志中的 `not ready` 可能是在等待手机连接，不能单独判定二维码生成失败。

```powershell
npm run test:cloud
npm run test:api
pnpm --dir frontend type-check
pnpm --dir frontend lint
pnpm --dir frontend test:run
npm run build:mp
npm run build:web
```

官方最新 wx-server-sdk / CloudBase SDK 的传递依赖仍有 npm audit 告警（包括 lodash.set/unset）。应用只将严格校验后的数据传入写入接口，不接受客户端数据库查询对象。后续升级应检查上游修复情况；不要用 audit --force 降级官方 SDK。
