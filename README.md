# ACAE: AI Conversational Academic Evaluator (Backend)

Deno API connected to OpenAI Realtime API for conversational testing and asessment of any academical/education topic.

## Getting Started

### Initial configuratoin

Make sure to have Deno installed. The repository provides a `flake.nix` dev environment for the NixOS devs out there.

### Running

For development

```
deno task dev
```

# Features

As a teacher/administrator you can create verbal tests with any number of topics for the conversational AI to evaluate. With the same test you can create any number of temporal links to assign for every student and give you the metrics and statistics of their results in the test, either of a specific student or all of them.

# TODO

- Remove specific topics from list
- Improve UI
- Firefox has problems with using WebRTC on unstable connections and localhost (development environments). Until I keep using the Tanstack AI library the problem will persist, because I need to define a STUN server explicitly

# Links

- OpenAI Realtime API reference: https://developers.openai.com/api/reference/typescript/resources/realtime

