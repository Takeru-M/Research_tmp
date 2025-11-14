import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface LoadingState {
  isLoading: boolean;
  message: string | null;
}

const initialState: LoadingState = {
  isLoading: false,
  message: null,
};

const loadingSlice = createSlice({
  name: 'loading',
  initialState,
  reducers: {
    startLoading(state, action: PayloadAction<string | null>) {
      state.isLoading = true;
      state.message = action.payload;
    },
    stopLoading(state) {
      state.isLoading = false;
      state.message = null;
    },
  },
});

export const { startLoading, stopLoading } = loadingSlice.actions;
export default loadingSlice.reducer;