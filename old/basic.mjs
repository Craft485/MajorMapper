// This is old code! This was just a proof of concept for testing if I could in fact hit a UC domain and start interpreting the data
import axios from "axios"
import * as cheerio from "cheerio"
import { writeFileSync as write } from 'fs'

const URL ="https://webapps2.uc.edu/ecurriculum/DegreePrograms/Home/MajorMap/7173",
response = await axios.get(URL),
$ = cheerio.load(response.data),
data = $('tr').text().trim().replace(/\r|\n\n/g, '').replace(/\t{1,}/g, '\t').split('\n').filter(v => v !== '\t').filter(v => !/^\t?(Course|Title\/Desc|Credit)$/gi.test(v)).map(v => v.trim()).map(v => v.replace(/\t/g, ' ')).filter(s => !/^COOP\d{1,}/.test(s)).filter(n => n !== '0').filter(s => !s.toLowerCase().includes('semester experience')).join('\n').replace(/general education course\n\d{1,}/gi, '').replace(/.*BoK.*\n.*(?:.*\n\d)?/g, '').replace(/General Elective\n\d/g, '').replace(/[A-Z]{1,}\d{1,}[A-Z]{0,}\n.*Senior Design.*\n\d/g, '').replace(/\dX{1,}\+?\n?.*Design.*\n\d/g, '').replace(/^\dX+\+?\n(?:.*\n){1,3}^\d$/gm, '').replace(/.*\n.*Elective.*\n\d/g, '').replace(/.*\n\d ?- ?\d/g, '').split('\n').filter(Boolean).map(v => { if (/PD\d+:/.test(v)) { return v.split(': ') } else { return v } }).flat()

console.log(data)
let increment = 3
const courseCodeScanStrict = /^[A-Z]{1,}\d{1,}[A-Z]{0,}$/, courseCodeScanBasic = /[A-Z]{1,}\d{1,}[A-Z]{0,}/
for (let i = 0; i < data.length; i += increment) {
    const code = data[i], name = data[i + 1], credits = data[i + 2]
    if (courseCodeScanStrict.test(code)) {
        // Valid course code found, name and credits should also be valid (not 100% sure yet)
    } else {
        // Current course code isn't an actual course code, we need to figure out what it actually is
    }
}

write('output_aeem.log', data.join('\n'))