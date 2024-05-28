
async function buildRemovalCell(td, sKey, pKey) {
    td.textContent = "x"
    td.addEventListener("click", async function() {
        if (confirm("Do you want to remove this entry?")) {
            console.log("Removing entry:", sKey, pKey)
            searchSubjectNodeRecursively(userProfile, sKey, (node) => delete node[pKey])
            await finalizeProfileChanges()
        }
    })
}

function buildProfileTableRecursively(node, depth, table) {
    let subject = node["@id"]
    for (let [predicate, objectOrArray] of Object.entries(node)) {
        if (predicate.startsWith("@")) continue
        if (!Array.isArray(objectOrArray)) {
            let tds = buildRowAndColumns(table)
            let label = determineLabelForTableEntries(predicate)
            tds[depth].textContent = label
            tds[depth].title = predicate
            tds[depth + 1].textContent = determineLabelForTableEntries(objectOrArray)
            tds[depth + 1].title = objectOrArray
            tds[depth + 1].addEventListener("click", async function() {
                let input = prompt(`Enter new value for ${label}`)
                if (input !== null) {
                    console.log("Changing entry value:", subject, predicate, "-->", input)
                    searchSubjectNodeRecursively(userProfile, subject, (node) => node[predicate] = input)
                    await finalizeProfileChanges()
                }
            })
            buildRemovalCell(tds[maxDepth + 2], subject, predicate)
            continue
        }
        for (let arrayElement of objectOrArray) {
            let tds = buildRowAndColumns(table)
            tds[depth].textContent = dfShortUriToLabel(predicate)
            tds[depth].title = predicate
            // this will delete all array elements of the same type at the moment TODO fix
            buildRemovalCell(tds[maxDepth + 2], subject, predicate)
            buildProfileTableRecursively(arrayElement, depth + 1, table)
        }
    }
}

// this is needed to know the correct number of columns in the profile table in advance
function determineDepthOfProfileTreeRecursively(jsonNode, depth) {
    if (depth > maxDepth) maxDepth = depth
    for (let objectOrArray of Object.values(jsonNode)) {
        if (!Array.isArray(objectOrArray)) continue
        for (let arrayElement of objectOrArray) determineDepthOfProfileTreeRecursively(arrayElement, depth + 1)
    }
}

function buildProfileTable() {
    let div = document.getElementById("userProfileDiv")
    div.innerHTML = ""
    let table = document.createElement("table")
    table.className = "framed-table"
    div.appendChild(table)
    maxDepth = 0
    determineDepthOfProfileTreeRecursively(userProfile, 0)
    buildProfileTableRecursively(userProfile, 0, table)
}

function buildFocusInputSelectChoices() {
    let categories = {}
    let rps = []
    for (let rp of Object.values(metadata.rp)) {
        rps.push({
            value: rp.uri,
            label: rp.title,
        })
        for (let cat of rp.categories) {
            if (!categories[cat]) categories[cat] = []
            categories[cat].push(rp.uri)
        }
    }
    metadata.categories = categories
    focusInputSelect.setChoices([
        {
            label: "Categories",
            choices: Object.keys(categories).map(uri => {
                return {
                    value: uri,
                    label: uri.split("#")[1],
                }
            })
        },
        {
            label: "Requirement Profiles",
            choices: rps
        },
    ])
}

async function buildPrioritizedMissingDataList() {
    let div = document.getElementById("missingDataPointsDiv")
    div.textContent = ""
    let prioritizedList = []

    let missingData = validateAllReport.missingUserInputsAggregated

    let focusRPs = []
    for (let focusItem of focusInputSelect.getValue(true)) {
        if (metadata.categories[focusItem]) {
            focusRPs = focusRPs.concat(metadata.categories[focusItem])
        } else {
            focusRPs.push(focusItem)
        }
    }

    for (let datafield of Object.values(missingData)) {
        let usedInRpUris = datafield.usedIn.map(usedInRP => usedInRP.rpUri)
        if (focusRPs.length > 0 && !usedInRpUris.some(rpUri => focusRPs.includes(rpUri))) {
            continue
        }

        let usedInTitles = []
        let lastMissingCounter = 0
        for (let usedInRP of datafield.usedIn) {
            usedInTitles.push(metadata.rp[usedInRP.rpUri].title + (usedInRP.isLastMissingUserInput ? " (!)" : ""))
            if (usedInRP.isLastMissingUserInput) lastMissingCounter += 1
        }
        prioritizedList.push({
            subject: datafield.subject,
            dfUri: datafield.dfUri,
            objectHasClass: metadata.df[datafield.dfUri]?.objectHasClass,
            label: metadata.df[datafield.dfUri]?.label ?? datafield.dfUri.split("#")[1],
            score: datafield.usedIn.length + lastMissingCounter,
            usedInTitles: usedInTitles
        })
    }
    prioritizedList.sort((a, b) => b.score - a.score)
    prioritizedList.forEach((entry) => { // entry = wrapped datafield
        let spanEl = document.createElement("span")
        spanEl.title = entry.usedInTitles.join("\n")
        spanEl.style.color = "gray"
        let textNode = document.createTextNode(entry.score + ": ")
        spanEl.appendChild(textNode)
        div.appendChild(spanEl)
        spanEl = document.createElement("a")
        spanEl.textContent = collectSubjectClassLabelsAlongPath(entry)
        searchNodeByEntryPredicateRecursively(userProfile, "ff:hasDeferred", (node) => {
            node["ff:hasDeferred"].forEach(deferment => {
                if (deferment["rdf:subject"] === entry.subject && deferment["rdf:predicate"] === entry.dfUri) {
                    spanEl.style.textDecoration = "line-through"
                }
            })
        })
        spanEl.addEventListener("click", async function(event) {
            event.preventDefault()
            if (entry.objectHasClass) {
                if (confirm("Do you want to add a " + metadata.df[entry.objectHasClass].label + "?")) {
                    instantiateNewObjectClassUnderSubject(entry.subject, entry.dfUri, entry.objectHasClass)
                    await finalizeProfileChanges()
                }
                return
            }
            let input = prompt("What is your value for: " + entry.label)
            if (input !== null) {
                addEntryToSubject(entry.subject, entry.dfUri, input)
                await finalizeProfileChanges()
            }
        })
        div.appendChild(spanEl)
        spanEl = document.createElement("span")
        spanEl.style.fontSize = "x-small"
        spanEl.style.color = "silver"
        spanEl.innerHTML = "&nbsp;&nbsp;defer this"
        spanEl.addEventListener("click", async function() {
            addDeferment(entry.subject, entry.dfUri)
            await finalizeProfileChanges()
        })
        div.appendChild(spanEl)
        div.appendChild(document.createElement("br"))
    })
    for (const elem of Array.from(document.getElementsByClassName("loadingDiv"))) {
        elem.style.display = "none"
    }
}

function collectSubjectClassLabelsAlongPath(entry) { // prioritizedListEntry
    if (shortenLongUri(entry.subject) === "ff:mainPerson") {
        return entry.label
    }
    let sUri = shortenLongUri(entry.subject)
    let path = ""
    let finalPath
    function recurse(node, arrIndex, sUri, path) {
        if (node["@type"] !== "ff:Citizen") path += ", " + metadata.df[expandShortUri(node["@type"])].label + " " + arrIndex
        for (let objectOrArray of Object.values(node)) {
            if (objectOrArray === sUri) {
                finalPath = path.substring(1)
            }
            if (Array.isArray(objectOrArray)) {
                for (let i = 0; i < objectOrArray.length; i++) {
                    let arrayEl = objectOrArray[i]
                    recurse(arrayEl, i, sUri, path)
                }
            }
        }

    }
    recurse(userProfile, 0, sUri, path)
    return finalPath + ": " + entry.label
}
