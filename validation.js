
async function update() {
    await buildProfileTable()

    let userProfileTurtle = await MatchingEngine.convertUserProfileToTurtle(userProfile)
    // console.log("userProfileTurtle", userProfileTurtle)
    validateAllReport = await MatchingEngine.validateAll(userProfileTurtle, turtleMap.shacl, turtleMap.datafields, turtleMap.materialization)
    console.log("validateAllReport", validateAllReport)

    let tableEl = document.getElementById("reportTable")
    tableEl.textContent = ""
    eligibleRPs = []

    for (let report of validateAllReport.reports) {
        if (report.result === "eligible") {
            eligibleRPs.push(report.rpUri)
        }
        let tr = document.createElement("tr")
        let td = document.createElement("td")
        td.textContent = getRpTitle(report.rpUri)
        searchNodeByEntryPredicateRecursively(userProfile, "ff:hasCompliedRequirementProfile", (node) => {
            node["ff:hasCompliedRequirementProfile"].forEach(rp => {
                if (rp["ff:hasRpUri"] === report.rpUri) {
                    td.style.textDecoration = "line-through"
                }
            })
        })
        if (report.containsDeferredMissingUserInput) {
            td.style.textDecoration = "line-through"
        }
        if (!metadata.rp[report.rpUri] || metadata.rp[report.rpUri].categories.length === 0) {
            td.title = "No category info available"
        } else {
            td.title = metadata.rp[report.rpUri].categories.map(cat => cat.split("#")[1]).join("\n")
        }
        tr.appendChild(td)
        td = document.createElement("td")
        td.textContent = report.result
        let msg = ""
        switch (report.result) {
            case "eligible":
                td.style.color = "green"
                td.style.fontWeight = "bold"
                msg += JSON.stringify(report.materializationReport) // TODO
                break
            case "ineligible":
                td.style.color = "red"
                for (let violation of report.violations) {
                    msg += violation.message + "\n"
                }
                break
            case "undeterminable":
                td.style.color = "gray"
                msg += "Missing data points:\n"
                for (let missing of report.missingUserInput) {
                    if (metadata.df[missing.dfUri]) {
                        msg += "- " + metadata.df[missing.dfUri].label + "\n"
                    }
                }
                break
        }
        td.title = msg
        tr.appendChild(td)
        td = document.createElement("td")
        td.style.fontSize = "x-small"
        td.style.color = "silver"
        td.innerHTML = "&nbsp;&nbsp;&nbsp;already getting this"
        td.addEventListener("click", async function() {
            let newInstanceUri = instantiateNewObjectClassUnderSubject("ff:mainPerson", "ff:hasCompliedRequirementProfile", "ff:CompliedRequirementProfile")
            addEntryToSubject(newInstanceUri, "ff:hasRpUri", report.rpUri)

            let userProfileTurtle = await MatchingEngine.convertUserProfileToTurtle(userProfile)
            let inferenceReport = await MatchingEngine.inferNewUserDataFromCompliedRPs(userProfileTurtle, turtleMap.shacl[report.rpUri])
            let msg = ""
            let triples = []
            for (let triple of inferenceReport.triples) {
                if (!triple.deferredBy) {
                    msg += shortenLongUri(triple.s) + " " + shortenLongUri(triple.p) + " " + shortenLongUri(triple.o) + "\n"
                    triples.push(triple)
                }
            }
            if (triples.length > 0 && confirm("These entries were inferred based on your already complied requirement profile '" + metadata.rp[report.rpUri].title
                + "':\n\n" + msg + "\nWould you like to add them to your profile?")) {
                for (let triple of triples) {
                    addEntryToSubject(triple.s, triple.p, triple.o)
                }
            } // else {}: should we offer to add deferments if they choose not to? But it won't pop up again anyway since inferNewUserDataFromCompliedRPs() is not called regularly
            await finalizeProfileChanges()
        })
        tr.appendChild(td)
        tableEl.appendChild(tr)
    }

    await buildPrioritizedMissingDataList()
}
