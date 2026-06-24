/**
 * Shape of POST /user-accounts/login JSON used to hydrate localStorage (password-verified snapshot).
 */
export type ChonLoginSnapshotPayload = {
  success?: boolean;
  error?: string;
  user_session_id?: string | null;
  questionnaire_type?: string;
  questionnaire_completed?: boolean;
  has_results?: boolean;
  tag_stats_local_storage?: Record<string, Record<string, unknown>>;
};

/**
 * Hydrate localStorage from POST /user-accounts/login only (password-verified snapshot in the same response).
 * Returns true when tag stats were written (user has results).
 */
export function applyLoginSnapshotPayload(
  data: ChonLoginSnapshotPayload,
  email: string
): boolean {
  if (data.success !== true || !data.user_session_id) {
    return false;
  }
  const sid = data.user_session_id;
  const normalized = email.trim().toLowerCase();
  localStorage.setItem('userSessionId', sid);
  localStorage.setItem('userSessionEmail', normalized);
  if (
    data.questionnaire_type &&
    ['mother', 'corporate', 'other', 'both'].includes(data.questionnaire_type)
  ) {
    localStorage.setItem('userSessionQuestionnaireType', data.questionnaire_type);
    localStorage.setItem('activeQuestionnaire', data.questionnaire_type);
  }
  if (data.has_results && data.tag_stats_local_storage) {
    localStorage.setItem('tagStats', JSON.stringify(data.tag_stats_local_storage));
    localStorage.setItem('chon_questionnaire_completed', 'true');
    localStorage.setItem(`characterMatchesSaved_${sid}`, 'true');
    return true;
  }
  return false;
}
