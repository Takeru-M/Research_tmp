// src/components/CommentPanel.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Comment } from '../redux/features/editor/editorTypes';

type Props = {
  highlights: { id: string; text: string }[];
  comments: Comment[];
  activeHighlightId?: string;
  onSelectHighlight: (highlightId: string) => void; // ← ハイライトを光らせる
  onDeleteComment: (commentId: string) => void;
  onAddReply: (highlightId: string, parentId: string | null, text: string) => void;
  onEditComment: (commentId: string, newText: string) => void;
};

const CommentPanel: React.FC<Props> = ({
  highlights,
  comments,
  activeHighlightId,
  onSelectHighlight,
  onDeleteComment,
  onAddReply,
  onEditComment,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // スレッドごとに返信入力を保持
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [editText, setEditText] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Highlight click → panel scroll
  useEffect(() => {
    if (!activeHighlightId || !panelRef.current) return;
    const el = panelRef.current.querySelector(`#thread-${activeHighlightId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeHighlightId]);

  const getThreadComments = (hid: string) =>
    comments.filter((c) => c.highlightId === hid && c.parentId === null);

  const getReplies = (pid: string) =>
    comments.filter((c) => c.parentId === pid);

  return (
    <div
      ref={panelRef}
      style={{
        width: "360px",
        height: "100%",
        overflowY: "auto",
        borderLeft: "1px solid #ddd",
        padding: "10px",
        background: "#fafafa",
      }}
    >
      <h3 style={{ marginBottom: 10 }}>コメント</h3>

      {highlights.map((hl) => {
        const thread = getThreadComments(hl.id);
        const isActive = activeHighlightId === hl.id;

        return (
          <div
            key={hl.id}
            id={`thread-${hl.id}`}
            style={{
              marginBottom: 16,
              padding: 10,
              borderRadius: 6,
              background: isActive ? "#fff8d6" : "#fff",
              border: isActive ? "1px solid #f0c000" : "1px solid #eee",
              cursor: "pointer",
            }}
            onClick={() => onSelectHighlight(hl.id)}
          >
            <div>
              <strong>対応箇所:</strong> {hl.text.slice(0, 80)}{hl.text.length > 80 && "…"}
            </div>

            {thread.map((root) => {
              const open = expanded[root.id];
              return (
                <div key={root.id} style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: "bold" }}>
                    {root.author}{" "}
                    <small style={{ color: "#777" }}>
                      {new Date(root.createdAt).toLocaleString()}
                    </small>
                  </div>

                  {editing[root.id] ? (
                    <>
                      <textarea
                        value={editText[root.id]}
                        onChange={(e) =>
                          setEditText((p) => ({
                            ...p,
                            [root.id]: e.target.value,
                          }))
                        }
                        rows={3}
                        style={{ width: "100%", marginTop: 4 }}
                      />
                      <button
                        onClick={() => {
                          onEditComment(root.id, editText[root.id]);
                          setEditing((p) => ({ ...p, [root.id]: false }));
                        }}
                        style={{ marginTop: 4 }}
                      >
                        保存
                      </button>
                    </>
                  ) : (
                    <div style={{ marginTop: 4 }}>
                      {open ? root.text : root.text.slice(0, 180)}
                      {root.text.length > 180 && (
                        <button
                          style={{ marginLeft: 6, fontSize: 12 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpanded((p) => ({ ...p, [root.id]: !open }));
                          }}
                        >
                          {open ? "折りたたむ" : "続きを読む"}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Reply List */}
                  <div style={{ marginTop: 4, paddingLeft: 10 }}>
                    {getReplies(root.id).map((r) => (
                      <div key={r.id} style={{ marginTop: 4 }}>
                        <strong>{r.author}</strong> {r.text}
                      </div>
                    ))}
                  </div>

                  {/* Reply Input */}
                  <textarea
                    placeholder="返信を書く..."
                    rows={2}
                    value={replyText[root.id] || ""}
                    onChange={(e) =>
                      setReplyText((p) => ({ ...p, [root.id]: e.target.value }))
                    }
                    style={{ width: "100%", marginTop: 6 }}
                  />
                  <button
                    onClick={() => {
                      const t = replyText[root.id]?.trim();
                      if (!t) return;
                      onAddReply(hl.id, root.id, t);
                      setReplyText((p) => ({ ...p, [root.id]: "" }));
                    }}
                    style={{ marginTop: 4 }}
                  >
                    返信
                  </button>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export default CommentPanel;
