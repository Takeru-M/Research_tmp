// src/redux/rootReducer.ts
import { combineReducers } from '@reduxjs/toolkit';
import editorReducer from './features/editor/editorSlice';

const rootReducer = combineReducers({
  editor: editorReducer,
});

export default rootReducer;
export type RootState = ReturnType<typeof rootReducer>;
