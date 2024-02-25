# University of Cincinnati Major Mapper (aka "Can I Double Major?")

The end goal of this project is to have a (static) single page web application that will

 - Take two majors/minors/certifications or other curriculums
 - Display general information about each individual curriculum then display the core courses that are shared between them

## Exclusions

Some types of classes we aren't super interested in inculding in our comparison for one reason or another.
These types of classes include but are not limited to:

- Electives (unless we are only looking at a list of electives(are those listed anywhere publicly?))
- Tracks within majors or certificates (perhaps in the future we can opt to inlude them)
- Any CO-OP semesters/course codes
- Any senior design classes

## Methodology

The steps this app are taking, in a very general sense, are as follows:

1. Use [axios](https://www.npmjs.com/package/axios) to send a get request and grab the curriculum
    - [Example URL](https://webapps2.uc.edu/ecurriculum/DegreePrograms/Home/MajorMap/7262) that we are hitting (only the number at the end seems to change?)
2. Use [cheerio](https://www.npmjs.com/package/cheerio) to parse the html from axios
3. Scan the page (stored as a cheerio object) for class codes that we are interested in
4. Repeat for as many curriculums we were told to compare
5. Compare the list of core classes from all scanned curriculums
6. Display resulting information about shared core classes

### Notes

Since we are using axois and cheerio (nodejs/server side libraries), we will probably have to use a [bundler such as webpack](https://webpack.js.org/) to prep it for the web app

To use the current iteration of this application from a command line context using [nodejs](https://nodejs.org/en) run `node scraper.mjs` from the root directory of this project

### Known Hurdles

1. Some spelling mistakes are present within certain curriculums
2. Formatting across different curriculums are somewhat similar but different enough to be an issue
3. Some classes (such as the CS requirement to choose either bio/physics with lab) are formatted strangly yet should probably still be included
