# Mermaid Diagram Test

This document tests the Mermaid diagram rendering feature in Commentary.

## Flowchart

```mermaid
graph LR
    A[Start] --> B{Decision}
    B -->|Yes| C[OK]
    B -->|No| D[Cancel]
    C --> E[End]
    D --> E
```

## Sequence Diagram

```mermaid
sequenceDiagram
    participant U as User
    participant A as API
    participant D as Database

    U->>A: POST /login
    A->>D: Query user
    D-->>A: User data
    A-->>U: JWT token
```

## Class Diagram

```mermaid
classDiagram
    class Document {
        +string id
        +string content
        +render()
    }
    class Note {
        +string id
        +string text
        +Anchor anchor
    }
    Document "1" --> "*" Note
```

## State Diagram

```mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> Review: Submit
    Review --> Approved: Approve
    Review --> Draft: Request Changes
    Approved --> Published: Publish
    Published --> [*]
```

## Pie Chart

```mermaid
pie title Extension Usage
    "VS Code" : 45
    "Cursor" : 35
    "VSCodium" : 15
    "Other" : 5
```

## Invalid Mermaid (should show error)

```mermaid
this is not valid mermaid syntax
and should display an error message
```

## Regular Code Block (should still work)

```typescript
function hello(name: string): string {
  return `Hello, ${name}!`;
}
```
