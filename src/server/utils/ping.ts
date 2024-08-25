import { Request, Response } from 'express'
import { EndPoint } from '../../types/backend'

function Ping(req: Request, res: Response): void {
    res.status(200).send('Pong!')
}

// export const ping: EndPoint
module.exports = {
    type: 'POST',
    call: Ping
} as EndPoint