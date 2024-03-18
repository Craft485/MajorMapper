import express from 'express'
const app = express()
app.use(express.static('./public'))

import { createServer } from 'http'
const server = createServer(app)

import { scrape } from '../scraper.mjs'

import * as programList from './program-list.json' assert { type: 'json' }

// Using this class to keep track of what sort of properties we are interested in, may also be useful if we move to a more OOP approach
class Program {
    constructor (props) {
        /** 
         * @type {string | null} ProgramTitle (ex: Computer Science)
         * @default null
         */
        this.ProgramTitle = props.ProgramTitle || null
        /** 
         * @type {string | null} DegreeCode (ex: BSCS)
         * @default null
         */
        this.DegreeCode = props.DegreeCode || null
        /** 
         * @type {string | null} LocationCode (ex: West Campus)
         * @default null
         */
        this.LocationCode = props.LocationCode || null
        /**
         * @type {string | null} CollegeCode (ex: Engineering & Applied Science)
         * @default null
         */
        this.CollegeCode = props.CollegeCode || null
        /**
         * @type {boolean} HasMajorMap
         * @default false
         */
        this.HasMajorMap = props.HasMajorMap || false
        /** @type {string | null} DisplayDegree */
        this.DisplayDegree = props.DisplayDegree || null
        /**
         * @description  Ex: 20BC-ASE-BSAERO | Used to create the URL for the major map
         * @type {string | null} ProgramStack
         * @default null
         */
        this.ProgramStack = props.ProgramStack || null
    }
}

// 404 handeling
app.get('*', (req, res) => {
    console.log(req.path)
    res.status(404).send('Invalid URL path')
})

app.post('/submit', async (req, res) => {
    console.log(req.originalUrl)
    // req.query.q should be a comma seperated list of program stacks
    // Still need to do some level of input validation
    const r = await scrape(req.query['q'].split(','))
    res.send(r)
})

app.post('/major-info', async (req, res) => {
    console.log(req.originalUrl, req.query || '')
    /** @type {Program[]} result */
    const result = await programList.default.data.filter( /** @type {Program} program */ (program) => {
        return program.HasMajorMap &&
               program.CollegeCode === 'Engineering & Applied Science' &&
               program.LocationCode === 'West Campus' && 
               program.DegreeCode.startsWith('BS')
    })
    res.send(result)
})

// Start server on localhost/127.0.0.1 on port 8080
server.listen(8080, () => console.info(`Online at ${server.address().address}${server.address().port}`))