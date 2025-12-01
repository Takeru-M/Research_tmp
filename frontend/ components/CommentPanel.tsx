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
import { selectCompletionStage } from '../redux/features/editor/editorSelectors';
import { PdfHighlight, HighlightInfo } from "@/redux/features/editor/editorTypes";
import { Comment } from "@/redux/features/editor/editorTypes";
import { useTranslation } from "react-i18next";
import { useSession } from "next-auth/react";
import "../styles/CommentPanel.module.css";
import { COLLAPSE_THRESHOLD, ROOTS_COLLAPSE_THRESHOLD, STAGE } from "@/utils/constants";
import { apiClient } from "@/utils/apiClient";

// 動的なパディングを計算するヘルパー関数
const getDynamicPadding = (viewerHeight: number | 'auto'): number => {
  return (typeof viewerHeight !== 'number') ? 500 : viewerHeight;
};

const menuStyle: React.CSSProperties = {
  position: "relative",
  display: "inline-block",
};

// CommentHeader コンポーネント
const CommentHeader: React.FC<{
  comment: Comment;
  highlightText?: string;
  editingId: string | null;
  toggleMenu: (id: string) => void;
  menuOpenMap: Record<string, boolean>;
  startEditing: (id: string, text: string) => void;
  removeCommentFn: (id: string) => void;
  menuRef: (element: HTMLDivElement | null) => void;
  currentUserName?: string | null;
}> = ({
  comment,
  highlightText,
  editingId,
  toggleMenu,
  menuOpenMap,
  startEditing,
  removeCommentFn,
  menuRef,
  currentUserName,
}) => {
  const { t } = useTranslation();
  const isEditing = editingId === comment.id;
  const [isMenuAreaHovered, setIsMenuAreaHovered] = useState(false);
  const isMenuOpen = !!menuOpenMap[comment.id];
  const completionStage = useSelector(selectCompletionStage);
  
  // セッション情報から取得したユーザー名を優先的に使用
  const displayAuthor = comment.author || currentUserName || t("CommentPanel.comment-author-user");
  const [hoveredMenuItem, setHoveredMenuItem] = useState<string | null>(null);

  const time = useMemo(() => {
    const date = new Date(comment.createdAt);
    return date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) + ' ' + date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  }, [comment.createdAt]);

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
      <div style={{ flex: 1 }}>
        {/* ユーザー情報と時刻 */}
        <div style={{ display: "flex", alignItems: "baseline" }}>
          <strong style={{ fontSize: 14 }}>{displayAuthor}</strong>
          <small style={{ marginLeft: 4, color: "#666", fontSize: 12 }}>
            {time}
          </small>
        </div>

        {/* ハイライトテキスト表示 */}
        {highlightText && (
          <div
            style={{
              marginTop: 6,
              padding: "6px 8px",
              backgroundColor: "#f8f9fa",
              borderLeft: "3px solid #8e8a83",
              borderRadius: 4,
              fontSize: 13,
              color: "#555",
              lineHeight: 1.4,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: 60,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
            }}
            title={highlightText}
          >
            <em>{highlightText}</em>
          </div>
        )}
      </div>

      {/* メニューボタン */}
      { (displayAuthor === t("CommentPanel.comment-author-LLM")) || (completionStage !== STAGE.EXPORT) && (
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
              padding: "0.5% 1%",
              borderRadius: "50%",
              lineHeight: 1,
              background: (isMenuAreaHovered || isMenuOpen) ? '#eee' : 'none',
              border: 'none',
              transition: 'background-color 0.1s',
              flexShrink: 0,
              marginLeft: 8,
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
              width: 100,
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
                  {t("Utils.edit")}
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
                {t("Utils.delete")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface CommentPanelProps {
  viewerHeight: number | 'auto';
}

export default function CommentPanel({ viewerHeight = 'auto' }: CommentPanelProps) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { data: session } = useSession();

  const { comments, activeHighlightId, activeCommentId, highlights } = useSelector((s: any) => s.editor);
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [menuOpenMap, setMenuOpenMap] = useState<Record<string, boolean>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const commentPanelRef = useRef<HTMLDivElement>(null);
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});
  const completionStage = useSelector(selectCompletionStage);

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

  const sortedRootComments = useMemo(() => {
    const getHighlightSortKey = (highlightId: string): number | null => {
      const highlight = (highlights as PdfHighlight[]).find((h) => h.id === highlightId);
      if (!highlight || highlight.rects.length === 0) return null;

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

  const saveEdit = async (id: string) => {
    try {
      const { data, error } = await apiClient<Comment>(`/comments/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          text: editText,
        },
      });
      if (error || !data) {
        throw new Error(error || 'Failed to update comment');
      }

      const updatedComment = await data;
      console.log('Comment updated:', updatedComment);

      // Reduxストアを更新
      dispatch(updateComment({ id, text: editText }));
      setEditingId(null);
      setEditText("");
    } catch (error: any) {
      console.error('Failed to update comment:', error);
      alert(t('Error.update-comment-failed') || 'コメントの更新に失敗しました');
    }
  };

const removeCommentFn = async (id: string) => {
  if (!window.confirm(t("Alert.comment-delete"))) return;

  const comment = comments.find((c: Comment) => c.id === id);
  if (!comment) return;

  try {
    // ルートコメントを削除する場合
    if (comment.parentId === null) {
      if (comment.highlightId) {
        // ハイライトがある場合は、ハイライトを削除（関連コメントも削除される）
        const { error } = await apiClient<void>(`/highlights/${comment.highlightId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        console.log('Highlight and related comments deleted');
        
        // Reduxストアからハイライトを削除（関連コメントも自動削除される）
        dispatch({ type: "editor/deleteHighlight", payload: { id: comment.highlightId } });
      } else {
        // ハイライトが無いルートコメントは、そのルートに属する全コメントを削除
        const threadComments = comments.filter(c => findRootId(c.id) === comment.id);
        
        // バックエンドから全てのコメントを削除
        for (const threadComment of threadComments) {
          const { error } = await apiClient<void>(`/comments/${threadComment.id}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
          });
        }

        // ルート自身も削除
        if (!threadComments.find(c => c.id === comment.id)) {

          const { error } = await apiClient<void>(`/comments/${comment.id}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
          });
        }

        console.log('Thread comments deleted');

        // Reduxストアから削除
        threadComments.forEach(c => dispatch(deleteComment({ id: c.id })));
        if (!threadComments.find(c => c.id === comment.id)) {
          dispatch(deleteComment({ id: comment.id }));
        }
      }
    } else {
      // 返信の削除
      const { error } = await apiClient<void>(`/comments/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('Reply comment deleted');

      // Reduxストアから削除
      dispatch(deleteComment({ id }));
    }

    closeMenu(id);
  } catch (error: any) {
    console.error('Failed to delete comment:', error);
    alert(t('Error.delete-comment-failed') || 'コメントの削除に失敗しました');
  }
};

  const sendReply = async (parentId: string) => {
    const replyText = replyTextMap[parentId] || "";
    if (!replyText.trim()) return;

    const parentComment = comments.find((c: Comment) => c.id === parentId);
    if (!parentComment) {
      return;
    }

    try {
      const userName = session?.user?.name || t("CommentPanel.comment-author-user");

      // バックエンドにコメントを保存
      const { data, error } = await apiClient<Comment>('/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          highlight_id: parentComment.highlightId ? parseInt(parentComment.highlightId, 10) : null,
          parent_id: parseInt(parentId, 10),
          author: userName,
          text: replyText.trim(),
        },
      });
      if (error || !data) {
        throw new Error(error || 'Failed to create comment');
      }

      const savedComment = data;
      console.log('Comment saved:', savedComment);

      // Reduxストアに追加
      dispatch(
        addComment({
          id: savedComment.id.toString(),
          parentId,
          highlightId: parentComment.highlightId,
          author: userName,
          text: replyText.trim(),
          createdAt: savedComment.created_at,
          editedAt: null,
          deleted: false,
        })
      );

      setReplyTextMap((prev) => ({ ...prev, [parentId]: "" }));
      setCollapsedMap(prev => ({ ...prev, [parentId]: false }));
    } catch (error: any) {
      console.error('Failed to save reply:', error);
      alert(t('Error.save-reply-failed') || '返信の保存に失敗しました');
    }
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
          style={{ width: "100%", marginTop: 4, padding: 6, borderRadius: 4, border: "1px solid #ccc", boxSizing: 'border-box', fontSize: 14 }}
        />
        <button
          style={{
            marginTop: 4,
            marginRight: 2,
            padding: "6px 12px",
            fontSize: 14,
            borderRadius: 4,
            background: "#1976d2",
            color: "#fff",
            border: "none",
            cursor: "pointer",
          }}
          onClick={(e) => { e.stopPropagation(); saveEdit(comment.id); }}
        >
          {t("Utils.save")}
        </button>
        <button
          style={{
            marginTop: 4,
            padding: "6px 12px",
            fontSize: 14,
            borderRadius: 4,
            background: "#6c757d",
            color: "#fff",
            border: "none",
            cursor: "pointer",
          }}
          onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
        >
          {t("Utils.cancel")}
        </button>
      </div>
    ) : (
      <p style={{ marginTop: 6, marginBottom: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 14 }}>{comment.text}</p>
    );
  };

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

  // ハイライトテキストを取得するヘルパー関数
  const getHighlightText = (highlightId: string | null) => {
    if (!highlightId) return null;
    const highlight = highlights.find((h: PdfHighlight) => h.id === highlightId);
    return highlight?.text || null;
  };

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
  }, [comments.length]);

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

  const DYNAMIC_PADDING = getDynamicPadding(viewerHeight);
  const DYNAMIC_PADDING_PX = `${DYNAMIC_PADDING}px`;

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

    const header = document.querySelector("header");
    const headerHeight = header ? header.offsetHeight : 0;

    const targetElement = targetRootId && threadRefs.current[targetRootId];
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
        minWidth: "300px",
        padding: "1%",
        maxHeight: viewerHeight !== 'auto'
          ? `calc(${viewerHeight}px)`
          : 'auto',
        overflowY: 'auto',
      }}
      className="comment-panel"
    >
      <div
        ref={scrollContainerRef}
        style={{
          paddingTop: DYNAMIC_PADDING_PX,
          paddingBottom: DYNAMIC_PADDING_PX,
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
          const rootHighlightText = getHighlightText(root.highlightId);

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
                highlightText={getHighlightText(root.highlightId)}
                editingId={editingId}
                toggleMenu={toggleMenu}
                menuOpenMap={menuOpenMap}
                startEditing={startEditing}
                removeCommentFn={removeCommentFn}
                menuRef={(el) => (menuRefs.current[root.id] = el)}
                currentUserName={session?.user?.name || null}
              />

              {renderCommentBody(root)}

              {visibleReplies.map((reply) => (
                <div
                  key={reply.id}
                  style={{
                    marginLeft: 14,
                    marginTop: 6,
                    borderLeft: "2px solid #eee",
                    paddingLeft: 8,
                    background: activeCommentId === reply.id ? "#e6f3ff" : "transparent",
                    paddingTop: 4,
                    paddingBottom: 4,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch(setActiveCommentId(reply.id));
                    dispatch(setActiveHighlightId(reply.highlightId));
                    const rootId = findRootId(reply.id);
                    if (rootId) setCollapsedMap(prev => ({ ...prev, [rootId]: false }));
                  }}
                >
                  <CommentHeader
                    comment={reply}
                    editingId={editingId}
                    toggleMenu={toggleMenu}
                    menuOpenMap={menuOpenMap}
                    startEditing={startEditing}
                    removeCommentFn={removeCommentFn}
                    menuRef={(el) => (menuRefs.current[reply.id] = el)}
                    currentUserName={session?.user?.name || null}
                  />
                  {renderCommentBody(reply)}
                </div>
              ))}

              <textarea
                placeholder={t("CommentPanel.reply-placeholder")}
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

              {completionStage !== STAGE.EXPORT && (
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
                  {t("CommentPanel.reply")}
                </button>
              )}

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
                    ? `${t("CommentPanel.show-more")} (${totalReplies - visibleReplies.length} 件)`
                    : t("CommentPanel.show-less")}
                </button>
              )}

            </div>
          );
        })}
      </div>
    </div>
  );
}