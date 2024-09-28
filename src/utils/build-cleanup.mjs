import { writeFile as write, readFile as read, readdir } from 'fs'
import { resolve} from 'path'

const { argv:args } = process

/**
 * Walk the out/public directory and cleanup somethings that the TypeScript compiler missed
 */
function cleanup() {
    // If this is being ran from an npm script we need to use a different path
    const dirPath = resolve(args.includes('--script') ? 'out/client' : '../../out/client')
    console.log(resolve(dirPath))
    readdir(dirPath, { encoding: 'utf-8', withFileTypes: true, recursive: true }, (err, files) => {
        if (err) throw err
        // console.log(files)
        for (const file of files) {
            if (file.name.endsWith('.js')) {
                read(resolve(file.path, file.name), { encoding: 'utf-8' }, (err, fileData) => {
                    if (err) throw err

                    write(resolve(file.path, file.name), fileData.replace('Object.defineProperty(exports, "__esModule", { value: true });', ''), err => { if (err) throw err })
                })
            }
        }
    })
}

cleanup()