/** Server Action がフォームに返す結果 */
export interface FormState {
  /** フォーム全体のエラー */
  error?: string;
  /** 項目ごとのエラー */
  fieldErrors?: Record<string, string>;
  /** 成功時のメッセージ */
  message?: string;
  /** 入力し直さなくてよいように返す値（パスワードは返さない） */
  values?: Record<string, string>;
}

export const initialFormState: FormState = {};
