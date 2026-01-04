import React from 'react';
import { useDispatch } from 'react-redux';
import { startLoading, stopLoading } from '../redux/features/loading/loadingSlice';
import type { AppDispatch } from '../redux/store';

/**
 * ローディング状態付きでタスクを実行するカスタムフック
 * Redux のローディング状態を自動的に管理します
 */
export const useLoadingHelper = () => {
  const dispatch = useDispatch<AppDispatch>();

  return React.useCallback(async <T,>(label: string, task: () => Promise<T>): Promise<T> => {
    dispatch(startLoading(label));
    try {
      return await task();
    } finally {
      dispatch(stopLoading());
    }
  }, [dispatch]);
};

/**
 * 単純なフラグ状態付きでタスクを実行するカスタムフック
 * Redux を使用せず、ローカル state で管理します
 */
export const useFlagHelper = () => {
  return React.useCallback(async (
    setter: React.Dispatch<React.SetStateAction<boolean>>,
    task: () => Promise<void>
  ) => {
    setter(true);
    try {
      await task();
    } finally {
      setter(false);
    }
  }, []);
};
