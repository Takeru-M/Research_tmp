// src/redux/rootReducer.ts
import { combineReducers } from '@reduxjs/toolkit';
import editorReducer from './features/editor/editorSlice';
import loadingReducer from './features/loading/loadingSlice';
import authReducer from './features/auth/authSlice';

const rootReducer = combineReducers({
  editor: editorReducer,
  loading: loadingReducer,
  auth: authReducer,
});

export default rootReducer;
export type RootState = ReturnType<typeof rootReducer>;
