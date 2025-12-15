import type { TextItem } from 'pdfjs-dist/types/src/display/api';

export type GroupedLine = {
  pageNum: number;
  text: string;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  yCenter: number;
  items: Array<{
    text: string;
    x1: number;
    x2: number;
    y1: number;
    y2: number;
  }>;
};

/**
 * react-pdfのTextItemを行単位にまとめる。
 * y座標が近い文字を同一行として束ね、行内はx座標でソートしテキストを連結する。
 */
export const groupTextItemsToLines = (
  textItems: TextItem[],
  pageHeight: number,
  yThreshold = 3
): GroupedLine[] => {
  if (!textItems || textItems.length === 0 || !pageHeight) return [];

  // TextItem -> 座標付き要素へ変換
  const items = textItems
    .filter((item): item is TextItem & { str: string } => 'str' in item)
    .map((item) => {
      const x = item.transform[4] || 0;
      const yBottom = pageHeight - (item.transform[5] || 0);
      const width = item.width || 0;
      const height = item.height || 0;
      const yTop = yBottom - height;
      return {
        text: item.str,
        x1: x,
        x2: x + width,
        y1: yTop,
        y2: yBottom,
        yCenter: yTop + height / 2,
        width,
      };
    })
    .sort((a, b) => a.yCenter - b.yCenter || a.x1 - b.x1);

  const lines: GroupedLine[] = [];
  for (const it of items) {
    const line = lines.find((ln) => Math.abs(ln.yCenter - it.yCenter) <= yThreshold);
    if (!line) {
      lines.push({
        pageNum: -1, // 後で補正するため仮値
        text: '',
        x1: it.x1,
        x2: it.x2,
        y1: it.y1,
        y2: it.y2,
        yCenter: it.yCenter,
        items: [{ text: it.text, x1: it.x1, x2: it.x2, y1: it.y1, y2: it.y2 }],
      });
    } else {
      line.items.push({ text: it.text, x1: it.x1, x2: it.x2, y1: it.y1, y2: it.y2 });
      line.x1 = Math.min(line.x1, it.x1);
      line.x2 = Math.max(line.x2, it.x2);
      line.y1 = Math.min(line.y1, it.y1);
      line.y2 = Math.max(line.y2, it.y2);
      line.yCenter = (line.y1 + line.y2) / 2;
    }
  }

  // 行内をx順に整列しテキスト連結（間隔が大きい場合は空白挿入）
  lines.forEach((ln) => {
    ln.items.sort((a, b) => a.x1 - b.x1);
    let text = '';
    for (let i = 0; i < ln.items.length; i++) {
      const curr = ln.items[i];
      if (i > 0) {
        const prev = ln.items[i - 1];
        const gap = curr.x1 - prev.x2;
        if (gap > Math.max(2, (prev.x2 - prev.x1) * 0.1)) {
          text += ' ';
        }
      }
      text += curr.text;
    }
    ln.text = text.trimEnd();
  });

  return lines;
};