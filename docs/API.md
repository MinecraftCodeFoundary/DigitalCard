# API 约定

基地址 `/api`。成功返回 `{ "code": 0, "data": ... }`，错误返回 `{ "code": HTTP状态码, "message": "可展示的消息" }`。微信端调用 digitalCard 云函数，传入 `{path:"/api/路径",method,data,token}`；H5 网关使用 `Authorization: Bearer <token>`。会话有效期七天，数据存储在云数据库。保存操作只定位当前用户的名片，不接收 ownerId。

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| GET | `/health` | 无 | 服务状态及体验登录开关 |
| POST | `/auth/dev` | 仅自动化测试 | 正常运行时关闭并返回 403，不作为账号入口 |
| POST | `/auth/wechat` | 微信可信上下文 | 身份来自 cloud.getWXContext()，首次创建空白私密名片，再次恢复同一账号，无需 code 或 AppSecret |
| POST | `/auth/register` | 已停用 | 返回 403，请使用微信直接注册 |
| POST | `/auth/login` | 已停用 | 返回 403，请使用微信直接登录 |
| POST | `/auth/logout` | 必须 | 注销当前 token，返回 `{loggedOut:true}` |
| GET | `/me/account` | 必须 | `{id,mode,createdAt,membership}`，会员状态由服务端计算 |
| POST | `/me/account` | 已停用 | 返回 403，不再绑定用户名和密码 |
| PUT | `/me/account/password` | 已停用 | 返回 403，不再提供修改密码 |
| GET | `/me/card` | 必须 | 自己的名片 |
| PUT | `/me/card` | 必须 | VIP 完整保存；免费仅保存基础资料，保留数据库内高级设置 |
| GET | `/cards/:id` | 可选 | 公开详情，返回 isOwner、isFavorite；记录匿名访问 |
| GET | `/cards/:id/qr?mode=web` | 可选 | PNG 数据 URL、分享链接；mode=wechat 返回小程序码 |
| PUT | `/cards/:id/favorite` | 必须 | 幂等收藏；普通用户最多 10 张，VIP 最多 50 张 |
| DELETE | `/cards/:id/favorite` | 必须 | 幂等取消收藏 |
| GET | `/favorites?page=1&pageSize=20&search=` | 必须 | 名片夹分页及搜索；会员到期仍可读取已有收藏 |
| GET | `/me/stats` | VIP | 自己名片的浏览、收藏及七天趋势 |
| GET | `/me/messages` | VIP | 本人收到的私密留言 |
| POST | `/cards/:id/messages` | 主人须为 VIP | 公开名片接受访客留言，不要求访客开通会员 |
| POST | `/media` | VIP | multipart 的单个 `file` 文件，返回 `{url,kind,size,previewUrl?,mediaUnavailable?}` |
| POST | `/media/reserve` | VIP | 微信端取得 `{id,cloudPath}`，上传 staging |
| POST | `/media/commit` | VIP | `{id,fileID}`，校验实际内容并返回 `{url,kind,size,previewUrl?,mediaUnavailable?}` |
| GET | `/media/:id` | 主人为 VIP，且公开可见或本人 | 云函数返回临时 HTTPS URL，H5 网关重定向；Range 由存储服务处理 |

账号相关接口每调用身份每分钟最多 10 次。正式注册与登录仅接受匹配 AppID 的微信可信上下文，不接受客户端提交的 OPENID 或用户 ID。H5 不能取得小程序微信上下文，账号页面会提示在微信小程序中操作；旧密码注册、登录、绑定和改密接口返回 403。

`account.membership` 为 `{plan:'free'|'vip',expiresAt:null|ISO时间,isVip:boolean}`。`plan` 保留订阅记录，`isVip` 按服务器当前时间计算；`expiresAt:null` 的 VIP 长期有效。新账号及无会员记录的历史账号均为免费。免费调用 VIP 接口返回 403；仅管理员运维脚本可开通或撤销，客户端提交会员字段不能获得权限。

全部名片响应附带主人有效权益 `isVip`。免费/过期名片统一返回 forest 配色、signature 模板、minimal 布局、一个主页以及简介和联系方式两个模块；不返回历史高级模块及其媒体链接。免费可更新基础字段、头像和公开状态，不能修改模板、外观、页面或模块；保存会保留数据库中原高级配置，重新开通后恢复。基础分享、浏览公开名片、联系方式以及名片夹的收藏、搜索、查看与取消收藏无需 VIP。头像内联图片不经过 VIP 媒体上传接口。

名片夹按收藏者的当前有效会员状态限制新增收藏：普通用户（含 VIP 到期或撤销）最多 10 张，有效 VIP 最多 50 张。容量按已保存的收藏关系数计算，私密或已不存在名片的保留关系仍占容量，列表经过公开状态与搜索过滤后的 `total` 不代表实际容量占用。重复收藏已有公开名片仍幂等成功，不额外占用容量；达到上限后新增收藏返回 403，并提示当前容量上限。会员到期不删除已有收藏，即使超过普通用户上限仍可查看、搜索和取消，需将收藏数降至 10 张以下或续期开通后才可继续新增。

免费编辑器使用 `PUT /me/card?mode=basic` 明确只保存基础资料：即使管理员在编辑期间开通了 VIP，这次保存仍保留云端原高级配置。该模式同样校验基础预设，不能用它写入高级内容；其他 `mode` 值会被拒绝。

正常开发及生产环境不提供体验登录，不再接受旧体验账号 token，也不创建示例名片。历史用户名和密码凭证数据保留，但不再作为登录入口；旧密码及未标记微信认证来源的会话返回 401，需重新微信登录。纯密码账号不会自动合并至微信身份。仅显式设置 `buildApp({nodeEnv:'test',demoEnabled:true})` 的隔离测试服务保留示例账号，以验证历史数据兼容性。

微信登录返回 `{token,expiresIn,card,mode,account}`，`mode` 为 `wechat`；旧隔离测试接口支持 demo/devKey。`account` 为 `{id,mode,createdAt,membership}`。同一微信身份沿用现有用户及名片 ID，包括曾绑定密码的微信账号，收藏、媒体、留言和统计保持不变。云数据库保存微信认证来源、会话到期时间和 token 摘要；鉴权检查 `authMethod:'wechat'`、会话有效期及用户微信身份与身份映射的一致性。退出仅删除当前会话，后端重启后继续生效。前端记录主动退出状态，刷新或重新打开页面不会自动登录。

名片字段：`name, title, company, phone, email, wechat, location, bio, avatar, website, tags, theme, published, appearance, sections, pages`。姓名必填，标签最多五个；主题为 `forest/sand/ink`；avatar 为最大 150000 字符的 PNG/JPEG/WebP Base64 图片。只接受上述字段，额外字段会被拒绝。

`sections` 可省略（默认个人简介、联系方式两个模块），也可传空数组。最多 8 个模块，数组顺序即展示顺序。每项包含唯一的 `id`（1–60 位小写字母、数字或连字符）、`type`（`about/contact/text/image/video/link`）、`title`（必填，最多 40 字）、`content`（最多 1000 字）、`visible`（布尔值）。简介与联系方式各最多一个，其内容分别来自 `bio` 及已填写的联系方式；自定义 `text` 模块使用 `content`，按纯文本展示并保留换行。模块显隐是展示设置，API 仍返回原内容。

图片模块使用 `images`（1–6 个地址）及 `imageLayout`（`grid/stack`）；视频模块使用必填 `url` 和可选 `poster`；链接模块使用 HTTP(S) `url` 和可选 `buttonLabel`（最多 30 字）。媒体模块的 `content` 用作说明。地址最大 2000 字，可使用 HTTP(S) 直链或上传后返回的 `/api/media/:id`，不能保存 blob/data/本地文件路径。

`pages` 为 1–6 个页面，数组顺序即分页顺序；每项包含唯一 `id`（格式同模块编号）、`title`（必填，最多 24 字）及 `columns`（数字 `1` 或 `2`），可选 `icon`（`user/company/product/contact/image/video/link`）和 `presentation`（`cards/article`，省略为卡片模块，连续图文不显示模块边框及标题）。省略时默认 `[{id:"main",title:"主页",columns:1}]`。模块可设置 `pageId`（必须属于已有页面，省略时归属第一页）及 `columnSpan`（数字 `1` 或 `2`，分别占一栏或通栏）。切换页面只展示当前页可见模块；页面配置不改变公开/私密及媒体访问权限。删除页面时前端迁移模块归属并一起保存，后端拒绝不存在的页面引用。

上传通过文件实际内容验证类型：JPG、PNG、WebP、GIF 最大 8 MB；MP4、WebM 最大 50 MB。单次只接受一个文件，失败会清理临时文件。保存名片时会核验所引用上传文件的归属和类型。删除模块或图片不会立即删除底层文件，但取消公开或隐藏模块后，未被其他公开可见模块引用的文件访问返回 404。第三方直链的访问由其托管方控制。

媒体提交成功后，即使临时预览地址生成失败，仍返回 `code:0` 和持久媒体 `url`、`kind`、`size`，并设置 `mediaUnavailable:true`、省略 `previewUrl`。客户端保留媒体引用并允许继续保存，不要求重复上传；随后保存或重新读取名片可恢复已授权的预览链接。仅当 `mediaUnavailable:true` 时允许缺失 `previewUrl`，提供的预览地址仍须通过正常校验。同一上传预约仍只能提交一次，预览降级不放宽文件归属和公开权限。

本人、公开详情和名片夹通过 mediaAccess 返回允许访问的媒体 HTTPS 临时地址，最长五分钟；访客只取得公开且可见模块的媒体链接。模块正文只保存 `/api/media/<编号>`，不能把临时链接或 mediaAccess 写回正文。取消公开或隐藏模块后不能取得新链接，已签发链接可能在最长五分钟内仍有效。媒体全部由云存储托管，数据库仅保存 fileID 和归属；访客不取得原始 fileID。

`appearance` 可省略，保存时补齐默认风格；旧名片无需迁移。包含 `layout`（`classic/centered/minimal/portrait`）、`accentColor`（空字符串沿用主题，否则为 `#` 加六位十六进制颜色）、`coverLabel`（最多 32 字）、`coverTitle`（最多 48 字，支持换行）、`wordmark`（最多 24 字）、`avatarShape`（`rounded/circle/square`）、`decoration`（布尔值）、`hiddenFields`（`title/company/location/tags` 数组）。`portrait` 使用人物大图和图标导航，可设置 `coverImage`（上传后的媒体地址或 HTTP(S) 图片链接，最大 2000 字；空或省略使用头像或主题背景）。本地封面必须为本人上传的图片，公开人物主页才允许匿名访问；切换其他布局或取消公开后，没有其他可见模块引用的封面文件返回 404。隐藏字段只控制名片展示，原值仍保留并由 API 返回，不用于限制数据访问。公开详情和名片夹返回相同的外观配置。

详情附带 `id` 和 `updatedAt`；分页返回 `{items,total,page,pageSize}`；名片夹分页另附 `unavailableIds:string[]`，完整列出当前用户收藏中私密或已不存在的名片编号，独立于搜索与分页，不包含名片正文；统计返回 `{views,todayViews,favorites,contacts,days:[{day,views}]}`。

关闭公开后访客详情返回 404，已收藏用户也无法访问，名片正文从其名片夹中隐藏；原收藏关系保留，重新公开后恢复。名片夹通过 `unavailableIds` 显示不含个人资料的不可用占位，用户可直接取消收藏以释放容量。私密名片主人可看详情，但不能生成分享码。访问数按北京时间日期及访客去重，匿名访客按请求 IP 计算，因而H5 同一出口网络的匿名访客可能合并；微信使用云上下文 OPENID。数据库只保存加盐哈希，不保存访问者明文 IP。

云接口按上下文 OPENID/CLIENTIP 或可信网关传入的 IP 每分钟 120 次；账号相关操作每分钟 10 次，媒体提交每账号每分钟 20 次，留言每分钟 5 次，二维码每分钟 15 次。反向代理部署时可按受信代理范围配置 Fastify `trustProxy`，默认未信任客户端转发头。

完整环境部署、规则和迁移步骤见 [CloudDevelopment.md](CloudDevelopment.md)。

