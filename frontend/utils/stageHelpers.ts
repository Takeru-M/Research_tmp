import { STAGE, COMMENT_PURPOSE } from './constants';

/**
 * 完了ステージからコメント目的を導出する
 */
export const derivePurposeFromStage = (stage: number | null | undefined): number | null => {
  if (!stage) return null;
  switch (stage) {
    case STAGE.THINKING_PROCESS_SELF:
      return COMMENT_PURPOSE.THINKING_PROCESS;
    case STAGE.THINKING_OPTION_SELF:
    case STAGE.THINKING_OPTION_LLM:
      return COMMENT_PURPOSE.OTHER_OPTIONS;
    case STAGE.THINKING_DELIBERATION_SELF:
    case STAGE.THINKING_DELIBERATION_LLM:
      return COMMENT_PURPOSE.DELIBERATION;
    default:
      return null;
  }
};

/**
 * CommentPanelで使用するステージからコメント目的の解決ロジック
 * derivePurposeFromStageのエイリアス
 */
export const resolvePurposeForStage = derivePurposeFromStage;
