import type { RealtimeToken } from "@tanstack/ai"
import { useRealtimeChat } from "@tanstack/ai-react"
import { openaiRealtime } from "@tanstack/ai-openai"
import { useEffect, useRef, useState, type ChangeEvent } from "react"
import axios from "axios"

export function App() {
  const [generalTopic, setGeneralTopic] = useState<string>("")
  const [specificTopics, setSpecificTopics] = useState<string[]>([])

  const addSpecificTopic = (topic: string) => setSpecificTopics([...specificTopics, topic])

  return (
    <>
      <GeneralTopicInput setTopic={setGeneralTopic}/>
      <SpecificTopics topics={specificTopics} addTopic={addSpecificTopic}/>
      <VoiceChat generalTopic={generalTopic} specificTopics={specificTopics}/>
    </>
  )
}

function GeneralTopicInput(props: {
  setTopic: (topic: string) => void
}) {
  const onChange = (e: ChangeEvent<HTMLInputElement>) => props.setTopic(e.target.value)

  return(
    <input onChange={onChange} placeholder="Tema general"/>
  )
}

function SpecificTopics(props: {
  topics: string[],
  addTopic: (topic: string) => void
}) {

  return(
    <>
      <h2>Temas específicos</h2>
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
      <input value={topicInput} onChange={onChange} placeholder="Concepto específico a evaluar"/>
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
  generalTopic: string,
  specificTopics: string[]
}) {
  // the use of References for the props is because useRealtimeChat receives a cached function for fetching the tokens and the topics always were null for some reason
  const propsRef = useRef({ generalTopic: props.generalTopic, specificTopics: props.specificTopics});

  useEffect(() => {
    propsRef.current = { generalTopic: props.generalTopic, specificTopics: props.specificTopics };
  }, [props.generalTopic, props.specificTopics]);

  async function fetchRealtimeToken(): Promise<RealtimeToken> {
    const { generalTopic, specificTopics } = propsRef.current;

    const response = await axios.post<RealtimeToken>(
      `${import.meta.env.VITE_BACKEND_URL}/conversations`,
      {
        topic: {
          general: generalTopic,
          specific: specificTopics
        }
      }
    )

    return response.data
  }

  const chat = useRealtimeChat({
    getToken: fetchRealtimeToken,
    adapter: openaiRealtime(),
  })

  async function onClick() {
    if (chat.status === 'idle') {
      await chat.connect()
      // chat.sendText("Hola")
    } else {
      chat.disconnect()
    }
  }

  function isConversationConfigured(): boolean {
    if (props.specificTopics.length === 0) {
      return false
    }

    if (props.generalTopic.trim() === "") {
      return false
    }

    return true
  }

  return (
    <>
      <p>Status: { chat.status }</p>
      <p>Mode: { chat.mode }</p>
      <button onClick={onClick} disabled={!isConversationConfigured()}>
        {chat.status === 'idle' ? "Start Conversation" : "End Conversation"}
      </button>
    </>
  )
}

