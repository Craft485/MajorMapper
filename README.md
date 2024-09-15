# University of Cincinnati Major Mapper (aka "Can I Double Major?")

## **Note: this app is currently in the middle of a major rework so things may change heavily and frequently as I experiment with how I want to do things**

The end goal of this project is to have a (static) single page web application that will

- Take one or more majors/minors/certifications or other curriculums
- Display a graph of the curriculum(s) along with some statistics to aid in decision making for whether or not a student wishes to pursue a certain academic avenue

## Setup

To work on or play around with this project locally:

1. Clone this repo
2. Make sure [nodejs](https://nodejs.org/en) is installed (`node --version` should be 22.X.X)
3. Run `npm install` to download dependencies
4. Run `npm run build` to compile this typescript project
5. Run `npm run start` to launch the web server on local host (port 8080)
6. Navigate to `localhost:8080` in any web browser (note: this project is being developed on Chrome, minor visual differences or issues may be present on other browsers)
*Note: Currently Computer Science (CSBS) will be the only field of study that work as I have to hard code them*

### Regards to old versions of this project

The original version of this project sought to scrape publicly available information from UC. This proved difficult to do with the inconsistencies between curriculums. Additionally, there was no feasible way to obtain information regarding prerequisite information (ie. there was no way for the program to tell that Calculus 1 is required to take Calculus 2) which is the ultimate reason I moved away from the approach altogether.
