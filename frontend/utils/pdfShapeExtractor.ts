// src/utils/pdfShapeExtractor.ts
import type { PDFPageProxy } from 'pdfjs-dist';
import { PdfRectWithPage } from '../redux/features/editor/editorTypes';

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
export async function extractShapeData(page: PDFPageProxy): Promise<PdfRectWithPage[]> {
  const opList = await page.getOperatorList();
  const shapes: PdfRectWithPage[] = [];
  const pageNum = page.pageNumber;

  // PDF座標系 (左下: (0,0)) のページ寸法（PDFのビューボックスから取得）
  // PDFの座標は [左下x, 左下y, 右上x, 右上y]
  const [, , , pageHeight] = page.view; 
  let currentRectId = 0;

  // Graphics State (簡易版: CTMのみ追跡)
  let ctm = [1, 0, 0, 1, 0, 0]; // Current Transformation Matrix [a, b, c, d, e, f]

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i];

    // CTMの変更 (concatenateMatrix)
    if (fn === 4 /* opList.getOperator('concatenateMatrix') */ && args.length === 6) {
        // CTMの乗算ロジック: new_ctm = old_ctm * args_matrix
        const [a, b, c, d, e, f] = ctm;
        const [a1, b1, c1, d1, e1, f1] = args as number[];
        
        ctm = [
            a * a1 + b * c1,  // a'
            a * b1 + b * d1,  // b'
            c * a1 + d * c1,  // c'
            c * b1 + d * d1,  // d'
            e * a1 + f * c1 + e1,  // e'
            e * b1 + f * d1 + f1   // f'
        ];
    }
    
    // Graphics State の保存 ('save') / 復元 ('restore') は、簡易化のためスキップ

    // 1. 画像 (paintImageXObject)
    if (fn === 33 /* opList.getOperator('paintImageXObject') */ || fn === 34 /* opList.getOperator('paintImageXObjectRepeat') */) { 
      // CTMのe, f要素が左下隅のPDF座標に相当します。
      const [x, y] = transform(0, 0, ctm);
      
      // 画像の幅と高さをCTMのaとdで仮定します (回転がないと仮定)
      const width = ctm[0];
      const height = ctm[3];
      
      const x_pdf_left = Math.min(x, x + width);
      const y_pdf_bottom = Math.min(y, y + height);
      const x_pdf_right = Math.max(x, x + width);
      const y_pdf_top = Math.max(y, y + height);

      // PDF左下原点 -> 左上原点に変換して保存
      shapes.push({
        pageNum,
        x1: x_pdf_left, 
        y1: pageHeight - y_pdf_top, 
        x2: x_pdf_right, 
        y2: pageHeight - y_pdf_bottom,
        elementType: 'image',
        elementId: `image-${pageNum}-${currentRectId++}`,
      });
    }

    // 2. 矩形 (rectangle)
    if (fn === 19 /* opList.getOperator('rectangle') */) {
      // args: [x, y, w, h] (PDF座標)
      if (args && args.length === 4) {
        const [x, y, w, h] = args as [number, number, number, number];
        
        // 矩形の角の座標をCTMで変換
        const [tx1, ty1] = transform(x, y, ctm);
        const [tx2, ty2] = transform(x + w, y + h, ctm);

        const x_min = Math.min(tx1, tx2);
        const y_min = Math.min(ty1, ty2);
        const x_max = Math.max(tx1, tx2);
        const y_max = Math.max(ty1, ty2);
        
        // CTM変換後の座標を左上原点に変換して保存
        shapes.push({
            pageNum,
            x1: x_min,
            y1: pageHeight - y_max, 
            x2: x_max,
            y2: pageHeight - y_min,
            elementType: 'shape',
            elementId: `shape-${pageNum}-${currentRectId++}`,
        });
      }
    }
  }

  return shapes;
}