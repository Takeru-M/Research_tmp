import React, { useState, useEffect, useRef } from "react";
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
  padding: "4px 8px",
  borderRadius: "50%",
  lineHeight: 1,
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

// menu item base
const menuItem: React.CSSProperties = {
  padding: "8px 12px",
  cursor: "pointer",
  fontSize: 14,
  background: "#fff",
  borderBottom: "1px solid #eee",
};

export default function CommentPanel() {
  const dispatch = useDispatch();
  const { comments, activeHighlightId, activeCommentId } = useSelector((s) => s.editor);

  // 変更: replyTextを各スレッドの返信テキストを保持するマップに変更
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [menuOpenMap, setMenuOpenMap] = useState<Record<string, boolean>>({});

  // ✅ refs to detect outside click
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const toggleMenu = (id: string) => {
    setMenuOpenMap((m) => {
      const newMap = Object.keys(m).reduce((acc, key) => {
        acc[key] = false; // close all others
        return acc;
      }, {} as Record<string, boolean>);
      newMap[id] = !m[id];
      return newMap;
    });
  };

  // ✅ click-outside handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const clickedInside = Object.entries(menuRefs.current).some(
        ([id, ref]) => ref && ref.contains(event.target as Node)
      );
      if (!clickedInside) setMenuOpenMap({});
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const closeMenu = (id: string) => setMenuOpenMap((m) => ({ ...m, [id]: false }));

  const rootComments = comments.filter((c) => c.parentId === null);
  const replies = (pid: string) => comments.filter((c) => c.parentId === pid);

  const startEditing = (id: string, text: string) => {
    setEditingId(id);
    setEditText(text);
  };

  const saveEdit = (id: string) => {
    dispatch(updateComment({ id, text: editText }));
    setEditingId(null);
  };

  const removeCommentFn = (id: string) => {
    dispatch(deleteComment({ id }));
    closeMenu(id);
  };

  // 変更: replyTextMapを使用して特定の親IDのテキストを送信
  const sendReply = (parentId: string) => {
    const replyText = replyTextMap[parentId] || ""; // 親IDに対応するテキストを取得
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
    // 成功後、そのスレッドのテキストをクリア
    setReplyTextMap((prev) => ({ ...prev, [parentId]: "" }));
  };

  // 新規: 親IDに対応するテキストを更新するハンドラ
  const handleReplyTextChange = (parentId: string, text: string) => {
    setReplyTextMap((prev) => ({ ...prev, [parentId]: text }));
  };

  return (
    <div style={{ width: 300, borderLeft: "1px solid #ddd", padding: 10 }}>
      <h3 style={{ marginBottom: 12, fontSize: 17 }}>コメント</h3>

      {rootComments.map((root) => (
        <div
          key={root.id}
          style={{
            background: activeCommentId === root.id ? "#f0f7ff" : "#fff",
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 10,
            marginBottom: 12,
          }}
          onClick={() => {
            dispatch(setActiveCommentId(root.id));
            dispatch(setActiveHighlightId(root.highlightId));
          }}
        >
          {/* ... (省略: コメント表示部分、編集UI、メニュー) ... */}
          {/* 編集UI内の保存ボタンの修正 */}
          {editingId === root.id ? (
            <div>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                style={{ width: "100%", marginTop: 6 }}
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
                onClick={() => saveEdit(root.id)}
              >
                保存
              </button>
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
                onClick={() => setEditingId(null)}
              >
                キャンセル
              </button>
            </div>
          ) : (
            <p style={{ marginTop: 6 }}>{root.text}</p>
          )}

          {replies(root.id).map((r) => (
            <div key={r.id} style={{ marginLeft: 14, marginTop: 8, borderLeft: "2px solid #eee", paddingLeft: 8 }}>
              {/* ... (省略: 返信表示部分、編集UI、メニュー) ... */}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <strong>{r.author}</strong>
                  <small style={{ marginLeft: 6, color: "#666" }}>
                    {new Date(r.createdAt).toLocaleString()}
                  </small>
                </div>

                <div style={menuStyle} ref={(el) => (menuRefs.current[r.id] = el)}>
                  <span
                    style={menuButtonStyle}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMenu(r.id);
                    }}
                  >
                    ⋮
                  </span>

                  {menuOpenMap[r.id] && (
                    <div style={dropdownStyle}>
                      {editingId !== r.id && (
                        <div
                          style={menuItem}
                          onClick={() => startEditing(r.id, r.text)}
                        >
                          ✏️ 編集
                        </div>
                      )}
                      <div
                        style={{ ...menuItem, color: "red", borderBottom: "none" }}
                        onClick={() => removeCommentFn(r.id)}
                      >
                        🗑️ 削除
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {editingId === r.id ? (
                <div>
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    style={{ width: "100%", marginTop: 6 }}
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
                    onClick={() => saveEdit(r.id)}
                  >
                    保存
                  </button>
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
                    onClick={() => setEditingId(null)}
                  >
                    キャンセル
                  </button>
                </div>
              ) : (
                <p style={{ marginTop: 4 }}>{r.text}</p>
              )}
            </div>
          ))}

          {/* 変更: replyTextMapから現在のスレッドの値を参照・更新 */}
          <textarea
            placeholder="返信を書く..."
            value={replyTextMap[root.id] || ""} // root.idに対応する値を表示
            onChange={(e) => handleReplyTextChange(root.id, e.target.value)} // root.idに対応する値を更新
            style={{
              width: "100%",
              marginTop: 8,
              fontSize: 14,
              padding: 6,
              borderRadius: 6,
              border: "1px solid #ccc",
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
            onClick={() => sendReply(root.id)}
          >
            返信
          </button>
        </div>
      ))}
    </div>
  );
}