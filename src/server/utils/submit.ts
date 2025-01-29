import { Request, Response } from 'express'
import { EndPoint } from '../../types/backend'
import { data as programData } from './program-list.json'
import { ParseAnalytics } from '../../analytics/analytics'

// TODO: See if we can fix these generic types
async function Submit(req: Request<any, any, any, any, Record<string, any>>, res: Response): Promise<void> {
    console.log(req.originalUrl)
    const stacks: string[] = (req.query['q'] as string).split(',').filter((stack, i, arr) => programData.find(plan => plan.ProgramStack === stack) !== undefined && arr.indexOf(stack) === i)
   const result = await ParseAnalytics(stacks)
   res.send({ data: result })
}

module.exports = {
    type: 'POST',
    call: Submit
} as EndPoint