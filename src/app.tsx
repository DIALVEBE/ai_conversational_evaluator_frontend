import type { RealtimeToken } from "@tanstack/ai"
import { useRealtimeChat } from "@tanstack/ai-react"
import { openaiRealtime } from "@tanstack/ai-openai"

export function App() {
  return (
    <>
      <VoiceChat/>
    </>
  )
}

async function fetchRealtimeToken(): Promise<RealtimeToken> {
  const result = await fetch(
    `${import.meta.env.VITE_BACKEND_URL}/conversations`,
    { method: 'POST' },
  )

  return result.json()
}

function VoiceChat() {
  const chat = useRealtimeChat({
    getToken: fetchRealtimeToken,
    adapter: openaiRealtime(),
    vadMode: "semantic"
  })

  async function onClick() {
    if (chat.status === 'idle') {
      await chat.connect()
      chat.sendText("Hola")
    } else {
      chat.disconnect()
    }
  }

  return (
    <>
      <p>Status: { chat.status }</p>
      <p>Mode: { chat.mode }</p>
      <button onClick={onClick}>
        {chat.status === 'idle' ? "Start Conversation" : "End Conversation"}
      </button>
    </>
  )
}
