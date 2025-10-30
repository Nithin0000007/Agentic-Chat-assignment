import { Response } from "express";

export function streamEvent(res: Response, data: object) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}
