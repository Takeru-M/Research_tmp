import React, { useState } from 'react';
import { Comment } from '../redux/features/editor/editorTypes';
import { useDispatch } from 'react-redux';
import { updateComment, deleteComment, addComment } from '../redux/features/editor/editorSlice';
import { v4 as uuidv4 } from 'uuid';

type Props = {
  rootComment: Comment;
  replies: Comment[]; // parentId === rootComment.id の配列
  currentUser: string;
  highlightId: string;
};

const CommentThread: React.FC<Props> = ({ rootComment, replies, currentUser, highlightId }) => {
  const dispatch = useDispatch();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(rootComment.text);
  const [replyText, setReplyText] = useState('');

  const handleSaveEdit = () => {
    if (text.trim() === '') return;
    dispatch(updateComment({ id: rootComment.id, text }));
    setEditing(false);
  };

  const handleDelete = () => {
    if (!confirm('このコメントを削除しますか？（実際は「削除フラグ」を立てます）')) return;
    dispatch(deleteComment({ id: rootComment.id }));
  };

  const handleAddReply = () => {
    if (!replyText.trim()) return;
    const newReply: Comment = {
      id: uuidv4(),
      highlightId,
      parentId: rootComment.id,
      author: currentUser,
      text: replyText.trim(),
      createdAt: new Date().toISOString(),
      editedAt: null,
      deleted: false,
    };
    dispatch(addComment(newReply));
    setReplyText('');
  };

  return (
    <div style={{ border: '1px solid #eee', padding: 8, marginBottom: 8, borderRadius: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <strong>{rootComment.author}</strong> <small>{new Date(rootComment.createdAt).toLocaleString()}</small>
        </div>
        <div>
          {!rootComment.deleted && rootComment.author === currentUser && (
            <>
              <button onClick={() => setEditing((v) => !v)} style={{ marginRight: 8 }}>
                {editing ? '取消' : '編集'}
              </button>
              <button onClick={handleDelete}>削除</button>
            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        {rootComment.deleted ? <em>（削除されました）</em> : editing ? (
          <>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} style={{ width: '100%' }} />
            <div style={{ marginTop: 6 }}>
              <button onClick={handleSaveEdit}>保存</button>
              <button onClick={() => { setEditing(false); setText(rootComment.text); }} style={{ marginLeft: 8 }}>キャンセル</button>
            </div>
          </>
        ) : (
          <div>{rootComment.text}</div>
        )}
      </div>

      {/* replies */}
      <div style={{ marginTop: 10, paddingLeft: 12 }}>
        {replies.map((r) => (
          <div key={r.id} style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 13 }}>
              <strong>{r.author}</strong> <small>{new Date(r.createdAt).toLocaleString()}</small>
              {r.deleted ? <em style={{ marginLeft: 8 }}>(削除)</em> : null}
            </div>
            <div>{r.deleted ? <em>（削除されました）</em> : r.text}</div>
          </div>
        ))}

        <div style={{ marginTop: 8 }}>
          <textarea placeholder="返信を追加..." value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={2} style={{ width: '100%' }} />
          <div style={{ marginTop: 6 }}>
            <button onClick={handleAddReply}>返信</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommentThread;
