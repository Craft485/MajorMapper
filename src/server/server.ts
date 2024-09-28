import express from 'express'
import { createServer } from 'http'
import * as config from './config.json'
import { readdir } from 'fs'
import { EndPoint } from '../types/backend'

const app = express()
// Points to the out/public directory once this is compiled and within the out/server directory
app.use(express.static('../client'))
app.use(express.static('../../public'))

const server = createServer(app)

// 404 handling
app.get('*', (req, res) => {
    console.log(req.path)
    res.status(404).send('Invalid URL path')
})

// Read the utils directory and create any corresponding POST endpoints
function loadEndpoints() {
    readdir('./utils', { encoding: 'utf-8', withFileTypes: true }, async (err, files) => {
        if (err) throw err

        for await (const file of files) {
            if (!file.name.endsWith('.json') && !file.isDirectory()) {
                const fileData: EndPoint = (await import(`${file.path}/${file.name}`)).default
                if (fileData.type === 'POST') {
                    const endpoint = file.name.split('.')[0]
                    //console.log(JSON.stringify(fileData), fileData.call, JSON.stringify(fileData.call))
                    console.log(`New POST endpoint found: ${endpoint}`)
                    app.post(`/${endpoint}`, fileData.call)
                }
            }
        }
        // Grab any attempt to request non existent endpoints
        app.post('*', (req, res) => res.status(405).send('Unknown endpoint'))
    })
}

// Start listening on 127.0.0.1:8080 by default
server.listen(config.DefaultPort, () => {
    loadEndpoints()
    console.info(`Server is online on port ${config.DefaultPort}`)
})