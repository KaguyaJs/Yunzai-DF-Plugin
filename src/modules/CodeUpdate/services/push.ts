import { icqq } from 'trss-yunzai'

export async function pushTouser (type: 'QQ' | 'Group', id: number | string, Msg: icqq.Sendable) {
  return type === 'Group'
    ? Bot.pickGroup(id).sendMsg(Msg)
    : Bot.pickFriend(id).sendMsg(Msg)
}
