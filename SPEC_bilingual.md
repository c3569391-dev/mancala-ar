# AR Mancala Learning Assistant — Project Specification (双语对照 / Bilingual)

> **Note for Claude Code (重要):**
> **All text rendered in the actual app/AR must be ENGLISH.** The Chinese in this document is only for the project owner to understand the spec — do NOT put Chinese into the UI, AR overlay, buttons, or any user-facing strings. English only in the product.
> 应用/AR 中实际显示的所有文字必须是**英文**。本文档中的中文仅供项目负责人理解,**不要**把中文放进 UI、AR 叠加层、按钮或任何面向用户的文本。成品只用英文。

> Read this whole document before writing any code. It defines WHAT to build and the design intent; you choose the cleanest implementation.
> 写任何代码前请完整读一遍。本文档定义"做什么"和设计意图;具体实现由你选最干净的方案。

---

## 1. Project Context / 项目背景

**EN:** This is a **final-year university project for an AR course**. It is an **AR-based learning support system** that helps **beginners learn the rules of Mancala** (the board game).
**中:** 这是一门 **AR 课程的大学毕业设计**。它是一个**基于 AR 的学习辅助系统**,帮助**初学者学习曼卡拉(Mancala)棋盘游戏的规则**。

- **Type / 性质**: Educational AR tool, NOT primarily a playable game. Core purpose = teaching rules through guided interaction. / 教育型 AR 工具,**不是**以可玩游戏为主。核心是通过引导式交互教规则。
- **Platform / 平台**: Mobile web, opened via QR code, no app install. / 移动端网页,扫码打开,免安装。
- **AR engine / 引擎**: **MindAR** image tracking via CDN. https://github.com/hiukim/mind-ar-js
- **Stack / 技术栈**: Plain HTML / CSS / JavaScript. No build step, no framework. Deployable to static hosting. / 纯 HTML/CSS/JS,无构建步骤、无框架,可部署到静态托管。

### User flow / 用户流程
**EN:**
1. Scan QR code → phone browser opens the page.
2. Browser asks camera permission → rear camera full screen.
3. Point camera at a **physical Mancala board** (the AR image target).
4. **Virtual teaching content floats above the physical board.**
5. Tap on-screen UI buttons to access modules.

**中:**
1. 扫二维码 → 手机浏览器打开网页。
2. 请求摄像头权限 → 后置摄像头全屏。
3. 摄像头对准**实体曼卡拉棋盘**(AR 识别目标图)。
4. **虚拟教学内容悬浮叠加在实体棋盘上方。**
5. 点击屏幕 UI 按钮进入各模块。

---

## 2. Research Goals / 研究目标

**EN:** Every feature must serve "help a beginner understand the rules," not "make a fun game."
- **RO1**: Improve beginners' understanding of Mancala rules and gameplay flow.
- **RO2**: Enhance interaction clarity and learning through AR-guided interaction and movement visualization.
- **RO3**: Provide effective onboarding and active learning for beginners.

**中:** 每个功能都要服务于"帮初学者理解规则",而非"做好玩的游戏"。
- **RO1**:提升初学者对规则和游戏流程的理解。
- **RO2**:通过 AR 引导交互和移动可视化增强交互清晰度与学习体验。
- **RO3**:为初学者提供有效引导和主动学习体验。

---

## 3. Two-Layer Architecture / 两层架构 (IMPORTANT / 重要)

### Layer A — AR Overlay (anchored to the board, moves with it) / AR 叠加层(锚定棋盘,随之移动)
- Virtual Mancala board / 虚拟棋盘
- Animated seed movement, seed-by-seed, counter-clockwise / 种子逐颗逆时针移动动画
- Counter-clockwise direction arrow / 逆时针方向箭头
- Floating rule notifications ("Capture Triggered!", "You Gain an Extra Turn!") / 悬浮规则提示
- Player-side indicators / highlighted pits / 玩家区域指示、高亮的坑

### Layer B — Screen-Fixed UI (stays on screen, easy to tap) / 屏幕固定 UI(不随棋盘动,易点击)
- 4 module buttons: **Rules / Demo / Quiz / Free Play** / 四个模块按钮
- Quiz answer buttons / 测验选项按钮
- Feedback text & rule explanations / 反馈文字与规则解释
- "Point your camera at the board" prompt when target lost / 目标丢失时的提示

**EN:** Reason: AR-space buttons are hard to tap on a phone. Functional controls = screen UI; teaching visuals = AR overlay.
**中:** 原因:AR 空间按钮在手机上难点准。功能控件 = 屏幕 UI;教学视觉 = AR 叠加层。

---

## 4. Player-Side Color Coding / 玩家区域颜色标识 (KEY — read carefully / 关键,仔细读)

**EN:** Colors indicate **which side of the board belongs to which player** — the color is on the **board/region, NOT on the seeds**. Seeds are neutral (e.g. gold/glowing) and the same for both sides, because seeds move across both territories during play; coloring seeds would be confusing.

- **Player A = BLUE**: the **top side**. The top row of pits, that side's large store (the big well), and Player A's avatar are all rendered in **blue** (blue AR glow / blue board tint).
- **Player B = RED**: the **bottom side**. The bottom row of pits, that side's large store, and Player B's avatar are all rendered in **red**.
- The blue tint on the top half of the AR board + blue store + blue avatar together signal "this territory is Player A's." Same logic in red for Player B.
- **Seeds themselves are NOT blue or red** — they are a neutral glowing color (gold/white). Ownership is shown by the board region color, not the seed color.

**中:** 颜色用来标示**棋盘的哪一侧归哪位玩家**——颜色加在**棋盘/区域上,不是加在种子上**。种子是中性色(如金色/发光),两侧一样,因为种子在游戏中会移动到双方区域,给种子上色反而混乱。

- **玩家 A = 蓝色**:**上方**一侧。上排的坑、该侧的大储存区(大坑)、玩家 A 的头像,全部渲染成**蓝色**(蓝色 AR 辉光 / 蓝色棋盘色调)。
- **玩家 B = 红色**:**下方**一侧。下排的坑、该侧的大储存区、玩家 B 的头像,全部渲染成**红色**。
- AR 棋盘上半部分的蓝色色调 + 蓝色储存区 + 蓝色头像,共同表示"这片区域是玩家 A 的"。下方红色同理表示玩家 B。
- **种子本身不是蓝色或红色**——它们是中性发光色(金/白)。归属靠棋盘区域颜色体现,不靠种子颜色。

---

## 5. AR Overlay Visual Style / AR 叠加层视觉风格 (the soul of the project / 项目灵魂)

**EN:** Reference the holographic overlay look from the design sketches. This is an AR course project — the AR visuals must look impressive and high-tech.

- **Semi-transparent + colored / 半透明带颜色**: virtual board and elements are translucent, letting the real board show through — like light-projected holograms, not solid opaque boards.
- **Sci-fi / HUD feel / 科技感、HUD 风格**: glowing edges / neon outlines on pits and board contours; blue glow (Player A) and red glow (Player B); optional grid lines, scan lines, particle accents.
- **AR feel / AR 感**: subtle floating motion, parallax, edge bloom — elements feel like they "hover" in real space.
- **3D depth / 3D 立体感**: pits shown as glowing rings with depth (recessed feel); seeds are glowing 3D spheres with bloom + shadow; layered depth, not flat sprites.
- **Motion / 动效**: fade/scale/glow-pulse on appear; glowing trails as seeds move; energy-burst or bright pulse when Capture / Extra Turn triggers.
- **Palette / 配色**: cyan / electric blue, magenta / red neon on dark-transparent background, gold accents — high-tech holographic mood.

> **EN one-liner:** Like a glowing holographic interface projected up from the board in a sci-fi movie. Translucent, glowing, hovering, with 3D depth.
> **中文一句话:** 像科幻电影里从棋盘上投射出来的发光全息界面。半透明、发光、悬浮、有 3D 深度。

---

## 6. Mancala Rules / 曼卡拉规则 (Kalah standard — implement exactly / 标准 Kalah,精确实现)

**EN:**
- Board: 2 rows of **6 pits** each + **2 stores** (one per player).
- Each pit starts with **4 seeds**.
- Players: **Player A** (top, BLUE) and **Player B** (bottom, RED).
- On a turn: take all seeds from one of YOUR pits, sow **one per pit, counter-clockwise**.
- Sow into **your own store**, but **SKIP the opponent's store**.
- **Extra Turn**: last seed in **your own store** → move again.
- **Capture**: last seed in an **empty pit on your own side** → capture that seed + **all seeds in the opposite pit**, into your store.
- **Game End**: when **one player's whole row is empty**. The other player sweeps remaining seeds into their store. **Most seeds in store wins.**

**中:**
- 棋盘:2 行各 **6 个坑** + **2 个储存区**(每人一个)。
- 每坑初始 **4 颗种子**。
- 玩家:**玩家 A**(上方,蓝)和**玩家 B**(下方,红)。
- 轮到你:拿起你某坑全部种子,**逆时针逐坑各放一颗**。
- 可放进**自己的储存区**,但**跳过对手储存区**。
- **额外回合**:最后一颗落在**自己储存区** → 再走一次。
- **吃子**:最后一颗落在**自己一侧的空坑** → 吃掉它 + **正对面坑所有种子**,进自己储存区。
- **游戏结束**:**某方整排坑全空**时。另一方把剩余种子收进自己储存区。**储存区多者胜。**

### Board indexing / 棋盘索引 (for the engine / 供引擎使用)
```
Pits 0–5   = Player A's pits / 玩家 A 的坑
Pit  6     = Player A's store / 玩家 A 储存区
Pits 7–12  = Player B's pits / 玩家 B 的坑
Pit  13    = Player B's store / 玩家 B 储存区
Sowing order / 播种顺序: 0→1→2→3→4→5→6→7→8→9→10→11→12→13→0 ...
Player A skips 13; Player B skips 6. / A 跳过 13;B 跳过 6。
Opposite pit of i (capture) / i 的正对面坑 = 12 - i
```

---

## 7. Modules / 各模块详细需求

> All in-app text below must be rendered in ENGLISH. / 以下所有 app 内文字必须用英文显示。

### 7.1 Main / Onboarding scene / 主界面引导页
**EN:** Virtual board centered, each pit pre-filled with 4 seeds. Player A = blue, top side + that side's store, male avatar top-left. Player B = red, bottom side + that side's store, female avatar top-right. Short intro text (English): blue vs red shows territory ownership, 4 seeds per pit, counter-clockwise movement, turn-taking. Four buttons at bottom: **Rules / Demo / Quiz / Free Play**.
**中:** 虚拟棋盘居中,每坑预填 4 颗。玩家 A 蓝色,上方一侧 + 该侧储存区,左上角男头像。玩家 B 红色,下方一侧 + 该侧储存区,右上角女头像。简短英文介绍文字:蓝/红表示区域归属、每坑 4 颗、逆时针、轮流。底部四按钮:Rules / Demo / Quiz / Free Play。

### 7.2 Module: Rules / 规则模块
**EN:** Show full rule explanation as readable English text with the board visible. Cover: pits & stores, 4 seeds each, counter-clockwise, turn-taking, can't enter opponent's store, capture, extra turn, game-end condition.
**中:** 用易读英文展示完整规则,棋盘可见。涵盖:坑与储存区、每坑 4 颗、逆时针、轮流、不能进对手储存区、吃子、额外回合、结束条件。

### 7.3 Module: Demo / 演示模块
**EN:** Two sub-buttons: **Capture Demo** and **Extra Turn Demo**.
- *Capture Demo*: preset board → tap highlighted pit → CCW arrow → seeds move one-by-one → last seed lands in empty pit on own side → trigger capture → highlight opposite pit → show "Capture Triggered!" → explain why.
- *Extra Turn Demo*: another preset → tap highlighted pit → arrow + animation → last seed in own store → show "You Gain an Extra Turn!" → explain why.

**中:** 两个子按钮:Capture Demo、Extra Turn Demo。
- *吃子演示*:预设棋盘 → 点高亮坑 → 逆时针箭头 → 种子逐颗移动 → 最后一颗落自己空坑 → 触发吃子 → 高亮对面坑 → 显示 "Capture Triggered!" → 解释原因。
- *额外回合演示*:另一预设 → 点高亮坑 → 箭头+动画 → 最后一颗落自己储存区 → 显示 "You Gain an Extra Turn!" → 解释原因。

### 7.4 Module: Quiz / 测验模块
**EN:** Two sub-buttons: **Quiz 1** and **Quiz 2**.
- *Quiz 1*: mid-game board with different seed counts + numeric scores. Question: **"Which player wins the game?"** Options: Player A / Player B / Tie. On select → "Correct!" / "Incorrect" + explanation comparing store totals.
- *Quiz 2*: a board state. Question: **"What condition triggers game over?"** Options: one side's pits empty / gaining an extra turn / capturing seeds. On select → correct answer + rule explanation.

**中:** 两个子按钮:Quiz 1、Quiz 2。
- *测验 1*:中盘棋局,不同种子数 + 数字分数。问题:"Which player wins the game?" 选项:Player A / Player B / Tie。选后 → "Correct!"/"Incorrect" + 比较储存区总数的解释。
- *测验 2*:某棋局。问题:"What condition triggers game over?" 选项:某方坑全空 / 获得额外回合 / 吃子。选后 → 正确答案 + 规则解释。

### 7.5 Module: Free Play / 自由游玩模块 (secondary / 次要)
**EN:** A fully playable Mancala game (real engine: sow, capture, extra turn, turn-switching, scoring, win detection). Guided aid: highlight the current player's selectable pits (this is the "AR guidance replaces a human tutor" angle, supporting RO3). Reset / Play Again button. This is the ONLY truly playable part; everything else is preset teaching scenarios.
**中:** 完整可玩的曼卡拉(真实引擎:播种、吃子、额外回合、回合切换、计分、胜负)。引导辅助:高亮当前玩家可选的坑(这是"AR 引导代替真人老师"的卖点,支撑 RO3)。重置/重玩按钮。这是唯一真正可玩的部分,其余都是预设教学场景。

---

## 8. Overall Design Direction / 整体设计方向 (make it look good — previous version was too plain / 要好看,之前太朴素)

**EN:**
- Screen UI (Layer B): modern, refined, high quality; can be dark tech style to match the AR holographic overlay.
- Typography: distinctive display font for headings + clean readable body font (NOT Arial/Inter/Roboto). Use Google Fonts via CDN.
- Color: blue = Player A, red = Player B, tech cyan + neon + gold accents. Cohesive, not random.
- Mobile-first: sized for portrait phone; big thumb-tappable buttons.
- Avoid generic "AI slop" look; make it feel intentionally designed.

**中:**
- 屏幕 UI(B 层):现代、精致、高质量;可用深色科技风,与 AR 全息层呼应。
- 字体:标题用有特色的展示字体 + 正文用干净易读字体(不要 Arial/Inter/Roboto),Google Fonts CDN 引入。
- 配色:蓝=A,红=B,科技青蓝+霓虹+金色点缀,统一不杂乱。
- 移动优先:竖屏手机尺寸,按钮够大易点。
- 避免通用"AI 生成感",要有精心设计的质感。

---

## 9. MindAR Integration / MindAR 集成说明

**EN:**
- Use MindAR image tracking via CDN script tags (no npm).
- During dev, use MindAR's official example `.mind` target as placeholder.
- I'll later replace it with my own `targets.mind` generated from a photo of my physical board (via https://hiukim.github.io/mind-ar-js-doc/tools/compile/ ).
- Target detected → show AR overlay. Target lost → hide overlay + show "Point camera at the Mancala board" hint.
- Screen-fixed UI must stay usable when target is briefly lost, so learners aren't blocked.

**中:**
- 通过 CDN script 用 MindAR 图片追踪(不用 npm)。
- 开发阶段先用 MindAR 官方示例 `.mind` 占位。
- 之后我用自己拍的棋盘照片生成 `targets.mind` 替换。
- 识别到目标 → 显示 AR 层;丢失 → 隐藏 + 显示 "Point camera at the Mancala board"。
- 目标短暂丢失时屏幕 UI 仍可用,别卡住学习者。

---

## 10. Deliverable / 交付物

**EN:** `index.html` entry point (split CSS/JS if cleaner). Runs over HTTPS locally for phone testing; deployable to GitHub Pages / Netlify. Clean, commented code for thesis-defense demo.
**中:** `index.html` 入口(更清晰可拆 CSS/JS)。本地 HTTPS 运行供手机测试;可部署到 GitHub Pages / Netlify。代码干净有注释,便于答辩演示。

---

## 11. Build Order / 构建顺序 (suggested / 建议)

**EN:**
1. Read this spec. Summarize your plan + file structure BEFORE coding.
2. Build the core engine + all module content/UI first, testable in a normal browser (no AR yet).
3. Verify engine logic (capture, extra turn, store-skipping, win detection).
4. Layer MindAR on top: camera, target detection, two-layer split.
5. Explain how to run locally over HTTPS for phone testing.
6. Help me swap in my own target file and deploy.
Proceed one stage at a time; pause for my confirmation between stages.

**中:**
1. 读完规格。**先**总结方案+文件结构,**再**写代码。
2. 先做核心引擎 + 所有模块内容/UI,普通浏览器可测(暂不加 AR)。
3. 验证引擎逻辑(吃子、额外回合、跳过储存区、胜负)。
4. 叠加 MindAR:摄像头、目标识别、两层拆分。
5. 说明如何本地 HTTPS 运行供手机测试。
6. 帮我换自己的目标图并部署。
每完成一阶段,暂停等我确认再继续。
