
function addEntryToSubject(subject, predicate, objectValue) {
    subject = shortenLongUri(subject)
    predicate = shortenLongUri(predicate)
    console.log("Adding entry:", subject, predicate, "-->", objectValue)
    searchSubjectNodeRecursively(userProfile, subject, (node) => node[predicate] = objectValue)
}

function instantiateNewObjectClassUnderSubject(subject, predicate, objectClass) {
    console.log("Adding object class instantiation:", subject, predicate, "-->", objectClass)
    let shortObjectClassUri = shortenLongUri(objectClass)
    let newInstanceUri = shortObjectClassUri.toLowerCase()
    let nodeFound = false
    searchNodeByEntryPredicateRecursively(userProfile, predicate, (node) => {
        nodeFound = true
        newInstanceUri = newInstanceUri + node[predicate].length
        node[predicate].push({ "@id": newInstanceUri, "@type": shortObjectClassUri }) // verify that this works TODO
    })
    if (!nodeFound) { // e.g. no ff:hasChild array yet
        newInstanceUri = newInstanceUri + "0"
        addEntryToSubject(subject, predicate, [{ "@id": newInstanceUri, "@type": shortObjectClassUri }])
    }
    return newInstanceUri
}

async function finalizeProfileChanges() {
    if (!await validateUserProfile()) return

    let userProfileTurtle = await MatchingEngine.convertUserProfileToTurtle(userProfile)
    let materializationReport = await MatchingEngine.checkUserProfileForMaterializations(userProfileTurtle, turtleMap.materialization)
    // run inferNewUserDataFromCompliedRPs() here too?
    console.log("materializationReport", materializationReport)

    let msg = ""
    let triples = []
    for (let round of materializationReport.rounds) {
        for (let [ruleUri, entry] of Object.entries(round)) {
            let ruleLocalName = ruleUri.split("#")[1]
            msg += "Via materialization rule '" + ruleLocalName + "' (input: "
            msg += entry.input ? metadata.df[entry.input].label : "?"
            msg += " output: " + (entry.output ? metadata.df[entry.output].label : "?") + "):\n"
            for (let triple of entry.triples) {
                if (!triple.deferredBy) {
                    msg += shortenLongUri(triple.s) + " " + shortenLongUri(triple.p) + " " + shortenLongUri(triple.o) + "\n"
                    triples.push(triple)
                }
            }
        }
    }
    if (triples.length > 0) {
        if (confirm("The following entries where inferred from your existing entries:\n\n" + msg + "\nWould you like to add them to your profile?")) {
            for (let triple of triples) {
                addEntryToSubject(triple.s, triple.p, triple.o)
            }
            if (!await validateUserProfile()) return
        } else {
            if (!confirm("May I ask you later again to add these? ")) {
                for (let triple of triples) {
                    addDeferment(triple.s, triple.p)
                }
            }
        }
    }
    console.log("userProfile", userProfile)
    localStorage.setItem("userProfile", JSON.stringify(userProfile))
    await update()
}

async function validateUserProfile() {
    let userProfileTurtle = await MatchingEngine.convertUserProfileToTurtle(userProfile)
    let report = await MatchingEngine.validateUserProfile(userProfileTurtle, turtleMap.datafields)
    if (!report.conforms) {
        console.log("User profile validation violations:", report.violations)
        // pretty print violations TODO
        alert("Your profile is not valid: " + JSON.stringify(report.violations))
        return false
    }
    return true
}
