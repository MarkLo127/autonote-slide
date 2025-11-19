(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/frontend/src/lib/generateAnalysisPdf.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "generateAnalysisPdf",
    ()=>generateAnalysisPdf
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$pdf$2d$lib$2f$es$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/pdf-lib/es/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$pdf$2d$lib$2f$es$2f$api$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/pdf-lib/es/api/index.js [app-client] (ecmascript)");
'use client';
;
const PDF_FONT_FAMILY = "NotoSansTCPdf";
const FONT_STACK = "".concat(PDF_FONT_FAMILY, ", 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', 'Heiti TC', sans-serif");
const PAGE_WIDTH = 1190;
const PAGE_HEIGHT = 1684;
const PDF_PAGE_WIDTH = 595.28; // A4 width in points
const PDF_PAGE_HEIGHT = 841.89; // A4 height in points
const MARGIN_X = 80;
const MARGIN_TOP = 80;
const MARGIN_BOTTOM = 100;
const SECTION_GAP = 32;
const HEADING_COLOR = "#111827";
const BODY_COLOR = "#1f2937";
const MUTED_COLOR = "#6b7280";
let fontLoadPromise = null;
let pdfFontLoaded = false;
const buildFont = function(size) {
    let weight = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 400;
    const weightPart = weight === 400 ? '' : "".concat(weight, " ");
    return "".concat(weightPart).concat(size, "px ").concat(FONT_STACK);
};
const ensurePrimaryFont = async (fontUrl)=>{
    if (pdfFontLoaded || !fontUrl) return;
    if (typeof document === 'undefined' || typeof FontFace === 'undefined' || !('fonts' in document)) return;
    if (!fontLoadPromise) {
        fontLoadPromise = (async ()=>{
            try {
                const fontFace = new FontFace(PDF_FONT_FAMILY, "url(".concat(fontUrl, ")"), {
                    weight: '100 900'
                });
                const loaded = await fontFace.load();
                document.fonts.add(loaded);
                await document.fonts.ready;
                pdfFontLoaded = true;
            } catch (err) {
                pdfFontLoaded = false;
                console.warn('PDF 字型載入失敗，將改用系統字型', err);
            }
        })();
    }
    try {
        await fontLoadPromise;
    } catch (e) {
        fontLoadPromise = null;
    }
    if (!pdfFontLoaded) {
        fontLoadPromise = null;
    }
};
const CLASSIFICATION_LABEL = {
    normal: "一般內容",
    toc: "目錄頁",
    pure_image: "純圖片",
    blank: "空白/水印",
    cover: "封面"
};
const createPage = (pageNumber)=>{
    const canvas = document.createElement("canvas");
    canvas.width = PAGE_WIDTH;
    canvas.height = PAGE_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new Error("無法建立畫布內容 (CanvasRenderingContext2D)");
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    ctx.textBaseline = "top";
    ctx.fillStyle = BODY_COLOR;
    ctx.font = buildFont(16);
    return {
        canvas,
        ctx,
        cursorY: MARGIN_TOP,
        pageNumber
    };
};
const drawFooter = (ctx, pageNumber)=>{
    ctx.save();
    ctx.fillStyle = MUTED_COLOR;
    ctx.font = buildFont(14);
    ctx.fillText("第 ".concat(pageNumber, " 頁"), PAGE_WIDTH - MARGIN_X - ctx.measureText("第 ".concat(pageNumber, " 頁")).width, PAGE_HEIGHT - MARGIN_BOTTOM + 36);
    ctx.restore();
};
const wrapLine = (ctx, text, maxWidth)=>{
    if (!text) return [
        ""
    ];
    const sanitized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = [];
    for (const rawLine of sanitized.split("\n")){
        let current = "";
        for (const char of rawLine){
            const testLine = current + char;
            const width = ctx.measureText(testLine).width;
            if (width <= maxWidth || current.length === 0) {
                current = testLine;
            } else {
                lines.push(current);
                current = char === " " ? "" : char;
            }
        }
        if (current) {
            lines.push(current);
        } else if (rawLine.length === 0) {
            lines.push("");
        }
    }
    return lines;
};
const drawParagraph = (context, text, options, ensureSpace)=>{
    var _options_font;
    const font = (_options_font = options === null || options === void 0 ? void 0 : options.font) !== null && _options_font !== void 0 ? _options_font : buildFont(16);
    var _options_color;
    const color = (_options_color = options === null || options === void 0 ? void 0 : options.color) !== null && _options_color !== void 0 ? _options_color : BODY_COLOR;
    var _options_lineHeight;
    const lineHeight = (_options_lineHeight = options === null || options === void 0 ? void 0 : options.lineHeight) !== null && _options_lineHeight !== void 0 ? _options_lineHeight : 26;
    var _options_gapAfter;
    const gapAfter = (_options_gapAfter = options === null || options === void 0 ? void 0 : options.gapAfter) !== null && _options_gapAfter !== void 0 ? _options_gapAfter : 12;
    let ctx = context.ctx;
    ctx.save();
    ctx.font = font;
    ctx.fillStyle = color;
    const lines = wrapLine(ctx, text, PAGE_WIDTH - MARGIN_X * 2);
    for (const line of lines){
        if (context.cursorY + lineHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
            ctx.restore();
            ensureSpace === null || ensureSpace === void 0 ? void 0 : ensureSpace();
            ctx = context.ctx;
            ctx.save();
            ctx.font = font;
            ctx.fillStyle = color;
        }
        ctx.fillText(line, MARGIN_X, context.cursorY);
        context.cursorY += lineHeight;
    }
    context.cursorY += gapAfter;
    ctx.restore();
};
const drawBulletList = (context, bullets, options, ensureSpace)=>{
    var _options_lineHeight;
    const lineHeight = (_options_lineHeight = options === null || options === void 0 ? void 0 : options.lineHeight) !== null && _options_lineHeight !== void 0 ? _options_lineHeight : 26;
    var _options_bulletSpacing;
    const bulletSpacing = (_options_bulletSpacing = options === null || options === void 0 ? void 0 : options.bulletSpacing) !== null && _options_bulletSpacing !== void 0 ? _options_bulletSpacing : 10;
    const font = buildFont(16);
    let ctx = context.ctx;
    ctx.save();
    ctx.font = font;
    ctx.fillStyle = BODY_COLOR;
    for (const bullet of bullets){
        const lines = wrapLine(ctx, bullet, PAGE_WIDTH - MARGIN_X * 2 - 24);
        const bulletHeight = Math.max(lineHeight, lines.length * lineHeight);
        if (context.cursorY + bulletHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
            ctx.restore();
            ensureSpace === null || ensureSpace === void 0 ? void 0 : ensureSpace();
            ctx = context.ctx;
            ctx.save();
            ctx.font = font;
            ctx.fillStyle = BODY_COLOR;
        }
        const bulletX = MARGIN_X;
        const textX = bulletX + 24;
        ctx.fillText("•", bulletX, context.cursorY);
        let lineCursor = context.cursorY;
        for (const line of lines){
            ctx.fillText(line, textX, lineCursor);
            lineCursor += lineHeight;
        }
        context.cursorY = Math.max(context.cursorY + bulletHeight, lineCursor);
        context.cursorY += bulletSpacing;
    }
    ctx.restore();
};
const canvasToPngBytes = async (canvas)=>new Promise((resolve, reject)=>{
        canvas.toBlob(async (blob)=>{
            try {
                if (!blob) {
                    reject(new Error("無法將畫布轉換為 PNG"));
                    return;
                }
                const buffer = await blob.arrayBuffer();
                resolve(new Uint8Array(buffer));
            } catch (err) {
                reject(err);
            }
        }, "image/png", 1);
    });
const loadImage = async (url)=>new Promise((resolve, reject)=>{
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = ()=>resolve(image);
        image.onerror = ()=>reject(new Error("無法載入圖像：".concat(url)));
        image.src = url;
    });
const generateAnalysisPdf = async (payload)=>{
    await ensurePrimaryFont(payload.fontUrl);
    const pages = [];
    const current = createPage(1);
    const commitPage = ()=>{
        drawFooter(current.ctx, current.pageNumber);
        pages.push(current.canvas);
        const next = createPage(current.pageNumber + 1);
        current.canvas = next.canvas;
        current.ctx = next.ctx;
        current.cursorY = next.cursorY;
        current.pageNumber = next.pageNumber;
    };
    const ensureSpace = function() {
        let minHeight = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 120;
        if (current.cursorY + minHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
            commitPage();
        }
    };
    // 報告抬頭
    current.ctx.save();
    current.ctx.fillStyle = HEADING_COLOR;
    current.ctx.font = buildFont(32, 700);
    const title = "分析報告";
    current.ctx.fillText(title, MARGIN_X, current.cursorY);
    current.cursorY += 46;
    current.ctx.font = buildFont(24, 600);
    current.ctx.fillText(payload.documentTitle || "未命名檔案", MARGIN_X, current.cursorY);
    current.cursorY += 38;
    current.ctx.restore();
    current.ctx.save();
    current.ctx.font = buildFont(15);
    current.ctx.fillStyle = MUTED_COLOR;
    const metaPieces = [
        payload.languageLabel ? "語言：".concat(payload.languageLabel) : null,
        "總頁數：".concat(payload.totalPages)
    ].filter(Boolean);
    current.ctx.fillText(metaPieces.join("  •  "), MARGIN_X, current.cursorY);
    current.ctx.restore();
    current.cursorY += 40;
    const drawSectionHeading = (text)=>{
        ensureSpace(80);
        current.ctx.save();
        current.ctx.fillStyle = HEADING_COLOR;
        current.ctx.font = buildFont(22, 600);
        current.ctx.fillText(text, MARGIN_X, current.cursorY);
        current.ctx.restore();
        current.cursorY += 34;
    };
    const drawSubHeading = (text)=>{
        ensureSpace(50);
        current.ctx.save();
        current.ctx.fillStyle = HEADING_COLOR;
        current.ctx.font = buildFont(18, 600);
        current.ctx.fillText(text, MARGIN_X, current.cursorY);
        current.ctx.restore();
        current.cursorY += 28;
    };
    // 全局摘要
    drawSectionHeading("全局摘要");
    if (payload.globalSummary.bullets.length) {
        drawBulletList(current, payload.globalSummary.bullets, undefined, ()=>{
            commitPage();
            drawSectionHeading("全局摘要");
        });
    } else {
        drawParagraph(current, "尚未提供全局摘要。", {
            color: MUTED_COLOR
        });
    }
    current.cursorY += SECTION_GAP;
    // 延伸說明
    drawSectionHeading("延伸說明");
    drawSubHeading("關鍵結論");
    drawParagraph(current, payload.globalSummary.expansions.key_conclusions || "暫無資料", {
        gapAfter: 16
    }, ()=>{
        commitPage();
        drawSectionHeading("延伸說明");
        drawSubHeading("關鍵結論");
    });
    drawSubHeading("核心資料");
    drawParagraph(current, payload.globalSummary.expansions.core_data || "暫無資料", {
        gapAfter: 16
    }, ()=>{
        commitPage();
        drawSectionHeading("延伸說明");
        drawSubHeading("核心資料");
    });
    drawSubHeading("風險與建議");
    drawParagraph(current, payload.globalSummary.expansions.risks_and_actions || "暫無資料", undefined, ()=>{
        commitPage();
        drawSectionHeading("延伸說明");
        drawSubHeading("風險與建議");
    });
    current.cursorY += SECTION_GAP;
    // 關鍵字
    drawSectionHeading("整體關鍵字");
    if (payload.aggregatedKeywords.length) {
        const keywordText = payload.aggregatedKeywords.join("，");
        drawParagraph(current, keywordText, {
            gapAfter: 0
        }, ()=>{
            commitPage();
            drawSectionHeading("整體關鍵字");
        });
    } else {
        drawParagraph(current, "暫無整體關鍵字資料。", {
            color: MUTED_COLOR
        });
    }
    commitPage();
    // 逐頁摘要
    const drawPageSummaryHeading = ()=>{
        current.ctx.save();
        current.ctx.fillStyle = HEADING_COLOR;
        current.ctx.font = buildFont(24, 600);
        current.ctx.fillText("逐頁重點摘要", MARGIN_X, current.cursorY);
        current.ctx.restore();
        current.cursorY += 38;
    };
    drawPageSummaryHeading();
    for (const summary of payload.pageSummaries){
        ensureSpace(160);
        var _CLASSIFICATION_LABEL_summary_classification;
        const classificationLabel = (_CLASSIFICATION_LABEL_summary_classification = CLASSIFICATION_LABEL[summary.classification]) !== null && _CLASSIFICATION_LABEL_summary_classification !== void 0 ? _CLASSIFICATION_LABEL_summary_classification : summary.classification;
        current.ctx.save();
        current.ctx.fillStyle = HEADING_COLOR;
        current.ctx.font = buildFont(18, 600);
        current.ctx.fillText("第 ".concat(summary.page_number, " 頁"), MARGIN_X, current.cursorY);
        const meta = summary.skipped && summary.skip_reason ? "（已跳過）" : classificationLabel;
        current.ctx.fillStyle = MUTED_COLOR;
        current.ctx.font = buildFont(15);
        const metaText = " ".concat(meta);
        current.ctx.fillText(metaText, MARGIN_X + current.ctx.measureText("第 ".concat(summary.page_number, " 頁")).width + 6, current.cursorY + 2);
        current.ctx.restore();
        current.cursorY += 28;
        if (summary.bullets.length) {
            drawBulletList(current, summary.bullets, undefined, ()=>{
                commitPage();
                drawPageSummaryHeading();
                current.ctx.save();
                current.ctx.fillStyle = HEADING_COLOR;
                current.ctx.font = buildFont(18, 600);
                current.ctx.fillText("第 ".concat(summary.page_number, " 頁"), MARGIN_X, current.cursorY);
                const newMeta = summary.skipped && summary.skip_reason ? "（已跳過）" : classificationLabel;
                current.ctx.fillStyle = MUTED_COLOR;
                current.ctx.font = buildFont(15);
                current.ctx.fillText(" ".concat(newMeta), MARGIN_X + current.ctx.measureText("第 ".concat(summary.page_number, " 頁")).width + 6, current.cursorY + 2);
                current.ctx.restore();
                current.cursorY += 28;
            });
        } else {
            drawParagraph(current, "本頁無摘要資料。", {
                color: MUTED_COLOR,
                gapAfter: 10
            }, ()=>{
                commitPage();
                drawPageSummaryHeading();
                current.ctx.save();
                current.ctx.fillStyle = HEADING_COLOR;
                current.ctx.font = buildFont(18, 600);
                current.ctx.fillText("第 ".concat(summary.page_number, " 頁"), MARGIN_X, current.cursorY);
                current.ctx.restore();
                current.cursorY += 28;
            });
        }
        if (summary.keywords.length) {
            const keywordLine = summary.keywords.join("、");
            drawParagraph(current, "關鍵字：".concat(keywordLine), {
                color: MUTED_COLOR,
                gapAfter: 18
            }, ()=>{
                commitPage();
                drawPageSummaryHeading();
                current.ctx.save();
                current.ctx.fillStyle = HEADING_COLOR;
                current.ctx.font = buildFont(18, 600);
                current.ctx.fillText("第 ".concat(summary.page_number, " 頁"), MARGIN_X, current.cursorY);
                current.ctx.restore();
                current.cursorY += 28;
            });
        }
        if (summary.skipped && summary.skip_reason) {
            drawParagraph(current, "跳過原因：".concat(summary.skip_reason), {
                color: MUTED_COLOR,
                gapAfter: 28
            }, ()=>{
                commitPage();
                drawPageSummaryHeading();
                current.ctx.save();
                current.ctx.fillStyle = HEADING_COLOR;
                current.ctx.font = buildFont(18, 600);
                current.ctx.fillText("第 ".concat(summary.page_number, " 頁"), MARGIN_X, current.cursorY);
                current.ctx.restore();
                current.cursorY += 28;
            });
        } else {
            current.cursorY += 18;
        }
    }
    commitPage();
    const drawImagePage = async (title, imageUrl)=>{
        const needsNewPage = current.cursorY !== MARGIN_TOP;
        if (needsNewPage) {
            commitPage();
        }
        current.ctx.save();
        current.ctx.fillStyle = HEADING_COLOR;
        current.ctx.font = buildFont(26, 600);
        current.ctx.fillText(title, MARGIN_X, current.cursorY);
        current.ctx.restore();
        current.cursorY += 40;
        if (imageUrl) {
            try {
                const image = await loadImage(imageUrl);
                const availableWidth = PAGE_WIDTH - MARGIN_X * 2;
                const availableHeight = PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM - 80;
                const scale = Math.min(availableWidth / image.width, availableHeight / image.height, 1);
                const drawWidth = image.width * scale;
                const drawHeight = image.height * scale;
                const offsetX = MARGIN_X + (availableWidth - drawWidth) / 2;
                current.ctx.drawImage(image, offsetX, current.cursorY, drawWidth, drawHeight);
            } catch (err) {
                drawParagraph(current, "圖像載入失敗：".concat(err.message), {
                    color: MUTED_COLOR
                });
            }
        } else {
            drawParagraph(current, "尚未取得圖像資料。", {
                color: MUTED_COLOR
            });
        }
        commitPage();
    };
    await drawImagePage("文字雲", payload.wordcloudUrl);
    const pdfDoc = await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$pdf$2d$lib$2f$es$2f$api$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PDFDocument"].create();
    for (const canvas of pages){
        const pngBytes = await canvasToPngBytes(canvas);
        const pngImage = await pdfDoc.embedPng(pngBytes);
        const page = pdfDoc.addPage([
            PDF_PAGE_WIDTH,
            PDF_PAGE_HEIGHT
        ]);
        const scale = PDF_PAGE_WIDTH / PAGE_WIDTH;
        const scaled = pngImage.scale(scale);
        page.drawImage(pngImage, {
            x: 0,
            y: PDF_PAGE_HEIGHT - scaled.height,
            width: scaled.width,
            height: scaled.height
        });
    }
    return pdfDoc.save();
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/frontend/src/app/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Home
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/frontend/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/next/image.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$generateAnalysisPdf$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/lib/generateAnalysisPdf.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
var _process_env_NEXT_PUBLIC_BACKEND_URL, _ref;
const rawBackendOrigin = (_ref = (_process_env_NEXT_PUBLIC_BACKEND_URL = __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.NEXT_PUBLIC_BACKEND_URL) !== null && _process_env_NEXT_PUBLIC_BACKEND_URL !== void 0 ? _process_env_NEXT_PUBLIC_BACKEND_URL : __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.NEXT_PUBLIC_API_BASE_URL) !== null && _ref !== void 0 ? _ref : "http://localhost:8000";
const sanitizeBase = (base)=>base.replace(/\/$/, "");
const resolveBrowserBackendBase = (base)=>{
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    try {
        const url = new URL(base);
        if (url.hostname === "backend") {
            const port = url.port || "8000";
            return "".concat(window.location.protocol, "//").concat(window.location.hostname).concat(("TURBOPACK compile-time truthy", 1) ? ":".concat(port) : "TURBOPACK unreachable");
        }
        if (url.hostname === "0.0.0.0") {
            const port = url.port || "8000";
            return "".concat(window.location.protocol, "//").concat(window.location.hostname).concat(("TURBOPACK compile-time truthy", 1) ? ":".concat(port) : "TURBOPACK unreachable");
        }
    } catch (err) {
        console.warn("解析後端位址失敗，將使用預設值", err);
        return base;
    }
    return base;
};
const INITIAL_BACKEND_BASE = sanitizeBase(rawBackendOrigin);
const DEFAULT_LLM_BASE_URL = "https://api.openai.com/v1";
const normalizeOptionalUrl = (url)=>url ? url.trim().replace(/\/$/, "") : "";
const fileTypes = [
    {
        label: "PDF",
        color: "text-rose-500"
    }
];
const formatBytes = (bytes)=>{
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = [
        "B",
        "KB",
        "MB",
        "GB"
    ];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = bytes / Math.pow(k, i);
    return "".concat(value.toFixed(i === 0 ? 0 : 1), " ").concat(sizes[i]);
};
const isPdfFile = (file)=>file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
const isTextFile = (file)=>{
    const lower = file.name.toLowerCase();
    return file.type.startsWith("text/") || lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".csv");
};
const isImageFile = (file)=>file.type.startsWith("image/");
function Home() {
    var _selectedFiles_;
    _s();
    const fileInputRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [backendBase, setBackendBase] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(INITIAL_BACKEND_BASE);
    const [selectedFiles, setSelectedFiles] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [dragging, setDragging] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [isAnalyzing, setIsAnalyzing] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [analysisResult, setAnalysisResult] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [filePreviewUrl, setFilePreviewUrl] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [filePreviewType, setFilePreviewType] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("none");
    const [filePreviewContent, setFilePreviewContent] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [settingsOpen, setSettingsOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [apiKey, setApiKey] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [llmBaseUrl, setLlmBaseUrl] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(DEFAULT_LLM_BASE_URL);
    const [hasLoadedSettings, setHasLoadedSettings] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [analysisCompleteMessage, setAnalysisCompleteMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [analysisProgress, setAnalysisProgress] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [isDownloading, setIsDownloading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [analysisLevel, setAnalysisLevel] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("medium");
    const fileInputId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"])();
    const aggregatedKeywords = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Home.useMemo[aggregatedKeywords]": ()=>{
            if (!analysisResult) return [];
            return Array.from(new Set(analysisResult.page_summaries.map({
                "Home.useMemo[aggregatedKeywords]": (page)=>page.keywords.slice(0, 4)
            }["Home.useMemo[aggregatedKeywords]"]).flat().filter({
                "Home.useMemo[aggregatedKeywords]": (kw)=>kw.trim().length > 0
            }["Home.useMemo[aggregatedKeywords]"]))).slice(0, 24);
        }
    }["Home.useMemo[aggregatedKeywords]"], [
        analysisResult
    ]);
    const uploadHelpId = "".concat(fileInputId, "-help");
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Home.useEffect": ()=>{
            if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
            ;
            setBackendBase(sanitizeBase(resolveBrowserBackendBase(rawBackendOrigin)));
        }
    }["Home.useEffect"], []);
    const toAbsoluteUrl = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Home.useCallback[toAbsoluteUrl]": (url)=>{
            if (!url) return null;
            if (/^https?:\/\//i.test(url)) return url;
            if (url.startsWith("/")) return "".concat(backendBase).concat(url);
            return "".concat(backendBase, "/").concat(url);
        }
    }["Home.useCallback[toAbsoluteUrl]"], [
        backendBase
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Home.useEffect": ()=>{
            if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
            ;
            var _window_localStorage_getItem;
            const storedKey = (_window_localStorage_getItem = window.localStorage.getItem("autonote:llmApiKey")) !== null && _window_localStorage_getItem !== void 0 ? _window_localStorage_getItem : "";
            const storedBase = window.localStorage.getItem("autonote:llmBaseUrl");
            setApiKey(storedKey);
            setLlmBaseUrl(storedBase && storedBase.trim().length > 0 ? storedBase : DEFAULT_LLM_BASE_URL);
            setHasLoadedSettings(true);
        }
    }["Home.useEffect"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Home.useEffect": ()=>{
            if (!hasLoadedSettings || "object" === "undefined") return;
            window.localStorage.setItem("autonote:llmApiKey", apiKey);
        }
    }["Home.useEffect"], [
        apiKey,
        hasLoadedSettings
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Home.useEffect": ()=>{
            if (!hasLoadedSettings || "object" === "undefined") return;
            window.localStorage.setItem("autonote:llmBaseUrl", llmBaseUrl);
        }
    }["Home.useEffect"], [
        llmBaseUrl,
        hasLoadedSettings
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Home.useEffect": ()=>{
            if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
            ;
            if (!analysisCompleteMessage) return undefined;
            const timer = window.setTimeout({
                "Home.useEffect.timer": ()=>{
                    setAnalysisCompleteMessage(null);
                }
            }["Home.useEffect.timer"], 4000);
            return ({
                "Home.useEffect": ()=>{
                    window.clearTimeout(timer);
                }
            })["Home.useEffect"];
        }
    }["Home.useEffect"], [
        analysisCompleteMessage
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Home.useEffect": ()=>{
            let objectUrl = null;
            let cancelled = false;
            if (!selectedFiles.length) {
                setFilePreviewUrl(null);
                setFilePreviewType("none");
                setFilePreviewContent("");
                return ({
                    "Home.useEffect": ()=>{
                        if (objectUrl) {
                            URL.revokeObjectURL(objectUrl);
                        }
                    }
                })["Home.useEffect"];
            }
            const file = selectedFiles[0];
            if (isPdfFile(file)) {
                objectUrl = URL.createObjectURL(file);
                if (!cancelled) {
                    setFilePreviewUrl(objectUrl);
                    setFilePreviewType("pdf");
                    setFilePreviewContent("");
                }
            } else if (isTextFile(file)) {
                const reader = new FileReader();
                reader.onload = ({
                    "Home.useEffect": ()=>{
                        if (!cancelled) {
                            var _ref;
                            setFilePreviewContent((_ref = reader.result) !== null && _ref !== void 0 ? _ref : "");
                            setFilePreviewUrl(null);
                            setFilePreviewType("text");
                        }
                    }
                })["Home.useEffect"];
                reader.readAsText(file, "utf-8");
            } else if (isImageFile(file)) {
                objectUrl = URL.createObjectURL(file);
                if (!cancelled) {
                    setFilePreviewUrl(objectUrl);
                    setFilePreviewType("image");
                    setFilePreviewContent("");
                }
            } else {
                objectUrl = URL.createObjectURL(file);
                if (!cancelled) {
                    setFilePreviewUrl(objectUrl);
                    setFilePreviewType("generic");
                    setFilePreviewContent("");
                }
            }
            return ({
                "Home.useEffect": ()=>{
                    cancelled = true;
                    if (objectUrl) {
                        URL.revokeObjectURL(objectUrl);
                    }
                }
            })["Home.useEffect"];
        }
    }["Home.useEffect"], [
        selectedFiles
    ]);
    const handleFilesSelected = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Home.useCallback[handleFilesSelected]": (files)=>{
            const fileArray = Array.from(files);
            if (fileArray.length === 0) return;
            if (fileArray.length > 1) {
                setError("一次僅能上傳 1 個檔案，已保留第一個檔案。");
            } else {
                setError(null);
            }
            const firstFile = fileArray[0];
            if (!firstFile) return;
            setSelectedFiles([
                firstFile
            ]);
            setAnalysisResult(null);
            setAnalysisCompleteMessage(null);
            setAnalysisProgress(null);
        }
    }["Home.useCallback[handleFilesSelected]"], []);
    const handleDrop = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Home.useCallback[handleDrop]": (event)=>{
            var _event_dataTransfer;
            event.preventDefault();
            setDragging(false);
            if ((_event_dataTransfer = event.dataTransfer) === null || _event_dataTransfer === void 0 ? void 0 : _event_dataTransfer.files) {
                handleFilesSelected(event.dataTransfer.files);
            }
        }
    }["Home.useCallback[handleDrop]"], [
        handleFilesSelected
    ]);
    const handleDragOver = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Home.useCallback[handleDragOver]": (event)=>{
            event.preventDefault();
            setDragging(true);
        }
    }["Home.useCallback[handleDragOver]"], []);
    const handleDragLeave = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Home.useCallback[handleDragLeave]": ()=>{
            setDragging(false);
        }
    }["Home.useCallback[handleDragLeave]"], []);
    var _selectedFiles__name;
    const selectedFileName = (_selectedFiles__name = (_selectedFiles_ = selectedFiles[0]) === null || _selectedFiles_ === void 0 ? void 0 : _selectedFiles_.name) !== null && _selectedFiles__name !== void 0 ? _selectedFiles__name : "";
    const handleAnalyze = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Home.useCallback[handleAnalyze]": async ()=>{
            if (!selectedFiles.length) {
                setError("請先選擇要上傳的檔案");
                return;
            }
            if (!apiKey.trim()) {
                setError("請先於右上角設定 API Key");
                setSettingsOpen(true);
                return;
            }
            setIsAnalyzing(true);
            setAnalysisCompleteMessage(null);
            setError(null);
            setAnalysisProgress({
                value: 5,
                message: "準備分析…"
            });
            try {
                const formData = new FormData();
                formData.append("file", selectedFiles[0]);
                formData.append("llm_api_key", apiKey);
                formData.append("analysis_level", analysisLevel);
                const cleanedBase = normalizeOptionalUrl(llmBaseUrl);
                if (cleanedBase) {
                    formData.append("llm_base_url", cleanedBase);
                }
                const analyzeEndpoint = "".concat(backendBase, "/analyze");
                const response = await fetch(analyzeEndpoint, {
                    method: "POST",
                    body: formData
                });
                if (!response.ok || !response.body) {
                    const text = await response.text();
                    throw new Error(text || "分析失敗，請稍後再試");
                }
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";
                let finalData = null;
                let serverError = null;
                let shouldStop = false;
                const handleLine = {
                    "Home.useCallback[handleAnalyze].handleLine": (line)=>{
                        if (!line) return;
                        try {
                            const event = JSON.parse(line);
                            if (event.type === "progress") {
                                var _event_message;
                                setAnalysisProgress({
                                    value: typeof event.progress === "number" ? Math.min(Math.max(event.progress, 0), 100) : 0,
                                    message: (_event_message = event.message) !== null && _event_message !== void 0 ? _event_message : ""
                                });
                            } else if (event.type === "result" && event.data) {
                                finalData = event.data;
                                var _event_message1;
                                setAnalysisProgress({
                                    value: typeof event.progress === "number" ? Math.min(Math.max(event.progress, 0), 100) : 100,
                                    message: (_event_message1 = event.message) !== null && _event_message1 !== void 0 ? _event_message1 : "分析完成"
                                });
                                shouldStop = true;
                            } else if (event.type === "error") {
                                serverError = event.message || "分析失敗";
                                setAnalysisProgress({
                                    value: 100,
                                    message: serverError
                                });
                                shouldStop = true;
                            }
                        } catch (err) {
                            console.error("無法解析伺服器訊息", err, line);
                        }
                    }
                }["Home.useCallback[handleAnalyze].handleLine"];
                while(true){
                    const { value, done } = await reader.read();
                    if (value) {
                        buffer += decoder.decode(value, {
                            stream: !done
                        });
                        let newlineIndex = buffer.indexOf("\n");
                        while(newlineIndex >= 0){
                            const line = buffer.slice(0, newlineIndex).trim();
                            buffer = buffer.slice(newlineIndex + 1);
                            handleLine(line);
                            newlineIndex = buffer.indexOf("\n");
                        }
                    }
                    if (done) {
                        const remaining = buffer.trim();
                        if (remaining) {
                            handleLine(remaining);
                        }
                        break;
                    }
                    if (shouldStop) {
                        // 嘗試讀完剩餘資料；若伺服器仍有內容會在下一輪完成。
                        if (!buffer.length) {
                            break;
                        }
                    }
                }
                if (serverError) {
                    throw new Error(serverError);
                }
                if (!finalData) {
                    throw new Error("未取得分析結果，請稍後再試");
                }
                const resolvedData = finalData;
                setAnalysisResult({
                    language: resolvedData.language,
                    total_pages: resolvedData.total_pages,
                    page_summaries: resolvedData.page_summaries,
                    global_summary: resolvedData.global_summary,
                    system_prompt: resolvedData.system_prompt,
                    wordcloud_image_url: toAbsoluteUrl(resolvedData.wordcloud_image_url)
                });
                setAnalysisCompleteMessage("分析結果已完成");
                window.setTimeout({
                    "Home.useCallback[handleAnalyze]": ()=>setAnalysisProgress(null)
                }["Home.useCallback[handleAnalyze]"], 1200);
            } catch (err) {
                const message = err instanceof Error ? err.message : "分析時發生未知錯誤";
                setError(message);
                setAnalysisResult(null);
                setAnalysisCompleteMessage(null);
                setAnalysisProgress(null);
            } finally{
                setIsAnalyzing(false);
            }
        }
    }["Home.useCallback[handleAnalyze]"], [
        selectedFiles,
        apiKey,
        llmBaseUrl,
        backendBase,
        toAbsoluteUrl,
        analysisLevel
    ]);
    const resetSelection = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Home.useCallback[resetSelection]": ()=>{
            setSelectedFiles([]);
            setAnalysisResult(null);
            setError(null);
            setAnalysisCompleteMessage(null);
            setAnalysisProgress(null);
        }
    }["Home.useCallback[resetSelection]"], []);
    const handleDownloadReport = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Home.useCallback[handleDownloadReport]": async ()=>{
            if (!analysisResult) {
                setError("請先完成檔案分析後再下載報告");
                return;
            }
            setIsDownloading(true);
            try {
                const languageLabel = analysisResult.language ? analysisResult.language.toUpperCase() : null;
                const pdfFontUrl = toAbsoluteUrl("/assets/fonts/Noto_Sans_TC/NotoSansTC-VariableFont_wght.ttf");
                var _analysisResult_wordcloud_image_url;
                const pdfBytes = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$generateAnalysisPdf$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["generateAnalysisPdf"])({
                    documentTitle: selectedFileName || "未命名檔案",
                    languageLabel,
                    totalPages: analysisResult.total_pages,
                    globalSummary: analysisResult.global_summary,
                    aggregatedKeywords,
                    pageSummaries: analysisResult.page_summaries,
                    wordcloudUrl: (_analysisResult_wordcloud_image_url = analysisResult.wordcloud_image_url) !== null && _analysisResult_wordcloud_image_url !== void 0 ? _analysisResult_wordcloud_image_url : undefined,
                    fontUrl: pdfFontUrl !== null && pdfFontUrl !== void 0 ? pdfFontUrl : undefined
                });
                const arrayBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength);
                const blob = new Blob([
                    arrayBuffer
                ], {
                    type: "application/pdf"
                });
                const downloadUrl = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                const baseName = (selectedFileName || "分析報告").replace(/\.[^/.]+$/, "").replace(/[\\/:*?"<>|]/g, "_");
                anchor.href = downloadUrl;
                anchor.download = "".concat(baseName || "分析報告", "-分析結果.pdf");
                document.body.appendChild(anchor);
                anchor.click();
                document.body.removeChild(anchor);
                URL.revokeObjectURL(downloadUrl);
            } catch (err) {
                console.error("生成 PDF 失敗", err);
                const message = err instanceof Error ? err.message : "PDF 生成時發生未知錯誤";
                setError(message);
            } finally{
                setIsDownloading(false);
            }
        }
    }["Home.useCallback[handleDownloadReport]"], [
        analysisResult,
        aggregatedKeywords,
        selectedFileName,
        toAbsoluteUrl
    ]);
    const renderUploadPreview = ()=>{
        if (!selectedFiles.length) {
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-500",
                children: "上傳檔案後即可在此預覽原始內容。"
            }, void 0, false, {
                fileName: "[project]/frontend/src/app/page.tsx",
                lineNumber: 507,
                columnNumber: 9
            }, this);
        }
        if (filePreviewType === "pdf" && filePreviewUrl) {
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("iframe", {
                title: "檔案預覽",
                src: filePreviewUrl,
                className: "h-full w-full rounded-2xl border border-slate-200 bg-white"
            }, void 0, false, {
                fileName: "[project]/frontend/src/app/page.tsx",
                lineNumber: 515,
                columnNumber: 9
            }, this);
        }
        if (filePreviewType === "image" && filePreviewUrl) {
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "relative h-full w-full overflow-hidden rounded-2xl border border-slate-200 bg-white",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                    src: filePreviewUrl,
                    alt: "選擇的圖片預覽",
                    fill: true,
                    className: "object-contain",
                    unoptimized: true
                }, void 0, false, {
                    fileName: "[project]/frontend/src/app/page.tsx",
                    lineNumber: 526,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/frontend/src/app/page.tsx",
                lineNumber: 525,
                columnNumber: 9
            }, this);
        }
        if (filePreviewType === "text") {
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "h-full overflow-y-auto rounded-2xl border border-slate-200 bg-white/90 p-4",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("pre", {
                    className: "whitespace-pre-wrap text-sm leading-6 text-slate-700",
                    children: filePreviewContent
                }, void 0, false, {
                    fileName: "[project]/frontend/src/app/page.tsx",
                    lineNumber: 540,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/frontend/src/app/page.tsx",
                lineNumber: 539,
                columnNumber: 9
            }, this);
        }
        if (filePreviewType === "generic" && filePreviewUrl) {
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("iframe", {
                title: "檔案預覽",
                src: filePreviewUrl,
                className: "h-full w-full rounded-2xl border border-slate-200 bg-white"
            }, void 0, false, {
                fileName: "[project]/frontend/src/app/page.tsx",
                lineNumber: 549,
                columnNumber: 9
            }, this);
        }
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-500",
            children: "此檔案格式暫不支援內嵌預覽，請重新選擇其他檔案。"
        }, void 0, false, {
            fileName: "[project]/frontend/src/app/page.tsx",
            lineNumber: 558,
            columnNumber: 7
        }, this);
    };
    const renderAnalysisPanel = ()=>{
        if (!analysisResult) {
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex min-h-[240px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/80 p-8 text-sm text-slate-500",
                children: "完成檔案分析後，全局摘要與逐頁重點將顯示於此處。"
            }, void 0, false, {
                fileName: "[project]/frontend/src/app/page.tsx",
                lineNumber: 567,
                columnNumber: 9
            }, this);
        }
        const languageLabel = analysisResult.language ? analysisResult.language.toUpperCase() : "";
        const classificationMap = {
            normal: "一般內容",
            toc: "目錄頁",
            pure_image: "純圖片",
            blank: "空白/水印",
            cover: "封面"
        };
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "space-y-8",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                    className: "space-y-6 rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-inner",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-wrap items-center gap-3 text-sm text-slate-500",
                            children: [
                                languageLabel ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600",
                                    children: [
                                        "語言：",
                                        languageLabel
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/frontend/src/app/page.tsx",
                                    lineNumber: 590,
                                    columnNumber: 15
                                }, this) : null,
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-600",
                                    children: [
                                        "共 ",
                                        analysisResult.total_pages,
                                        " 頁"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/frontend/src/app/page.tsx",
                                    lineNumber: 594,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/frontend/src/app/page.tsx",
                            lineNumber: 588,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-6",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                            className: "text-lg font-semibold text-slate-800",
                                            children: "全局總結"
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/app/page.tsx",
                                            lineNumber: 600,
                                            columnNumber: 15
                                        }, this),
                                        analysisResult.global_summary.bullets.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                            className: "mt-4 space-y-3 text-[15px] leading-7 text-slate-800",
                                            children: analysisResult.global_summary.bullets.map((item, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                    className: "rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3",
                                                    children: item
                                                }, "".concat(item, "-").concat(index), false, {
                                                    fileName: "[project]/frontend/src/app/page.tsx",
                                                    lineNumber: 604,
                                                    columnNumber: 21
                                                }, this))
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/app/page.tsx",
                                            lineNumber: 602,
                                            columnNumber: 17
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "mt-3 text-slate-500",
                                            children: "尚未取得全局摘要。"
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/app/page.tsx",
                                            lineNumber: 613,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/frontend/src/app/page.tsx",
                                    lineNumber: 599,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "grid gap-6 lg:grid-cols-3",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("article", {
                                            className: "rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h4", {
                                                    className: "text-sm font-semibold text-slate-600",
                                                    children: "關鍵結論"
                                                }, void 0, false, {
                                                    fileName: "[project]/frontend/src/app/page.tsx",
                                                    lineNumber: 618,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "mt-3 text-sm leading-7 text-slate-700",
                                                    children: analysisResult.global_summary.expansions.key_conclusions || "暫無資料"
                                                }, void 0, false, {
                                                    fileName: "[project]/frontend/src/app/page.tsx",
                                                    lineNumber: 619,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/frontend/src/app/page.tsx",
                                            lineNumber: 617,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("article", {
                                            className: "rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h4", {
                                                    className: "text-sm font-semibold text-slate-600",
                                                    children: "核心數據與依據"
                                                }, void 0, false, {
                                                    fileName: "[project]/frontend/src/app/page.tsx",
                                                    lineNumber: 624,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "mt-3 text-sm leading-7 text-slate-700",
                                                    children: analysisResult.global_summary.expansions.core_data || "暫無資料"
                                                }, void 0, false, {
                                                    fileName: "[project]/frontend/src/app/page.tsx",
                                                    lineNumber: 625,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/frontend/src/app/page.tsx",
                                            lineNumber: 623,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("article", {
                                            className: "rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h4", {
                                                    className: "text-sm font-semibold text-slate-600",
                                                    children: "風險與建議"
                                                }, void 0, false, {
                                                    fileName: "[project]/frontend/src/app/page.tsx",
                                                    lineNumber: 630,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "mt-3 text-sm leading-7 text-slate-700",
                                                    children: analysisResult.global_summary.expansions.risks_and_actions || "暫無資料"
                                                }, void 0, false, {
                                                    fileName: "[project]/frontend/src/app/page.tsx",
                                                    lineNumber: 631,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/frontend/src/app/page.tsx",
                                            lineNumber: 629,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/frontend/src/app/page.tsx",
                                    lineNumber: 616,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/frontend/src/app/page.tsx",
                            lineNumber: 598,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "grid gap-6 lg:grid-cols-[2fr_1fr]",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "rounded-2xl border border-slate-200 bg-white/90 p-5",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h4", {
                                            className: "text-sm font-semibold text-slate-600",
                                            children: "整體關鍵字"
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/app/page.tsx",
                                            lineNumber: 639,
                                            columnNumber: 15
                                        }, this),
                                        aggregatedKeywords.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "mt-3 flex flex-wrap gap-2",
                                            children: aggregatedKeywords.map((kw)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-600",
                                                    children: kw
                                                }, kw, false, {
                                                    fileName: "[project]/frontend/src/app/page.tsx",
                                                    lineNumber: 643,
                                                    columnNumber: 21
                                                }, this))
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/app/page.tsx",
                                            lineNumber: 641,
                                            columnNumber: 17
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "mt-3 text-sm text-slate-500",
                                            children: "暫無關鍵字可顯示。"
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/app/page.tsx",
                                            lineNumber: 652,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/frontend/src/app/page.tsx",
                                    lineNumber: 638,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "rounded-2xl border border-slate-200 bg-white/90 p-5",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h4", {
                                            className: "text-sm font-semibold text-slate-600",
                                            children: "文字雲"
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/app/page.tsx",
                                            lineNumber: 656,
                                            columnNumber: 15
                                        }, this),
                                        analysisResult.wordcloud_image_url ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-200",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                                src: analysisResult.wordcloud_image_url,
                                                alt: "關鍵字文字雲",
                                                fill: true,
                                                className: "object-contain",
                                                unoptimized: true
                                            }, void 0, false, {
                                                fileName: "[project]/frontend/src/app/page.tsx",
                                                lineNumber: 659,
                                                columnNumber: 19
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/app/page.tsx",
                                            lineNumber: 658,
                                            columnNumber: 17
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "mt-3 text-sm text-slate-500",
                                            children: "尚未取得文字雲。"
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/app/page.tsx",
                                            lineNumber: 668,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/frontend/src/app/page.tsx",
                                    lineNumber: 655,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/frontend/src/app/page.tsx",
                            lineNumber: 637,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/frontend/src/app/page.tsx",
                    lineNumber: 587,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                    className: "space-y-5 rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-inner",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                            className: "text-lg font-semibold text-slate-800",
                            children: "逐頁重點與關鍵字"
                        }, void 0, false, {
                            fileName: "[project]/frontend/src/app/page.tsx",
                            lineNumber: 675,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-5 max-h-[520px] overflow-y-auto pr-2",
                            children: analysisResult.page_summaries.map((page)=>{
                                var _classificationMap_page_classification;
                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("article", {
                                    className: "rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex flex-wrap items-center justify-between gap-3",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex flex-wrap items-center gap-2",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "text-sm font-semibold text-slate-700",
                                                        children: [
                                                            "第 ",
                                                            page.page_number,
                                                            " 頁"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/frontend/src/app/page.tsx",
                                                        lineNumber: 684,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600",
                                                        children: (_classificationMap_page_classification = classificationMap[page.classification]) !== null && _classificationMap_page_classification !== void 0 ? _classificationMap_page_classification : page.classification
                                                    }, void 0, false, {
                                                        fileName: "[project]/frontend/src/app/page.tsx",
                                                        lineNumber: 687,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/frontend/src/app/page.tsx",
                                                lineNumber: 683,
                                                columnNumber: 19
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/app/page.tsx",
                                            lineNumber: 682,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                            className: "mt-3 space-y-2 text-sm leading-7 text-slate-700",
                                            children: page.bullets.map((bullet, idx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                    className: "rounded-xl bg-slate-50/80 px-3 py-2",
                                                    children: bullet
                                                }, "".concat(page.page_number, "-").concat(idx), false, {
                                                    fileName: "[project]/frontend/src/app/page.tsx",
                                                    lineNumber: 694,
                                                    columnNumber: 21
                                                }, this))
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/app/page.tsx",
                                            lineNumber: 692,
                                            columnNumber: 17
                                        }, this),
                                        page.keywords.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "mt-3 flex flex-wrap gap-2 text-xs",
                                            children: page.keywords.map((kw)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600",
                                                    children: kw
                                                }, "".concat(page.page_number, "-").concat(kw), false, {
                                                    fileName: "[project]/frontend/src/app/page.tsx",
                                                    lineNumber: 702,
                                                    columnNumber: 23
                                                }, this))
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/app/page.tsx",
                                            lineNumber: 700,
                                            columnNumber: 19
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "mt-3 text-xs text-slate-400",
                                            children: "本頁尚無關鍵字。"
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/app/page.tsx",
                                            lineNumber: 711,
                                            columnNumber: 19
                                        }, this),
                                        page.skipped && page.skip_reason ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "mt-3 text-xs text-slate-500",
                                            children: [
                                                "原因：",
                                                page.skip_reason
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/frontend/src/app/page.tsx",
                                            lineNumber: 714,
                                            columnNumber: 19
                                        }, this) : null
                                    ]
                                }, page.page_number, true, {
                                    fileName: "[project]/frontend/src/app/page.tsx",
                                    lineNumber: 678,
                                    columnNumber: 15
                                }, this);
                            })
                        }, void 0, false, {
                            fileName: "[project]/frontend/src/app/page.tsx",
                            lineNumber: 676,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/frontend/src/app/page.tsx",
                    lineNumber: 674,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/frontend/src/app/page.tsx",
            lineNumber: 586,
            columnNumber: 7
        }, this);
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "min-h-screen bg-gradient-to-br from-[#f6f8ff] via-[#f4f7fb] to-[#edf1ff] text-slate-900",
        children: [
            analysisCompleteMessage ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "fixed right-6 top-6 z-50 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700 shadow-lg",
                children: analysisCompleteMessage
            }, void 0, false, {
                fileName: "[project]/frontend/src/app/page.tsx",
                lineNumber: 727,
                columnNumber: 9
            }, this) : null,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                className: "grid grid-cols-[1fr_auto_1fr] items-center px-8 pt-8",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        "aria-hidden": true
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/app/page.tsx",
                        lineNumber: 732,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "col-start-2 col-end-3 flex items-center justify-center gap-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-500 text-2xl text-white shadow-lg",
                                children: "📄"
                            }, void 0, false, {
                                fileName: "[project]/frontend/src/app/page.tsx",
                                lineNumber: 734,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-center",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-xl font-semibold text-slate-900",
                                        children: "AutoNote & Slide"
                                    }, void 0, false, {
                                        fileName: "[project]/frontend/src/app/page.tsx",
                                        lineNumber: 738,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-sm text-slate-500",
                                        children: "智慧文檔處理平台"
                                    }, void 0, false, {
                                        fileName: "[project]/frontend/src/app/page.tsx",
                                        lineNumber: 739,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/frontend/src/app/page.tsx",
                                lineNumber: 737,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/frontend/src/app/page.tsx",
                        lineNumber: 733,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: ()=>setSettingsOpen(true),
                        className: "group col-start-3 col-end-4 justify-self-end rounded-2xl border border-white/60 bg-white/80 p-3 shadow-lg transition hover:shadow-xl",
                        "aria-label": "開啟 API 設定",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                            xmlns: "http://www.w3.org/2000/svg",
                            viewBox: "0 0 24 24",
                            fill: "none",
                            stroke: "currentColor",
                            strokeWidth: "1.6",
                            className: "h-6 w-6 text-slate-600 transition group-hover:text-slate-900",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                    strokeLinecap: "round",
                                    strokeLinejoin: "round",
                                    d: "M10.325 4.317a1 1 0 0 1 .894-.553h1.562a1 1 0 0 1 .894.553l.482.964a1 1 0 0 0 .764.553l1.064.12a1 1 0 0 1 .874.874l.12 1.064a1 1 0 0 0 .553.764l.964.482a1 1 0 0 1 .553.894v1.562a1 1 0 0 1-.553.894l-.964.482a1 1 0 0 0-.553.764l-.12 1.064a1 1 0 0 1-.874.874l-1.064.12a1 1 0 0 0-.764.553l-.482.964a1 1 0 0 1-.894.553h-1.562a1 1 0 0 1-.894-.553l-.482-.964a1 1 0 0 0-.764-.553l-1.064-.12a1 1 0 0 1-.874-.874l-.12-1.064a1 1 0 0 0-.553-.764l-.964-.482a1 1 0 0 1-.553-.894v-1.562a1 1 0 0 1 .553-.894l.964-.482a1 1 0 0 0 .553-.764l.12-1.064a1 1 0 0 1 .874-.874l1.064-.12a1 1 0 0 0 .764-.553l.482-.964Z"
                                }, void 0, false, {
                                    fileName: "[project]/frontend/src/app/page.tsx",
                                    lineNumber: 756,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                    strokeLinecap: "round",
                                    strokeLinejoin: "round",
                                    d: "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                                }, void 0, false, {
                                    fileName: "[project]/frontend/src/app/page.tsx",
                                    lineNumber: 761,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/frontend/src/app/page.tsx",
                            lineNumber: 748,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/app/page.tsx",
                        lineNumber: 742,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/frontend/src/app/page.tsx",
                lineNumber: 731,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
                className: "mx-auto mt-8 max-w-[1400px] px-8 pb-20 lg:px-10",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-3xl border border-amber-100 bg-gradient-to-r from-amber-50 to-amber-100/70 px-8 py-5 text-sm font-medium text-amber-800 shadow-sm text-center lg:text-base",
                        children: "目前僅支援電腦端使用，請使用電腦瀏覽器獲得最佳體驗"
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/app/page.tsx",
                        lineNumber: 771,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mt-10 space-y-10",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "grid grid-cols-1 gap-10 xl:grid-cols-2 xl:items-stretch",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                                        className: "relative flex w-full flex-col rounded-[40px] border border-white/60 bg-white/95 p-10 shadow-2xl lg:min-h-[620px] xl:min-h-[700px]",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "mt-10 flex flex-1 flex-col items-center gap-6 text-center",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex min-h-[420px] w-full flex-col items-center justify-center gap-6 rounded-3xl border-2 border-dashed bg-gradient-to-br from-slate-50 to-slate-100/70 p-10 transition ".concat(dragging ? "border-indigo-400 bg-indigo-50/70" : "border-slate-200"),
                                                    onDragOver: handleDragOver,
                                                    onDragLeave: handleDragLeave,
                                                    onDrop: handleDrop,
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                            htmlFor: fileInputId,
                                                            className: "sr-only",
                                                            children: "選擇要分析的檔案"
                                                        }, void 0, false, {
                                                            fileName: "[project]/frontend/src/app/page.tsx",
                                                            lineNumber: 785,
                                                            columnNumber: 17
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                            id: fileInputId,
                                                            ref: fileInputRef,
                                                            type: "file",
                                                            accept: ".pdf",
                                                            multiple: false,
                                                            className: "sr-only",
                                                            "aria-describedby": uploadHelpId,
                                                            onChange: (event)=>{
                                                                if (event.target.files) {
                                                                    handleFilesSelected(event.target.files);
                                                                }
                                                            }
                                                        }, void 0, false, {
                                                            fileName: "[project]/frontend/src/app/page.tsx",
                                                            lineNumber: 788,
                                                            columnNumber: 17
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex h-28 w-28 items-center justify-center rounded-[36px] bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 text-4xl text-white shadow-xl",
                                                            children: "⬆️"
                                                        }, void 0, false, {
                                                            fileName: "[project]/frontend/src/app/page.tsx",
                                                            lineNumber: 802,
                                                            columnNumber: 17
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex max-w-xl flex-col gap-3",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                                                    className: "text-3xl font-semibold text-slate-900",
                                                                    children: "上傳您的檔案"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/frontend/src/app/page.tsx",
                                                                    lineNumber: 806,
                                                                    columnNumber: 19
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                    className: "text-base leading-7 text-slate-600",
                                                                    children: "將檔案拖放到此處，或點擊任何地方瀏覽檔案。上傳後系統會整理每頁重點並彙整全局摘要。"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/frontend/src/app/page.tsx",
                                                                    lineNumber: 807,
                                                                    columnNumber: 19
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/frontend/src/app/page.tsx",
                                                            lineNumber: 805,
                                                            columnNumber: 17
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            type: "button",
                                                            onClick: ()=>{
                                                                var _fileInputRef_current;
                                                                return (_fileInputRef_current = fileInputRef.current) === null || _fileInputRef_current === void 0 ? void 0 : _fileInputRef_current.click();
                                                            },
                                                            className: "rounded-full bg-slate-900 px-6 py-2 text-sm font-medium text-white shadow-lg transition hover:bg-slate-700",
                                                            children: "選擇檔案"
                                                        }, void 0, false, {
                                                            fileName: "[project]/frontend/src/app/page.tsx",
                                                            lineNumber: 811,
                                                            columnNumber: 17
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            id: uploadHelpId,
                                                            className: "text-xs leading-6 text-slate-500",
                                                            children: [
                                                                "支援格式：PDF",
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("br", {}, void 0, false, {
                                                                    fileName: "[project]/frontend/src/app/page.tsx",
                                                                    lineNumber: 820,
                                                                    columnNumber: 19
                                                                }, this),
                                                                "最大檔案大小：50MB，一次僅能上傳 1 份檔案"
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/frontend/src/app/page.tsx",
                                                            lineNumber: 818,
                                                            columnNumber: 17
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex flex-wrap justify-center gap-3 text-sm font-medium",
                                                            children: fileTypes.map((type)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "".concat(type.color, " rounded-full bg-white px-3 py-1 shadow-sm"),
                                                                    children: type.label
                                                                }, type.label, false, {
                                                                    fileName: "[project]/frontend/src/app/page.tsx",
                                                                    lineNumber: 825,
                                                                    columnNumber: 21
                                                                }, this))
                                                        }, void 0, false, {
                                                            fileName: "[project]/frontend/src/app/page.tsx",
                                                            lineNumber: 823,
                                                            columnNumber: 17
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/frontend/src/app/page.tsx",
                                                    lineNumber: 779,
                                                    columnNumber: 15
                                                }, this),
                                                selectedFiles.length > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "w-full rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-left text-sm text-slate-600",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex items-center justify-between",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                        className: "font-medium text-slate-800",
                                                                        children: "已選擇檔案"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/frontend/src/app/page.tsx",
                                                                        lineNumber: 839,
                                                                        columnNumber: 23
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                        className: "mt-1 text-sm text-slate-600",
                                                                        children: selectedFileName
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/frontend/src/app/page.tsx",
                                                                        lineNumber: 840,
                                                                        columnNumber: 23
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                        className: "mt-1 text-xs text-slate-500",
                                                                        children: [
                                                                            "檔案大小：",
                                                                            formatBytes(selectedFiles[0].size)
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/frontend/src/app/page.tsx",
                                                                        lineNumber: 841,
                                                                        columnNumber: 23
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/frontend/src/app/page.tsx",
                                                                lineNumber: 838,
                                                                columnNumber: 21
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                type: "button",
                                                                onClick: resetSelection,
                                                                className: "text-xs font-medium text-rose-500 hover:text-rose-600",
                                                                children: "重新選擇"
                                                            }, void 0, false, {
                                                                fileName: "[project]/frontend/src/app/page.tsx",
                                                                lineNumber: 845,
                                                                columnNumber: 21
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/frontend/src/app/page.tsx",
                                                        lineNumber: 837,
                                                        columnNumber: 19
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/frontend/src/app/page.tsx",
                                                    lineNumber: 836,
                                                    columnNumber: 17
                                                }, this) : null,
                                                error ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "w-full rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600",
                                                    children: error
                                                }, void 0, false, {
                                                    fileName: "[project]/frontend/src/app/page.tsx",
                                                    lineNumber: 857,
                                                    columnNumber: 17
                                                }, this) : null,
                                                analysisProgress ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "w-full space-y-2 text-left",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex items-center justify-between text-xs text-slate-500",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    children: analysisProgress.message || "分析中"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/frontend/src/app/page.tsx",
                                                                    lineNumber: 865,
                                                                    columnNumber: 21
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    children: [
                                                                        analysisProgress.value,
                                                                        "%"
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/frontend/src/app/page.tsx",
                                                                    lineNumber: 866,
                                                                    columnNumber: 21
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/frontend/src/app/page.tsx",
                                                            lineNumber: 864,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "h-2 w-full rounded-full bg-slate-200",
                                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all",
                                                                style: {
                                                                    width: "".concat(Math.min(Math.max(analysisProgress.value, 0), 100), "%")
                                                                }
                                                            }, void 0, false, {
                                                                fileName: "[project]/frontend/src/app/page.tsx",
                                                                lineNumber: 869,
                                                                columnNumber: 21
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/frontend/src/app/page.tsx",
                                                            lineNumber: 868,
                                                            columnNumber: 19
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/frontend/src/app/page.tsx",
                                                    lineNumber: 863,
                                                    columnNumber: 17
                                                }, this) : null,
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "w-full space-y-4",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                            type: "radio",
                                                                            name: "analysis_level",
                                                                            id: "level_light",
                                                                            value: "light",
                                                                            checked: analysisLevel === "light",
                                                                            onChange: (e)=>setAnalysisLevel(e.target.value),
                                                                            className: "sr-only"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/frontend/src/app/page.tsx",
                                                                            lineNumber: 880,
                                                                            columnNumber: 21
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                                            htmlFor: "level_light",
                                                                            className: "block cursor-pointer rounded-lg py-2 text-center text-sm font-medium ".concat(analysisLevel === "light" ? "bg-white text-indigo-600 shadow" : "text-slate-500"),
                                                                            children: "5-nano"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/frontend/src/app/page.tsx",
                                                                            lineNumber: 881,
                                                                            columnNumber: 21
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/frontend/src/app/page.tsx",
                                                                    lineNumber: 879,
                                                                    columnNumber: 19
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                            type: "radio",
                                                                            name: "analysis_level",
                                                                            id: "level_medium",
                                                                            value: "medium",
                                                                            checked: analysisLevel === "medium",
                                                                            onChange: (e)=>setAnalysisLevel(e.target.value),
                                                                            className: "sr-only"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/frontend/src/app/page.tsx",
                                                                            lineNumber: 884,
                                                                            columnNumber: 21
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                                            htmlFor: "level_medium",
                                                                            className: "block cursor-pointer rounded-lg py-2 text-center text-sm font-medium ".concat(analysisLevel === "medium" ? "bg-white text-indigo-600 shadow" : "text-slate-500"),
                                                                            children: "5-mini"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/frontend/src/app/page.tsx",
                                                                            lineNumber: 885,
                                                                            columnNumber: 21
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/frontend/src/app/page.tsx",
                                                                    lineNumber: 883,
                                                                    columnNumber: 19
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                            type: "radio",
                                                                            name: "analysis_level",
                                                                            id: "level_deep",
                                                                            value: "deep",
                                                                            checked: analysisLevel === "deep",
                                                                            onChange: (e)=>setAnalysisLevel(e.target.value),
                                                                            className: "sr-only"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/frontend/src/app/page.tsx",
                                                                            lineNumber: 888,
                                                                            columnNumber: 21
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                                            htmlFor: "level_deep",
                                                                            className: "block cursor-pointer rounded-lg py-2 text-center text-sm font-medium ".concat(analysisLevel === "deep" ? "bg-white text-indigo-600 shadow" : "text-slate-500"),
                                                                            children: "5.1"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/frontend/src/app/page.tsx",
                                                                            lineNumber: 889,
                                                                            columnNumber: 21
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/frontend/src/app/page.tsx",
                                                                    lineNumber: 887,
                                                                    columnNumber: 19
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/frontend/src/app/page.tsx",
                                                            lineNumber: 878,
                                                            columnNumber: 17
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            type: "button",
                                                            onClick: handleAnalyze,
                                                            disabled: isAnalyzing,
                                                            className: "inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-500 to-blue-500 px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:from-indigo-600 hover:to-blue-600 disabled:cursor-not-allowed disabled:opacity-60",
                                                            children: isAnalyzing ? "分析中…" : "開始分析"
                                                        }, void 0, false, {
                                                            fileName: "[project]/frontend/src/app/page.tsx",
                                                            lineNumber: 892,
                                                            columnNumber: 17
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/frontend/src/app/page.tsx",
                                                    lineNumber: 877,
                                                    columnNumber: 15
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/frontend/src/app/page.tsx",
                                            lineNumber: 778,
                                            columnNumber: 13
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/frontend/src/app/page.tsx",
                                        lineNumber: 777,
                                        columnNumber: 11
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                                        className: "relative flex w-full flex-col rounded-[40px] border border-white/60 bg-white/95 p-10 shadow-2xl lg:min-h-[620px] xl:min-h-[700px]",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex flex-col items-center gap-4 text-center",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                                            className: "text-3xl font-semibold text-slate-900",
                                                            children: "檔案預覽"
                                                        }, void 0, false, {
                                                            fileName: "[project]/frontend/src/app/page.tsx",
                                                            lineNumber: 907,
                                                            columnNumber: 17
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "mt-3 text-base text-slate-600",
                                                            children: "左側上傳檔案後，可在此預覽原始檔案內容。"
                                                        }, void 0, false, {
                                                            fileName: "[project]/frontend/src/app/page.tsx",
                                                            lineNumber: 908,
                                                            columnNumber: 17
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/frontend/src/app/page.tsx",
                                                    lineNumber: 906,
                                                    columnNumber: 15
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/frontend/src/app/page.tsx",
                                                lineNumber: 905,
                                                columnNumber: 13
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "mt-6 flex-1 overflow-hidden rounded-[28px] bg-slate-50/90 p-4",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "h-full w-full",
                                                    children: renderUploadPreview()
                                                }, void 0, false, {
                                                    fileName: "[project]/frontend/src/app/page.tsx",
                                                    lineNumber: 914,
                                                    columnNumber: 15
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/frontend/src/app/page.tsx",
                                                lineNumber: 913,
                                                columnNumber: 13
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/frontend/src/app/page.tsx",
                                        lineNumber: 904,
                                        columnNumber: 11
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/frontend/src/app/page.tsx",
                                lineNumber: 776,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                                className: "relative w-full rounded-[40px] border border-white/60 bg-white/95 p-10 shadow-2xl",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex flex-col gap-4 text-center lg:flex-row lg:items-center lg:justify-between",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "lg:text-left",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                                        className: "text-3xl font-semibold text-slate-900",
                                                        children: "分析結果整理"
                                                    }, void 0, false, {
                                                        fileName: "[project]/frontend/src/app/page.tsx",
                                                        lineNumber: 922,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "mt-3 text-base text-slate-600",
                                                        children: "檔案分析完成後，全局摘要與逐頁重點會集中顯示在此區域。"
                                                    }, void 0, false, {
                                                        fileName: "[project]/frontend/src/app/page.tsx",
                                                        lineNumber: 923,
                                                        columnNumber: 17
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/frontend/src/app/page.tsx",
                                                lineNumber: 921,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex flex-col items-center gap-2 lg:items-end",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        type: "button",
                                                        onClick: ()=>void handleDownloadReport(),
                                                        disabled: !analysisResult || isDownloading || isAnalyzing,
                                                        className: "inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition ".concat(!analysisResult || isDownloading || isAnalyzing ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400" : "border border-emerald-200 bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg hover:from-emerald-600 hover:to-teal-600"),
                                                        children: [
                                                            isDownloading ? "PDF 準備中…" : "下載 PDF 報告",
                                                            !isDownloading ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                                                xmlns: "http://www.w3.org/2000/svg",
                                                                viewBox: "0 0 24 24",
                                                                fill: "none",
                                                                stroke: "currentColor",
                                                                strokeWidth: "1.5",
                                                                className: "h-4 w-4",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                                                        strokeLinecap: "round",
                                                                        strokeLinejoin: "round",
                                                                        d: "M4 16.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/frontend/src/app/page.tsx",
                                                                        lineNumber: 947,
                                                                        columnNumber: 23
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                                                        strokeLinecap: "round",
                                                                        strokeLinejoin: "round",
                                                                        d: "M12 5v11m0 0-3.5-3.5M12 16l3.5-3.5"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/frontend/src/app/page.tsx",
                                                                        lineNumber: 948,
                                                                        columnNumber: 23
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/frontend/src/app/page.tsx",
                                                                lineNumber: 939,
                                                                columnNumber: 21
                                                            }, this) : null
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/frontend/src/app/page.tsx",
                                                        lineNumber: 928,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-xs text-slate-400",
                                                        children: "PDF 將包含摘要、關鍵字與文字雲"
                                                    }, void 0, false, {
                                                        fileName: "[project]/frontend/src/app/page.tsx",
                                                        lineNumber: 952,
                                                        columnNumber: 17
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/frontend/src/app/page.tsx",
                                                lineNumber: 927,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/frontend/src/app/page.tsx",
                                        lineNumber: 920,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "mt-6",
                                        children: renderAnalysisPanel()
                                    }, void 0, false, {
                                        fileName: "[project]/frontend/src/app/page.tsx",
                                        lineNumber: 955,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/frontend/src/app/page.tsx",
                                lineNumber: 919,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/frontend/src/app/page.tsx",
                        lineNumber: 775,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/frontend/src/app/page.tsx",
                lineNumber: 770,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("footer", {
                className: "pb-8 text-center",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-sm text-slate-500",
                    children: "Powered by OpenAI"
                }, void 0, false, {
                    fileName: "[project]/frontend/src/app/page.tsx",
                    lineNumber: 961,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/frontend/src/app/page.tsx",
                lineNumber: 960,
                columnNumber: 7
            }, this),
            settingsOpen ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "w-full max-w-md rounded-3xl border border-white/60 bg-white/95 p-6 shadow-2xl",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center justify-between",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                            className: "text-lg font-semibold text-slate-900",
                                            children: "API 設定"
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/app/page.tsx",
                                            lineNumber: 971,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-sm text-slate-500",
                                            children: "請輸入您的 LLM API Key 與 Base URL"
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/app/page.tsx",
                                            lineNumber: 972,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/frontend/src/app/page.tsx",
                                    lineNumber: 970,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: ()=>setSettingsOpen(false),
                                    className: "rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600",
                                    "aria-label": "關閉設定",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                        xmlns: "http://www.w3.org/2000/svg",
                                        viewBox: "0 0 24 24",
                                        fill: "none",
                                        stroke: "currentColor",
                                        strokeWidth: "1.8",
                                        className: "h-5 w-5",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                            strokeLinecap: "round",
                                            strokeLinejoin: "round",
                                            d: "m6 6 12 12M18 6 6 18"
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/app/page.tsx",
                                            lineNumber: 988,
                                            columnNumber: 19
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/frontend/src/app/page.tsx",
                                        lineNumber: 980,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/frontend/src/app/page.tsx",
                                    lineNumber: 974,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/frontend/src/app/page.tsx",
                            lineNumber: 969,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mt-6 space-y-5",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            className: "text-sm font-medium text-slate-700",
                                            htmlFor: "apiKey",
                                            children: "API Key"
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/app/page.tsx",
                                            lineNumber: 994,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            id: "apiKey",
                                            type: "password",
                                            value: apiKey,
                                            onChange: (event)=>setApiKey(event.target.value),
                                            placeholder: "請輸入您的 API Key",
                                            className: "mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-inner focus:border-indigo-400 focus:outline-none"
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/app/page.tsx",
                                            lineNumber: 997,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/frontend/src/app/page.tsx",
                                    lineNumber: 993,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            className: "text-sm font-medium text-slate-700",
                                            htmlFor: "llmBaseUrlInput",
                                            children: "base url（可選填）"
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/app/page.tsx",
                                            lineNumber: 1007,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            id: "llmBaseUrlInput",
                                            type: "url",
                                            value: llmBaseUrl,
                                            onChange: (event)=>setLlmBaseUrl(event.target.value),
                                            placeholder: "https://api.openai.com/v1",
                                            className: "mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-inner focus:border-indigo-400 focus:outline-none"
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/app/page.tsx",
                                            lineNumber: 1010,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "mt-2 text-xs text-slate-400",
                                            children: "若未填寫將沿用預設 base url：https://api.openai.com/v1。"
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/app/page.tsx",
                                            lineNumber: 1018,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/frontend/src/app/page.tsx",
                                    lineNumber: 1006,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/frontend/src/app/page.tsx",
                            lineNumber: 992,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mt-6 flex justify-end gap-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: ()=>setSettingsOpen(false),
                                    className: "rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100",
                                    children: "取消"
                                }, void 0, false, {
                                    fileName: "[project]/frontend/src/app/page.tsx",
                                    lineNumber: 1024,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: ()=>setSettingsOpen(false),
                                    className: "rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-600",
                                    children: "確認"
                                }, void 0, false, {
                                    fileName: "[project]/frontend/src/app/page.tsx",
                                    lineNumber: 1031,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/frontend/src/app/page.tsx",
                            lineNumber: 1023,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/frontend/src/app/page.tsx",
                    lineNumber: 968,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/frontend/src/app/page.tsx",
                lineNumber: 967,
                columnNumber: 9
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/frontend/src/app/page.tsx",
        lineNumber: 725,
        columnNumber: 5
    }, this);
}
_s(Home, "XZ5iAFLOyg0IxMNWDlC7GGxTARg=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"]
    ];
});
_c = Home;
var _c;
__turbopack_context__.k.register(_c, "Home");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=frontend_src_c93232f5._.js.map