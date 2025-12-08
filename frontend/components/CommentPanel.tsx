import React, { useState, useEffect, useRef, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  addComment,
  updateComment,
  deleteComment,
  setActiveCommentId,
  setActiveHighlightId,
  toggleSelectRootComment,
} from "../redux/features/editor/editorSlice";
import { selectCompletionStage } from '../redux/features/editor/editorSelectors';
import { PdfHighlight, HighlightInfo } from "@/redux/features/editor/editorTypes";
import { Comment } from "@/redux/features/editor/editorTypes";
import { useTranslation } from "react-i18next";
import { useSession } from "next-auth/react";
import styles from "../styles/CommentPanel.module.css";
import { COLLAPSE_THRESHOLD, ROOTS_COLLAPSE_THRESHOLD, STAGE } from "@/utils/constants";
import { apiClient } from "@/utils/apiClient";
import { ErrorDisplay } from "./ErrorDisplay";
import { logUserAction } from "@/utils/logger";

// 動的なパディングを計算するヘルパー関数
const getDynamicPadding = (viewerHeight: number | 'auto'): number => {
  return (typeof viewerHeight !== 'number') ? 500 : viewerHeight;
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
  completionStage?: number;
  isRoot?: boolean;
  isSelected?: boolean;
  onSelectRoot?: (id: string) => void;
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
  completionStage,
  isRoot = false,
  isSelected = false,
  onSelectRoot,
}) => {
  const { t } = useTranslation();
  const isEditing = editingId === comment.id;
  const [isMenuAreaHovered, setIsMenuAreaHovered] = useState(false);
  const isMenuOpen = !!menuOpenMap[comment.id];
  const isExportStage = completionStage === STAGE.EXPORT;

  const showSelectButton = isRoot && (
    completionStage === STAGE.GIVE_DELIBERATION_TIPS ||
    completionStage === STAGE.GIVE_MORE_DELIBERATION_TIPS
  );

  // セッション情報から取得したユーザー名を優先的に使用
  const displayAuthor = comment.author || currentUserName || t("CommentPanel.comment-author-user");
  const [hoveredMenuItem, setHoveredMenuItem] = useState<string | null>(null);

  const time = useMemo(() => {
    const date = new Date(comment.created_at);
    return date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) + ' ' + date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  }, [comment.created_at]);

  const showMenu = !isExportStage;

  return (
    <div className={styles.commentHeader}>
      <div className={styles.commentHeaderLeft}>
        {/* 選択状態バッジ（ルートで選択されている場合のみ表示） */}
        {showSelectButton && isSelected &&  (
          <span className={styles.selectedBadge}>✓ {t("CommentPanel.selected")}</span>
        )}

        {/* ユーザー情報と時刻 */}
        <div className={styles.commentUserInfo}>
          <strong className={styles.commentAuthor}>{displayAuthor}</strong>
          <small className={styles.commentTime}>
            {time}
          </small>
        </div>

        {/* ハイライトテキスト表示 */}
        {highlightText && (
          <div
            className={styles.highlightTextPreview}
            title={highlightText}
          >
            <em>{highlightText}</em>
          </div>
        )}
      </div>

      {/* メニューボタン */}
      {showMenu && (
        <div
          className={styles.menuContainer}
          ref={menuRef}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={() => !isExportStage && setIsMenuAreaHovered(true)}
          onMouseLeave={() => setIsMenuAreaHovered(false)}
        >
          <button
            className={`${styles.menuButton} ${(isMenuAreaHovered || isMenuOpen) && !isExportStage ? styles.active : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (!isExportStage) {
                toggleMenu(comment.id);
                logUserAction('comment_menu_toggled', {
                  commentId: comment.id,
                  isOpen: !isMenuOpen,
                  isRoot,
                  timestamp: new Date().toISOString(),
                });
              }
            }}
            disabled={isExportStage}
          >
            ⋮
          </button>

          {isMenuOpen && !isExportStage && (
            <div className={styles.dropdownMenu}>
              {/* ルートのみ「選択」または「選択解除」ボタン表示 */}
              {showSelectButton && (
                <button
                  className={`${styles.menuItem} ${isSelected ? styles.unselectItem : ''}`}
                  onMouseEnter={() => setHoveredMenuItem('select')}
                  onMouseLeave={() => setHoveredMenuItem(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectRoot?.(comment.id);
                    logUserAction('comment_selection_toggled', {
                      commentId: comment.id,
                      isSelected: !isSelected,
                      timestamp: new Date().toISOString(),
                    });
                  }}
                  title={isSelected ? t("CommentPanel.unselect") : t("CommentPanel.select")}
                >
                  {isSelected ? t("CommentPanel.unselect") : t("CommentPanel.select")}
                </button>
              )}
              {!isEditing && (
                <button
                  className={styles.menuItem}
                  onMouseEnter={() => setHoveredMenuItem('edit')}
                  onMouseLeave={() => setHoveredMenuItem(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditing(comment.id, comment.text);
                    logUserAction('comment_edit_started', {
                      commentId: comment.id,
                      isRoot,
                      textLength: comment.text.length,
                      timestamp: new Date().toISOString(),
                    });
                  }}
                >
                  {t("Utils.edit")}
                </button>
              )}
              <button
                className={`${styles.menuItem} ${styles.delete}`}
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
  const [errorMessage, setErrorMessage] = useState<string>("");

  // ユーザーIDを取得するヘルパー関数を追加
  const getUserId = () => session?.user?.id || session?.user?.email || 'anonymous';

  const { comments, activeHighlightId, activeCommentId, highlights, selectedRootCommentIds } = useSelector((s: any) => s.editor);
  const completionStage = useSelector(selectCompletionStage);
  const isExportStage = completionStage === Number(STAGE.EXPORT);

  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [menuOpenMap, setMenuOpenMap] = useState<Record<string, boolean>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const commentPanelRef = useRef<HTMLDivElement>(null);
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});

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
    logUserAction('comment_thread_collapsed', {
      rootId,
      isCollapsed: !collapsedMap[rootId],
      timestamp: new Date().toISOString(),
    }, getUserId());
  };

  const startEditing = (id: string, text: string) => {
    setEditingId(id);
    setEditText(text);
    closeMenu(id);
  };

  const saveEdit = async (id: string) => {
    try {
      const { data, error, status } = await apiClient<Comment>(`/comments/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${session?.accessToken}` },
        body: {
          text: editText,
        },
      });

      if (error) {
        console.error('[saveEdit] API error:', error);
        setErrorMessage(t('Error.update-comment-failed'));
        logUserAction('comment_edit_failed', {
          commentId: id,
          reason: error,
          timestamp: new Date().toISOString(),
        }, getUserId());
        return;
      }

      if (!data) {
        console.warn('[saveEdit] No data received from API');
        setErrorMessage(t('Error.update-comment-failed'));
        logUserAction('comment_edit_failed', {
          commentId: id,
          reason: 'no_data_received',
          timestamp: new Date().toISOString(),
        }, getUserId());
        return;
      }

      dispatch(updateComment({ id, text: editText }));
      setEditingId(null);
      setEditText("");
      logUserAction('comment_edited', {
        commentId: id,
        textLength: editText.length,
        timestamp: new Date().toISOString(),
      }, getUserId());
    } catch (error: any) {
      console.error('[saveEdit] Unexpected error:', error);
      setErrorMessage(t('Error.update-comment-failed'));
      logUserAction('comment_edit_failed', {
        commentId: id,
        reason: error.message,
        timestamp: new Date().toISOString(),
      }, getUserId());
    }
  };

  const removeCommentFn = async (id: string) => {
    if (!window.confirm(t("Alert.comment-delete"))) {
      logUserAction('comment_delete_cancelled', {
        commentId: id,
        timestamp: new Date().toISOString(),
      }, getUserId());
      return;
    }

    const comment = comments.find((c: Comment) => c.id === id);
    if (!comment) {
      console.warn('[removeCommentFn] Comment not found:', id);
      return;
    }

    try {
      if (comment.parentId === null) {
        // ルートコメント: ハイライトがあれば一緒に削除
        if (comment.highlightId) {
          const { error } = await apiClient<void>(`/highlights/${comment.highlightId}`, {
            method: 'DELETE',
            headers: session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : undefined,
          });

          if (error) {
            console.error('[removeCommentFn] Highlight delete error:', error);
            setErrorMessage(t('Error.delete-comment-failed'));
            logUserAction('comment_delete_failed', {
              commentId: id,
              reason: 'highlight_delete_error',
              error,
              timestamp: new Date().toISOString(),
            }, getUserId());
            return;
          }

          console.log('[removeCommentFn] Highlight deleted:', comment.highlightId);
          dispatch({ type: "editor/deleteHighlight", payload: { id: comment.highlightId } });
          dispatch(deleteComment({ id }));
        } else {
          const { error } = await apiClient<void>(`/comments/${comment.id}`, {
            method: 'DELETE',
            headers: session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : undefined,
          });

          if (error) {
            console.error('[removeCommentFn] Comment delete error:', error);
            setErrorMessage(t('Error.delete-comment-failed'));
            logUserAction('comment_delete_failed', {
              commentId: id,
              reason: 'comment_delete_error',
              error,
              timestamp: new Date().toISOString(),
            }, getUserId());
            return;
          }

          console.log('[removeCommentFn] Comment deleted:', comment.id);
          dispatch(deleteComment({ id }));
        }
      } else {
        // 返信コメント: コメント単体削除
        const { error } = await apiClient<void>(`/comments/${id}`, {
          method: 'DELETE',
          headers: session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : undefined,
        });

        if (error) {
          console.error('[removeCommentFn] Reply delete error:', error);
          setErrorMessage(t('Error.delete-comment-failed'));
          logUserAction('comment_delete_failed', {
            commentId: id,
            reason: 'reply_delete_error',
            error,
            timestamp: new Date().toISOString(),
          }, getUserId());
          return;
        }

        console.log('[removeCommentFn] Reply deleted:', id);
        dispatch(deleteComment({ id }));
      }

      logUserAction('comment_deleted', {
        commentId: id,
        isRoot: comment.parentId === null,
        hadHighlight: !!comment.highlightId,
        timestamp: new Date().toISOString(),
      }, getUserId());
      closeMenu(id);
    } catch (error: any) {
      console.error('[removeCommentFn] Unexpected error:', error);
      setErrorMessage(t('Error.delete-comment-failed'));
      logUserAction('comment_delete_failed', {
        commentId: id,
        reason: error.message,
        timestamp: new Date().toISOString(),
      }, getUserId());
    }
  };

  const sendReply = async (parentId: string) => {
    const replyText = replyTextMap[parentId] || "";
    if (!replyText.trim()) {
      console.warn('[sendReply] Empty reply text');
      return;
    }

    const parentComment = comments.find((c: Comment) => c.id === parentId);
    if (!parentComment) {
      console.warn('[sendReply] Parent comment not found:', parentId);
      return;
    }

    try {
      const userName = session?.user?.name || t("CommentPanel.comment-author-user");

      const { data, error } = await apiClient<Comment>('/comments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.accessToken}` },
        body: {
          highlight_id: parentComment.highlightId ? parseInt(parentComment.highlightId, 10) : null,
          parent_id: parseInt(parentId, 10),
          author: userName,
          text: replyText.trim(),
        },
      });

      if (error) {
        console.error('[sendReply] API error:', error);
        setErrorMessage(t('Error.save-reply-failed'));
        logUserAction('reply_save_failed', {
          parentId,
          reason: error,
          textLength: replyText.length,
          timestamp: new Date().toISOString(),
        }, getUserId());
        return;
      }

      if (!data) {
        console.warn('[sendReply] No data received from API');
        setErrorMessage(t('Error.save-reply-failed'));
        logUserAction('reply_save_failed', {
          parentId,
          reason: 'no_data_received',
          textLength: replyText.length,
          timestamp: new Date().toISOString(),
        }, getUserId());
        return;
      }

      const savedComment = data;

      dispatch(
        addComment({
          id: savedComment.id.toString(),
          parentId,
          highlightId: parentComment.highlightId,
          author: userName,
          text: replyText.trim(),
          created_at: savedComment.created_at,
          edited_at: null,
          deleted: false,
        })
      );

      setReplyTextMap((prev) => ({ ...prev, [parentId]: "" }));
      setCollapsedMap(prev => ({ ...prev, [parentId]: false }));

      logUserAction('reply_created', {
        replyId: savedComment.id,
        parentId,
        textLength: replyText.length,
        timestamp: new Date().toISOString(),
      }, getUserId());

      console.log('[sendReply] Reply saved successfully:', savedComment.id);
    } catch (error: any) {
      console.error('[sendReply] Unexpected error:', error);
      setErrorMessage(t('Error.save-reply-failed'));
      logUserAction('reply_save_failed', {
        parentId,
        reason: error.message,
        textLength: replyText.length,
        timestamp: new Date().toISOString(),
      }, getUserId());
    }
  };

  const handleReplyTextChange = (parentId: string, text: string) => {
    setReplyTextMap((prev) => ({ ...prev, [parentId]: text }));
  };

  const renderCommentBody = (comment: Comment) => {
    const isEditing = editingId === comment.id;
    return isEditing ? (
      <div className={styles.editContainer} onClick={(e) => e.stopPropagation()}>
        <textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          className={styles.editTextarea}
        />
        <div className={styles.editButtonGroup}>
          <button
            className={styles.saveButton}
            onClick={(e) => { e.stopPropagation(); saveEdit(comment.id); }}
          >
            {t("Utils.save")}
          </button>
          <button
            className={styles.cancelButton}
            onClick={(e) => {
              e.stopPropagation();
              setEditingId(null);
              logUserAction('comment_edit_cancelled', {
                commentId: comment.id,
                timestamp: new Date().toISOString(),
              });
            }}
          >
            {t("Utils.cancel")}
          </button>
        </div>
      </div>
    ) : (
      <p className={styles.commentBody}>{comment.text}</p>
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
      if (rootId) {
        setCollapsedMap(prev => ({ ...prev, [rootId]: false }));
        logUserAction('comment_activated', {
          commentId: activeCommentId,
          rootId,
          timestamp: new Date().toISOString(),
        }, getUserId());
      }
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

  // ルートコメント行レンダリング時に isRoot/isSelected/onSelectRoot を渡す
  return (
    <>
      {errorMessage && (
        <ErrorDisplay
          title={t('Utils.error')}
          message={errorMessage}
          onClose={() => setErrorMessage("")}
        />
      )}
      <div
        ref={commentPanelRef}
        className={styles.commentPanel}
        style={{
          maxHeight: viewerHeight !== 'auto'
            ? `calc(${viewerHeight}px)`
            : 'auto',
        }}
      >
        <div
          ref={scrollContainerRef}
          className={styles.scrollContainer}
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
            const isActive = activeCommentId === root.id || (activeHighlightId && root.highlightId === activeHighlightId);
            const isSelected = selectedRootCommentIds.includes(root.id);

            return (
              <div
                key={root.id}
                ref={(el) => { threadRefs.current[root.id] = el; }}
                className={`${styles.threadCard} ${isActive ? styles.active : ''} ${isSelected ? styles.selected : ''}`}
                onClick={() => {
                  dispatch(setActiveCommentId(root.id));
                  dispatch(setActiveHighlightId(root.highlightId));
                  setCollapsedMap(prev => ({ ...prev, [root.id]: false }));
                  logUserAction('root_comment_selected', {
                    rootCommentId: root.id,
                    highlightId: root.highlightId,
                    timestamp: new Date().toISOString(),
                  }, getUserId());
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
                  completionStage={completionStage}
                  isRoot={true}
                  isSelected={isSelected}
                  onSelectRoot={(id) => {
                    dispatch(toggleSelectRootComment(id));
                    closeMenu(id);
                  }}
                />

                {renderCommentBody(root)}

                {visibleReplies.map((reply) => (
                  <div
                    key={reply.id}
                    className={`${styles.replyContainer} ${activeCommentId === reply.id ? styles.active : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch(setActiveCommentId(reply.id));
                      dispatch(setActiveHighlightId(reply.highlightId));
                      const rootId = findRootId(reply.id);
                      if (rootId) setCollapsedMap(prev => ({ ...prev, [rootId]: false }));
                      logUserAction('reply_selected', {
                        replyId: reply.id,
                        parentId: reply.parentId,
                        rootCommentId: root.id,
                        timestamp: new Date().toISOString(),
                      }, getUserId());
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
                      completionStage={completionStage}
                      isRoot={false}
                    />
                    {renderCommentBody(reply)}
                  </div>
                ))}

                <textarea
                  placeholder={t("CommentPanel.reply-placeholder")}
                  value={replyTextMap[root.id] || ""}
                  onChange={(e) => handleReplyTextChange(root.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  disabled={isExportStage}
                  className={styles.replyTextarea}
                />

                <button
                  className={styles.replyButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isExportStage) {
                      sendReply(root.id);
                    }
                  }}
                  disabled={isExportStage}
                >
                  {t("CommentPanel.reply")}
                </button>

                {showCollapseButton && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isExportStage) {
                        toggleCollapse(root.id);
                      }
                    }}
                    disabled={isExportStage}
                    className={styles.collapseButton}
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
    </>
  );
}