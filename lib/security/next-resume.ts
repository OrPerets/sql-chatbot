export const hasBlockedNextResumeHeader = (headers: Headers): boolean => {
  return headers.has("next-resume");
};
