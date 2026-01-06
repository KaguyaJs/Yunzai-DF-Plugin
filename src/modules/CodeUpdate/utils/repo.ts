/**
 * 传入repo和branch返回仓库路径
 *
 * @example
 * repoPath('Le-niao/Yunzai-Bot', 'main') → 'Le-niao/Yunzai-Bot:main'
 */
export function repoPath (repo: string, branch?: string) {
  return branch
    ? `${repo}:${branch}`
    : repo
}
