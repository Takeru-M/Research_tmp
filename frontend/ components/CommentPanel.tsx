// ../ components/CommentPanel.tsx

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  addComment,
  updateComment,
  deleteComment,
  setActiveCommentId,
  setActiveHighlightId,
} from "../redux/features/editor/editorSlice";

import { PdfRectWithPage, PdfHighlight, HighlightInfo } from "@/redux/features/editor/editorTypes";

// 💡 修正: PdfRectWithPage と PdfHighlight の型定義 (editorTypesからインポートされると仮定)
// interface PdfRectWithPage {
//   pageNum: number;
//   x1: number;
//   y1: number;
//   x2: number;
//   y2: number;
// }
// interface PdfHighlight {
//   id: string;
//   type: string;
//   text: string;
//   rects: PdfRectWithPage[];
//   memo: string;
// }

// 💡 追加: 新しいRedux Stateの型 (PdfViewerから伝達される情報)
interface ScrollTarget {
    pdfY1: number;      // 選択されたハイライトのy1 (PDF座標)
    pageNum: number;    // 選択されたハイライトのページ番号
    pageScale: number;  // そのページの現在のレンダリングスケール
    pageTopOffset: number; // そのページのDOM上端の、PDF Viewer上端からのピクセル距離
}

// 💡 修正1: 動的なパディングを計算するヘルパー関数
// ページ全体の半分まではスクロール可
const getDynamicPadding = (viewerHeight: number | 'auto'): number => {
  return (typeof viewerHeight !== 'number') ? 500 : viewerHeight;
};
// -------------------------------------------------------------------

// 3-dot menu styles (省略)
const menuStyle: React.CSSProperties = {
  position: "relative",
  display: "inline-block",
};
// ... (中略: menuButtonStyle, dropdownStyle, menuItem の定義は省略します)

interface Comment {
  id: string;
  parentId: string | null;
  highlightId: string;
  author: string;
  text: string;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
}

// CommentHeader コンポーネント (変更なし)
const CommentHeader: React.FC<{
  comment: Comment;
  editingId: string | null;
  toggleMenu: (id: string) => void;
  menuOpenMap: Record<string, boolean>;
  startEditing: (id: string, text: string) => void;
  removeCommentFn: (id: string) => void;
  menuRef: (element: HTMLDivElement | null) => void;
}> = ({ comment, editingId, toggleMenu, menuOpenMap, startEditing, removeCommentFn, menuRef }) => {
  const isEditing = editingId === comment.id;
  const [isMenuAreaHovered, setIsMenuAreaHovered] = useState(false);
  const isMenuOpen = !!menuOpenMap[comment.id];
  const [hoveredMenuItem, setHoveredMenuItem] = useState<string | null>(null);

  const time = useMemo(() => {
    const date = new Date(comment.createdAt);
    return date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) + ' ' + date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  }, [comment.createdAt]);

  // 簡略化のため、元のコードのスタイルとロジックを維持
  const menuButtonStyle: React.CSSProperties = { /* ... */ };
  const dropdownStyle: React.CSSProperties = { /* ... */ };
  const menuItem: React.CSSProperties = { /* ... */ };

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
      <div style={{ display: "flex", alignItems: "baseline" }}>
        <strong style={{ fontSize: 14 }}>{comment.author || "You"}</strong>
        <small style={{ marginLeft: 6, color: "#666", fontSize: 12 }}>
          {time}
        </small>
      </div>

      <div
        style={menuStyle}
        ref={menuRef}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => setIsMenuAreaHovered(true)}
        onMouseLeave={() => setIsMenuAreaHovered(false)}
      >
        <button
          style={{ 
            cursor: "pointer",
            fontSize: 18,
            color: "black",
            padding: "4px 8px",
            borderRadius: "50%",
            lineHeight: 1,
            background: (isMenuAreaHovered || isMenuOpen) ? '#eee' : 'none',
            border: 'none',
            transition: 'background-color 0.1s',
          }}
          onClick={(e) => {
            e.stopPropagation();
            toggleMenu(comment.id);
          }}
        >
          ⋮
        </button>

        {isMenuOpen && (
          <div style={{
            position: "absolute",
            top: "20px",
            right: "0px",
            background: "#fff",
            border: "1px solid #ddd",
            boxShadow: "0px 3px 10px rgba(0,0,0,0.15)",
            borderRadius: 8,
            zIndex: 100,
            width: 120,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}>
            {!isEditing && (
              <button
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  color: "black",
                  fontSize: 14,
                  background: hoveredMenuItem === 'edit' ? '#f5f5f5' : '#fff',
                  borderBottom: "1px solid #eee",
                  textAlign: 'left',
                  width: '100%',
                  border: 'none',
                }}
                onMouseEnter={() => setHoveredMenuItem('edit')}
                onMouseLeave={() => setHoveredMenuItem(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  startEditing(comment.id, comment.text);
                }}
              >
                編集
              </button>
            )}
            <button
              style={{ 
                padding: "8px 12px",
                cursor: "pointer",
                color: "red", 
                fontSize: 14,
                borderBottom: "none",
                background: hoveredMenuItem === 'delete' ? '#f5f5f5' : '#fff',
                textAlign: 'left',
                width: '100%',
                border: 'none',
              }}
              onMouseEnter={() => setHoveredMenuItem('delete')}
              onMouseLeave={() => setHoveredMenuItem(null)}
              onClick={(e) => {
                e.stopPropagation();
                removeCommentFn(comment.id);
              }}
            >
              削除
            </button>
          </div>
        )}
      </div>
    </div>
  );
};


interface CommentPanelProps {
  currentUser?: string; 
  viewerHeight: number | 'auto'; 
}

export default function CommentPanel({ viewerHeight = 'auto' }: CommentPanelProps) {
  const dispatch = useDispatch();
  
  const { comments, activeHighlightId, activeCommentId, highlights, activeScrollTarget } = useSelector((s: any) => s.editor);
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [menuOpenMap, setMenuOpenMap] = useState<Record<string, boolean>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const commentPanelRef = useRef<HTMLDivElement>(null);
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});
  const COLLAPSE_THRESHOLD = 3; 
  const ROOTS_COLLAPSE_THRESHOLD = 6; 

  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const threadRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const toggleMenu = (id: string) => {
    setMenuOpenMap((m) => {
      const newMap: Record<string, boolean> = {};
      Object.keys(m).forEach(k => newMap[k] = false);
      newMap[id] = !m[id];
      return newMap;
    });
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (Object.keys(menuOpenMap).length === 0 || !Object.values(menuOpenMap).some(v => v)) return;

      const clickedInside = Object.entries(menuRefs.current).some(
        ([id, ref]) => ref && menuOpenMap[id] && ref.contains(event.target as Node)
      );
      
      if (!clickedInside) {
        setMenuOpenMap({});
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpenMap]);

  const closeMenu = (id: string) => setMenuOpenMap((m) => ({ ...m, [id]: false }));

  const rootComments: Comment[] = comments.filter((c: Comment) => c.parentId === null);
  const getReplies = (pid: string): Comment[] => comments.filter((c: Comment) => c.parentId === pid);

  // ハイライトの縦位置（PDF座標）に基づいてルートコメントをソートするロジック (ランタイムエラー修正済み)
  const sortedRootComments = useMemo(() => {
    const getHighlightSortKey = (highlightId: string): number | null => {
      const highlight = (highlights as PdfHighlight[]).find((h) => h.id === highlightId);
      if (!highlight || highlight.rects.length === 0) return null;

      // 💡 修正: highlight.rects のコピーを作成してからソートする (読み取り専用エラー回避)
      const sortedRects = [...highlight.rects].sort((a, b) => {
        if (a.pageNum !== b.pageNum) {
          return a.pageNum - b.pageNum;
        }
        return a.y1 - b.y1;
      });
      const topRect = sortedRects[0]; 
      return topRect.pageNum * 100000 + topRect.y1; 
    };
    const rootsWithSortKey = rootComments.map(root => {
      const sortKey = getHighlightSortKey(root.highlightId);
      return {
        ...root,
        sortKey: sortKey !== null ? sortKey : Infinity 
      };
    });
    rootsWithSortKey.sort((a, b) => {
      if (a.sortKey === Infinity && b.sortKey !== Infinity) return 1;
      if (a.sortKey !== Infinity && b.sortKey === Infinity) return -1;
      return a.sortKey - b.sortKey;
    });

    return rootsWithSortKey.map(root => {
        const { sortKey, ...comment } = root;
        return comment as Comment;
    });
  }, [rootComments, highlights]);


  const toggleCollapse = (rootId: string) => {
    setCollapsedMap(prev => ({
      ...prev,
      [rootId]: !prev[rootId],
    }));
  };

  const startEditing = (id: string, text: string) => {
    setEditingId(id);
    setEditText(text);
    closeMenu(id);
  };

  const saveEdit = (id: string) => {
    dispatch(updateComment({ id, text: editText }));
    setEditingId(null);
    setEditText("");
  };

  const removeCommentFn = (id: string) => {
    if (window.confirm("このコメントを削除してもよろしいですか？")) {
      const comment = comments.find((c: Comment) => c.id === id);
      if (!comment) return;
      dispatch(deleteComment({ id }));
      if (comment.highlightId) {
        dispatch({ type: "editor/deleteHighlight", payload: { id: comment.highlightId } });
      }
      closeMenu(id);
    }
  };

  const sendReply = (parentId: string) => {
    const replyText = replyTextMap[parentId] || "";
    if (!replyText.trim()) return;

    dispatch(
      addComment({
        id: `c-${Date.now()}`,
        parentId,
        highlightId: activeHighlightId,
        author: "You",
        text: replyText,
        createdAt: new Date().toISOString(),
        editedAt: null,
        deleted: false,
      })
    );
    setReplyTextMap((prev) => ({ ...prev, [parentId]: "" }));
    setCollapsedMap(prev => ({ ...prev, [parentId]: false }));
  };

  const handleReplyTextChange = (parentId: string, text: string) => {
    setReplyTextMap((prev) => ({ ...prev, [parentId]: text }));
  };

  const renderCommentBody = (comment: Comment) => {
    const isEditing = editingId === comment.id;
    return isEditing ? (
      <div onClick={(e) => e.stopPropagation()}>
        <textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          style={{ width: "100%", marginTop: 6, padding: 6, borderRadius: 6, border: "1px solid #ccc", boxSizing: 'border-box' }}
        />
        <button
          style={{
            marginTop: 6,
            marginRight: 2,
            padding: "6px 14px",
            fontSize: 14,
            borderRadius: 6,
            background: "#1976d2",
            color: "#fff",
            border: "none",
            cursor: "pointer",
          }}
          onClick={(e) => { e.stopPropagation(); saveEdit(comment.id); }}
        >
          保存
        </button>
        <button
          style={{
            marginTop: 6,
            padding: "6px 14px",
            fontSize: 14,
            borderRadius: 6,
            background: "#6c757d",
            color: "#fff",
            border: "none",
            cursor: "pointer",
          }}
          onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
        >
          キャンセル
        </button>
      </div>
    ) : (
      <p style={{ marginTop: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{comment.text}</p>
    );
  };

  // Helper: find root id for any comment id
  const findRootId = (commentId: string | null) => {
    if (!commentId) return null;
    const map = new Map<string, Comment>();
    comments.forEach(c => map.set(c.id, c));
    let cur = map.get(commentId);
    if (!cur) return null;
    while (cur.parentId) {
      const parent = map.get(cur.parentId);
      if (!parent) break;
      cur = parent;
    }
    return cur.id;
  };

  const getHighlightInfo = (highlightId: string | null) => {
    if (!highlightId) return null;
    const map = new Map<string, HighlightInfo>();
    highlights.forEach(h => map.set(h.id, h));
    const highlightInfo = map.get(highlightId);
    if (!highlightInfo) return null;
    return highlightInfo;
  }

  // Auto-initialize collapsedMap (変更なし)
  useEffect(() => {
    const newCollapsed: Record<string, boolean> = { ...collapsedMap };
    rootComments.forEach((root) => {
      const replies = getReplies(root.id);
      if (replies.length > COLLAPSE_THRESHOLD && newCollapsed[root.id] === undefined) {
        newCollapsed[root.id] = true;
      }
    });
    if (rootComments.length > ROOTS_COLLAPSE_THRESHOLD) {
      rootComments.forEach((root, idx) => {
        if (idx >= ROOTS_COLLAPSE_THRESHOLD && newCollapsed[root.id] === undefined) {
          newCollapsed[root.id] = true;
        }
      });
    }
    setCollapsedMap(newCollapsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments.length]);

  // Expand the thread when a corresponding highlight or comment is selected (変更なし)
  useEffect(() => {
    if (activeCommentId) {
      const rootId = findRootId(activeCommentId);
      if (rootId) setCollapsedMap(prev => ({ ...prev, [rootId]: false }));
    }
  }, [activeCommentId]);

  useEffect(() => {
    if (activeHighlightId) {
      const matched = comments.find((c: Comment) => c.highlightId === activeHighlightId);
      if (matched) {
        const rootId = findRootId(matched.id);
        if (rootId) setCollapsedMap(prev => ({ ...prev, [rootId]: false }));
      }
    }
  }, [activeHighlightId]);

  // 💡 修正2: スクロールを強制するための動的パディングを計算
  const DYNAMIC_PADDING = getDynamicPadding(viewerHeight);
  const DYNAMIC_PADDING_PX = `${DYNAMIC_PADDING }px`;

  // 💡 修正3: activeScrollTarget に基づいたスクロールロジック
  useEffect(() => {
    let targetRootId: string | null = null;
    if (activeCommentId) {
      targetRootId = findRootId(activeCommentId);
    } else if (activeHighlightId) {
      const matched = comments.find((c: Comment) => c.highlightId === activeHighlightId);
      if (matched) {
        targetRootId = findRootId(matched.id);
      }
    }

    const targetElement = targetRootId && threadRefs.current[targetRootId];
    // const scrollContainer = scrollContainerRef.current;
    const commentPanel = commentPanelRef.current;
    const targetHighlight = getHighlightInfo(activeHighlightId);
    if (targetElement instanceof HTMLDivElement) {
      const targetElement_y = targetElement.getBoundingClientRect().y;
      if (targetElement && commentPanel && targetHighlight) {
        commentPanel.scrollBy({
          top: targetElement_y - targetHighlight.rects[0].y1,
          behavior: "smooth",
        })
      }
    }
  }, [activeCommentId, activeHighlightId]);

  return (
    <div 
      ref={commentPanelRef}
      style={{ 
        width: 300, 
        borderLeft: "1px solid #ddd", 
        padding: 10,
        maxHeight: viewerHeight !== 'auto' 
          ? `calc(${viewerHeight}px)` 
          : 'auto', 
        overflowY: 'auto',
      }}
      className="comment-panel" 
    >
      {/* <h3 style={{ marginBottom: 12, fontSize: 17 }}>コメント</h3> */}
      <h3 style={{ marginBottom: 12, fontSize: 17 }}></h3>
      <div
        ref={scrollContainerRef}
        style={{
          paddingTop: DYNAMIC_PADDING_PX,
          paddingBottom: DYNAMIC_PADDING_PX,
          // うまくいかんかった
          // marginTop: `-${DYNAMIC_PADDING_PX}`, // パネルの表示位置を相殺
          // marginBottom: `-${DYNAMIC_PADDING_PX}`,
        }}
      >
        {sortedRootComments.map((root, rootIdx) => {
          const replies = getReplies(root.id);
          const totalReplies = replies.length;
          const isInitiallyCollapsed = totalReplies > COLLAPSE_THRESHOLD;
          const isCollapsed = collapsedMap[root.id] === undefined ? isInitiallyCollapsed : collapsedMap[root.id];

          const visibleReplies = isCollapsed && totalReplies > COLLAPSE_THRESHOLD
            ? replies.slice(totalReplies - COLLAPSE_THRESHOLD)
            : replies;

          const showCollapseButton = totalReplies > COLLAPSE_THRESHOLD;

          return (
            <div
              key={root.id}
              ref={(el) => { threadRefs.current[root.id] = el; }}
              style={{
                background: activeCommentId === root.id || (activeHighlightId && root.highlightId === activeHighlightId) ? "#f0f7ff" : "#fff",
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: 8,
                marginBottom: 8,
                cursor: 'pointer',
              }}
              onClick={() => {
                dispatch(setActiveCommentId(root.id));
                dispatch(setActiveHighlightId(root.highlightId));
                setCollapsedMap(prev => ({ ...prev, [root.id]: false }));
              }}
            >
              <CommentHeader
                comment={root}
                editingId={editingId}
                toggleMenu={toggleMenu}
                menuOpenMap={menuOpenMap}
                startEditing={startEditing}
                removeCommentFn={removeCommentFn}
                menuRef={(el) => (menuRefs.current[root.id] = el)}
              />

              {renderCommentBody(root)}

              {visibleReplies.map((r) => (
                <div
                  key={r.id}
                  style={{
                    marginLeft: 14,
                    marginTop: 6, 
                    borderLeft: "2px solid #eee",
                    paddingLeft: 8,
                    background: activeCommentId === r.id ? "#e6f3ff" : "transparent",
                    paddingTop: 4,
                    paddingBottom: 4,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch(setActiveCommentId(r.id));
                    dispatch(setActiveHighlightId(r.highlightId));
                    const rootId = findRootId(r.id);
                    if (rootId) setCollapsedMap(prev => ({ ...prev, [rootId]: false }));
                  }}
                >
                  <CommentHeader
                    comment={r}
                    editingId={editingId}
                    toggleMenu={toggleMenu}
                    menuOpenMap={menuOpenMap}
                    startEditing={startEditing}
                    removeCommentFn={removeCommentFn}
                    menuRef={(el) => (menuRefs.current[r.id] = el)}
                  />
                  {renderCommentBody(r)}
                </div>
              ))}

              <textarea
                placeholder="返信を書く..."
                value={replyTextMap[root.id] || ""}
                onChange={(e) => handleReplyTextChange(root.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "100%",
                  marginTop: 6, 
                  fontSize: 14,
                  padding: 6,
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  boxSizing: 'border-box',
                  resize: 'none',
                }}
              />

              <button
                style={{
                  marginTop: 6,
                  padding: "6px 14px",
                  fontSize: 14,
                  borderRadius: 6,
                  background: "#1976d2",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  sendReply(root.id);
                }}
              >
                返信
              </button>
              
              {showCollapseButton && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCollapse(root.id);
                  }}
                  style={{
                    marginTop: 8,
                    padding: "4px 8px",
                    fontSize: 12,
                    color: "#1976d2",
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  {isCollapsed
                    ? `全て表示 (${totalReplies - visibleReplies.length} 件)`
                    : "一部を表示"}
                </button>
              )}

            </div>
          );s
        })}
      </div>
    </div>
  );
}