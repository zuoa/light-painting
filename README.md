# 灯光画生成器 (Light Painting Generator)

**纯前端实现** - 将照片转换为适合制作灯光画的三张图片：封面纸图、第一层透光层图、第二层透光层图。

> **隐私友好**：图片在浏览器本地处理，不上传服务器。

![效果预览](./docs/preview.png)

## 特性

- **封面纸图**：暖灰低饱和风格，不开灯时像有质感的装饰画
- **第一层透光层**：保留主体细节，开灯后呈现轮廓和局部亮部
- **第二层透光层**：更柔和的氛围层，让整体光感更自然
- **预览图**：模拟三张叠加后的开灯效果
- **三套风格预设**：人物纪念版、梦幻氛围版、插画柔光版
- **纯前端处理**：使用 HTML5 Canvas，无需后端服务器

## 技术栈

- **框架**：Next.js 14 (静态导出)
- **图像处理**：HTML5 Canvas API
- **样式**：Tailwind CSS
- **ZIP下载**：JSZip

## 本地运行

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev

# 3. 打开浏览器访问 http://localhost:3000
```

## 构建与部署

### 本地构建（静态输出）

```bash
npm run build
```

输出目录：`dist/`，可直接用任何静态服务器托管。

### 部署到 Cloudflare Pages

```bash
# 1. 构建
npm run build

# 2. 使用 Wrangler 部署
npx wrangler pages deploy dist
```

或使用 Cloudflare Dashboard 连接 Git 仓库自动部署。

### 部署到 Vercel

```bash
# 使用 Vercel CLI
npm i -g vercel
vercel --prod
```

### 其他静态托管

`dist/` 目录可直接部署到：
- GitHub Pages
- Netlify
- AWS S3
- 任何静态文件服务器

## 项目结构

```
light-painting/
├── app/
│   ├── layout.tsx              # 根布局
│   ├── page.tsx                # 主页面
│   └── globals.css             # 全局样式
├── components/
│   ├── UploadZone.tsx          # 拖拽上传组件
│   ├── ParamsPanel.tsx         # 参数面板
│   ├── ParamSlider.tsx         # 滑块控件
│   ├── ResultCard.tsx          # 结果卡片
│   ├── ResultGrid.tsx          # 结果网格
│   └── Icons.tsx               # 图标组件
├── lib/
│   ├── types.ts                # TypeScript 类型定义
│   ├── defaults.ts             # 默认参数和预设
│   └── imageProcessorBrowser.ts # 前端图像处理逻辑
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── wrangler.toml               # Cloudflare 配置
└── README.md
```

## 图像处理逻辑

### 封面纸参数
- **去色程度** (0.72)：将图片转为低饱和风格
- **亮度** (1.08)：轻微提亮
- **对比度** (1.18)：增强画面感
- **暖色调强度** (18)：整体偏暖
- **锐化强度** (0.6)：保留细节

### 第一层透光层
- **Gamma** (1.25)：压暗中间调
- **对比度** (1.35)：增强层次
- **模糊半径** (0.9)：柔化边缘
- **暗部压黑** (0.28)：让暗部更黑
- **边缘细节** (0.18)：保留轮廓

### 第二层透光层
- **Gamma** (1.55)：强调亮部
- **对比度** (1.08)：保持柔和
- **模糊半径** (3.5)：更柔和的光感
- **氛围强度** (0.75)：整体发光感
- **亮部扩散** (0.6)：高光晕散

## 浏览器兼容性

- Chrome 80+
- Firefox 80+
- Safari 14+
- Edge 80+

需要支持 `OffscreenCanvas` 和 `ImageBitmap`。

## 制作说明

1. 上传一张人物或风景照片（JPG/PNG/WebP，最大 10MB）
2. 选择风格预设或手动调整参数
3. 点击「开始生成」，图片会在浏览器中处理
4. 预览效果，满意后下载
5. 打印：
   - 封面纸图 → 使用有质感的相纸
   - 透光层 → 使用描图纸 / 硫酸纸 / PET柔光片

## 性能说明

- **处理速度**：1500×2100 像素图片约 1-3 秒
- **内存占用**：单张图片处理约占用 50-100MB 内存
- **推荐尺寸**：建议上传 2000px 以上的原图获得最佳效果

## 许可

MIT License
