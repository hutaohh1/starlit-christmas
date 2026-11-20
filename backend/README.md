# 共享照片：GitHub 存储 + Cloudflare 上传接口

目标操作：访客点击网页「挂上我的照片」→ 选图 → 图片写入 GitHub → 其他访客约 30 秒内自动看到。访客不需要 GitHub 账号。

## 当前状态

- 仓库：hutaohh1/starlit-christmas。
- 网页：GitHub Pages，gh-pages 分支。
- 照片和 photos.json：album 分支。代码和手势等资源：main 分支。
- 共享上传已开通：https://starlit-christmas-album.starlit-christmas.workers.dev。
- 本仓库专用 GitHub 写入令牌存于 Cloudflare 加密 secret。自动测试覆盖多人同时上传、权限、删除、错误处理。
- `public/shared-config.json` 的 apiUrl 为空时，共享写入尚未开通。网页会明确提示「仅保存在本机」，不会声称已共享。

## 重新部署或迁移时的一次性开通

在项目目录运行：

```powershell
node backend/setup.mjs
```

脚本会依次：

1. 打开 Cloudflare 登录，使用你自己的账号。
2. 提示输入 GitHub fine-grained token。创建时仅选择本仓库，只授予 Contents: Read and write。不要使用包含其他仓库权限的令牌，也不要把令牌发在聊天、写入源文件或网页。
3. 将令牌安全保存为 Worker 的 GITHUB_TOKEN secret，再部署 Worker。
4. 输入命令输出的 HTTPS workers.dev 地址，检查接口并更新网页、推送代码。

GitHub 创建令牌入口：
https://github.com/settings/personal-access-tokens/new?name=Christmas%20photo%20album&description=Upload%20photos%20to%20starlit-christmas%20only&target_name=hutaohh1&contents=write

ALLOWED_ORIGINS 只允许 GitHub Pages 和本机开发端口。生产无需额外数据库、云图片存储或 GitHub Actions。

## 运行行为

- 图片在浏览器缩小成最长 1200px 的 JPEG，上传接口只接受最多 1MiB 的 JPEG。拍摄元数据在 Canvas 转换时移除。
- 图片写入和清单更新在同一个 Git commit 中完成。多人同时写入时重新读取分支并重试，避免覆盖别人上传的照片。
- 每个 IP 每分钟最多 5 次写入操作，树上最多 64 张共享照片，每次最多选 5 张。接口不能写入任意路径。
- 随机照片凭证只留在上传者浏览器，仓库只保存其 SHA-256 摘要。上传者只能摘下自己上传的共享照片。清除浏览器数据或更换浏览器会失去这个删除凭证。
- 网站主人可以在 GitHub 编辑 album/photos.json 移除记录，再删除对应图片；如设置 ADMIN_KEY，也可以用管理接口 DELETE /photos/{id}，Authorization: Bearer <ADMIN_KEY>。管理密钥不得放进网页。
- 图片公开，所有访客可查看。删除只移除当前分支记录，Git 历史和已有缓存可能仍包含文件。
- `npm run deploy` 只更新 gh-pages，不覆盖 album 中的访客照片。
- 云端接口不可用时不会把本机保存误报成共享成功。
- 仓库及 Worker 的托管配额、存储与请求限制由服务方决定；令牌到期后需要更新 secret。

## 检查

```powershell
npm test
npx wrangler deploy --dry-run --config backend/wrangler.jsonc
```

开通后，在浏览器 A 挂一张照片，在浏览器 B 打开网页等待自动同步。B 可看照片且不能摘下 A 的照片；A 可摘下，其他页面随后同步。
