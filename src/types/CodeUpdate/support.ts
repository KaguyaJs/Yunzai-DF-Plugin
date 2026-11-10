export type GitApiMethod = 'commits' | 'releases' | 'pulls' | 'issues'
export type GitActivityMethod = Extract<GitApiMethod, 'pulls' | 'issues'>
export type GitActivityAction = 'opened' | 'closed' | 'reopened' | 'merged' | 'ready_for_review' | 'converted_to_draft' | 'edited' | 'labeled' | 'unlabeled' | 'synchronize' | 'commented'
