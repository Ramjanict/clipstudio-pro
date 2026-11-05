import { configureStore } from '@reduxjs/toolkit';
import editorReducer from './editorSlice';
import authReducer from './authSlice';
import workerReducer from './workerSlice';
import uiReducer from './uiSlice';

export const store = configureStore({
  reducer: {
    editor: editorReducer,
    auth: authReducer,
    worker: workerReducer,
    ui: uiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
