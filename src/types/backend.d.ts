import { Request, Response } from 'express'
import { Program } from './university'

export type EndPoint = {
    type: 'POST' | 'GET'
    call: (req: Request, res: Response) => Promise<void>
}

// TODO: Build this type out more
export type ProgramList = Program & { }