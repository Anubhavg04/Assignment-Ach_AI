# Architecture & Design Decisions

## 1. Sequence-based Ordering and Deduplication
I used a `SequenceBuffer` class acting as a sliding window min-heap/priority queue. Instead of just dumping everything into a massive array and sorting it repeatedly on every render, the buffer stores out-of-order events in a Map keyed by `seq`. I maintain a `cursor` pointing to the next expected `seq`. When a new event arrives, if its `seq` is exactly the cursor, it gets processed immediately (along with any contiguous subsequent events waiting in the Map). If the `seq` is ahead of the cursor, it stays in the Map. If the `seq` is less than the cursor, it's treated as a duplicate and ignored. This keeps the typical case O(1) and cleanly buffers chaos mode shuffles without causing UI jitter.

## 2. Preventing Layout Shift During Tool Calls
Layout shift is the enemy of a good streaming UX. My approach was to separate the "text rendering" block from the "tool card" block in the DOM structure. When a `TOOL_CALL` arrives, the active text block's state is preserved exactly as-is. Instead of appending the tool call into the middle of the text string (which would break Markdown parsing and cause massive reflows), I push a dedicated `tool` node into the trace array. The renderer maps over these blocks linearly: `<TextNode />`, then `<ToolCard />`, then `<TextNode />` again once `TOOL_RESULT` arrives and the text stream resumes. By rendering them as sibling block elements, the tool card simply pushes down the scroll boundary without reflowing the text above it.

## 3. Reconnection State Recovery
The biggest challenge with reconnection is that the DOM might not have consumed everything the socket received before the connection died. To handle this, I use a reducer state pattern where the `lastSeq` is strictly updated *only* when the UI successfully processes the event into the local state arrays (`chatHistory`, `traceEntries`). When the WebSocket drops, the socket might have received sequence 45, but if the reducer only committed up to 42 before the drop, the `RESUME` message will explicitly ask for `last_seq: 42`. This ensures that the replay acts as the source of truth, and any partially parsed buffers are discarded in favor of the replay stream.

## 4. Scaling to 50 Concurrent Agent Streams
If we had 50 streams going at once, rendering the full DOM for all of them would melt the browser's main thread. 
- **DOM Virtualization:** I'd implement react-virtuoso or similar to only render the streams currently visible in the viewport.
- **Worker Threads:** The JSON diffing engine for Context Snapshots currently runs on the main thread. With 50 streams, computing those diffs (especially 500KB+ payloads) would cause extreme jank. I would move `computeJsonDiff` into a Web Worker so the main thread only receives the compiled render tree.
- **WebSocket Multiplexing:** Instead of 50 separate WebSocket connections, we'd definitely need to multiplex them over a single connection to avoid hitting browser connection limits.

## 5. Handling 100x Longer Responses
For full document generation (megabytes of text), keeping the entire string in React state is a recipe for memory leaks and sluggish re-renders. 
- **Chunked Rendering:** I'd stop trying to pass the entire concatenated string to a single Markdown parser. Instead, I'd parse the stream into distinct blocks (paragraphs, headers, code blocks) and only re-render the *active* block.
- **Canvas/WebGL Text Rendering:** If it really gets massive and we need 60fps scrolling, standard DOM text rendering gets slow. We might need to look at how VS Code handles its editor surface (canvas or highly virtualized lines).
- **Disk Backing:** I'd stream the document directly into IndexedDB as it arrives, keeping only the viewport and a small buffer in RAM, effectively building a local paging system.
