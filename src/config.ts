/** Limits and tunables shared by the worker actions and the UI. */

export const LIMITS = {
  groupNameMax: 60,
  maxGroupsPerUser: 10,
  lectureLabelMax: 80,
  noteBodyMax: 15_000,
  maxNotesPerUserPerGroup: 20,
  joinAttemptsPerMinute: 5,
  aiCallsPerUserPerDay: 25,
} as const
