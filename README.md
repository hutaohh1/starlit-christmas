# 星愿圣诞

全屏 3D 粒子圣诞树，参考提供视频中的金色树形、螺旋灯带、飘雪、粒子聚散和照片回忆交互，独立实现。

## 三个网页

运行后在本机打开：

- 初雪 V1：http://localhost:5173/version-1.html — 最初的明亮金色粒子与柔光。
- 星芒 V2：http://localhost:5173/version-2.html — 细腻粒子、星芒与更克制的泛光。
- 光影 V3：http://localhost:5173/version-3.html — 冷暖灯光、柔和阴影、雪地反光。
- 默认首页：http://localhost:5173/ — 光影 V3。

页面左上角可以直接切换三个版本；三版共享照片，并分别加载自己的灯光、粒子与材质参数。

## 启动

```powershell
npm install
npm run setup:vision
npm run dev
```

`public/vision` 已包含手势识别所需的模型和 WASM，下载完成后运行时不依赖外部 CDN。`setup:vision` 供重新安装或缺失文件时使用。

也可以双击 `启动圣诞树.cmd`。保留终端窗口即可持续访问网页。不要直接通过 file:// 打开 HTML。

## 操作

- 点击「开启手势魔法」并允许摄像头；握拳聚合，张掌散开，食指指向照片，出现亮框后轻捏拇指和食指打开；捏合确认期间会锁定该照片，松开后可再选下一张。相框保持原尺寸。
- 鼠标拖动或单指拖动旋转，滚轮或双指捏合缩放。
- 底部三个按钮切换圣诞树、星河、回忆模式；点击 3D 相框查看大图。
- 空格切换聚散，H 隐藏 / 显示界面；照片弹窗内左右方向键切换，Esc 关闭。
- 「挂上我的照片」支持 JPG、PNG、WebP、AVIF，每张小于 20 MB，最多保留 24 张自选照片；会缩小后存入当前浏览器的 IndexedDB。
- 打开自己上传的照片后，点击「摘下这张照片」可以从场景和本机保存记录中移除；不会修改原始图片文件。六张默认插画会保留。
- 右上角可播放本地音乐、调整雪花与旋转、切换三种配色及调整光亮。手势圆环为淡色提示，顶部浮动手势说明已移除。

摄像头只在主动点击后开启，关闭时释放摄像头。摄像头画面与照片只在浏览器本机处理，没有上传接口。摄像头需要 localhost 或 HTTPS；从手机访问局域网 HTTP 地址可赏树和触屏操作，开启手机手势需部署至 HTTPS。

默认的 6 张冬日插画使用用户指定的 game-creator 生成，WebP 文件位于 `public/postcards`，原图与提示词位于 `artwork`。手势与渲染所需资源都通过本地服务器提供，无远程照片依赖。

## 验证与打包

```powershell
npm test
npm run build
npm run preview
```

测试覆盖树形边界、星河范围、螺旋连续性、握拳 / 张掌 / 捏合分类、捏合阈值滞回与稳定时间。摄像头中的真实识别精度受光线、遮挡、镜头视角影响。`dist` 中包含三个版本的静态网页及本地手势模型，可以部署至静态托管。

## 参考与依赖

- Three.js（MIT）：https://github.com/mrdoob/three.js
- MediaPipe（Apache-2.0）：https://github.com/google-ai-edge/mediapipe
- 接口文档：https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js
- GitHub 交互参考（MIT）：https://github.com/electronicminer/gesture-Christmas_tree-3d_with_photo

场景代码独立实现；默认插画由 game-creator 生成。未复制参考仓库的场景代码或照片。第三方依赖及模型的授权由各自发行方提供。

## 本地音乐

播放器使用原生 Audio，始终启用 `loop`，没有循环开关，不依赖 YouTube 或外部播放器。已接入用户新提供视频 `c9a87edad1001939447e5c6137aa2274.mp4` 中的音频。音频原长约 3 分 21 秒，经过 0.9 秒首尾交叉淡化与响度整理，网页成品约 3 分 20 秒。

本地成品为 `public/music/taylor-swift-last-christmas.ogg`，同时保留 MP3 兼容文件，三版直接共用，播放时不访问外部音源。也可以在网页内选择本机音频：文件会保存在当前浏览器的 IndexedDB，三版共用，下次点击播放即可继续使用。浏览器首次有声播放需要点击播放。

交互测试 `tests/interaction.test.js` 覆盖捏合不跳点、确认锁定、松开重新触发、丢手保护；`tests/music.test.js` 覆盖默认循环、暂停和加载取消、文件缺失和自动播放限制。`tests/browser.html` 是本地浏览器验证页，检查照片存储移除、六张图片解码和实际音频循环（使用静音测试素材）。

## GitHub Pages 发布

网站使用相对资源路径，支持 GitHub Pages 项目子目录。六张默认插画、循环音频、手势识别模型和 WASM 随网页一起发布。

首次发布需要为当前仓库开启 GitHub Pages，并选择 `gh-pages` 分支的根目录。之后更新：

```powershell
npm test
npm run deploy
```

`deploy` 会重新构建并推送静态成品到 `gh-pages` 分支；源代码保留在 `main` 分支。它使用当前 Git 的登录和作者配置，不包含任何访问令牌。
