import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit'; // ★ createAsyncThunkをインポート

// 認証情報とユーザーの型定義
export interface AuthState {
  isAuthenticated: boolean;
  user: {
    id: string;
    username: string;
  } | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  loading: false,
  error: null,
};

// -------------------------------------------------------------------
// ★ 非同期認証処理 (Thunk) の追加
// createAsyncThunkを使用して、バックエンドとの通信をラップします。
export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async ({ username, password }: { username: string; password: string }, { rejectWithValue }) => {
    try {
      // 💡 実際には、ここにバックエンドへの fetch や axios などの通信処理を書きます。
      // 例: const response = await fetch('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) });

      // ★★★ 暫定的なモック通信処理 ★★★
      await new Promise(resolve => setTimeout(resolve, 1000)); // 擬似的な通信遅延

      if (username === 'user' && password === 'pass') {
        // 成功時のレスポンスデータ
        return {
          id: 'user-001',
          username: username
          // 実際にはAPIから取得したトークンや他のユーザー情報を含める
        };
      } else {
        // 認証失敗
        // rejectWithValueを使ってエラーメッセージを返します。
        return rejectWithValue('ユーザー名またはパスワードが正しくありません。');
      }

    } catch (err) {
      // ネットワークエラーなど
      return rejectWithValue('サーバーとの通信に失敗しました。');
    }
  }
);
// -------------------------------------------------------------------

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // 認証開始時: ロード中に設定
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      // 認証成功時: 認証状態を true にし、ユーザー情報を保存
      .addCase(loginUser.fulfilled, (state, action: PayloadAction<{ id: string; username: string }>) => {
        state.isAuthenticated = true;
        state.user = action.payload;
        state.loading = false;
        state.error = null;
      })
      // 認証失敗時: エラーメッセージを保存
      .addCase(loginUser.rejected, (state, action) => {
        state.isAuthenticated = false;
        state.user = null;
        state.loading = false;
        // rejectWithValueで返された値が action.payload に入る
        state.error = action.payload as string || 'ログインに失敗しました。'; 
      });
  },
});

// export const { loginStart, loginSuccess, loginFailure, logout } = authSlice.actions; // 不要になったものを削除
export const { logout } = authSlice.actions;

export default authSlice.reducer;