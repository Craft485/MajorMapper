// All this does is proves that I can remember how to write regular expression
import { readFile as read } from 'fs'

function testCase() {
    read('output.log', {encoding: 'utf-8'}, (err, data) => {
        if (err) throw err;

        const courseCodes = data.matchAll(/[A-Z]{1,}\d{1,}[A-Z]{0,}/gm)
        console.log(Array.from(courseCodes).map(x => x[0]))
    })
}

testCase()