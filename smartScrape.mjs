// This is old code! This was a proof of concept for a slightly better way to parse the data so I don't have a massive amount of manual string manipulation to do
import axios from "axios"
import * as cheerio from "cheerio"
import { writeFile as write } from 'fs'

const URL ="https://webapps2.uc.edu/ecurriculum/DegreePrograms/Home/MajorMap/7262",
response = await axios.get(URL),
$ = cheerio.load(response.data),
classes = [],
validClass = /^([A-Z]+\d+).*(\d)$/

$('tbody > tr').each((index, element) => {
    const classData = $(element).text().replace(/\t+|\r|\n/g, ' ').replace(/ +/g, ' ').trim()

    if (validClass.test(classData) && !classData.startsWith('COOP')) classes.push(classData)
})

write('output.log', classes.join('\n'), (err) => {if (err) throw err})