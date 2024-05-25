const fs = require("fs")
const path = require("path")

const shaclDir = path.join(__dirname, "public/assets/requirement-profiles/shacl")
const outputFilePath = path.join(__dirname, "public/assets/shacl-list.csv")
const pattern = /\s*(ff:[a-zA-Z0-9]+)\s*a\s*ff:RequirementProfile\s*/

fs.readdir(shaclDir, (err, shaclFiles) => {
    const lines = []
    shaclFiles.forEach(filename => {
        const filePath = path.join(shaclDir, filename)
        const content = fs.readFileSync(filePath, "utf8")
        const match = content.match(pattern)
        if (match) {
            const id = match[1]
            lines.push(`${filename},${id}`)
        }
    })
    fs.writeFileSync(outputFilePath, lines.join("\n"), "utf8")
})
