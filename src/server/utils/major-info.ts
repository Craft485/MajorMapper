import { Request, Response } from 'express'
import { EndPoint } from '../../types/backend'
import { Program } from '../../types/university'
import { data } from './program-list.json'

async function GetProgramList(req: Request, res: Response): Promise<void> {
    const DegreeCodeWhiteList = /BSCS|BSCOMPE|BSEE/
    console.log(req.originalUrl, req.query || '')
    const result: Program[] = data.filter(program => {
        // This is temporary, in the future we can check url params for filters
        return program.HasMajorMap &&
               program.CollegeCode === 'Engineering & Applied Science' &&
               program.LocationCode === 'West Campus' &&
               program.DegreeCode.startsWith('BS') &&
               DegreeCodeWhiteList.test(program.DegreeCode)
    })
    res.status(200).send(result)
}

module.exports = {
    type: 'POST',
    call: GetProgramList
} as EndPoint