"""
簡單測試腳本：測試 PDF to Markdown 轉換功能

使用方法：
python test_pdf_markdown.py <pdf_file_path>
"""

import sys
import logging
from pathlib import Path

# 設置日誌
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def test_pdf_to_markdown(pdf_path: str):
    """測試 PDF to Markdown 轉換"""
    try:
        from app.services.parsing.pdf_to_markdown import convert_pdf_to_markdown
        
        logger.info(f"正在測試 PDF to Markdown 轉換: {pdf_path}")
        
        # 執行轉換
        result = convert_pdf_to_markdown(
            pdf_path=pdf_path,
            write_images=False,
            page_chunks=True
        )
        
        # 顯示結果
        logger.info(f"✅ 轉換成功！共 {len(result)} 頁")
        
        # 顯示前 3 頁的內容預覽
        for i, page_data in enumerate(result[:3], 1):
            page_num = page_data.get("page_number", i)
            markdown = page_data.get("markdown", "")
            
            logger.info(f"\n{'='*60}")
            logger.info(f"第 {page_num} 頁預覽（前 200 字元）:")
            logger.info(f"{'='*60}")
            logger.info(markdown[:200] + "..." if len(markdown) > 200 else markdown)
        
        return True
        
    except Exception as e:
        logger.error(f"❌ 轉換失敗: {e}", exc_info=True)
        return False


def test_page_parser(pdf_path: str):
    """測試整合後的 page parser"""
    try:
        from app.services.analyze.page_parser import parse_pages
        
        logger.info(f"\n正在測試整合的 page parser: {pdf_path}")
        
        # 執行解析（使用 Markdown）
        pages = parse_pages(
            path=pdf_path,
            extension=".pdf",
            vision_analyzer=None,
            vision_settings=None
        )
        
        logger.info(f"✅ 解析成功！共 {len(pages)} 頁")
        
        # 顯示前 3 頁的內容預覽
        for page in pages[:3]:
            logger.info(f"\n{'='*60}")
            logger.info(f"第 {page.page_number} 頁預覽（前 200 字元）:")
            logger.info(f"{'='*60}")
            text = page.text[:200] + "..." if len(page.text) > 200 else page.text
            logger.info(text)
        
        return True
        
    except Exception as e:
        logger.error(f"❌ 解析失敗: {e}", exc_info=True)
        return False


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("使用方法: python test_pdf_markdown.py <pdf_file_path>")
        sys.exit(1)
    
    pdf_file = sys.argv[1]
    
    # 檢查檔案是否存在
    if not Path(pdf_file).exists():
        logger.error(f"檔案不存在: {pdf_file}")
        sys.exit(1)
    
    logger.info("=" * 80)
    logger.info("PDF to Markdown 轉換功能測試")
    logger.info("=" * 80)
    
    # 測試 1: PDF to Markdown 轉換
    logger.info("\n【測試 1】PDF to Markdown 轉換服務")
    success1 = test_pdf_to_markdown(pdf_file)
    
    # 測試 2: 整合的 Page Parser
    logger.info("\n【測試 2】整合的 Page Parser")
    success2 = test_page_parser(pdf_file)
    
    # 總結
    logger.info("\n" + "=" * 80)
    logger.info("測試結果總結")
    logger.info("=" * 80)
    logger.info(f"PDF to Markdown 轉換: {'✅ 通過' if success1 else '❌ 失敗'}")
    logger.info(f"整合 Page Parser: {'✅ 通過' if success2 else '❌ 失敗'}")
    
    if success1 and success2:
        logger.info("\n🎉 所有測試通過！")
        sys.exit(0)
    else:
        logger.error("\n⚠️ 部分測試失敗，請檢查上方錯誤訊息")
        sys.exit(1)
