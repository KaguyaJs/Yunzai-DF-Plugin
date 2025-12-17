import type { Config } from './Config'
import type { SupportGuoba, Schemas, ConfigInfo } from 'trss-yunzai/guoba'

export type GuobaType = SupportGuoba<Config>

export type GuobaSchemas = Schemas<Config>

export type GuobaConfigInfo = ConfigInfo<Config>
