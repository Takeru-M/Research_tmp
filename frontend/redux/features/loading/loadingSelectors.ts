import { RootState } from '../../store';

export const selectIsLoading = (state: RootState) => state.loading.isLoading;
export const selectLoadingMessage = (state: RootState) => state.loading.message;