import { Response } from 'express';
import { AgentEvent } from '../types/events';

export function initSSE(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  // Optionally send a comment to establish the connection
  res.write(':ok\n\n');
}

export function sendEvent(res: Response, event: AgentEvent) {
  const payload = JSON.stringify(event);
  res.write(`data: ${payload}\n\n`);
}

export function endSSE(res: Response) {
  // send a final sentinel if you want
  res.write('data: [DONE]\n\n');
  res.end();
}
