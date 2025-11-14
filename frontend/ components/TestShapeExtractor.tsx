import React, { useEffect, useState } from 'react';
import { pdfjs } from 'react-pdf';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { extractShapeData } from '../utils/pdfShapeExtractor';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

type PageResult = {
  pageNum: number;
  shapes: any[]; // PdfRectWithPage[]
  error?: string;
};

interface Props {
  fileUrl: string; // URL or File object URL
}

const TestShapeExtractor: React.FC<Props> = ({ fileUrl }) => {
  const [results, setResults] = useState<PageResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      setResults([]);

      try {
        const loadingTask = pdfjs.getDocument(fileUrl);
        const pdf: PDFDocumentProxy = await loadingTask.promise;
        const n = pdf.numPages;
        const tmp: PageResult[] = [];

        for (let i = 1; i <= n; i++) {
          if (cancelled) break;
          try {
            const page = await pdf.getPage(i);
            const shapes = await extractShapeData(page);
            tmp.push({ pageNum: i, shapes });
            // デバッグログ
            console.log(`page ${i} shapes:`, shapes);
            setResults([...tmp]);
          } catch (pageErr: any) {
            console.error(`Error extracting shapes on page ${i}:`, pageErr);
            tmp.push({ pageNum: i, shapes: [], error: String(pageErr) });
            setResults([...tmp]);
          }
        }
      } catch (err: any) {
        console.error('PDF load error:', err);
        setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  return (
    <div style={{ padding: 16 }}>
      <h3>extractShapeData テスト</h3>
      <p>file: {fileUrl}</p>
      {loading && <p>処理中…</p>}
      {error && <p style={{ color: 'red' }}>エラー: {error}</p>}
      <div>
        {results.map((r) => (
          <div key={r.pageNum} style={{ marginBottom: 12, border: '1px solid #ddd', padding: 8 }}>
            <strong>Page {r.pageNum}</strong>
            <div>shapes: {r.shapes.length}</div>
            {r.error && <div style={{ color: 'red' }}>error: {r.error}</div>}
            <details>
              <summary>詳細 (consoleにも出力されます)</summary>
              <pre style={{ maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(r.shapes, null, 2)}
              </pre>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TestShapeExtractor;