// This is the current implementation of the project, still a long way to go
import axios from "axios"
import * as cheerio from "cheerio"

// TODO: Should probably try and clean this up a bit, feels messy
const baseURL ="https://webapps2.uc.edu/ecurriculum/DegreePrograms/Home/MajorMap/",
courseCodesExp = /[A-Z]+\d+[A-Z]{0,1}/g,
validClass = /^([A-Z]+\d+[A-Z]{0,1}).*(\d)$/,
blaskListCourseCodes = /(?:^COOP)/g,
whitespace = /[\t\n\r]+/g,
captionBlacklist = /COOP|Senior Design|\WSelect\W|Contemporary|Tra+ck|Elective/g

/**
 * THIS FUNCTION SHOULD NEVER BE CALLED BY ANY OTHER FILE
 * @param {string} curriculumStack
 * @param {Boolean} debug
*/
async function scrapeIndividual(curriculumStack, debug = false) {
    // TODO: Deal with validating that the given curriculum actually exists (use fetch and check status code in response headers?)
    // NOTE: Maybe try chaining Promise#then calls after this get to get around the issue of function returning early?
    const curriculum = []
    const response = await axios.get(baseURL + curriculumStack)
    // Cheerio will handle any html parsing, allowing us to use a JQuery like syntax to scan the DOM
    const $ = cheerio.load(response.data)
    // Grab all of the table elements on the page
    const tables = $('table')
    tables.each((i, element) => {
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
                courseCodes = classData.match(courseCodesExp) || []
                // console.log(classData)
                if (courseCodes.length === 1 && !blaskListCourseCodes.test(courseCodes[0]) && validClass.test(classData)) {
                    // Extract various bits of good information
                    const courseData = validClass.exec(classData), courseCode = courseData[1], credits = courseData[2]
                    rowData.push(classData)
                }
            })
            // console.log(rowData)
            curriculum.push(...rowData)
        }
    })
    if (debug) {
        // Log results for debugging
        console.log(curriculum)
        console.log(curriculum.length)
    }
    // NOTE: This function is returning before the scrape is complete, fix this
    return curriculum
}

/**
 * This should be the only function accessing scrapeIndividual
 * @param {Array<string> | null} curriculumStacks List of major identifying information used to create the urls to scape
 * @param {Boolean} debug Should the script output log statements?
 * @returns string[][]
 */
export async function scrape(curriculumStacks = null, debug = false) {
    const result = []
    for (const stack of curriculumStacks) result.push(await scrapeIndividual(stack, debug))
    return result
}

// Allow this script to be ran as a standalone instance
if (process.argv[2]) console.info(scrape(process.argv[2].split(','), true))