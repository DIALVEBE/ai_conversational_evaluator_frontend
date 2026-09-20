import type { RealtimeToken } from "@tanstack/ai"
import { useRealtimeChat } from "@tanstack/ai-react"
import { openaiRealtime } from "@tanstack/ai-openai"
import { useState, type ChangeEvent } from "react"

export function App() {
  const [topics, setTopics] = useState<string[]>([])

  const addTopic = (topic: string) => setTopics([...topics, topic])

  return (
    <>
      <Topics topics={topics} addTopic={addTopic}/>
      <VoiceChat isAtLeastOneTopic={topics.length >= 1}/>
    </>
  )
}

function Topics(props: {
  topics: string[],
  addTopic: (topic: string) => void
}) {

  return(
    <>
      <TopicForm addTopic={props.addTopic}/>
      <TopicsBulletList topics={props.topics}/>
    </>
  )
}

function TopicForm(props: {
  addTopic: (topic: string) => void
}) {
  const [topicInput, setTopicInput] = useState<string>("")

  const onChange = (e: ChangeEvent<HTMLInputElement>) => setTopicInput(e.target.value)

  const addTopic = () => props.addTopic(topicInput)

  return(
    <div>
      <input value={topicInput} onChange={onChange} placeholder="El último teorema de Fermat"/>
      <button onClick={addTopic}>Agregar</button>
    </div>
  )
}

function TopicsBulletList(props: {
  topics: string[]
}) {
  if (props.topics.length === 0) {
    return (
      <p>No hay temas para evaluar, agrega al menos uno.</p>
    )
  }

  return (
    <ul>
      {props.topics.map((topic) => (
        <li key={`topic-${topic}`}>{ topic }</li>
      ))}
    </ul>
  )
}

function VoiceChat(props: {
  isAtLeastOneTopic: boolean
}) {
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
      <button onClick={onClick} disabled={!props.isAtLeastOneTopic}>
        {chat.status === 'idle' ? "Start Conversation" : "End Conversation"}
      </button>
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
