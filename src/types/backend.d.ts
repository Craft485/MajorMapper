import { Request, Response } from "express"

export type EndPoint = {
    type: 'POST' | 'GET'
    call: (req: Request, res: Response) => Promise<void>
}