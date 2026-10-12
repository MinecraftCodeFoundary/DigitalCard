# 请求层规范（数字名片）

本项目已将模板示例认证链路替换为数字名片 API。

- 业务页面只调用共享 `src/api/` 或所属分包 `api/` 中的接口封装，JSON 请求统一经过 `src/http/index.ts`，不直接调用 `uni.request`。
- HTTP 封装负责基准 URL、Bearer token、12 秒超时、业务信封验证及错误归一。
- API 返回值经过 `src/http/validators.ts` 验证结构后才进入 UI。
- 错误为 `HttpError`，包括 `status`。401 自动清除过期 token，界面提供重新登录/重试。
- 认证为七天单 token；仅提供微信直接注册与登录，首次授权自动创建账号与私密名片，再次授权恢复原账号，不接受前端指定用户 ID。默认 `VITE_LOGIN_MODE=wechat`，需主动点击授权；`demo` 仅用于隔离自动化测试。用户名密码注册、登录、绑定与改密接口已停用，历史账号数据保留，旧会话需重新微信登录。
- 账号入口位于 `pages-work/account/account.vue`，账号信息和退出接口封装为 `src/api/account.ts`，微信登录在 `src/api/card.ts`。`session.applyLogin` 统一应用登录结果；主动退出调用服务端注销接口后 `session.logout`，禁止自动恢复。微信账号过期不会回退为体验账号，主动微信授权也不会走体验登录；旧请求的 401 不会清除新登录 token。H5 提示在微信小程序中完成注册或登录。
- `ensureSession` 合并并发登录请求；API 是名片资料和统计的唯一事实源。
- 环境变量配置在 `env/`，密钥只保存在后端。
- 实际项目默认 `VITE_BACKEND_MODE=cloud`：微信端由 App.vue 启动时初始化一次 wx.cloud，请求层调用 digitalCard 云函数；H5 通过 Fastify 云网关访问相同云函数。云端会话保存 token 摘要，账号和业务数据在云数据库，媒体在云存储。仅隔离的旧接口回归测试使用 http 模式。
- 微信媒体先调用 `/media/reserve`，使用 wx.cloud.uploadFile 上传 staging，再调用 `/media/commit` 校验并复制到服务端文件。响应中的 HTTPS 临时预览地址进入 mediaAccess，正文只保存持久媒体编号；临时地址最长五分钟，刷新页面可重新取得。
- 媒体上传走 `src/pages-work/api/media.ts` → `src/pages-work/http/upload.ts`，仅编辑分包使用的代码随分包加载；共享请求、云初始化和响应校验保留在 `src/http/`。H5 使用 uni.uploadFile、Bearer token、120 秒超时及进度回调，微信使用云存储流程。成功信封经过 `parseMediaUpload` 校验。模块只保存持久媒体 URL，临时签名预览地址保留在页面状态中。
