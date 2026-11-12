declare module '*lib/plugins/loader.js' {
  const loader: {
    /** 撤销插件的处理器和定时任务；旧版框架可能不提供此方法。 */
    unloadPlugin?: (name: string, closeWatcher?: boolean) => Promise<void>
  }
  export default loader
}
