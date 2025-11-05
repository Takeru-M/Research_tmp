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

// 3-dot menu styles
const menuStyle: React.CSSProperties = {
  position: "relative",
  display: "inline-block",
};

const menuButtonStyle: React.CSSProperties = {
  cursor: "pointer",
  fontSize: 18,
  color: "black",
  padding: "4px 8px",
  borderRadius: "50%",
  lineHeight: 1,
  background: 'none',
  border: 'none',
  transition: 'background-color 0.1s',
};

const dropdownStyle: React.CSSProperties = {
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
};

const menuItem: React.CSSProperties = {
  padding: "8px 12px",
  cursor: "pointer",
  color: "black",
  fontSize: 14,
  background: "#fff",
  borderBottom: "1px solid #eee",
  textAlign: 'left',
  width: '100%',
  border: 'none',
  transition: 'background-color 0.1s',
};

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

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 /* 修正: スペース縮小 */ }}>
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
            ...menuButtonStyle,
            backgroundColor: (isMenuAreaHovered || isMenuOpen) ? '#eee' : 'transparent',
          }}
          onClick={(e) => {
            e.stopPropagation();
            toggleMenu(comment.id);
          }}
        >
          ⋮
        </button>

        {isMenuOpen && (
          <div style={dropdownStyle}>
            {!isEditing && (
              <button
                style={{
                  ...menuItem,
                  backgroundColor: hoveredMenuItem === 'edit' ? '#f5f5f5' : '#fff',
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
                ...menuItem, 
                color: "red", 
                borderBottom: "none",
                backgroundColor: hoveredMenuItem === 'delete' ? '#f5f5f5' : '#fff',
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

// 💡 修正: Propの型定義に viewerHeight を追加
interface CommentPanelProps {
  currentUser?: string; 
  viewerHeight: number | 'auto'; 
}

// 💡 修正: propを受け取る
export default function CommentPanel({ viewerHeight = 'auto' }: CommentPanelProps) {
  const dispatch = useDispatch();
  const { comments, activeHighlightId, activeCommentId } = useSelector((s: any) => s.editor);

  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [menuOpenMap, setMenuOpenMap] = useState<Record<string, boolean>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // collapse state per root comment
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});
  const COLLAPSE_THRESHOLD = 3; // replies threshold per thread
  const ROOTS_COLLAPSE_THRESHOLD = 6; // if many root threads, collapse older ones

  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // 💡 追加: スクロール用の ref
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

  // Toggle collapse for a specific root thread
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
    // ensure thread is expanded after replying
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

  // Auto-initialize collapsedMap when number of roots is large or when replies exceed threshold
  useEffect(() => {
    const newCollapsed: Record<string, boolean> = { ...collapsedMap };

    // collapse threads that have many replies (if not already set by user)
    rootComments.forEach((root) => {
      const replies = getReplies(root.id);
      if (replies.length > COLLAPSE_THRESHOLD && newCollapsed[root.id] === undefined) {
        newCollapsed[root.id] = true;
      }
    });

    // if too many root threads, collapse older ones (beyond ROOTS_COLLAPSE_THRESHOLD)
    if (rootComments.length > ROOTS_COLLAPSE_THRESHOLD) {
      rootComments.forEach((root, idx) => {
        if (idx >= ROOTS_COLLAPSE_THRESHOLD && newCollapsed[root.id] === undefined) {
          newCollapsed[root.id] = true;
        }
      });
    }

    setCollapsedMap(newCollapsed);
    // we only want to run when comments change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments.length]);

  // Expand the thread when a corresponding highlight or comment is selected
  useEffect(() => {
    if (activeCommentId) {
      const rootId = findRootId(activeCommentId);
      if (rootId) setCollapsedMap(prev => ({ ...prev, [rootId]: false }));
    }
  }, [activeCommentId]);

  useEffect(() => {
    if (activeHighlightId) {
      // expand any roots that contain a comment with this highlightId
      const matched = comments.find((c: Comment) => c.highlightId === activeHighlightId);
      if (matched) {
        const rootId = findRootId(matched.id);
        if (rootId) setCollapsedMap(prev => ({ ...prev, [rootId]: false }));
      }
    }
  }, [activeHighlightId]);

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
    const scrollContainer = scrollContainerRef.current;
    // スクロールコンテナとターゲット要素が存在する場合のみ処理を実行
    if (targetElement && scrollContainer) {
      // 画面全体を動かす 'scrollIntoView' ではなく、親コンテナ内の位置を調整します。
      // ターゲット要素のコンテナに対する相対的な位置
      const relativeTop = targetElement.offsetTop - scrollContainer.offsetTop;
      // スクロールコンテナの現在のスクロール位置を更新
      // ここでは 'nearest' (最も近い端にスクロール) の代わりに、
      // 画面上端に合わせる（0）か、または中央付近に持ってくるように調整できます。
      // ターゲット要素をスクロールコンテナの上端に移動させる
      // targetElement.offsetTop: スクロールコンテナの先頭からのターゲット要素の位置
      scrollContainer.scrollTop = targetElement.offsetTop;
      // 🚨 注意点: 上記の simple scrollIntoView のロジックでは、PDF側のハイライトとコメントスレッドの縦位置（緯度）を合わせるためには、
      // PDF側のハイライトの縦位置情報が必要になります。
      // 現状のコードではその情報がないため、最も一般的な「スレッドをコメントパネルの**上端**にスクロールする」方法に修正します。
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start', // スクロールコンテナ内で要素を上端に移動させる
      });
      /* もしPDF側のハイライトの縦位置情報 (例: `activeHighlightY` [px] または [vh]) があれば、
      scrollContainer.scrollTop = targetElement.offsetTop - activeHighlightY + (scrollContainer.offsetHeight / 2);
      のような計算で位置を合わせることが可能です。
      */
    } else if (targetElement) {
      // 💡 画面全体が動く原因だった 'block: nearest' の代わりに、
      // スクロールを伴わない 'block: start' または 'block: center' を使用し、
      // 親要素がスクロールしないようにする。
      // しかし、独立したスクロールコンテナがあるため、単に scrollIntoView を使うのは止めます。
      // **元のロジックを削除し、独立したスクロールコンテナを使うロジックを採用します。**
    }
  }, [activeCommentId, activeHighlightId, comments]);

  // 💡 修正: スクロールエリアの計算定数
  // const H3_HEIGHT_PLUS_MARGIN = 17 + 12; // h3の高さ(fontSize: 17) + marginBottom: 12
  // const PANEL_PADDING_VERTICAL = 20; // ラッパーの padding: 10 (上) + padding: 10 (下)
  // const HEADER_OFFSET = H3_HEIGHT_PLUS_MARGIN + PANEL_PADDING_VERTICAL;

  return (
    <div 
      style={{ 
        width: 300, 
        borderLeft: "1px solid #ddd", 
        padding: 10,
        // 💡 修正: コメントパネル全体の高さをビューアの高さに合わせる
        height: viewerHeight !== 'auto' ? viewerHeight : 'auto' 
      }}
      className="comment-panel" // Outside click guard
    >
      <h3 style={{ marginBottom: 12, fontSize: 17 }}>コメント</h3>
      <div 
        ref={scrollContainerRef}
        style={{ 
          // 💡 修正: ビューアの高さからヘッダーとラッパーのパディングを引く
          maxHeight: viewerHeight !== 'auto' 
            ? `${viewerHeight}px` 
            : 'auto', 
          overflowY: 'auto' 
        }}
      >
        {rootComments.map((root, rootIdx) => {
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
                padding: 8, /* 修正: スペース縮小 */
                marginBottom: 8, /* 修正: スペース縮小 */
                cursor: 'pointer',
              }}
              onClick={() => {
                dispatch(setActiveCommentId(root.id));
                dispatch(setActiveHighlightId(root.highlightId));
                // expand when clicked
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
                    marginTop: 6, /* 修正: スペース縮小 */
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
                    // expand the parent root when a reply is clicked
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
                  marginTop: 6, /* 修正: スペース縮小 */
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
              
              {/* ボタンを返信エリアの下に配置 */}
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
          );
        })}
      </div>
    </div>
  );
}