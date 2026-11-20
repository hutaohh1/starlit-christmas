# 星愿圣诞 · 设计与参考

以用户给出的 45 秒视频为视觉依据：金色粒子圆锥树、明亮五角星、环绕灯带、暗夜飘雪、圆形雪地，粒子散开时出现相框。

页面是全屏互动装置。圣诞树占据主要视野，左上角为衬线英文祝词与简短中文提示，底部为聚合 / 散开 / 回忆三种模式，右侧只保留必要工具。手机将祝词缩小并置于顶部，树保持完整。

配色：深夜 #070d15，松绿 #294835，香槟金 #e4c98e，雪白 #f9f1d8，浆果红 #9c3340。
字体：Georgia / Times New Roman 作为节日祝词，微软雅黑与系统无衬线字体作为中文控件。场景的金色螺旋与粒子星芒是唯一视觉主角。

实现：Three.js 自定义粒子着色器 + UnrealBloomPass；MediaPipe Hand Landmarker 本地推理；握拳聚合、张掌散开、拇指食指捏合聚焦照片。支持拖拽、触屏、按钮与键盘。

参考（研究交互与方案，场景独立实现）：
- https://github.com/google-ai-edge/mediapipe （Apache-2.0）
- https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker?tab=Web
- https://github.com/electronicminer/gesture-Christmas_tree-3d_with_photo （MIT，手势与照片交互参考）
- https://github.com/Vita0519/ChristmasTree
- https://github.com/zebo101/christmas-tree

校对：避免营销落地页布局与大型设置卡片；画面进入即见树，无需点击开始。摄像头只由用户主动开启。降低动态效果偏好时停止自动旋转、飘雪，保留用户触发的切换。

