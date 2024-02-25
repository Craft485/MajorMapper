// This is the current implementation of the project, still a long way to go
import axios from "axios"
import * as cheerio from "cheerio"
import { writeFile as write } from 'fs'

const majorID = 7262,
URL ="https://webapps2.uc.edu/ecurriculum/DegreePrograms/Home/MajorMap/" + majorID,
response = await axios.get(URL),
// Cheerio will handle any html parsing, allowing us to use a JQuery like syntax to scan the DOM
$ = cheerio.load(response.data),
classes = [],
validClass = /^([A-Z]+\d+[A-Z]{0,1}).*(\d)$/,
blaskListCourseCodes = /(?:^COOP)/g,
whitespace = /[\t\n\r]+/g,
captionBlacklist = /COOP|Senior Design|\WSelect\W|Contemporary|Tra+ck|Elective/g
let curriculum = []

// Grab all of the table elements on the page
$('table').each((i, element) => {
    const tableId = $(element).attr().id,
    // The caption element on each table holds the header, we can use this to throw out some groups of classes that we don't want to include
    tableCaption = $(`#${tableId} caption`).text().trim().replace(/\t+|\n|\r/g, ' ').replace(/ {2,}/g, '')
    // Check if the header is valid
    if (!captionBlacklist.test(tableCaption)) {
        console.log(tableCaption)
        const rowData = []
        // Grab all of the row data in the current class, each row in a table contains data for an individual class (some exceptions apply)
        $(`#${tableId} tr`).each((i, row) => {
            const classData = $(row).text().replace(whitespace, ' ').replace(/ {2,}/g, '').trim(),
            courseCodes = classData.match(/[A-Z]+\d+[A-Z]{0,1}/g) || []
            // console.log(classData)
            if (courseCodes.length == 1 && !blaskListCourseCodes.test(courseCodes[0]) && validClass.test(classData)) {
                // Extract various bits of good information
                const courseData = validClass.exec(classData), courseCode = courseData[1], credits = courseData[2]
                rowData.push(classData)
            }
        })
        // console.log(rowData)
        curriculum.push(...rowData)
    }
})

// Log results for debugging
console.log(curriculum)
console.log(curriculum.length)