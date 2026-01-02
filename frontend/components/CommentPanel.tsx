import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import type { RootState } from "@/redux/store";
import {
  addComment,
  updateComment,
  deleteComment,
  setActiveCommentId,
  setActiveHighlightId,
  toggleSelectRootComment,
  triggerSoftDeleteFlagCheck,
} from "../redux/features/editor/editorSlice";
import { selectCompletionStage } from '../redux/features/editor/editorSelectors';
import { PdfHighlight, HighlightInfo } from "@/redux/features/editor/editorTypes";
import { Comment } from "@/redux/features/editor/editorTypes";
import { useTranslation } from "react-i18next";
import { useSession } from "next-auth/react";
import styles from "../styles/CommentPanel.module.css";
import { COLLAPSE_THRESHOLD, ROOTS_COLLAPSE_THRESHOLD, STAGE, COMMENT_PURPOSE, COMMENT_PURPOSE_LABELS, COMMENT_PURPOSE_STYLES } from "@/utils/constants";
import { apiClient } from "@/utils/apiClient";
import { ErrorDisplay } from "./ErrorDisplay";
import { logUserAction } from "@/utils/logger";
import { DeleteReasonModal } from './DeleteReasonModal';

// 動的なパディングを計算するヘルパー関数
const getDynamicPadding = (viewerHeight: number | 'auto'): number => {
  return (typeof viewerHeight !== 'number') ? 500 : viewerHeight;
};

const resolvePurposeForStage = (stage: number | null | undefined): number | null => {
  if (!stage) return null;
  switch (stage) {
    case STAGE.GIVE_OPTION_TIPS:
      return COMMENT_PURPOSE.THINKING_PROCESS;
    case STAGE.GIVE_DELIBERATION_TIPS:
      return COMMENT_PURPOSE.OTHER_OPTIONS;
    case STAGE.GIVE_MORE_DELIBERATION_TIPS:
      return COMMENT_PURPOSE.DELIBERATION;
    default:
      return null;
  }
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

  const displayAuthor = comment.author || currentUserName || t("CommentPanel.comment-author-user");
  const [hoveredMenuItem, setHoveredMenuItem] = useState<string | null>(null);

  const time = useMemo(() => {
    const date = new Date(comment.created_at);
    return date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) + ' ' + date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  }, [comment.created_at]);

  const purposeBadge = useMemo(() => {
    if (!comment.purpose) return null;
    const label = COMMENT_PURPOSE_LABELS[comment.purpose];
    const style = COMMENT_PURPOSE_STYLES[comment.purpose];
    if (!label || !style) return null;
    return { label, style };
  }, [comment.purpose]);

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
          {purposeBadge && (
            <span
              className={styles.purposeBadge}
              style={{
                color: purposeBadge.style.fg,
                backgroundColor: purposeBadge.style.bg,
                borderColor: purposeBadge.style.border,
              }}
            >
              {purposeBadge.label}
            </span>
          )}
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

          {isMenuOpen && (
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
  const getUserId = () => session?.user?.id || session?.user?.email || 'anonymous';

  const { comments, activeHighlightId, activeCommentId, highlights, selectedRootCommentIds } = useSelector((s: RootState) => s.editor);
  const completionStage = useSelector(selectCompletionStage);
  const isExportStage = completionStage === Number(STAGE.EXPORT);

  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [menuOpenMap, setMenuOpenMap] = useState<Record<string, boolean>>({});

  const [deleteReasonModalOpen, setDeleteReasonModalOpen] = useState(false);
  const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
      const { data, error, status } = await apiClient<Comment>(`/comments/${id}/`, {
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
    } catch (error: Error | unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[saveEdit] Unexpected error:', error);
      setErrorMessage(t('Error.update-comment-failed'));
      logUserAction('comment_edit_failed', {
        commentId: id,
        reason: errorMessage,
        timestamp: new Date().toISOString(),
      }, getUserId());
    }
  };

  const removeCommentFn = async (id: string) => {
    const comment = comments.find((c: Comment) => c.id === id);
    if (!comment) {
      console.warn('[removeCommentFn] Comment not found:', id);
      return;
    }

    const isLLMComment = (comment.author || "").toLowerCase() === t("CommentPanel.comment-author-LLM").toLowerCase();
    const isRootComment = comment.parentId === null;

    // ルートでないLLMコメント: 理由の入力を求める
    if (isLLMComment && !isRootComment) {
      setPendingDeleteCommentId(id);
      setDeleteReasonModalOpen(true);
      logUserAction('comment_delete_reason_requested', {
        commentId: id,
        reason: 'llm_comment_soft_delete',
        isRoot: isRootComment,
        timestamp: new Date().toISOString(),
      }, getUserId());
      return;
    }

    // 確認ダイアログを表示（ルートと子で異なるメッセージ）
    const confirmMessage = isRootComment
      ? t("Alert.comments-delete")
      : t("Alert.comment-delete");
    
    if (!window.confirm(confirmMessage)) {
      logUserAction('comment_delete_cancelled', {
        commentId: id,
        timestamp: new Date().toISOString(),
      }, getUserId());
      return;
    }

    await performDelete(id, null);
  };

  const performDelete = async (id: string, reason: string | null) => {
    const comment = comments.find((c: Comment) => c.id === id);
    if (!comment) {
      console.warn('[performDelete] Comment not found:', id);
      return;
    }

    setIsDeleting(true);

    try {
      if (comment.parentId === null) {
        // ルートコメント: ハイライトがあれば一緒に削除
        if (comment.highlightId) {
          const { error } = await apiClient<void>(`/highlights/${comment.highlightId}/`, {
            method: 'DELETE',
            headers: session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : undefined,
          });

          if (error) {
            console.error('[performDelete] Highlight delete error:', error);
            const errorStr = typeof error === 'string' ? error : JSON.stringify(error);
            if (errorStr.includes('削除できません') || errorStr.includes('Cannot delete')) {
              setErrorMessage(t('Error.cannot-delete-llm-root-with-children') || error);
            } else {
              setErrorMessage(t('Error.delete-comment-failed'));
            }
            logUserAction('comment_delete_failed', {
              commentId: id,
              reason: 'highlight_delete_error',
              error,
              timestamp: new Date().toISOString(),
            }, getUserId());
            return;
          }

          console.log('[performDelete] Highlight deleted:', comment.highlightId);
          dispatch({ type: "editor/deleteHighlight", payload: { id: comment.highlightId } });
          dispatch(deleteComment({ id }));
        } else {
          let deleteUrl = `/comments/${comment.id}/`;
          if (reason) {
            deleteUrl += `?reason=${encodeURIComponent(reason)}`;
          }

          const { error } = await apiClient<void>(deleteUrl, {
            method: 'DELETE',
            headers: session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : undefined,
          });

          if (error) {
            console.error('[performDelete] Comment delete error:', error);
            const errorStr = typeof error === 'string' ? error : JSON.stringify(error);
            if (errorStr.includes('削除できません') || errorStr.includes('Cannot delete')) {
              setErrorMessage(t('Error.cannot-delete-llm-root-with-children') || error);
            } else {
              setErrorMessage(t('Error.delete-comment-failed'));
            }
            logUserAction('comment_delete_failed', {
              commentId: id,
              reason: 'comment_delete_error',
              error,
              timestamp: new Date().toISOString(),
            }, getUserId());
            return;
          }

          console.log('[performDelete] Comment deleted:', comment.id);
          dispatch(deleteComment({ id }));
        }
      } else {
        // 子コメント削除
        let deleteUrl = `/comments/${id}/`;
        if (reason) {
          deleteUrl += `?reason=${encodeURIComponent(reason)}`;
        }

        const { error } = await apiClient<void>(deleteUrl, {
          method: 'DELETE',
          headers: session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : undefined,
        });

        if (error) {
          console.error('[performDelete] Reply delete error:', error);
          setErrorMessage(t('Error.delete-comment-failed'));
          logUserAction('comment_delete_failed', {
            commentId: id,
            reason: 'reply_delete_error',
            error,
            timestamp: new Date().toISOString(),
          }, getUserId());
          return;
        }

        console.log('[performDelete] Reply deleted:', id);
        dispatch(deleteComment({ id }));
      }

      logUserAction('comment_deleted', {
        commentId: id,
        isRoot: comment.parentId === null,
        hadHighlight: !!comment.highlightId,
        hadReason: !!reason,
        wasSoftDelete: !!reason,
        timestamp: new Date().toISOString(),
      }, getUserId());

      // LLMコメントのソフトデリート時は、復元ボタン表示フラグをチェック
      if (reason && (comment.author || "").toLowerCase() === t("CommentPanel.comment-author-LLM").toLowerCase()) {
        dispatch(triggerSoftDeleteFlagCheck());
      }

      closeMenu(id);
    } catch (error: Error | unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[performDelete] Unexpected error:', error);
      setErrorMessage(t('Error.delete-comment-failed'));
      logUserAction('comment_delete_failed', {
        commentId: id,
        reason: errorMessage,
        timestamp: new Date().toISOString(),
      }, getUserId());
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteReasonConfirm = async (reason: string) => {
    if (!pendingDeleteCommentId) return;
    await performDelete(pendingDeleteCommentId, reason);
    setDeleteReasonModalOpen(false);
    setPendingDeleteCommentId(null);
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
      const purpose = resolvePurposeForStage(completionStage);

      const { data, error } = await apiClient<Comment>('/comments/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.accessToken}` },
        body: {
          highlight_id: parentComment.highlightId ? parseInt(parentComment.highlightId, 10) : null,
          parent_id: parseInt(parentId, 10),
          author: userName,
          text: replyText.trim(),
          purpose,
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
          purpose: savedComment.purpose ?? purpose,
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
    } catch (error: Error | unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[sendReply] Unexpected error:', error);
      setErrorMessage(t('Error.save-reply-failed'));
      logUserAction('reply_save_failed', {
        parentId,
        reason: errorMessage,
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

  const findRootId = useCallback((commentId: string | null) => {
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
  }, [comments]);

  const getHighlightInfo = (highlightId: string | null): HighlightInfo | null => {
    if (!highlightId) return null;
    const map = new Map<string, HighlightInfo>();
    (highlights as PdfHighlight[]).forEach((h: PdfHighlight) => map.set(h.id, h));
    const highlightInfo = map.get(highlightId);
    if (!highlightInfo) return null;
    return highlightInfo;
  }

  // ハイライトテキストを取得するヘルパー関数
  const getHighlightText = (highlightId: string | null) => {
    if (!highlightId) return undefined;
    const highlight = highlights.find((h: PdfHighlight) => h.id === highlightId);
    return highlight?.text || undefined;
  };

  // アクティブなコメント/ハイライトに対応するルートIDをメモ化
  const activeRootId = useMemo(() => {
    if (activeCommentId) return findRootId(activeCommentId);
    if (activeHighlightId) {
      const matched = comments.find((c: Comment) => c.highlightId === activeHighlightId);
      if (matched) return findRootId(matched.id);
    }
    return null;
  }, [activeCommentId, activeHighlightId, comments, findRootId]);

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
      <DeleteReasonModal
        isOpen={deleteReasonModalOpen}
        commentAuthor={
          comments.find((c: Comment) => c.id === pendingDeleteCommentId)?.author || ""
        }
        onConfirm={handleDeleteReasonConfirm}
        onCancel={() => {
          setDeleteReasonModalOpen(false);
          setPendingDeleteCommentId(null);
        }}
        isLoading={isDeleting}
      />
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
            paddingTop: `${getDynamicPadding(viewerHeight)}px`,
            paddingBottom: `${getDynamicPadding(viewerHeight)}px`,
          }}
        >
          {sortedRootComments.map((root, rootIdx) => {
            const replies = getReplies(root.id);
            const totalReplies = replies.length;

            console.log('[CommentPanel] Rendering root comment:', {
              rootId: root.id,
              replyCount: replies.length,
              replies: replies.map(r => ({ id: r.id, parentId: r.parentId })),
            });

            // 初期折りたたみ条件を計算（状態には保存しない）
            const baseInitiallyCollapsed =
              totalReplies > COLLAPSE_THRESHOLD ||
              (sortedRootComments.length > ROOTS_COLLAPSE_THRESHOLD && rootIdx >= ROOTS_COLLAPSE_THRESHOLD);

            // EXPORT ステージでも初期状態は baseInitiallyCollapsed に従う
            // つまり、子コメントが多い場合や後ろのスレッドは展開しない
            const isCollapsed =
              root.id === activeRootId
                ? false
                : (collapsedMap[root.id] ?? baseInitiallyCollapsed);

            // 表示する返信を計算（EXPORT でも同じロジック）
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
                    replyCount: replies.length,
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
                      toggleCollapse(root.id);
                    }}
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