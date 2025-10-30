export type EventType = 'reasoning' | 'tool_call' | 'response';

export interface BaseEvent {
  type: EventType;
}

export interface ReasoningEvent extends BaseEvent {
  type: 'reasoning';
  content: string;
}

export interface ToolCallEvent extends BaseEvent {
  type: 'tool_call';
  tool: 'web_search';
  input: string;
  output: string; // can be plain text or JSON stringified
}

export interface ResponseEvent extends BaseEvent {
  type: 'response';
  content: string;
}

export type AgentEvent = ReasoningEvent | ToolCallEvent | ResponseEvent;
