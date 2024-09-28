import { Request, Response } from 'express'
import { EndPoint } from '../../types/backend'
import { readFile as read } from 'fs'
import { data as programData} from './program-list.json'
import { ParseAnalytics } from '../../analytics/analytics'

// TODO: See if we can fix these generic types
async function Submit(req: Request<any, any, any, any, Record<string, any>>, res: Response): Promise<void> {
    console.log(req.originalUrl)
    const stackList: string = req.query['q']
    const stacks: string[] = stackList.split(',').filter((stack, i, arr) => programData.find(plan => plan.ProgramStack === stack) !== undefined && arr.indexOf(stack) === i)
    /*for (const stack of stacks) {
        // In the future we need to go out and grab the information, for now we can just use the hand written test case
        read(`./utils/json/${stack}.json`, { encoding: 'utf-8' }, (err, data) => {
            if (err) throw err
            res.status(200).send(data)
        })
    }*/

   const result = await ParseAnalytics(stacks)
   res.send({ data: result })
}

module.exports = {
    type: 'POST',
    call: Submit
} as EndPoint