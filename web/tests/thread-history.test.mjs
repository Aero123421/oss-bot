import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { createServer } from 'vite'

let vite, store, selectMessages
const room = (id, botId, pinned = false) => ({ id, kind: 'dm', name: id, botId, pinned, unread: 'none' })
const bot = (id, name) => ({ id, name, roleLabel: name, provider: 'codex', credStatus: 'Ready', avatarColor: '#666' })
const message = (id, sessionId, createdAt) => ({ id, sessionId, content: id, role: 'user', status: 'complete', createdAt })
const ids = (id) => selectMessages(id).map((entry) => entry.id)
const a = room('thread-a', 'bot-a', true)
const b = room('thread-b', 'bot-b')
const workspace = {
  rooms: [a, b],
  bots: [bot('bot-a', '窓口'), bot('bot-b', '調査')],
  selectedRoomId: a.id,
  activeBotId: a.botId,
}

before(async () => {
  vite = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false } })
  const mod = await vite.ssrLoadModule('/src/features/chat/store/chatStore.ts')
  store = mod.chatStore
  selectMessages = mod.selectMessagesForSession
})
after(async () => { await vite?.close() })
beforeEach(() => store.replaceWorkspace(workspace))

test('fresh workspace restores persisted messages to the right thread', () => {
  assert.equal(selectMessages(a.id), selectMessages(a.id), 'empty React snapshot is stable')
  store.restoreMessages(a.id, [message('a-1', a.id, 1), message('a-2', a.id, 2)])
  store.selectRoom(b.id)
  store.restoreMessages(b.id, [message('b-1', b.id, 1)])
  assert.deepEqual(ids(a.id), ['a-1', 'a-2'])
  assert.deepEqual(ids(b.id), ['b-1'])
})

test('metadata refresh preserves both histories and the selected thread, unless it was removed', () => {
  store.restoreMessages(a.id, [message('a-1', a.id, 1)])
  store.restoreMessages(b.id, [message('b-1', b.id, 1)])
  store.selectRoom(b.id)
  store.setStatus('streaming')
  store.replaceWorkspace({ ...workspace, bots: [workspace.bots[0], bot('bot-b', '新しい名前')] }, true)
  assert.equal(store.getState().selectedSessionId, b.id)
  assert.equal(store.getState().activeBotId, b.botId)
  assert.equal(store.getState().status, 'streaming')
  assert.equal(store.getState().bots[1].name, '新しい名前')
  assert.deepEqual(ids(a.id), ['a-1'])
  assert.deepEqual(ids(b.id), ['b-1'])

  store.replaceWorkspace({ ...workspace, rooms: [a] }, true)
  store.restoreMessages(b.id, [message('late-b', b.id, 2)])
  assert.equal(store.getState().selectedSessionId, a.id)
  assert.deepEqual(ids(a.id), ['a-1'])
  assert.deepEqual(ids(b.id), [])
})

test('history and in-flight turns merge using server IDs, in either arrival order', () => {
  const old = message('old', a.id, 1)
  const accepted = message('accepted', a.id, 2)
  store.appendMessage(message('optimistic', a.id, 2))
  store.restoreMessages(a.id, [old, accepted])
  store.confirmMessage(a.id, 'optimistic', accepted.id)
  assert.deepEqual(ids(a.id), ['old', 'accepted'])

  store.appendMessage(message('streaming', a.id, 3))
  store.confirmMessage(a.id, 'streaming', 'reply', { content: 'done', status: 'complete' })
  store.restoreMessages(a.id, [old, accepted])
  assert.deepEqual(ids(a.id), ['old', 'accepted', 'reply'])
  assert.equal(selectMessages(a.id).at(-1).content, 'done')
  store.restoreMessages(a.id, [old, accepted, message('reply', a.id, 3)])
  assert.deepEqual(ids(a.id), ['old', 'accepted', 'reply'])
})
