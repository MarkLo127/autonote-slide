import asyncio
import json
import os
from typing import Optional
from enum import Enum

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from backend.app.models.schemas import AnalyzeResponse, LLMSettings, PageSummary, Paragraph, MODEL_PROVIDERS, MODEL_LEVEL_MAPPING
from backend.app.services.analyze.page_classifier import classify_page
from backend.app.services.analyze.page_parser import parse_pages
from backend.app.services.analyze.summary_engine import SummaryEngine, SYSTEM_PROMPT
from backend.app.services.nlp.language_detect import detect_lang, determine_visual_language
from backend.app.services.nlp.keyword_extractor import extract_keywords_by_paragraph
from backend.app.services.storage import make_public_url, save_upload
from backend.app.services.wordcloud.wordcloud_gen import build_wordcloud

router = APIRouter(prefix="/analyze", tags=["analyze"])

class AnalysisLevel(str, Enum):
    LIGHT = "light"
    MEDIUM = "medium"
    DEEP = "deep"

@router.get("/providers")
async def get_providers():
    """取得所有可用的 LLM 供應商與模型資訊"""
    return {
        "providers": MODEL_PROVIDERS,
        "level_mapping": MODEL_LEVEL_MAPPING
    }


@router.post("")
async def analyze_file(
    file: UploadFile = File(...),
    llm_api_key: str = Form(...),
    llm_model: str = Form("gpt-5-mini-2025-08-07"),
    llm_provider: Optional[str] = Form(None),
    llm_base_url: Optional[str] = Form(None),
    analysis_level: Optional[AnalysisLevel] = Form(None),
    enable_vision: bool = Form(False),  # 是否啟用圖片分析
    pdf_parser: Optional[str] = Form(None),  # PDF 解析引擎: "pymupdf4llm" 或 "marker"
):
    if not file.filename:
        raise HTTPException(400, "檔案名稱缺失，請重新上傳。")

    try:
        content = await file.read()
    finally:
        await file.close()

    async def generator(content: bytes, filename: str):
        queue = asyncio.Queue()

        async def push_event(payload: dict):
            await queue.put(json.dumps(payload, ensure_ascii=False) + "\n")

        async def run_summarizer():
            try:
                await push_event({"type": "progress", "progress": 5, "message": "開始儲存檔案"})
                saved_path = save_upload(content, filename)
                await push_event({"type": "progress", "progress": 12, "message": "檔案儲存完成"})

                # 決定要使用的模型
                # 優先級：1. 用户明确选择的模型 (llm_model) -> 2. analysis_level + provider 自动选择
                from backend.app.models.schemas import MODEL_PROVIDERS, MODEL_LEVEL_MAPPING
                
                actual_base_url = llm_base_url
                selected_model = llm_model  # 默认使用用户选择的模型
                
                # 只有当用户没有提供模型时，才使用 analysis_level 进行自动选择
                if (not llm_model or llm_model.strip() == "") and analysis_level and llm_provider:
                    # 使用分析级别和供应商来自动选择模型
                    if llm_provider in MODEL_LEVEL_MAPPING:
                        level_str = analysis_level.value if hasattr(analysis_level, 'value') else str(analysis_level)
                        selected_model = MODEL_LEVEL_MAPPING[llm_provider].get(level_str, llm_model)
                
                # 设置 base_url
                if not actual_base_url and llm_provider and llm_provider in MODEL_PROVIDERS:
                    actual_base_url = MODEL_PROVIDERS[llm_provider]["base_url"]

                # 使用 from_model 自動配置，並支援 Vision
                settings = LLMSettings.from_model(
                    api_key=llm_api_key,
                    base_url=actual_base_url,
                    model=selected_model,
                    enable_vision=enable_vision
                )
                
                # 調試日誌
                import logging
                logger = logging.getLogger(__name__)
                logger.info(f"API 請求配置: model={selected_model}, "
                           f"max_requests_per_minute={settings.max_requests_per_minute}, "
                           f"concurrency={settings.concurrency}, "
                           f"request_delay={settings.request_delay}")

                _, ext = os.path.splitext(filename)
                
                # 添加 PDF 轉 Markdown 的進度提示
                if ext.lower() == ".pdf":
                    await push_event({
                        "type": "progress",
                        "progress": 15,
                        "message": "正在將 PDF 轉換為 Markdown 格式..."
                    })
                
                # 如果用戶指定了 PDF 解析引擎，臨時覆寫配置
                original_parser = None
                if pdf_parser and ext.lower() == ".pdf":
                    import backend.app.core.config as config_module
                    original_parser = config_module.PDF_PARSER_ENGINE
                    config_module.PDF_PARSER_ENGINE = pdf_parser.lower()
                    logger.info(f"用戶指定 PDF 解析引擎: {pdf_parser}")
                
                try:
                    # 如果啟用 Vision，創建 vision_analyzer
                    vision_analyzer = None
                    vision_settings = None
                    if settings.enable_vision:
                        from backend.app.services.analyze.vision_analyzer import VisionAnalyzer
                        from openai import AsyncOpenAI
                        
                        vision_client = AsyncOpenAI(
                            api_key=llm_api_key,
                            base_url=llm_base_url
                        )
                        vision_analyzer = VisionAnalyzer(
                            client=vision_client,
                            model=settings.vision_model
                        )
                        vision_settings = {
                            'min_image_width': settings.min_image_width,
                            'min_image_height': settings.min_image_height,
                            'min_image_size_kb': settings.min_image_size_kb,
                            'max_images_per_page': settings.max_images_per_page
                        }
                    
                    pages = parse_pages(saved_path, ext, vision_analyzer, vision_settings)
                    
                    # 恢復原始配置
                    if original_parser is not None:
                        import backend.app.core.config as config_module
                        config_module.PDF_PARSER_ENGINE = original_parser
                        
                except ValueError as exc:
                    raise HTTPException(400, str(exc)) from exc

                await push_event(
                    {
                        "type": "progress",
                        "progress": 30,
                        "message": f"完成文字解析，共 {len(pages)} 頁",
                    }
                )

                classified = [classify_page(page.page_number, page.text) for page in pages]
                await push_event(
                    {
                        "type": "progress",
                        "progress": 35,
                        "message": "頁面判定完成",
                    }
                )

                engine = SummaryEngine(settings=settings)

                total_pages = len(classified)
                completed_pages = 0

                async def page_progress(_: int):
                    nonlocal completed_pages
                    completed_pages += 1
                    base = 35
                    span = 50
                    percent = base + int(span * completed_pages / max(1, total_pages))
                    await push_event(
                        {
                            "type": "progress",
                            "progress": min(percent, 90),
                            "message": f"完成第 {completed_pages}/{total_pages} 頁摘要",
                        }
                    )

                page_results = await engine.summarize_pages(classified, progress_callback=page_progress)

                await push_event(
                    {
                        "type": "progress",
                        "progress": 92,
                        "message": "彙整全局摘要",
                    }
                )

                # 使用四維度結果生成全局彙整
                global_summary = await engine.synthesize_global(page_results)

                joined_text = "\n".join(page.text for page in pages)
                language = detect_lang(joined_text)
                visual_language = determine_visual_language(joined_text, language)

                paragraph_objs = [
                    Paragraph(index=idx, text=page.text or "", start_char=0, end_char=len(page.text or ""))
                    for idx, page in enumerate(pages)
                ]
                paragraph_keywords = extract_keywords_by_paragraph(paragraph_objs, language)
                keyword_lookup = {item["paragraph_index"]: item["keywords"] for item in paragraph_keywords}

                visual_keywords = (
                    paragraph_keywords
                    if visual_language == language
                    else extract_keywords_by_paragraph(paragraph_objs, visual_language)
                )

                wordcloud_url = None
                try:
                    wc_path = build_wordcloud(visual_keywords, visual_language, joined_text)
                    wordcloud_url = make_public_url(wc_path)
                except Exception as exc:  # pylint: disable=broad-except
                    reason = "文字雲生成失敗"
                    if isinstance(exc, RuntimeError) and "不足" in str(exc):
                        reason = "文字雲素材不足"
                    await push_event(
                        {
                            "type": "progress",
                            "progress": 95,
                            "message": f"{reason}：{exc}",
                        }
                    )

                # 轉換為舊格式以保持前端兼容
                legacy_results = [result.to_legacy_format() for result in page_results]
                
                response_payload = AnalyzeResponse(
                    language=language,
                    total_pages=total_pages,
                    page_summaries=[
                        PageSummary(
                            page_number=result.page_number,
                            classification=result.classification,
                            bullets=result.bullets,
                            keywords=keyword_lookup.get(result.page_number - 1, []),
                            skipped=result.skipped,
                            skip_reason=result.skip_reason,
                        )
                        for result in legacy_results
                    ],
                    global_summary=global_summary,
                    system_prompt=SYSTEM_PROMPT,
                    wordcloud_image_url=wordcloud_url,
                )

                await push_event(
                    {
                        "type": "result",
                        "progress": 100,
                        "message": "分析完成",
                        "data": response_payload.model_dump(mode="json"),
                    }
                )
            except HTTPException as exc:
                await push_event(
                    {
                        "type": "error",
                        "progress": 100,
                        "message": exc.detail,
                    }
                )
            except Exception as exc:  # pylint: disable=broad-except
                await push_event(
                    {
                        "type": "error",
                        "progress": 100,
                        "message": f"分析失敗：{exc}",
                    }
                )
            finally:
                await queue.put(None)

        summarizer_task = asyncio.create_task(run_summarizer())

        while True:
            event = await queue.get()
            if event is None:
                break
            yield event

        await summarizer_task

    return StreamingResponse(generator(content, file.filename), media_type="application/x-ndjson")
