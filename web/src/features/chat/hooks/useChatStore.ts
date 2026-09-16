import { useSyncExternalStore } from 'react'
import { chatStore, type ChatState } from '../store/chatStore'

export function useChatStore<T>(selector: (s: ChatState) => T): T {
  return useSyncExternalStore(
    chatStore.subscribe,
    () => selector(chatStore.getState()),
    () => selector(chatStore.getState()),
  )
}
