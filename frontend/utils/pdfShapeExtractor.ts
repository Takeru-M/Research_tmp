// src/utils/pdfShapeExtractor.ts
import type { PDFPageProxy, PageViewport } from 'pdfjs-dist';
import { pdfjs } from 'react-pdf';
import type { PdfRectWithPage } from '../redux/features/editor/editorTypes';

/**
 * CTMに変換を適用するヘルパー関数
 * @param x - 座標 x
 * @param y - 座標 y
 * @param matrix - CTM [a, b, c, d, e, f]
 * @returns 変換後の [x, y]
 */
const transform = (x: number, y: number, matrix: number[]): [number, number] => {
  const [a, b, c, d, e, f] = matrix;
  const newX = a * x + c * y + e;
  const newY = b * x + d * y + f;
  return [newX, newY];
};

/**
 * PDFの描画命令を解析し、図形や画像の位置情報（BBox）を抽出する（簡易版）。
 * * @param page - PDFPageProxy オブジェクト
 * @returns 抽出された図形情報の配列
 */
// Legacy operator-list based extractor removed to avoid duplicate export.
// The SVG-based extractShapeData implementation below is used instead.

/**
 * ページ内の画像 / ベクタ図形の矩形を抽出して返す。
 * 戻り値は PdfRectWithPage[] (pageNum, x1,y1,x2,y2)。
 * x/y は PDF座標系（ページ左下原点）で返します。
 */
export const extractShapeData = async (page: PDFPageProxy): Promise<PdfRectWithPage[]> => {
  try {
    // operator list を取得して SVG に変換
    const opList = await page.getOperatorList();
    // SVGGraphics は pdfjs オブジェクトに含まれていることが多い
    const SVGGraphicsCtor = (pdfjs as any).SVGGraphics;
    if (!SVGGraphicsCtor) {
      console.warn('SVGGraphics is not available on pdfjs. Ensure pdfjs-dist version supports SVGGraphics.');
      return [];
    }

    const svgG = new SVGGraphicsCtor(page.commonObjs, page.objs);
    const viewport = page.getViewport({ scale: 1 });
    const svg = await svgG.getSVG(opList, viewport);

    // 取得するタグを列挙
    const nodeList = svg.querySelectorAll('image, path, rect, ellipse, polygon, polyline, circle');
    const rects: PdfRectWithPage[] = [];
    const pageNum = (page as any).pageNumber ?? 1;
    const pageHeight = viewport.height;

    nodeList.forEach((node) => {
      // getBBox() が使える要素のみ
      let bbox: DOMRect | null = null;
      try {
        // NOTE: svg がまだ DOM につながっていない場合に getBBox() が失敗することがあるので try/catch
        bbox = (node as SVGGraphicsElement).getBBox();
      } catch (e) {
        bbox = null;
      }
      if (!bbox || bbox.width === 0 || bbox.height === 0) return;

      // SVG の y は左上基準なので PDF の y (左下基準) に変換する
      const svgX = bbox.x;
      const svgY = bbox.y;
      const svgW = bbox.width;
      const svgH = bbox.height;

      const x1 = svgX;
      const x2 = svgX + svgW;
      // PDF座標系 (左下原点)
      const y2 = pageHeight - svgY; // top -> PDF y (上辺)
      const y1 = pageHeight - (svgY + svgH); // bottom -> PDF y (下辺)

      rects.push({
        pageNum,
        x1,
        y1,
        x2,
        y2,
      });
    });

    return rects;
  } catch (err) {
    console.error('extractShapeData error:', err);
    return [];
  }
};