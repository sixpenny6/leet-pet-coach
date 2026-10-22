# 鲸鱼娘素材 / v1.1.0

使用内置 imagegen 生成新的三状态透明 sprite sheet，未直接截取或裁剪网络表情包。之后仅用 Sharp 做技术切帧、缩放与头像裁切，保留 alpha。不是 DeepSeek 官方发布的素材。

源图：`artwork/whale-spritesheet.png`。运行素材：`whale-idle.png`、`whale-thinking.png`、`whale-happy.png`、`whale-avatar.png`，位于 `extension/assets/`。扩展图标由新头像生成。

## 最终生成提示词

Create one production sprite sheet asset for a browser companion called 蓝色大肥鱼, inspired by the familiar DeepSeek whale-girl internet mascot. A VERY WIDE LANDSCAPE transparent sprite sheet with exactly THREE equally sized columns in a single row. Same SINGLE character repeated once per column, same size and same fixed baseline, generous transparent padding within every column, no figure crossing column boundaries. Each character is a compact chibi anime whale girl: long bright deep-blue hair fading to light cyan at the ends, whale-fin ear accessories, little blue whale tail curling to her right, round cute cheeks, large expressive blue eyes, white frilly maid headband, simple navy blue and white maid dress with tiny blue bow, dark shoes. Nonsexual, wholesome, friendly, round and soft kawaii 2D sticker art with clean dark-blue outlines, crisp cel shading and simple readable silhouette, readable as a small 110px desktop pet. Full body, head much larger than body. LEFT COLUMN: idle, gentle curious smile, holding a small white rice bowl in front of her waist. CENTER COLUMN: thinking, head slightly tilted, one hand touching chin, eyes looking upward thoughtfully, no extra symbol above head. RIGHT COLUMN: happy, closed-eye broad smile, one hand waving encouragingly while holding rice bowl with other. Consistent face, hairstyle, clothes, tail, proportions in all THREE columns. The whole sheet MUST have actual transparent alpha background; no white rectangle, no checkerboard painted into art, no scenery, no floor, no shadow, no captions, absolutely no text, no letters or logos. This is one technical sprite sheet, not a UI mockup, not a comic. Equal-width 3-column grid is essential for splitting into frames. All three must fit fully inside their own cells.

## v1.2.0 闭眼帧与 GIF

仍使用内置 imagegen 编辑现有 `extension/assets/whale-idle.png`。生成原件保存在 `artwork/whale-blink-source.png`。然后用 Sharp 仅作缩放、轻微呼吸位移与 GIF 编码，输出 `extension/assets/whale-idle.gif`（透明、循环）；保留静态图供暂停动画及系统减少动态效果时使用。

闭眼帧最终提示词：

Edit this transparent full-body chibi blue whale girl sprite to create one BLINK animation frame. Make ONLY her two eyes gently closed, with small cute upward curved dark-blue eyelid lines. Preserve absolutely everything else: exact head and body position, pose, rice bowl and hands, hair silhouette and highlights, whale tail, frilly headband, maid dress, shoes, expression of mouth, image canvas composition and padding, proportions and palette. No added details or symbols. This must align with the original when overlaid, as an animation frame: do not redraw or move her face, hair, body or bowl. Keep true transparent background. No text.
